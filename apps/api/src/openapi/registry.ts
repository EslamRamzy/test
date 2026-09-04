import {
  analyticsViewSchema,
  articleListQuerySchema,
  changePasswordSchema,
  contactSchema,
  loginSchema,
  projectListQuerySchema,
  searchQuerySchema,
  securityResearchListQuerySchema,
  slugParamSchema,
  technologyListQuerySchema,
} from '@portfolio/shared';
import {
  extendZodWithOpenApi,
  OpenApiGeneratorV31,
  OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

/**
 * Generated OpenAPI (docs/architecture/03 §8): the spec is built from the
 * SAME Zod schemas `validate` middleware enforces at runtime — a
 * hand-maintained YAML would drift from the real validation rules within a
 * week; this cannot, because it IS the real validation rules.
 *
 * Scope note: request `params`/`query`/`body` schemas below are the actual
 * runtime contract (real, generated, exact). Response BODIES are
 * deliberately documented as the envelope shape plus a description, not the
 * full nested DTO per endpoint — `packages/shared/src/types/publicContent.ts`
 * defines those DTOs as plain TS interfaces, not Zod schemas (see that
 * file's header for why), and zod-to-openapi can only convert a Zod schema.
 * Duplicating every DTO as a second, parallel Zod schema purely to document
 * response shapes was judged not worth the maintenance burden it would add
 * for a first-generation API doc — a `PublicMediaRef`/`ProjectDetailDto`-shaped
 * example lives in `docs/api/` guides instead, not enforced by this file.
 */

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const errorEnvelopeSchema = registry.register(
  'ErrorEnvelope',
  z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
    }),
  }),
);

const paginationMetaSchema = registry.register(
  'PaginationMeta',
  z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
);

function jsonBody(description: string, schema: z.ZodTypeAny) {
  return { description, content: { 'application/json': { schema } } };
}

const successResponse = (description = 'Success') =>
  jsonBody(description, z.object({ success: z.literal(true), data: z.unknown() }));
const paginatedResponse = (description = 'Success (paginated)') =>
  jsonBody(
    description,
    z.object({ success: z.literal(true), data: z.array(z.unknown()), meta: paginationMetaSchema }),
  );

const VALIDATION_ERROR = jsonBody('Request validation failed', errorEnvelopeSchema);
const NOT_FOUND = jsonBody('Absent or not publicly visible', errorEnvelopeSchema);
const RATE_LIMITED = jsonBody('Too many requests', errorEnvelopeSchema);

interface RouteDef {
  method: 'get' | 'post';
  path: string;
  tag: string;
  summary: string;
  // zod-to-openapi's own RouteParameter/body types are narrower than the
  // general `ZodTypeAny` (they require a `ZodObject`, which every schema
  // used below actually is — a `.strict()` object, possibly with
  // field-level `.transform()`s, is still a `ZodObject` at the top level).
  query?: z.ZodObject;
  params?: z.ZodObject;
  body?: z.ZodObject;
  paginated?: boolean;
  successStatus?: '200' | '201' | '204';
  successDescription?: string;
  requiresAuth?: boolean;
}

