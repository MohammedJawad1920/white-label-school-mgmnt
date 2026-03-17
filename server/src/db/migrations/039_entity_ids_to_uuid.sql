-- =====================================================
-- MIGRATION: 039_entity_ids_to_uuid
-- DATE: 2026-03-15
--
-- WHY: Migration 018 converted tenants.id VARCHAR→UUID.
-- Migrations 019–038 (Phase 1+2) create new tables with
-- UUID-typed FK references to academic_sessions, students,
-- users, batches, classes, subjects, school_periods,
-- timeslots, and events. Those FKs cannot be implemented
-- while the referenced id columns are still VARCHAR(50).
--
-- All tenant-scoped data was already deleted by migration 018
-- (TRUNCATE tenants CASCADE), so all affected tables are empty.
-- The type conversion is therefore non-destructive (0 rows).
--
-- WHAT CHANGES (all tables are empty — no data loss):
--   users.id              VARCHAR(50) → UUID  (+ DEFAULT gen_random_uuid())
--   batches.id            VARCHAR(50) → UUID
--   subjects.id           VARCHAR(50) → UUID
--   classes.id            VARCHAR(50) → UUID
--   students.id           VARCHAR(50) → UUID
--   school_periods.id     VARCHAR(50) → UUID
--   timeslots.id          VARCHAR(50) → UUID
--   attendance_records.id VARCHAR(50) → UUID
--   events.id             VARCHAR(50) → UUID
--   academic_sessions.id  VARCHAR(50) → UUID
--   promotion_logs.id     VARCHAR(50) → UUID
--   promotion_previews.id VARCHAR(50) → UUID
--
--   Plus all FK columns referencing the above tables.
--
-- NOT converted (intentional):
--   superadmins.id  — not referenced by Phase 1+2 tables
--   features.key    — semantic string key, not a UUID
--   tenant_features.feature_key — semantic string key
-- =====================================================

BEGIN;

-- ─────────────────────────────────────────────────────
-- STEP 1: Drop all FK constraints on non-tenant tables
-- (tenant_id FKs → tenants were re-added by migration 018)
-- ─────────────────────────────────────────────────────

-- attendance_records
ALTER TABLE attendance_records
  DROP CONSTRAINT attendance_records_recorded_by_fkey,
  DROP CONSTRAINT attendance_records_student_id_fkey,
  DROP CONSTRAINT attendance_records_timeslot_id_fkey,
  DROP CONSTRAINT attendance_records_updated_by_fkey;

-- batches
ALTER TABLE batches
  DROP CONSTRAINT batches_entry_session_id_fkey;

-- classes
ALTER TABLE classes
  DROP CONSTRAINT classes_batch_id_fkey,
  DROP CONSTRAINT classes_class_teacher_id_fkey,
  DROP CONSTRAINT classes_session_id_fkey;

-- events
ALTER TABLE events
  DROP CONSTRAINT events_created_by_fkey;

-- promotion_logs
ALTER TABLE promotion_logs
  DROP CONSTRAINT promotion_logs_committed_by_fkey,
  DROP CONSTRAINT promotion_logs_rolled_back_by_fkey,
  DROP CONSTRAINT promotion_logs_source_session_id_fkey,
  DROP CONSTRAINT promotion_logs_target_session_id_fkey;

-- promotion_previews
ALTER TABLE promotion_previews
  DROP CONSTRAINT promotion_previews_source_session_id_fkey;

-- students
ALTER TABLE students
  DROP CONSTRAINT students_batch_id_fkey,
  DROP CONSTRAINT students_class_id_fkey,
  DROP CONSTRAINT students_user_id_fkey;

-- timeslots
ALTER TABLE timeslots
  DROP CONSTRAINT timeslots_class_id_fkey,
  DROP CONSTRAINT timeslots_subject_id_fkey,
  DROP CONSTRAINT timeslots_teacher_id_fkey;

-- ─────────────────────────────────────────────────────
-- STEP 2: Drop DEFAULT NULL::character varying on nullable
-- FK columns — PostgreSQL cannot auto-cast this expression
-- to UUID. These defaults are NULL so dropping them is safe.
-- ─────────────────────────────────────────────────────

ALTER TABLE attendance_records  ALTER COLUMN updated_by       DROP DEFAULT;
ALTER TABLE batches             ALTER COLUMN entry_session_id DROP DEFAULT;
ALTER TABLE classes             ALTER COLUMN class_teacher_id DROP DEFAULT;
ALTER TABLE classes             ALTER COLUMN session_id       DROP DEFAULT;
ALTER TABLE promotion_logs      ALTER COLUMN rolled_back_by   DROP DEFAULT;
ALTER TABLE students            ALTER COLUMN user_id          DROP DEFAULT;

-- ─────────────────────────────────────────────────────
-- STEP 3: Convert primary key id columns to UUID
-- All tables are empty — USING clause runs on 0 rows.
-- ─────────────────────────────────────────────────────

ALTER TABLE users
  ALTER COLUMN id TYPE UUID USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE batches
  ALTER COLUMN id TYPE UUID USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE subjects
  ALTER COLUMN id TYPE UUID USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE classes
  ALTER COLUMN id TYPE UUID USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE students
  ALTER COLUMN id TYPE UUID USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE school_periods
  ALTER COLUMN id TYPE UUID USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE timeslots
  ALTER COLUMN id TYPE UUID USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE attendance_records
  ALTER COLUMN id TYPE UUID USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE events
  ALTER COLUMN id TYPE UUID USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE academic_sessions
  ALTER COLUMN id TYPE UUID USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE promotion_logs
  ALTER COLUMN id TYPE UUID USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE promotion_previews
  ALTER COLUMN id TYPE UUID USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ─────────────────────────────────────────────────────
