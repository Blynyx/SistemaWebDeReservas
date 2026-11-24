import { randomUUID } from 'node:crypto';
import {
  withDayLockTransaction,
  withTransaction,
} from '../../database/mongodb/transaction.js';
import {
  acquireProfessionalDayLock,
  extractLockDate,
} from '../../database/mongodb/repositories/professionalDayLock.repository.js';
import { httpError } from '../../utils/httpError.js';
import {
  addMinutes,
  getDatePart,
  getDayOfWeek,
  getTimePart,
  nextDay,
  nowLocalDateTime,
  parseLocalDate,
  parseLocalDateTime,
} from '../../utils/datetime.js';
import { findById as findClientById } from '../clients/client.repository.js';
import { findById as findProfessionalById } from '../professionals/professional.repository.js';
import { assignmentExists } from '../professionalServices/professionalService.repository.js';
import { findById as findServiceById } from '../services/service.repository.js';
import { hasOverlap as hasAvailabilityBlockOverlap } from '../availabilityBlocks/availabilityBlock.repository.js';
import { createAppointmentEventNotifications } from '../notifications/notification.service.js';
import { findCoveringSchedule } from '../weeklySchedules/weeklySchedule.repository.js';
import {
  findByClient,
  findByClientInRange,
  findByFilters,
  findById,
  findByProfessional,
  findByProfessionalInRange,
  hasActiveOverlap,
  insertAppointment,
  reschedule as updateAppointmentSchedule,
  updateBookingDetails,
  updateStatus,
} from './appointment.repository.js';

const ACTIVE_STATUSES = ['PROGRAMADA', 'CONFIRMADA'];
const APPOINTMENT_STATUSES = [
  'PROGRAMADA',
  'CONFIRMADA',
  'COMPLETADA',
  'CANCELADA',
  'NO_ASISTIO',
];

export function toAppointmentResponse(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    professionalId: row.professional_id,
    serviceId: row.service_id,
    startAt: row.start_at,
    endAt: row.end_at,
    serviceDurationMinutes: row.service_duration_minutes,
    servicePriceMinorUnits: row.service_price_minor_units,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseRequiredId(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw httpError(400, `${fieldName} es obligatorio`);
  }

  return value.trim();
}

export function parseOptionalDateRange(query) {
  const payload = query ?? {};
  const fromProvided = payload.from !== undefined;
  const toProvided = payload.to !== undefined;

  if (!fromProvided && !toProvided) {
    return null;
  }

  if (!fromProvided || !toProvided) {
    throw httpError(400, 'from y to deben enviarse juntos');
  }

  const from = parseLocalDate(payload.from);
  const to = parseLocalDate(payload.to);

  if (!from || !to) {
    throw httpError(400, 'from y to deben tener el formato YYYY-MM-DD y ser fechas reales');
  }

  if (from.value > to.value) {
    throw httpError(400, 'from debe ser menor o igual que to');
  }

  return {
    rangeStart: `${from.value}T00:00`,
    rangeEnd: `${nextDay(to.value)}T00:00`,
  };
}

function parseOptionalFilterId(value, fieldName) {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    throw httpError(400, `${fieldName} debe ser un identificador no vacío`);
  }

  return value.trim();
}

function parseOptionalStatus(value) {
  if (value === undefined) {
    return null;
  }

  if (!APPOINTMENT_STATUSES.includes(value)) {
    throw httpError(400, 'status no es válido');
  }

  return value;
}

function parseStartAt(value) {
  const parsed = parseLocalDateTime(value);

  if (!parsed) {
    throw httpError(400, 'startAt debe tener el formato YYYY-MM-DDTHH:mm y ser una fecha real');
  }

  return parsed.value;
}

function requireActiveResource(resource, notFoundMessage, inactiveMessage) {
  if (!resource) {
    throw httpError(404, notFoundMessage);
  }

  if (resource.is_active !== 1) {
    throw httpError(409, inactiveMessage);
  }

  return resource;
}

