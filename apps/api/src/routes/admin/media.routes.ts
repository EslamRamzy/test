import {
  idParamSchema,
  mediaAdminListQuerySchema,
  mediaUpdateSchema,
  mediaUploadFieldsSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { mediaController } from '../../controllers/admin/mediaController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { mediaUploadMiddleware } from '../../middleware/mediaUpload.js';
import { adminLimiter, uploadLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

export const mediaRouter: Router = Router();

mediaRouter.use(authenticate, adminLimiter);

mediaRouter.get(
  '/',
  authorize('media:read'),
  validate({ query: mediaAdminListQuerySchema }),
  mediaController.list,
);

// `mediaUploadMiddleware` (multer) runs BEFORE `validate` — it is what
// populates `req.body`'s text fields and `req.file` from the multipart
// request in the first place; `validate` then checks the fields exactly
// like any other body. `csrfProtection`/`authorize`/`uploadLimiter` all run
// first, same as every other admin write route — multer only needs to run
// before the schema that reads what it produced.
mediaRouter.post(
  '/',
  csrfProtection,
  authorize('media:upload'),
  uploadLimiter,
  mediaUploadMiddleware,
  validate({ body: mediaUploadFieldsSchema }),
  mediaController.upload,
);

mediaRouter.get(
  '/:id',
  authorize('media:read'),
  validate({ params: idParamSchema }),
  mediaController.read,
);

// doc03 §5's own documented path (`GET .../:id/usages`) — a dedicated
// endpoint, separate from `read` above (which already embeds the same
// usage list for the frontend's one-request convenience; this exists so
// the documented API surface itself is complete even where the admin UI
// doesn't need a second round trip for it).
mediaRouter.get(
  '/:id/usages',
  authorize('media:read'),
  validate({ params: idParamSchema }),
  mediaController.usage,
);

mediaRouter.patch(
  '/:id',
  csrfProtection,
  authorize('media:update'),
  validate({ params: idParamSchema, body: mediaUpdateSchema }),
  mediaController.update,
);

mediaRouter.delete(
  '/:id',
  csrfProtection,
  authorize('media:delete'),
  validate({ params: idParamSchema }),
  mediaController.remove,
);
