CREATE TABLE user_accounts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    role IN (
      'ADMIN',
      'RECEPTIONIST',
      'PROFESSIONAL',
      'CLIENT'
    )
  ),
  CHECK (is_active IN (0, 1)),
  UNIQUE (organization_id, email),
  -- Permite FKs compuestas futuras: (organization_id, user_account_id)
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id) REFERENCES organizations (id)
);

CREATE INDEX idx_user_accounts_organization_id
  ON user_accounts (organization_id);
