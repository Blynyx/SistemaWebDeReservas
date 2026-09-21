import { randomUUID } from 'node:crypto';
import { runInImmediateTransaction } from '../../database/transaction.js';
import { httpError } from '../../utils/httpError.js';
import {
  addMinutes,
  getDatePart,
  getDayOfWeek,
  getTimePart,
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
  findById,
  hasActiveOverlap,
  insertAppointment,
} from './appointment.repository.js';

function toAppointmentResponse(row) {
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

    if (!endAt || getDatePart(startAt) !== getDatePart(endAt)) {
      throw httpError(409, 'La cita debe comenzar y terminar el mismo día');
    }

    const coveringSchedule = findCoveringSchedule(
      organizationId,
      professional.id,
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
        professionalId: professional.id,
        startAt,
        endAt,
      })
    ) {
      throw httpError(409, 'La cita intersecta un bloque de indisponibilidad');
    }

    if (hasActiveOverlap(organizationId, professional.id, startAt, endAt)) {
      throw httpError(409, 'El profesional ya tiene una cita en ese horario');
    }

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

export function listAppointments(organizationId) {
  return findAllByOrganization(organizationId).map(toAppointmentResponse);
}

export function getAppointment(organizationId, appointmentId) {
  const appointment = findById(organizationId, appointmentId);

  if (!appointment) {
    throw httpError(404, 'Cita no encontrada');
  }

  return toAppointmentResponse(appointment);
}
