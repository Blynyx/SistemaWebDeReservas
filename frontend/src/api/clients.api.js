import { apiRequest } from './apiClient.js';

export function listClients() {
  return apiRequest('/clients');
}

export function createClient(data) {
  return apiRequest('/clients', {
    method: 'POST',
    body: data,
  });
}

export function updateClient(id, data) {
  return apiRequest(`/clients/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: data,
  });
}

export function deactivateClient(id) {
  return apiRequest(`/clients/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function provisionClientAccount(id, credentials) {
  return apiRequest(`/clients/${encodeURIComponent(id)}/account`, {
    method: 'POST',
    body: credentials,
  });
}
