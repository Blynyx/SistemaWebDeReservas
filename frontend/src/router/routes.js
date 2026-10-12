export const ROLE_HOME = {
  ADMIN: '#/dashboard',
  RECEPTIONIST: '#/dashboard',
  PROFESSIONAL: '#/agenda',
  CLIENT: '#/mis-citas',
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
  '/agenda': ['PROFESSIONAL'],
  '/mis-citas': ['CLIENT'],
};

export function getRoleHome(role) {
  return ROLE_HOME[role] ?? '#/login';
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] ?? role;
}
