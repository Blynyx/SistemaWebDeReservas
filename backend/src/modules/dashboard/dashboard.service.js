import { httpError } from '../../utils/httpError.js';
import {
  getDatePart,
  nextDay,
  nowLocalDateTime,
  parseLocalDate,
} from '../../utils/datetime.js';
import { findByFilters } from '../appointments/appointment.repository.js';
import { toAppointmentResponse } from '../appointments/appointment.service.js';
import {
  countActiveClients,
  countActiveProfessionals,
  countActiveServices,
  countAppointmentsByStatusInRange,
  findFrequentClientsInRange,
  findTopServicesInRange,
} from './dashboard.repository.js';

const EMPTY_STATUS_COUNTS = {
  PROGRAMADA: 0,
  CONFIRMADA: 0,
  COMPLETADA: 0,
  CANCELADA: 0,
  NO_ASISTIO: 0,
};

function parseDashboardDate(value) {
  if (value === undefined) {
    return getDatePart(nowLocalDateTime());
  }

  const parsed = parseLocalDate(value);

  if (!parsed) {
    throw httpError(400, 'date debe tener el formato YYYY-MM-DD y ser una fecha real');
  }

  return parsed.value;
}

function toAppointmentCounts(rows) {
  const counts = { ...EMPTY_STATUS_COUNTS };

  for (const row of rows) {
    counts[row.status] = row.total;
  }

  return {
    total:
      counts.PROGRAMADA +
      counts.CONFIRMADA +
      counts.COMPLETADA +
      counts.CANCELADA +
      counts.NO_ASISTIO,
    programada: counts.PROGRAMADA,
    confirmada: counts.CONFIRMADA,
    completada: counts.COMPLETADA,
    cancelada: counts.CANCELADA,
    noAsistio: counts.NO_ASISTIO,
  };
}

export async function getDashboard(organizationId, query) {
  const date = parseDashboardDate(query?.date);
  const rangeStart = `${date}T00:00`;
  const rangeEnd = `${nextDay(date)}T00:00`;

  const [statusRows, clients, professionals, services, topServices, frequentClients, todayRows] =
    await Promise.all([
      countAppointmentsByStatusInRange(organizationId, rangeStart, rangeEnd),
      countActiveClients(organizationId),
      countActiveProfessionals(organizationId),
      countActiveServices(organizationId),
      findTopServicesInRange(organizationId, rangeStart, rangeEnd, { limit: 5 }),
      findFrequentClientsInRange(organizationId, rangeStart, rangeEnd, { limit: 5 }),
      findByFilters(organizationId, { rangeStart, rangeEnd }),
    ]);

  return {
    date,
    appointments: toAppointmentCounts(statusRows),
    activeResources: {
      clients,
      professionals,
      services,
    },
    topServices,
    frequentClients,
    today: todayRows.map(toAppointmentResponse),
  };
}
