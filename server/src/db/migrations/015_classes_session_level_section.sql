-- =====================================================
-- MIGRATION: 015_classes_session_level_section
-- FREEZE VERSION: v5.0
-- DATE: 2026-03-12
-- M-015 (Freeze numbering): Classes gain session, level, section, class-teacher.
--
-- All new columns are nullable with defaults to avoid breaking existing rows.
-- Application layer enforces session_id + level NOT NULL on new class creation.
--
-- Unique constraint: (tenant_id, batch_id, session_id, level, section)
--   — prevents duplicate class definitions within a session for the same batch.
--   Uses NULLS NOT DISTINCT on section so (Std8, 2025, A) != (Std8, 2025, NULL)
--   but two NULL sections for the same batch+session+level are still distinct
--   only when all other cols differ (handled at app layer: section is optional
--   and NULL means "no section" — only one per batch+session+level allowed then).
-- =====================================================

BEGIN;

-- Add new columns
ALTER TABLE classes
  ADD COLUMN session_id       VARCHAR(50)  DEFAULT NULL
    REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  ADD COLUMN level            VARCHAR(50)  DEFAULT NULL,
  ADD COLUMN section          VARCHAR(10)  DEFAULT NULL,
  ADD COLUMN class_teacher_id VARCHAR(50)  DEFAULT NULL
    REFERENCES users(id) ON DELETE SET NULL;

-- Unique class definition per session
CREATE UNIQUE INDEX idx_classes_session_unique
  ON classes(tenant_id, batch_id, session_id, level, COALESCE(section, ''))
  WHERE deleted_at IS NULL;

-- One class teacher assignment per session per tenant (partial unique; nulls excluded)
CREATE UNIQUE INDEX idx_classes_teacher_session
  ON classes(tenant_id, class_teacher_id, session_id)
  WHERE class_teacher_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_classes_session_id ON classes(session_id) WHERE session_id IS NOT NULL;

COMMIT;
