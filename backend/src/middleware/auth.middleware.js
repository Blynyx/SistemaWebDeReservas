import { httpError } from '../utils/httpError.js';
import { verifyAuthToken } from '../utils/jwt.js';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    next(httpError(401, 'No autenticado'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  if (!token) {
    next(httpError(401, 'No autenticado'));
    return;
  }

  try {
    const payload = verifyAuthToken(token);

    req.user = {
      id: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role,
    };

    next();
  } catch {
    next(httpError(401, 'No autenticado'));
  }
}
