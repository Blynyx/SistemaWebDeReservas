export const ROLE_HOME = {
  ADMIN: '#/dashboard',
  RECEPTIONIST: '#/dashboard',
  PROFESSIONAL: '#/agenda',
  CLIENT: '#/mis-citas',
};

export const ROLE_HOME_PATH = {
  ADMIN: '/dashboard',
  RECEPTIONIST: '/dashboard',
  PROFESSIONAL: '/agenda',
  CLIENT: '/mis-citas',
};

export const ROLE_LABELS = {
  ADMIN: 'Administrador',
  RECEPTIONIST: 'Recepción',
  PROFESSIONAL: 'Profesional',
  CLIENT: 'Cliente',
};

export const PROTECTED_ROUTES = {
  '/dashboard': ['ADMIN', 'RECEPTIONIST'],
  '/citas': ['ADMIN', 'RECEPTIONIST'],
  '/clientes': ['ADMIN', 'RECEPTIONIST'],
  '/servicios': ['ADMIN'],
  '/profesionales': ['ADMIN'],
  '/agenda': ['PROFESSIONAL'],
  '/mis-citas': ['CLIENT'],
  '/reservar': ['CLIENT'],
  '/notificaciones': ['CLIENT'],
};

export function getRoleHome(role) {
  return ROLE_HOME[role] ?? '#/login';
}

export function getRoleHomePath(role) {
  return ROLE_HOME_PATH[role] ?? '/login';
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] ?? role;
}
