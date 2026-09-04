import {
  idParamSchema,
  projectAdminListQuerySchema,
  projectCreateSchema,
  projectFeaturedInputSchema,
  projectImageCreateSchema,
  projectImageParamSchema,
  projectSectionsUpdateSchema,
  projectTechnologiesInputSchema,
  projectUpdateSchema,
  reorderSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { projectController } from '../../controllers/admin/projectController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/**
 * `/api/v1/admin/projects` — the largest admin router (doc07 §3's tabbed
 * editor: Overview · Case Study · Technologies · Media · Security · SEO).
 * Standard CRUD+reorder (Project HAS `displayOrder`, unlike Article/
 * SecurityResearch), the four publish-workflow actions under
 * `project:publish`, then doc03 §5's "Project-specific" group.
 *
 * `PATCH /reorder` before `PATCH /:id`, same routing hazard every other
 * admin route file's own comment warns about. The nested image routes
 * (`/:id/images/reorder` before `/:id/images/:imageId`) need the identical
 * care for the identical reason.
 */
export const projectsRouter: Router = Router();

projectsRouter.use(authenticate, adminLimiter);

projectsRouter.get(
  '/',
  authorize('project:read'),
  validate({ query: projectAdminListQuerySchema }),
  projectController.list,
);

projectsRouter.post(
  '/',
  csrfProtection,
  authorize('project:create'),
  validate({ body: projectCreateSchema }),
  projectController.create,
);

projectsRouter.patch(
  '/reorder',
  csrfProtection,
  authorize('project:reorder'),
  validate({ body: reorderSchema }),
  projectController.reorder,
);

projectsRouter.get(
  '/:id',
  authorize('project:read'),
  validate({ params: idParamSchema }),
  projectController.read,
);

projectsRouter.patch(
  '/:id',
  csrfProtection,
  authorize('project:update'),
  validate({ params: idParamSchema, body: projectUpdateSchema }),
  projectController.update,
);

projectsRouter.delete(
  '/:id',
  csrfProtection,
  authorize('project:delete'),
  validate({ params: idParamSchema }),
  projectController.remove,
);

projectsRouter.post(
  '/:id/publish',
  csrfProtection,
  authorize('project:publish'),
  validate({ params: idParamSchema }),
  projectController.publish,
);

projectsRouter.post(
  '/:id/unpublish',
  csrfProtection,
  authorize('project:publish'),
  validate({ params: idParamSchema }),
  projectController.unpublish,
);

projectsRouter.post(
  '/:id/archive',
  csrfProtection,
  authorize('project:publish'),
  validate({ params: idParamSchema }),
  projectController.archive,
);

projectsRouter.post(
  '/:id/duplicate',
  csrfProtection,
  authorize('project:publish'),
  validate({ params: idParamSchema }),
  projectController.duplicate,
);

projectsRouter.put(
  '/:id/technologies',
  csrfProtection,
  authorize('project:update'),
  validate({ params: idParamSchema, body: projectTechnologiesInputSchema }),
  projectController.setTechnologies,
);

projectsRouter.post(
  '/:id/images',
  csrfProtection,
  authorize('project:update'),
  validate({ params: idParamSchema, body: projectImageCreateSchema }),
  projectController.addImage,
);

projectsRouter.patch(
  '/:id/images/reorder',
  csrfProtection,
  authorize('project:update'),
  validate({ params: idParamSchema, body: reorderSchema }),
  projectController.reorderImages,
);

projectsRouter.delete(
  '/:id/images/:imageId',
  csrfProtection,
  authorize('project:update'),
  validate({ params: projectImageParamSchema }),
  projectController.removeImage,
);

projectsRouter.patch(
  '/:id/sections',
  csrfProtection,
  authorize('project:update'),
  validate({ params: idParamSchema, body: projectSectionsUpdateSchema }),
  projectController.updateSections,
);

projectsRouter.post(
  '/:id/featured',
  csrfProtection,
  authorize('project:update'),
  validate({ params: idParamSchema, body: projectFeaturedInputSchema }),
  projectController.setFeatured,
);
