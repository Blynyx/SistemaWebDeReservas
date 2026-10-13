import { apiRequest } from './apiClient.js';

export function listServices() {
  return apiRequest('/services');
}

export function createService(data) {
  return apiRequest('/services', {
    method: 'POST',
    body: data,
  });
}

export function updateService(id, data) {
  return apiRequest(`/services/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: data,
  });
}

export function deactivateService(id) {
  return apiRequest(`/services/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
