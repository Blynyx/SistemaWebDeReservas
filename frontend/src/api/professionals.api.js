import { apiRequest } from './apiClient.js';

export function listProfessionals() {
  return apiRequest('/professionals');
}
