import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.middleware.js';
import {
  createReceptionistController,
  listReceptionistsController,
  updateReceptionistStatusController,
} from './receptionist.controller.js';

const router = Router();
const adminOnly = authorizeRoles('ADMIN');

router.get('/', authMiddleware, adminOnly, listReceptionistsController);
router.post('/', authMiddleware, adminOnly, createReceptionistController);
router.patch('/:id/status', authMiddleware, adminOnly, updateReceptionistStatusController);

export default router;
