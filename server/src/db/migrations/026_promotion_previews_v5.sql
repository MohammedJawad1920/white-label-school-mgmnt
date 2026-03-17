-- =====================================================
-- MIGRATION: 026_promotion_previews_v5
-- FREEZE VERSION: v5.0 (M-026)
-- DATE: 2026-03-15
--
-- WHY: Freeze v5.0 extends promotion_previews with to_session_id
-- and created_by for improved audit.
-- The base promotion_previews table was created in migration 013.
-- This migration adds new columns without breaking existing usage.
--
-- WHAT CHANGES:
--   promotion_previews  — ADD to_session_id, created_by (nullable)
-- =====================================================

BEGIN;

ALTER TABLE promotion_previews
  ADD COLUMN IF NOT EXISTS to_session_id  UUID  REFERENCES academic_sessions(id),
  ADD COLUMN IF NOT EXISTS created_by     UUID  REFERENCES users(id);

COMMIT;
