CREATE TABLE professional_services (
  organization_id TEXT NOT NULL,
  professional_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, professional_id, service_id),
  FOREIGN KEY (organization_id, professional_id)
    REFERENCES professionals (organization_id, id),
  FOREIGN KEY (organization_id, service_id)
    REFERENCES services (organization_id, id)
);

CREATE INDEX idx_professional_services_organization_service
  ON professional_services (organization_id, service_id);
