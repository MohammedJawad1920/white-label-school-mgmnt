-- =====================================================
-- MIGRATION: 028_exam_subjects
-- FREEZE VERSION: v5.0 (M-028)
-- DATE: 2026-03-15
--
-- WHY: Each exam has one or more subjects with assigned teachers,
-- exam dates, marks config, and marks entry status.
--
-- WHAT CHANGES:
--   exam_subjects  — new table
-- =====================================================

BEGIN;

CREATE TABLE exam_subjects (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  exam_id      UUID         NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  subject_id   UUID         NOT NULL REFERENCES subjects(id),
  teacher_id   UUID         NOT NULL REFERENCES users(id),
  exam_date    DATE         NOT NULL,
  start_time   TIME         DEFAULT NULL,
  end_time     TIME         DEFAULT NULL,
  total_marks  NUMERIC(6,2) NOT NULL,
  pass_marks   NUMERIC(6,2) NOT NULL,
  marks_status VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                 CHECK(marks_status IN ('PENDING', 'ENTERED', 'LOCKED')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_exam_subject_marks CHECK(pass_marks <= total_marks),
  UNIQUE(exam_id, subject_id)
);

CREATE INDEX idx_exam_subjects_exam
  ON exam_subjects(exam_id);

CREATE INDEX idx_exam_subjects_teacher
  ON exam_subjects(teacher_id);

COMMIT;
