import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import {
  requireClientIdentity,
  requireProfessionalIdentity,
} from '../../middleware/domainIdentity.middleware.js';
import {
  completeMyAppointmentController,
  createMyAvailabilityBlockController,
  deleteMyAvailabilityBlockController,
  getMyClientController,
  getMyProfessionalController,
  listMyAvailabilityBlocksController,
  listMyClientAppointmentsController,
  listMyProfessionalAppointmentsController,
  markMyAppointmentNoShowController,
  patchMyAvailabilityBlockController,
} from './self.controller.js';

const router = Router();

router.get(
  '/professional',
  authMiddleware,
  requireProfessionalIdentity,
  getMyProfessionalController
);
router.get(
  '/professional/appointments',
  authMiddleware,
  requireProfessionalIdentity,
  listMyProfessionalAppointmentsController
);
router.patch(
  '/professional/appointments/:id/complete',
  authMiddleware,
  requireProfessionalIdentity,
  completeMyAppointmentController
);
router.patch(
  '/professional/appointments/:id/no-show',
  authMiddleware,
  requireProfessionalIdentity,
  markMyAppointmentNoShowController
);
router.post(
  '/professional/availability-blocks',
  authMiddleware,
  requireProfessionalIdentity,
  createMyAvailabilityBlockController
);
router.get(
  '/professional/availability-blocks',
  authMiddleware,
  requireProfessionalIdentity,
  listMyAvailabilityBlocksController
);
router.patch(
  '/professional/availability-blocks/:blockId',
  authMiddleware,
  requireProfessionalIdentity,
  patchMyAvailabilityBlockController
);
router.delete(
  '/professional/availability-blocks/:blockId',
  authMiddleware,
  requireProfessionalIdentity,
  deleteMyAvailabilityBlockController
);

router.get('/client', authMiddleware, requireClientIdentity, getMyClientController);
router.get(
  '/client/appointments',
  authMiddleware,
  requireClientIdentity,
  listMyClientAppointmentsController
);

export default router;
