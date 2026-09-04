# 05 — Authorization Architecture

RBAC from day one (§26), even though exactly one role is in use.

---

## 1. Model

```
User ──has one──> Role ──grants──> Permission[]
```

| Role | Status | Intent |
|---|---|---|
| `ADMIN` | **Implemented in v1** | Full control of all content and settings |
| `SUPER_ADMIN` | Column-supported, **not implemented** | Would add user management + destructive settings |
| `EDITOR` | Column-supported, **not implemented** | Would add content CRUD without settings/users/audit |

Per §26 ("do not implement extra roles without need"), only `ADMIN` exists as behaviour. The
permission table below is written so the other two are a data change, not a refactor.

## 2. Permissions

Permissions are `resource:action` strings, defined in `packages/shared/rbac.ts`:

```ts
export const PERMISSIONS = {
  project:  ['read', 'create', 'update', 'delete', 'publish', 'reorder'],
  article:  ['read', 'create', 'update', 'delete', 'publish', 'reorder'],
  research: ['read', 'create', 'update', 'delete', 'publish'],
  security: ['read', 'create', 'update', 'delete'],
  skill:    ['read', 'create', 'update', 'delete', 'reorder'],
  // ... technology, certification, experience, education, timeline, socialLink
  media:    ['read', 'upload', 'update', 'delete'],
  message:  ['read', 'update', 'delete'],
  settings: ['read', 'update'],
  profile:  ['read', 'update'],
  audit:    ['read'],
  analytics:['read'],
  user:     ['read', 'create', 'update', 'delete'],
} as const;

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN:       ALL_EXCEPT(['user:create', 'user:delete']),
  SUPER_ADMIN: ALL,
  EDITOR:      [/* reserved, unused in v1 */],
};
```

Static map, not a database table. A `role_permissions` table would be the right call for
user-configurable roles; here it would be an empty abstraction serving one hardcoded row (§50).
Promoting it to a table later is a migration plus one repository function.

## 3. Enforcement points

Authorization is checked **three** times, deliberately — defence in depth, never a single choke point:

| # | Layer | Check | Failure |
|---|---|---|---|
| 1 | `authenticate` middleware | Valid, unexpired access token; user active; `tokenVersion` matches | `401` |
| 2 | `authorize('project:publish')` middleware | Role's permission set contains the required permission | `403` |
| 3 | **Service layer** | Contextual rules that a middleware cannot know (see §4) | `403` / `404` |

The UI additionally hides what the user cannot do — that is **UX, not security** (§26). Every admin
endpoint is protected independently of the UI, and the E2E suite includes a test that calls each
admin endpoint with no cookie and asserts `401`.

```ts
router.post(
  '/:id/publish',
  authenticate,
  authorize('project:publish'),
  validate({ params: idParamSchema }),
  projectController.publish,
);
```

## 4. Contextual rules enforced in services (not middleware)

| Rule | Reason |
|---|---|
| A project cannot be published while `title`/`slug`/`shortDescription`/`coverMediaId` are missing | Publishing a broken public page is a business-rule failure, not a permission failure → `422`-style `VALIDATION_ERROR` |
| A finding with `severity ∈ {CRITICAL, HIGH}` and `status = OPEN` can never be made public | Protects you from disclosing a live vulnerability in your own site |
| A media row cannot be deleted while referenced | `409 CONFLICT` + list of usages |
| The last active `ADMIN` cannot be deactivated or deleted | Prevents total lockout |
| Audit logs cannot be written to or deleted through any endpoint | Integrity of the trail |
| Draft/archived content is invisible to unauthenticated readers | Applied in the repository layer, so it cannot be forgotten in a controller |

## 5. The draft-visibility rule (§52)

This is enforced at the lowest possible layer. Public repositories accept no `status` argument at
all — they hardcode the filter:

```ts
// repositories/projectRepository.ts
export const findPublishedBySlug = (slug: string) =>
  prisma.project.findFirst({
    where: { slug, status: 'PUBLISHED', publishedAt: { lte: new Date() } },
    include: PUBLIC_PROJECT_INCLUDE,
  });

// A separate, explicitly named function is the ONLY way to read drafts:
export const findAnyByIdForAdmin = (id: number) =>
  prisma.project.findUnique({ where: { id }, include: ADMIN_PROJECT_INCLUDE });
```

Two different functions, two different `include` shapes. There is no boolean flag like
`includeDrafts` that could default wrong or be passed a user-controlled value — that pattern is how
draft leaks happen. `findAnyByIdForAdmin` is only reachable from admin controllers, and a lint rule
forbids importing `*ForAdmin` repository functions from public controllers.

## 6. IDOR posture

- Public routes address content by **slug** and always filter by status — an id guess reveals nothing.
- Admin routes address by numeric id, but every admin route already requires the `ADMIN` role, and
  there is a single admin, so there is no horizontal privilege boundary to cross **today**.
- Because `EDITOR` may exist later, ownership fields (`articles.author_id`, `media.uploaded_by`) are
  populated now, and the service signature already takes an `actor` argument everywhere. Adding
  "editors may only edit their own drafts" then becomes one condition, not a rewrite.
- The security test plan (doc 10) includes explicit IDOR cases: authenticated-as-nobody access to
  every `/admin/*` id, and cross-entity id substitution (using an article id on a project route).

## 7. Audit coupling

Every permission-gated mutation writes an audit entry **inside the same transaction** as the change:

```ts
await prisma.$transaction(async (tx) => {
  const updated = await projectRepo.publish(tx, id);
  await searchRepo.upsert(tx, 'PROJECT', updated);
  await auditRepo.record(tx, {
    userId: actor.id, action: 'PROJECT_PUBLISH',
    entityType: 'PROJECT', entityId: id,
    metadata: { slug: updated.slug, title: updated.title },
    ipHash: actor.ipHash, userAgent: actor.userAgent,
  });
});
```

If the audit write fails, the mutation rolls back. An action that is not auditable does not happen.
