import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  getAppointments,
  markNoShowAppointment,
  rescheduleAppointment,
} from '../api/appointments.api.js';
import { listClients } from '../api/clients.api.js';
import { listProfessionals } from '../api/professionals.api.js';
import { listServices } from '../api/services.api.js';
import {
  createStatusBadge,
  getAppointmentActions,
  STATUS_LABELS,
} from '../utils/appointmentStatus.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { formatLocalDate, formatLocalTime, isDateTimeLocal } from '../utils/dateTime.js';
import { createNameLookup, sortByName } from '../utils/references.js';

const ACTION_LABELS = {
  confirm: 'Confirmar',
  reschedule: 'Reprogramar',
  cancel: 'Cancelar cita',
  complete: 'Completar',
  noShow: 'No asistió',
};

const SUCCESS_MESSAGES = {
  confirm: 'Cita confirmada correctamente.',
  cancel: 'Cita cancelada correctamente.',
  reschedule: 'Cita reprogramada correctamente.',
  complete: 'Cita completada correctamente.',
  noShow: 'Cita marcada como no asistió.',
};

export function renderAppointmentsView(root) {
  root.replaceChildren();

  let requestId = 0;
  let loading = false;
  let names = {
    clientName: () => 'Cliente no disponible',
    professionalName: () => 'Profesional no disponible',
    serviceName: () => 'Servicio no disponible',
  };
  let currentFilters = {};

  const page = document.createElement('section');
  page.className = 'staff-page';

  const heading = document.createElement('h1');
  heading.textContent = 'Citas';

  const lead = document.createElement('p');
  lead.className = 'staff-page__lead';
  lead.textContent = 'Consulta y gestiona las citas de la organización.';

  const form = createFilterForm();
  const feedback = document.createElement('p');
  feedback.className = 'panel-feedback';
  feedback.setAttribute('aria-live', 'polite');

  const errorBox = document.createElement('p');
  errorBox.className = 'panel-error';
  errorBox.setAttribute('role', 'alert');

  const results = document.createElement('div');
  results.className = 'appointments-results';

  const dialog = createRescheduleDialog();

  page.append(heading, lead, form.element, feedback, errorBox, results, dialog.element);
  root.append(page);

  function setFeedback(message) {
    feedback.textContent = message;
  }

  function setError(message) {
    errorBox.textContent = message;
  }

  function getFormFilters() {
    return {
      clientId: form.client.value,
      professionalId: form.professional.value,
      serviceId: form.service.value,
      status: form.status.value,
      from: form.from.value,
      to: form.to.value,
    };
  }

  function validateRange(filters) {
    const fromProvided = Boolean(filters.from);
    const toProvided = Boolean(filters.to);

    if (fromProvided !== toProvided) {
      return fromProvided
        ? 'Debes indicar también la fecha Hasta.'
        : 'Debes indicar también la fecha Desde.';
    }

    if (fromProvided && filters.from > filters.to) {
      return 'La fecha Desde no puede ser posterior a Hasta.';
    }

    return null;
  }

  async function loadAppointments(filters, { keepFeedback = false } = {}) {
    if (loading) {
      return;
    }

    const currentRequest = ++requestId;
    loading = true;
    form.setBusy(true);
    setError('');
    if (!keepFeedback) {
      setFeedback('');
    }
    results.replaceChildren();

    const loadingText = document.createElement('p');
    loadingText.className = 'panel-status';
    loadingText.textContent = 'Cargando citas...';
    results.append(loadingText);

    try {
      const payload = await getAppointments(filters);

      if (currentRequest !== requestId || !results.isConnected) {
        return;
      }

      currentFilters = filters;
      renderAppointmentTable(results, payload.appointments, names, {
        onAction: handleAction,
      });
    } catch (error) {
      if (currentRequest !== requestId || !results.isConnected) {
        return;
      }

      results.replaceChildren();
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'button button--primary';
      retry.textContent = 'Reintentar';
      retry.addEventListener('click', () => {
        loadAppointments(currentFilters);
      });
      setError(getSafeErrorMessage(error, 'No se pudieron cargar las citas.'));
      results.append(retry);
    } finally {
      if (currentRequest === requestId) {
        loading = false;
        form.setBusy(false);
      }
    }
  }

  async function handleAction(action, appointment, row) {
    if (row.dataset.busy === 'true') {
      return;
    }

    if (action === 'reschedule') {
      dialog.open(appointment, names);
      return;
    }

    const confirmed = window.confirm(confirmMessage(action));
    if (!confirmed) {
      return;
    }

    await runAction(action, appointment.id, row);
  }

  async function runAction(action, appointmentId, row) {
    if (row) {
      row.dataset.busy = 'true';
      setRowBusy(row, true);
    }

    setError('');

    try {
      if (action === 'confirm') {
        await confirmAppointment(appointmentId);
      } else if (action === 'cancel') {
        await cancelAppointment(appointmentId);
      } else if (action === 'complete') {
        await completeAppointment(appointmentId);
      } else if (action === 'noShow') {
        await markNoShowAppointment(appointmentId);
      }

      setFeedback(SUCCESS_MESSAGES[action]);
      await loadAppointments(currentFilters, { keepFeedback: true });
    } catch (error) {
      setError(getSafeErrorMessage(error, 'No se pudo completar la acción.'));
      if (row) {
        row.dataset.busy = 'false';
        setRowBusy(row, false);
      }
    }
  }

  dialog.onSubmit(async (appointment, startAt) => {
    try {
      await rescheduleAppointment(appointment.id, startAt);
      dialog.close();
      setFeedback(SUCCESS_MESSAGES.reschedule);
      await loadAppointments(currentFilters, { keepFeedback: true });
      return true;
    } catch (error) {
      dialog.setError(getSafeErrorMessage(error, 'No se pudo reprogramar la cita.'));
      return false;
    }
  });

  form.element.addEventListener('submit', (event) => {
    event.preventDefault();
    const filters = getFormFilters();
    const rangeError = validateRange(filters);

    if (rangeError) {
      setError(rangeError);
      return;
    }

    loadAppointments(filters);
  });

  form.clearButton.addEventListener('click', () => {
    form.reset();
    setError('');
    setFeedback('');
    loadAppointments({});
  });

  (async () => {
    const currentRequest = ++requestId;
    loading = true;
    form.setBusy(true);
    results.replaceChildren();
    const loadingText = document.createElement('p');
    loadingText.className = 'panel-status';
    loadingText.textContent = 'Cargando citas...';
    results.append(loadingText);

    try {
      const [appointmentsResult, clientsResult, professionalsResult, servicesResult] =
        await Promise.all([
          getAppointments({}),
          listClients(),
          listProfessionals(),
          listServices(),
        ]);

      if (currentRequest !== requestId || !results.isConnected) {
        return;
      }

      names = {
        clientName: createNameLookup(clientsResult.clients, 'Cliente no disponible'),
        professionalName: createNameLookup(
          professionalsResult.professionals,
          'Profesional no disponible'
        ),
        serviceName: createNameLookup(servicesResult.services, 'Servicio no disponible'),
      };

      fillSelect(form.client, sortByName(clientsResult.clients), 'Todos los clientes');
      fillSelect(form.professional, sortByName(professionalsResult.professionals), 'Todos los profesionales');
      fillSelect(form.service, sortByName(servicesResult.services), 'Todos los servicios');

      currentFilters = {};
      renderAppointmentTable(results, appointmentsResult.appointments, names, {
        onAction: handleAction,
      });
    } catch (error) {
      if (currentRequest !== requestId || !results.isConnected) {
        return;
      }

      results.replaceChildren();
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'button button--primary';
      retry.textContent = 'Reintentar';
      retry.addEventListener('click', () => {
        loadAppointments(currentFilters);
      });
      setError(getSafeErrorMessage(error, 'No se pudieron cargar las citas.'));
      results.append(retry);
    } finally {
      if (currentRequest === requestId) {
        loading = false;
        form.setBusy(false);
      }
    }
  })();
}

