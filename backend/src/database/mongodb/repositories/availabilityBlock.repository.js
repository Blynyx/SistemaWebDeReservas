import { getMongoDb } from '../client.js';
import { mapAvailabilityBlockToLegacy, requireOrganizationId } from './mappers.js';

const COLLECTION = 'availabilityBlocks';

function collection() {
  return getMongoDb().collection(COLLECTION);
}

export async function insertBlock(
  { id, organizationId, professionalId, startAt, endAt, reason },
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const now = new Date().toISOString();

  await collection().insertOne(
    {
      id,
      organizationId,
      professionalId,
      startAt,
      endAt,
      reason: reason ?? null,
      createdAt: now,
      updatedAt: now,
    },
    { session }
  );
}

export async function findById(organizationId, professionalId, blockId, { session } = {}) {
  requireOrganizationId(organizationId);
  const doc = await collection().findOne(
    { organizationId, professionalId, id: blockId },
    { projection: { _id: 0 }, session }
  );
  return mapAvailabilityBlockToLegacy(doc);
}

export async function findAllByProfessional(organizationId, professionalId, { session } = {}) {
  requireOrganizationId(organizationId);
  const docs = await collection()
    .find({ organizationId, professionalId }, { projection: { _id: 0 }, session })
    .sort({ startAt: 1 })
    .toArray();
  return docs.map(mapAvailabilityBlockToLegacy);
}

export async function findByProfessionalInRange(
  organizationId,
  professionalId,
  rangeStart,
  rangeEnd,
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const docs = await collection()
    .find(
      {
        organizationId,
        professionalId,
        startAt: { $lt: rangeEnd },
        endAt: { $gt: rangeStart },
      },
      { projection: { _id: 0 }, session }
    )
    .sort({ startAt: 1 })
    .toArray();
  return docs.map(mapAvailabilityBlockToLegacy);
}

export async function hasOverlap(
  {
    organizationId,
    professionalId,
    startAt,
    endAt,
    excludeBlockId = null,
  },
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const filter = {
    organizationId,
    professionalId,
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  };

  if (excludeBlockId !== null && excludeBlockId !== undefined) {
    filter.id = { $ne: excludeBlockId };
  }

  const doc = await collection().findOne(filter, { projection: { _id: 0, id: 1 }, session });
  return Boolean(doc);
}

export async function updateBlock(
  organizationId,
  professionalId,
  blockId,
  fields,
  { session } = {}
) {
  requireOrganizationId(organizationId);
  await collection().updateOne(
    { organizationId, professionalId, id: blockId },
    {
      $set: {
        startAt: fields.startAt,
        endAt: fields.endAt,
        reason: fields.reason ?? null,
        updatedAt: fields.updatedAt ?? new Date().toISOString(),
      },
    },
    { session }
  );
}

export async function removeBlock(organizationId, professionalId, blockId, { session } = {}) {
  requireOrganizationId(organizationId);
  await collection().deleteOne({ organizationId, professionalId, id: blockId }, { session });
}
