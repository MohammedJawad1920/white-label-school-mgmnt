-- ============================================
-- TENANTS TABLE
-- ============================================
CREATE TABLE tenants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);

-- ============================================
-- USERS TABLE (Teachers and Admins)
-- ============================================
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    roles JSONB NOT NULL DEFAULT '["Teacher"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(tenant_id, email);
CREATE INDEX idx_users_roles ON users USING GIN (roles);

-- ============================================
-- BATCHES TABLE (Academic Years)
-- ============================================
CREATE TABLE batches (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_year INTEGER NOT NULL,
    end_year INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batches_tenant_id ON batches(tenant_id);
CREATE INDEX idx_batches_status ON batches(tenant_id, status);

-- ============================================
-- SUBJECTS TABLE
-- ============================================
CREATE TABLE subjects (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subjects_tenant_id ON subjects(tenant_id);

-- ============================================
-- CLASSES TABLE
-- ============================================
CREATE TABLE classes (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    batch_id VARCHAR(50) NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_classes_tenant_id ON classes(tenant_id);
CREATE INDEX idx_classes_batch_id ON classes(batch_id);

-- ============================================
-- STUDENTS TABLE
-- ============================================
CREATE TABLE students (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    class_id VARCHAR(50) NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    batch_id VARCHAR(50) NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_tenant_id ON students(tenant_id);
CREATE INDEX idx_students_class_id ON students(class_id);
CREATE INDEX idx_students_batch_id ON students(batch_id);

-- ============================================
-- TIME_SLOTS TABLE (Immutable Timetable Versioning)
-- ============================================
CREATE TABLE time_slots (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    class_id VARCHAR(50) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id VARCHAR(50) NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    period_number INTEGER NOT NULL CHECK (period_number >= 1 AND period_number <= 10),
    start_time TIME,
    end_time TIME,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_time_slots_tenant_id ON time_slots(tenant_id);
CREATE INDEX idx_time_slots_class_id ON time_slots(class_id);
CREATE INDEX idx_time_slots_teacher_id ON time_slots(teacher_id);
CREATE INDEX idx_time_slots_effective_dates ON time_slots(effective_from, effective_to);
CREATE UNIQUE INDEX idx_time_slots_active_unique ON time_slots(tenant_id, class_id, day_of_week, period_number) WHERE effective_to IS NULL;

-- ============================================
-- ATTENDANCE_RECORDS TABLE
-- ============================================
CREATE TABLE attendance_records (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    time_slot_id VARCHAR(50) NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('Present', 'Absent', 'Late')),
    recorded_by VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, time_slot_id, date)
);

CREATE INDEX idx_attendance_tenant_id ON attendance_records(tenant_id);
CREATE INDEX idx_attendance_student_id ON attendance_records(student_id);
CREATE INDEX idx_attendance_time_slot_id ON attendance_records(time_slot_id);
CREATE INDEX idx_attendance_date ON attendance_records(date);
CREATE INDEX idx_attendance_student_date_range ON attendance_records(student_id, date);

-- ============================================
-- FEATURES TABLE (System-wide Module Definitions)
-- ============================================
CREATE TABLE features (
    id VARCHAR(50) PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Data (Insert during initial migration)
INSERT INTO features (id, key, name, description) VALUES
('F001', 'timetable', 'Timetable Management', 'Create and manage class schedules with teacher assignments'),
('F002', 'attendance', 'Attendance Tracking', 'Record and view student attendance per class period');

-- ============================================
-- TENANT_FEATURES TABLE (Per-Tenant Module Activation)
-- ============================================
CREATE TABLE tenant_features (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL REFERENCES features(key) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    enabled_at TIMESTAMPTZ,
    UNIQUE(tenant_id, feature_key)
);

CREATE INDEX idx_tenant_features_tenant_id ON tenant_features(tenant_id);
CREATE INDEX idx_tenant_features_enabled ON tenant_features(tenant_id, enabled);
