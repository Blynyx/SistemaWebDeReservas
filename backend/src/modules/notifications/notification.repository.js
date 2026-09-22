import { getDb } from '../../database/connection.js';

const NOTIFICATION_COLUMNS = `
  id,
  organization_id,
  recipient_user_account_id,
  appointment_id,
  type,
  title,
  message,
  is_read,
  read_at,
  created_at
`;

export function insertNotification({
  id,
  organizationId,
  recipientUserAccountId,
  appointmentId,
  type,
  title,
  message,
}) {
  getDb()
    .prepare(
      `
        INSERT INTO notifications (
          id,
          organization_id,
          recipient_user_account_id,
          appointment_id,
          type,
          title,
          message
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(id, organizationId, recipientUserAccountId, appointmentId, type, title, message);
}

export function findByRecipient(organizationId, recipientUserAccountId, { unreadOnly, readOnly } = {}) {
  const filters = [
    'organization_id = ?',
    'recipient_user_account_id = ?',
  ];

  if (unreadOnly) {
    filters.push('is_read = 0');
  }

  if (readOnly) {
    filters.push('is_read = 1');
  }

  return getDb()
    .prepare(
      `
        SELECT ${NOTIFICATION_COLUMNS}
        FROM notifications
        WHERE ${filters.join(' AND ')}
        ORDER BY created_at DESC, id DESC
      `
    )
    .all(organizationId, recipientUserAccountId);
}

export function findByRecipientAndId(organizationId, recipientUserAccountId, notificationId) {
  return getDb()
    .prepare(
      `
        SELECT ${NOTIFICATION_COLUMNS}
        FROM notifications
        WHERE organization_id = ?
          AND recipient_user_account_id = ?
          AND id = ?
      `
    )
    .get(organizationId, recipientUserAccountId, notificationId);
}

export function countUnread(organizationId, recipientUserAccountId) {
  const row = getDb()
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM notifications
        WHERE organization_id = ?
          AND recipient_user_account_id = ?
          AND is_read = 0
      `
    )
    .get(organizationId, recipientUserAccountId);

  return row.total;
}

export function setReadState(organizationId, recipientUserAccountId, notificationId, isRead) {
  if (isRead) {
    getDb()
      .prepare(
        `
          UPDATE notifications
          SET is_read = 1, read_at = CURRENT_TIMESTAMP
          WHERE organization_id = ?
            AND recipient_user_account_id = ?
            AND id = ?
            AND is_read = 0
        `
      )
      .run(organizationId, recipientUserAccountId, notificationId);
    return;
  }

  getDb()
    .prepare(
      `
        UPDATE notifications
        SET is_read = 0, read_at = NULL
        WHERE organization_id = ?
          AND recipient_user_account_id = ?
          AND id = ?
          AND is_read = 1
      `
    )
    .run(organizationId, recipientUserAccountId, notificationId);
}
