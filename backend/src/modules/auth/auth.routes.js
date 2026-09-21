import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { loginController, meController } from './auth.controller.js';

const router = Router();

router.post('/login', loginController);
router.get('/me', authMiddleware, meController);

export default router;
