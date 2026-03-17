-- =====================================================
-- MIGRATION: 029_exam_results
-- FREEZE VERSION: v5.0 (M-029)
-- DATE: 2026-03-15
--
-- WHY: Per-student per-subject exam marks. Populated by teachers
-- during marks entry; grade and is_pass computed on publish.
--
-- WHAT CHANGES:
--   exam_results  — new table
-- =====================================================

BEGIN;

CREATE TABLE exam_results (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  exam_subject_id  UUID         NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
  student_id       UUID         NOT NULL REFERENCES students(id),
  marks_obtained   NUMERIC(6,2) DEFAULT NULL,
  is_absent        BOOLEAN      NOT NULL DEFAULT false,
  grade            VARCHAR(5)   DEFAULT NULL,
  is_pass          BOOLEAN      DEFAULT NULL,
  entered_by       UUID         REFERENCES users(id),
  entered_at       TIMESTAMPTZ  DEFAULT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(exam_subject_id, student_id)
);

CREATE INDEX idx_results_student
  ON exam_results(student_id);

CREATE INDEX idx_results_exam_subject
  ON exam_results(exam_subject_id);

COMMIT;
