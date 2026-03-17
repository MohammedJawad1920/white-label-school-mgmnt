-- =====================================================
-- MIGRATION: 033_fee_payments
-- FREEZE VERSION: v5.0 (M-033)
-- DATE: 2026-03-15
--
-- WHY: Records cash payments against fee charges. Balance =
-- fee_charges.amount - SUM(fee_payments.amount_paid).
-- Overpayment is blocked at the application layer.
--
-- WHAT CHANGES:
--   fee_payments  — new table
-- =====================================================

BEGIN;

CREATE TABLE fee_payments (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  charge_id       UUID         NOT NULL REFERENCES fee_charges(id),
  student_id      UUID         NOT NULL REFERENCES students(id),
  amount_paid     NUMERIC(10,2) NOT NULL
                    CHECK(amount_paid > 0),
  payment_mode    VARCHAR(20)  NOT NULL DEFAULT 'Cash'
                    CHECK(payment_mode IN ('Cash', 'SelfPaid')),
  paid_at         DATE         NOT NULL,
  receipt_number  VARCHAR(100) DEFAULT NULL,
  recorded_by     UUID         NOT NULL REFERENCES users(id),
  notes           TEXT         DEFAULT NULL,
  recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_charge
  ON fee_payments(charge_id);

CREATE INDEX idx_payments_student
  ON fee_payments(student_id);

COMMIT;
