import { getRoleLabel } from '../router/routes.js';

const HOME_COPY = {
  ADMIN: {
    title: 'Panel administrativo',
    description: 'Gestiona la operación diaria de la organización.',
  },
  RECEPTIONIST: {
    title: 'Panel de recepción',
    description: 'Consulta el estado operativo de las citas y clientes.',
  },
  PROFESSIONAL: {
    title: 'Mi agenda',
    description: 'Revisa tu jornada y el estado de tus citas.',
  },
  CLIENT: {
    title: 'Mis citas',
    description: 'Consulta tus reservas activas y su estado.',
  },
};

export function renderHomeView(root, { user, organization }) {
  root.replaceChildren();

  const copy = HOME_COPY[user.role] ?? HOME_COPY.CLIENT;
  const article = document.createElement('article');
  article.className = 'home-panel';

  const title = document.createElement('h1');
  title.textContent = copy.title;

  const description = document.createElement('p');
  description.className = 'home-panel__lead';
  description.textContent = copy.description;

  const status = document.createElement('p');
  status.className = 'home-panel__status';
  status.textContent = 'Sesión activa.';

  const details = document.createElement('dl');
  details.className = 'home-panel__details';
  appendDetail(details, 'Usuario', user.email);
  appendDetail(details, 'Organización', organization.name);
  appendDetail(details, 'Rol', getRoleLabel(user.role));

  article.append(title, description, status, details);
  root.append(article);
}

function appendDetail(list, label, value) {
  const term = document.createElement('dt');
  term.textContent = label;
  const definition = document.createElement('dd');
  definition.textContent = value;
  list.append(term, definition);
}
