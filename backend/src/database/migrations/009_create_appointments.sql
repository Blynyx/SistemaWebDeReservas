CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  professional_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  service_duration_minutes INTEGER NOT NULL,
  service_price_minor_units INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROGRAMADA',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (service_duration_minutes > 0),
  CHECK (service_price_minor_units >= 0),
  CHECK (
    status IN (
      'PROGRAMADA',
      'CONFIRMADA',
      'COMPLETADA',
      'CANCELADA',
      'NO_ASISTIO'
    )
  ),
  CHECK (start_at < end_at),
  CHECK (
    length(start_at) = 16
    AND substr(start_at, 5, 1) = '-'
    AND substr(start_at, 8, 1) = '-'
    AND substr(start_at, 11, 1) = 'T'
    AND substr(start_at, 14, 1) = ':'
    AND substr(start_at, 1, 4) GLOB '[0-9][0-9][0-9][0-9]'
    AND (
      substr(start_at, 6, 2) GLOB '0[1-9]'
      OR substr(start_at, 6, 2) GLOB '1[0-2]'
    )
    AND (
      substr(start_at, 9, 2) GLOB '0[1-9]'
      OR substr(start_at, 9, 2) GLOB '[1-2][0-9]'
      OR substr(start_at, 9, 2) GLOB '3[01]'
    )
    AND (
      substr(start_at, 12, 2) GLOB '[0-1][0-9]'
      OR substr(start_at, 12, 2) GLOB '2[0-3]'
    )
    AND substr(start_at, 15, 2) GLOB '[0-5][0-9]'
  ),
  CHECK (
    length(end_at) = 16
    AND substr(end_at, 5, 1) = '-'
    AND substr(end_at, 8, 1) = '-'
    AND substr(end_at, 11, 1) = 'T'
    AND substr(end_at, 14, 1) = ':'
    AND substr(end_at, 1, 4) GLOB '[0-9][0-9][0-9][0-9]'
    AND (
      substr(end_at, 6, 2) GLOB '0[1-9]'
      OR substr(end_at, 6, 2) GLOB '1[0-2]'
    )
    AND (
      substr(end_at, 9, 2) GLOB '0[1-9]'
      OR substr(end_at, 9, 2) GLOB '[1-2][0-9]'
      OR substr(end_at, 9, 2) GLOB '3[01]'
    )
    AND (
      substr(end_at, 12, 2) GLOB '[0-1][0-9]'
      OR substr(end_at, 12, 2) GLOB '2[0-3]'
    )
    AND substr(end_at, 15, 2) GLOB '[0-5][0-9]'
  ),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, client_id)
    REFERENCES clients (organization_id, id),
  FOREIGN KEY (organization_id, professional_id)
    REFERENCES professionals (organization_id, id),
  FOREIGN KEY (organization_id, service_id)
    REFERENCES services (organization_id, id)
);

CREATE INDEX idx_appointments_org_professional_start
  ON appointments (organization_id, professional_id, start_at);

CREATE INDEX idx_appointments_org_start
  ON appointments (organization_id, start_at);
