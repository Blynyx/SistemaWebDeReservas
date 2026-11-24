import { Link, useLocation } from 'react-router-dom';

const NAV_BY_ROLE = {
  ADMIN: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/citas', label: 'Citas' },
    { to: '/clientes', label: 'Clientes' },
    { to: '/profesionales', label: 'Profesionales' },
    { to: '/servicios', label: 'Servicios' },
    { to: '/recepcionistas', label: 'Recepcionistas' },
  ],
  RECEPTIONIST: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/citas', label: 'Citas' },
    { to: '/clientes', label: 'Clientes' },
  ],
  PROFESSIONAL: [
    { to: '/agenda', label: 'Mi agenda' },
    { to: '/mis-bloqueos', label: 'Mis bloqueos' },
    { to: '/notificaciones', label: 'Notificaciones' },
  ],
  CLIENT: [
    { to: '/mis-citas', label: 'Mis citas' },
    { to: '/reservar', label: 'Reservar' },
    { to: '/notificaciones', label: 'Notificaciones' },
  ],
};

export function Sidebar({ role }) {
  const location = useLocation();
  const items = NAV_BY_ROLE[role] ?? [];

  return (
    <nav className="app-sidebar" aria-label="Navegación principal">
      <ul className="app-sidebar__list">
        {items.map((item) => {
          const isActive = Boolean(item.to && location.pathname === item.to);
          return (
            <li key={item.to ?? item.label}>
              {item.to ? (
                <Link
                  to={item.to}
                  className="app-sidebar__link"
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              ) : (
                <span className="app-sidebar__link app-sidebar__link--soon">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
