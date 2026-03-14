-- =====================================================
-- MIGRATION: 018_tenants_uuid_primary_key
-- DATE: 2026-03-14
--
-- Converts tenants.id from VARCHAR(50) to UUID.
--
-- WHY: The Frontend Freeze §1.5 mandates that VITE_TENANT_ID is a
-- valid UUID. The original schema used a manually-typed VARCHAR(50)
-- primary key (e.g. "T-b83beaf6-..."), which conflicts with that
-- requirement and is made redundant by the existing `slug` column
-- that already serves as the human-readable tenant identifier.
--
-- WHAT CHANGES:
--   tenants.id            VARCHAR(50) → UUID (DEFAULT gen_random_uuid())
--   All tenant_id FK cols VARCHAR(50) → UUID  (13 tables)
--
-- DESTRUCTIVE: All tenant rows and all tenant-scoped data are deleted
-- before the type change (confirmed by operator). Superadmin accounts
-- are NOT affected.
--
-- After running this migration:
--   1. Create a new tenant via the SuperAdmin app.
--   2. Copy the returned UUID.
--   3. Set VITE_TENANT_ID=<uuid> in apps/tenant-app/.env and restart.
-- =====================================================

BEGIN;

-- ── Step 1: Delete all tenant data (operator confirmed) ──────────────────────
-- CASCADE propagates to every table with a FK chain to tenants(id).
TRUNCATE tenants CASCADE;

-- ── Step 2: Drop all FK constraints that reference tenants(id) ───────────────
-- Required before altering the referenced column type.
ALTER TABLE users              DROP CONSTRAINT users_tenant_id_fkey;
ALTER TABLE batches            DROP CONSTRAINT batches_tenant_id_fkey;
ALTER TABLE subjects           DROP CONSTRAINT subjects_tenant_id_fkey;
ALTER TABLE classes            DROP CONSTRAINT classes_tenant_id_fkey;
ALTER TABLE students           DROP CONSTRAINT students_tenant_id_fkey;
ALTER TABLE school_periods     DROP CONSTRAINT school_periods_tenant_id_fkey;
ALTER TABLE timeslots          DROP CONSTRAINT timeslots_tenant_id_fkey;
ALTER TABLE attendance_records DROP CONSTRAINT attendance_records_tenant_id_fkey;
ALTER TABLE tenant_features    DROP CONSTRAINT tenant_features_tenant_id_fkey;
ALTER TABLE events             DROP CONSTRAINT events_tenant_id_fkey;
ALTER TABLE academic_sessions  DROP CONSTRAINT academic_sessions_tenant_id_fkey;
ALTER TABLE promotion_previews DROP CONSTRAINT promotion_previews_tenant_id_fkey;
ALTER TABLE promotion_logs     DROP CONSTRAINT promotion_logs_tenant_id_fkey;

-- ── Step 3: Convert tenants.id to UUID ───────────────────────────────────────
-- Table is empty after TRUNCATE, so USING clause runs on 0 rows.
ALTER TABLE tenants
  ALTER COLUMN id TYPE UUID USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ── Step 4: Convert all tenant_id FK columns to UUID ─────────────────────────
ALTER TABLE users              ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE batches            ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE subjects           ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE classes            ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE students           ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE school_periods     ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE timeslots          ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE attendance_records ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE tenant_features    ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE events             ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE academic_sessions  ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE promotion_previews ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE promotion_logs     ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;

-- ── Step 5: Re-add FK constraints (same semantics as original) ────────────────
ALTER TABLE users
  ADD CONSTRAINT users_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE batches
  ADD CONSTRAINT batches_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE subjects
  ADD CONSTRAINT subjects_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE classes
  ADD CONSTRAINT classes_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE students
  ADD CONSTRAINT students_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE school_periods
  ADD CONSTRAINT school_periods_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE timeslots
  ADD CONSTRAINT timeslots_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE tenant_features
  ADD CONSTRAINT tenant_features_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE events
  ADD CONSTRAINT events_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE academic_sessions
  ADD CONSTRAINT academic_sessions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE promotion_previews
  ADD CONSTRAINT promotion_previews_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE promotion_logs
  ADD CONSTRAINT promotion_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

COMMIT;
