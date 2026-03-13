-- =====================================================
-- MIGRATION: 011_users_must_change_password
-- FREEZE VERSION: v5.0
-- DATE: 2026-03-12
-- Part of M-012 (Freeze numbering): forced password-change flag on users.
--
-- When must_change_password = true, all protected routes redirect the client
-- to /change-password. The flag is reset to false in the same transaction
-- that sets the new password hash in POST /auth/change-password.
-- =====================================================

BEGIN;

ALTER TABLE users
  ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;

COMMIT;
