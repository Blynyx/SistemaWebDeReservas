import { randomUUID } from 'node:crypto';
import { findById as findProfessionalById } from '../professionals/professional.repository.js';
import { httpError } from '../../utils/httpError.js';
import {
  findAllByProfessional,
  findById,
  hasOverlap,
  insertBlock,
  removeBlock,
  updateBlock,
} from './availabilityBlock.repository.js';

const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d$/;

function toBlockResponse(row) {
  return {
    id: row.id,
    professionalId: row.professional_id,
    startAt: row.start_at,
    endAt: row.end_at,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireTenantProfessional(organizationId, professionalId) {
  const professional = await findProfessionalById(organizationId, professionalId);

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

function parseDateTime(value, fieldName) {
  if (typeof value !== 'string' || !DATETIME_PATTERN.test(value)) {
    throw httpError(400, `${fieldName} debe tener el formato YYYY-MM-DDTHH:mm`);
  }

  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));

  // Date convierte fechas imposibles (p. ej. 30 de febrero) en otro día.
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute
  ) {
    throw httpError(400, `${fieldName} no es una fecha u hora válida`);
  }

  return value;
}

function parseReason(reason, { required }) {
  if (reason === undefined) {
    return required ? null : undefined;
  }

  if (reason === null) {
    return null;
  }

  if (typeof reason !== 'string') {
    throw httpError(400, 'El motivo debe ser texto');
  }

  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateInterval(startAt, endAt) {
  const parsedStart = parseDateTime(startAt, 'startAt');
  const parsedEnd = parseDateTime(endAt, 'endAt');

  if (parsedStart >= parsedEnd) {
    throw httpError(400, 'startAt debe ser menor que endAt');
  }

  return {
    startAt: parsedStart,
    endAt: parsedEnd,
  };
}

async function assertNoOverlap({
  organizationId,
  professionalId,
  startAt,
  endAt,
  excludeBlockId = null,
}) {
  if (
    await hasOverlap({
      organizationId,
      professionalId,
      startAt,
      endAt,
      excludeBlockId,
    })
  ) {
    throw httpError(409, 'El bloque se solapa con otro período de indisponibilidad');
  }
}

export async function createAvailabilityBlock(organizationId, professionalId, body) {
  const professional = await requireTenantProfessional(organizationId, professionalId);
  requireActiveProfessional(professional);

  const interval = validateInterval(body?.startAt, body?.endAt);
  const reason = parseReason(body?.reason, { required: true });

  await assertNoOverlap({
    organizationId,
    professionalId,
    ...interval,
  });

  const id = randomUUID();

  await insertBlock({
    id,
    organizationId,
    professionalId,
    ...interval,
    reason,
  });

  return toBlockResponse(await findById(organizationId, professionalId, id));
}

export async function listAvailabilityBlocks(organizationId, professionalId) {
  await requireTenantProfessional(organizationId, professionalId);

  const blocks = await findAllByProfessional(organizationId, professionalId);
  return blocks.map(toBlockResponse);
}

export async function patchAvailabilityBlock(organizationId, professionalId, blockId, body) {
  const payload = body ?? {};
  const hasUpdatableField = ['startAt', 'endAt', 'reason'].some(
    (field) => payload[field] !== undefined
  );

  if (!hasUpdatableField) {
    throw httpError(400, 'Debe enviar al menos un campo modificable');
  }

  const professional = await requireTenantProfessional(organizationId, professionalId);
  requireActiveProfessional(professional);

  const current = await findById(organizationId, professionalId, blockId);

  if (!current) {
    throw httpError(404, 'Bloque de disponibilidad no encontrado');
  }

  const interval = validateInterval(
    payload.startAt ?? current.start_at,
    payload.endAt ?? current.end_at
  );
  const reason =
    payload.reason !== undefined
      ? parseReason(payload.reason, { required: false })
      : current.reason;

  await assertNoOverlap({
    organizationId,
    professionalId,
    ...interval,
    excludeBlockId: blockId,
  });

  await updateBlock(organizationId, professionalId, blockId, {
    ...interval,
    reason,
    updatedAt: new Date().toISOString(),
  });

  return toBlockResponse(await findById(organizationId, professionalId, blockId));
}

export async function removeAvailabilityBlock(organizationId, professionalId, blockId) {
  await requireTenantProfessional(organizationId, professionalId);
  await removeBlock(organizationId, professionalId, blockId);
}
