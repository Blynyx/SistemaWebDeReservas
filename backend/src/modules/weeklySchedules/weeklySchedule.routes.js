import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.middleware.js';
import {
  createWeeklyScheduleController,
  deleteWeeklyScheduleController,
  listWeeklySchedulesController,
  patchWeeklyScheduleController,
} from './weeklySchedule.controller.js';

const router = Router();

router.post(
  '/:professionalId/schedules',
  authMiddleware,
  authorizeRoles('ADMIN'),
  createWeeklyScheduleController
);
router.get(
  '/:professionalId/schedules',
  authMiddleware,
  authorizeRoles('ADMIN', 'RECEPTIONIST'),
  listWeeklySchedulesController
);
router.patch(
  '/:professionalId/schedules/:scheduleId',
  authMiddleware,
  authorizeRoles('ADMIN'),
  patchWeeklyScheduleController
);
router.delete(
  '/:professionalId/schedules/:scheduleId',
  authMiddleware,
  authorizeRoles('ADMIN'),
  deleteWeeklyScheduleController
);

export default router;
