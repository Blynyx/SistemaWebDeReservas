import { apiRequest } from './apiClient.js';

export function getAvailability({ serviceId, date, professionalId } = {}) {
  const params = new URLSearchParams();

  if (serviceId) {
    params.set('serviceId', serviceId);
  }

  if (date) {
    params.set('date', date);
  }

  if (professionalId) {
    params.set('professionalId', professionalId);
  }

  const query = params.toString();
  return apiRequest(query ? `/availability?${query}` : '/availability');
}
