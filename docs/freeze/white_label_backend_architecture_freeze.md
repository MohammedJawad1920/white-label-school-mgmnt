# BACKEND PROJECT FREEZE: White-Label School Management System

**Version:** 4.0 (IMMUTABLE)
**Date:** 2026-03-05
**Status:** APPROVED FOR EXECUTION
**Previous Version:** v3.6 — 2026-03-03

> **CRITICAL INSTRUCTION FOR EXECUTION (HUMAN OR AI):**
> This document is the Absolute Source of Truth. You have NO authority to modify schema, API
> contracts, or scope defined below. If any request contradicts this document, you must REFUSE
> and open a Change Request instead.

***

## CHANGE SUMMARY v3.6 → v4.0

### CRs Applied

- **CR-20** Optional teacher password + auto-generated temporary password — Additive
- **CR-21** Graduation action in promote + `students.classid` nullable — Additive + Schema
- **CR-22** Student `status` field (`Active`, `DroppedOff`, `Graduated`) — Additive
- **CR-23** Batch status rename `Archived` → `Graduated` — **Breaking**

### What Changed

- `POST /api/users`: `password` is now optional. If omitted, a secure temporary password is auto-generated and returned once as `temporaryPassword` in the `201` response.
- `students.classid` changed from `NOT NULL` to nullable. Graduated students have `classid = NULL`.
- New column `students.status VARCHAR(50) NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','DroppedOff','Graduated'))`.
- `status = 'Graduated'` is system-set only — triggered exclusively by the graduation action in promote. Not writable via `PUT /api/students/:id`.
- `status = 'DroppedOff'` is admin-settable via `PUT /api/students/:id`.
- `PUT /api/classes/:sourceClassId/promote` request body extended: accepts either `{ targetClassId }` (promote) or `{ action: "graduate" }` (graduate). On graduation: `classid = NULL`, `status = 'Graduated'`.
- All `students → classes` joins updated to `LEFT JOIN` throughout.
- `batches.status` enum renamed: `Archived` → `Graduated`. Existing `Archived` rows migrated in-place.
- `GET /api/batches?status=` query param enum updated to `[Active, Graduated]`.
- `Student` OpenAPI schema: `classId` and `className` are now `nullable: true`. `status` field added.
- `Batch` OpenAPI schema: `status` enum updated to `[Active, Graduated]`.
- New error code: `INVALID_PROMOTION_ACTION 400`.
- Two new migrations: `006_student_status_classid_nullable.sql`, `007_batch_status_graduated.sql`.

### Breaking Changes

- `batches.status` enum value `Archived` no longer exists — replaced by `Graduated`. Any frontend, query, or seed data using `Archived` must update.
- `students.classid` is nullable — any query using `INNER JOIN students → classes` without a null guard may silently exclude graduated students or error. All joins must be `LEFT JOIN`.

### New Error Codes (v4.0)

| Code | HTTP | Trigger |
| :-- | :-- | :-- |
| `INVALID_PROMOTION_ACTION` | 400 | Promote body has neither a valid `targetClassId` nor `action: "graduate"` |

### Unchanged from v3.6

- All authentication endpoints
- All timetable endpoints
- All attendance endpoints
- All school-periods endpoints
- All SuperAdmin endpoints
- JWT payload shapes
- Soft-delete policy
- All other invariants not listed above

***

## 0. Commercials (Accept-and-price)

**Engagement Type:** Fixed-scope
**Chosen Package:** Standard
**Price & Payment Schedule:** Unchanged from v3.6
**Timeline Range (weeks):** 8–10
**Assumptions (must be true):**

- Single decision maker available within 24 hours for clarifications
- Staging environment accessible by Week 3

**Support Window (post-delivery):**

- Bugfix support: 30 days
- Enhancements: billed as Change Requests

***

## 1. The "Iron Scope" (Backend only)

**Core Value Proposition (One Sentence):**
> A white-label school management system for small institutions (≤500 students) that provides
> timetable scheduling and attendance tracking, deployable on low-cost infrastructure with
> per-school module activation managed by a central SuperAdmin.

### The 12 Backend User Stories (COMPLETE SCOPE)

1. As a teacher, I want to record student attendance for each class period, so that attendance is captured once and not lost on paper.
2. As a school admin, I want to view a student's complete attendance history, so that I don't have to search through physical records.
3. As a school admin, I want to see a student's attendance summary for a given month, so that I can quickly assess attendance without manual calculation.
4. As a teacher, I want to know which classes I am responsible for today, so that I don't miss or duplicate class sessions.
5. As a teacher, I want to see the full timetable for the current day, so that I can plan my work without asking other staff.
6. As a school admin, I want to know which teacher is assigned to each class, so that classes are not left unattended.
7. As a school admin, I want to identify classes without an assigned teacher, so that I can adjust schedules before students are affected.
8. As a teacher, I want to adjust my class schedule when another teacher is unavailable, so that classes continue without disruption. *(Informal scheduling via empty period utilization, not timeSlot modification.)*
9. As a SuperAdmin, I want to create and manage tenants, so that I can onboard new schools without touching the database.
10. As a SuperAdmin, I want to control which features each tenant can access, so that I can manage product tiers centrally.
11. As a multi-role user, I want to switch my active role context in-session, so that I don't need to log out and log back in to act as Teacher or Admin.
12. As an Admin, I want to bulk-delete records, so that I can clean up data efficiently without repeating individual delete calls.

### The "NO" List (Explicitly Out of Scope for MVP)

- Student enrollment workflow approval/rejection process
- Parent portal or parent role
- SMS/Email notifications
- Grade/exam management
- Fee collection and financial tracking
- Mobile native apps (web-only)
- Real-time collaboration (websockets, live updates)
- Advanced reporting (charts, graphs beyond summary tables)
- Bulk import (CSV upload for students/classes)
- Audit log viewer UI (logs exist, but no interface)
- Custom branding UI (logo upload, theme customization)
- Multi-language support (English only)
- Forgot password flow (admin resets only via DB or Reset Login action)
- Parent communication features
- Library, transportation, hostel management
- Exam scheduling, report card generation
- SuperAdmin self-registration (seeded via DB script only)
- JWT token blacklist (forced invalidation on role update)
- SuperAdmin tenant hard-delete (deactivate/reactivate only)
- Student-to-user bulk linking (CSV import) — deprecated, migration use only
- Student role users creating or managing any resource other than reading own attendance and timetable
- Student self-registration (accounts created only via `POST /api/students` by Admin)

### User Roles (Backend authorization truth)

**SuperAdmin** — Platform-level operator, exists outside tenant scope

- Authenticated via `POST /api/super-admin/auth/login` (no tenantSlug required)
- JWT payload: `{ superAdminId, role: "SuperAdmin" }` — no tenantId
- Can create, list, update, deactivate, and reactivate tenants
- Can enable/disable feature flags for any tenant
- SuperAdmin JWT is rejected by `tenantContextMiddleware`
- SuperAdmin routes use `superAdminAuthMiddleware` exclusively
- Provisioned only via one-time DB seed script — no registration endpoint

**Admin** — Tenant-scoped

- Full CRUD access to all tenant resources (users, batches, subjects, classes, students, timetable, attendance, schoolperiods)
- Can view all reports and summaries
- Can view enabled features (`GET /api/features`), read-only
- Cannot toggle feature flags (`PUT /api/features/:featureKey` removed in v3.2)
- Can end any TimeSlot assignment
- Can update any user's roles including own EXCEPT cannot remove own Admin role if they are the last Admin in the tenant (`LAST_ADMIN`)
- Can bulk-delete users, students, classes, batches, subjects
- Full CRUD on schoolperiods
- Can promote students between classes OR graduate them via `PUT /api/classes/:sourceClassId/promote`
- Can correct any attendance record (`PUT /api/attendance/:recordId`)
- Can set `students.status = 'DroppedOff'` via `PUT /api/students/:id`

**Teacher** — Tenant-scoped

