-- =====================================================
-- MIGRATION: 024_events_check_session_id
-- FREEZE VERSION: v5.0 (M-024)
-- DATE: 2026-03-15
--
-- WHY: Freeze v5.0 specifies events.session_id is derivable from
-- dates and should be removed. However, inspection of migration 009
-- shows the events table was never created with session_id.
-- This migration is a documented no-op confirming the column
-- does not exist.
--
-- WHAT CHANGES:
--   events  — no structural changes (session_id was never added)
-- =====================================================

BEGIN;

-- No-op: events.session_id was never added to the schema.
-- The freeze note about removing session_id is pre-emptive;
-- the column does not exist in migration 009.

COMMIT;
