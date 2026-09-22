import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.middleware.js';
import {
  listMyNotificationsController,
  updateMyNotificationReadStateController,
} from './notification.controller.js';

const router = Router();
const recipientRoles = authorizeRoles('CLIENT', 'PROFESSIONAL');

router.get('/', authMiddleware, recipientRoles, listMyNotificationsController);
router.patch('/:id', authMiddleware, recipientRoles, updateMyNotificationReadStateController);

export default router;
