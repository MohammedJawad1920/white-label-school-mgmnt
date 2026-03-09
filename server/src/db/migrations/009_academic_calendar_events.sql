-- src/db/migrations/009_academic_calendar_events.sql
-- FREEZE VERSION: v4.5
-- CR-37: Academic calendar events table

CREATE TABLE events (
  id           VARCHAR(50)  PRIMARY KEY,
  tenant_id    VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  type         VARCHAR(50)  NOT NULL
                 CHECK(type IN ('Holiday', 'Exam', 'Event', 'Other')),
  start_date   DATE         NOT NULL,
  end_date     DATE         NOT NULL,
  description  TEXT         DEFAULT NULL,
  created_by   VARCHAR(50)  NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ  DEFAULT NULL,
  CONSTRAINT chk_events_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_events_tenant_id  ON events(tenant_id);
CREATE INDEX idx_events_start_date ON events(tenant_id, start_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_type       ON events(tenant_id, type)       WHERE deleted_at IS NULL;
