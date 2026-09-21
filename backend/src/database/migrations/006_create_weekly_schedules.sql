CREATE TABLE weekly_schedules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  professional_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (day_of_week BETWEEN 1 AND 7),
  CHECK (
    length(start_time) = 5
    AND (
      start_time GLOB '[0-1][0-9]:[0-5][0-9]'
      OR start_time GLOB '2[0-3]:[0-5][0-9]'
    )
  ),
  CHECK (
    length(end_time) = 5
    AND (
      end_time GLOB '[0-1][0-9]:[0-5][0-9]'
      OR end_time GLOB '2[0-3]:[0-5][0-9]'
    )
  ),
  CHECK (start_time < end_time),
  UNIQUE (organization_id, id),
  UNIQUE (
    organization_id,
    professional_id,
    day_of_week,
    start_time,
    end_time
  ),
  FOREIGN KEY (organization_id, professional_id)
    REFERENCES professionals (organization_id, id)
);
