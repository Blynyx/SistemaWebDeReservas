import { getAvailability } from './availability.service.js';

export function getAvailabilityController(req, res, next) {
  try {
    const result = getAvailability(req.user.organizationId, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
