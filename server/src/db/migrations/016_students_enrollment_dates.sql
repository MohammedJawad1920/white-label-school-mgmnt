-- =====================================================
-- MIGRATION: 016_students_enrollment_dates
-- FREEZE VERSION: v5.0
-- DATE: 2026-03-12
-- M-016 (Freeze numbering): Student lifecycle date tracking.
--
-- enrolled_at — date student joined (set at creation or import; nullable for existing records)
-- dropped_at  — date student dropped off (set when status transitions to DroppedOff)
-- =====================================================

BEGIN;

ALTER TABLE students
  ADD COLUMN enrolled_at DATE DEFAULT NULL,
  ADD COLUMN dropped_at  DATE DEFAULT NULL;

COMMIT;
