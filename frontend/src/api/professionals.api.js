import { apiRequest } from './apiClient.js';

export function listProfessionals() {
  return apiRequest('/professionals');
}

export function createProfessional(data) {
  return apiRequest('/professionals', {
    method: 'POST',
    body: data,
  });
}

export function updateProfessional(id, data) {
  return apiRequest(`/professionals/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: data,
  });
}

export function deactivateProfessional(id) {
  return apiRequest(`/professionals/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function provisionProfessionalAccount(id, credentials) {
  return apiRequest(`/professionals/${encodeURIComponent(id)}/account`, {
    method: 'POST',
    body: credentials,
  });
}
