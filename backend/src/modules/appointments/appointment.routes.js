import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.middleware.js';
import {
  cancelAppointmentController,
  completeAppointmentController,
  confirmAppointmentController,
  createAppointmentController,
  getAppointmentController,
  listAppointmentsController,
  markNoShowAppointmentController,
  rescheduleAppointmentController,
} from './appointment.controller.js';

const router = Router();
const staffRoles = authorizeRoles('ADMIN', 'RECEPTIONIST');

router.post('/', authMiddleware, staffRoles, createAppointmentController);
router.get('/', authMiddleware, staffRoles, listAppointmentsController);
router.patch('/:id/confirm', authMiddleware, staffRoles, confirmAppointmentController);
router.patch('/:id/cancel', authMiddleware, staffRoles, cancelAppointmentController);
router.patch('/:id/reschedule', authMiddleware, staffRoles, rescheduleAppointmentController);
router.patch('/:id/complete', authMiddleware, staffRoles, completeAppointmentController);
router.patch('/:id/no-show', authMiddleware, staffRoles, markNoShowAppointmentController);
router.get('/:id', authMiddleware, staffRoles, getAppointmentController);

export default router;
