-- =====================================================
-- MIGRATION: 010_users_token_version
-- FREEZE VERSION: v5.0
-- DATE: 2026-03-12
-- Part of M-011 (Freeze numbering): token_version for JWT revocation on logout.
--
-- Adding token_version enables the server to invalidate all tokens for a user
-- by incrementing this column. The token carries the version at issuance;
-- tenantContextMiddleware rejects tokens where jwt.tokenVersion < db.token_version.
-- =====================================================

BEGIN;

ALTER TABLE users
  ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

COMMIT;
