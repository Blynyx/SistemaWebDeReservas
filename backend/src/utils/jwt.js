import jwt from 'jsonwebtoken';
import { JWT_EXPIRES_IN, JWT_SECRET } from '../config/env.js';

export function signAuthToken({ userId, organizationId, role }) {
  return jwt.sign(
    {
      sub: userId,
      organizationId,
      role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
