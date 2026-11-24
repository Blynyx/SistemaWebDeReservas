import { getMongoDb } from '../client.js';
import { mapAppointmentToLegacy, requireOrganizationId } from './mappers.js';

const COLLECTION = 'appointments';
const ACTIVE_STATUSES = ['PROGRAMADA', 'CONFIRMADA'];

function collection() {
  return getMongoDb().collection(COLLECTION);
}

export async function insertAppointment(
  {
    id,
    organizationId,
    clientId,
    professionalId,
    serviceId,
    startAt,
    endAt,
    serviceDurationMinutes,
    servicePriceMinorUnits,
  },
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const now = new Date().toISOString();

  await collection().insertOne(
    {
      id,
      organizationId,
      clientId,
      professionalId,
      serviceId,
      startAt,
      endAt,
      serviceDurationMinutes,
      servicePriceMinorUnits,
      status: 'PROGRAMADA',
      createdAt: now,
      updatedAt: now,
    },
    { session }
  );
}

export async function findById(organizationId, appointmentId, { session } = {}) {
  requireOrganizationId(organizationId);
  const doc = await collection().findOne(
    { organizationId, id: appointmentId },
    { projection: { _id: 0 }, session }
  );
  return mapAppointmentToLegacy(doc);
}

export async function findAllByOrganization(organizationId, { session } = {}) {
  requireOrganizationId(organizationId);
  const docs = await collection()
    .find({ organizationId }, { projection: { _id: 0 }, session })
    .sort({ startAt: 1 })
    .toArray();
  return docs.map(mapAppointmentToLegacy);
}

export async function findByFilters(organizationId, filters = {}, { session } = {}) {
  requireOrganizationId(organizationId);
  const query = { organizationId };

  if (filters.clientId) {
    query.clientId = filters.clientId;
  }

  if (filters.professionalId) {
    query.professionalId = filters.professionalId;
  }

  if (filters.serviceId) {
    query.serviceId = filters.serviceId;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.rangeStart && filters.rangeEnd) {
    query.startAt = { $lt: filters.rangeEnd };
    query.endAt = { $gt: filters.rangeStart };
  }

  const docs = await collection()
    .find(query, { projection: { _id: 0 }, session })
    .sort({ startAt: 1, id: 1 })
    .toArray();
  return docs.map(mapAppointmentToLegacy);
}

export async function findByProfessional(organizationId, professionalId, { session } = {}) {
  requireOrganizationId(organizationId);
  const docs = await collection()
    .find({ organizationId, professionalId }, { projection: { _id: 0 }, session })
    .sort({ startAt: 1 })
    .toArray();
  return docs.map(mapAppointmentToLegacy);
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
  return docs.map(mapAppointmentToLegacy);
}

export async function findByClient(organizationId, clientId, { session } = {}) {
  requireOrganizationId(organizationId);
  const docs = await collection()
    .find({ organizationId, clientId }, { projection: { _id: 0 }, session })
    .sort({ startAt: 1 })
    .toArray();
  return docs.map(mapAppointmentToLegacy);
}

export async function findByClientInRange(
  organizationId,
  clientId,
  rangeStart,
  rangeEnd,
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const docs = await collection()
    .find(
      {
        organizationId,
        clientId,
        startAt: { $lt: rangeEnd },
        endAt: { $gt: rangeStart },
      },
      { projection: { _id: 0 }, session }
    )
    .sort({ startAt: 1 })
    .toArray();
  return docs.map(mapAppointmentToLegacy);
}

export async function findActiveByProfessionalInRange(
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
        status: { $in: ACTIVE_STATUSES },
        startAt: { $lt: rangeEnd },
        endAt: { $gt: rangeStart },
      },
      { projection: { _id: 0 }, session }
    )
    .sort({ startAt: 1 })
    .toArray();
  return docs.map(mapAppointmentToLegacy);
}

export async function hasActiveOverlap(
  {
    organizationId,
    professionalId,
    startAt,
    endAt,
    excludeAppointmentId = null,
  },
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const filter = {
    organizationId,
    professionalId,
    status: { $in: ACTIVE_STATUSES },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  };

  if (excludeAppointmentId !== null && excludeAppointmentId !== undefined) {
    filter.id = { $ne: excludeAppointmentId };
  }

  const doc = await collection().findOne(filter, { projection: { _id: 0, id: 1 }, session });
  return Boolean(doc);
}

export async function updateStatus(organizationId, appointmentId, status, { session } = {}) {
  requireOrganizationId(organizationId);
  await collection().updateOne(
    { organizationId, id: appointmentId },
    {
      $set: {
        status,
        updatedAt: new Date().toISOString(),
      },
    },
    { session }
  );
}

export async function reschedule(
  organizationId,
  appointmentId,
  { startAt, endAt },
  { session } = {}
) {
  requireOrganizationId(organizationId);
  await collection().updateOne(
    { organizationId, id: appointmentId },
    {
      $set: {
        startAt,
        endAt,
        status: 'PROGRAMADA',
        updatedAt: new Date().toISOString(),
      },
    },
    { session }
  );
}

export async function updateBookingDetails(
  organizationId,
  appointmentId,
  {
    clientId,
    professionalId,
    serviceId,
    endAt,
    serviceDurationMinutes,
    servicePriceMinorUnits,
  },
  { session } = {}
) {
  requireOrganizationId(organizationId);
  await collection().updateOne(
    { organizationId, id: appointmentId },
    {
      $set: {
        clientId,
        professionalId,
        serviceId,
        endAt,
        serviceDurationMinutes,
        servicePriceMinorUnits,
        updatedAt: new Date().toISOString(),
      },
    },
    { session }
  );
}
