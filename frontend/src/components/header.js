import { getRoleLabel } from '../router/routes.js';

export function createHeader({ organization, user, onLogout }) {
  const header = document.createElement('header');
  header.className = 'app-header';

  const brand = document.createElement('div');
  brand.className = 'app-header__brand';

  const title = document.createElement('p');
  title.className = 'app-header__system';
  title.textContent = 'Sistema Web de Reservas';

  const orgName = document.createElement('p');
  orgName.className = 'app-header__org';
  orgName.textContent = organization.name;

  brand.append(title, orgName);

  const account = document.createElement('div');
  account.className = 'app-header__account';

  const email = document.createElement('p');
  email.className = 'app-header__email';
  email.textContent = user.email;

  const role = document.createElement('p');
  role.className = 'role-badge';
  role.textContent = getRoleLabel(user.role);

  const logoutButton = document.createElement('button');
  logoutButton.type = 'button';
  logoutButton.className = 'button button--ghost';
  logoutButton.textContent = 'Cerrar sesión';
  logoutButton.addEventListener('click', onLogout);

  account.append(email, role, logoutButton);
  header.append(brand, account);
  return header;
}