async function requireTenantAppointment(organizationId, appointmentId, { session } = {}) {
  const appointment = await findById(organizationId, appointmentId, { session });

  if (!appointment) {
    throw httpError(404, 'Cita no encontrada');
  }

  return appointment;
}

async function assertActiveBookingResources(organizationId, appointment, { session } = {}) {
  requireActiveResource(
    await findClientById(organizationId, appointment.client_id, { session }),
    'Cliente no encontrado',
    'El cliente no está activo'
  );
  requireActiveResource(
    await findProfessionalById(organizationId, appointment.professional_id, { session }),
    'Profesional no encontrado',
    'El profesional no está activo'
  );
  requireActiveResource(
    await findServiceById(organizationId, appointment.service_id, { session }),
    'Servicio no encontrado',
    'El servicio no está activo'
  );

  if (
    !(await assignmentExists(
      organizationId,
      appointment.professional_id,
      appointment.service_id,
      { session }
    ))
  ) {
    throw httpError(409, 'El profesional no está habilitado para este servicio');
  }
}

async function assertSlotAvailable(
  {
    organizationId,
    professionalId,
    startAt,
    endAt,
    excludeAppointmentId = null,
  },
  { session } = {}
) {
  if (getDatePart(startAt) !== getDatePart(endAt)) {
    throw httpError(409, 'La cita debe comenzar y terminar el mismo día');
  }

  const coveringSchedule = await findCoveringSchedule(
    organizationId,
    professionalId,
    getDayOfWeek(startAt),
    getTimePart(startAt),
    getTimePart(endAt),
    { session }
  );

  if (!coveringSchedule) {
    throw httpError(409, 'La cita no cabe en el horario semanal del profesional');
  }

  if (
    await hasAvailabilityBlockOverlap(
      {
        organizationId,
        professionalId,
        startAt,
        endAt,
      },
      { session }
    )
  ) {
    throw httpError(409, 'La cita intersecta un bloque de indisponibilidad');
  }

  if (
    await hasActiveOverlap(
      {
        organizationId,
        professionalId,
        startAt,
        endAt,
        excludeAppointmentId,
      },
      { session }
    )
  ) {
    throw httpError(409, 'El profesional ya tiene una cita en ese horario');
  }
}

async function applyStatusTransition({
  organizationId,
  appointmentId,
  targetStatus,
  allowedFrom,
  forbiddenMessage,
  extraCheck,
  expectedProfessionalId = null,
  expectedClientId = null,
}) {
  return withTransaction(async (session) => {
    const appointment = await requireTenantAppointment(organizationId, appointmentId, { session });

    if (expectedProfessionalId && appointment.professional_id !== expectedProfessionalId) {
      throw httpError(404, 'Cita no encontrada');
    }

    if (expectedClientId && appointment.client_id !== expectedClientId) {
      throw httpError(404, 'Cita no encontrada');
    }

    if (appointment.status === targetStatus) {
      return toAppointmentResponse(appointment);
    }

    if (!allowedFrom.includes(appointment.status)) {
      throw httpError(409, forbiddenMessage);
    }

    if (extraCheck) {
      extraCheck(appointment);
    }

    await updateStatus(organizationId, appointmentId, targetStatus, { session });
    const updated = await findById(organizationId, appointmentId, { session });

    if (targetStatus === 'CONFIRMADA') {
      await createAppointmentEventNotifications(
        {
          organizationId,
          appointment: updated,
          eventType: 'CONFIRMED',
        },
        { session }
      );
    }

    if (targetStatus === 'CANCELADA') {
      await createAppointmentEventNotifications(
        {
          organizationId,
          appointment: updated,
          eventType: 'CANCELLED',
        },
        { session }
      );
    }

    return toAppointmentResponse(updated);
  });
}

function assertAppointmentHasEnded(appointment) {
  if (nowLocalDateTime() < appointment.end_at) {
    throw httpError(409, 'La cita aún no ha terminado');
  }
}