function confirmMessage(action) {
  if (action === 'cancel') {
    return '¿Deseas cancelar esta cita?';
  }

  if (action === 'confirm') {
    return '¿Deseas confirmar esta cita?';
  }

  if (action === 'complete') {
    return '¿Deseas marcar esta cita como completada?';
  }

  return '¿Deseas marcar esta cita como no asistió?';
}

function createFilterForm() {
  const element = document.createElement('form');
  element.className = 'filters-form';
  element.noValidate = true;

  const client = createSelect('filter-client', 'Cliente');
  const professional = createSelect('filter-professional', 'Profesional');
  const service = createSelect('filter-service', 'Servicio');
  const status = createSelect('filter-status', 'Estado');
  const from = createDateInput('filter-from', 'Desde');
  const to = createDateInput('filter-to', 'Hasta');

  fillStatusOptions(status.select);

  const actions = document.createElement('div');
  actions.className = 'filters-form__actions';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'button button--primary';
  submit.textContent = 'Filtrar';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'button button--ghost';
  clearButton.textContent = 'Limpiar';

  actions.append(submit, clearButton);
  element.append(
    client.wrapper,
    professional.wrapper,
    service.wrapper,
    status.wrapper,
    from.wrapper,
    to.wrapper,
    actions
  );

  return {
    element,
    client: client.select,
    professional: professional.select,
    service: service.select,
    status: status.select,
    from: from.input,
    to: to.input,
    clearButton,
    reset() {
      element.reset();
    },
    setBusy(isBusy) {
      submit.disabled = isBusy;
      clearButton.disabled = isBusy;
    },
  };
}

