-- =====================================================
-- MIGRATION: 025_promotion_logs_v5
-- FREEZE VERSION: v5.0 (M-025)
-- DATE: 2026-03-15
--
-- WHY: Freeze v5.0 extends promotion_logs with per-batch/class
-- detail columns for improved audit granularity.
-- The base promotion_logs table was created in migration 013.
-- This migration adds the new columns without breaking existing
-- academic-sessions controller functionality.
--
-- WHAT CHANGES:
--   promotion_logs  — ADD batch_id, from_class_id, to_class_id,
--                     promoted_student_ids, skipped_student_ids,
--                     promoted_at (nullable for backward compat)
-- =====================================================

BEGIN;

ALTER TABLE promotion_logs
  ADD COLUMN IF NOT EXISTS batch_id              UUID       REFERENCES batches(id),
  ADD COLUMN IF NOT EXISTS from_class_id         UUID       REFERENCES classes(id),
  ADD COLUMN IF NOT EXISTS to_class_id           UUID       REFERENCES classes(id),
  ADD COLUMN IF NOT EXISTS promoted_student_ids  UUID[]     DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skipped_student_ids   UUID[]     DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS promoted_at           TIMESTAMPTZ DEFAULT NOW();

COMMIT;
