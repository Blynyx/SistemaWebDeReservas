import { randomUUID } from 'node:crypto';
import { findById as findProfessionalById } from '../professionals/professional.repository.js';
import { httpError } from '../../utils/httpError.js';
import {
  findAllByProfessional,
  findById,
  hasOverlap,
  insertSchedule,
  removeSchedule,
  updateSchedule,
} from './weeklySchedule.repository.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function toScheduleResponse(row) {
  return {
    id: row.id,
    professionalId: row.professional_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireTenantProfessional(organizationId, professionalId) {
  const professional = findProfessionalById(organizationId, professionalId);

  if (!professional) {
    throw httpError(404, 'Profesional no encontrado');
  }

  return professional;
}

function requireActiveProfessional(professional) {
  if (professional.is_active !== 1) {
    throw httpError(409, 'El profesional no está activo');
  }
}

function parseDayOfWeek(value) {
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    throw httpError(400, 'El día de la semana debe ser un entero entre 1 y 7');
  }

  return value;
}

function parseTime(value, fieldName) {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
    throw httpError(400, `${fieldName} debe tener el formato HH:mm`);
  }

  return value;
}

function validateInterval(dayOfWeek, startTime, endTime) {
  const parsedDay = parseDayOfWeek(dayOfWeek);
  const parsedStart = parseTime(startTime, 'startTime');
  const parsedEnd = parseTime(endTime, 'endTime');

  if (parsedStart >= parsedEnd) {
    throw httpError(400, 'startTime debe ser menor que endTime');
  }

  return {
    dayOfWeek: parsedDay,
    startTime: parsedStart,
    endTime: parsedEnd,
  };
}

function assertNoOverlap({
  organizationId,
  professionalId,
  dayOfWeek,
  startTime,
  endTime,
  excludeScheduleId = null,
}) {
  if (
    hasOverlap({
      organizationId,
      professionalId,
      dayOfWeek,
      startTime,
      endTime,
      excludeScheduleId,
    })
  ) {
    throw httpError(409, 'El intervalo se solapa con otro horario del mismo día');
  }
}

export function createWeeklySchedule(organizationId, professionalId, body) {
  const professional = requireTenantProfessional(organizationId, professionalId);
  requireActiveProfessional(professional);

  const interval = validateInterval(body?.dayOfWeek, body?.startTime, body?.endTime);

  assertNoOverlap({
    organizationId,
    professionalId,
    ...interval,
  });

  const id = randomUUID();

  insertSchedule({
    id,
    organizationId,
    professionalId,
    ...interval,
  });

  return toScheduleResponse(findById(organizationId, professionalId, id));
}

export function listWeeklySchedules(organizationId, professionalId) {
  requireTenantProfessional(organizationId, professionalId);

  return findAllByProfessional(organizationId, professionalId).map(toScheduleResponse);
}

export function patchWeeklySchedule(organizationId, professionalId, scheduleId, body) {
  const payload = body ?? {};
  const hasUpdatableField = ['dayOfWeek', 'startTime', 'endTime'].some(
    (field) => payload[field] !== undefined
  );

  if (!hasUpdatableField) {
    throw httpError(400, 'Debe enviar al menos un campo modificable');
  }

  const professional = requireTenantProfessional(organizationId, professionalId);
  requireActiveProfessional(professional);

  const current = findById(organizationId, professionalId, scheduleId);

  if (!current) {
    throw httpError(404, 'Horario no encontrado');
  }

  const interval = validateInterval(
    payload.dayOfWeek ?? current.day_of_week,
    payload.startTime ?? current.start_time,
    payload.endTime ?? current.end_time
  );

  assertNoOverlap({
    organizationId,
    professionalId,
    ...interval,
    excludeScheduleId: scheduleId,
  });

  updateSchedule(organizationId, professionalId, scheduleId, {
    ...interval,
    updatedAt: new Date().toISOString(),
  });

  return toScheduleResponse(findById(organizationId, professionalId, scheduleId));
}

export function removeWeeklySchedule(organizationId, professionalId, scheduleId) {
  requireTenantProfessional(organizationId, professionalId);
  removeSchedule(organizationId, professionalId, scheduleId);
}
