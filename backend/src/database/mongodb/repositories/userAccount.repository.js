import { getMongoDb } from '../client.js';
import { mapUserAccountToLegacy, requireOrganizationId } from './mappers.js';

const COLLECTION = 'userAccounts';

function collection() {
  return getMongoDb().collection(COLLECTION);
}

export async function insertUserAccount(
  { id, organizationId, email, passwordHash, role, isActive },
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const now = new Date().toISOString();

  await collection().insertOne(
    {
      id,
      organizationId,
      email,
      passwordHash,
      role,
      isActive: Boolean(isActive),
      createdAt: now,
      updatedAt: now,
    },
    { session }
  );
}

export async function findByIdAndOrganization(id, organizationId, { session } = {}) {
  requireOrganizationId(organizationId);
  const doc = await collection().findOne(
    { organizationId, id },
    {
      projection: { _id: 0, id: 1, organizationId: 1, email: 1, role: 1, isActive: 1 },
      session,
    }
  );
  return mapUserAccountToLegacy(doc);
}

export async function findByOrganizationIdAndEmail(organizationId, email, { session } = {}) {
  requireOrganizationId(organizationId);
  const doc = await collection().findOne(
    { organizationId, email },
    {
      projection: {
        _id: 0,
        id: 1,
        organizationId: 1,
        email: 1,
        passwordHash: 1,
        role: 1,
        isActive: 1,
      },
      session,
    }
  );
  return mapUserAccountToLegacy(doc, { includePasswordHash: true });
}

export async function deactivate(organizationId, userAccountId, { session } = {}) {
  requireOrganizationId(organizationId);
  await collection().updateOne(
    { organizationId, id: userAccountId },
    {
      $set: {
        isActive: false,
        updatedAt: new Date().toISOString(),
      },
    },
    { session }
  );
}

export async function findReceptionistsByOrganization(organizationId, { session } = {}) {
  requireOrganizationId(organizationId);
  return collection()
    .find(
      { organizationId, role: 'RECEPTIONIST' },
      {
        projection: {
          _id: 0,
          id: 1,
          email: 1,
          role: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
        },
        session,
      }
    )
    .sort({ email: 1 })
    .toArray();
}

export async function findByIdAndRole(organizationId, id, role, { session } = {}) {
  requireOrganizationId(organizationId);
  return collection().findOne(
    { organizationId, id, role },
    {
      projection: {
        _id: 0,
        id: 1,
        email: 1,
        role: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      session,
    }
  );
}

export async function setActiveState(organizationId, id, isActive, { session } = {}) {
  requireOrganizationId(organizationId);
  await collection().updateOne(
    { organizationId, id },
    {
      $set: {
        isActive: Boolean(isActive),
        updatedAt: new Date().toISOString(),
      },
    },
    { session }
  );
}
