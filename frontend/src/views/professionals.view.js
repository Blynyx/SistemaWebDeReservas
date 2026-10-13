import {
  createProfessional,
  deactivateProfessional,
  listProfessionals,
  provisionProfessionalAccount,
  updateProfessional,
} from '../api/professionals.api.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { createConfigurationDialog } from './professionalConfiguration.panel.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROFESSIONAL_NOT_FOUND = 'El profesional ya no está disponible.';

export function renderProfessionalsView(root) {
  root.replaceChildren();

  let requestId = 0;
  let loading = false;

  const page = document.createElement('section');
  page.className = 'staff-page';

  const heading = document.createElement('h1');
  heading.textContent = 'Profesionales';

  const lead = document.createElement('p');
  lead.className = 'staff-page__lead';
  lead.textContent = 'Gestiona los profesionales de la organización y sus cuentas de acceso.';

  const toolbar = document.createElement('div');
  toolbar.className = 'professionals-toolbar';

  const newButton = document.createElement('button');
  newButton.type = 'button';
  newButton.className = 'button button--primary';
  newButton.textContent = 'Nuevo profesional';
  toolbar.append(newButton);

  const feedback = document.createElement('p');
  feedback.className = 'panel-feedback';
  feedback.setAttribute('aria-live', 'polite');

  const errorBox = document.createElement('p');
  errorBox.className = 'panel-error';
  errorBox.setAttribute('role', 'alert');

  const results = document.createElement('div');
  results.className = 'professionals-results';

  const professionalDialog = createProfessionalDialog();
  const accountDialog = createAccountDialog();
  const configurationDialog = createConfigurationDialog();

  page.append(
    heading,
    lead,
    toolbar,
    feedback,
    errorBox,
    results,
    professionalDialog.element,
    accountDialog.element,
    configurationDialog.element
  );
  root.append(page);

  function setFeedback(message) {
    feedback.textContent = message;
  }

  function setError(message) {
    errorBox.textContent = message;
  }

  function professionalErrorMessage(error, fallback) {
    return getSafeErrorMessage(error, fallback, { notFoundMessage: PROFESSIONAL_NOT_FOUND });
  }

  async function loadProfessionals({ keepFeedback = false } = {}) {
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
    status.textContent = 'Cargando profesionales...';
    results.append(status);

    try {
      const payload = await listProfessionals();

      if (currentRequest !== requestId || !page.isConnected) {
        return;
      }

      renderProfessionalTable(results, payload.professionals ?? [], {
        onEdit(professional) {
          professionalDialog.open(professional);
        },
        onProvision(professional) {
          accountDialog.open(professional);
        },
        onDeactivate(professional, row) {
          deactivate(professional, row);
        },
        onConfigure(professional) {
          configurationDialog.open(professional);
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
      message.textContent = 'No se pudieron cargar los profesionales.';

      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'button button--primary';
      retry.textContent = 'Reintentar';
      retry.addEventListener('click', () => {
        loadProfessionals();
      });

      results.append(message, retry);
      setError(professionalErrorMessage(error, 'No se pudieron cargar los profesionales.'));
    } finally {
      if (currentRequest === requestId) {
        loading = false;
        newButton.disabled = false;
      }
    }
  }

  async function deactivate(professional, row) {
    const confirmed = window.confirm(
      '¿Deseas desactivar este profesional?\n\nSi tiene una cuenta de acceso vinculada, también se desactivará.'
    );

    if (!confirmed) {
      return;
    }

    setRowBusy(row, true);
    setError('');

    try {
      await deactivateProfessional(professional.id);

      if (!page.isConnected) {
        return;
      }

      setFeedback('Profesional desactivado correctamente.');
      await loadProfessionals({ keepFeedback: true });
    } catch (error) {
      if (!page.isConnected) {
        return;
      }

      setError(professionalErrorMessage(error, 'No se pudo desactivar el profesional.'));
      setRowBusy(row, false);
    }
  }

  newButton.addEventListener('click', () => {
    professionalDialog.open(null);
  });

  professionalDialog.onSubmit(async (mode, professional, data) => {
    try {
      if (mode === 'create') {
        await createProfessional(data);
        professionalDialog.close();
        setFeedback('Profesional creado correctamente.');
      } else {
        await updateProfessional(professional.id, data);
        professionalDialog.close();
        setFeedback('Profesional actualizado correctamente.');
      }

      await loadProfessionals({ keepFeedback: true });
    } catch (error) {
      professionalDialog.setError(professionalErrorMessage(error, 'No se pudo guardar el profesional.'));
    }
  });

  accountDialog.onSubmit(async (professional, credentials) => {
    try {
      await provisionProfessionalAccount(professional.id, credentials);
      accountDialog.clearPassword();
      accountDialog.close();
      setFeedback('Cuenta de acceso creada correctamente.');
      await loadProfessionals({ keepFeedback: true });
    } catch (error) {
      accountDialog.clearPassword();
      accountDialog.setError(
        professionalErrorMessage(error, 'No se pudo crear la cuenta de acceso.')
      );
    }
  });

  loadProfessionals();
}

function isProfessionalActive(professional) {
  return professional.isActive === 1 || professional.isActive === true;
}

function hasLinkedAccount(professional) {
  return professional.userAccountId != null && professional.userAccountId !== '';
}

function hasStoredContact(value) {
  return value != null && String(value).trim() !== '';
}

function displayContact(value, emptyLabel) {
  if (!hasStoredContact(value)) {
    return emptyLabel;
  }

  return value;
}

function buildCreatePayload(name, email, phone) {
  const data = { name };

  if (email) {
    data.email = email;
  }

  if (phone) {
    data.phone = phone;
  }

  return data;
}

function buildPatchPayload(professional, name, email, phone) {
  if (hasStoredContact(professional.email) && !email) {
    return {
      error: 'El correo no puede quedar vacío al editar este profesional.',
      focus: 'email',
    };
  }

  if (hasStoredContact(professional.phone) && !phone) {
    return {
      error: 'El teléfono no puede quedar vacío al editar este profesional.',
      focus: 'phone',
    };
  }

  const data = { name };

  if (email) {
    data.email = email;
  }

  if (phone) {
    data.phone = phone;
  }

  return { data };
}

function renderProfessionalTable(container, professionals, { onEdit, onProvision, onDeactivate, onConfigure }) {
  container.replaceChildren();

  if (professionals.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'panel-status';
    empty.textContent = 'No hay profesionales registrados.';
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

  for (const professional of professionals) {
    const row = document.createElement('tr');
    const active = isProfessionalActive(professional);
    const linked = hasLinkedAccount(professional);

    appendTextCell(row, professional.name);
    appendTextCell(row, displayContact(professional.email, 'Sin correo'));
    appendTextCell(row, displayContact(professional.phone, 'Sin teléfono'));

    const statusCell = document.createElement('td');
    statusCell.append(createProfessionalStatusBadge(active));
    row.append(statusCell);

    appendTextCell(row, linked ? 'Cuenta vinculada' : 'Sin cuenta');

    const actionsCell = document.createElement('td');
    actionsCell.className = 'data-table__actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'button button--small';
    editButton.textContent = 'Editar';
    editButton.addEventListener('click', () => onEdit(professional));
    actionsCell.append(editButton);

    if (active && !linked) {
      const provisionButton = document.createElement('button');
      provisionButton.type = 'button';
      provisionButton.className = 'button button--small';
      provisionButton.textContent = 'Crear cuenta';
      provisionButton.addEventListener('click', () => onProvision(professional));
      actionsCell.append(provisionButton);
    }

    if (active) {
      const configureButton = document.createElement('button');
      configureButton.type = 'button';
      configureButton.className = 'button button--small';
      configureButton.textContent = 'Configurar';
      configureButton.addEventListener('click', () => onConfigure(professional));
      actionsCell.append(configureButton);

      const deactivateButton = document.createElement('button');
      deactivateButton.type = 'button';
      deactivateButton.className = 'button button--small button--danger';
      deactivateButton.textContent = 'Desactivar';
      deactivateButton.addEventListener('click', () => onDeactivate(professional, row));
      actionsCell.append(deactivateButton);
    }

    row.append(actionsCell);
    body.append(row);
  }

  table.append(head, body);
  wrap.append(table);
  container.append(wrap);
}

function createProfessionalStatusBadge(active) {
  const badge = document.createElement('span');
  badge.className = active
    ? 'status-badge professional-status-badge professional-status-badge--active'
    : 'status-badge professional-status-badge professional-status-badge--inactive';
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

function createProfessionalDialog() {
  const element = document.createElement('dialog');
  element.className = 'professional-dialog';

  const title = document.createElement('h2');
  title.id = 'professional-dialog-title';
  title.textContent = 'Nuevo profesional';
  element.setAttribute('aria-labelledby', 'professional-dialog-title');

  const form = document.createElement('form');
  form.className = 'professional-dialog__form';
  form.method = 'dialog';
  form.noValidate = true;

  const nameField = createField({
    id: 'professional-name',
    label: 'Nombre',
    type: 'text',
    autocomplete: 'name',
    required: true,
  });
  const emailField = createField({
    id: 'professional-contact-email',
    label: 'Correo de contacto',
    type: 'email',
    autocomplete: 'email',
  });
  const phoneField = createField({
    id: 'professional-phone',
    label: 'Teléfono',
    type: 'tel',
    autocomplete: 'tel',
  });

  const error = document.createElement('p');
  error.className = 'panel-error';
  error.setAttribute('role', 'alert');

  const actions = document.createElement('div');
  actions.className = 'professional-dialog__actions';

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

  let currentProfessional = null;
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

    let data;

    if (currentProfessional) {
      const patch = buildPatchPayload(currentProfessional, name, email, phone);

      if (patch.error) {
        error.textContent = patch.error;
        if (patch.focus === 'email') {
          emailField.input.focus();
        } else {
          phoneField.input.focus();
        }
        return;
      }

      data = patch.data;
    } else {
      data = buildCreatePayload(name, email, phone);
    }

    save.disabled = true;
    error.textContent = '';

    try {
      await submitHandler?.(currentProfessional ? 'edit' : 'create', currentProfessional, data);
    } finally {
      save.disabled = false;
    }
  });

  return {
    element,
    open(professional) {
      currentProfessional = professional;
      error.textContent = '';
      title.textContent = professional ? 'Editar profesional' : 'Nuevo profesional';
      nameField.input.value = professional?.name ?? '';
      emailField.input.value = professional?.email ?? '';
      phoneField.input.value = professional?.phone ?? '';
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
  element.className = 'professional-dialog';

  const title = document.createElement('h2');
  title.id = 'professional-account-title';
  title.textContent = 'Crear cuenta de acceso';
  element.setAttribute('aria-labelledby', 'professional-account-title');

  const professionalName = document.createElement('p');
  professionalName.className = 'professional-dialog__lead';

  const hint = document.createElement('p');
  hint.className = 'professional-dialog__hint';
  hint.textContent =
    'El correo de inicio de sesión es independiente del correo de contacto del profesional.';

  const form = document.createElement('form');
  form.className = 'professional-dialog__form';
  form.method = 'dialog';
  form.noValidate = true;

  const emailField = createField({
    id: 'professional-login-email',
    label: 'Correo para iniciar sesión',
    type: 'email',
    autocomplete: 'username',
    required: true,
  });
  const passwordField = createField({
    id: 'professional-login-password',
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
  actions.className = 'professional-dialog__actions';

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
  element.append(title, professionalName, hint, form);

  let currentProfessional = null;
  let submitHandler = null;

  element.addEventListener('close', () => {
    passwordField.input.value = '';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!currentProfessional) {
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
      await submitHandler?.(currentProfessional, { email, password });
    } finally {
      save.disabled = false;
    }
  });

  return {
    element,
    open(professional) {
      currentProfessional = professional;
      error.textContent = '';
      emailField.input.value = '';
      passwordField.input.value = '';
      professionalName.textContent = professional.name;
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