export async function createAppointment(organizationId, body) {
  const payload = body ?? {};
  const clientId = parseRequiredId(payload.clientId, 'clientId');
  const professionalId = parseRequiredId(payload.professionalId, 'professionalId');
  const serviceId = parseRequiredId(payload.serviceId, 'serviceId');
  const startAt = parseStartAt(payload.startAt);
  const id = randomUUID();
  const lockDate = extractLockDate(startAt);

  return withDayLockTransaction(async (session) => {
    await acquireProfessionalDayLock(
      { organizationId, professionalId, date: lockDate },
      { session }
    );

    const client = requireActiveResource(
      await findClientById(organizationId, clientId, { session }),
      'Cliente no encontrado',
      'El cliente no está activo'
    );
    const professional = requireActiveResource(
      await findProfessionalById(organizationId, professionalId, { session }),
      'Profesional no encontrado',
      'El profesional no está activo'
    );
    const service = requireActiveResource(
      await findServiceById(organizationId, serviceId, { session }),
      'Servicio no encontrado',
      'El servicio no está activo'
    );

    if (!(await assignmentExists(organizationId, professional.id, service.id, { session }))) {
      throw httpError(409, 'El profesional no está habilitado para este servicio');
    }

    const endAt = addMinutes(startAt, service.duration_minutes);

    if (!endAt) {
      throw httpError(400, 'startAt debe tener el formato YYYY-MM-DDTHH:mm y ser una fecha real');
    }

    await assertSlotAvailable(
      {
        organizationId,
        professionalId: professional.id,
        startAt,
        endAt,
      },
      { session }
    );

    await insertAppointment(
      {
        id,
        organizationId,
        clientId: client.id,
        professionalId: professional.id,
        serviceId: service.id,
        startAt,
        endAt,
        serviceDurationMinutes: service.duration_minutes,
        servicePriceMinorUnits: service.price_minor_units,
      },
      { session }
    );

    const created = await findById(organizationId, id, { session });
    await createAppointmentEventNotifications(
      {
        organizationId,
        appointment: created,
        eventType: 'CREATED',
      },
      { session }
    );

    return toAppointmentResponse(created);
  });
}

export async function createOwnAppointment(organizationId, clientId, body) {
  return createAppointment(organizationId, {
    clientId,
    professionalId: body?.professionalId,
    serviceId: body?.serviceId,
    startAt: body?.startAt,
  });
}

export async function listAppointments(organizationId, query) {
  const range = parseOptionalDateRange(query);
  const filters = {
    clientId: parseOptionalFilterId(query?.clientId, 'clientId'),
    professionalId: parseOptionalFilterId(query?.professionalId, 'professionalId'),
    serviceId: parseOptionalFilterId(query?.serviceId, 'serviceId'),
    status: parseOptionalStatus(query?.status),
  };

  if (range) {
    filters.rangeStart = range.rangeStart;
    filters.rangeEnd = range.rangeEnd;
  }

  const rows = await findByFilters(organizationId, filters);
  return rows.map(toAppointmentResponse);
}

export async function getAppointment(organizationId, appointmentId) {
  const appointment = await findById(organizationId, appointmentId);

  if (!appointment) {
    throw httpError(404, 'Cita no encontrada');
  }

  return toAppointmentResponse(appointment);
}

export async function confirmAppointment(organizationId, appointmentId) {
  return applyStatusTransition({
    organizationId,
    appointmentId,
    targetStatus: 'CONFIRMADA',
    allowedFrom: ['PROGRAMADA'],
    forbiddenMessage: 'La cita no se puede confirmar',
  });
}

export async function cancelAppointment(organizationId, appointmentId, options = {}) {
  return applyStatusTransition({
    organizationId,
    appointmentId,
    targetStatus: 'CANCELADA',
    allowedFrom: ACTIVE_STATUSES,
    forbiddenMessage: 'La cita no se puede cancelar',
    expectedClientId: options.expectedClientId ?? null,
  });
}

