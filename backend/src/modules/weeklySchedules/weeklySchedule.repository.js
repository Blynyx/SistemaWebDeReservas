import { getDb } from '../../database/connection.js';

const SCHEDULE_COLUMNS = `
  id,
  organization_id,
  professional_id,
  day_of_week,
  start_time,
  end_time,
  created_at,
  updated_at
`;

export function insertSchedule({
  id,
  organizationId,
  professionalId,
  dayOfWeek,
  startTime,
  endTime,
}) {
  getDb()
    .prepare(
      `
        INSERT INTO weekly_schedules (
          id,
          organization_id,
          professional_id,
          day_of_week,
          start_time,
          end_time
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(id, organizationId, professionalId, dayOfWeek, startTime, endTime);
}

export function findById(organizationId, professionalId, scheduleId) {
  return getDb()
    .prepare(
      `
        SELECT ${SCHEDULE_COLUMNS}
        FROM weekly_schedules
        WHERE organization_id = ?
          AND professional_id = ?
          AND id = ?
      `
    )
    .get(organizationId, professionalId, scheduleId);
}

export function findAllByProfessional(organizationId, professionalId) {
  return getDb()
    .prepare(
      `
        SELECT ${SCHEDULE_COLUMNS}
        FROM weekly_schedules
        WHERE organization_id = ?
          AND professional_id = ?
        ORDER BY day_of_week, start_time
      `
    )
    .all(organizationId, professionalId);
}

export function findCoveringSchedule(organizationId, professionalId, dayOfWeek, startTime, endTime) {
  return getDb()
    .prepare(
      `
        SELECT ${SCHEDULE_COLUMNS}
        FROM weekly_schedules
        WHERE organization_id = ?
          AND professional_id = ?
          AND day_of_week = ?
          AND start_time <= ?
          AND end_time >= ?
        LIMIT 1
      `
    )
    .get(organizationId, professionalId, dayOfWeek, startTime, endTime);
}

export function hasOverlap({
  organizationId,
  professionalId,
  dayOfWeek,
  startTime,
  endTime,
  excludeScheduleId = null,
}) {
  const row = getDb()
    .prepare(
      `
        SELECT 1 AS found
        FROM weekly_schedules
        WHERE organization_id = ?
          AND professional_id = ?
          AND day_of_week = ?
          AND start_time < ?
          AND end_time > ?
          AND (? IS NULL OR id != ?)
      `
    )
    .get(
      organizationId,
      professionalId,
      dayOfWeek,
      endTime,
      startTime,
      excludeScheduleId,
      excludeScheduleId
    );

  return Boolean(row);
}

export function updateSchedule(organizationId, professionalId, scheduleId, fields) {
  getDb()
    .prepare(
      `
        UPDATE weekly_schedules
        SET day_of_week = ?,
            start_time = ?,
            end_time = ?,
            updated_at = ?
        WHERE organization_id = ?
          AND professional_id = ?
          AND id = ?
      `
    )
    .run(
      fields.dayOfWeek,
      fields.startTime,
      fields.endTime,
      fields.updatedAt,
      organizationId,
      professionalId,
      scheduleId
    );
}

export function removeSchedule(organizationId, professionalId, scheduleId) {
  getDb()
    .prepare(
      `
        DELETE FROM weekly_schedules
        WHERE organization_id = ?
          AND professional_id = ?
          AND id = ?
      `
    )
    .run(organizationId, professionalId, scheduleId);
}
