import { getCurrentSession, login } from './auth.service.js';

export async function loginController(req, res, next) {
  try {
    const result = await login(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function meController(req, res, next) {
  try {
    const result = getCurrentSession(req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
