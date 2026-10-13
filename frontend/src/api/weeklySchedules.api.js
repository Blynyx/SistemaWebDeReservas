import { apiRequest } from './apiClient.js';

export function listWeeklySchedules(professionalId) {
  return apiRequest(`/professionals/${encodeURIComponent(professionalId)}/schedules`);
}

export function createWeeklySchedule(professionalId, data) {
  return apiRequest(`/professionals/${encodeURIComponent(professionalId)}/schedules`, {
    method: 'POST',
    body: data,
  });
}

export function updateWeeklySchedule(professionalId, scheduleId, data) {
  return apiRequest(
    `/professionals/${encodeURIComponent(professionalId)}/schedules/${encodeURIComponent(scheduleId)}`,
    {
      method: 'PATCH',
      body: data,
    }
  );
}

export function deleteWeeklySchedule(professionalId, scheduleId) {
  return apiRequest(
    `/professionals/${encodeURIComponent(professionalId)}/schedules/${encodeURIComponent(scheduleId)}`,
    { method: 'DELETE' }
  );
}
