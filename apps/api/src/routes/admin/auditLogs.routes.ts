import { auditLogQuerySchema } from '@portfolio/shared';
import { Router } from 'express';
import { auditLogController } from '../../controllers/admin/auditLogController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/** `/api/v1/admin/audit-logs` (doc03 §5) — "read-only, no writes/deletes anywhere in the UI" (doc07 §3), so this router mounts only a GET. */
export const auditLogsRouter: Router = Router();

auditLogsRouter.use(authenticate, adminLimiter);

auditLogsRouter.get(
  '/',
  authorize('audit:read'),
  validate({ query: auditLogQuerySchema }),
  auditLogController.list,
);
