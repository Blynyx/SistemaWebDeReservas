const NAV_BY_ROLE = {
  ADMIN: [
    { href: '#/dashboard', label: 'Dashboard' },
    { href: '#/citas', label: 'Citas' },
    { href: '#/clientes', label: 'Clientes' },
    { label: 'Profesionales' },
    { label: 'Servicios' },
  ],
  RECEPTIONIST: [
    { href: '#/dashboard', label: 'Dashboard' },
    { href: '#/citas', label: 'Citas' },
    { href: '#/clientes', label: 'Clientes' },
  ],
  PROFESSIONAL: [
    { href: '#/agenda', label: 'Mi agenda' },
    { label: 'Mis bloqueos' },
    { label: 'Notificaciones' },
  ],
  CLIENT: [
    { href: '#/mis-citas', label: 'Mis citas' },
    { label: 'Reservar' },
    { label: 'Notificaciones' },
  ],
};

export function createSidebar(role, currentPath = '') {
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
  updateSidebarActive(nav, currentPath);
  return nav;
}

export function updateSidebarActive(nav, currentPath) {
  for (const link of nav.querySelectorAll('a.app-sidebar__link')) {
    const path = link.getAttribute('href')?.startsWith('#')
      ? link.getAttribute('href').slice(1)
      : link.getAttribute('href');

    if (path === currentPath) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
}
