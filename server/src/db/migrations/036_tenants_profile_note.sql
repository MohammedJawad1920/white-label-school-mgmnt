-- =====================================================
-- MIGRATION: 036_tenants_profile_note
-- FREEZE VERSION: v5.0 (M-036)
-- DATE: 2026-03-15
--
-- WHY: Freeze v5.0 M-036 specifies adding school profile fields to
-- tenants. These columns were already added in migration 017
-- (017_tenants_school_profile.sql) during Phase 0 implementation.
-- This migration is a documented no-op.
--
-- WHAT CHANGES:
--   tenants  — no changes (profile fields added in migration 017)
-- =====================================================

BEGIN;

-- No-op: tenants profile columns were added in migration 017.
-- Logo_url, address, phone, email, website, branding_color,
-- principal_name, principal_signature_url, and active_levels
-- already exist on the tenants table.

COMMIT;
