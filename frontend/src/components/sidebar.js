const NAV_BY_ROLE = {
  ADMIN: [
    { href: '#/dashboard', label: 'Dashboard', active: true },
    { label: 'Citas' },
    { label: 'Clientes' },
    { label: 'Profesionales' },
    { label: 'Servicios' },
  ],
  RECEPTIONIST: [
    { href: '#/dashboard', label: 'Dashboard', active: true },
    { label: 'Citas' },
    { label: 'Clientes' },
  ],
  PROFESSIONAL: [
    { href: '#/agenda', label: 'Mi agenda', active: true },
    { label: 'Mis bloqueos' },
    { label: 'Notificaciones' },
  ],
  CLIENT: [
    { href: '#/mis-citas', label: 'Mis citas', active: true },
    { label: 'Reservar' },
    { label: 'Notificaciones' },
  ],
};

export function createSidebar(role) {
  const nav = document.createElement('nav');
  nav.className = 'app-sidebar';
  nav.setAttribute('aria-label', 'Navegación principal');

  const list = document.createElement('ul');
  list.className = 'app-sidebar__list';

  for (const item of NAV_BY_ROLE[role] ?? []) {
    const entry = document.createElement('li');

    if (item.href) {
      const link = document.createElement('a');
      link.href = item.href;
      link.className = 'app-sidebar__link';
      if (item.active) {
        link.setAttribute('aria-current', 'page');
      }
      link.textContent = item.label;
      entry.append(link);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'app-sidebar__link app-sidebar__link--soon';
      placeholder.textContent = item.label;
      entry.append(placeholder);
    }

    list.append(entry);
  }

  nav.append(list);
  return nav;
}
