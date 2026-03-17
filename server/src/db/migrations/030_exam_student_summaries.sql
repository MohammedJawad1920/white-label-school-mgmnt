-- =====================================================
-- MIGRATION: 030_exam_student_summaries
-- FREEZE VERSION: v5.0 (M-030)
-- DATE: 2026-03-15
--
-- WHY: Aggregated per-student exam summaries (total marks, aggregate
-- percentage, overall grade, rank) computed on exam publish.
--
-- WHAT CHANGES:
--   exam_student_summaries  — new table
-- =====================================================

BEGIN;

CREATE TABLE exam_student_summaries (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  exam_id                 UUID          NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id              UUID          NOT NULL REFERENCES students(id),
  total_marks_obtained    NUMERIC(8,2)  NOT NULL,
  total_marks_possible    NUMERIC(8,2)  NOT NULL,
  aggregate_percentage    NUMERIC(5,2)  NOT NULL,
  overall_grade           VARCHAR(5)    NOT NULL,
  overall_result          VARCHAR(10)   NOT NULL
                            CHECK(overall_result IN ('PASS', 'FAIL')),
  class_rank              INTEGER       DEFAULT NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(exam_id, student_id)
);

CREATE INDEX idx_summaries_exam
  ON exam_student_summaries(exam_id);

CREATE INDEX idx_summaries_student
  ON exam_student_summaries(student_id);

COMMIT;
