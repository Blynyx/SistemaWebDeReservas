import { apiRequest } from './apiClient.js';

export function getAppointments(filters = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return apiRequest(query ? `/appointments?${query}` : '/appointments');
}

export function confirmAppointment(id) {
  return apiRequest(`/appointments/${id}/confirm`, { method: 'PATCH' });
}

export function cancelAppointment(id) {
  return apiRequest(`/appointments/${id}/cancel`, { method: 'PATCH' });
}

export function rescheduleAppointment(id, startAt) {
  return apiRequest(`/appointments/${id}/reschedule`, {
    method: 'PATCH',
    body: { startAt },
  });
}

export function completeAppointment(id) {
  return apiRequest(`/appointments/${id}/complete`, { method: 'PATCH' });
}

export function markNoShowAppointment(id) {
  return apiRequest(`/appointments/${id}/no-show`, { method: 'PATCH' });
}
