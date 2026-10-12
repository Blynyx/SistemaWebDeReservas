import { getToken } from '../auth/session.js';

const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

function getBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  return typeof configured === 'string' && configured.trim() !== ''
    ? configured.trim().replace(/\/$/, '')
    : DEFAULT_API_BASE_URL;
}

function readSafeMessage(payload) {
  if (payload && typeof payload.message === 'string' && payload.message.trim() !== '') {
    return payload.message.trim();
  }

  return 'No se pudo completar la solicitud';
}

export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, auth = true, skipAuthHandler = false } = options;
  const headers = {};
  const token = getToken();

  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    if (response.status === 401 && auth && !skipAuthHandler) {
      onUnauthorized?.();
    }

    throw new ApiError(response.status, readSafeMessage(payload));
  }

  return payload;
}
