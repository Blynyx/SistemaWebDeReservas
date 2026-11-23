import { getMongoDb } from '../client.js';
import { mapOrganizationToLegacy } from './mappers.js';

const COLLECTION = 'organizations';

function collection() {
  return getMongoDb().collection(COLLECTION);
}

export async function slugExists(slug, { session } = {}) {
  const doc = await collection().findOne(
    { slug },
    { projection: { _id: 0, id: 1 }, session }
  );
  return Boolean(doc);
}

export async function insertOrganization({ id, name, slug }, { session } = {}) {
  const now = new Date().toISOString();
  await collection().insertOne(
    {
      id,
      name,
      slug,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    { session }
  );
}

export async function findById(id, { session } = {}) {
  const doc = await collection().findOne(
    { id },
    { projection: { _id: 0, id: 1, name: 1, slug: 1, isActive: 1 }, session }
  );
  return mapOrganizationToLegacy(doc);
}

export async function findBySlug(slug, { session } = {}) {
  const doc = await collection().findOne(
    { slug },
    { projection: { _id: 0, id: 1, name: 1, slug: 1, isActive: 1 }, session }
  );
  return mapOrganizationToLegacy(doc);
}
