import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.middleware.js';
import {
  createAvailabilityBlockController,
  deleteAvailabilityBlockController,
  listAvailabilityBlocksController,
  patchAvailabilityBlockController,
} from './availabilityBlock.controller.js';

const router = Router();

router.post(
  '/:professionalId/availability-blocks',
  authMiddleware,
  authorizeRoles('ADMIN'),
  createAvailabilityBlockController
);
router.get(
  '/:professionalId/availability-blocks',
  authMiddleware,
  authorizeRoles('ADMIN', 'RECEPTIONIST'),
  listAvailabilityBlocksController
);
router.patch(
  '/:professionalId/availability-blocks/:blockId',
  authMiddleware,
  authorizeRoles('ADMIN'),
  patchAvailabilityBlockController
);
router.delete(
  '/:professionalId/availability-blocks/:blockId',
  authMiddleware,
  authorizeRoles('ADMIN'),
  deleteAvailabilityBlockController
);

export default router;
