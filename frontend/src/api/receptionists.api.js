import { apiRequest } from './apiClient.js';

export function listReceptionists() {
  return apiRequest('/receptionists');
}

export function createReceptionist({ email, password }) {
  return apiRequest('/receptionists', {
    method: 'POST',
    body: {
      email,
      password,
    },
  });
}

export function setReceptionistActiveState(id, isActive) {
  return apiRequest(`/receptionists/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { isActive: Boolean(isActive) },
  });
}
