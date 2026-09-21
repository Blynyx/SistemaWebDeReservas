import { onboardOrganization } from './onboarding.service.js';

export async function createOrganization(req, res, next) {
  try {
    const result = await onboardOrganization(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
