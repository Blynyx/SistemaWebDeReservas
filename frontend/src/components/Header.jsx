import { getRoleLabel } from '../router/routes.js';

export function Header({ organization, user, onLogout }) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <p className="app-header__system">Sistema Web de Reservas</p>
        <p className="app-header__org">{organization.name}</p>
      </div>
      <div className="app-header__account">
        <p className="app-header__email">{user.email}</p>
        <p className="role-badge">{getRoleLabel(user.role)}</p>
        <button type="button" className="button button--ghost" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