- Can view timetable (all classes, all teachers, read-only)
- Can view own assigned classes
- Can record attendance for own classes
- Can view attendance for students in own classes
- Can view schoolperiods (read-only)
- Can correct attendance records for own-class timeslots only
- Cannot end TimeSlot assignments (Admin-only)

**Student** — Tenant-scoped (v3.4, updated in v3.6)

- Can view timetable (read-only)
- Can view schoolperiods (read-only)
- Can view own attendance: `GET /api/students/:studentId/attendance` where `students.userId = req.user.userId` only — `403 STUDENT_ACCESS_DENIED` otherwise
- Can view own student record: `GET /api/students/:id` where `students.userId = req.user.userId` only — `403 STUDENT_ACCESS_DENIED` otherwise
- Cannot record, correct, or delete any data
- Login credentials: admission number + `DDMMYYYY` of date of birth, concatenated (e.g., `53003102003`)
- Account is auto-created atomically when admin runs `POST /api/students`
- Student accounts are NOT visible in `GET /api/users` or `GET /api/users/:id` — managed exclusively via Students page

**Multiple Roles** (v3.1, unchanged)

- Users can hold multiple roles simultaneously (e.g., Teacher + Admin)
- Authorization checks if user has required role using array membership
- `activeRole` in JWT is a UI context hint only — does NOT gate API access
- All write authorization checks validate against the full `roles` array

### Module Structure

- **Timetable Management** — Core module, can be enabled standalone
- **Attendance Tracking** — Dependent module, REQUIRES Timetable to be enabled

***

## 1.2 Assumptions & External Dependencies

**External Systems:** None

**Operational Assumptions:**

- Hosting: Single monolith deployment — Render/Fly.io/Railway or equivalent ($5–$45/month tier)
- Data retention: Indefinite, no automated deletion
- Expected user scale: 5–50 schools initially, 25,000 total students max, 10 concurrent RPS
- Admin/support operations: Manual DB access for SuperAdmin seeding only

***

## 1.5 System Configuration (The Environment)

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration — PostgreSQL required
DATABASE_URL="postgresql://username:password@localhost:5432/schoolmanagement"
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Authentication & Security
JWT_SECRET="your-256-bit-secret-key-min-32-characters-required"
JWT_EXPIRES_IN=30d
BCRYPT_ROUNDS=10

# Tenant Configuration
DEFAULT_TENANT_SLUG=school1

# CORS Configuration (comma-separated origins)
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"

# Logging
LOG_LEVEL=info

# Future — Email Service (not required for MVP)
# EMAIL_SERVICE_API_KEY=
# EMAIL_FROM_ADDRESS=

# Future — File Storage (not required for MVP)
# CLOUDINARY_CLOUD_NAME=
# CLOUDINARY_API_KEY=
# CLOUDINARY_API_SECRET=
```

**Configuration Rules:**

- `JWT_SECRET` must be at least 32 characters (256 bits)
- `DATABASE_URL` must use PostgreSQL connection string format
- `PORT` defaults to 3000 if not specified
- `NODE_ENV` must be one of: `development`, `production`, `test`
- `BCRYPT_ROUNDS` must be between 10–12
- `JWT_EXPIRES_IN` MUST be `30d` — do not increase above `30d`; minimum `7d`

***

## 1.6 Tech Stack & Key Libraries (Backend toolbelt)

**Core Stack:**

- Language/Runtime: TypeScript + Node.js
- Framework: Express
- DB: PostgreSQL
- ORM/Query: Knex.js or pg (raw)
- Validation: Zod
- Auth: jsonwebtoken + bcrypt
- OpenAPI: swagger-ui-express

**Critical Packages:**

- Logging: `pino`
- Env/config validation: `zod`, `dotenv`
- Testing: `vitest` + `supertest`
- Migration tooling: knex migrations

**Explicitly Banned Patterns:**

- Do NOT use separate databases per tenant
- Do NOT use microservices (solo dev constraint)
- Do NOT use NoSQL as primary database
- Do NOT implement custom authentication
- Do NOT skip `tenantContextMiddleware` on tenant routes
- Do NOT apply `tenantContextMiddleware` to `/api/super-admin` routes
- Do NOT allow SuperAdmin JWT to pass `tenantContextMiddleware`
- Do NOT expose a SuperAdmin registration endpoint
- Do NOT use DB triggers
- Do NOT use GraphQL

***

## 2. Data Layer (Schema Truth)

**Dialect:** PostgreSQL
**Extensions:** None required

```sql
-- --------------------------------------------------------
-- TENANTS TABLE
-- v3.2: added status, deactivatedat
-- v3.6 CR-17: added timezone
-- --------------------------------------------------------
CREATE TABLE tenants (
  id            VARCHAR(50) PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK(status IN ('active','inactive')),
  timezone      VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  deactivatedat TIMESTAMPTZ DEFAULT NULL,
  createdat     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tenants_slug   ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);

