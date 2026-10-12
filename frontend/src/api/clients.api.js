import { apiRequest } from './apiClient.js';

export function listClients() {
  return apiRequest('/clients');
}
