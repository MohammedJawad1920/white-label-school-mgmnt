-- =====================================================
-- MIGRATION: 019_leave_requests
-- FREEZE VERSION: v5.0 (M-019)
-- DATE: 2026-03-15
--
-- WHY: Leave management module requires a table to track student
-- leave requests through the full state machine:
--   PENDING → APPROVED → ACTIVE → COMPLETED | OVERDUE
--   PENDING → REJECTED | CANCELLED
--
-- WHAT CHANGES:
--   leave_requests  — new table
-- =====================================================

BEGIN;

CREATE TABLE leave_requests (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id            UUID         NOT NULL REFERENCES academic_sessions(id),
  student_id            UUID         NOT NULL REFERENCES students(id),
  requested_by_user_id  UUID         NOT NULL REFERENCES users(id),
  requested_by_role     VARCHAR(50)  NOT NULL
                          CHECK(requested_by_role IN ('Guardian', 'ClassTeacher', 'Admin')),
  proxy_for             VARCHAR(50)  DEFAULT NULL,
  leave_type            VARCHAR(50)  NOT NULL
                          CHECK(leave_type IN ('HomeVisit', 'Medical', 'Emergency', 'ExternalExam', 'OfficialDuty', 'Personal')),
  duration_type         VARCHAR(20)  NOT NULL
                          CHECK(duration_type IN ('HalfDayAM', 'HalfDayPM', 'FullDay', 'MultiDay')),
  start_date            DATE         NOT NULL,
  end_date              DATE         NOT NULL,
  reason                TEXT         NOT NULL,
  attachment_url        TEXT         DEFAULT NULL,
  status                VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                          CHECK(status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ACTIVE', 'COMPLETED', 'OVERDUE')),
  reviewed_by           UUID         REFERENCES users(id),
  reviewed_at           TIMESTAMPTZ  DEFAULT NULL,
  rejection_reason      TEXT         DEFAULT NULL,
  departed_at           TIMESTAMPTZ  DEFAULT NULL,
  expected_return_at    TIMESTAMPTZ  NOT NULL,
  returned_at           TIMESTAMPTZ  DEFAULT NULL,
  return_noted_by       UUID         REFERENCES users(id),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_leave_dates CHECK(end_date >= start_date)
);

CREATE INDEX idx_leave_student
  ON leave_requests(student_id, status);

CREATE INDEX idx_leave_tenant_status
  ON leave_requests(tenant_id, status);

CREATE INDEX idx_leave_tenant_session
  ON leave_requests(tenant_id, session_id);

-- Partial index for overdue detection cron job
CREATE INDEX idx_leave_overdue
  ON leave_requests(tenant_id, expected_return_at)
  WHERE status = 'ACTIVE';

-- Note: no deleted_at on leave_requests (immutable audit trail)

COMMIT;
