-- Migration 004 — v3.5 CR-13
-- Adds admission_number and dob to students; unique partial index per tenant.
-- Any existing rows get placeholder values before NOT NULL constraint is applied.

ALTER TABLE students ADD COLUMN admission_number VARCHAR(50);
ALTER TABLE students ADD COLUMN dob DATE;

-- Back-fill existing rows with safe placeholder values
UPDATE students SET admission_number = id, dob = '2000-01-01' WHERE admission_number IS NULL;

ALTER TABLE students ALTER COLUMN admission_number SET NOT NULL;
ALTER TABLE students ALTER COLUMN dob SET NOT NULL;

-- Unique admission number per tenant (active records only)
CREATE UNIQUE INDEX uq_students_tenant_admission
  ON students(tenant_id, admission_number)
  WHERE deleted_at IS NULL;
