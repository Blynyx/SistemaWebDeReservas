import { getMongoDb } from '../client.js';
import {
  mapProfessionalServiceToLegacy,
  requireOrganizationId,
  toLegacyBoolean,
} from './mappers.js';

const COLLECTION = 'professionalServices';

function collection() {
  return getMongoDb().collection(COLLECTION);
}

export async function insertAssignment(
  { organizationId, professionalId, serviceId },
  { session } = {}
) {
  requireOrganizationId(organizationId);
  await collection().insertOne(
    {
      organizationId,
      professionalId,
      serviceId,
      createdAt: new Date().toISOString(),
    },
    { session }
  );
}

export async function findAssignment(organizationId, professionalId, serviceId, { session } = {}) {
  requireOrganizationId(organizationId);
  const doc = await collection().findOne(
    { organizationId, professionalId, serviceId },
    { projection: { _id: 0 }, session }
  );
  return mapProfessionalServiceToLegacy(doc);
}

export async function assignmentExists(organizationId, professionalId, serviceId, { session } = {}) {
  const assignment = await findAssignment(organizationId, professionalId, serviceId, { session });
  return Boolean(assignment);
}

export async function findProfessionalsByService(organizationId, serviceId, { session } = {}) {
  requireOrganizationId(organizationId);
  const assignments = await collection()
    .find(
      { organizationId, serviceId },
      { projection: { _id: 0, professionalId: 1 }, session }
    )
    .toArray();

  if (assignments.length === 0) {
    return [];
  }

  const professionalIds = assignments.map((item) => item.professionalId);
  const professionals = await getMongoDb()
    .collection('professionals')
    .find(
      { organizationId, id: { $in: professionalIds } },
      {
        projection: {
          _id: 0,
          id: 1,
          organizationId: 1,
          name: 1,
          email: 1,
          phone: 1,
          isActive: 1,
        },
        session,
      }
    )
    .sort({ name: 1 })
    .toArray();

  return professionals.map((doc) => ({
    id: doc.id,
    organization_id: doc.organizationId,
    name: doc.name,
    email: doc.email ?? null,
    phone: doc.phone ?? null,
    is_active: toLegacyBoolean(doc.isActive),
  }));
}

export async function findServicesByProfessional(organizationId, professionalId, { session } = {}) {
  requireOrganizationId(organizationId);
  const assignments = await collection()
    .find(
      { organizationId, professionalId },
      { projection: { _id: 0, serviceId: 1 }, session }
    )
    .toArray();

  if (assignments.length === 0) {
    return [];
  }

  const serviceIds = assignments.map((item) => item.serviceId);
  const services = await getMongoDb()
    .collection('services')
    .find(
      { organizationId, id: { $in: serviceIds } },
      {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          description: 1,
          durationMinutes: 1,
          priceMinorUnits: 1,
          isActive: 1,
        },
        session,
      }
    )
    .sort({ name: 1 })
    .toArray();

  return services.map((doc) => ({
    id: doc.id,
    name: doc.name,
    description: doc.description ?? null,
    duration_minutes: doc.durationMinutes,
    price_minor_units: doc.priceMinorUnits,
    is_active: toLegacyBoolean(doc.isActive),
  }));
}

export async function removeAssignment(organizationId, professionalId, serviceId, { session } = {}) {
  requireOrganizationId(organizationId);
  await collection().deleteOne(
    { organizationId, professionalId, serviceId },
    { session }
  );
}
