import { getMongoDb } from '../client.js';
import { mapProfessionalToLegacy, requireOrganizationId } from './mappers.js';

const COLLECTION = 'professionals';

function collection() {
  return getMongoDb().collection(COLLECTION);
}

export async function insertProfessional(
  { id, organizationId, name, email, phone },
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const now = new Date().toISOString();

  await collection().insertOne(
    {
      id,
      organizationId,
      userAccountId: null,
      name,
      email: email ?? null,
      phone: phone ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    { session }
  );
}

export async function findById(organizationId, professionalId, { session } = {}) {
  requireOrganizationId(organizationId);
  const doc = await collection().findOne(
    { organizationId, id: professionalId },
    { projection: { _id: 0 }, session }
  );
  return mapProfessionalToLegacy(doc);
}

export async function findAllByOrganization(organizationId, { session } = {}) {
  requireOrganizationId(organizationId);
  const docs = await collection()
    .find({ organizationId }, { projection: { _id: 0 }, session })
    .sort({ name: 1 })
    .toArray();
  return docs.map(mapProfessionalToLegacy);
}

export async function updateProfessional(organizationId, professionalId, fields, { session } = {}) {
  requireOrganizationId(organizationId);
  const updates = {
    updatedAt: fields.updatedAt ?? new Date().toISOString(),
  };

  if (fields.name !== undefined) {
    updates.name = fields.name;
  }
  if (fields.email !== undefined) {
    updates.email = fields.email;
  }
  if (fields.phone !== undefined) {
    updates.phone = fields.phone;
  }

  await collection().updateOne(
    { organizationId, id: professionalId },
    { $set: updates },
    { session }
  );
}

export async function findByUserAccountId(organizationId, userAccountId, { session } = {}) {
  requireOrganizationId(organizationId);
  if (typeof userAccountId !== 'string' || userAccountId.trim() === '') {
    return null;
  }

  const doc = await collection().findOne(
    { organizationId, userAccountId },
    { projection: { _id: 0 }, session }
  );
  return mapProfessionalToLegacy(doc);
}

export async function linkUserAccount(
  organizationId,
  professionalId,
  userAccountId,
  updatedAt,
  { session } = {}
) {
  requireOrganizationId(organizationId);
  await collection().updateOne(
    { organizationId, id: professionalId, userAccountId: null },
    {
      $set: {
        userAccountId,
        updatedAt: updatedAt ?? new Date().toISOString(),
      },
    },
    { session }
  );
}

export async function deactivateProfessional(
  organizationId,
  professionalId,
  updatedAt,
  { session } = {}
) {
  requireOrganizationId(organizationId);
  await collection().updateOne(
    { organizationId, id: professionalId },
    {
      $set: {
        isActive: false,
        updatedAt: updatedAt ?? new Date().toISOString(),
      },
    },
    { session }
  );
}
