import {
  createClient,
  deactivateClient,
  listClients,
  provisionClientAccount,
  updateClient,
} from '../api/clients.api.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLIENT_NOT_FOUND = 'El cliente ya no está disponible.';

export function renderClientsView(root) {
  root.replaceChildren();

  let requestId = 0;
  let loading = false;

  const page = document.createElement('section');
  page.className = 'staff-page';

  const heading = document.createElement('h1');
  heading.textContent = 'Clientes';

  const lead = document.createElement('p');
  lead.className = 'staff-page__lead';
  lead.textContent = 'Gestiona los clientes de la organización y sus cuentas de acceso.';

  const toolbar = document.createElement('div');
  toolbar.className = 'clients-toolbar';

  const newButton = document.createElement('button');
  newButton.type = 'button';
  newButton.className = 'button button--primary';
  newButton.textContent = 'Nuevo cliente';
  toolbar.append(newButton);

  const feedback = document.createElement('p');
  feedback.className = 'panel-feedback';
  feedback.setAttribute('aria-live', 'polite');

  const errorBox = document.createElement('p');
  errorBox.className = 'panel-error';
  errorBox.setAttribute('role', 'alert');

  const results = document.createElement('div');
  results.className = 'clients-results';

  const clientDialog = createClientDialog();
  const accountDialog = createAccountDialog();

  page.append(
    heading,
    lead,
    toolbar,
    feedback,
    errorBox,
    results,
    clientDialog.element,
    accountDialog.element
  );
  root.append(page);

  function setFeedback(message) {
    feedback.textContent = message;
  }

  function setError(message) {
    errorBox.textContent = message;
  }

  function clientErrorMessage(error, fallback) {
    return getSafeErrorMessage(error, fallback, { notFoundMessage: CLIENT_NOT_FOUND });
  }

  async function loadClients({ keepFeedback = false } = {}) {
    if (loading) {
      return;
    }

    const currentRequest = ++requestId;
    loading = true;
    newButton.disabled = true;
    setError('');

    if (!keepFeedback) {
      setFeedback('');
    }

    results.replaceChildren();
    const status = document.createElement('p');
    status.className = 'panel-status';
    status.textContent = 'Cargando clientes...';
    results.append(status);

    try {
      const payload = await listClients();

      if (currentRequest !== requestId || !page.isConnected) {
        return;
      }

      renderClientTable(results, payload.clients ?? [], {
        onEdit(client) {
          clientDialog.open(client);
        },
        onProvision(client) {
          accountDialog.open(client);
        },
        onDeactivate(client, row) {
          deactivate(client, row);
        },
      });
    } catch (error) {
      if (currentRequest !== requestId || !page.isConnected) {
        return;
      }

      results.replaceChildren();
      const message = document.createElement('p');
      message.className = 'panel-error';
      message.setAttribute('role', 'alert');
      message.textContent = 'No se pudieron cargar los clientes.';

      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'button button--primary';
      retry.textContent = 'Reintentar';
      retry.addEventListener('click', () => {
        loadClients();
      });

      results.append(message, retry);
      setError(clientErrorMessage(error, 'No se pudieron cargar los clientes.'));
    } finally {
      if (currentRequest === requestId) {
        loading = false;
        newButton.disabled = false;
      }
    }
  }

  async function deactivate(client, row) {
    const confirmed = window.confirm(
      '¿Deseas desactivar este cliente?\n\nSi tiene una cuenta de acceso vinculada, también se desactivará.'
    );

    if (!confirmed) {
      return;
    }

    setRowBusy(row, true);
    setError('');

    try {
      await deactivateClient(client.id);

      if (!page.isConnected) {
        return;
      }

      setFeedback('Cliente desactivado correctamente.');
      await loadClients({ keepFeedback: true });
    } catch (error) {
      if (!page.isConnected) {
        return;
      }

      setError(clientErrorMessage(error, 'No se pudo desactivar el cliente.'));
      setRowBusy(row, false);
    }
  }

  newButton.addEventListener('click', () => {
    clientDialog.open(null);
  });

  clientDialog.onSubmit(async (mode, client, data) => {
    try {
      if (mode === 'create') {
        await createClient(data);
        clientDialog.close();
        setFeedback('Cliente creado correctamente.');
      } else {
        await updateClient(client.id, data);
        clientDialog.close();
        setFeedback('Cliente actualizado correctamente.');
      }

      await loadClients({ keepFeedback: true });
    } catch (error) {
      clientDialog.setError(clientErrorMessage(error, 'No se pudo guardar el cliente.'));
    }
  });

  accountDialog.onSubmit(async (client, credentials) => {
    try {
      await provisionClientAccount(client.id, credentials);
      accountDialog.clearPassword();
      accountDialog.close();
      setFeedback('Cuenta de acceso creada correctamente.');
      await loadClients({ keepFeedback: true });
    } catch (error) {
      accountDialog.clearPassword();
      accountDialog.setError(clientErrorMessage(error, 'No se pudo crear la cuenta de acceso.'));
    }
  });

  loadClients();
}

