import './styles/main.css';
import './styles/auth.css';
import './styles/layout.css';
import { setUnauthorizedHandler } from './api/apiClient.js';
import { login, logout, restoreSession } from './auth/auth.service.js';
import { getSession } from './auth/session.js';
import { createAppShell } from './components/appShell.js';
import { navigate, startRouter } from './router/router.js';
import { getRoleHome } from './router/routes.js';
import { renderAdminHomeView } from './views/adminHome.view.js';
import { renderClientHomeView } from './views/clientHome.view.js';
import { renderLoginView } from './views/login.view.js';
import { renderNotFoundView } from './views/notFound.view.js';
import { renderProfessionalHomeView } from './views/professionalHome.view.js';
import { renderReceptionistHomeView } from './views/receptionistHome.view.js';

const appRoot = document.querySelector('#app');
const HOME_RENDERERS = {
  '/dashboard': renderStaffHome,
  '/agenda': renderProfessionalHomeView,
  '/mis-citas': renderClientHomeView,
};

let loginMessage = '';
let appMain = null;

setUnauthorizedHandler(() => {
  logout();
  destroyShell();
  loginMessage = 'Tu sesión expiró. Inicia sesión nuevamente.';
  navigate('#/login');
});

function destroyShell() {
  appMain = null;
  appRoot.replaceChildren();
}

function showBootState(text) {
  destroyShell();
  const status = document.createElement('p');
  status.className = 'boot-status';
  status.textContent = text;
  appRoot.append(status);
}

function ensureShell(session) {
  if (appMain && appRoot.querySelector('.app-shell')) {
    return appMain;
  }

  const { shell, main } = createAppShell({
    organization: session.organization,
    user: session.user,
    onLogout() {
      logout();
      destroyShell();
      loginMessage = '';
      navigate('#/login');
    },
  });

  appRoot.replaceChildren(shell);
  appMain = main;
  return main;
}

function renderStaffHome(root, session) {
  if (session.user.role === 'RECEPTIONIST') {
    renderReceptionistHomeView(root, session);
    return;
  }

  renderAdminHomeView(root, session);
}

function renderApp(route) {
  if (route.redirect) {
    navigate(route.redirect);
    return;
  }

  const session = getSession();

  if (!session || route.path === '/login') {
    destroyShell();
    renderLoginView(appRoot, {
      message: loginMessage,
      async onSubmit(credentials) {
        await login(credentials);
        loginMessage = '';
        navigate(getRoleHome(getSession().user.role));
      },
    });
    return;
  }

  const main = ensureShell(session);
  const renderHome = HOME_RENDERERS[route.path];

  if (route.notFound || !renderHome) {
    renderNotFoundView(main, session);
    return;
  }

  renderHome(main, session);
}

async function boot() {
  showBootState('Restaurando sesión...');

  try {
    const restored = await restoreSession();

    if (restored.expired) {
      loginMessage = 'Tu sesión expiró. Inicia sesión nuevamente.';
    }
  } catch {
    loginMessage = 'No se pudo restaurar la sesión. Inicia sesión nuevamente.';
  }

  startRouter(renderApp);
}

boot();