export async function completeAppointment(organizationId, appointmentId, options = {}) {
  return applyStatusTransition({
    organizationId,
    appointmentId,
    targetStatus: 'COMPLETADA',
    allowedFrom: ACTIVE_STATUSES,
    forbiddenMessage: 'La cita no se puede completar',
    extraCheck: assertAppointmentHasEnded,
    expectedProfessionalId: options.expectedProfessionalId ?? null,
  });
}

export async function markNoShowAppointment(organizationId, appointmentId, options = {}) {
  return applyStatusTransition({
    organizationId,
    appointmentId,
    targetStatus: 'NO_ASISTIO',
    allowedFrom: ACTIVE_STATUSES,
    forbiddenMessage: 'La cita no se puede marcar como no asistió',
    extraCheck: assertAppointmentHasEnded,
    expectedProfessionalId: options.expectedProfessionalId ?? null,
  });
}

export async function listAppointmentsByProfessional(organizationId, professionalId, query) {
  const range = parseOptionalDateRange(query);
  const rows = range
    ? await findByProfessionalInRange(organizationId, professionalId, range.rangeStart, range.rangeEnd)
    : await findByProfessional(organizationId, professionalId);

  return rows.map(toAppointmentResponse);
}

export async function listAppointmentsByClient(organizationId, clientId, query) {
  const range = parseOptionalDateRange(query);
  const rows = range
    ? await findByClientInRange(organizationId, clientId, range.rangeStart, range.rangeEnd)
    : await findByClient(organizationId, clientId);

  return rows.map(toAppointmentResponse);
}

export async function rescheduleAppointment(organizationId, appointmentId, body, options = {}) {
  const startAt = parseStartAt(body?.startAt);
  const lockDate = extractLockDate(startAt);

  return withDayLockTransaction(async (session) => {
    const initial = await requireTenantAppointment(organizationId, appointmentId, { session });

    await acquireProfessionalDayLock(
      {
        organizationId,
        professionalId: initial.professional_id,
        date: lockDate,
      },
      { session }
    );

    const appointment = await requireTenantAppointment(organizationId, appointmentId, { session });

    if (options.expectedClientId && appointment.client_id !== options.expectedClientId) {
      throw httpError(404, 'Cita no encontrada');
    }

    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      throw httpError(409, 'La cita no se puede reprogramar');
    }

    await assertActiveBookingResources(organizationId, appointment, { session });

    const endAt = addMinutes(startAt, appointment.service_duration_minutes);

    if (!endAt) {
      throw httpError(400, 'startAt debe tener el formato YYYY-MM-DDTHH:mm y ser una fecha real');
    }

    await assertSlotAvailable(
      {
        organizationId,
        professionalId: appointment.professional_id,
        startAt,
        endAt,
        excludeAppointmentId: appointment.id,
      },
      { session }
    );

    const previousStartAt = appointment.start_at;
    await updateAppointmentSchedule(organizationId, appointmentId, { startAt, endAt }, { session });
    const updated = await findById(organizationId, appointmentId, { session });
    await createAppointmentEventNotifications(
      {
        organizationId,
        appointment: updated,
        eventType: 'RESCHEDULED',
        previousStartAt,
      },
      { session }
    );

    return toAppointmentResponse(updated);
  });
}

const ALLOWED_UPDATE_FIELDS = new Set(['clientId', 'professionalId', 'serviceId']);

function parseUpdateAppointmentBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'Debe enviar al menos un campo modificable (clientId, professionalId o serviceId)');
  }

  const keys = Object.keys(body);

  if (keys.length === 0) {
    throw httpError(400, 'Debe enviar al menos un campo modificable (clientId, professionalId o serviceId)');
  }

  if (Object.prototype.hasOwnProperty.call(body, 'startAt')) {
    throw httpError(400, 'Para cambiar el horario utiliza la operación de reprogramación');
  }

  for (const key of keys) {
    if (!ALLOWED_UPDATE_FIELDS.has(key)) {
      throw httpError(400, `El campo ${key} no se puede modificar en esta operación`);
    }
  }

  const parsed = {};
  if (body.clientId !== undefined) {
    parsed.clientId = parseRequiredId(body.clientId, 'clientId');
  }
  if (body.professionalId !== undefined) {
    parsed.professionalId = parseRequiredId(body.professionalId, 'professionalId');
  }
  if (body.serviceId !== undefined) {
    parsed.serviceId = parseRequiredId(body.serviceId, 'serviceId');
  }

  if (Object.keys(parsed).length === 0) {
    throw httpError(400, 'Debe enviar al menos un campo modificable (clientId, professionalId o serviceId)');
  }

  return parsed;
}

