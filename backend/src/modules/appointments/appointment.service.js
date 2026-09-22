import { randomUUID } from 'node:crypto';
import { runInImmediateTransaction } from '../../database/transaction.js';
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
import { findCoveringSchedule } from '../weeklySchedules/weeklySchedule.repository.js';
import {
  findAllByOrganization,
  findByClient,
  findByClientInRange,
  findById,
  findByProfessional,
  findByProfessionalInRange,
  hasActiveOverlap,
  insertAppointment,
  reschedule as updateAppointmentSchedule,
  updateStatus,
} from './appointment.repository.js';

const ACTIVE_STATUSES = ['PROGRAMADA', 'CONFIRMADA'];

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

function requireTenantAppointment(organizationId, appointmentId) {
  const appointment = findById(organizationId, appointmentId);

  if (!appointment) {
    throw httpError(404, 'Cita no encontrada');
  }

  return appointment;
}

function assertActiveBookingResources(organizationId, appointment) {
  requireActiveResource(
    findClientById(organizationId, appointment.client_id),
    'Cliente no encontrado',
    'El cliente no está activo'
  );
  requireActiveResource(
    findProfessionalById(organizationId, appointment.professional_id),
    'Profesional no encontrado',
    'El profesional no está activo'
  );
  requireActiveResource(
    findServiceById(organizationId, appointment.service_id),
    'Servicio no encontrado',
    'El servicio no está activo'
  );

  if (!assignmentExists(organizationId, appointment.professional_id, appointment.service_id)) {
    throw httpError(409, 'El profesional no está habilitado para este servicio');
  }
}

function assertSlotAvailable({
  organizationId,
  professionalId,
  startAt,
  endAt,
  excludeAppointmentId = null,
}) {
  if (getDatePart(startAt) !== getDatePart(endAt)) {
    throw httpError(409, 'La cita debe comenzar y terminar el mismo día');
  }

  const coveringSchedule = findCoveringSchedule(
    organizationId,
    professionalId,
    getDayOfWeek(startAt),
    getTimePart(startAt),
    getTimePart(endAt)
  );

  if (!coveringSchedule) {
    throw httpError(409, 'La cita no cabe en el horario semanal del profesional');
  }

  if (
    hasAvailabilityBlockOverlap({
      organizationId,
      professionalId,
      startAt,
      endAt,
    })
  ) {
    throw httpError(409, 'La cita intersecta un bloque de indisponibilidad');
  }

  if (
    hasActiveOverlap({
      organizationId,
      professionalId,
      startAt,
      endAt,
      excludeAppointmentId,
    })
  ) {
    throw httpError(409, 'El profesional ya tiene una cita en ese horario');
  }
}

function applyStatusTransition({
  organizationId,
  appointmentId,
  targetStatus,
  allowedFrom,
  forbiddenMessage,
  extraCheck,
  expectedProfessionalId = null,
  expectedClientId = null,
}) {
  return runInImmediateTransaction(() => {
    const appointment = requireTenantAppointment(organizationId, appointmentId);

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

    updateStatus(organizationId, appointmentId, targetStatus);
    return toAppointmentResponse(findById(organizationId, appointmentId));
  });
}

function assertAppointmentHasEnded(appointment) {
  if (nowLocalDateTime() < appointment.end_at) {
    throw httpError(409, 'La cita aún no ha terminado');
  }
}

