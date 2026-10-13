import { ApiError } from '../api/apiClient.js';

export function getSafeErrorMessage(error, fallback, options = {}) {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return options.notFoundMessage || 'La cita ya no está disponible.';
    }

    if (error.status === 403) {
      return 'No tienes permiso para esta acción.';
    }

    return error.message;
  }

  return fallback;
}
