import { httpError } from '../../utils/httpError.js';
import {
  getDayOfWeekFromDate,
  nextDay,
  parseLocalDate,
} from '../../utils/datetime.js';
import { findById as findServiceById } from '../services/service.repository.js';
import { findById as findProfessionalById } from '../professionals/professional.repository.js';
import {
  assignmentExists,
  findProfessionalsByService,
} from '../professionalServices/professionalService.repository.js';
import { findByProfessionalAndDay } from '../weeklySchedules/weeklySchedule.repository.js';
import { findByProfessionalInRange as findBlocksInRange } from '../availabilityBlocks/availabilityBlock.repository.js';
import { findActiveByProfessionalInRange } from '../appointments/appointment.repository.js';

export const SLOT_STEP_MINUTES = 30;

// Esta consulta es una foto del estado actual.
// Entre GET /availability y POST /appointments otro usuario
// podría tomar el mismo hueco. El booking sigue revalidando
// dentro de BEGIN IMMEDIATE.

function parseRequiredQueryString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw httpError(400, `${fieldName} es obligatorio`);
  }

  return value.trim();
}

function parseDate(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw httpError(400, 'date es obligatorio');
  }

  const parsed = parseLocalDate(value);

  if (!parsed) {
    throw httpError(400, 'date debe tener el formato YYYY-MM-DD y ser una fecha real');
  }

  return parsed.value;
}

function parseOptionalProfessionalId(value) {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    throw httpError(400, 'professionalId es obligatorio');
  }

  return value.trim();
}

function requireActiveService(organizationId, serviceId) {
  const service = findServiceById(organizationId, serviceId);

  if (!service) {
    throw httpError(404, 'Servicio no encontrado');
  }

  if (service.is_active !== 1) {
    throw httpError(409, 'El servicio no está activo');
  }

  return service;
}

function requireAssignedProfessional(organizationId, professionalId, serviceId) {
  const professional = findProfessionalById(organizationId, professionalId);

  if (!professional) {
    throw httpError(404, 'Profesional no encontrado');
  }

  if (professional.is_active !== 1) {
    throw httpError(409, 'El profesional no está activo');
  }

  if (!assignmentExists(organizationId, professional.id, serviceId)) {
    throw httpError(409, 'El profesional no está habilitado para este servicio');
  }

  return professional;
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function minutesToTime(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function generateCandidates(date, startTime, endTime, durationMinutes) {
  const scheduleStart = timeToMinutes(startTime);
  const scheduleEnd = timeToMinutes(endTime);
  const slots = [];
  let candidateStart = scheduleStart;

  while (candidateStart + durationMinutes <= scheduleEnd) {
    slots.push({
      startAt: `${date}T${minutesToTime(candidateStart)}`,
      endAt: `${date}T${minutesToTime(candidateStart + durationMinutes)}`,
    });
    candidateStart += SLOT_STEP_MINUTES;
  }

  return slots;
}

function computeProfessionalSlots({
  organizationId,
  professionalId,
  date,
  dayOfWeek,
  durationMinutes,
  rangeStart,
  rangeEnd,
}) {
  const schedules = findByProfessionalAndDay(organizationId, professionalId, dayOfWeek);
  const blocks = findBlocksInRange(organizationId, professionalId, rangeStart, rangeEnd);
  const appointments = findActiveByProfessionalInRange(
    organizationId,
    professionalId,
    rangeStart,
    rangeEnd
  );

  const candidates = [];

  for (const schedule of schedules) {
    candidates.push(
      ...generateCandidates(date, schedule.start_time, schedule.end_time, durationMinutes)
    );
  }

  return candidates
    .filter(
      (slot) =>
        !blocks.some((block) =>
          intervalsOverlap(block.start_at, block.end_at, slot.startAt, slot.endAt)
        ) &&
        !appointments.some((appointment) =>
          intervalsOverlap(appointment.start_at, appointment.end_at, slot.startAt, slot.endAt)
        )
    )
    .sort((left, right) => left.startAt.localeCompare(right.startAt));
}

export function getAvailability(organizationId, query) {
  const payload = query ?? {};
  const serviceId = parseRequiredQueryString(payload.serviceId, 'serviceId');
  const date = parseDate(payload.date);
  const professionalId = parseOptionalProfessionalId(payload.professionalId);
  const service = requireActiveService(organizationId, serviceId);

  const professionals = professionalId
    ? [requireAssignedProfessional(organizationId, professionalId, service.id)]
    : findProfessionalsByService(organizationId, service.id).filter(
        (professional) => professional.is_active === 1
      );

  const dayOfWeek = getDayOfWeekFromDate(date);
  const rangeStart = `${date}T00:00`;
  const rangeEnd = `${nextDay(date)}T00:00`;

  return {
    date,
    slotStepMinutes: SLOT_STEP_MINUTES,
    service: {
      id: service.id,
      name: service.name,
      durationMinutes: service.duration_minutes,
      priceMinorUnits: service.price_minor_units,
    },
    professionals: professionals
      .map((professional) => ({
        id: professional.id,
        name: professional.name,
        slots: computeProfessionalSlots({
          organizationId,
          professionalId: professional.id,
          date,
          dayOfWeek,
          durationMinutes: service.duration_minutes,
          rangeStart,
          rangeEnd,
        }),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}
