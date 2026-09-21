import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.middleware.js';
import {
  createServiceController,
  deleteServiceController,
  getServiceController,
  listServicesController,
  patchServiceController,
} from './service.controller.js';

const router = Router();

router.post('/', authMiddleware, authorizeRoles('ADMIN'), createServiceController);
router.get(
  '/',
  authMiddleware,
  authorizeRoles('ADMIN', 'RECEPTIONIST', 'PROFESSIONAL'),
  listServicesController
);
router.get(
  '/:id',
  authMiddleware,
  authorizeRoles('ADMIN', 'RECEPTIONIST', 'PROFESSIONAL'),
  getServiceController
);
router.patch('/:id', authMiddleware, authorizeRoles('ADMIN'), patchServiceController);
router.delete('/:id', authMiddleware, authorizeRoles('ADMIN'), deleteServiceController);

export default router;
