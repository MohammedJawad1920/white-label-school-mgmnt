-- =====================================================
-- MIGRATION: 027_exams
-- FREEZE VERSION: v5.0 (M-027)
-- DATE: 2026-03-15
--
-- WHY: Exam management module requires an exams table for tracking
-- internal exams through DRAFT → SCHEDULED → ONGOING → MARKS_PENDING
-- → UNDER_REVIEW → PUBLISHED lifecycle.
--
-- WHAT CHANGES:
--   exams  — new table
-- =====================================================

BEGIN;

CREATE TABLE exams (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id        UUID         NOT NULL REFERENCES academic_sessions(id),
  class_id          UUID         NOT NULL REFERENCES classes(id),
  name              VARCHAR(255) NOT NULL,
  type              VARCHAR(20)  NOT NULL
                      CHECK(type IN ('TermExam', 'PeriodicTest')),
  status            VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
                      CHECK(status IN ('DRAFT', 'SCHEDULED', 'ONGOING', 'MARKS_PENDING', 'UNDER_REVIEW', 'PUBLISHED', 'UNPUBLISHED')),
  grade_boundaries  JSONB        NOT NULL DEFAULT '[
    {"grade":"A+","minPercentage":90,"maxPercentage":100,"label":"Outstanding"},
    {"grade":"A","minPercentage":80,"maxPercentage":89,"label":"Excellent"},
    {"grade":"B+","minPercentage":70,"maxPercentage":79,"label":"Very Good"},
    {"grade":"B","minPercentage":60,"maxPercentage":69,"label":"Good"},
    {"grade":"C+","minPercentage":50,"maxPercentage":59,"label":"Above Average"},
    {"grade":"C","minPercentage":40,"maxPercentage":49,"label":"Average"},
    {"grade":"D","minPercentage":30,"maxPercentage":39,"label":"Below Average"},
    {"grade":"F","minPercentage":0,"maxPercentage":29,"label":"Fail"}
  ]',
  created_by        UUID         NOT NULL REFERENCES users(id),
  published_by      UUID         REFERENCES users(id),
  published_at      TIMESTAMPTZ  DEFAULT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ  DEFAULT NULL
);

CREATE INDEX idx_exams_session
  ON exams(session_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_exams_class
  ON exams(class_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_exams_tenant
  ON exams(tenant_id)
  WHERE deleted_at IS NULL;

COMMIT;