-- STEP 4: Convert FK columns that reference the above tables
-- ─────────────────────────────────────────────────────

-- attendance_records FK columns
ALTER TABLE attendance_records
  ALTER COLUMN student_id   TYPE UUID USING student_id::uuid,
  ALTER COLUMN timeslot_id  TYPE UUID USING timeslot_id::uuid,
  ALTER COLUMN recorded_by  TYPE UUID USING recorded_by::uuid,
  ALTER COLUMN updated_by   TYPE UUID USING updated_by::uuid;

-- batches FK columns (entry_session_id is nullable)
ALTER TABLE batches
  ALTER COLUMN entry_session_id TYPE UUID USING entry_session_id::uuid;

-- classes FK columns
ALTER TABLE classes
  ALTER COLUMN batch_id         TYPE UUID USING batch_id::uuid,
  ALTER COLUMN class_teacher_id TYPE UUID USING class_teacher_id::uuid,
  ALTER COLUMN session_id       TYPE UUID USING session_id::uuid;

-- events FK columns
ALTER TABLE events
  ALTER COLUMN created_by TYPE UUID USING created_by::uuid;

-- promotion_logs FK columns (some nullable)
ALTER TABLE promotion_logs
  ALTER COLUMN source_session_id TYPE UUID USING source_session_id::uuid,
  ALTER COLUMN target_session_id TYPE UUID USING target_session_id::uuid,
  ALTER COLUMN committed_by      TYPE UUID USING committed_by::uuid,
  ALTER COLUMN rolled_back_by    TYPE UUID USING rolled_back_by::uuid;

-- Note: promotion_logs.batch_id, from_class_id, to_class_id are added by
-- migration 025 (after this migration), so they do not exist here yet.

-- promotion_previews FK columns
ALTER TABLE promotion_previews
  ALTER COLUMN source_session_id TYPE UUID USING source_session_id::uuid;

-- students FK columns (class_id is nullable — graduated)
ALTER TABLE students
  ALTER COLUMN user_id   TYPE UUID USING user_id::uuid,
  ALTER COLUMN batch_id  TYPE UUID USING batch_id::uuid,
  ALTER COLUMN class_id  TYPE UUID USING class_id::uuid;

-- timeslots FK columns
ALTER TABLE timeslots
  ALTER COLUMN class_id   TYPE UUID USING class_id::uuid,
  ALTER COLUMN subject_id TYPE UUID USING subject_id::uuid,
  ALTER COLUMN teacher_id TYPE UUID USING teacher_id::uuid;

-- ─────────────────────────────────────────────────────
-- STEP 5: Re-add FK constraints
-- ─────────────────────────────────────────────────────

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id),
  ADD CONSTRAINT attendance_records_timeslot_id_fkey
    FOREIGN KEY (timeslot_id) REFERENCES timeslots(id),
  ADD CONSTRAINT attendance_records_recorded_by_fkey
    FOREIGN KEY (recorded_by) REFERENCES users(id),
  ADD CONSTRAINT attendance_records_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES users(id);

ALTER TABLE batches
  ADD CONSTRAINT batches_entry_session_id_fkey
    FOREIGN KEY (entry_session_id) REFERENCES academic_sessions(id);

ALTER TABLE classes
  ADD CONSTRAINT classes_batch_id_fkey
    FOREIGN KEY (batch_id) REFERENCES batches(id),
  ADD CONSTRAINT classes_class_teacher_id_fkey
    FOREIGN KEY (class_teacher_id) REFERENCES users(id),
  ADD CONSTRAINT classes_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES academic_sessions(id);

ALTER TABLE events
  ADD CONSTRAINT events_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE promotion_logs
  ADD CONSTRAINT promotion_logs_source_session_id_fkey
    FOREIGN KEY (source_session_id) REFERENCES academic_sessions(id),
  ADD CONSTRAINT promotion_logs_target_session_id_fkey
    FOREIGN KEY (target_session_id) REFERENCES academic_sessions(id),
  ADD CONSTRAINT promotion_logs_committed_by_fkey
    FOREIGN KEY (committed_by) REFERENCES users(id),
  ADD CONSTRAINT promotion_logs_rolled_back_by_fkey
    FOREIGN KEY (rolled_back_by) REFERENCES users(id);

ALTER TABLE promotion_previews
  ADD CONSTRAINT promotion_previews_source_session_id_fkey
    FOREIGN KEY (source_session_id) REFERENCES academic_sessions(id);

ALTER TABLE students
  ADD CONSTRAINT students_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id),
  ADD CONSTRAINT students_batch_id_fkey
    FOREIGN KEY (batch_id) REFERENCES batches(id),
  ADD CONSTRAINT students_class_id_fkey
    FOREIGN KEY (class_id) REFERENCES classes(id);

ALTER TABLE timeslots
  ADD CONSTRAINT timeslots_class_id_fkey
    FOREIGN KEY (class_id) REFERENCES classes(id),
  ADD CONSTRAINT timeslots_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
  ADD CONSTRAINT timeslots_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES users(id);

COMMIT;
