-- =====================================================
-- MIGRATION: 031_external_results
-- FREEZE VERSION: v5.0 (M-031)
-- DATE: 2026-03-15
--
-- WHY: Read-only recording of external exam results (DHSE, University)
-- per student per session. No workflow — data entry only.
--
-- WHAT CHANGES:
--   external_results  — new table
-- =====================================================

BEGIN;

CREATE TABLE external_results (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       UUID         NOT NULL REFERENCES students(id),
  session_id       UUID         NOT NULL REFERENCES academic_sessions(id),
  exam_name        VARCHAR(255) NOT NULL,
  conducted_by     VARCHAR(255) NOT NULL,
  result_summary   TEXT         DEFAULT NULL,
  document_url     TEXT         DEFAULT NULL,
  recorded_by      UUID         NOT NULL REFERENCES users(id),
  recorded_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_external_results_student
  ON external_results(student_id);

CREATE INDEX idx_external_results_session
  ON external_results(session_id);

COMMIT;