function isClientActive(client) {
  return client.isActive === 1 || client.isActive === true;
}

function hasLinkedAccount(client) {
  return client.userAccountId != null && client.userAccountId !== '';
}

function displayContact(value, emptyLabel) {
  if (value == null || String(value).trim() === '') {
    return emptyLabel;
  }

  return value;
}

function renderClientTable(container, clients, { onEdit, onProvision, onDeactivate }) {
  container.replaceChildren();

  if (clients.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'panel-status';
    empty.textContent = 'No hay clientes registrados.';
    container.append(empty);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';

  const table = document.createElement('table');
  table.className = 'data-table';

  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['Nombre', 'Correo de contacto', 'Teléfono', 'Estado', 'Cuenta de acceso', 'Acciones']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    headRow.append(th);
  }
  head.append(headRow);

  const body = document.createElement('tbody');

  for (const client of clients) {
    const row = document.createElement('tr');
    const active = isClientActive(client);
    const linked = hasLinkedAccount(client);

    appendTextCell(row, client.name);
    appendTextCell(row, displayContact(client.email, 'Sin correo'));
    appendTextCell(row, displayContact(client.phone, 'Sin teléfono'));

    const statusCell = document.createElement('td');
    statusCell.append(createClientStatusBadge(active));
    row.append(statusCell);

    appendTextCell(row, linked ? 'Cuenta vinculada' : 'Sin cuenta');

    const actionsCell = document.createElement('td');
    actionsCell.className = 'data-table__actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'button button--small';
    editButton.textContent = 'Editar';
    editButton.addEventListener('click', () => onEdit(client));
    actionsCell.append(editButton);

    if (active && !linked) {
      const provisionButton = document.createElement('button');
      provisionButton.type = 'button';
      provisionButton.className = 'button button--small';
      provisionButton.textContent = 'Crear cuenta';
      provisionButton.addEventListener('click', () => onProvision(client));
      actionsCell.append(provisionButton);
    }

    if (active) {
      const deactivateButton = document.createElement('button');
      deactivateButton.type = 'button';
      deactivateButton.className = 'button button--small button--danger';
      deactivateButton.textContent = 'Desactivar';
      deactivateButton.addEventListener('click', () => onDeactivate(client, row));
      actionsCell.append(deactivateButton);
    }

    row.append(actionsCell);
    body.append(row);
  }

  table.append(head, body);
  wrap.append(table);
  container.append(wrap);
}

function createClientStatusBadge(active) {
  const badge = document.createElement('span');
  badge.className = active
    ? 'status-badge client-status-badge client-status-badge--active'
    : 'status-badge client-status-badge client-status-badge--inactive';
  badge.textContent = active ? 'Activo' : 'Inactivo';
  return badge;
}

function appendTextCell(row, text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  row.append(cell);
}

function setRowBusy(row, isBusy) {
  for (const button of row.querySelectorAll('button')) {
    button.disabled = isBusy;
  }
}

function createField({ id, label, type, autocomplete, required = false, minLength }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const labelEl = document.createElement('label');
  labelEl.setAttribute('for', id);
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.id = id;
  input.name = id;
  input.type = type;
  input.autocomplete = autocomplete;
  input.required = required;

  if (minLength) {
    input.minLength = minLength;
  }

  wrapper.append(labelEl, input);
  return { wrapper, input };
}