export async function updateAppointment(organizationId, appointmentId, body) {
  const patch = parseUpdateAppointmentBody(body);

  return withDayLockTransaction(async (session) => {
    const initial = await requireTenantAppointment(organizationId, appointmentId, { session });

    const targetProfessionalId = patch.professionalId ?? initial.professional_id;
    const lockDate = extractLockDate(initial.start_at);

    await acquireProfessionalDayLock(
      {
        organizationId,
        professionalId: targetProfessionalId,
        date: lockDate,
      },
      { session }
    );

    const appointment = await requireTenantAppointment(organizationId, appointmentId, { session });

    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      throw httpError(409, 'La cita no se puede modificar en su estado actual');
    }

    const nextClientId = patch.clientId ?? appointment.client_id;
    const nextProfessionalId = patch.professionalId ?? appointment.professional_id;
    const nextServiceId = patch.serviceId ?? appointment.service_id;

    const clientChanged = nextClientId !== appointment.client_id;
    const professionalChanged = nextProfessionalId !== appointment.professional_id;
    const serviceChanged = nextServiceId !== appointment.service_id;

    if (!clientChanged && !professionalChanged && !serviceChanged) {
      return toAppointmentResponse(appointment);
    }

    const client = requireActiveResource(
      await findClientById(organizationId, nextClientId, { session }),
      'Cliente no encontrado',
      'El cliente no está activo'
    );
    const professional = requireActiveResource(
      await findProfessionalById(organizationId, nextProfessionalId, { session }),
      'Profesional no encontrado',
      'El profesional no está activo'
    );
    const service = requireActiveResource(
      await findServiceById(organizationId, nextServiceId, { session }),
      'Servicio no encontrado',
      'El servicio no está activo'
    );

    if (!(await assignmentExists(organizationId, professional.id, service.id, { session }))) {
      throw httpError(409, 'El profesional no está habilitado para este servicio');
    }

    const nextDurationMinutes = serviceChanged
      ? service.duration_minutes
      : appointment.service_duration_minutes;
    const nextPriceMinorUnits = serviceChanged
      ? service.price_minor_units
      : appointment.service_price_minor_units;
    const nextEndAt = serviceChanged
      ? addMinutes(appointment.start_at, nextDurationMinutes)
      : appointment.end_at;

    if (!nextEndAt) {
      throw httpError(400, 'No se pudo calcular el horario de fin de la cita');
    }

    if (professionalChanged || serviceChanged) {
      await assertSlotAvailable(
        {
          organizationId,
          professionalId: professional.id,
          startAt: appointment.start_at,
          endAt: nextEndAt,
          excludeAppointmentId: appointment.id,
        },
        { session }
      );
    }

    await updateBookingDetails(
      organizationId,
      appointmentId,
      {
        clientId: client.id,
        professionalId: professional.id,
        serviceId: service.id,
        endAt: nextEndAt,
        serviceDurationMinutes: nextDurationMinutes,
        servicePriceMinorUnits: nextPriceMinorUnits,
      },
      { session }
    );

    const updated = await findById(organizationId, appointmentId, { session });

    await createAppointmentEventNotifications(
      {
        organizationId,
        appointment: updated,
        eventType: 'UPDATED',
        previousClientId: clientChanged ? appointment.client_id : null,
        previousProfessionalId: professionalChanged ? appointment.professional_id : null,
      },
      { session }
    );

    return toAppointmentResponse(updated);
  });
}
