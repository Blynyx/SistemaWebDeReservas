import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.middleware.js';
import {
  createAppointmentController,
  getAppointmentController,
  listAppointmentsController,
} from './appointment.controller.js';

const router = Router();
const staffRoles = authorizeRoles('ADMIN', 'RECEPTIONIST');

router.post('/', authMiddleware, staffRoles, createAppointmentController);
router.get('/', authMiddleware, staffRoles, listAppointmentsController);
router.get('/:id', authMiddleware, staffRoles, getAppointmentController);

export default router;
