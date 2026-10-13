import {
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  listAvailabilityBlocks,
  updateAvailabilityBlock,
} from '../api/availabilityBlocks.api.js';
import {
  assignProfessionalService,
  listProfessionalServices,
  unassignProfessionalService,
} from '../api/professionalServices.api.js';
import { listServices } from '../api/services.api.js';
import {
  createWeeklySchedule,
  deleteWeeklySchedule,
  listWeeklySchedules,
  updateWeeklySchedule,
} from '../api/weeklySchedules.api.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { formatLocalDate, formatLocalTime, isDateTimeLocal } from '../utils/dateTime.js';

const DAY_LABELS = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d/;

export function createConfigurationDialog() {
  const element = document.createElement('dialog');
  element.className = 'config-dialog';

  const header = document.createElement('div');
  header.className = 'config-dialog__header';

  const title = document.createElement('h2');
  title.id = 'professional-config-title';
  title.textContent = 'Configuración';
  element.setAttribute('aria-labelledby', 'professional-config-title');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'button button--ghost';
  closeButton.textContent = 'Cerrar';
  closeButton.addEventListener('click', () => element.close());
  header.append(title, closeButton);

  const feedback = document.createElement('p');
  feedback.className = 'panel-feedback';
  feedback.setAttribute('aria-live', 'polite');

  const errorBox = document.createElement('p');
  errorBox.className = 'panel-error';
  errorBox.setAttribute('role', 'alert');

  const content = document.createElement('div');
  content.className = 'config-dialog__content';

  element.append(header, feedback, errorBox, content);

  let professional = null;
  let loadId = 0;
  let catalog = [];
  let assigned = [];
  let schedules = [];
  let blocks = [];

  const scheduleForm = createScheduleForm();
  const blockForm = createBlockForm();

  function setFeedback(message) {
    feedback.textContent = message;
  }

  function setError(message) {
    errorBox.textContent = message;
  }

  function configError(error, fallback, notFoundMessage) {
    return getSafeErrorMessage(error, fallback, { notFoundMessage });
  }

  function isCurrent(id) {
    return id === loadId && element.open && element.isConnected;
  }

  async function loadConfiguration({ keepFeedback = false } = {}) {
    if (!professional) {
      return;
    }

    const current = ++loadId;
    setError('');

    if (!keepFeedback) {
      setFeedback('');
    }

    content.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'panel-status';
    loading.textContent = 'Cargando configuración...';
    content.append(loading);

    try {
      const [assignedResult, schedulesResult, blocksResult, servicesResult] = await Promise.all([
        listProfessionalServices(professional.id),
        listWeeklySchedules(professional.id),
        listAvailabilityBlocks(professional.id),
        listServices(),
      ]);

      if (!isCurrent(current)) {
        return;
      }

      assigned = assignedResult.services ?? [];
      schedules = sortSchedules(schedulesResult.schedules ?? []);
      blocks = sortBlocks(blocksResult.blocks ?? []);
      catalog = servicesResult.services ?? [];
      renderSections();
    } catch (error) {
      if (!isCurrent(current)) {
        return;
      }

      content.replaceChildren();
      const message = document.createElement('p');
      message.className = 'panel-error';
      message.setAttribute('role', 'alert');
      message.textContent = 'No se pudo cargar la configuración.';

      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'button button--primary';
      retry.textContent = 'Reintentar';
      retry.addEventListener('click', () => {
        loadConfiguration();
      });

      content.append(message, retry);
      setError(configError(error, 'No se pudo cargar la configuración.', 'El profesional ya no está disponible.'));
    }
  }

  function renderSections() {
    content.replaceChildren();
    content.append(
      renderServicesSection(),
      renderSchedulesSection(),
      renderBlocksSection()
    );
  }

  function renderServicesSection() {
    const section = document.createElement('section');
    section.className = 'config-section';

    const heading = document.createElement('h3');
    heading.textContent = 'Servicios habilitados';
    section.append(heading);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'table-wrap';
    renderAssignedTable(tableWrap);
    section.append(tableWrap);

    const form = document.createElement('form');
    form.className = 'config-section__form';
    form.noValidate = true;

    const selectField = createSelectField('config-assign-service', 'Servicio');
    fillAssignableOptions(selectField.select);

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'button button--primary';
    submit.textContent = 'Asignar servicio';
    submit.disabled = selectField.select.options.length === 0;

    form.append(selectField.wrapper, submit);
    section.append(form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const serviceId = selectField.select.value;

      if (!serviceId) {
        setError('Debes seleccionar un servicio.');
        selectField.select.focus();
        return;
      }

      submit.disabled = true;
      setError('');

      try {
        await assignProfessionalService(professional.id, serviceId);

        if (!element.open) {
          return;
        }

        setFeedback('Servicio asignado correctamente.');
        await loadConfiguration({ keepFeedback: true });
      } catch (error) {
        if (!element.open) {
          return;
        }

        setError(configError(error, 'No se pudo asignar el servicio.', 'El servicio ya no está disponible.'));
        submit.disabled = selectField.select.options.length === 0;
      }
    });

    return section;
  }

  function renderAssignedTable(container) {
    container.replaceChildren();

    if (assigned.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'panel-status';
      empty.textContent = 'No hay servicios asignados.';
      container.append(empty);
      return;
    }

    const table = document.createElement('table');
    table.className = 'data-table';
    table.append(createHead(['Servicio', 'Duración', 'Estado del servicio', 'Acciones']));

    const body = document.createElement('tbody');

    for (const service of assigned) {
      const row = document.createElement('tr');
      const active = service.isActive === 1 || service.isActive === true;

      appendTextCell(row, service.name);
      appendTextCell(row, `${service.durationMinutes} min`);

      const statusCell = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = active
        ? 'status-badge service-status-badge service-status-badge--active'
        : 'status-badge service-status-badge service-status-badge--inactive';
      badge.textContent = active ? 'Activo' : 'Inactivo';
      statusCell.append(badge);
      row.append(statusCell);

      const actions = document.createElement('td');
      actions.className = 'data-table__actions';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button button--small button--danger';
      remove.textContent = 'Quitar asignación';
      remove.addEventListener('click', () => unassign(service, row));
      actions.append(remove);
      row.append(actions);
      body.append(row);
    }

    table.append(body);
    container.append(table);
  }

  async function unassign(service, row) {
    const confirmed = window.confirm('¿Deseas quitar este servicio del profesional?');

    if (!confirmed) {
      return;
    }

    setRowBusy(row, true);
    setError('');

    try {
      await unassignProfessionalService(professional.id, service.id);

      if (!element.open) {
        return;
      }

      setFeedback('Servicio desasignado correctamente.');
      await loadConfiguration({ keepFeedback: true });
    } catch (error) {
      if (!element.open) {
        return;
      }

      setError(configError(error, 'No se pudo desasignar el servicio.', 'El servicio ya no está disponible.'));
      setRowBusy(row, false);
    }
  }

  function fillAssignableOptions(select) {
    select.replaceChildren();
    const assignedIds = new Set(assigned.map((service) => service.id));
    const available = catalog.filter(
      (service) => (service.isActive === 1 || service.isActive === true) && !assignedIds.has(service.id)
    );

    if (available.length === 0) {
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'No hay servicios activos disponibles';
      select.append(empty);
      return;
    }

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecciona un servicio';
    select.append(placeholder);

    for (const service of available) {
      const option = document.createElement('option');
      option.value = service.id;
      option.textContent = service.name;
      select.append(option);
    }
  }

  function renderSchedulesSection() {
    const section = document.createElement('section');
    section.className = 'config-section';

    const heading = document.createElement('h3');
    heading.textContent = 'Horario semanal';
    section.append(heading);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'table-wrap';
    renderScheduleTable(tableWrap);
    section.append(tableWrap, scheduleForm.element);
    scheduleForm.reset();
    return section;
  }

  function renderScheduleTable(container) {
    container.replaceChildren();

    if (schedules.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'panel-status';
      empty.textContent = 'No hay intervalos de horario.';
      container.append(empty);
      return;
    }

    const table = document.createElement('table');
    table.className = 'data-table';
    table.append(createHead(['Día', 'Inicio', 'Fin', 'Acciones']));
    const body = document.createElement('tbody');

    for (const schedule of schedules) {
      const row = document.createElement('tr');
      appendTextCell(row, dayLabel(schedule.dayOfWeek));
      appendTextCell(row, schedule.startTime);
      appendTextCell(row, schedule.endTime);

      const actions = document.createElement('td');
      actions.className = 'data-table__actions';

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'button button--small';
      edit.textContent = 'Editar';
      edit.addEventListener('click', () => scheduleForm.edit(schedule));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button button--small button--danger';
      remove.textContent = 'Eliminar';
      remove.addEventListener('click', () => removeSchedule(schedule, row));

      actions.append(edit, remove);
      row.append(actions);
      body.append(row);
    }

    table.append(body);
    container.append(table);
  }

  async function saveSchedule(mode, current, data) {
    if (mode === 'create') {
      await createWeeklySchedule(professional.id, data);
      setFeedback('Horario agregado correctamente.');
    } else {
      await updateWeeklySchedule(professional.id, current.id, data);
      setFeedback('Horario actualizado correctamente.');
    }

    await loadConfiguration({ keepFeedback: true });
  }

  async function removeSchedule(schedule, row) {
    const confirmed = window.confirm('¿Deseas eliminar este intervalo del horario?');

    if (!confirmed) {
      return;
    }

    setRowBusy(row, true);
    setError('');

    try {
      await deleteWeeklySchedule(professional.id, schedule.id);

      if (!element.open) {
        return;
      }

      setFeedback('Horario eliminado correctamente.');
      await loadConfiguration({ keepFeedback: true });
    } catch (error) {
      if (!element.open) {
        return;
      }

      setError(configError(error, 'No se pudo eliminar el horario.', 'El horario ya no está disponible.'));
      setRowBusy(row, false);
    }
  }

  function renderBlocksSection() {
    const section = document.createElement('section');
    section.className = 'config-section';

    const heading = document.createElement('h3');
    heading.textContent = 'Bloqueos de disponibilidad';

    const lead = document.createElement('p');
    lead.className = 'config-section__lead';
    lead.textContent =
      'Los bloqueos representan períodos excepcionales en los que el profesional no estará disponible.';

    const tableWrap = document.createElement('div');
    tableWrap.className = 'table-wrap';
    renderBlockTable(tableWrap);

    section.append(heading, lead, tableWrap, blockForm.element);
    blockForm.reset();
    return section;
  }

  function renderBlockTable(container) {
    container.replaceChildren();

    if (blocks.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'panel-status';
      empty.textContent = 'No hay bloqueos registrados.';
      container.append(empty);
      return;
    }

    const table = document.createElement('table');
    table.className = 'data-table';
    table.append(createHead(['Inicio', 'Fin', 'Motivo', 'Acciones']));
    const body = document.createElement('tbody');

    for (const block of blocks) {
      const row = document.createElement('tr');
      appendTextCell(row, formatBlockDateTime(block.startAt));
      appendTextCell(row, formatBlockDateTime(block.endAt));
      appendTextCell(row, displayReason(block.reason));

      const actions = document.createElement('td');
      actions.className = 'data-table__actions';

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'button button--small';
      edit.textContent = 'Editar';
      edit.addEventListener('click', () => blockForm.edit(block));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button button--small button--danger';
      remove.textContent = 'Eliminar';
      remove.addEventListener('click', () => removeBlock(block, row));

      actions.append(edit, remove);
      row.append(actions);
      body.append(row);
    }

    table.append(body);
    container.append(table);
  }

  async function saveBlock(mode, current, data) {
    if (mode === 'create') {
      await createAvailabilityBlock(professional.id, data);
      setFeedback('Bloqueo agregado correctamente.');
    } else {
      await updateAvailabilityBlock(professional.id, current.id, data);
      setFeedback('Bloqueo actualizado correctamente.');
    }

    await loadConfiguration({ keepFeedback: true });
  }

  async function removeBlock(block, row) {
    const confirmed = window.confirm('¿Deseas eliminar este bloqueo?');

    if (!confirmed) {
      return;
    }

    setRowBusy(row, true);
    setError('');

    try {
      await deleteAvailabilityBlock(professional.id, block.id);

      if (!element.open) {
        return;
      }

      setFeedback('Bloqueo eliminado correctamente.');
      await loadConfiguration({ keepFeedback: true });
    } catch (error) {
      if (!element.open) {
        return;
      }

      setError(configError(error, 'No se pudo eliminar el bloqueo.', 'El bloqueo ya no está disponible.'));
      setRowBusy(row, false);
    }
  }

  scheduleForm.onSubmit(async (mode, current, data) => {
    setError('');
    try {
      await saveSchedule(mode, current, data);
    } catch (error) {
      scheduleForm.setError(
        configError(error, 'No se pudo guardar el horario.', 'El horario ya no está disponible.')
      );
    }
  });

  blockForm.onSubmit(async (mode, current, data) => {
    setError('');
    try {
      await saveBlock(mode, current, data);
    } catch (error) {
      blockForm.setError(
        configError(error, 'No se pudo guardar el bloqueo.', 'El bloqueo ya no está disponible.')
      );
    }
  });

  element.addEventListener('close', () => {
    loadId += 1;
    professional = null;
    setFeedback('');
    setError('');
    content.replaceChildren();
  });

  return {
    element,
    open(currentProfessional) {
      professional = currentProfessional;
      title.textContent = `Configuración de ${currentProfessional.name}`;
      setFeedback('');
      setError('');

      if (!element.open) {
        element.showModal();
      }

      closeButton.focus();
      loadConfiguration();
    },
    close() {
      element.close();
    },
  };
}

