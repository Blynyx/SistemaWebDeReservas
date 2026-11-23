import { getMongoDb } from './client.js';

export const INDEX_DEFINITIONS = [
  {
    collection: 'organizations',
    indexes: [
      {
        name: 'ux_organizations_id',
        key: { id: 1 },
        unique: true,
      },
      {
        name: 'ux_organizations_slug',
        key: { slug: 1 },
        unique: true,
      },
    ],
  },
  {
    collection: 'userAccounts',
    indexes: [
      {
        name: 'ux_user_accounts_org_id',
        key: { organizationId: 1, id: 1 },
        unique: true,
      },
      {
        name: 'ux_user_accounts_org_email',
        key: { organizationId: 1, email: 1 },
        unique: true,
      },
    ],
  },
  {
    collection: 'services',
    indexes: [
      {
        name: 'ux_services_org_id',
        key: { organizationId: 1, id: 1 },
        unique: true,
      },
      {
        name: 'ix_services_org_active_name',
        key: { organizationId: 1, isActive: 1, name: 1 },
      },
    ],
  },
  {
    collection: 'professionals',
    indexes: [
      {
        name: 'ux_professionals_org_id',
        key: { organizationId: 1, id: 1 },
        unique: true,
      },
      {
        name: 'ux_professionals_org_user_account',
        key: { organizationId: 1, userAccountId: 1 },
        unique: true,
        partialFilterExpression: { userAccountId: { $type: 'string' } },
      },
      {
        name: 'ix_professionals_org_active_name',
        key: { organizationId: 1, isActive: 1, name: 1 },
      },
    ],
  },
  {
    collection: 'professionalServices',
    indexes: [
      {
        name: 'ux_professional_services_org_prof_service',
        key: { organizationId: 1, professionalId: 1, serviceId: 1 },
        unique: true,
      },
      {
        name: 'ix_professional_services_org_service',
        key: { organizationId: 1, serviceId: 1 },
      },
    ],
  },
  {
    collection: 'weeklySchedules',
    indexes: [
      {
        name: 'ux_weekly_schedules_org_id',
        key: { organizationId: 1, id: 1 },
        unique: true,
      },
      {
        name: 'ux_weekly_schedules_org_prof_slot',
        key: { organizationId: 1, professionalId: 1, dayOfWeek: 1, startTime: 1, endTime: 1 },
        unique: true,
      },
    ],
  },
  {
    collection: 'availabilityBlocks',
    indexes: [
      {
        name: 'ux_availability_blocks_org_id',
        key: { organizationId: 1, id: 1 },
        unique: true,
      },
      {
        name: 'ux_availability_blocks_org_prof_range',
        key: { organizationId: 1, professionalId: 1, startAt: 1, endAt: 1 },
        unique: true,
      },
    ],
  },
  {
    collection: 'clients',
    indexes: [
      {
        name: 'ux_clients_org_id',
        key: { organizationId: 1, id: 1 },
        unique: true,
      },
      {
        name: 'ux_clients_org_user_account',
        key: { organizationId: 1, userAccountId: 1 },
        unique: true,
        partialFilterExpression: { userAccountId: { $type: 'string' } },
      },
      {
        name: 'ix_clients_org_active_name',
        key: { organizationId: 1, isActive: 1, name: 1 },
      },
    ],
  },
  {
    collection: 'appointments',
    indexes: [
      {
        name: 'ux_appointments_org_id',
        key: { organizationId: 1, id: 1 },
        unique: true,
      },
      {
        name: 'ix_appointments_org_prof_status_range',
        key: { organizationId: 1, professionalId: 1, status: 1, startAt: 1, endAt: 1 },
      },
      {
        name: 'ix_appointments_org_client_start',
        key: { organizationId: 1, clientId: 1, startAt: 1 },
      },
      {
        name: 'ix_appointments_org_start_status',
        key: { organizationId: 1, startAt: 1, status: 1 },
      },
      {
        name: 'ix_appointments_org_service_start',
        key: { organizationId: 1, serviceId: 1, startAt: 1 },
      },
    ],
  },
  {
    collection: 'notifications',
    indexes: [
      {
        name: 'ux_notifications_org_id',
        key: { organizationId: 1, id: 1 },
        unique: true,
      },
      {
        name: 'ix_notifications_org_recipient_read_created',
        key: { organizationId: 1, recipientUserAccountId: 1, isRead: 1, createdAt: -1, id: -1 },
      },
      {
        name: 'ix_notifications_org_appointment',
        key: { organizationId: 1, appointmentId: 1 },
      },
    ],
  },
  {
    collection: 'professionalDayLocks',
    indexes: [
      {
        name: 'ux_professional_day_locks_org_prof_date',
        key: { organizationId: 1, professionalId: 1, date: 1 },
        unique: true,
      },
    ],
  },
];

/**
 * Crea todos los índices definidos en la especificación de forma idempotente.
 */
export async function ensureIndexes(db = getMongoDb()) {
  const results = [];

  for (const { collection, indexes } of INDEX_DEFINITIONS) {
    const created = await db.collection(collection).createIndexes(indexes);
    results.push({ collection, indexes: created });
  }

  return results;
}
