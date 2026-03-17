-- =====================================================
-- MIGRATION: 037_assignments
-- FREEZE VERSION: v5.0 (M-037)
-- DATE: 2026-03-15
--
-- WHY: Assignments module requires a table for teacher-created
-- assignments with per-student submission tracking.
-- Auto-creates submissions for all class students on assignment
-- creation (handled at the application layer).
--
-- WHAT CHANGES:
--   assignments  — new table
-- =====================================================

BEGIN;

CREATE TABLE assignments (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id   UUID         NOT NULL REFERENCES academic_sessions(id),
  class_id     UUID         NOT NULL REFERENCES classes(id),
  subject_id   UUID         NOT NULL REFERENCES subjects(id),
  created_by   UUID         NOT NULL REFERENCES users(id),
  title        VARCHAR(255) NOT NULL,
  description  TEXT         DEFAULT NULL,
  type         VARCHAR(50)  NOT NULL
                 CHECK(type IN ('Written', 'Memorization', 'Reading', 'ProblemSet', 'Project', 'Revision')),
  due_date     DATE         NOT NULL,
  is_graded    BOOLEAN      NOT NULL DEFAULT false,
  max_marks    NUMERIC(6,2) DEFAULT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                 CHECK(status IN ('ACTIVE', 'CLOSED')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ  DEFAULT NULL
);

CREATE INDEX idx_assignments_class
  ON assignments(class_id, due_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_assignments_tenant
  ON assignments(tenant_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_assignments_subject
  ON assignments(subject_id)
  WHERE deleted_at IS NULL;

COMMIT;
