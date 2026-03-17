-- =====================================================
-- MIGRATION: 023_notifications
-- FREEZE VERSION: v5.0 (M-023)
-- DATE: 2026-03-15
--
-- WHY: In-app notification centre requires a per-user notification
-- table that stores typed event notifications with read state.
--
-- WHAT CHANGES:
--   notifications  — new table
-- =====================================================

BEGIN;

CREATE TABLE notifications (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(100)  NOT NULL,
  title           VARCHAR(255)  NOT NULL,
  body            TEXT          NOT NULL,
  data            JSONB         DEFAULT NULL,
  read_at         TIMESTAMPTZ   DEFAULT NULL,
  push_sent_at    TIMESTAMPTZ   DEFAULT NULL,
  push_delivered  BOOLEAN       DEFAULT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user
  ON notifications(user_id, read_at);

CREATE INDEX idx_notifications_tenant
  ON notifications(tenant_id, created_at DESC);

COMMIT;
