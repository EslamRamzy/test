import {
  idParamSchema,
  messageAdminListQuerySchema,
  messageStatusUpdateSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { messageController } from '../../controllers/admin/messageController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/** doc03 §5's exact three endpoints — no create (messages only ever arrive via the public contact form) and no free-form update (status is the only mutable field). */
export const messagesRouter: Router = Router();

messagesRouter.use(authenticate, adminLimiter);

messagesRouter.get(
  '/',
  authorize('message:read'),
  validate({ query: messageAdminListQuerySchema }),
  messageController.list,
);

messagesRouter.patch(
  '/:id/status',
  csrfProtection,
  authorize('message:update'),
  validate({ params: idParamSchema, body: messageStatusUpdateSchema }),
  messageController.updateStatus,
);

messagesRouter.delete(
  '/:id',
  csrfProtection,
  authorize('message:delete'),
  validate({ params: idParamSchema }),
  messageController.remove,
);
