-- =====================================================
-- MIGRATION: 032_fee_charges
-- FREEZE VERSION: v5.0 (M-032)
-- DATE: 2026-03-15
--
-- WHY: Fee management requires tracking charges raised against
-- students per session. Balance is computed (amount - total_paid)
-- not stored. Payments recorded in fee_payments (migration 033).
--
-- WHAT CHANGES:
--   fee_charges  — new table
-- =====================================================

BEGIN;

CREATE TABLE fee_charges (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id   UUID         NOT NULL REFERENCES students(id),
  session_id   UUID         NOT NULL REFERENCES academic_sessions(id),
  description  VARCHAR(255) NOT NULL,
  category     VARCHAR(50)  NOT NULL
                 CHECK(category IN ('BoardExamFee', 'UniversityExamFee', 'InternalExamFee', 'Books', 'Other')),
  amount       NUMERIC(10,2) NOT NULL
                 CHECK(amount > 0),
  due_date     DATE          DEFAULT NULL,
  raised_by    UUID         NOT NULL REFERENCES users(id),
  notes        TEXT          DEFAULT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_charges_student
  ON fee_charges(student_id);

CREATE INDEX idx_charges_session
  ON fee_charges(session_id);

CREATE INDEX idx_charges_tenant_session
  ON fee_charges(tenant_id, session_id);

COMMIT;
