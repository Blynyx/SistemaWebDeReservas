CREATE TABLE professionals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_account_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(name)) > 0),
  CHECK (is_active IN (0, 1)),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, user_account_id),
  FOREIGN KEY (organization_id) REFERENCES organizations (id),
  FOREIGN KEY (organization_id, user_account_id)
    REFERENCES user_accounts (organization_id, id)
);

CREATE INDEX idx_professionals_organization_id
  ON professionals (organization_id);
