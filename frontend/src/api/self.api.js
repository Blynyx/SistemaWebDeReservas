import { apiRequest } from './apiClient.js';

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
