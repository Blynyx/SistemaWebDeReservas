import { apiRequest } from './apiClient.js';

export function getDashboard(date) {
  const params = new URLSearchParams();

  if (date) {
    params.set('date', date);
  }

  const query = params.toString();
  return apiRequest(query ? `/dashboard?${query}` : '/dashboard');
}
