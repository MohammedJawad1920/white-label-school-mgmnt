-- =====================================================
-- MIGRATION: 038_assignment_submissions
-- FREEZE VERSION: v5.0 (M-038)
-- DATE: 2026-03-15
--
-- WHY: Per-student assignment submission tracking. Auto-created
-- for all class students when an assignment is created.
-- Teacher marks completion status and optional remarks.
--
-- WHAT CHANGES:
--   assignment_submissions  — new table
-- =====================================================

BEGIN;

CREATE TABLE assignment_submissions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assignment_id   UUID         NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id      UUID         NOT NULL REFERENCES students(id),
  status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                    CHECK(status IN ('PENDING', 'COMPLETED', 'INCOMPLETE', 'NOT_SUBMITTED')),
  marks_obtained  NUMERIC(6,2) DEFAULT NULL,
  remark          TEXT         DEFAULT NULL,
  marked_by       UUID         REFERENCES users(id),
  marked_at       TIMESTAMPTZ  DEFAULT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);

CREATE INDEX idx_submissions_student
  ON assignment_submissions(student_id);

CREATE INDEX idx_submissions_assignment
  ON assignment_submissions(assignment_id);

COMMIT;
