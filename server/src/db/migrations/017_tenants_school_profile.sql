-- =====================================================
-- MIGRATION: 017_tenants_school_profile
-- FREEZE VERSION: v5.0
-- DATE: 2026-03-12
-- M-036 (Freeze numbering): School profile / branding columns on tenants.
--
-- These fields drive the white-label branding of the tenant-app:
--   logo_url              — Cloudflare R2 public URL for school logo
--   address               — mailing/campus address
--   phone                 — main school phone number
--   email                 — school contact email
--   website               — school website URL
--   branding_color        — hex color (e.g. #1A5276) used for theme customisation
--   principal_name        — displayed on report cards
--   principal_signature_url — R2 public URL for scanned principal signature image
--   active_levels         — array of StudentLevel enum values this school uses
-- =====================================================

BEGIN;

ALTER TABLE tenants
  ADD COLUMN logo_url                 TEXT          DEFAULT NULL,
  ADD COLUMN address                  TEXT          DEFAULT NULL,
  ADD COLUMN phone                    VARCHAR(30)   DEFAULT NULL,
  ADD COLUMN email                    VARCHAR(254)  DEFAULT NULL,
  ADD COLUMN website                  TEXT          DEFAULT NULL,
  ADD COLUMN branding_color           VARCHAR(7)    DEFAULT NULL
    CHECK(branding_color IS NULL OR branding_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN principal_name           VARCHAR(200)  DEFAULT NULL,
  ADD COLUMN principal_signature_url  TEXT          DEFAULT NULL,
  ADD COLUMN active_levels            VARCHAR(50)[] DEFAULT NULL;

-- Index for tenants that have a branding color configured (runtime theme lookup)
CREATE INDEX idx_tenants_branding ON tenants(id) WHERE branding_color IS NOT NULL;

COMMIT;
