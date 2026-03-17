-- =====================================================
-- MIGRATION: 021_student_guardians
-- FREEZE VERSION: v5.0 (M-021)
-- DATE: 2026-03-15
--
-- WHY: Many-to-many linking table between students and guardians.
-- One guardian can be linked to multiple students (e.g. siblings)
-- and one student can have multiple guardians.
--
-- WHAT CHANGES:
--   student_guardians  — new table (composite PK)
-- =====================================================

BEGIN;

CREATE TABLE student_guardians (
  student_id   UUID   NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id  UUID   NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  tenant_id    UUID   NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (student_id, guardian_id)
);

CREATE INDEX idx_student_guardians_guardian
  ON student_guardians(guardian_id);

CREATE INDEX idx_student_guardians_tenant
  ON student_guardians(tenant_id);

COMMIT;
