-- =====================================================
-- MIGRATION: 020_guardians
-- FREEZE VERSION: v5.0 (M-020)
-- DATE: 2026-03-15
--
-- WHY: Guardian management requires a guardians table to store
-- guardian contact info and a linking table to associate
-- guardians with multiple students.
--
-- WHAT CHANGES:
--   guardians  — new table
-- =====================================================

BEGIN;

CREATE TABLE guardians (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  phone            VARCHAR(20)  NOT NULL,
  email            VARCHAR(255) DEFAULT NULL,
  relationship     VARCHAR(100) DEFAULT NULL,
  is_primary       BOOLEAN      NOT NULL DEFAULT false,
  can_submit_leave BOOLEAN      NOT NULL DEFAULT true,
  user_id          UUID         REFERENCES users(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ  DEFAULT NULL
);

CREATE INDEX idx_guardians_tenant
  ON guardians(tenant_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_guardians_user
  ON guardians(user_id)
  WHERE user_id IS NOT NULL AND deleted_at IS NULL;

COMMIT;