export function createAppointment(organizationId, body) {
  const payload = body ?? {};
  const clientId = parseRequiredId(payload.clientId, 'clientId');
  const professionalId = parseRequiredId(payload.professionalId, 'professionalId');
  const serviceId = parseRequiredId(payload.serviceId, 'serviceId');
  const startAt = parseStartAt(payload.startAt);

  return runInImmediateTransaction(() => {
    const client = requireActiveResource(
      findClientById(organizationId, clientId),
      'Cliente no encontrado',
      'El cliente no está activo'
    );
    const professional = requireActiveResource(
      findProfessionalById(organizationId, professionalId),
      'Profesional no encontrado',
      'El profesional no está activo'
    );
    const service = requireActiveResource(
      findServiceById(organizationId, serviceId),
      'Servicio no encontrado',
      'El servicio no está activo'
    );

    if (!assignmentExists(organizationId, professional.id, service.id)) {
      throw httpError(409, 'El profesional no está habilitado para este servicio');
    }

    const endAt = addMinutes(startAt, service.duration_minutes);

    if (!endAt) {
      throw httpError(400, 'startAt debe tener el formato YYYY-MM-DDTHH:mm y ser una fecha real');
    }

    assertSlotAvailable({
      organizationId,
      professionalId: professional.id,
      startAt,
      endAt,
    });

    const id = randomUUID();

    insertAppointment({
      id,
      organizationId,
      clientId: client.id,
      professionalId: professional.id,
      serviceId: service.id,
      startAt,
      endAt,
      serviceDurationMinutes: service.duration_minutes,
      servicePriceMinorUnits: service.price_minor_units,
    });

    return toAppointmentResponse(findById(organizationId, id));
  });
}

export function createOwnAppointment(organizationId, clientId, body) {
  return createAppointment(organizationId, {
    clientId,
    professionalId: body?.professionalId,
    serviceId: body?.serviceId,
    startAt: body?.startAt,
  });
}

export function listAppointments(organizationId) {
  return findAllByOrganization(organizationId).map(toAppointmentResponse);
}

export function getAppointment(organizationId, appointmentId) {
  return toAppointmentResponse(requireTenantAppointment(organizationId, appointmentId));
}

export function confirmAppointment(organizationId, appointmentId) {
  return applyStatusTransition({
    organizationId,
    appointmentId,
    targetStatus: 'CONFIRMADA',
    allowedFrom: ['PROGRAMADA'],
    forbiddenMessage: 'La cita no se puede confirmar',
  });
}

export function cancelAppointment(organizationId, appointmentId, options = {}) {
  return applyStatusTransition({
    organizationId,
    appointmentId,
    targetStatus: 'CANCELADA',
    allowedFrom: ACTIVE_STATUSES,
    forbiddenMessage: 'La cita no se puede cancelar',
    expectedClientId: options.expectedClientId ?? null,
  });
}

export function completeAppointment(organizationId, appointmentId, options = {}) {
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

export function markNoShowAppointment(organizationId, appointmentId, options = {}) {
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

export function listAppointmentsByProfessional(organizationId, professionalId, query) {
  const range = parseOptionalDateRange(query);
  const rows = range
    ? findByProfessionalInRange(organizationId, professionalId, range.rangeStart, range.rangeEnd)
    : findByProfessional(organizationId, professionalId);

  return rows.map(toAppointmentResponse);
}

export function listAppointmentsByClient(organizationId, clientId, query) {
  const range = parseOptionalDateRange(query);
  const rows = range
    ? findByClientInRange(organizationId, clientId, range.rangeStart, range.rangeEnd)
    : findByClient(organizationId, clientId);

  return rows.map(toAppointmentResponse);
}

export function rescheduleAppointment(organizationId, appointmentId, body, options = {}) {
  const startAt = parseStartAt(body?.startAt);

  return runInImmediateTransaction(() => {
    const appointment = requireTenantAppointment(organizationId, appointmentId);

    if (options.expectedClientId && appointment.client_id !== options.expectedClientId) {
      throw httpError(404, 'Cita no encontrada');
    }

    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      throw httpError(409, 'La cita no se puede reprogramar');
    }

    assertActiveBookingResources(organizationId, appointment);

    const endAt = addMinutes(startAt, appointment.service_duration_minutes);

    if (!endAt) {
      throw httpError(400, 'startAt debe tener el formato YYYY-MM-DDTHH:mm y ser una fecha real');
    }

    assertSlotAvailable({
      organizationId,
      professionalId: appointment.professional_id,
      startAt,
      endAt,
      excludeAppointmentId: appointment.id,
    });

    updateAppointmentSchedule(organizationId, appointmentId, { startAt, endAt });
    return toAppointmentResponse(findById(organizationId, appointmentId));
  });
}
