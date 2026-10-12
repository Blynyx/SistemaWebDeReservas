import { apiRequest } from './apiClient.js';

export function login({ organizationSlug, email, password }) {
  return apiRequest('/auth/login', {
    method: 'POST',
    auth: false,
    body: {
      organizationSlug,
      email,
      password,
    },
  });
}

export function getMe() {
  return apiRequest('/auth/me', {
    skipAuthHandler: true,
  });
}
