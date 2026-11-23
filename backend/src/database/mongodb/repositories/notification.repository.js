import { getMongoDb } from '../client.js';
import { mapNotificationToLegacy, requireOrganizationId } from './mappers.js';

const COLLECTION = 'notifications';

function collection() {
  return getMongoDb().collection(COLLECTION);
}

export async function insertNotification(
  {
    id,
    organizationId,
    recipientUserAccountId,
    appointmentId,
    type,
    title,
    message,
  },
  { session } = {}
) {
  requireOrganizationId(organizationId);
  await collection().insertOne(
    {
      id,
      organizationId,
      recipientUserAccountId,
      appointmentId: appointmentId ?? null,
      type,
      title,
      message,
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
    },
    { session }
  );
}

export async function findByRecipient(
  organizationId,
  recipientUserAccountId,
  { unreadOnly, readOnly } = {},
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const filter = {
    organizationId,
    recipientUserAccountId,
  };

  if (unreadOnly) {
    filter.isRead = false;
  } else if (readOnly) {
    filter.isRead = true;
  }

  const docs = await collection()
    .find(filter, { projection: { _id: 0 }, session })
    .sort({ createdAt: -1, id: -1 })
    .toArray();
  return docs.map(mapNotificationToLegacy);
}

export async function findByRecipientAndId(
  organizationId,
  recipientUserAccountId,
  notificationId,
  { session } = {}
) {
  requireOrganizationId(organizationId);
  const doc = await collection().findOne(
    {
      organizationId,
      recipientUserAccountId,
      id: notificationId,
    },
    { projection: { _id: 0 }, session }
  );
  return mapNotificationToLegacy(doc);
}

export async function countUnread(organizationId, recipientUserAccountId, { session } = {}) {
  requireOrganizationId(organizationId);
  return collection().countDocuments(
    {
      organizationId,
      recipientUserAccountId,
      isRead: false,
    },
    { session }
  );
}

export async function setReadState(
  organizationId,
  recipientUserAccountId,
  notificationId,
  isRead,
  { session } = {}
) {
  requireOrganizationId(organizationId);
  if (isRead) {
    await collection().updateOne(
      {
        organizationId,
        recipientUserAccountId,
        id: notificationId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date().toISOString(),
        },
      },
      { session }
    );
    return;
  }

  await collection().updateOne(
    {
      organizationId,
      recipientUserAccountId,
      id: notificationId,
      isRead: true,
    },
    {
      $set: {
        isRead: false,
        readAt: null,
      },
    },
    { session }
  );
}
