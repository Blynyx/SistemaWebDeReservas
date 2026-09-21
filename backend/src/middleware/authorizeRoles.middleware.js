import { httpError } from '../utils/httpError.js';

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      next(httpError(401, 'No autenticado'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(httpError(403, 'No tienes permiso para esta operación'));
      return;
    }

    next();
  };
}
