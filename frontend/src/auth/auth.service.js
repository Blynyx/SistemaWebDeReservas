import { ApiError } from '../api/apiClient.js';
import { getMe, login as loginRequest } from '../api/auth.api.js';
import { clearSession, getToken, saveSession } from './session.js';

export async function login({ organizationSlug, email, password }) {
  const result = await loginRequest({ organizationSlug, email, password });

  saveSession({
    token: result.token,
    user: result.user,
    organization: result.organization,
  });

  return {
    user: result.user,
    organization: result.organization,
  };
}

export async function restoreSession() {
  if (!getToken()) {
    return { session: null, expired: false };
  }

  try {
    const current = await getMe();
    saveSession({
      token: getToken(),
      user: current.user,
      organization: current.organization,
    });

    return { session: current, expired: false };
  } catch (error) {
    clearSession();

    if (error instanceof ApiError && error.status === 401) {
      return { session: null, expired: true };
    }

    throw error;
  }
}

export function logout() {
  clearSession();
}
