import { Router } from 'express';
import { createOrganization } from './onboarding.controller.js';

const router = Router();

router.post('/organizations', createOrganization);

export default router;
