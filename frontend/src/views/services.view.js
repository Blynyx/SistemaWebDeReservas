import { createService, deactivateService, listServices, updateService } from '../api/services.api.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';

const SERVICE_NOT_FOUND = 'El servicio ya no está disponible.';

export function renderServicesView(root) {
  root.replaceChildren();

  let requestId = 0;
  let loading = false;

  const page = document.createElement('section');
  page.className = 'staff-page';

  const heading = document.createElement('h1');
  heading.textContent = 'Servicios';

  const lead = document.createElement('p');
  lead.className = 'staff-page__lead';
  lead.textContent = 'Gestiona los servicios ofrecidos por la organización.';

  const costNote = document.createElement('p');
  costNote.className = 'services-cost-note';
  costNote.textContent =
    'Valor almacenado en unidades menores; la moneda aún no está configurada.';

  const toolbar = document.createElement('div');
  toolbar.className = 'services-toolbar';

  const newButton = document.createElement('button');
  newButton.type = 'button';
  newButton.className = 'button button--primary';
  newButton.textContent = 'Nuevo servicio';
  toolbar.append(newButton);

  const feedback = document.createElement('p');
  feedback.className = 'panel-feedback';
  feedback.setAttribute('aria-live', 'polite');

  const errorBox = document.createElement('p');
  errorBox.className = 'panel-error';
  errorBox.setAttribute('role', 'alert');

  const results = document.createElement('div');
  results.className = 'services-results';

  const dialog = createServiceDialog();

  page.append(heading, lead, costNote, toolbar, feedback, errorBox, results, dialog.element);
  root.append(page);

  function setFeedback(message) {
    feedback.textContent = message;
  }

  function setError(message) {
    errorBox.textContent = message;
  }

  function serviceErrorMessage(error, fallback) {
    return getSafeErrorMessage(error, fallback, { notFoundMessage: SERVICE_NOT_FOUND });
  }

  async function loadServices({ keepFeedback = false } = {}) {
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
    status.textContent = 'Cargando servicios...';
    results.append(status);

    try {
      const payload = await listServices();

      if (currentRequest !== requestId || !page.isConnected) {
        return;
      }

      renderServiceTable(results, payload.services ?? [], {
        onEdit(service) {
          dialog.open(service);
        },
        onDeactivate(service, row) {
          deactivate(service, row);
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
      message.textContent = 'No se pudieron cargar los servicios.';

      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'button button--primary';
      retry.textContent = 'Reintentar';
      retry.addEventListener('click', () => {
        loadServices();
      });

      results.append(message, retry);
      setError(serviceErrorMessage(error, 'No se pudieron cargar los servicios.'));
    } finally {
      if (currentRequest === requestId) {
        loading = false;
        newButton.disabled = false;
      }
    }
  }

  async function deactivate(service, row) {
    const confirmed = window.confirm(
      '¿Deseas desactivar este servicio?\n\nEl servicio dejará de estar disponible para nuevas reservas.'
    );

    if (!confirmed) {
      return;
    }

    setRowBusy(row, true);
    setError('');

    try {
      await deactivateService(service.id);

      if (!page.isConnected) {
        return;
      }

      setFeedback('Servicio desactivado correctamente.');
      await loadServices({ keepFeedback: true });
    } catch (error) {
      if (!page.isConnected) {
        return;
      }

      setError(serviceErrorMessage(error, 'No se pudo desactivar el servicio.'));
      setRowBusy(row, false);
    }
  }

  newButton.addEventListener('click', () => {
    dialog.open(null);
  });

  dialog.onSubmit(async (mode, service, data) => {
    try {
      if (mode === 'create') {
        await createService(data);
        dialog.close();
        setFeedback('Servicio creado correctamente.');
      } else {
        await updateService(service.id, data);
        dialog.close();
        setFeedback('Servicio actualizado correctamente.');
      }

      await loadServices({ keepFeedback: true });
    } catch (error) {
      dialog.setError(serviceErrorMessage(error, 'No se pudo guardar el servicio.'));
    }
  });

  loadServices();
}

function isServiceActive(service) {
  return service.isActive === 1 || service.isActive === true;
}

function displayDescription(value) {
  if (value == null || String(value).trim() === '') {
    return 'Sin descripción';
  }

  return value;
}

function renderServiceTable(container, services, { onEdit, onDeactivate }) {
  container.replaceChildren();

  if (services.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'panel-status';
    empty.textContent = 'No hay servicios registrados.';
    container.append(empty);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';

  const table = document.createElement('table');
  table.className = 'data-table';

  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['Nombre', 'Descripción', 'Duración', 'Costo', 'Estado', 'Acciones']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    headRow.append(th);
  }
  head.append(headRow);

  const body = document.createElement('tbody');

  for (const service of services) {
    const row = document.createElement('tr');
    const active = isServiceActive(service);

    appendTextCell(row, service.name);
    appendTextCell(row, displayDescription(service.description));
    appendTextCell(row, `${service.durationMinutes} min`);
    appendTextCell(row, `${service.priceMinorUnits} unidades menores`);

    const statusCell = document.createElement('td');
    statusCell.append(createServiceStatusBadge(active));
    row.append(statusCell);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'data-table__actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'button button--small';
    editButton.textContent = 'Editar';
    editButton.addEventListener('click', () => onEdit(service));
    actionsCell.append(editButton);

    if (active) {
      const deactivateButton = document.createElement('button');
      deactivateButton.type = 'button';
      deactivateButton.className = 'button button--small button--danger';
      deactivateButton.textContent = 'Desactivar';
      deactivateButton.addEventListener('click', () => onDeactivate(service, row));
      actionsCell.append(deactivateButton);
    }

    row.append(actionsCell);
    body.append(row);
  }

  table.append(head, body);
  wrap.append(table);
  container.append(wrap);
}

function createServiceStatusBadge(active) {
  const badge = document.createElement('span');
  badge.className = active
    ? 'status-badge service-status-badge service-status-badge--active'
    : 'status-badge service-status-badge service-status-badge--inactive';
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

function createField({ id, label, type, required = false, min, step }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const labelEl = document.createElement('label');
  labelEl.setAttribute('for', id);
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.id = id;
  input.name = id;
  input.type = type;
  input.required = required;

  if (min !== undefined) {
    input.min = String(min);
  }

  if (step !== undefined) {
    input.step = String(step);
  }

  wrapper.append(labelEl, input);
  return { wrapper, input };
}

function parseIntegerInput(rawValue) {
  const trimmed = String(rawValue).trim();

  if (trimmed === '') {
    return { empty: true, value: null };
  }

  const value = Number(trimmed);
  return { empty: false, value, isInteger: Number.isInteger(value) };
}

function createServiceDialog() {
  const element = document.createElement('dialog');
  element.className = 'service-dialog';

  const title = document.createElement('h2');
  title.id = 'service-dialog-title';
  title.textContent = 'Nuevo servicio';
  element.setAttribute('aria-labelledby', 'service-dialog-title');

  const form = document.createElement('form');
  form.className = 'service-dialog__form';
  form.method = 'dialog';
  form.noValidate = true;

  const nameField = createField({
    id: 'service-name',
    label: 'Nombre',
    type: 'text',
    required: true,
  });

  const descriptionWrapper = document.createElement('div');
  descriptionWrapper.className = 'form-field';

  const descriptionLabel = document.createElement('label');
  descriptionLabel.setAttribute('for', 'service-description');
  descriptionLabel.textContent = 'Descripción';

  const descriptionInput = document.createElement('textarea');
  descriptionInput.id = 'service-description';
  descriptionInput.name = 'service-description';
  descriptionWrapper.append(descriptionLabel, descriptionInput);

  const durationField = createField({
    id: 'service-duration',
    label: 'Duración en minutos',
    type: 'number',
    required: true,
    min: 1,
    step: 1,
  });

  const priceField = createField({
    id: 'service-price',
    label: 'Costo (unidades menores)',
    type: 'number',
    required: true,
    min: 0,
    step: 1,
  });

  const error = document.createElement('p');
  error.className = 'panel-error';
  error.setAttribute('role', 'alert');

  const actions = document.createElement('div');
  actions.className = 'service-dialog__actions';

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
  form.append(
    nameField.wrapper,
    descriptionWrapper,
    durationField.wrapper,
    priceField.wrapper,
    error,
    actions
  );
  element.append(title, form);

  let currentService = null;
  let submitHandler = null;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = nameField.input.value.trim();
    const description = descriptionInput.value.trim();
    const duration = parseIntegerInput(durationField.input.value);
    const price = parseIntegerInput(priceField.input.value);

    if (!name) {
      error.textContent = 'El nombre es obligatorio.';
      nameField.input.focus();
      return;
    }

    if (duration.empty || !duration.isInteger || duration.value <= 0) {
      error.textContent = 'La duración debe ser un entero mayor que 0.';
      durationField.input.focus();
      return;
    }

    if (price.empty || !price.isInteger || price.value < 0) {
      error.textContent = 'El costo debe ser un entero mayor o igual que 0.';
      priceField.input.focus();
      return;
    }

    const data = {
      name,
      description: description === '' ? null : description,
      durationMinutes: duration.value,
      priceMinorUnits: price.value,
    };

    save.disabled = true;
    error.textContent = '';

    try {
      await submitHandler?.(currentService ? 'edit' : 'create', currentService, data);
    } finally {
      save.disabled = false;
    }
  });

  return {
    element,
    open(service) {
      currentService = service;
      error.textContent = '';
      title.textContent = service ? 'Editar servicio' : 'Nuevo servicio';
      nameField.input.value = service?.name ?? '';
      descriptionInput.value = service?.description ?? '';
      durationField.input.value = service?.durationMinutes ?? '';
      priceField.input.value = service?.priceMinorUnits ?? '';
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
