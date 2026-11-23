import { getMongoDb } from '../client.js';
import { mapServiceToLegacy, requireOrganizationId } from './mappers.js';

const COLLECTION = 'services';

function collection() {
  return getMongoDb().collection(COLLECTION);
}

export async function insertService(
  { id, organizationId, name, description, durationMinutes, priceMinorUnits },
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const now = new Date().toISOString();

  await collection().insertOne(
    {
      id,
      organizationId,
      name,
      description: description ?? null,
      durationMinutes,
      priceMinorUnits,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    { session }
  );
}

export async function findById(organizationId, serviceId, { session } = {}) {
  requireOrganizationId(organizationId);
  const doc = await collection().findOne(
    { organizationId, id: serviceId },
    { projection: { _id: 0 }, session }
  );
  return mapServiceToLegacy(doc);
}

export async function findAllByOrganization(organizationId, { session } = {}) {
  requireOrganizationId(organizationId);
  const docs = await collection()
    .find({ organizationId }, { projection: { _id: 0 }, session })
    .sort({ name: 1 })
    .toArray();
  return docs.map(mapServiceToLegacy);
}

export async function updateService(organizationId, serviceId, fields, { session } = {}) {
  requireOrganizationId(organizationId);
  const updates = {
    updatedAt: fields.updatedAt ?? new Date().toISOString(),
  };

  if (fields.name !== undefined) {
    updates.name = fields.name;
  }
  if (fields.description !== undefined) {
    updates.description = fields.description;
  }
  if (fields.durationMinutes !== undefined) {
    updates.durationMinutes = fields.durationMinutes;
  }
  if (fields.priceMinorUnits !== undefined) {
    updates.priceMinorUnits = fields.priceMinorUnits;
  }

  await collection().updateOne(
    { organizationId, id: serviceId },
    { $set: updates },
    { session }
  );
}

export async function deactivateService(organizationId, serviceId, updatedAt, { session } = {}) {
  requireOrganizationId(organizationId);
  await collection().updateOne(
    { organizationId, id: serviceId },
    {
      $set: {
        isActive: false,
        updatedAt: updatedAt ?? new Date().toISOString(),
      },
    },
    { session }
  );
}
