/**
 * RBAC model (docs/architecture/05). A static map, not a database table — a
 * `role_permissions` table would be the right call for user-configurable
 * roles, but with exactly one role actually granted any permissions today
 * (`ADMIN`), a table would be an empty abstraction serving one hardcoded row.
 * Promoting this to a table later is a migration plus one repository
 * function, not a redesign.
 *
 * Every resource this platform will ever manage is listed here now, even
 * though most have no routes yet (those arrive in Phases 5 and 8) — the
 * permission STRING is pure data, and defining the full set up front means
 * `authorize('project:publish')` reads the same way everywhere it is ever
 * called, instead of the set growing ad hoc per phase.
 */

import type { UserRole } from './content.js';

export const PERMISSIONS = {
  project: ['read', 'create', 'update', 'delete', 'publish', 'reorder'],
  article: ['read', 'create', 'update', 'delete', 'publish', 'reorder'],
  research: ['read', 'create', 'update', 'delete', 'publish'],
  security: ['read', 'create', 'update', 'delete'],
  skill: ['read', 'create', 'update', 'delete', 'reorder'],
  technology: ['read', 'create', 'update', 'delete', 'reorder'],
  certification: ['read', 'create', 'update', 'delete', 'reorder'],
  experience: ['read', 'create', 'update', 'delete', 'reorder'],
  education: ['read', 'create', 'update', 'delete', 'reorder'],
  timeline: ['read', 'create', 'update', 'delete', 'reorder'],
  socialLink: ['read', 'create', 'update', 'delete', 'reorder'],
  media: ['read', 'upload', 'update', 'delete'],
  message: ['read', 'update', 'delete'],
  settings: ['read', 'update'],
  profile: ['read', 'update'],
  audit: ['read'],
  analytics: ['read'],
  user: ['read', 'create', 'update', 'delete'],
} as const;

type PermissionMap = typeof PERMISSIONS;
type ResourceName = keyof PermissionMap;

/** Every valid `"resource:action"` string, derived from `PERMISSIONS` — adding
 * a resource or action here is the only place that needs to change. */
export type Permission = {
  [R in ResourceName]: `${R}:${PermissionMap[R][number]}`;
}[ResourceName];

function allPermissions(): Permission[] {
  return (Object.keys(PERMISSIONS) as ResourceName[]).flatMap((resource) =>
    PERMISSIONS[resource].map((action) => `${resource}:${action}` as Permission),
  );
}

const ALL: Permission[] = allPermissions();

function allExcept(excluded: Permission[]): Permission[] {
  const excludedSet = new Set<Permission>(excluded);
  return ALL.filter((permission) => !excludedSet.has(permission));
}

/**
 * `ADMIN` is granted everything except creating or deleting other user
 * accounts — user management is reserved for `SUPER_ADMIN`, which is
 * column-supported but has no implemented behaviour in v1
 * (docs/architecture/05 §1). `EDITOR` is reserved, empty, unused.
 *
 * Keyed by `UserRole` from constants/content.ts — the single source of truth
 * for the role enum, shared with the `users.role` CHECK constraint.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: allExcept(['user:create', 'user:delete']),
  SUPER_ADMIN: ALL,
  EDITOR: [],
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
