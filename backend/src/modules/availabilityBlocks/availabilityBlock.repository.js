import { getDb } from '../../database/connection.js';

const BLOCK_COLUMNS = `
  id,
  organization_id,
  professional_id,
  start_at,
  end_at,
  reason,
  created_at,
  updated_at
`;

export function insertBlock({
  id,
  organizationId,
  professionalId,
  startAt,
  endAt,
  reason,
}) {
  getDb()
    .prepare(
      `
        INSERT INTO availability_blocks (
          id,
          organization_id,
          professional_id,
          start_at,
          end_at,
          reason
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(id, organizationId, professionalId, startAt, endAt, reason);
}

export function findById(organizationId, professionalId, blockId) {
  return getDb()
    .prepare(
      `
        SELECT ${BLOCK_COLUMNS}
        FROM availability_blocks
        WHERE organization_id = ?
          AND professional_id = ?
          AND id = ?
      `
    )
    .get(organizationId, professionalId, blockId);
}

export function findAllByProfessional(organizationId, professionalId) {
  return getDb()
    .prepare(
      `
        SELECT ${BLOCK_COLUMNS}
        FROM availability_blocks
        WHERE organization_id = ?
          AND professional_id = ?
        ORDER BY start_at
      `
    )
    .all(organizationId, professionalId);
}

// Misma condición de intersección que usará el cálculo de disponibilidad.
export function findByProfessionalInRange(organizationId, professionalId, rangeStart, rangeEnd) {
  return getDb()
    .prepare(
      `
        SELECT ${BLOCK_COLUMNS}
        FROM availability_blocks
        WHERE organization_id = ?
          AND professional_id = ?
          AND start_at < ?
          AND end_at > ?
        ORDER BY start_at
      `
    )
    .all(organizationId, professionalId, rangeEnd, rangeStart);
}

export function hasOverlap({
  organizationId,
  professionalId,
  startAt,
  endAt,
  excludeBlockId = null,
}) {
  const row = getDb()
    .prepare(
      `
        SELECT 1 AS found
        FROM availability_blocks
        WHERE organization_id = ?
          AND professional_id = ?
          AND start_at < ?
          AND end_at > ?
          AND (? IS NULL OR id != ?)
      `
    )
    .get(organizationId, professionalId, endAt, startAt, excludeBlockId, excludeBlockId);

  return Boolean(row);
}

export function updateBlock(organizationId, professionalId, blockId, fields) {
  getDb()
    .prepare(
      `
        UPDATE availability_blocks
        SET start_at = ?,
            end_at = ?,
            reason = ?,
            updated_at = ?
        WHERE organization_id = ?
          AND professional_id = ?
          AND id = ?
      `
    )
    .run(
      fields.startAt,
      fields.endAt,
      fields.reason,
      fields.updatedAt,
      organizationId,
      professionalId,
      blockId
    );
}

export function removeBlock(organizationId, professionalId, blockId) {
  getDb()
    .prepare(
      `
        DELETE FROM availability_blocks
        WHERE organization_id = ?
          AND professional_id = ?
          AND id = ?
      `
    )
    .run(organizationId, professionalId, blockId);
}
