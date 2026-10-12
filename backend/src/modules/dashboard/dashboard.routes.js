import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.middleware.js';
import { getDashboardController } from './dashboard.controller.js';

const router = Router();

router.get('/', authMiddleware, authorizeRoles('ADMIN', 'RECEPTIONIST'), getDashboardController);

export default router;
