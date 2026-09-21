CREATE TABLE services (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price_minor_units INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(name)) > 0),
  CHECK (duration_minutes > 0),
  CHECK (price_minor_units >= 0),
  CHECK (is_active IN (0, 1)),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id) REFERENCES organizations (id)
);

CREATE INDEX idx_services_organization_id
  ON services (organization_id);
