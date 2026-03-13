-- =====================================================
-- MIGRATION: 012_attendance_records_update
-- FREEZE VERSION: v5.0
-- DATE: 2026-03-12
-- M-010 + M-018 (Freeze numbering): Update attendance_records for v5.0.
--
-- Changes:
--   1. Add 'Excused' to status enum (available to Admin only; never by Teacher directly)
--   2. Replace corrected_* audit columns (from 003_add_attendance_corrections)
--      with updated_by / updated_at (simpler single-purpose audit trail)
--
-- Invariants (application-enforced after this migration):
--   - 'Excused' status may ONLY be set by Admin or via leave approval flow
--   - updated_by / updated_at track the last correction writer
-- =====================================================

BEGIN;

-- 1. Expand status CHECK constraint to include 'Excused'
ALTER TABLE attendance_records DROP CONSTRAINT attendance_records_status_check;
ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_status_check
    CHECK(status IN ('Present', 'Absent', 'Late', 'Excused'));

-- 2. Remove old correction columns added in 003_add_attendance_corrections
ALTER TABLE attendance_records
  DROP COLUMN IF EXISTS corrected_status,
  DROP COLUMN IF EXISTS corrected_by,
  DROP COLUMN IF EXISTS corrected_at;

-- 3. Add new audit columns
ALTER TABLE attendance_records
  ADD COLUMN updated_by VARCHAR(50) DEFAULT NULL
    REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NULL;

COMMIT;
