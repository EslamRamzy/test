import {
  idParamSchema,
  securityAssessmentTestsUpsertSchema,
  securityAssessmentUpdateSchema,
  securityFindingCreateSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { assessmentController } from '../../controllers/admin/assessmentController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/**
 * `/api/v1/admin/assessments` (doc03 §5). `GET|POST
 * /admin/projects/:id/assessments` (list/create) is mounted on
 * `projects.routes.ts` instead — that URL is nested under `projects`, not
 * this router. Every route here addresses an assessment (or its nested
 * tests/findings) directly by its OWN id.
 *
 * All gated under `security:*` — `PERMISSIONS` (rbac.ts) defines no
 * separate `assessment`/`finding` resource key; doc07 §51 has no
 * standalone sidebar module for either either (they live inside a
 * project's own "Security" tab), so this shares Security Research's
 * closest-fit resource the same way tags/skill-categories reuse theirs
 * elsewhere in Phase 8.
 */
export const assessmentsRouter: Router = Router();

assessmentsRouter.use(authenticate, adminLimiter);

assessmentsRouter.get(
  '/:id',
  authorize('security:read'),
  validate({ params: idParamSchema }),
  assessmentController.read,
);

assessmentsRouter.patch(
  '/:id',
  csrfProtection,
  authorize('security:update'),
  validate({ params: idParamSchema, body: securityAssessmentUpdateSchema }),
  assessmentController.update,
);

assessmentsRouter.delete(
  '/:id',
  csrfProtection,
  authorize('security:delete'),
  validate({ params: idParamSchema }),
  assessmentController.remove,
);

assessmentsRouter.put(
  '/:id/tests',
  csrfProtection,
  authorize('security:update'),
  validate({ params: idParamSchema, body: securityAssessmentTestsUpsertSchema }),
  assessmentController.upsertTests,
);

assessmentsRouter.get(
  '/:id/findings',
  authorize('security:read'),
  validate({ params: idParamSchema }),
  assessmentController.listFindings,
);

assessmentsRouter.post(
  '/:id/findings',
  csrfProtection,
  authorize('security:create'),
  validate({ params: idParamSchema, body: securityFindingCreateSchema }),
  assessmentController.createFinding,
);
