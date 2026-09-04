import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { noStore } from './middleware/noStore.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { permissionsPolicy } from './middleware/securityHeaders.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { articleCategoriesRouter } from './routes/admin/articleCategories.routes.js';
import { articlesRouter as adminArticlesRouter } from './routes/admin/articles.routes.js';
import { certificationsRouter } from './routes/admin/certifications.routes.js';
import { educationRouter } from './routes/admin/education.routes.js';
import { experienceRouter } from './routes/admin/experience.routes.js';
import { overviewRouter } from './routes/admin/overview.routes.js';
import { projectsRouter as adminProjectsRouter } from './routes/admin/projects.routes.js';
import { securityResearchRouter } from './routes/admin/securityResearch.routes.js';
import { skillCategoriesRouter } from './routes/admin/skillCategories.routes.js';
import { skillsRouter } from './routes/admin/skills.routes.js';
import { socialLinksRouter } from './routes/admin/socialLinks.routes.js';
import { tagsRouter } from './routes/admin/tags.routes.js';
import { technologiesRouter } from './routes/admin/technologies.routes.js';
import { timelineRouter } from './routes/admin/timeline.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { docsRouter } from './routes/docs.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { analyticsRouter } from './routes/public/analytics.routes.js';
import { articlesRouter } from './routes/public/articles.routes.js';
import { contactRouter } from './routes/public/contact.routes.js';
import { contentRouter } from './routes/public/content.routes.js';
import { homeRouter } from './routes/public/home.routes.js';
import { profileRouter } from './routes/public/profile.routes.js';
import { projectsRouter } from './routes/public/projects.routes.js';
import { searchRouter } from './routes/public/search.routes.js';
import { securityRouter } from './routes/public/security.routes.js';
import { sitemapRouter } from './routes/public/sitemap.routes.js';
import { statsRouter } from './routes/public/stats.routes.js';

/**
 * Builds the Express application without binding a port, so integration tests
 * can drive it through supertest with no sockets involved (docs/architecture/10 §2).
 *
 * Middleware order matters and follows docs/architecture/03 §6:
 *
 *   requestId → requestLogger (pino-http) → helmet → permissionsPolicy →
 *   cors → express.json(limit) → cookieParser → routes → notFoundHandler →
 *   errorHandler
 *
 * `cookieParser` is mounted globally (not per-route) because both auth
 * cookie readers (lib/cookies.ts) and every route's `authenticate`
 * middleware depend on `req.cookies` already being populated — Phase 4
 * introduced the first routes that need it. `validate`, `csrfProtection`,
 * `authenticate` and `authorize` remain per-route, mounted by the routers
 * that need them, not globally here — see routes/auth.routes.ts.
 */
export function createApp(): Express {
  const app = express();

  // Behind exactly one reverse proxy (Caddy). Never `true`: that would trust a
  // client-supplied X-Forwarded-For and let anyone evade every rate limit.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(requestLogger);

  app.use(
    helmet({
      // frameguard defaults to SAMEORIGIN; the API is never framed, so DENY.
      frameguard: { action: 'deny' },
      // doc09 §2 wants 2 years + preload; helmet's own default is 1 year
      // with no preload flag.
      strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // CSP is deliberately left at helmet's built-in default here, not
      // disabled and not the final policy either: doc09 §2's real,
      // nonce-based CSP is a Phase 11 rollout (report-only first, then
      // enforced) — helmet's default self-only policy is a reasonable
      // interim baseline, not a placeholder to remove without replacing.
    }),
  );
  app.use(permissionsPolicy);

  // Exact-match allow-list. `origin: true` would reflect any origin, which
  // combined with credentials is equivalent to disabling the same-origin policy.
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      maxAge: 600,
    }),
  );

  // Body limit is applied before parsing, not after.
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api/v1', healthRouter);
  app.use('/api/v1/auth', authRouter);

  // Public API (docs/architecture/03 §3, Phase 5). `contentRouter` defines
  // its own sub-paths (/technologies, /skills, /certifications, /experience,
  // /education, /timeline, /social-links, /tags) and mounts at the bare
  // `/api/v1` prefix for that reason — see routes/public/content.routes.ts.
  app.use('/api/v1', contentRouter);
  app.use('/api/v1/profile', profileRouter);
  app.use('/api/v1/stats', statsRouter);
  app.use('/api/v1/home', homeRouter);
  app.use('/api/v1/projects', projectsRouter);
  app.use('/api/v1/articles', articlesRouter);
  app.use('/api/v1/security', securityRouter);
  app.use('/api/v1/search', searchRouter);
  app.use('/api/v1/sitemap-data', sitemapRouter);
  app.use('/api/v1/contact', contactRouter);
  app.use('/api/v1/analytics', analyticsRouter);
  app.use('/api/v1/docs', docsRouter);

  // Admin API (Phase 7+). `noStore` mounted once at the prefix — see that
  // middleware's own comment for why every admin route needs it and a
  // prefix mount is safer than remembering it per-route.
  app.use('/api/v1/admin', noStore);
  app.use('/api/v1/admin/overview', overviewRouter);
  app.use('/api/v1/admin/technologies', technologiesRouter);
  app.use('/api/v1/admin/skill-categories', skillCategoriesRouter);
  app.use('/api/v1/admin/skills', skillsRouter);
  app.use('/api/v1/admin/certifications', certificationsRouter);
  app.use('/api/v1/admin/experience', experienceRouter);
  app.use('/api/v1/admin/education', educationRouter);
  app.use('/api/v1/admin/timeline', timelineRouter);
  app.use('/api/v1/admin/social-links', socialLinksRouter);
  app.use('/api/v1/admin/tags', tagsRouter);
  app.use('/api/v1/admin/article-categories', articleCategoriesRouter);
  app.use('/api/v1/admin/articles', adminArticlesRouter);
  app.use('/api/v1/admin/security-research', securityResearchRouter);
  app.use('/api/v1/admin/projects', adminProjectsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
