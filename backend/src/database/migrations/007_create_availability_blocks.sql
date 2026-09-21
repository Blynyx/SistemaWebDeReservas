CREATE TABLE availability_blocks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  professional_id TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  UNIQUE (
    organization_id,
    professional_id,
    start_at,
    end_at
  ),
  FOREIGN KEY (organization_id, professional_id)
    REFERENCES professionals (organization_id, id)
);
