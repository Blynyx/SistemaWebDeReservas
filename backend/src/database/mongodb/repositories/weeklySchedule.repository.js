import { getMongoDb } from '../client.js';
import { mapWeeklyScheduleToLegacy, requireOrganizationId } from './mappers.js';

const COLLECTION = 'weeklySchedules';

function collection() {
  return getMongoDb().collection(COLLECTION);
}

export async function insertSchedule(
  { id, organizationId, professionalId, dayOfWeek, startTime, endTime },
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const now = new Date().toISOString();

  await collection().insertOne(
    {
      id,
      organizationId,
      professionalId,
      dayOfWeek,
      startTime,
      endTime,
      createdAt: now,
      updatedAt: now,
    },
    { session }
  );
}

export async function findById(organizationId, professionalId, scheduleId, { session } = {}) {
  requireOrganizationId(organizationId);
  const doc = await collection().findOne(
    { organizationId, professionalId, id: scheduleId },
    { projection: { _id: 0 }, session }
  );
  return mapWeeklyScheduleToLegacy(doc);
}

export async function findAllByProfessional(organizationId, professionalId, { session } = {}) {
  requireOrganizationId(organizationId);
  const docs = await collection()
    .find({ organizationId, professionalId }, { projection: { _id: 0 }, session })
    .sort({ dayOfWeek: 1, startTime: 1 })
    .toArray();
  return docs.map(mapWeeklyScheduleToLegacy);
}

export async function findByProfessionalAndDay(
  organizationId,
  professionalId,
  dayOfWeek,
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const docs = await collection()
    .find({ organizationId, professionalId, dayOfWeek }, { projection: { _id: 0 }, session })
    .sort({ startTime: 1 })
    .toArray();
  return docs.map(mapWeeklyScheduleToLegacy);
}

export async function findCoveringSchedule(
  organizationId,
  professionalId,
  dayOfWeek,
  startTime,
  endTime,
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const doc = await collection().findOne(
    {
      organizationId,
      professionalId,
      dayOfWeek,
      startTime: { $lte: startTime },
      endTime: { $gte: endTime },
    },
    { projection: { _id: 0 }, session }
  );
  return mapWeeklyScheduleToLegacy(doc);
}

export async function hasOverlap(
  {
    organizationId,
    professionalId,
    dayOfWeek,
    startTime,
    endTime,
    excludeScheduleId = null,
  },
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const filter = {
    organizationId,
    professionalId,
    dayOfWeek,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };

  if (excludeScheduleId !== null && excludeScheduleId !== undefined) {
    filter.id = { $ne: excludeScheduleId };
  }

  const doc = await collection().findOne(filter, { projection: { _id: 0, id: 1 }, session });
  return Boolean(doc);
}

export async function updateSchedule(
  organizationId,
  professionalId,
  scheduleId,
  fields,
  { session } = {}
) {
  requireOrganizationId(organizationId);
  await collection().updateOne(
    { organizationId, professionalId, id: scheduleId },
    {
      $set: {
        dayOfWeek: fields.dayOfWeek,
        startTime: fields.startTime,
        endTime: fields.endTime,
        updatedAt: fields.updatedAt ?? new Date().toISOString(),
      },
    },
    { session }
  );
}

export async function removeSchedule(organizationId, professionalId, scheduleId, { session } = {}) {
  requireOrganizationId(organizationId);
  await collection().deleteOne({ organizationId, professionalId, id: scheduleId }, { session });
}
