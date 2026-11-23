import { getMongoDb } from '../client.js';
import { requireOrganizationId } from './mappers.js';

export async function countAppointmentsByStatusInRange(
  organizationId,
  rangeStart,
  rangeEnd,
  { session } = {}
) {
  requireOrganizationId(organizationId);
  return getMongoDb()
    .collection('appointments')
    .aggregate(
      [
        {
          $match: {
            organizationId,
            startAt: { $lt: rangeEnd },
            endAt: { $gt: rangeStart },
          },
        },
        {
          $group: {
            _id: '$status',
            total: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            status: '$_id',
            total: 1,
          },
        },
      ],
      { session }
    )
    .toArray();
}

export async function countActiveClients(organizationId, { session } = {}) {
  requireOrganizationId(organizationId);
  return getMongoDb()
    .collection('clients')
    .countDocuments({ organizationId, isActive: true }, { session });
}

export async function countActiveProfessionals(organizationId, { session } = {}) {
  requireOrganizationId(organizationId);
  return getMongoDb()
    .collection('professionals')
    .countDocuments({ organizationId, isActive: true }, { session });
}

export async function countActiveServices(organizationId, { session } = {}) {
  requireOrganizationId(organizationId);
  return getMongoDb()
    .collection('services')
    .countDocuments({ organizationId, isActive: true }, { session });
}
