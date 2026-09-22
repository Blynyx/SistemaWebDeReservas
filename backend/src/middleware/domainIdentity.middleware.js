import { httpError } from '../utils/httpError.js';
import { findByUserAccountId as findProfessionalByUserAccountId } from '../modules/professionals/professional.repository.js';
import { findByUserAccountId as findClientByUserAccountId } from '../modules/clients/client.repository.js';

export function requireProfessionalIdentity(req, res, next) {
  if (!req.user) {
    next(httpError(401, 'No autenticado'));
    return;
  }

  if (req.user.role !== 'PROFESSIONAL') {
    next(httpError(403, 'No tienes permiso para esta operación'));
    return;
  }

  const professional = findProfessionalByUserAccountId(req.user.organizationId, req.user.id);

  if (!professional || professional.is_active !== 1) {
    next(httpError(403, 'No tienes un profesional vinculado'));
    return;
  }

  req.domain = {
    type: 'PROFESSIONAL',
    id: professional.id,
    professional,
  };

  next();
}

export function requireClientIdentity(req, res, next) {
  if (!req.user) {
    next(httpError(401, 'No autenticado'));
    return;
  }

  if (req.user.role !== 'CLIENT') {
    next(httpError(403, 'No tienes permiso para esta operación'));
    return;
  }

  const client = findClientByUserAccountId(req.user.organizationId, req.user.id);

  if (!client || client.is_active !== 1) {
    next(httpError(403, 'No tienes un cliente vinculado'));
    return;
  }

  req.domain = {
    type: 'CLIENT',
    id: client.id,
    client,
  };

  next();
}
