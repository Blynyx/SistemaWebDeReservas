import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.middleware.js';
import {
  createClientController,
  deleteClientController,
  getClientController,
  listClientsController,
  patchClientController,
} from './client.controller.js';

const router = Router();
const staffRoles = authorizeRoles('ADMIN', 'RECEPTIONIST');

router.post('/', authMiddleware, staffRoles, createClientController);
router.get('/', authMiddleware, staffRoles, listClientsController);
router.get('/:id', authMiddleware, staffRoles, getClientController);
router.patch('/:id', authMiddleware, staffRoles, patchClientController);
router.delete('/:id', authMiddleware, staffRoles, deleteClientController);

export default router;