const PUBLIC_ROUTES: RouteDef[] = [
  {
    method: 'get',
    path: '/api/v1/profile',
    tag: 'Profile',
    summary: 'Singleton profile + avatar + social links + public settings',
  },
  {
    method: 'get',
    path: '/api/v1/stats',
    tag: 'Stats',
    summary: 'Homepage counters, computed live',
  },
  {
    method: 'get',
    path: '/api/v1/home',
    tag: 'Home',
    summary: 'One aggregate call feeding every homepage section',
  },
  {
    method: 'get',
    path: '/api/v1/projects',
    tag: 'Projects',
    summary: 'List published projects',
    query: projectListQuerySchema,
    paginated: true,
  },
  {
    method: 'get',
    path: '/api/v1/projects/{slug}',
    tag: 'Projects',
    summary: 'Full project case study',
    params: slugParamSchema,
  },
  {
    method: 'get',
    path: '/api/v1/projects/{slug}/related',
    tag: 'Projects',
    summary: 'Same category / shared technologies, max 3',
    params: slugParamSchema,
  },
  {
    method: 'get',
    path: '/api/v1/technologies',
    tag: 'Technologies',
    summary: 'List technologies',
    query: technologyListQuerySchema,
  },
  {
    method: 'get',
    path: '/api/v1/skills',
    tag: 'Skills',
    summary: 'Visible skill categories with their skills',
  },
  {
    method: 'get',
    path: '/api/v1/articles',
    tag: 'Articles',
    summary: 'List published articles',
    query: articleListQuerySchema,
    paginated: true,
  },
  {
    method: 'get',
    path: '/api/v1/articles/{slug}',
    tag: 'Articles',
    summary: 'Article detail + related articles',
    params: slugParamSchema,
  },
  {
    method: 'get',
    path: '/api/v1/articles/categories',
    tag: 'Articles',
    summary: 'All article categories',
  },
  { method: 'get', path: '/api/v1/tags', tag: 'Tags', summary: 'Used tags with counts' },
  {
    method: 'get',
    path: '/api/v1/security',
    tag: 'Security Research',
    summary: 'List published security research',
    query: securityResearchListQuerySchema,
    paginated: true,
  },
  {
    method: 'get',
    path: '/api/v1/security/{slug}',
    tag: 'Security Research',
    summary: 'Security research detail + references',
    params: slugParamSchema,
  },
  {
    method: 'get',
    path: '/api/v1/certifications',
    tag: 'Certifications',
    summary: 'Visible certifications',
  },
  {
    method: 'get',
    path: '/api/v1/experience',
    tag: 'Experience',
    summary: 'Visible work experience',
  },
  {
    method: 'get',
    path: '/api/v1/education',
    tag: 'Education',
    summary: 'Visible education history',
  },
  { method: 'get', path: '/api/v1/timeline', tag: 'Timeline', summary: 'Visible timeline entries' },
  {
    method: 'get',
    path: '/api/v1/social-links',
    tag: 'Social Links',
    summary: 'Enabled social links',
  },
  {
    method: 'get',
    path: '/api/v1/search',
    tag: 'Search',
    summary: 'FTS5 search across projects/articles/research/technologies',
    query: searchQuerySchema,
  },
  {
    method: 'get',
    path: '/api/v1/sitemap-data',
    tag: 'Sitemap',
    summary: 'Slugs + updatedAt for every published entity',
  },
  {
    method: 'post',
    path: '/api/v1/contact',
    tag: 'Contact',
    summary: 'Submit the contact form (rate-limited, honeypot, timing check)',
    body: contactSchema,
    successStatus: '201',
  },
  {
    method: 'post',
    path: '/api/v1/analytics/view',
    tag: 'Analytics',
    summary: 'Fire-and-forget page-view beacon',
    body: analyticsViewSchema,
    successStatus: '204',
    successDescription: 'Recorded — no body',
  },
];

const AUTH_ROUTES: RouteDef[] = [
  {
    method: 'get',
    path: '/api/v1/auth/csrf',
    tag: 'Auth',
    summary: 'Issue a signed double-submit CSRF token',
  },
  {
    method: 'post',
    path: '/api/v1/auth/login',
    tag: 'Auth',
    summary: 'Log in (rate-limited 5/15min per IP and per email)',
    body: loginSchema,
  },
  {
    method: 'post',
    path: '/api/v1/auth/refresh',
    tag: 'Auth',
    summary: 'Rotate the refresh token; reuse detection revokes the family',
  },
  {
    method: 'post',
    path: '/api/v1/auth/logout',
    tag: 'Auth',
    summary: 'Revoke the current session',
  },
  {
    method: 'post',
    path: '/api/v1/auth/logout-all',
    tag: 'Auth',
    summary: 'Revoke every session for the user',
    requiresAuth: true,
  },
  {
    method: 'get',
    path: '/api/v1/auth/me',
    tag: 'Auth',
    summary: 'The current authenticated user',
    requiresAuth: true,
  },
  {
    method: 'post',
    path: '/api/v1/auth/change-password',
    tag: 'Auth',
    summary: 'Change password; revokes every other session',
    body: changePasswordSchema,
    requiresAuth: true,
  },
];

for (const route of [...PUBLIC_ROUTES, ...AUTH_ROUTES]) {
  const successStatus = route.successStatus ?? '200';
  registry.registerPath({
    method: route.method,
    path: route.path,
    tags: [route.tag],
    summary: route.summary,
    security: route.requiresAuth ? [{ cookieAuth: [] }] : [],
    request: {
      ...(route.params ? { params: route.params } : {}),
      ...(route.query ? { query: route.query } : {}),
      ...(route.body ? { body: { content: { 'application/json': { schema: route.body } } } } : {}),
    },
    responses: {
      [successStatus]: route.paginated
        ? paginatedResponse()
        : successResponse(route.successDescription),
      ...(route.params ? { '404': NOT_FOUND } : {}),
      ...(route.query || route.body ? { '400': VALIDATION_ERROR } : {}),
      ...(route.tag === 'Contact' ||
      route.tag === 'Analytics' ||
      route.tag === 'Search' ||
      route.tag === 'Auth'
        ? { '429': RATE_LIMITED }
        : {}),
    },
  });
}

registry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: '__Secure-at',
  description: 'HttpOnly JWT access-token cookie set by POST /auth/login or POST /auth/refresh.',
});

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Eslam Ramzy — Portfolio API',
      version: '1.0.0',
      description:
        'Public and authentication endpoints (docs/architecture/03). Admin content-management ' +
        'routes (docs/architecture/03 §5) arrive in Phase 8 and will be added to this registry then.',
    },
    servers: [{ url: '/', description: 'API root — every path below already includes /api/v1' }],
  });
}