function dayLabel(dayOfWeek) {
  return DAY_LABELS[dayOfWeek] ?? String(dayOfWeek);
}

function sortSchedules(items) {
  return [...items].sort((left, right) => {
    if (left.dayOfWeek !== right.dayOfWeek) {
      return left.dayOfWeek - right.dayOfWeek;
    }

    return String(left.startTime).localeCompare(String(right.startTime));
  });
}

function sortBlocks(items) {
  return [...items].sort((left, right) => String(left.startAt).localeCompare(String(right.startAt)));
}

function formatBlockDateTime(value) {
  if (!isDateTimeLocal(value)) {
    return value ?? '';
  }

  return `${formatLocalDate(value)} ${formatLocalTime(value)}`;
}

function displayReason(reason) {
  if (reason == null || String(reason).trim() === '') {
    return 'Sin motivo';
  }

  return reason;
}

function normalizeTime(value) {
  const match = TIME_PATTERN.exec(String(value).trim());
  return match ? match[0] : '';
}

function normalizeDateTime(value) {
  const normalized = String(value).trim().slice(0, 16);
  return isDateTimeLocal(normalized) ? normalized : '';
}

function createHead(labels) {
  const head = document.createElement('thead');
  const row = document.createElement('tr');

  for (const label of labels) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    row.append(th);
  }

  head.append(row);
  return head;
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

