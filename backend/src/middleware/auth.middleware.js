import { resolveActiveIdentity } from '../modules/auth/auth.service.js';
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
    const identity = resolveActiveIdentity({
      id: payload.sub,
      organizationId: payload.organizationId,
    });

    req.user = {
      id: identity.id,
      organizationId: identity.organizationId,
      role: identity.role,
    };

    next();
  } catch (error) {
    if (error.statusCode === 401) {
      next(error);
      return;
    }

    next(httpError(401, 'No autenticado'));
  }
}