-- --------------------------------------------------------
-- SUPERADMINS TABLE (platform-level, no tenantid)
-- --------------------------------------------------------
CREATE TABLE superadmins (
  id           VARCHAR(50) PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  passwordhash VARCHAR(255) NOT NULL,
  createdat    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_superadmins_email ON superadmins(email);

-- --------------------------------------------------------
-- USERS TABLE (Teachers, Admins, Students — tenant-scoped)
-- v3.1: added deletedat, updated email uniqueness
-- v3.4: roles enum expands to include Student
-- v3.5: UNCHANGED — Student users auto-created via POST /api/students
-- v3.6: UNCHANGED
-- v4.0: UNCHANGED — temporary password generation handled at app layer only
-- --------------------------------------------------------
CREATE TABLE users (
  id           VARCHAR(50) PRIMARY KEY,
  tenantid     VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  passwordhash VARCHAR(255) NOT NULL,
  roles        JSONB NOT NULL DEFAULT '["Teacher"]'::jsonb,
  deletedat    TIMESTAMPTZ DEFAULT NULL,
  createdat    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX        idx_users_tenantid     ON users(tenantid);
CREATE INDEX        idx_users_email        ON users(tenantid, email);
CREATE INDEX        idx_users_roles        ON users USING GIN(roles);
CREATE INDEX        idx_users_deleted      ON users(tenantid, deletedat) WHERE deletedat IS NULL;
CREATE UNIQUE INDEX idx_users_email_active ON users(tenantid, email) WHERE deletedat IS NULL;

-- --------------------------------------------------------
-- BATCHES TABLE
-- v4.0 CR-23: status enum renamed Archived → Graduated
-- Batch = student cohort, assigned at enrollment, NEVER changes on a student.
-- Students move between classes annually; batch is lifetime.
-- --------------------------------------------------------
CREATE TABLE batches (
  id        VARCHAR(50) PRIMARY KEY,
  tenantid  VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      VARCHAR(100) NOT NULL,
  startyear INTEGER NOT NULL,
  endyear   INTEGER NOT NULL,
  status    VARCHAR(50) NOT NULL DEFAULT 'Active'
              CHECK(status IN ('Active','Graduated')),
  deletedat TIMESTAMPTZ DEFAULT NULL,
  createdat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_batches_tenantid ON batches(tenantid);
CREATE INDEX idx_batches_status   ON batches(tenantid, status);
CREATE INDEX idx_batches_deleted  ON batches(tenantid, deletedat) WHERE deletedat IS NULL;

-- --------------------------------------------------------
-- SUBJECTS TABLE
-- --------------------------------------------------------
CREATE TABLE subjects (
  id        VARCHAR(50) PRIMARY KEY,
  tenantid  VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      VARCHAR(255) NOT NULL,
  code      VARCHAR(50),
  deletedat TIMESTAMPTZ DEFAULT NULL,
  createdat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_subjects_tenantid ON subjects(tenantid);
CREATE INDEX idx_subjects_deleted  ON subjects(tenantid, deletedat) WHERE deletedat IS NULL;

-- --------------------------------------------------------
-- CLASSES TABLE
-- Classes are PERMANENT records — created once, never recreated per year.
-- Students move between classes annually via PUT /api/classes/:id/promote.
-- --------------------------------------------------------
CREATE TABLE classes (
  id        VARCHAR(50) PRIMARY KEY,
  tenantid  VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      VARCHAR(255) NOT NULL,
  batchid   VARCHAR(50) NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  deletedat TIMESTAMPTZ DEFAULT NULL,
  createdat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_classes_tenantid ON classes(tenantid);
CREATE INDEX idx_classes_batchid  ON classes(batchid);
CREATE INDEX idx_classes_deleted  ON classes(tenantid, deletedat) WHERE deletedat IS NULL;

-- --------------------------------------------------------
-- STUDENTS TABLE
-- v3.4: added userid FK → users.id (nullable, unique)
-- v3.5 CR-13: added admission_number (NOT NULL), dob (NOT NULL)
--             UNIQUE(tenantid, admission_number)
-- v3.6: classid updated yearly via PUT /api/classes/:id/promote
--       batchid NEVER changes after enrollment
-- v4.0 CR-21: classid is now NULLABLE — NULL when student is Graduated
-- v4.0 CR-22: added status NOT NULL DEFAULT 'Active'
--             CHECK(status IN ('Active','DroppedOff','Graduated'))
--             status = 'Graduated' is SYSTEM-SET ONLY via promote graduation action
-- --------------------------------------------------------
CREATE TABLE students (
  id               VARCHAR(50) PRIMARY KEY,
  tenantid         VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  classid          VARCHAR(50) REFERENCES classes(id) ON DELETE RESTRICT,   -- nullable v4.0
  batchid          VARCHAR(50) NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  userid           VARCHAR(50) DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
  admission_number VARCHAR(50) NOT NULL,
  dob              DATE NOT NULL,
  status           VARCHAR(50) NOT NULL DEFAULT 'Active'
                     CHECK(status IN ('Active','DroppedOff','Graduated')),
  deletedat        TIMESTAMPTZ DEFAULT NULL,
  createdat        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenantid, admission_number)
);
CREATE INDEX        idx_students_tenantid ON students(tenantid);
CREATE INDEX        idx_students_classid  ON students(classid);
CREATE INDEX        idx_students_batchid  ON students(batchid);
CREATE INDEX        idx_students_status   ON students(tenantid, status);
CREATE INDEX        idx_students_deleted  ON students(tenantid, deletedat) WHERE deletedat IS NULL;
CREATE UNIQUE INDEX idx_students_userid   ON students(userid) WHERE userid IS NOT NULL;

-- --------------------------------------------------------
-- SCHOOL PERIODS TABLE (v3.3: dynamic per-tenant config)
-- --------------------------------------------------------
CREATE TABLE schoolperiods (
  id           VARCHAR(50) PRIMARY KEY,
  tenantid     VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  periodnumber INTEGER NOT NULL CHECK(periodnumber >= 1),
  label        VARCHAR(100) NOT NULL DEFAULT '',
  starttime    TIME NOT NULL,
  endtime      TIME NOT NULL,
  createdat    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenantid, periodnumber)
);
CREATE INDEX idx_schoolperiods_tenant ON schoolperiods(tenantid);

-- --------------------------------------------------------
-- TIMESLOTS TABLE (Immutable Timetable Versioning)
-- v3.3: removed CHECK upper bound on periodnumber
-- v3.3: starttime/endtime kept for backward compat
--       but derived from schoolperiods at read time
-- --------------------------------------------------------
CREATE TABLE timeslots (
  id            VARCHAR(50) PRIMARY KEY,
  tenantid      VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  classid       VARCHAR(50) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subjectid     VARCHAR(50) NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  teacherid     VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  dayofweek     VARCHAR(20) NOT NULL
                  CHECK(dayofweek IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  periodnumber  INTEGER NOT NULL CHECK(periodnumber >= 1),
  starttime     TIME,
  endtime       TIME,
  effectivefrom DATE NOT NULL,
  effectiveto   DATE,
  deletedat     TIMESTAMPTZ DEFAULT NULL,
  createdat     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX        idx_timeslots_tenantid       ON timeslots(tenantid);
CREATE INDEX        idx_timeslots_classid        ON timeslots(classid);
CREATE INDEX        idx_timeslots_teacherid      ON timeslots(teacherid);
CREATE INDEX        idx_timeslots_effectivedates ON timeslots(effectivefrom, effectiveto);
CREATE INDEX        idx_timeslots_deleted        ON timeslots(tenantid, deletedat) WHERE deletedat IS NULL;
CREATE UNIQUE INDEX idx_timeslots_active_unique  ON timeslots(tenantid, classid, dayofweek, periodnumber)
  WHERE effectiveto IS NULL AND deletedat IS NULL;

-- --------------------------------------------------------
-- ATTENDANCE RECORDS TABLE
-- v3.4: added correctedstatus, correctedby, correctedat
--       status (original) is NEVER mutated after insert
-- --------------------------------------------------------
CREATE TABLE attendancerecords (
  id              VARCHAR(50) PRIMARY KEY,
  tenantid        VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  studentid       VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  timeslotid      VARCHAR(50) NOT NULL REFERENCES timeslots(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  status          VARCHAR(50) NOT NULL CHECK(status IN ('Present','Absent','Late')),
  recordedby      VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recordedat      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  correctedstatus VARCHAR(50) DEFAULT NULL CHECK(correctedstatus IN ('Present','Absent','Late')),
  correctedby     VARCHAR(50) DEFAULT NULL REFERENCES users(id) ON DELETE RESTRICT,
  correctedat     TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(studentid, timeslotid, date)
);
CREATE INDEX idx_attendance_tenantid         ON attendancerecords(tenantid);
CREATE INDEX idx_attendance_studentid        ON attendancerecords(studentid);
CREATE INDEX idx_attendance_timeslotid       ON attendancerecords(timeslotid);
CREATE INDEX idx_attendance_date             ON attendancerecords(date);
CREATE INDEX idx_attendance_studentdaterange ON attendancerecords(studentid, date);

-- --------------------------------------------------------
-- FEATURES TABLE (system-wide module definitions)
-- --------------------------------------------------------
CREATE TABLE features (
  id          VARCHAR(50) PRIMARY KEY,
  key         VARCHAR(100) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  createdat   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO features (id, key, name, description) VALUES
  ('F001', 'timetable', 'Timetable Management', 'Create and manage class schedules with teacher assignments'),
  ('F002', 'attendance', 'Attendance Tracking', 'Record and view student attendance per class period');

-- --------------------------------------------------------
-- TENANT FEATURES TABLE (per-tenant module activation)
-- --------------------------------------------------------
CREATE TABLE tenantfeatures (
  id         VARCHAR(50) PRIMARY KEY,
  tenantid   VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  featurekey VARCHAR(100) NOT NULL REFERENCES features(key) ON DELETE CASCADE,
  enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  enabledat  TIMESTAMPTZ,
  UNIQUE(tenantid, featurekey)
);
CREATE INDEX idx_tenantfeatures_tenantid ON tenantfeatures(tenantid);
CREATE INDEX idx_tenantfeatures_enabled  ON tenantfeatures(tenantid, enabled);
```

### Migration Files

```
src/db/migrations/001_initial_schema.sql                   — v3.1 base
src/db/migrations/002_add_student_userid.sql               — v3.4 CR-08
src/db/migrations/003_add_attendance_corrections.sql       — v3.4 CR-09
src/db/migrations/004_student_admission_dob.sql            — v3.5 CR-13
src/db/migrations/005_tenant_timezone.sql                  — v3.6 CR-17
src/db/migrations/006_student_status_classid_nullable.sql  — v4.0 CR-21 + CR-22 ← NEW
src/db/migrations/007_batch_status_graduated.sql           — v4.0 CR-23 ← NEW
```

**Migration 006 content:**

```sql
-- v4.0 CR-21: Make students.classid nullable (graduated students have no class)
ALTER TABLE students ALTER COLUMN classid DROP NOT NULL;

-- v4.0 CR-22: Add status field to students
ALTER TABLE students
  ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Active'
  CHECK(status IN ('Active','DroppedOff','Graduated'));

CREATE INDEX idx_students_status ON students(tenantid, status);
```

**Migration 007 content:**

```sql
-- v4.0 CR-23: Rename batch status Archived → Graduated
-- Step 1: migrate existing data
UPDATE batches SET status = 'Graduated' WHERE status = 'Archived';

-- Step 2: replace constraint
ALTER TABLE batches DROP CONSTRAINT batches_status_check;
ALTER TABLE batches ADD CONSTRAINT batches_status_check
  CHECK(status IN ('Active','Graduated'));
```

### Data Invariants (Application-Enforced Rules)

- `Student.batchid` MUST equal `Class.batchid` — validate on insert/update (when classid is not null)
- Cannot delete Class if Student records reference it — RESTRICT
- Cannot delete Subject if TimeSlot records reference it — RESTRICT
- Cannot delete User if TimeSlot or AttendanceRecord references them — RESTRICT
- TimeSlot updates must create new records, not modify existing (immutability)
- `AttendanceRecord.date` cannot be in the future — evaluated in tenant's timezone (`tenants.timezone`)
- Feature `attendance` can only be enabled if `timetable` is enabled
- `User.roles` must be a non-empty array containing only `Teacher`, `Admin`, `Student`
- `User.roles` must not contain duplicates — deduplicate before saving
- `TimeSlot.teacherid` must reference a User with `Teacher` in their roles array
- Admin calling `PUT /api/users/:id/roles` targeting self: allowed EXCEPT removing own Admin role when no other active Admin exists in the tenant → `403 LAST_ADMIN`
- A tenant with `status = inactive` causes all its users to receive `403 TENANT_INACTIVE` on every API call — enforced in `tenantContextMiddleware`
- **v3.6 CR-16:** `tenantContextMiddleware` MUST verify `users.deletedat IS NULL` on every authenticated tenant request — `401 UNAUTHORIZED` if soft-deleted
- SuperAdmin credentials must be seeded via DB script only — no API creation path
- `students.userid` is unique per non-null value — enforced by partial unique index
- A Student-role user may only call `GET /api/students/:studentId/attendance` where `students.userId = caller.userId` — `403 STUDENT_ACCESS_DENIED` otherwise
- A Student-role user may only call `GET /api/students/:id` where `students.userId = caller.userId` — `403 STUDENT_ACCESS_DENIED` otherwise
- When a user is soft-deleted (`deletedat = NOW()`), if `students.userid = userId`, set `students.userid = NULL` in the same transaction
- `attendancerecords.status` (original) is never mutated after insert — corrections write only to `correctedstatus`, `correctedby`, `correctedat`
- Only one correction level per record — re-correcting overwrites `correctedstatus`, `correctedby`, `correctedat` in place; original `status` remains unchanged forever
- Student role: no write access to any resource
- `timeslots.periodnumber` must exist in `schoolperiods` for the same `tenantid` — validated at app layer on `POST /api/timetable`
- Cannot delete a schoolperiod if any active (`effectiveto IS NULL`) timeslot references that `periodnumber` for the same tenant → `409 HAS_REFERENCES`
- `schoolperiods` must be configured before any timetable entry can be created → `400 PERIOD_NOT_CONFIGURED`
- `schoolperiods.starttime < endtime` — enforced on create/update
- `schoolperiods.periodnumber` is immutable after creation
- **v3.5 CR-13:** `students.admission_number` must be unique within the tenant (active records only — `deletedat IS NULL`) → `409 ADMISSION_NUMBER_CONFLICT`
- **v3.5 CR-13:** `POST /api/users` must reject any `roles` array containing `Student` → `400 INVALID_ROLE`
- **v3.5 CR-13:** `GET /api/users` and `GET /api/users/:id` MUST apply `WHERE NOT (roles @> '["Student"]'::jsonb)` — Student-role users never returned from user endpoints
- **v3.5 CR-13:** Student login password is derived as: `bcrypt(admissionNumber + DDMMYYYY(dob))` — zero-padded, e.g., admission `530`, dob `2003-10-03` → password = `53003102003`
- **v3.5 CR-13:** When admin updates `dob` or `admissionNumber` on a student, `users.passwordhash` AND `users.email` (loginId) MUST be re-computed in the same transaction
- **v3.6 CR-18:** `PUT /api/classes/:sourceClassId/promote` — source and target must not be equal → `400 SAME_CLASS`; updates only `students.classid` — `students.batchid` is NEVER touched
- **v3.6 CR-17:** All `DATE` comparisons (attendance future-date check) MUST use `tenants.timezone`, not server timezone
- **v4.0 CR-21:** On graduation: `students.classid = NULL`, `students.status = 'Graduated'` — set atomically per student; `batchid` is NEVER touched
- **v4.0 CR-22:** `students.status = 'Graduated'` is SYSTEM-SET ONLY — cannot be written via `PUT /api/students/:id`. Attempt → `400 VALIDATION_ERROR`
- **v4.0 CR-22:** `students.status = 'DroppedOff'` is Admin-settable via `PUT /api/students/:id`
- **v4.0 CR-22:** `PUT /api/students/:id` rejects `status = 'Graduated'` with `400 VALIDATION_ERROR`
- **v4.0 CR-21:** All queries joining `students → classes` MUST use `LEFT JOIN` — `classid` may be NULL for graduated students
- **v4.0 CR-23:** `batches.status` valid values are `Active` and `Graduated` only — `Archived` no longer valid

### Soft Delete Policy (v3.1, unchanged)

- All DELETE operations MUST set `deletedat = NOW()` instead of removing rows — applies to: users, batches, subjects, classes, students, timeslots
- All read queries MUST include `WHERE deletedat IS NULL` filter
- Hard delete ONLY via manual DB admin action
- Attendance records are NOT soft-deleted — immutable audit trail
- Features, tenantfeatures, tenants, superadmins, schoolperiods are NOT soft-deleted

***

## 2.1 Transactions, Concurrency, Idempotency

### Transaction Boundaries

| Workflow | Tables Touched | Commit/Rollback Condition |
| :-- | :-- | :-- |
| Create tenant | tenants, schoolperiods ×8, users | All-or-nothing — any failure = full rollback |
| Create student (CR-13) | users, students | All-or-nothing — user insert failure = full rollback, no orphaned student |
| Record class attendance | attendancerecords | Per-student insert — partial failure returns which students failed |
| Soft delete user | users, students (userid nullify) | Both in single transaction |
| Update student dob/admissionNumber | students, users (passwordhash + email) | Both in single transaction |
| Promote class (CR-18) | students | Per-student update — partial failure returns failed list, commits successful updates |
| **Graduate class (CR-21)** | **students** | **Per-student update — partial failure returns failed list, commits successful updates** |

### Concurrency Strategy

- No optimistic locking required at MVP scale (10 RPS)
- Unique indexes enforce slot-level timetable conflicts at DB layer
- Attendance unique constraint `(studentid, timeslotid, date)` prevents double-recording at DB layer
- `UNIQUE(tenantid, admission_number)` on students prevents duplicate admission numbers

### Idempotency

- No `Idempotency-Key` header in MVP
- Attendance recording is idempotent by DB unique constraint — duplicate → `409`
- Student creation is NOT idempotent — duplicate admission number → `409 ADMISSION_NUMBER_CONFLICT`
- Class promotion is NOT idempotent — re-running after completion results in 0 students moved (source class is empty)
- Graduation is NOT idempotent — re-running on a source class with all students already graduated results in 0 students updated

***

## 3. API Contract (Backend truth)

**Protocol:** REST
**Auth Mechanism:** Bearer Token (JWT)
**Header:** `Authorization: Bearer <token>`
**Base Path:** `/api`
**Request Content-Type:** `application/json`
**Response Content-Type:** `application/json`

### JWT Payload Shapes (v3.4, unchanged)

**Tenant user (Teacher / Admin / Student):**

```json
{
  "userId": "U123",
  "tenantId": "T001",
  "roles": ["Admin", "Teacher"],
  "activeRole": "Admin",
  "exp": 1234567890
}
```

- `activeRole` defaults to first element of `roles` on initial login
- Updated via `POST /api/auth/switch-role`
- `activeRole` enum: `Teacher | Admin | Student`

**SuperAdmin:**

```json
{ "superAdminId": "SA001", "role": "SuperAdmin", "exp": 1234567890 }
```

### Global Error Response Format (LOCKED)

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  },
  "timestamp": "2026-03-03T07:00:00Z"
}
```

### Common HTTP Status Codes

| Code | Meaning |
| :-- | :-- |
| 200 | Success (GET, PUT, bulk DELETE) |
| 201 | Created (POST) |
| 204 | No Content (single DELETE) |
| 400 | Bad Request — validation failure |
| 401 | Unauthorized — missing/invalid/soft-deleted token |
| 403 | Forbidden — insufficient permissions, feature disabled, inactive tenant |
| 404 | Not Found |
| 409 | Conflict — duplicate entry, referential integrity violation |
| 500 | Internal Server Error |

### Error Code Registry (LOCKED — SNAKE_CASE)

| Code | HTTP | Trigger |
| :-- | :-- | :-- |
| `UNAUTHORIZED` | 401 | Missing, invalid, or expired JWT; soft-deleted user |
| `FORBIDDEN` | 403 | Insufficient role permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Generic duplicate (id/slug) |
| `TENANT_INACTIVE` | 403 | Tenant status = inactive |
| `LAST_ADMIN` | 403 | Cannot remove own Admin role — last Admin in tenant |
| `ROLE_NOT_ASSIGNED` | 400 | Requested switch-role not in user's roles array |
| `SINGLE_ROLE_USER` | 403 | Switch-role attempted by single-role user |
| `ALREADY_INACTIVE` | 409 | Tenant already inactive |
| `ALREADY_ACTIVE` | 409 | Tenant already active |
| `ADMIN_EMAIL_TAKEN` | 409 | Admin email already in use on tenant creation |
| `VALIDATION_ERROR` | 400 | General request body validation failure |
| `FEATURE_DISABLED` | 403 | Feature not enabled for tenant |
| `FEATURE_DEPENDENCY` | 400 | Attendance requires timetable enabled first |
| `PERIOD_NOT_CONFIGURED` | 400 | No school period exists for given periodnumber |
| `PERIOD_TIME_INVALID` | 400 | startTime >= endTime |
| `HAS_REFERENCES` | 409 | Cannot delete — referenced by child records |
| `INVALID_TEACHER` | 400 | teacherId does not have Teacher role |
| `ADMISSION_NUMBER_CONFLICT` | 409 | Admission number already active in tenant |
| `INVALID_ROLE` | 400 | Student role passed to POST /api/users |
| `STUDENT_ACCESS_DENIED` | 403 | Student attempting to access another student's data |
| `CLASS_BATCH_MISMATCH` | 400 | classId's batchId does not match provided batchId |
| `INVALID_USER` | 400 | userId does not exist or is invalid for link-account |
| `USER_ALREADY_LINKED` | 409 | Student already linked to a user account |
| `FUTURE_DATE` | 400 | Attendance date is in the future |
| `SAME_STATUS` | 400 | Attendance correction status same as effective status |
| `SAME_CLASS` | 400 | Source and target class are identical in promote |
| `INVALID_PROMOTION_ACTION` | 400 | Promote body has neither valid targetClassId nor action: "graduate" |

### 3.1 OpenAPI Contract Artifact (REQUIRED, LOCKED)

- **File name:** `openapi.yaml`
- **Repo path:** `./docs/openapi.yaml`
- **OpenAPI version:** 3.1.0
- **API version identifier:** `4.0.0` (bumped from 3.6.0 — breaking change CR-23)

**Consistency rule (hard):** Endpoint list + schemas + status codes in this Freeze MUST match `openapi.yaml` exactly. If mismatch exists → Freeze is invalid until corrected.

**Breaking change rules:**

- Major version bump requires Freeze version bump
- Minor version bump for additive changes only
- Patch version bump for clarifications/fixes only

### 3.2 Example Payload Set (REQUIRED)

**POST /api/students — success**

```json
Request:
{ "name": "Ravi Kumar", "classId": "C001", "batchId": "B001", "admissionNumber": "530", "dob": "2003-10-03" }

Response 201:
{
  "student": {
    "id": "S001", "name": "Ravi Kumar",
    "classId": "C001", "className": "Grade 10A",
    "batchId": "B001", "batchName": "Verity",
    "admissionNumber": "530", "dob": "2003-10-03",
    "status": "Active",
    "loginId": "530@greenvalley.local", "userId": "U999"
  }
}
```

**POST /api/students — error: duplicate admission number**

```json
Response 409:
{ "error": { "code": "ADMISSION_NUMBER_CONFLICT", "message": "Admission number 530 already exists for this school", "details": {} }, "timestamp": "2026-03-03T07:00:00Z" }
```

**POST /api/users — success with auto-generated password**

```json
Request:
{ "name": "Jane Smith", "email": "jane@school1.com", "roles": ["Teacher"] }

Response 201:
{
  "user": { "id": "U124", "name": "Jane Smith", "email": "jane@school1.com", "roles": ["Teacher"], "createdAt": "2026-03-05T07:00:00Z", "updatedAt": "2026-03-05T07:00:00Z" },
  "temporaryPassword": "aX3!mZ9qR2"
}
```

**POST /api/users — success with explicit password**

```json
Request:
{ "name": "Jane Smith", "email": "jane@school1.com", "password": "securepass1", "roles": ["Teacher"] }

Response 201:
{
  "user": { "id": "U124", "name": "Jane Smith", "email": "jane@school1.com", "roles": ["Teacher"], "createdAt": "2026-03-05T07:00:00Z", "updatedAt": "2026-03-05T07:00:00Z" },
  "temporaryPassword": null
}
```

**POST /api/users — error: Student role rejected**

```json
Response 400:
{ "error": { "code": "INVALID_ROLE", "message": "Student accounts must be created via the Students page", "details": {} }, "timestamp": "2026-03-03T07:00:00Z" }
```

**GET /api/students/:id — success (graduated student)**

```json
Response 200:
{
  "student": {
    "id": "S001", "name": "Ravi Kumar",
    "classId": null, "className": null,
    "batchId": "B001", "batchName": "Verity",
    "admissionNumber": "530", "dob": "2003-10-03",
    "status": "Graduated",
    "loginId": "530@greenvalley.local", "userId": "U999"
  }
}
```

**GET /api/students/:id — error: student accessing another student**

```json
Response 403:
{ "error": { "code": "STUDENT_ACCESS_DENIED", "message": "You can only access your own student record", "details": {} }, "timestamp": "2026-03-03T07:00:00Z" }
```

**PUT /api/classes/:sourceClassId/promote — success (promote)**

```json
Request: { "targetClassId": "C_GRADE7A" }
Response 200: { "updated": 42, "failed": [] }
```

**PUT /api/classes/:sourceClassId/promote — success (graduate)**

```json
Request: { "action": "graduate" }
Response 200: { "graduated": 38, "failed": [] }
```

**PUT /api/classes/:sourceClassId/promote — error: same class**

```json
Response 400:
{ "error": { "code": "SAME_CLASS", "message": "Source and target class cannot be the same", "details": {} }, "timestamp": "2026-03-03T07:00:00Z" }
```

**PUT /api/classes/:sourceClassId/promote — error: invalid action**

```json
Response 400:
{ "error": { "code": "INVALID_PROMOTION_ACTION", "message": "Provide either targetClassId or action: \"graduate\"", "details": {} }, "timestamp": "2026-03-05T07:00:00Z" }
```

**PUT /api/students/:id — error: Graduated status rejected**

```json
Response 400:
{ "error": { "code": "VALIDATION_ERROR", "message": "status \"Graduated\" can only be set by the graduation action", "details": {} }, "timestamp": "2026-03-05T07:00:00Z" }
```

**PUT /api/users/:id/roles — LAST_ADMIN error**

```json
Response 403:
{ "error": { "code": "LAST_ADMIN", "message": "Cannot remove Admin role — you are the last admin of this tenant", "details": {} }, "timestamp": "2026-03-03T07:00:00Z" }
```

**PUT /api/users/:id/roles — self-edit success**

```json
Request: { "roles": ["Admin", "Teacher"] }
Response 200: { "user": { "id": "U123", "name": "John Doe", "email": "john@school1.com", "roles": ["Admin", "Teacher"] } }
```

### 3.3 Mock Server (REQUIRED, unchanged from v3.6)

- **Tool:** Prism (`@stoplight/prism-cli`)
- **Run command:** `npx prism mock ./docs/openapi.yaml --port 4010`
- **Failure simulation:**
  - `401` — omit `Authorization` header
  - `403` — use a valid token with insufficient role
  - `409` — send duplicate admission number or slug
  - `422` — send malformed body (Prism validates against schema)
  - `500` — use Prism `--errors` flag or mock override header

### 3.4 Contract Enforcement (REQUIRED, unchanged from v3.6)

- **Approach:** OpenAPI-driven contract tests via Dredd
- **CI gate runs on:** PR to `main`
- **Fails build if:** OpenAPI schema mismatch OR Dredd contract tests fail OR examples fail schema validation
- **Artifacts published:** `openapi.yaml`, Dredd test report

### 3.5 Endpoints (MVP only — ALL listed)

#### AUTH ENDPOINTS (unchanged from v3.6)

**POST /api/auth/login**
- Auth required: No
- Request: `{ email, password, tenantSlug }`
- Response 200: `{ token, user }`
- Errors: `400 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 TENANT_INACTIVE`, `404 NOT_FOUND`

**POST /api/auth/logout**
- Auth required: Yes
- Response: `204`
- Errors: `401 UNAUTHORIZED`

**POST /api/auth/switch-role**
- Auth required: Yes
- Request: `{ role }`
- Response 200: `{ token, user }`
- Errors: `400 ROLE_NOT_ASSIGNED`, `403 SINGLE_ROLE_USER`

#### SUPER-ADMIN ENDPOINTS (unchanged from v3.6)

**POST /api/super-admin/auth/login** — SuperAdmin login
**GET /api/super-admin/tenants** — List tenants
**POST /api/super-admin/tenants** — Create tenant
**PUT /api/super-admin/tenants/:tenantId** — Update tenant
**PUT /api/super-admin/tenants/:tenantId/deactivate** — Deactivate tenant
**PUT /api/super-admin/tenants/:tenantId/reactivate** — Reactivate tenant
**GET /api/super-admin/tenants/:tenantId/features** — List feature flags
**PUT /api/super-admin/tenants/:tenantId/features/:featureKey** — Toggle feature flag

#### FEATURES ENDPOINTS (unchanged)

**GET /api/features** — List enabled features (Admin only)

#### SCHOOL PERIODS ENDPOINTS (unchanged)

**GET /api/school-periods** — List periods (Teacher, Admin, Student)
**POST /api/school-periods** — Create period (Admin only)
**PUT /api/school-periods/:id** — Update period (Admin only)
**DELETE /api/school-periods/:id** — Delete period (Admin only)

#### TIMETABLE ENDPOINTS (unchanged)

**GET /api/timetable** — Get timetable (Teacher, Admin, Student)
**POST /api/timetable** — Create timeslot (Admin only)
**PUT /api/timetable/:timeSlotId/end** — End timeslot (Admin only)

#### USERS ENDPOINTS

**GET /api/users** — List users (Admin only; Students excluded)

**POST /api/users** — Create user (Admin only; Student role forbidden)
- Auth required: Yes (Admin)
- Request body:
  - `name`: string — Required
  - `email`: string (email format) — Required
  - `password`: string (minLength 8) — **Optional** (v4.0 CR-20)
  - `roles`: array of `["Teacher","Admin"]` — Required, minItems 1, must NOT contain `Student`
- Response 201: `{ user, temporaryPassword: string|null }`
  - `temporaryPassword` is present (non-null) only when `password` was omitted
  - `temporaryPassword` is `null` when password was explicitly provided
- Errors: `400 INVALID_ROLE`, `400 VALIDATION_ERROR`, `409 CONFLICT`

**GET /api/users/:id** — Get user (Admin only; Student-role users return 404)
**PUT /api/users/:id/roles** — Update roles (Admin only)
**DELETE /api/users/:id** — Soft-delete user (Admin only)

#### STUDENTS ENDPOINTS

**GET /api/students** — List students (Admin all, Teacher own classes)
- Query params: `classId`, `batchId`, `status` (enum: `Active`, `DroppedOff`, `Graduated`), `search`, `limit`, `offset`

**POST /api/students** — Create student (Admin only)

**GET /api/students/:id** — Get student (Admin any, Teacher own classes, Student own only)

**PUT /api/students/:id** — Update student (Admin only)
- Allowed fields: `name`, `classId`, `batchId`, `admissionNumber`, `dob`, `status`
- `status` accepts only `Active` or `DroppedOff` — `Graduated` is rejected → `400 VALIDATION_ERROR`

**DELETE /api/students/:id** — Soft-delete student (Admin only)

**DELETE /api/students/bulk** — Bulk delete students (Admin only)

**GET /api/students/:studentId/attendance** — Student attendance history

#### CLASSES ENDPOINTS

**GET /api/classes** — List classes (Admin, Teacher)
**POST /api/classes** — Create class (Admin only)
**DELETE /api/classes/:id** — Soft-delete class (Admin only)

**PUT /api/classes/:sourceClassId/promote** — Promote or graduate students (Admin only)
- Auth required: Yes (Admin)
- Request body: one of:
  - `{ "targetClassId": string }` — promotes all active students to target class
  - `{ "action": "graduate" }` — graduates all active students from source class
- Response 200:
  - Promote: `{ "updated": number, "failed": [{ "id": string, "reason": string }] }`
  - Graduate: `{ "graduated": number, "failed": [{ "id": string, "reason": string }] }`
- Errors:
  - `400 SAME_CLASS` — targetClassId equals sourceClassId
  - `400 INVALID_PROMOTION_ACTION` — body has neither valid targetClassId nor action: "graduate"
  - `404 NOT_FOUND` — source or target class not found

#### BATCHES ENDPOINTS

**GET /api/batches** — List batches (Admin, Teacher)
- Query param `status`: enum `Active`, `Graduated` (v4.0 — was `Active`, `Archived`)

**POST /api/batches** — Create batch (Admin only)
**PUT /api/batches/:id** — Update batch (Admin only)
**DELETE /api/batches/:id** — Soft-delete batch (Admin only)

#### SUBJECTS ENDPOINTS (unchanged)

**GET /api/subjects**, **POST /api/subjects**, **PUT /api/subjects/:id**, **DELETE /api/subjects/:id**

#### ATTENDANCE ENDPOINTS (unchanged)

**POST /api/attendance/record-class** — Record class attendance (Teacher own, Admin all)
**PUT /api/attendance/:recordId** — Correct attendance (Teacher own-class, Admin any)
**GET /api/attendance/summary** — Attendance summary by class and date range (Admin only)
**GET /api/students/:studentId/attendance** — Student attendance history

***

## 4. Critical Business Logic (Pseudocode only)

### Flow: tenantContextMiddleware (v3.6 CR-16 — unchanged)

```
FUNCTION tenantContextMiddleware(req, res, next)

1. Extract Bearer token from Authorization header
   IF missing → 401 UNAUTHORIZED
2. Verify JWT signature → IF invalid/expired → 401 UNAUTHORIZED
3. Extract tenantId, userId from JWT payload
4. SELECT t.id, t.status, t.timezone FROM tenants WHERE id = tenantId
   IF not found → 404
   IF t.status = 'inactive' → 403 TENANT_INACTIVE
5. SELECT id FROM users
   WHERE id = userId AND tenantid = tenantId AND deletedat IS NULL
   IF not found → 401 UNAUTHORIZED  (user has been soft-deleted)
6. req.tenant = { id: tenantId, timezone: t.timezone }
7. req.user  = { userId, tenantId, roles, activeRole }
8. next()
```

### Flow: createUser (v4.0 CR-20 — UPDATED)

```
FUNCTION createUser(name, email, password, roles, tenantId)

1. VALIDATE name, email, roles present
   IF roles contains 'Student' → 400 INVALID_ROLE
   IF roles is empty or contains invalid values → 400 VALIDATION_ERROR
2. CHECK email uniqueness (active users only):
   SELECT id FROM users WHERE tenantid = tenantId AND email = email AND deletedat IS NULL
   IF found → 409 CONFLICT
3. isAutoGenerated = false
   IF password is undefined or null:
     password = generateSecureRandomPassword()  // min 10 chars, mixed alphanum+symbols
     isAutoGenerated = true
   ELSE:
     IF password.length < 8 → 400 VALIDATION_ERROR
4. INSERT INTO users (id, tenantid, name, email, passwordhash, roles)
   VALUES (genId(), tenantId, name, email, bcrypt(password), deduplicate(roles))
5. RETURN 201 {
     user: { id, name, email, roles, createdAt, updatedAt },
     temporaryPassword: isAutoGenerated ? password : null
   }
   NOTE: temporaryPassword is returned in plaintext ONCE only. It is NOT stored.
```

### Flow: createStudent (v3.5 CR-13 — unchanged)

```
FUNCTION createStudent(name, classId, batchId, admissionNumber, dob, tenantId, tenantSlug)

1. VALIDATE all fields present; dob is valid DATE
2. SELECT id FROM classes
   WHERE id = classId AND batchid = batchId AND tenantid = tenantId AND deletedat IS NULL
   IF not found → 400 CLASS_BATCH_MISMATCH
3. SELECT id FROM students
   WHERE tenantid = tenantId AND admission_number = admissionNumber AND deletedat IS NULL
   IF found → 409 ADMISSION_NUMBER_CONFLICT
4. BEGIN TRANSACTION
5.   dobDDMMYYYY = formatDate(dob, "DDMMYYYY")
     password    = admissionNumber + dobDDMMYYYY
     loginId     = admissionNumber + "@" + tenantSlug + ".local"
     newUserId   = genId()
     INSERT INTO users (id, tenantid, name, email, passwordhash, roles)
     VALUES (newUserId, tenantId, name, loginId, bcrypt(password), '["Student"]')
6.   newStudentId = genId()
     INSERT INTO students (id, tenantid, name, classid, batchid, userid, admission_number, dob, status)
     VALUES (newStudentId, tenantId, name, classId, batchId, newUserId, admissionNumber, dob, 'Active')
7. COMMIT
8. RETURN 201 { student: { ...fields, status: "Active", admissionNumber, dob, loginId, userId: newUserId } }
```

### Flow: updateStudent (v4.0 CR-22 — UPDATED)

```
FUNCTION updateStudent(studentId, updates, tenantId, tenantSlug)

1. SELECT student WHERE id = studentId AND tenantid = tenantId AND deletedat IS NULL
   IF not found → 404
2. IF updates.status == 'Graduated' → 400 VALIDATION_ERROR
   (Graduated is system-set only via graduation action)
3. IF updates.admissionNumber AND updates.admissionNumber != student.admissionNumber
     CHECK uniqueness → 409 ADMISSION_NUMBER_CONFLICT if conflict
4. IF updates.dob OR updates.admissionNumber
     newAdmissionNumber = updates.admissionNumber ?? student.admissionNumber
     newDob             = updates.dob ?? student.dob
     newDobDDMMYYYY     = formatDate(newDob, "DDMMYYYY")
     newPassword        = newAdmissionNumber + newDobDDMMYYYY
     newLoginId         = newAdmissionNumber + "@" + tenantSlug + ".local"
     BEGIN TRANSACTION
       UPDATE students SET ...updates WHERE id = studentId
       UPDATE users SET
         passwordhash = bcrypt(newPassword),
         email        = newLoginId,
         name         = updates.name ?? student.name,
         updatedat    = NOW()
       WHERE id = student.userid
     COMMIT
   ELSE
     UPDATE students SET ...updates WHERE id = studentId
5. RETURN 200 { student }
```

### Flow: promoteClass (v4.0 CR-21 — UPDATED)

```
FUNCTION promoteClass(sourceClassId, body, tenantId)

1. VALIDATE body:
   IF body.targetClassId is present:
     action = 'promote'
     targetClassId = body.targetClassId
     IF sourceClassId == targetClassId → 400 SAME_CLASS
   ELSE IF body.action == 'graduate':
     action = 'graduate'
   ELSE:
     → 400 INVALID_PROMOTION_ACTION

2. SELECT id FROM classes
   WHERE id = sourceClassId AND tenantid = tenantId AND deletedat IS NULL
   IF not found → 404

3. IF action == 'promote':
     SELECT id FROM classes
     WHERE id = targetClassId AND tenantid = tenantId AND deletedat IS NULL
     IF not found → 404

4. SELECT id FROM students
   WHERE classid = sourceClassId AND tenantid = tenantId AND status = 'Active' AND deletedat IS NULL
   → studentIds[]

5. results = { updated/graduated: 0, failed: [] }

6. FOR each studentId in studentIds:
     TRY
       IF action == 'promote':
         UPDATE students SET classid = targetClassId, updatedat = NOW()
         WHERE id = studentId
         results.updated++
       ELSE (graduate):
         UPDATE students SET classid = NULL, status = 'Graduated', updatedat = NOW()
         WHERE id = studentId
         results.graduated++
     CATCH error
       push { id: studentId, reason: error.message } to results.failed

7. IF action == 'promote':
     RETURN 200 { updated: results.updated, failed: results.failed }
   ELSE:
     RETURN 200 { graduated: results.graduated, failed: results.failed }
```

### Flow: correctAttendance (CR-09 — unchanged)

```
FUNCTION correctAttendance(recordId, newStatus, callerId, callerRoles, tenantId, tenantTimezone)

1. SELECT ar.*, ts.teacherid FROM attendancerecords ar
   JOIN timeslots ts ON ts.id = ar.timeslotid
   WHERE ar.id = recordId AND ar.tenantid = tenantId
   IF not found → 404
2. today = currentDateInTimezone(tenantTimezone)
   IF ar.date > today → 400 FUTURE_DATE
3. effectiveStatus = ar.correctedstatus ?? ar.status
   IF newStatus == effectiveStatus → 400 SAME_STATUS
4. IF Admin NOT IN callerRoles:
     IF Teacher NOT IN callerRoles → 403
     IF ts.teacherid != callerId → 403
5. UPDATE attendancerecords SET
     correctedstatus = newStatus,
     correctedby = callerId,
     correctedat = NOW()
   WHERE id = recordId
6. RETURN 200 { record: { id, date, originalStatus: ar.status, status: newStatus, correctedBy, correctedAt, timeSlot } }
```

### Flow: recordClassAttendance (unchanged)

```
FUNCTION recordClassAttendance(timeSlotId, date, defaultStatus, exceptions, callerId, callerRoles, tenantId, tenantTimezone)

1. Verify attendance feature enabled → 403 FEATURE_DISABLED if not
2. SELECT ts.* FROM timeslots WHERE id = timeSlotId AND tenantid = tenantId AND deletedat IS NULL
   IF not found → 404
3. today = currentDateInTimezone(tenantTimezone)
   IF date > today → 400 FUTURE_DATE
4. IF Admin NOT IN callerRoles AND ts.teacherid != callerId → 403 FORBIDDEN
5. SELECT id FROM attendancerecords WHERE timeslotid = timeSlotId AND date = date LIMIT 1
   IF found → 409 CONFLICT
6. SELECT id FROM students
   WHERE classid = ts.classid AND tenantid = tenantId AND deletedat IS NULL AND status = 'Active'
7. FOR each student:
     status = exceptions[student.id] ?? defaultStatus
     INSERT INTO attendancerecords (tenantid, studentid, timeslotid, date, status, recordedby)
8. RETURN 201 { recorded, present, absent, late, date, timeSlot }
```

### Flow: updateUserRoles (v3.4 — unchanged)

```
FUNCTION updateUserRoles(targetId, newRoles, callerId, callerRoles, tenantId)

1. VALIDATE newRoles: non-empty array, no duplicates, values in [Teacher, Admin, Student]
   IF invalid → 400
2. SELECT roles FROM users
   WHERE id = targetId AND tenantid = tenantId AND deletedat IS NULL
   IF not found → 404
3. IF targetId == callerId (self-edit):
     IF Admin IN callerRoles AND Admin NOT IN newRoles:
       adminCount = SELECT COUNT(*) FROM users
         WHERE tenantid = tenantId AND roles @> '["Admin"]'::jsonb
         AND deletedat IS NULL AND id != callerId
       IF adminCount == 0 → 403 LAST_ADMIN
4. UPDATE users SET roles = deduplicate(newRoles), updatedat = NOW() WHERE id = targetId
5. RETURN 200 { user }
```

### Flow: createTimeSlot (v3.3 — unchanged)

```
FUNCTION createTimeSlot(classId, subjectId, teacherId, dayOfWeek, periodNumber, effectiveFrom, tenantId)

1. Verify timetable feature enabled → 403 FEATURE_DISABLED if not
2. SELECT id FROM schoolperiods
   WHERE tenantid = tenantId AND periodnumber = periodNumber
   IF not found → 400 PERIOD_NOT_CONFIGURED
3. SELECT roles FROM users
   WHERE id = teacherId AND tenantid = tenantId AND deletedat IS NULL
   IF Teacher NOT IN roles → 400 INVALID_TEACHER
4. SELECT id FROM timeslots
   WHERE tenantid = tenantId AND classid = classId
   AND dayofweek = dayOfWeek AND periodnumber = periodNumber
   AND effectiveto IS NULL AND deletedat IS NULL
   IF found → 409 CONFLICT
5. INSERT INTO timeslots (starttime = NULL, endtime = NULL)
6. SELECT ts.*, sp.starttime, sp.endtime, sp.label
   FROM timeslots ts
   JOIN schoolperiods sp ON sp.periodnumber = ts.periodnumber AND sp.tenantid = ts.tenantid
   WHERE ts.id = newId
7. RETURN 201 { timeSlot }
```

***

## 5. Integrations & Failure Behavior

None. No external integrations in MVP.

***

## 6. Observability, Audit, Safety

**Logging (structured via pino):**
- Required fields: `requestId`, `userId` (if known), `tenantId` (if known), `route`, `statusCode`, `latencyMs`
- PII rules: passwords, `passwordhash`, `temporaryPassword` MUST NEVER be logged

**Audit log:** Not implemented in MVP — pino logs serve as operational trail

**Metrics (minimum):** RPS, p95 latency, error rate, DB pool saturation

**Alerts (minimum):**
- Error rate > 5% over 5 minutes → notify operator
- DB pool saturation > 80% → notify operator

***

## 7. Acceptance Criteria (Backend)

### Phase 1 — Foundation
- [ ] DB schema applied successfully via all 7 migrations
- [ ] `.env.example` complete; app boots locally
- [ ] Auth works (login/logout + protected routes)
- [ ] Standard error format correct on all endpoints

### Phase 2 — Core API
- [ ] All endpoints implemented as per contract (schemas validated via Zod)
- [ ] Role-based access enforced; no privilege escalation paths
- [ ] `openapi.yaml` version `4.0.0` exists, is complete for MVP, and matches implemented behavior
- [ ] Example payload set exists for every endpoint (≥1 success + ≥1 error) and validates against OpenAPI
- [ ] `students.classid` nullable — graduated students return `classId: null`, `className: null`
- [ ] `students.status` field correct — `Graduated` only settable via graduation action
- [ ] `POST /api/users` returns `temporaryPassword` when password omitted, `null` when provided
- [ ] `PUT /api/classes/:id/promote` handles both promote and graduate actions
- [ ] `batches.status` accepts `Graduated`, rejects `Archived`
- [ ] All `students → classes` joins use `LEFT JOIN`

### Phase 3 — Reliability & Security
- [ ] `temporaryPassword` NEVER appears in logs
- [ ] Input validation on all endpoints
- [ ] No sensitive data leaked in errors/logs
- [ ] Contract enforcement gate passes in CI (Dredd)

### Phase 4 — Deployment Proof
- [ ] Staging deployment URL works
- [ ] API docs URL works (OpenAPI matches behavior)
- [ ] Mock server starts: `npx prism mock ./docs/openapi.yaml --port 4010`
- [ ] All 7 migrations run cleanly on fresh DB and on migrated v3.6 DB

***

## 8. Project Structure (Backend skeleton — unchanged)

```text
/
├── .env.example
├── package.json
├── tsconfig.json
├── README.md
├── /docs
│   └── openapi.yaml
├── /src
│   ├── app.ts
│   ├── server.ts
│   ├── /config
│   ├── /db
│   │   └── /migrations
│   ├── /modules
│   ├── /routes
│   ├── /middleware
│   ├── /services
│   ├── /utils
│   └── /types
└── /tests
    ├── /unit
    └── /integration
```

**Naming convention:** camelCase files, SNAKE_CASE error codes
**Import alias:** `@/`

***

## 9. Constraints (Non-Functional)

**Performance Targets (LOCKED):**
- p95 latency: ≤300ms
- Error rate: <1% under normal load
- Sustained RPS: 10 RPS for 10 minutes

**Security Baseline (LOCKED):**
- Password hashing: bcrypt rounds = 10
- HTTPS in production
- Secrets not committed to version control
- OWASP basics: Zod validation on all inputs, authz checks on every route, secure headers via helmet
- `temporaryPassword` returned in response body only — never in logs, never persisted in plaintext

**Hosting/Budget Constraints:**
- Monthly hosting budget: $5–$45/month
- Single-region deployment

***

## 10. Deployment, Rollback, Backups, DR

**Deployment method:** CI pipeline (GitHub Actions) → Render/Fly.io
**Environments:** dev / staging / prod
**Rollback strategy:** Redeploy previous Docker image; DB rollback via migration down scripts
**Backup policy:** Daily automated DB backup, 7-day retention, restore drill monthly
**DR:** RPO 24h, RTO 4h

***

## 11. Forbidden Changes (Scope Lock)

**BANNED without a new Freeze version + price/time update:**
- Add roles/permissions model changes
- Switch DB/dialect
- Add new external integrations
- Add realtime websockets
- Change auth mode (JWT ↔ sessions)
- Change pagination standard
- Change `openapi.yaml` without a Freeze version bump + explicit breaking-change decision

If requested → create Change Request → re-price → approve/reject.

***

## 12. Change Control (Accept-and-price rules)

**Change Request Format:**
- Requested change:
- Reason:
- Scope impact:
- Timeline impact:
- Cost impact:
- Risk impact:
- Decision: Approved / Rejected
- New Freeze version: vX.Y
- OpenAPI artifact change: none / patched / breaking, new version: [value]

**Billing rule:** Per change request — re-priced individually
**Response SLA for change requests:** 24 hours

***

## 13. Version History

- **v1.0** (2026-01-15): Initial backend freeze approved for execution.
- **v3.1** (2026-02-01): Multi-role support, soft-delete, bulk operations.
- **v3.2** (2026-02-10): Tenant status (active/inactive), feature flags.
- **v3.3** (2026-02-17): Dynamic school periods, immutable timetable versioning.
- **v3.4** (2026-02-24): Student role, attendance corrections, userid FK on students.
- **v3.5** (2026-03-03): CR-13 admission number + dob, student login derivation.
- **v3.6** (2026-03-03): CR-14–CR-19: SNAKE_CASE errors, GET single-resource endpoints, JWT 30d, soft-delete middleware, tenant timezone, class promote endpoint.
- **v4.0** (2026-03-05): CR-20 optional teacher password; CR-21 graduation action + classid nullable; CR-22 student status field; CR-23 batch Archived→Graduated rename (breaking).
