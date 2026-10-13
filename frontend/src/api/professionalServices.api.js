import { apiRequest } from './apiClient.js';

export function listProfessionalServices(professionalId) {
  return apiRequest(`/professionals/${encodeURIComponent(professionalId)}/services`);
}

export function assignProfessionalService(professionalId, serviceId) {
  return apiRequest(`/professionals/${encodeURIComponent(professionalId)}/services`, {
    method: 'POST',
    body: { serviceId },
  });
}

export function unassignProfessionalService(professionalId, serviceId) {
  return apiRequest(
    `/professionals/${encodeURIComponent(professionalId)}/services/${encodeURIComponent(serviceId)}`,
    { method: 'DELETE' }
  );
}
