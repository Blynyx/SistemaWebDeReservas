import { getSession } from '../auth/session.js';
import { getRoleHome, PROTECTED_ROUTES } from './routes.js';

let renderRoute = null;

function currentPath() {
  const hash = window.location.hash || '#/login';
  return hash.startsWith('#') ? hash.slice(1) : hash;
}

export function navigate(hash) {
  if (window.location.hash === hash) {
    renderRoute?.(resolveRoute());
    return;
  }

  window.location.hash = hash;
}

export function resolveRoute() {
  const path = currentPath() || '/login';
  const session = getSession();

  if (!session) {
    return { path: '/login', redirect: path === '/login' ? null : '#/login' };
  }

  if (path === '/login') {
    return { path, redirect: getRoleHome(session.user.role) };
  }

  const allowedRoles = PROTECTED_ROUTES[path];

  if (!allowedRoles) {
    return { path, redirect: null, notFound: true };
  }

  if (!allowedRoles.includes(session.user.role)) {
    return { path, redirect: getRoleHome(session.user.role) };
  }

  return { path, redirect: null };
}

export function startRouter(onChange) {
  renderRoute = onChange;

  window.addEventListener('hashchange', () => {
    onChange(resolveRoute());
  });

  onChange(resolveRoute());
}
