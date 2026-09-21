import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.middleware.js';
import {
  assignServiceController,
  listAssignedServicesController,
  unassignServiceController,
} from './professionalService.controller.js';

const router = Router();

router.post(
  '/:professionalId/services',
  authMiddleware,
  authorizeRoles('ADMIN'),
  assignServiceController
);
router.get(
  '/:professionalId/services',
  authMiddleware,
  authorizeRoles('ADMIN', 'RECEPTIONIST'),
  listAssignedServicesController
);
router.delete(
  '/:professionalId/services/:serviceId',
  authMiddleware,
  authorizeRoles('ADMIN'),
  unassignServiceController
);

export default router;
