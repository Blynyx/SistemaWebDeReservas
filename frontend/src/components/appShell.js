import { createHeader } from './header.js';
import { createSidebar } from './sidebar.js';

export function createAppShell({ organization, user, onLogout }) {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  shell.append(createHeader({ organization, user, onLogout }));

  const body = document.createElement('div');
  body.className = 'app-shell__body';

  const main = document.createElement('main');
  main.className = 'app-main';
  main.id = 'app-main';

  body.append(createSidebar(user.role), main);
  shell.append(body);

  return { shell, main };
}
