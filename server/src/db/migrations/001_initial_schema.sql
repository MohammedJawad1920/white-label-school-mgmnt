-- =====================================================
-- MIGRATION: 001_initial_schema
-- FREEZE VERSION: v3.3
-- DATE: 2026-02-26
-- 
-- Creates all 12 tables required by Freeze v3.3.
-- Run once on a fresh database.
-- To roll back: DROP SCHEMA public CASCADE; CREATE SCHEMA public;
-- =====================================================

-- Enable idempotency (safe to re-run only for CREATE EXTENSION)
-- No extensions required per Freeze §2.

BEGIN;

-- =====================================================
-- TABLE 1: TENANTS
-- v3.2: Added status, deactivated_at
-- =====================================================
CREATE TABLE tenants (
  id             VARCHAR(50)  PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  slug           VARCHAR(100) UNIQUE NOT NULL,
  status         VARCHAR(20)  NOT NULL DEFAULT 'active'
                   CHECK(status IN ('active', 'inactive')),
  deactivated_at TIMESTAMPTZ  DEFAULT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug   ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);

-- =====================================================
-- TABLE 2: SUPERADMINS
-- v3.2: NEW — platform-level, no tenant_id
-- =====================================================
CREATE TABLE superadmins (
  id            VARCHAR(50)  PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_superadmins_email ON superadmins(email);

-- =====================================================
-- TABLE 3: USERS (Teachers and Admins — tenant-scoped)
-- v3.1: Added deleted_at, soft-delete partial unique index
-- =====================================================
CREATE TABLE users (
  id            VARCHAR(50)  PRIMARY KEY,
  tenant_id     VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  roles         JSONB        NOT NULL DEFAULT '["Teacher"]'::jsonb,
  deleted_at    TIMESTAMPTZ  DEFAULT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_tenant_id  ON users(tenant_id);
CREATE INDEX idx_users_email      ON users(tenant_id, email);
CREATE INDEX idx_users_roles      ON users USING GIN(roles);
CREATE INDEX idx_users_deleted    ON users(tenant_id, deleted_at) WHERE deleted_at IS NULL;
-- Allows email reuse after soft-delete (same tenant, active users only)
CREATE UNIQUE INDEX idx_users_email_active ON users(tenant_id, email) WHERE deleted_at IS NULL;

-- =====================================================
-- TABLE 4: BATCHES (Academic Years)
-- v3.1: Added deleted_at
-- =====================================================
CREATE TABLE batches (
  id         VARCHAR(50)  PRIMARY KEY,
  tenant_id  VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  start_year INTEGER      NOT NULL,
  end_year   INTEGER      NOT NULL,
  status     VARCHAR(50)  NOT NULL DEFAULT 'Active'
               CHECK(status IN ('Active', 'Archived')),
  deleted_at TIMESTAMPTZ  DEFAULT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batches_tenant_id ON batches(tenant_id);
CREATE INDEX idx_batches_status    ON batches(tenant_id, status);
CREATE INDEX idx_batches_deleted   ON batches(tenant_id, deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- TABLE 5: SUBJECTS
-- v3.1: Added deleted_at
-- =====================================================
CREATE TABLE subjects (
  id         VARCHAR(50)  PRIMARY KEY,
  tenant_id  VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  code       VARCHAR(50),
  deleted_at TIMESTAMPTZ  DEFAULT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subjects_tenant_id ON subjects(tenant_id);
CREATE INDEX idx_subjects_deleted   ON subjects(tenant_id, deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- TABLE 6: CLASSES
-- v3.1: Added deleted_at
-- =====================================================
CREATE TABLE classes (
  id         VARCHAR(50)  PRIMARY KEY,
  tenant_id  VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  batch_id   VARCHAR(50)  NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  deleted_at TIMESTAMPTZ  DEFAULT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_classes_tenant_id ON classes(tenant_id);
CREATE INDEX idx_classes_batch_id  ON classes(batch_id);
CREATE INDEX idx_classes_deleted   ON classes(tenant_id, deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- TABLE 7: STUDENTS
-- v3.1: Added deleted_at
-- =====================================================
CREATE TABLE students (
  id         VARCHAR(50)  PRIMARY KEY,
  tenant_id  VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  class_id   VARCHAR(50)  NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  batch_id   VARCHAR(50)  NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  deleted_at TIMESTAMPTZ  DEFAULT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_tenant_id ON students(tenant_id);
CREATE INDEX idx_students_class_id  ON students(class_id);
CREATE INDEX idx_students_batch_id  ON students(batch_id);
CREATE INDEX idx_students_deleted   ON students(tenant_id, deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- TABLE 8: SCHOOL_PERIODS (v3.3: NEW)
-- Dynamic per-tenant period configuration.
-- periodNumber is immutable after creation (enforced at app layer).
-- Replaces hardcoded period_number <= 10 constraint on timeslots.
-- =====================================================
CREATE TABLE school_periods (
  id            VARCHAR(50)  PRIMARY KEY,
  tenant_id     VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_number INTEGER      NOT NULL CHECK(period_number >= 1),
  label         VARCHAR(100) NOT NULL DEFAULT '',
  start_time    TIME         NOT NULL,
  end_time      TIME         NOT NULL,
  -- startTime < endTime enforced at app layer (PERIOD_TIME_INVALID)
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, period_number)
);

CREATE INDEX idx_school_periods_tenant ON school_periods(tenant_id);

-- =====================================================
-- TABLE 9: TIMESLOTS (Immutable Timetable Versioning)
-- v3.3: Removed CHECK constraint upper bound on period_number
-- v3.3: start_time/end_time kept for backward compat but derived from school_periods at read
-- =====================================================
CREATE TABLE timeslots (
  id             VARCHAR(50)  PRIMARY KEY,
  tenant_id      VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id       VARCHAR(50)  NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id     VARCHAR(50)  NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  teacher_id     VARCHAR(50)  NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  day_of_week    VARCHAR(20)  NOT NULL
                   CHECK(day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  period_number  INTEGER      NOT NULL CHECK(period_number >= 1),
  start_time     TIME,
  end_time       TIME,
  effective_from DATE         NOT NULL,
  effective_to   DATE,
  deleted_at     TIMESTAMPTZ  DEFAULT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timeslots_tenant_id        ON timeslots(tenant_id);
CREATE INDEX idx_timeslots_class_id         ON timeslots(class_id);
CREATE INDEX idx_timeslots_teacher_id       ON timeslots(teacher_id);
CREATE INDEX idx_timeslots_effective_dates  ON timeslots(effective_from, effective_to);
CREATE INDEX idx_timeslots_deleted          ON timeslots(tenant_id, deleted_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_timeslots_active_unique
  ON timeslots(tenant_id, class_id, day_of_week, period_number)
  WHERE effective_to IS NULL AND deleted_at IS NULL;

-- =====================================================
-- TABLE 10: ATTENDANCE_RECORDS
-- =====================================================
CREATE TABLE attendance_records (
  id           VARCHAR(50)  PRIMARY KEY,
  tenant_id    VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id   VARCHAR(50)  NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  timeslot_id  VARCHAR(50)  NOT NULL REFERENCES timeslots(id) ON DELETE CASCADE,
  date         DATE         NOT NULL,
  status       VARCHAR(50)  NOT NULL CHECK(status IN ('Present', 'Absent', 'Late')),
  recorded_by  VARCHAR(50)  NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, timeslot_id, date)
);

CREATE INDEX idx_attendance_tenant_id        ON attendance_records(tenant_id);
CREATE INDEX idx_attendance_student_id       ON attendance_records(student_id);
CREATE INDEX idx_attendance_timeslot_id      ON attendance_records(timeslot_id);
CREATE INDEX idx_attendance_date             ON attendance_records(date);
CREATE INDEX idx_attendance_student_date     ON attendance_records(student_id, date);

-- =====================================================
-- TABLE 11: FEATURES (System-wide Module Definitions — no soft delete)
-- =====================================================
CREATE TABLE features (
  id          VARCHAR(50)  PRIMARY KEY,
  key         VARCHAR(100) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed the two MVP features (immutable system data)
INSERT INTO features (id, key, name, description) VALUES
  ('F001', 'timetable',  'Timetable Management',  'Create and manage class schedules with teacher assignments'),
  ('F002', 'attendance', 'Attendance Tracking',    'Record and view student attendance per class period');

-- =====================================================
-- TABLE 12: TENANT_FEATURES (Per-Tenant Module Activation — no soft delete)
-- =====================================================
CREATE TABLE tenant_features (
  id          VARCHAR(50)  PRIMARY KEY,
  tenant_id   VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL REFERENCES features(key) ON DELETE CASCADE,
  enabled     BOOLEAN      NOT NULL DEFAULT FALSE,
  enabled_at  TIMESTAMPTZ,
  UNIQUE(tenant_id, feature_key)
);

CREATE INDEX idx_tenant_features_tenant_id ON tenant_features(tenant_id);
CREATE INDEX idx_tenant_features_enabled   ON tenant_features(tenant_id, enabled);

COMMIT;