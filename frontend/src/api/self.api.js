import { apiRequest } from './apiClient.js';

export function getMyProfessional() {
  return apiRequest('/me/professional');
}

export function getMyProfessionalAppointments(filters = {}) {
  const params = new URLSearchParams();

  // El backend self PROFESSIONAL solo soporta el rango from/to.
  if (filters.from && filters.to) {
    params.set('from', filters.from);
    params.set('to', filters.to);
  }

  const query = params.toString();
  return apiRequest(
    query ? `/me/professional/appointments?${query}` : '/me/professional/appointments'
  );
}

export function completeMyProfessionalAppointment(id) {
  return apiRequest(`/me/professional/appointments/${encodeURIComponent(id)}/complete`, {
    method: 'PATCH',
  });
}

export function markMyProfessionalAppointmentNoShow(id) {
  return apiRequest(`/me/professional/appointments/${encodeURIComponent(id)}/no-show`, {
    method: 'PATCH',
  });
}

export function getMyAvailabilityBlocks() {
  return apiRequest('/me/professional/availability-blocks');
}

export function createMyAvailabilityBlock({ startAt, endAt, reason }) {
  return apiRequest('/me/professional/availability-blocks', {
    method: 'POST',
    body: { startAt, endAt, reason: reason ?? null },
  });
}

export function updateMyAvailabilityBlock(id, { startAt, endAt, reason }) {
  return apiRequest(`/me/professional/availability-blocks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { startAt, endAt, reason: reason ?? null },
  });
}

export function deleteMyAvailabilityBlock(id) {
  return apiRequest(`/me/professional/availability-blocks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function getMyClient() {
  return apiRequest('/me/client');
}

export function getMyClientAppointments(filters = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return apiRequest(
    query ? `/me/client/appointments?${query}` : '/me/client/appointments'
  );
}

export function createMyAppointment({ professionalId, serviceId, startAt }) {
  return apiRequest('/me/client/appointments', {
    method: 'POST',
    body: {
      professionalId,
      serviceId,
      startAt,
    },
  });
}

export function cancelMyAppointment(id) {
  return apiRequest(`/me/client/appointments/${encodeURIComponent(id)}/cancel`, {
    method: 'PATCH',
  });
}

export function rescheduleMyAppointment(id, startAt) {
  return apiRequest(`/me/client/appointments/${encodeURIComponent(id)}/reschedule`, {
    method: 'PATCH',
    body: { startAt },
  });
}
