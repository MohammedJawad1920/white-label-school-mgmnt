-- =====================================================
-- MIGRATION: 022_push_subscriptions
-- FREEZE VERSION: v5.0 (M-022)
-- DATE: 2026-03-15
--
-- WHY: PWA push notifications require storing VAPID push subscription
-- endpoints per user per device.
--
-- WHAT CHANGES:
--   push_subscriptions  — new table
-- =====================================================

BEGIN;

CREATE TABLE push_subscriptions (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id    UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  endpoint     TEXT          NOT NULL,
  p256dh       TEXT          NOT NULL,
  auth         TEXT          NOT NULL,
  device_label VARCHAR(100)  DEFAULT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_user
  ON push_subscriptions(user_id);

CREATE INDEX idx_push_tenant
  ON push_subscriptions(tenant_id);

COMMIT;
