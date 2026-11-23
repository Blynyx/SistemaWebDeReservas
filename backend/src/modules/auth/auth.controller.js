import { getCurrentSession, login } from './auth.service.js';

export async function loginController(req, res, next) {
  try {
    const result = await login(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function meController(req, res, next) {
  try {
    const result = await getCurrentSession(req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
