import { getRoleHome } from '../router/routes.js';

export function renderNotFoundView(root, session) {
  root.replaceChildren();

  const article = document.createElement('article');
  article.className = 'home-panel';

  const title = document.createElement('h1');
  title.textContent = 'Página no encontrada';

  const text = document.createElement('p');
  text.textContent = 'La ruta solicitada no existe en esta etapa.';

  const link = document.createElement('a');
  link.className = 'button button--primary';
  link.href = getRoleHome(session.user.role);
  link.textContent = 'Volver al inicio';

  article.append(title, text, link);
  root.append(article);
}
