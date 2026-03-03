-- =====================================================
-- MIGRATION: 003_add_attendance_corrections
-- FREEZE VERSION: v3.4
-- DATE: 2026-03-02
-- CR-09: Attendance correction with audit trail
--
-- Adds three nullable columns to attendance_records:
--   corrected_status — the override value (never touches original status)
--   corrected_by     — FK to the user who made the correction
--   corrected_at     — timestamp of the correction
--
-- INVARIANT (application-enforced):
--   attendance_records.status is NEVER mutated after insert.
--   All corrections are recorded in corrected_* columns only.
--   The effective status is: COALESCE(corrected_status, status).
-- =====================================================

BEGIN;

ALTER TABLE attendance_records
  ADD COLUMN corrected_status VARCHAR(50) DEFAULT NULL
    CHECK(corrected_status IN ('Present', 'Absent', 'Late')),
  ADD COLUMN corrected_by VARCHAR(50) DEFAULT NULL
    REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN corrected_at TIMESTAMPTZ DEFAULT NULL;

COMMIT;
