import { listClients } from '../api/clients.api.js';
import { getDashboard } from '../api/dashboard.api.js';
import { listProfessionals } from '../api/professionals.api.js';
import { listServices } from '../api/services.api.js';
import { createStatusBadge } from '../utils/appointmentStatus.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { formatLocalDate, formatLocalTime } from '../utils/dateTime.js';
import { createNameLookup } from '../utils/references.js';

const COPY = {
  ADMIN: {
    title: 'Panel administrativo',
    description: 'Resumen operativo de la organización.',
  },
  RECEPTIONIST: {
    title: 'Panel de recepción',
    description: 'Consulta el estado operativo de las citas y clientes.',
  },
};

export function renderDashboardView(root, session) {
  root.replaceChildren();

  const copy = COPY[session.user.role] ?? COPY.ADMIN;
  let requestId = 0;

  const page = document.createElement('section');
  page.className = 'staff-page';

  const heading = document.createElement('h1');
  heading.textContent = copy.title;

  const lead = document.createElement('p');
  lead.className = 'staff-page__lead';
  lead.textContent = copy.description;

  const form = document.createElement('form');
  form.className = 'dashboard-date-form';

  const dateField = document.createElement('div');
  dateField.className = 'form-field';

  const dateLabel = document.createElement('label');
  dateLabel.setAttribute('for', 'dashboard-date');
  dateLabel.textContent = 'Fecha';

  const dateInput = document.createElement('input');
  dateInput.id = 'dashboard-date';
  dateInput.name = 'date';
  dateInput.type = 'date';

  dateField.append(dateLabel, dateInput);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'button button--primary';
  submit.textContent = 'Consultar';

  form.append(dateField, submit);

  const content = document.createElement('div');
  content.className = 'dashboard-content';

  page.append(heading, lead, form, content);
  root.append(page);

  async function load(date) {
    const currentRequest = ++requestId;
    content.replaceChildren();

    const loading = document.createElement('p');
    loading.className = 'panel-status';
    loading.textContent = 'Cargando dashboard...';
    content.append(loading);
    submit.disabled = true;

    try {
      const [dashboard, clientsResult, professionalsResult, servicesResult] = await Promise.all([
        getDashboard(date),
        listClients(),
        listProfessionals(),
        listServices(),
      ]);

      if (currentRequest !== requestId || !content.isConnected) {
        return;
      }

      dateInput.value = dashboard.date;
      renderDashboard(content, dashboard, {
        clientName: createNameLookup(clientsResult.clients, 'Cliente no disponible'),
        professionalName: createNameLookup(professionalsResult.professionals, 'Profesional no disponible'),
        serviceName: createNameLookup(servicesResult.services, 'Servicio no disponible'),
      });
    } catch (error) {
      if (currentRequest !== requestId || !content.isConnected) {
        return;
      }

      renderError(content, getSafeErrorMessage(error, 'No se pudo cargar el dashboard.'), () => {
        load(dateInput.value || undefined);
      });
    } finally {
      if (currentRequest === requestId) {
        submit.disabled = false;
      }
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    load(dateInput.value || undefined);
  });

  load();
}

function renderError(container, message, onRetry) {
  container.replaceChildren();

  const error = document.createElement('p');
  error.className = 'panel-error';
  error.setAttribute('role', 'alert');
  error.textContent = message;

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'button button--primary';
  retry.textContent = 'Reintentar';
  retry.addEventListener('click', onRetry);

  container.append(error, retry);
}

function renderDashboard(container, dashboard, names) {
  container.replaceChildren();

  const metrics = document.createElement('section');
  metrics.className = 'metric-grid';
  metrics.setAttribute('aria-label', 'Métricas de citas');

  appendMetric(metrics, 'Citas totales', dashboard.appointments.total);
  appendMetric(metrics, 'Programadas', dashboard.appointments.programada);
  appendMetric(metrics, 'Confirmadas', dashboard.appointments.confirmada);
  appendMetric(metrics, 'Completadas', dashboard.appointments.completada);
  appendMetric(metrics, 'Canceladas', dashboard.appointments.cancelada);
  appendMetric(metrics, 'No asistió', dashboard.appointments.noAsistio);

  const resources = document.createElement('section');
  resources.className = 'metric-grid metric-grid--resources';
  resources.setAttribute('aria-label', 'Recursos activos');
  appendMetric(resources, 'Clientes activos', dashboard.activeResources.clients);
  appendMetric(resources, 'Profesionales activos', dashboard.activeResources.professionals);
  appendMetric(resources, 'Servicios activos', dashboard.activeResources.services);

  const today = document.createElement('section');
  today.className = 'today-section';

  const todayTitle = document.createElement('h2');
  todayTitle.textContent = 'Citas de la fecha';
  today.append(todayTitle);

  if (dashboard.today.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'panel-status';
    empty.textContent = 'No hay citas para esta fecha.';
    today.append(empty);
  } else {
    today.append(createTodayTable(dashboard.today, names));
  }

  container.append(metrics, resources, today);
}

function appendMetric(grid, label, value) {
  const card = document.createElement('article');
  card.className = 'metric-card';

  const title = document.createElement('p');
  title.className = 'metric-card__label';
  title.textContent = label;

  const amount = document.createElement('p');
  amount.className = 'metric-card__value';
  amount.textContent = String(value);

  card.append(title, amount);
  grid.append(card);
}

function createTodayTable(appointments, names) {
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';

  const table = document.createElement('table');
  table.className = 'data-table';

  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['Hora', 'Cliente', 'Profesional', 'Servicio', 'Estado']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    headRow.append(th);
  }
  head.append(headRow);

  const body = document.createElement('tbody');
  for (const appointment of appointments) {
    const row = document.createElement('tr');
    appendCell(row, formatLocalTime(appointment.startAt));
    appendCell(row, names.clientName(appointment.clientId));
    appendCell(row, names.professionalName(appointment.professionalId));
    appendCell(row, names.serviceName(appointment.serviceId));

    const statusCell = document.createElement('td');
    statusCell.append(createStatusBadge(appointment.status));
    row.append(statusCell);
    body.append(row);
  }

  table.append(head, body);
  wrap.append(table);
  return wrap;
}

function appendCell(row, text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  row.append(cell);
}
