import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/authenticate.js';
import { generateOpenApiDocument } from '../openapi/registry.js';

/**
 * `GET /api/v1/docs` — Swagger UI over the generated OpenAPI document
 * (docs/architecture/03 §8). Disabled by default (`ENABLE_API_DOCS=false`)
 * and behind admin auth when enabled: the full API surface, including
 * every request-validation rule, is reconnaissance information an
 * unauthenticated caller should not get for free.
 *
 * When disabled, NO route is registered here at all — a request to this
 * path falls through to `notFoundHandler` and gets a plain `404`, not a
 * `403`. A `403` would confirm the docs exist but are locked, which is
 * exactly the kind of thing the draft-leakage rule (doc 03 §1) already
 * argues against for content; the same reasoning applies to a feature.
 */
export const docsRouter: Router = Router();

if (env.ENABLE_API_DOCS) {
  const document = generateOpenApiDocument();
  docsRouter.use('/', authenticate, swaggerUi.serve, swaggerUi.setup(document));
}
