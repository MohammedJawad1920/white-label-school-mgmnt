-- Migration 005: Add timezone column to tenants table
-- v3.6 CR-17: All DATE comparisons use tenants.timezone, not server timezone.
-- Default: Asia/Kolkata (matches system context where this was designed).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata';
