-- =====================================================
-- MIGRATION: 035_import_jobs
-- FREEZE VERSION: v5.0 (M-035)
-- DATE: 2026-03-15
--
-- WHY: CSV bulk import requires a TTL-based job table to store
-- preview results with a 30-minute confirmation window before
-- the actual import is committed.
--
-- WHAT CHANGES:
--   import_jobs  — new table (TTL 30 minutes)
-- =====================================================

BEGIN;

CREATE TABLE import_jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type   VARCHAR(50) NOT NULL
                  CHECK(entity_type IN ('Student', 'User')),
  status        VARCHAR(20) NOT NULL DEFAULT 'PREVIEW'
                  CHECK(status IN ('PREVIEW', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'FAILED')),
  total_rows    INTEGER     NOT NULL,
  valid_rows    INTEGER     NOT NULL,
  error_rows    INTEGER     NOT NULL,
  preview_data  JSONB       DEFAULT NULL,
  error_data    JSONB       DEFAULT NULL,
  imported_rows INTEGER     DEFAULT NULL,
  created_by    UUID        NOT NULL REFERENCES users(id),
  confirmed_at  TIMESTAMPTZ DEFAULT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes'
);

CREATE INDEX idx_import_jobs_tenant
  ON import_jobs(tenant_id, created_at DESC);

CREATE INDEX idx_import_jobs_expires
  ON import_jobs(expires_at)
  WHERE status = 'PREVIEW';

COMMIT;