function createSelect(id, label) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const labelEl = document.createElement('label');
  labelEl.setAttribute('for', id);
  labelEl.textContent = label;

  const select = document.createElement('select');
  select.id = id;
  select.name = id;

  wrapper.append(labelEl, select);
  return { wrapper, select };
}

function createDateInput(id, label) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const labelEl = document.createElement('label');
  labelEl.setAttribute('for', id);
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.id = id;
  input.name = id;
  input.type = 'date';

  wrapper.append(labelEl, input);
  return { wrapper, input };
}

function fillSelect(select, items, emptyLabel) {
  select.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = emptyLabel;
  select.append(empty);

  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    select.append(option);
  }
}

function fillStatusOptions(select) {
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'Todos los estados';
  select.append(empty);

  for (const [value, label] of Object.entries(STATUS_LABELS)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
}

function renderAppointmentTable(container, appointments, names, { onAction }) {
  container.replaceChildren();

  if (appointments.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'panel-status';
    empty.textContent = 'No se encontraron citas con los filtros seleccionados.';
    container.append(empty);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';

  const table = document.createElement('table');
  table.className = 'data-table';

  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['Fecha', 'Hora', 'Cliente', 'Profesional', 'Servicio', 'Estado', 'Duración', 'Acciones']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    headRow.append(th);
  }
  head.append(headRow);

  const body = document.createElement('tbody');
  for (const appointment of appointments) {
    const row = document.createElement('tr');
    appendTextCell(row, formatLocalDate(appointment.startAt));
    appendTextCell(row, formatLocalTime(appointment.startAt));
    appendTextCell(row, names.clientName(appointment.clientId));
    appendTextCell(row, names.professionalName(appointment.professionalId));
    appendTextCell(row, names.serviceName(appointment.serviceId));

    const statusCell = document.createElement('td');
    statusCell.append(createStatusBadge(appointment.status));
    row.append(statusCell);

    appendTextCell(row, `${appointment.serviceDurationMinutes} min`);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'data-table__actions';
    for (const action of getAppointmentActions(appointment.status)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = action === 'cancel' ? 'button button--small button--danger' : 'button button--small';
      button.textContent = ACTION_LABELS[action];
      button.addEventListener('click', () => onAction(action, appointment, row));
      actionsCell.append(button);
    }
    row.append(actionsCell);
    body.append(row);
  }

  table.append(head, body);
  wrap.append(table);
  container.append(wrap);
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

function createRescheduleDialog() {
  const element = document.createElement('dialog');
  element.className = 'reschedule-dialog';

  const title = document.createElement('h2');
  title.id = 'reschedule-title';
  title.textContent = 'Reprogramar cita';
  element.setAttribute('aria-labelledby', 'reschedule-title');

  const summary = document.createElement('p');
  summary.className = 'reschedule-dialog__summary';

  const form = document.createElement('form');
  form.className = 'reschedule-dialog__form';
  form.method = 'dialog';

  const field = document.createElement('div');
  field.className = 'form-field';

  const label = document.createElement('label');
  label.setAttribute('for', 'reschedule-startAt');
  label.textContent = 'Nuevo horario';

  const input = document.createElement('input');
  input.id = 'reschedule-startAt';
  input.type = 'datetime-local';
  input.required = true;

  field.append(label, input);

  const error = document.createElement('p');
  error.className = 'panel-error';
  error.setAttribute('role', 'alert');

  const actions = document.createElement('div');
  actions.className = 'reschedule-dialog__actions';

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
  form.append(field, error, actions);
  element.append(title, summary, form);

  let currentAppointment = null;
  let submitHandler = null;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!currentAppointment) {
      return;
    }

    const startAt = input.value.slice(0, 16);
    if (!isDateTimeLocal(startAt)) {
      error.textContent = 'Debes indicar un horario válido.';
      return;
    }

    save.disabled = true;
    try {
      await submitHandler?.(currentAppointment, startAt);
    } finally {
      save.disabled = false;
    }
  });

  return {
    element,
    open(appointment, names) {
      currentAppointment = appointment;
      error.textContent = '';
      input.value = appointment.startAt;
      summary.textContent = `${names.clientName(appointment.clientId)} · ${formatLocalDate(appointment.startAt)} ${formatLocalTime(appointment.startAt)}`;
      element.showModal();
      input.focus();
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
