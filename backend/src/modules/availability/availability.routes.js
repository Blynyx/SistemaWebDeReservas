import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.middleware.js';
import { getAvailabilityController } from './availability.controller.js';

const router = Router();

router.get(
  '/',
  authMiddleware,
  authorizeRoles('ADMIN', 'RECEPTIONIST', 'CLIENT'),
  getAvailabilityController
);

export default router;
