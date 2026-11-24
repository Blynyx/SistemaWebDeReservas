import { apiRequest } from './apiClient.js';

export function getMyNotifications(status = 'all') {
  if (status && status !== 'all') {
    const params = new URLSearchParams({ status });
    return apiRequest(`/me/notifications?${params.toString()}`);
  }
  return apiRequest('/me/notifications');
}

export function setNotificationReadState(id, isRead) {
  return apiRequest(`/me/notifications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { isRead: Boolean(isRead) },
  });
}
