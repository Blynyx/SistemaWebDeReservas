import { httpError } from './httpError.js';

// Misma política que onboarding/login: trim + lowercase y mínimo 8 caracteres.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseLoginEmail(value) {
  if (typeof value !== 'string') {
    throw httpError(400, 'El correo electrónico no es válido');
  }

  const email = value.trim().toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    throw httpError(400, 'El correo electrónico no es válido');
  }

  return email;
}

export function parseLoginPassword(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw httpError(400, 'La contraseña debe tener al menos 8 caracteres');
  }

  return value;
}