function createSelectField(id, label) {
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

function createInputField({ id, label, type, required = false }) {
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

  wrapper.append(labelEl, input);
  return { wrapper, input };
}

function createScheduleForm() {
  const form = document.createElement('form');
  form.className = 'config-section__form config-section__form--schedule';
  form.noValidate = true;

  const dayField = createSelectField('config-schedule-day', 'Día');
  for (const [value, label] of Object.entries(DAY_LABELS)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    dayField.select.append(option);
  }

  const startField = createInputField({
    id: 'config-schedule-start',
    label: 'Hora inicio',
    type: 'time',
    required: true,
  });
  const endField = createInputField({
    id: 'config-schedule-end',
    label: 'Hora fin',
    type: 'time',
    required: true,
  });

  const error = document.createElement('p');
  error.className = 'panel-error';
  error.setAttribute('role', 'alert');

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'button button--primary';
  submit.textContent = 'Agregar horario';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'button button--ghost';
  cancel.textContent = 'Cancelar edición';
  cancel.hidden = true;

  form.append(dayField.wrapper, startField.wrapper, endField.wrapper, submit);

  const wrap = document.createElement('div');
  wrap.append(form, error, cancel);

  let current = null;
  let submitHandler = null;

  function reset() {
    current = null;
    form.reset();
    dayField.select.value = '1';
    error.textContent = '';
    submit.textContent = 'Agregar horario';
    cancel.hidden = true;
  }

  cancel.addEventListener('click', () => {
    reset();
    dayField.select.focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const dayOfWeek = Number(dayField.select.value);
    const startTime = normalizeTime(startField.input.value);
    const endTime = normalizeTime(endField.input.value);

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      error.textContent = 'El día de la semana no es válido.';
      dayField.select.focus();
      return;
    }

    if (!startTime || !endTime) {
      error.textContent = 'Debes indicar hora de inicio y de fin.';
      startField.input.focus();
      return;
    }

    if (startTime >= endTime) {
      error.textContent = 'La hora de inicio debe ser anterior a la hora de fin.';
      startField.input.focus();
      return;
    }

    submit.disabled = true;
    error.textContent = '';

    try {
      await submitHandler?.(current ? 'edit' : 'create', current, {
        dayOfWeek,
        startTime,
        endTime,
      });
    } finally {
      submit.disabled = false;
    }
  });

  return {
    element: wrap,
    reset,
    setError(message) {
      error.textContent = message;
    },
    edit(schedule) {
      current = schedule;
      dayField.select.value = String(schedule.dayOfWeek);
      startField.input.value = schedule.startTime;
      endField.input.value = schedule.endTime;
      submit.textContent = 'Guardar horario';
      cancel.hidden = false;
      error.textContent = '';
      dayField.select.focus();
    },
    onSubmit(handler) {
      submitHandler = handler;
    },
  };
}

