import { getDashboard } from './dashboard.service.js';

export function getDashboardController(req, res, next) {
  try {
    const result = getDashboard(req.user.organizationId, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
