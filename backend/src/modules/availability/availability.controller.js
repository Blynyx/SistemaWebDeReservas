import { getAvailability } from './availability.service.js';

export async function getAvailabilityController(req, res, next) {
  try {
    const result = await getAvailability(req.user.organizationId, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