function createClientDialog() {
  const element = document.createElement('dialog');
  element.className = 'client-dialog';

  const title = document.createElement('h2');
  title.id = 'client-dialog-title';
  title.textContent = 'Nuevo cliente';
  element.setAttribute('aria-labelledby', 'client-dialog-title');

  const form = document.createElement('form');
  form.className = 'client-dialog__form';
  form.method = 'dialog';
  form.noValidate = true;

  const nameField = createField({
    id: 'client-name',
    label: 'Nombre',
    type: 'text',
    autocomplete: 'name',
    required: true,
  });
  const emailField = createField({
    id: 'client-contact-email',
    label: 'Correo de contacto',
    type: 'email',
    autocomplete: 'email',
  });
  const phoneField = createField({
    id: 'client-phone',
    label: 'Teléfono',
    type: 'tel',
    autocomplete: 'tel',
  });

  const error = document.createElement('p');
  error.className = 'panel-error';
  error.setAttribute('role', 'alert');

  const actions = document.createElement('div');
  actions.className = 'client-dialog__actions';

  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'button button--primary';
  save.textContent = 'Guardar';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'button button--ghost';
  cancel.textContent = 'Cancelar';
  cancel.addEventListener('click', () => element.close());

  actions.append(save, cancel);
  form.append(nameField.wrapper, emailField.wrapper, phoneField.wrapper, error, actions);
  element.append(title, form);

  let currentClient = null;
  let submitHandler = null;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = nameField.input.value.trim();
    const email = emailField.input.value.trim();
    const phone = phoneField.input.value.trim();

    if (!name) {
      error.textContent = 'El nombre es obligatorio.';
      nameField.input.focus();
      return;
    }

    if (email && !EMAIL_PATTERN.test(email)) {
      error.textContent = 'El correo de contacto no es válido.';
      emailField.input.focus();
      return;
    }

    const data = { name, email, phone };
    save.disabled = true;

    try {
      await submitHandler?.(currentClient ? 'edit' : 'create', currentClient, data);
    } finally {
      save.disabled = false;
    }
  });

  return {
    element,
    open(client) {
      currentClient = client;
      error.textContent = '';
      title.textContent = client ? 'Editar cliente' : 'Nuevo cliente';
      nameField.input.value = client?.name ?? '';
      emailField.input.value = client?.email ?? '';
      phoneField.input.value = client?.phone ?? '';
      element.showModal();
      nameField.input.focus();
    },
    close() {
      element.close();
    },
    setError(message) {
      error.textContent = message;
    },
    onSubmit(handler) {
      submitHandler = handler;
    },
  };
}

function createAccountDialog() {
  const element = document.createElement('dialog');
  element.className = 'client-dialog';

  const title = document.createElement('h2');
  title.id = 'client-account-title';
  title.textContent = 'Crear cuenta de acceso';
  element.setAttribute('aria-labelledby', 'client-account-title');

  const clientName = document.createElement('p');
  clientName.className = 'client-dialog__lead';

  const hint = document.createElement('p');
  hint.className = 'client-dialog__hint';
  hint.textContent =
    'El correo de inicio de sesión es independiente del correo de contacto del cliente.';

  const form = document.createElement('form');
  form.className = 'client-dialog__form';
  form.method = 'dialog';
  form.noValidate = true;

  const emailField = createField({
    id: 'client-login-email',
    label: 'Correo para iniciar sesión',
    type: 'email',
    autocomplete: 'username',
    required: true,
  });
  const passwordField = createField({
    id: 'client-login-password',
    label: 'Contraseña',
    type: 'password',
    autocomplete: 'new-password',
    required: true,
    minLength: 8,
  });

  const error = document.createElement('p');
  error.className = 'panel-error';
  error.setAttribute('role', 'alert');

  const actions = document.createElement('div');
  actions.className = 'client-dialog__actions';

  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'button button--primary';
  save.textContent = 'Crear cuenta';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'button button--ghost';
  cancel.textContent = 'Cancelar';
  cancel.addEventListener('click', () => {
    passwordField.input.value = '';
    element.close();
  });

  actions.append(save, cancel);
  form.append(emailField.wrapper, passwordField.wrapper, error, actions);
  element.append(title, clientName, hint, form);

  let currentClient = null;
  let submitHandler = null;

  element.addEventListener('close', () => {
    passwordField.input.value = '';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!currentClient) {
      return;
    }

    const email = emailField.input.value.trim();
    const password = passwordField.input.value;

    if (!email || !EMAIL_PATTERN.test(email)) {
      error.textContent = 'El correo para iniciar sesión no es válido.';
      emailField.input.focus();
      return;
    }

    if (!password || password.length < 8) {
      error.textContent = 'La contraseña debe tener al menos 8 caracteres.';
      passwordField.input.focus();
      return;
    }

    save.disabled = true;
    error.textContent = '';

    try {
      await submitHandler?.(currentClient, { email, password });
    } finally {
      save.disabled = false;
    }
  });

  return {
    element,
    open(client) {
      currentClient = client;
      error.textContent = '';
      emailField.input.value = '';
      passwordField.input.value = '';
      clientName.textContent = client.name;
      element.showModal();
      emailField.input.focus();
    },
    close() {
      passwordField.input.value = '';
      element.close();
    },
    clearPassword() {
      passwordField.input.value = '';
    },
    setError(message) {
      error.textContent = message;
    },
    onSubmit(handler) {
      submitHandler = handler;
    },
  };
}
