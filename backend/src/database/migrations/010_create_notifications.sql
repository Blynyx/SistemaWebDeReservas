CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  recipient_user_account_id TEXT NOT NULL,
  appointment_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    type IN (
      'APPOINTMENT_CREATED',
      'APPOINTMENT_ASSIGNED',
      'APPOINTMENT_CONFIRMED',
      'APPOINTMENT_RESCHEDULED',
      'APPOINTMENT_CANCELLED'
    )
  ),
  CHECK (is_read IN (0, 1)),
  CHECK (
    (is_read = 0 AND read_at IS NULL)
    OR (is_read = 1 AND read_at IS NOT NULL)
  ),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, recipient_user_account_id)
    REFERENCES user_accounts (organization_id, id),
  FOREIGN KEY (organization_id, appointment_id)
    REFERENCES appointments (organization_id, id)
);

CREATE INDEX idx_notifications_org_recipient_read_created
  ON notifications (organization_id, recipient_user_account_id, is_read, created_at);

CREATE INDEX idx_notifications_org_appointment
  ON notifications (organization_id, appointment_id);
