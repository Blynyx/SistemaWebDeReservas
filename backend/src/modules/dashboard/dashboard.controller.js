import { getDashboard } from './dashboard.service.js';

export async function getDashboardController(req, res, next) {
  try {
    const result = await getDashboard(req.user.organizationId, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
