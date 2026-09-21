import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.middleware.js';
import professionalServiceRoutes from '../professionalServices/professionalService.routes.js';
import {
  createProfessionalController,
  deleteProfessionalController,
  getProfessionalController,
  listProfessionalsController,
  patchProfessionalController,
} from './professional.controller.js';

const router = Router();

router.use(professionalServiceRoutes);

router.post('/', authMiddleware, authorizeRoles('ADMIN'), createProfessionalController);
router.get(
  '/',
  authMiddleware,
  authorizeRoles('ADMIN', 'RECEPTIONIST'),
  listProfessionalsController
);
router.get(
  '/:id',
  authMiddleware,
  authorizeRoles('ADMIN', 'RECEPTIONIST'),
  getProfessionalController
);
router.patch('/:id', authMiddleware, authorizeRoles('ADMIN'), patchProfessionalController);
router.delete('/:id', authMiddleware, authorizeRoles('ADMIN'), deleteProfessionalController);

export default router;
