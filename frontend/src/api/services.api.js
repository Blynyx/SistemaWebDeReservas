import { apiRequest } from './apiClient.js';

export function listServices() {
  return apiRequest('/services');
}
