import { getAvailability } from '../api/availability.api.js';
import { createAppointment } from '../api/appointments.api.js';
import { ApiError } from '../api/apiClient.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { formatLocalDate, formatLocalTime } from '../utils/dateTime.js';
import { sortByName } from '../utils/references.js';

export function createStaffAppointmentBookingDialog({ onCreated }) {
  const element = document.createElement('dialog');
  element.className = 'booking-dialog';
  element.setAttribute('aria-labelledby', 'booking-dialog-title');

  const title = document.createElement('h2');
  title.id = 'booking-dialog-title';
  title.textContent = 'Nueva cita';

  const form = document.createElement('form');
  form.className = 'booking-dialog__form';
  form.noValidate = true;

  const fields = document.createElement('div');
  fields.className = 'booking-dialog__fields';
  const clientField = createSelectField('booking-client', 'Cliente *');
  const serviceField = createSelectField('booking-service', 'Servicio *');
  const dateField = createDateField('booking-date', 'Fecha *');
  fields.append(clientField.wrapper, serviceField.wrapper, dateField.wrapper);

  const referenceStatus = document.createElement('div');
  referenceStatus.className = 'booking-dialog__reference-status';
  referenceStatus.setAttribute('aria-live', 'polite');

  const consult = document.createElement('button');
  consult.type = 'button';
  consult.className = 'button button--primary';
  consult.textContent = 'Consultar disponibilidad';

  const availabilityStatus = document.createElement('p');
  availabilityStatus.className = 'panel-status';
  availabilityStatus.setAttribute('aria-live', 'polite');

  const availabilityError = document.createElement('p');
  availabilityError.className = 'panel-error';
  availabilityError.setAttribute('role', 'alert');

  const availabilityResults = document.createElement('section');
  availabilityResults.className = 'booking-dialog__availability';
  availabilityResults.setAttribute('aria-label', 'Disponibilidad');
  availabilityResults.tabIndex = -1;

  const summary = document.createElement('section');
  summary.className = 'booking-dialog__summary';
  summary.setAttribute('aria-live', 'polite');

  const createError = document.createElement('p');
  createError.className = 'panel-error';
  createError.setAttribute('role', 'alert');

  const actions = document.createElement('div');
  actions.className = 'booking-dialog__actions';

  const createButton = document.createElement('button');
  createButton.type = 'submit';
  createButton.className = 'button button--primary';
  createButton.textContent = 'Crear cita';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'button button--ghost';
  cancelButton.textContent = 'Cancelar';
  cancelButton.addEventListener('click', () => element.close());

  actions.append(createButton, cancelButton);
  form.append(
    fields,
    referenceStatus,
    consult,
    availabilityStatus,
    availabilityError,
    availabilityResults,
    summary,
    createError,
    actions
  );
  element.append(title, form);

  let clients = [];
  let services = [];
  let availability = null;
  let selectedSlot = null;
  let availabilityRequestId = 0;
  let availabilityBusy = false;
  let createBusy = false;

  function isCurrentDialog() {
    return element.open && element.isConnected;
  }

  function selectedClient() {
    return clients.find((client) => client.id === clientField.select.value) ?? null;
  }

  function selectedService() {
    return services.find((service) => service.id === serviceField.select.value) ?? null;
  }

  function canConsult() {
    return Boolean(
      serviceField.select.value &&
        dateField.input.value &&
        clients.length &&
        services.length
    );
  }

  function updateControls() {
    const locked = createBusy;
    clientField.select.disabled = locked || clients.length === 0;
    serviceField.select.disabled = locked || services.length === 0;
    dateField.input.disabled = locked || clients.length === 0 || services.length === 0;
    consult.disabled = availabilityBusy || locked || !canConsult();
    consult.textContent = availability ? 'Actualizar disponibilidad' : 'Consultar disponibilidad';
    cancelButton.disabled = locked;
    createButton.disabled = locked || availabilityBusy || !(
      selectedService() &&
      availability?.date === dateField.input.value &&
      availability?.service?.id === serviceField.select.value &&
      selectedSlot
    );
    for (const radio of availabilityResults.querySelectorAll('input[name="booking-slot"]')) {
      radio.disabled = locked || availabilityBusy;
    }
  }

  function clearSelection() {
    selectedSlot = null;
    for (const option of availabilityResults.querySelectorAll('.booking-slot')) {
      option.classList.remove('booking-slot--selected');
    }
    for (const radio of availabilityResults.querySelectorAll('input[name="booking-slot"]')) {
      radio.checked = false;
    }
    renderSummary();
    updateControls();
  }

  function invalidateAvailability() {
    availabilityRequestId += 1;
    availabilityBusy = false;
    availability = null;
    selectedSlot = null;
    availabilityStatus.textContent = '';
    availabilityError.textContent = '';
    availabilityResults.replaceChildren();
    renderSummary();
    updateControls();
  }

  function renderSummary() {
    summary.replaceChildren();
    if (!selectedSlot || !availability) {
      return;
    }

    const client = selectedClient();
    const service = selectedService();
    if (!client || !service) {
      return;
    }

    const heading = document.createElement('h3');
    heading.textContent = 'Resumen';

    const list = document.createElement('dl');
    appendSummaryItem(list, 'Cliente', client.name);
    appendSummaryItem(list, 'Servicio', service.name);
    appendSummaryItem(list, 'Profesional', selectedSlot.professionalName);
    appendSummaryItem(list, 'Fecha', formatLocalDate(selectedSlot.startAt));
    appendSummaryItem(
      list,
      'Horario',
      `${formatLocalTime(selectedSlot.startAt)} – ${formatLocalTime(selectedSlot.endAt)}`
    );
    appendSummaryItem(list, 'Duración', `${availability.service.durationMinutes} min`);
    summary.append(heading, list);
  }

  function selectSlot(option, professional, slot) {
    for (const candidate of availabilityResults.querySelectorAll('.booking-slot')) {
      candidate.classList.remove('booking-slot--selected');
    }
    option.classList.add('booking-slot--selected');
    selectedSlot = {
      professionalId: professional.id,
      professionalName: professional.name,
      startAt: slot.startAt,
      endAt: slot.endAt,
    };
    createError.textContent = '';
    renderSummary();
    updateControls();
  }

  function renderAvailability(payload) {
    availabilityResults.replaceChildren();
    const professionals = Array.isArray(payload.professionals) ? payload.professionals : [];

    if (professionals.length === 0) {
      appendStatus(
        availabilityResults,
        'No hay profesionales habilitados para este servicio.'
      );
      return;
    }

    const hasAnySlot = professionals.some(
      (professional) => Array.isArray(professional.slots) && professional.slots.length > 0
    );
    if (!hasAnySlot) {
      appendStatus(availabilityResults, 'No hay horarios disponibles para esta fecha.');
    }

    for (const professional of professionals) {
      const group = document.createElement('section');
      group.className = 'booking-professional';

      const heading = document.createElement('h3');
      heading.textContent = professional.name;
      group.append(heading);

      const slots = Array.isArray(professional.slots) ? professional.slots : [];
      if (slots.length === 0) {
        appendStatus(group, 'Sin horarios disponibles para esta fecha.');
      } else {
        const slotList = document.createElement('div');
        slotList.className = 'booking-slots';
        slotList.setAttribute('role', 'radiogroup');
        slotList.setAttribute('aria-label', `Horarios de ${professional.name}`);
        for (const slot of slots) {
          const option = document.createElement('label');
          option.className = 'booking-slot';

          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = 'booking-slot';
          radio.value = `${professional.id}|${slot.startAt}`;

          const time = document.createElement('span');
          time.textContent = `${formatLocalTime(slot.startAt)} – ${formatLocalTime(slot.endAt)}`;

          radio.addEventListener('change', () => {
            if (radio.checked) {
              selectSlot(option, professional, slot);
            }
          });

          option.append(radio, time);
          slotList.append(option);
        }
        group.append(slotList);
      }

      availabilityResults.append(group);
    }
  }

  async function queryAvailability({ preserveCreateError = false } = {}) {
    if (!canConsult() || availabilityBusy) {
      return;
    }

    const requestServiceId = serviceField.select.value;
    const requestDate = dateField.input.value;
    const currentRequest = ++availabilityRequestId;
    availabilityBusy = true;
    availability = null;
    selectedSlot = null;
    availabilityResults.replaceChildren();
    availabilityError.textContent = '';
    if (!preserveCreateError) {
      createError.textContent = '';
    }
    availabilityStatus.textContent = 'Consultando disponibilidad...';
    renderSummary();
    updateControls();

    try {
      const payload = await getAvailability({
        serviceId: requestServiceId,
        date: requestDate,
      });

      if (
        currentRequest !== availabilityRequestId ||
        !isCurrentDialog() ||
        serviceField.select.value !== requestServiceId ||
        dateField.input.value !== requestDate
      ) {
        return;
      }

      availability = payload;
      availabilityStatus.textContent = '';
      renderAvailability(payload);
      availabilityResults.focus();
    } catch (error) {
      if (currentRequest !== availabilityRequestId || !isCurrentDialog()) {
        return;
      }

      availabilityStatus.textContent = '';
      availabilityError.textContent = getSafeErrorMessage(
        error,
        'No se pudo consultar la disponibilidad.',
        { notFoundMessage: 'El servicio ya no está disponible.' }
      );
    } finally {
      if (currentRequest === availabilityRequestId) {
        availabilityBusy = false;
        updateControls();
      }
    }
  }

  consult.addEventListener('click', () => queryAvailability());

  serviceField.select.addEventListener('change', invalidateAvailability);
  dateField.input.addEventListener('change', invalidateAvailability);
  clientField.select.addEventListener('change', () => {
    createError.textContent = '';
    renderSummary();
    updateControls();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (
      createBusy ||
      !selectedSlot ||
      !selectedService() ||
      availability?.date !== dateField.input.value ||
      availability?.service?.id !== serviceField.select.value
    ) {
      return;
    }

    if (!selectedClient()) {
      createError.textContent = 'Debes seleccionar un cliente.';
      clientField.select.focus();
      return;
    }

    createBusy = true;
    createError.textContent = '';
    updateControls();

    try {
      const created = await createAppointment({
        clientId: clientField.select.value,
        professionalId: selectedSlot.professionalId,
        serviceId: serviceField.select.value,
        startAt: selectedSlot.startAt,
      });

      if (!isCurrentDialog()) {
        return;
      }

      element.close();
      await onCreated?.(created);
    } catch (error) {
      if (!isCurrentDialog()) {
        return;
      }

      createError.textContent = getSafeErrorMessage(
        error,
        'No se pudo crear la cita.',
        { notFoundMessage: 'El recurso seleccionado ya no está disponible.' }
      );
      clearSelection();

      if (error instanceof ApiError && error.status === 409) {
        await queryAvailability({ preserveCreateError: true });
      }
    } finally {
      createBusy = false;
      if (isCurrentDialog()) {
        updateControls();
      }
    }
  });

  element.addEventListener('close', reset);
  element.addEventListener('cancel', (event) => {
    if (createBusy) {
      event.preventDefault();
    }
  });

  function reset() {
    availabilityRequestId += 1;
    availabilityBusy = false;
    createBusy = false;
    availability = null;
    selectedSlot = null;
    clients = [];
    services = [];
    form.reset();
    referenceStatus.replaceChildren();
    availabilityStatus.textContent = '';
    availabilityError.textContent = '';
    createError.textContent = '';
    availabilityResults.replaceChildren();
    summary.replaceChildren();
    updateControls();
  }

  return {
    element,
    open({ clients: allClients, services: allServices }) {
      reset();
      clients = sortByName(allClients.filter(isActiveRecord));
      services = sortByName(allServices.filter(isActiveRecord));
      fillSelect(clientField.select, clients, 'Selecciona un cliente');
      fillSelect(serviceField.select, services, 'Selecciona un servicio');

      if (clients.length === 0) {
        appendStatus(referenceStatus, 'No hay clientes activos disponibles.');
      }
      if (services.length === 0) {
        appendStatus(referenceStatus, 'No hay servicios activos disponibles.');
      }

      updateControls();
      element.showModal();
      clientField.select.focus();
    },
  };
}

function createSelectField(id, labelText) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = labelText;
  const select = document.createElement('select');
  select.id = id;
  select.required = true;
  wrapper.append(label, select);
  return { wrapper, select };
}

function createDateField(id, labelText) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = labelText;
  const input = document.createElement('input');
  input.id = id;
  input.type = 'date';
  input.required = true;
  wrapper.append(label, input);
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

function appendStatus(container, message) {
  const status = document.createElement('p');
  status.className = 'panel-status';
  status.textContent = message;
  container.append(status);
}

function isActiveRecord(item) {
  return item.isActive === true || item.isActive === 1;
}

function appendSummaryItem(list, term, description) {
  const wrapper = document.createElement('div');
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = description;
  wrapper.append(dt, dd);
  list.append(wrapper);
}