function createBlockForm() {
  const form = document.createElement('form');
  form.className = 'config-section__form config-section__form--block';
  form.noValidate = true;

  const startField = createInputField({
    id: 'config-block-start',
    label: 'Inicio',
    type: 'datetime-local',
    required: true,
  });
  const endField = createInputField({
    id: 'config-block-end',
    label: 'Fin',
    type: 'datetime-local',
    required: true,
  });

  const reasonWrap = document.createElement('div');
  reasonWrap.className = 'form-field';
  const reasonLabel = document.createElement('label');
  reasonLabel.setAttribute('for', 'config-block-reason');
  reasonLabel.textContent = 'Motivo';
  const reasonInput = document.createElement('textarea');
  reasonInput.id = 'config-block-reason';
  reasonInput.name = 'config-block-reason';
  reasonWrap.append(reasonLabel, reasonInput);

  const error = document.createElement('p');
  error.className = 'panel-error';
  error.setAttribute('role', 'alert');

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'button button--primary';
  submit.textContent = 'Agregar bloqueo';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'button button--ghost';
  cancel.textContent = 'Cancelar edición';
  cancel.hidden = true;

  form.append(startField.wrapper, endField.wrapper, reasonWrap, submit);

  const wrap = document.createElement('div');
  wrap.append(form, error, cancel);

  let current = null;
  let submitHandler = null;

  function reset() {
    current = null;
    form.reset();
    error.textContent = '';
    submit.textContent = 'Agregar bloqueo';
    cancel.hidden = true;
  }

  cancel.addEventListener('click', () => {
    reset();
    startField.input.focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const startAt = normalizeDateTime(startField.input.value);
    const endAt = normalizeDateTime(endField.input.value);
    const reason = reasonInput.value.trim();

    if (!startAt || !endAt) {
      error.textContent = 'Debes indicar inicio y fin.';
      startField.input.focus();
      return;
    }

    if (startAt >= endAt) {
      error.textContent = 'El inicio debe ser anterior al fin.';
      startField.input.focus();
      return;
    }

    submit.disabled = true;
    error.textContent = '';

    try {
      await submitHandler?.(current ? 'edit' : 'create', current, {
        startAt,
        endAt,
        reason: reason === '' ? null : reason,
      });
    } finally {
      submit.disabled = false;
    }
  });

  return {
    element: wrap,
    reset,
    setError(message) {
      error.textContent = message;
    },
    edit(block) {
      current = block;
      startField.input.value = normalizeDateTime(block.startAt);
      endField.input.value = normalizeDateTime(block.endAt);
      reasonInput.value = block.reason ?? '';
      submit.textContent = 'Guardar bloqueo';
      cancel.hidden = false;
      error.textContent = '';
      startField.input.focus();
    },
    onSubmit(handler) {
      submitHandler = handler;
    },
  };
}
