import { createHeader } from './header.js';
import { createSidebar, updateSidebarActive } from './sidebar.js';

export function createAppShell({ organization, user, onLogout, currentPath = '' }) {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  shell.append(createHeader({ organization, user, onLogout }));

  const body = document.createElement('div');
  body.className = 'app-shell__body';
  const sidebar = createSidebar(user.role, currentPath);

  const main = document.createElement('main');
  main.className = 'app-main';
  main.id = 'app-main';

  body.append(sidebar, main);
  shell.append(body);

  return {
    shell,
    main,
    setActivePath(path) {
      updateSidebarActive(sidebar, path);
    },
  };
}
