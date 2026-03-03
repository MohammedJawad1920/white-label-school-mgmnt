# BACKEND PROJECT FREEZE: White-Label School Management System
**Version:** 3.5 (IMMUTABLE)
**Date:** 2026-03-03
**Status:** APPROVED FOR EXECUTION
**Previous Version:** v3.4 — 2026-03-02

> **CRITICAL INSTRUCTION FOR EXECUTION (HUMAN OR AI):**
> This document is the Absolute Source of Truth. You have NO authority to modify schema, API
> contracts, or scope defined below. If any request contradicts this document, you must REFUSE
> and open a Change Request instead.

---

## CHANGE SUMMARY v3.4 → v3.5

### CRs Applied
- **CR-11** Inline timetable cell entry — Frontend-only, Additive
- **CR-12** Admin self-role edit unblocked in UI — Frontend-only, Additive
- **CR-13** Auto student user creation + users/students page separation — Breaking

### What Changed
- `students` table gains `admission_number VARCHAR(50) NOT NULL` + `dob DATE NOT NULL` + `UNIQUE(tenantid, admission_number)`
- Migration `004_student_admission_dob.sql` required
- `POST /api/students` request: adds `admissionNumber` (required), `dob` (required DATE); atomically creates `users` row + `students` row in a single transaction
- `GET /api/students` response: adds `admissionNumber`, `dob`, `loginId` fields
- `GET /api/users`: excludes all users where `roles @> '["Student"]'::jsonb`
- `POST /api/users`: rejects `Student` in roles → `400 INVALIDROLE`
- `PUT /api/students/:id/link-account`: deprecated in OpenAPI (backend retained for migration only; removed from frontend)
- Frontend — Timetable: standalone "Add Slot" button removed; empty cell click is sole create trigger
- Frontend — Users page: `!isSelf` guard on Edit Roles button removed; `403 LASTADMIN` shown inline for self-edit

### Breaking Changes
- `POST /api/students` request shape changed (admissionNumber + dob added, no email/password)
- `GET /api/students` response shape extended
- `GET /api/users` no longer returns Student-role users
- `POST /api/users` rejects Student role

### New Error Codes
| Code | HTTP | Trigger |
|---|---|---|
| `ADMISSIONNUMBERCONFLICT` | 409 | admissionNumber already active in tenant |
| `INVALIDROLE` | 400 | `Student` passed in `POST /api/users` roles array |

### Unchanged from v3.4
- All authentication endpoints
- All timetable endpoints and business logic
- All attendance endpoints and business logic
- All school-periods endpoints
- SuperAdmin endpoints
- JWT payload shapes
- Global error format
- Soft-delete policy
- All other invariants

---

## 0. Commercials (Accept-and-price)

**Engagement Type:** Fixed-scope
**Chosen Package:** Standard
**Price & Payment Schedule:** Unchanged from v3.4
**Timeline Range (weeks):** 8–10
**Assumptions (must be true):**
- Single decision maker available within 24 hours for clarifications
- Staging environment accessible by Week 3

**Support Window (post-delivery):**
- Bugfix support: 30 days
- Enhancements: billed as Change Requests

---

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
- Student-to-user bulk linking (CSV import) — manual one-by-one via `PUT /api/students/:id/link-account` (deprecated, migration use only)
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
- Can update any user's roles including own EXCEPT cannot remove own Admin role if they are the last Admin in the tenant (`LASTADMIN`)
- Can bulk-delete users, students, classes, batches, subjects
- Full CRUD on schoolperiods
- Can link/unlink student user accounts via `PUT /api/students/:id/link-account` (deprecated — migration use only; use `POST /api/students` for new enrollments)
- Can correct any attendance record (`PUT /api/attendance/:recordId`)

**Teacher** — Tenant-scoped
- Can view timetable (all classes, all teachers, read-only)
- Can view own assigned classes
- Can record attendance for own classes
- Can view attendance for students in own classes
- Can view schoolperiods (read-only)
- Can correct attendance records for own-class timeslots only
- Cannot end TimeSlot assignments (Admin-only)

**Student** — Tenant-scoped (v3.4, unchanged in v3.5)
- Can view timetable (read-only)
- Can view schoolperiods (read-only)
- Can view own attendance: `GET /api/students/:studentId/attendance` where `students.userId = req.user.userId` only — `403 STUDENTACCESSDENIED` otherwise
- Cannot record, correct, or delete any data
- Login credentials: admission number + `DDMMYYYY` of date of birth, concatenated (e.g., `53010032003`)
- Account is auto-created atomically when admin runs `POST /api/students`
- Student accounts are NOT visible in `GET /api/users` — managed exclusively via Students page

**Multiple Roles** (v3.1, unchanged)
- Users can hold multiple roles simultaneously (e.g., Teacher + Admin)
- Authorization checks if user has required role using array membership
- `activeRole` in JWT is a UI context hint only — does NOT gate API access
- All write authorization checks validate against the full `roles` array

### Module Structure

- **Timetable Management** — Core module, can be enabled standalone
- **Attendance Tracking** — Dependent module, REQUIRES Timetable to be enabled

---

## 1.2 Assumptions & External Dependencies

**External Systems:** None

**Operational Assumptions:**
- Hosting: Single monolith deployment — Render/Fly.io/Railway or equivalent ($5–$45/month tier)
- Data retention: Indefinite, no automated deletion
- Expected user scale: 5–50 schools initially, 25,000 total students max, 10 concurrent RPS
- Admin/support operations: Manual DB access for SuperAdmin seeding only

---

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
JWT_EXPIRES_IN=365d
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
- `JWT_EXPIRES_IN` uses format `365d`, `30d`, `7d` — do not use less than `7d`

---

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

---

## 2. Data Layer (Schema Truth)

**Dialect:** PostgreSQL
**Extensions:** None required

```sql
-- --------------------------------------------------------
-- TENANTS TABLE (v3.2: added status, deactivatedat)
-- --------------------------------------------------------
CREATE TABLE tenants (
  id          VARCHAR(50) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK(status IN ('active','inactive')),
  deactivatedat TIMESTAMPTZ DEFAULT NULL,
  createdat   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat   TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
-- BATCHES TABLE (Academic Years)
-- --------------------------------------------------------
CREATE TABLE batches (
  id        VARCHAR(50) PRIMARY KEY,
  tenantid  VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      VARCHAR(100) NOT NULL,
  startyear INTEGER NOT NULL,
  endyear   INTEGER NOT NULL,
  status    VARCHAR(50) NOT NULL DEFAULT 'Active'
              CHECK(status IN ('Active','Archived')),
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
-- --------------------------------------------------------
CREATE TABLE students (
  id               VARCHAR(50) PRIMARY KEY,
  tenantid         VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  classid          VARCHAR(50) NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  batchid          VARCHAR(50) NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  userid           VARCHAR(50) DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
  admission_number VARCHAR(50) NOT NULL,
  dob              DATE NOT NULL,
  deletedat        TIMESTAMPTZ DEFAULT NULL,
  createdat        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenantid, admission_number)
);
CREATE INDEX        idx_students_tenantid ON students(tenantid);
CREATE INDEX        idx_students_classid  ON students(classid);
CREATE INDEX        idx_students_batchid  ON students(batchid);
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
--       originalstatus (status column) is NEVER mutated
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
CREATE INDEX idx_attendance_tenantid       ON attendancerecords(tenantid);
CREATE INDEX idx_attendance_studentid      ON attendancerecords(studentid);
CREATE INDEX idx_attendance_timeslotid     ON attendancerecords(timeslotid);
CREATE INDEX idx_attendance_date           ON attendancerecords(date);
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
src/db/migrations/001_initial_schema.sql          — v3.1 base
src/db/migrations/002_add_student_userid.sql       — v3.4 CR-08
src/db/migrations/003_add_attendance_corrections.sql — v3.4 CR-09
src/db/migrations/004_student_admission_dob.sql    — v3.5 CR-13 ← NEW
```

**Migration 004 content:**
```sql
-- v3.5 CR-13: Add admission_number and dob to students
ALTER TABLE students
  ADD COLUMN admission_number VARCHAR(50),
  ADD COLUMN dob DATE;

-- Backfill existing rows before enforcing NOT NULL
-- Admin must run this manually for pre-existing students,
-- OR use PUT /api/students/:id/link-account for migration.
-- After backfill:
ALTER TABLE students
  ALTER COLUMN admission_number SET NOT NULL,
  ALTER COLUMN dob SET NOT NULL;

ALTER TABLE students
  ADD CONSTRAINT uq_students_tenant_admission UNIQUE(tenantid, admission_number);
```

### Data Invariants (Application-Enforced Rules)

- `Student.batchid` MUST equal `Class.batchid` — validate on insert/update
- Cannot delete Class if Student records reference it — RESTRICT
- Cannot delete Subject if TimeSlot records reference it — RESTRICT
- Cannot delete User if TimeSlot or AttendanceRecord references them — RESTRICT
- TimeSlot updates must create new records, not modify existing (immutability)
- `AttendanceRecord.date` cannot be in the future
- Feature `attendance` can only be enabled if `timetable` is enabled
- `User.roles` must be a non-empty array containing only `Teacher`, `Admin`, `Student`
- `User.roles` must not contain duplicates — deduplicate before saving
- `TimeSlot.teacherid` must reference a User with `Teacher` in their roles array
- Admin calling `PUT /api/users/:id/roles` targeting self: allowed EXCEPT removing own Admin role when no other active Admin exists in the tenant → `403 LASTADMIN`
- A tenant with `status = inactive` causes all its users to receive `403 Tenant is inactive` on every API call — enforced in `tenantContextMiddleware`
- SuperAdmin credentials must be seeded via DB script only — no API creation path
- `students.userid` is unique per non-null value — enforced by partial unique index
- A Student-role user may only call `GET /api/students/:studentId/attendance` where `students.userId = caller.userId` — all other student records → `403 STUDENTACCESSDENIED`
- When a user is soft-deleted (`deletedat = NOW()`), if `students.userid = userId`, set `students.userid = NULL` in the same transaction
- `attendancerecords.status` (original) is never mutated after insert — corrections write only to `correctedstatus`, `correctedby`, `correctedat`
- Only one correction level per record — re-correcting overwrites `correctedstatus`, `correctedby`, `correctedat` in place; original `status` remains unchanged forever
- Student role: no write access to any resource
- `timeslots.periodnumber` must exist in `schoolperiods` for the same `tenantid` — validated at app layer on `POST /api/timetable`
- Cannot delete a schoolperiod if any active (`effectiveto IS NULL`) timeslot references that `periodnumber` for the same tenant → `409 HASREFERENCES`
- `schoolperiods` must be configured before any timetable entry can be created → `400 PERIODNOTCONFIGURED`
- `schoolperiods.starttime < endtime` — enforced on create/update
- `schoolperiods.periodnumber` is immutable after creation
- **v3.5 CR-13:** `students.admission_number` must be unique within the tenant (active records only — `deletedat IS NULL`) → `409 ADMISSIONNUMBERCONFLICT`
- **v3.5 CR-13:** `POST /api/users` must reject any `roles` array containing `Student` → `400 INVALIDROLE`
- **v3.5 CR-13:** `GET /api/users` MUST apply `WHERE NOT (roles @> '["Student"]'::jsonb)` — Student-role users are never returned from the users listing
- **v3.5 CR-13:** Student login password is derived as: `bcrypt(admissionNumber + DDMMYYYY(dob))` — zero-padded, e.g., admission `530`, dob `2003-10-03` → password = `53003102003`
- **v3.5 CR-13:** When admin updates `dob` on a student record, `users.passwordhash` MUST be re-computed as `bcrypt(admissionNumber + DDMMYYYY(newDob))` in the same transaction (Reset Login)

### Soft Delete Policy (v3.1, unchanged)

- All DELETE operations MUST set `deletedat = NOW()` instead of removing rows — applies to: users, batches, subjects, classes, students, timeslots
- All read queries MUST include `WHERE deletedat IS NULL` filter
- Hard delete ONLY via manual DB admin action
- Attendance records are NOT soft-deleted — immutable audit trail
- Features, tenantfeatures, tenants, superadmins, schoolperiods are NOT soft-deleted

---

## 2.1 Transactions, Concurrency, Idempotency

### Transaction Boundaries

| Workflow | Tables Touched | Commit/Rollback Condition |
|---|---|---|
| Create tenant (CR-06) | tenants, schoolperiods ×8, users | All-or-nothing — any failure = full rollback |
| **Create student (CR-13)** | **users, students** | **All-or-nothing — user insert failure = full rollback, no orphaned student** |
| Record class attendance | attendancerecords | Per-student insert — partial failure returns which students failed |
| Soft delete user | users, students (userid nullify) | Both in single transaction |
| Update student dob | students, users (passwordhash) | Both in single transaction |

### Concurrency Strategy

- No optimistic locking required at MVP scale (10 RPS)
- Unique indexes enforce slot-level timetable conflicts at DB layer
- Attendance unique constraint `(studentid, timeslotid, date)` prevents double-recording at DB layer
- `UNIQUE(tenantid, admission_number)` on students prevents duplicate admission numbers

### Idempotency

- No `Idempotency-Key` header in MVP
- Attendance recording is idempotent by DB unique constraint — duplicate → `409`
- Student creation is NOT idempotent — duplicate admission number → `409 ADMISSIONNUMBERCONFLICT`

---

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
|---|---|
| 200 | Success (GET, PUT, bulk DELETE) |
| 201 | Created (POST) |
| 204 | No Content (single DELETE) |
| 400 | Bad Request — validation failure |
| 401 | Unauthorized — missing/invalid token |
| 403 | Forbidden — insufficient permissions, feature disabled, inactive tenant |
| 404 | Not Found |
| 409 | Conflict — duplicate entry, referential integrity violation |
| 500 | Internal Server Error |

### 3.1 OpenAPI Contract Artifact (REQUIRED, LOCKED)

- **File name:** `openapi.yaml`
- **Repo path:** `./docs/openapi.yaml`
- **OpenAPI version:** 3.1.0
- **API version identifier:** `3.5.0` (bumped from 3.4.0)

**Consistency rule (hard):** Endpoint list + schemas + status codes in this Freeze MUST match `openapi.yaml` exactly. If mismatch exists → Freeze is invalid until corrected.

**Breaking change rules:**
- Major version bump requires Freeze version bump
- Minor version bump for additive changes only
- Patch version bump for clarifications/fixes only

### 3.2 Example Payload Set (REQUIRED)

**POST /api/students — success (v3.5)**
```json
Request:
{ "name": "Ravi Kumar", "classId": "C001", "batchId": "B001", "admissionNumber": "530", "dob": "2003-10-03" }

Response 201:
{
  "student": {
    "id": "S001", "name": "Ravi Kumar", "classId": "C001", "className": "Grade 10A",
    "batchId": "B001", "batchName": "2025-26",
    "admissionNumber": "530", "dob": "2003-10-03",
    "loginId": "530@greenvalley.local", "userId": "U999"
  }
}
```

**POST /api/students — error: duplicate admission number**
```json
Response 409:
{ "error": { "code": "ADMISSIONNUMBERCONFLICT", "message": "Admission number 530 already exists for this school", "details": {} }, "timestamp": "2026-03-03T07:00:00Z" }
```

**POST /api/users — error: Student role rejected**
```json
Response 400:
{ "error": { "code": "INVALIDROLE", "message": "Student accounts must be created via the Students page", "details": {} }, "timestamp": "2026-03-03T07:00:00Z" }
```

**GET /api/users — success (Student-role users excluded)**
```json
Response 200:
{ "users": [{ "id": "U123", "name": "John Doe", "email": "john@school1.com", "roles": ["Teacher"] }] }
```

**PUT /api/users/:id/roles — self-edit success (Admin adds Teacher to self)**
```json
Request: { "roles": ["Admin", "Teacher"] }
Response 200: { "user": { "id": "U123", "name": "John Doe", "email": "john@school1.com", "roles": ["Admin", "Teacher"] } }
```

**PUT /api/users/:id/roles — LASTADMIN error**
```json
Response 403:
{ "error": { "code": "LASTADMIN", "message": "Cannot remove Admin role — you are the last admin of this tenant", "details": {} }, "timestamp": "2026-03-03T07:00:00Z" }
```

*(All v3.4 examples for other endpoints remain valid and unchanged — refer to openapi.yaml v3.5.0)*

### 3.3 Mock Server (REQUIRED)

**Tool:** Prism (serves mocks directly from `openapi.yaml` — no extra code)

**Install (one-time):**
```bash
npm install -g @stoplight/prism-cli
```

**Run command (LOCKED):**
```bash
prism mock ./docs/openapi.yaml --port 4010
```

**File path contract:** `openapi.yaml` MUST live at `./docs/openapi.yaml` in the repo root.

**Frontend usage:**
- Base URL for mocks: `http://localhost:4010/api`
- Set `VITE_API_BASE_URL=http://localhost:4010/api`

| Scenario | Header | Endpoint |
|---|---|---|
| Missing/invalid token | `Prefer: code=401` | Any protected endpoint |
| Inactive tenant login | `Prefer: code=403` | `POST /api/auth/login` |
| Period not configured | `Prefer: code=400` | `POST /api/timetable` |
| Duplicate email on create user | `Prefer: code=409` | `POST /api/users` |
| Student batch mismatch | `Prefer: code=400` | `POST /api/students` |
| Duplicate admission number | `Prefer: code=409` | `POST /api/students` |
| Student role in POST users | `Prefer: code=400` | `POST /api/users` |
| Resource not found | `Prefer: code=404` | Any `:id` endpoint |
| Last admin guard | `Prefer: code=403` | `PUT /api/users/:id/roles` |
| Same status correction | `Prefer: code=400` | `PUT /api/attendance/:id` |

### 3.4 Contract Enforcement (REQUIRED)

**Provider contract testing approach:** OpenAPI-driven contract tests (Dredd or equivalent)

**CI Gate (locked):**
- Runs on: PR to `main` branch
- Must fail build if: OpenAPI mismatch OR contract tests fail OR examples fail schema validation
- Artifacts published: `openapi.yaml` versioned file

---

## 3.5 Endpoints (MVP only — ALL listed)

### AUTHENTICATION ENDPOINTS

#### POST /api/auth/login
- **Purpose:** Authenticate tenant user and establish session
- **Auth required:** No
- **Request body:**
  - `email` string required — for Students this is the `loginId` (e.g., `530@greenvalley.local`)
  - `password` string required, min 8 — for Students: `admissionNumber + DDMMYYYY(dob)`
  - `tenantSlug` string required, 1–100 chars
- **Response 200:** `{ token, user: { id, tenantId, name, email, roles, activeRole } }`
- **Errors:**
  - `400` email, password, and tenantSlug are required
  - `401` Invalid credentials
  - `403 TENANTINACTIVE` Tenant is inactive
  - `404` Tenant does not exist

#### POST /api/auth/logout
- **Purpose:** Invalidate current session
- **Auth required:** Yes (any tenant role)
- **Request body:** Empty
- **Response:** `204 No Content`

#### POST /api/auth/switch-role
- **Purpose:** Switch active role context for multi-role users. Issues new JWT with updated `activeRole`.
- **Auth required:** Yes (any tenant user)
- **Request body:** `{ role: "Teacher" | "Admin" | "Student" }` — must exist in caller's roles array
- **Response 200:** `{ token, user: { id, roles, activeRole } }`
- **Errors:**
  - `400 ROLENOTASSIGNED` Requested role is not assigned to this user
  - `403 SINGLEROLEUSER` User has only one role, switching not applicable

---

### SUPER ADMIN ENDPOINTS

*All routes under `/api/super-admin` require `superAdminAuthMiddleware`. They do NOT use `tenantContextMiddleware`.*

#### POST /api/super-admin/auth/login
- **Auth required:** No
- **Request body:** `{ email, password }`
- **Response 200:** `{ token, superAdmin: { id, name, email } }`

#### GET /api/super-admin/tenants
- **Auth required:** Yes (SuperAdmin)
- **Query params:** `status` (active|inactive), `search`
- **Response 200:** `{ tenants: [...] }`

#### POST /api/super-admin/tenants
- **Auth required:** Yes (SuperAdmin)
- **Request body:** `{ id, name, slug, admin: { name, email, password } }`
- **Response 201:** `{ tenant, admin: { id, name, email, roles } }`
- **Errors:** `400 VALIDATIONERROR`, `409 CONFLICT`, `409 ADMINEMAILTAKEN`

#### PUT /api/super-admin/tenants/:tenantId
- **Auth required:** Yes (SuperAdmin)
- **Request body:** `{ name?, slug? }` (at least one)
- **Response 200:** `{ tenant }`

#### PUT /api/super-admin/tenants/:tenantId/deactivate
- **Response 200:** `{ tenant }` | `409 ALREADYINACTIVE`

#### PUT /api/super-admin/tenants/:tenantId/reactivate
- **Response 200:** `{ tenant }` | `409 ALREADYACTIVE`

#### GET /api/super-admin/tenants/:tenantId/features
- **Response 200:** `{ features: [...] }`

#### PUT /api/super-admin/tenants/:tenantId/features/:featureKey
- **Request body:** `{ enabled: boolean }`
- **Response 200:** `{ feature }` | `400 FEATUREDEPENDENCY`

---

### FEATURE MANAGEMENT ENDPOINTS

#### GET /api/features
- **Auth required:** Yes (Admin only, read-only)
- **Response 200:** `{ features: [...] }`

---

### SCHOOL PERIODS ENDPOINTS (v3.3, unchanged)

#### GET /api/school-periods
- **Auth required:** Yes (Teacher, Admin, Student — read-only)
- **Response 200:** `{ periods: [...] }` | `403 FEATUREDISABLED`

#### POST /api/school-periods
- **Auth required:** Yes (Admin only)
- **Request body:** `{ periodNumber, label?, startTime, endTime }`
- **Response 201:** `{ period }` | `400 PERIODTIMEINVALID` | `409 CONFLICT`

#### PUT /api/school-periods/:id
- **Auth required:** Yes (Admin only)
- **Request body:** At least one of `label`, `startTime`, `endTime`
- **Response 200:** `{ period }` | `400 PERIODTIMEINVALID` | `404`

#### DELETE /api/school-periods/:id
- **Auth required:** Yes (Admin only)
- **Response 204** | `409 HASREFERENCES`

---

### TIMETABLE ENDPOINTS

#### GET /api/timetable
- **Auth required:** Yes (Teacher, Admin, Student — read-only)
- **Query params:** `date`, `dayOfWeek`, `teacherId`, `classId`, `status` (Active|All, default Active)
- **Response 200:** `{ timetable: [...] }` — `startTime`, `endTime`, `label` derived via JOIN from `schoolperiods`
- **Errors:** `403 FEATUREDISABLED`

#### POST /api/timetable
- **Auth required:** Yes (Admin only)
- **Request body:** `{ classId, subjectId, teacherId, dayOfWeek, periodNumber, effectiveFrom }`
  - `startTime`/`endTime` NOT accepted — derived from `schoolperiods` at read time
- **Response 201:** `{ timeSlot }` with `startTime`/`endTime`/`label` from `schoolperiods` JOIN
- **Errors:** `400 PERIODNOTCONFIGURED`, `400 INVALIDTEACHER`, `403`, `409 CONFLICT`

#### PUT /api/timetable/:timeSlotId/end
- **Auth required:** Yes (Admin only)
- **Request body:** `{ effectiveTo: "YYYY-MM-DD" }`
- **Response 200:** `{ timeSlot: { id, effectiveTo } }` | `404`

---

### USER MANAGEMENT ENDPOINTS

#### GET /api/users
- **Auth required:** Yes (Admin only)
- **Query params:** `role` (Teacher|Admin), `search`
- **Response 200:** `{ users: [...] }`
- **v3.5 CR-13:** Student-role users (`roles @> '["Student"]'`) are EXCLUDED from all results. Role filter enum is `Teacher | Admin` only.

#### POST /api/users
- **Auth required:** Yes (Admin only)
- **Request body:** `{ name, email, password (min 8), roles: ["Teacher"|"Admin"] }`
- **v3.5 CR-13:** `roles` array must NOT contain `Student` → `400 INVALIDROLE`
- **Response 201:** `{ user }` | `409 CONFLICT`

#### DELETE /api/users/bulk
- **Auth required:** Yes (Admin only)
- **Request body:** `{ ids: string[] }`
- **Response 200:** `{ deleted: [...], failed: [...] }`

#### DELETE /api/users/:id
- **Auth required:** Yes (Admin only)
- **Response 204** | `409 HASREFERENCES`

#### PUT /api/users/:id/roles
- **Auth required:** Yes (Admin only)
- **Request body:** `{ roles: ["Teacher"|"Admin"|"Student"] }` (min 1, unique)
- **v3.5 CR-12:** Admin MAY target self. `SELFROLECHANGEFORBIDDEN` removed. `LASTADMIN` guard remains.
- **Response 200:** `{ user }` | `403 LASTADMIN` | `404`

---

### STUDENT MANAGEMENT ENDPOINTS

#### GET /api/students
- **Auth required:** Yes (Admin only for list; Teacher scoped to own classes)
- **Query params:** `classId`, `batchId`, `search`, `limit` (default 50), `offset` (default 0)
- **Response 200:**
```json
{
  "students": [{
    "id": "S001", "name": "Ravi Kumar",
    "classId": "C001", "className": "Grade 10A",
    "batchId": "B001", "batchName": "2025-26",
    "admissionNumber": "530", "dob": "2003-10-03",
    "loginId": "530@greenvalley.local",
    "userId": "U999"
  }],
  "pagination": { "limit": 50, "offset": 0, "total": 120 }
}
```

#### POST /api/students
- **Auth required:** Yes (Admin only)
- **Request body (v3.5 CR-13):**
  - `name` string required, max 255
  - `classId` string required
  - `batchId` string required — must match `class.batchId`
  - `admissionNumber` string required — unique per tenant
  - `dob` string required — format `YYYY-MM-DD`
- **Atomically creates:**
  1. `users` row: `email = {admissionNumber}@{tenantSlug}.local`, `passwordhash = bcrypt(admissionNumber + DDMMYYYY(dob))`, `roles = ["Student"]`, `name = student.name`
  2. `students` row: with `userid` set to the newly created user
- **Response 201:** `{ student }` including `admissionNumber`, `dob`, `loginId`, `userId`
- **Errors:**
  - `400` Validation failure or `batchId`/`classId` mismatch
  - `409 ADMISSIONNUMBERCONFLICT` Admission number already active in tenant

#### PUT /api/students/:id
- **Auth required:** Yes (Admin only)
- **Request body:** `{ name?, classId?, batchId?, admissionNumber?, dob? }`
- **v3.5 CR-13:** If `dob` is updated → `users.passwordhash` re-computed as `bcrypt(admissionNumber + DDMMYYYY(newDob))` in same transaction (Reset Login)
- **Response 200:** `{ student }` | `409 ADMISSIONNUMBERCONFLICT`

#### DELETE /api/students/bulk
- **Auth required:** Yes (Admin only)
- **Request body:** `{ ids: string[] }`
- **Response 200:** `{ deleted: [...], failed: [...] }`

#### DELETE /api/students/:id
- **Auth required:** Yes (Admin only)
- **Response 204** | `409 HASREFERENCES` (has attendance records)

#### PUT /api/students/:studentId/link-account ⚠️ DEPRECATED in v3.5
- **Status:** Deprecated — backend retained for migration of pre-existing students only
- **Frontend:** Removed from UI
- **Auth required:** Yes (Admin only)
- **Request body:** `{ userId: string | null }`
- **Response 200:** `{ student }` | `400 INVALIDUSER` | `409 USERALREADYLINKED`

---

### ATTENDANCE ENDPOINTS

#### GET /api/students/:studentId/attendance
- **Auth required:**
  - Admin: any student in tenant
  - Teacher: students in own assigned classes only
  - Student: only where `students.userId = req.user.userId` → `403 STUDENTACCESSDENIED` otherwise
- **Query params:** `from`, `to`, `limit` (default 50), `offset` (default 0)
- **Response 200:** `{ student, records, summary, pagination }`
  - Each record: `{ id, date, originalStatus, status (effective), correctedBy, correctedAt, timeSlot, recordedBy, recordedAt }`
  - `status` = `correctedStatus ?? originalStatus`

#### POST /api/attendance/record-class
- **Auth required:** Yes (Teacher own classes, Admin all)
- **Request body:** `{ timeSlotId, date, defaultStatus, exceptions: [{ studentId, status }] }`
- **Response 201:** `{ recorded, present, absent, late, date, timeSlot }`
- **Errors:** `400 FUTUREDATE`, `403 FEATUREDISABLED`, `409 CONFLICT`

#### PUT /api/attendance/:recordId
- **Auth required:** Yes (Teacher own-class, Admin any)
- **Request body:** `{ status: "Present"|"Absent"|"Late" }`
- **Response 200:** `{ record }` with `originalStatus` + effective `status`
- **Errors:** `400 FUTUREDATE`, `400 SAMESTATUS`, `403`, `404`

#### GET /api/attendance/summary
- **Auth required:** Yes (Admin only)
- **Query params:** `classId`, `from` (required), `to` (required)
- **Response 200:** `{ class, period, summary, byStudent }`

---

## 4. Critical Business Logic (Pseudocode only)

### Flow: createStudent (v3.5 CR-13 — replaces direct INSERT)

```
FUNCTION createStudent(name, classId, batchId, admissionNumber, dob, tenantId, tenantSlug)

1. VALIDATE all fields present; dob is valid DATE
2. SELECT id FROM classes WHERE id = classId AND batchid = batchId AND tenantid = tenantId
   IF not found → 400 CLASSBATCHMISMATCH
3. SELECT id FROM students
   WHERE tenantid = tenantId AND admission_number = admissionNumber AND deletedat IS NULL
   IF found → 409 ADMISSIONNUMBERCONFLICT
4. BEGIN TRANSACTION
5.   dobDDMMYYYY = formatDate(dob, "DDMMYYYY")  // zero-padded, e.g. "03102003"
     password = admissionNumber + dobDDMMYYYY     // e.g. "53003102003"
     loginId  = admissionNumber + "@" + tenantSlug + ".local"
     newUserId = genId()
     INSERT INTO users (id, tenantid, name, email, passwordhash, roles)
     VALUES (newUserId, tenantId, name, loginId, bcrypt(password), '["Student"]')
     → ON CONFLICT (tenantid, email) WHERE deletedat IS NULL → 409 ADMISSIONNUMBERCONFLICT
6.   newStudentId = genId()
     INSERT INTO students (id, tenantid, name, classid, batchid, userid, admission_number, dob)
     VALUES (newStudentId, tenantId, name, classId, batchId, newUserId, admissionNumber, dob)
7. COMMIT
8. SELECT student with JOIN className, batchName
9. RETURN 201 { student: { ...fields, admissionNumber, dob, loginId, userId: newUserId } }
```

### Flow: updateStudent (v3.5 — handles dob change = Reset Login)

```
FUNCTION updateStudent(studentId, updates, tenantId, tenantSlug)

1. SELECT student WHERE id = studentId AND tenantid = tenantId AND deletedat IS NULL
   IF not found → 404
2. IF updates.admissionNumber AND updates.admissionNumber != student.admissionNumber
     CHECK uniqueness → 409 ADMISSIONNUMBERCONFLICT if conflict
3. IF updates.dob OR updates.admissionNumber (either changes password derivation)
     newAdmissionNumber = updates.admissionNumber ?? student.admissionNumber
     newDob = updates.dob ?? student.dob
     newDobDDMMYYYY = formatDate(newDob, "DDMMYYYY")
     newPassword = newAdmissionNumber + newDobDDMMYYYY
     newLoginId  = newAdmissionNumber + "@" + tenantSlug + ".local"
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
4. RETURN 200 { student }
```

### Flow: updateUserRoles (CR-10 — unchanged from v3.4)

```
FUNCTION updateUserRoles(targetId, newRoles, callerId, callerRoles, tenantId)

1. VALIDATE newRoles: non-empty array, no duplicates, all values in [Teacher, Admin, Student]
   IF invalid → 400
2. SELECT roles FROM users WHERE id = targetId AND tenantid = tenantId AND deletedat IS NULL
   IF not found → 404
3. IF targetId == callerId (self-edit path)
     IF Admin IN callerRoles AND Admin NOT IN newRoles
       adminCount = SELECT COUNT(*) FROM users
         WHERE tenantid = tenantId AND roles @> '["Admin"]'::jsonb
         AND deletedat IS NULL AND id != callerId
       IF adminCount == 0 → 403 LASTADMIN
4. UPDATE users SET roles = deduplicate(newRoles), updatedat = NOW() WHERE id = targetId
5. RETURN 200 { user }
```

### Flow: createTimeSlot (v3.3, unchanged)

```
FUNCTION createTimeSlot(classId, subjectId, teacherId, dayOfWeek, periodNumber, effectiveFrom, tenantId)

1. Verify timetable feature enabled → 403 if not
2. SELECT id FROM schoolperiods WHERE tenantid = tenantId AND periodnumber = periodNumber
   IF not found → 400 PERIODNOTCONFIGURED
3. SELECT roles FROM users WHERE id = teacherId AND tenantid = tenantId AND deletedat IS NULL
   IF Teacher NOT IN roles → 400 INVALIDTEACHER
4. SELECT id FROM timeslots
   WHERE tenantid = tenantId AND classid = classId AND dayofweek = dayOfWeek
   AND periodnumber = periodNumber AND effectiveto IS NULL AND deletedat IS NULL
   IF found → 409 CONFLICT
5. INSERT INTO timeslots (starttime=NULL, endtime=NULL — derived at read)
6. SELECT ts.*, sp.starttime, sp.endtime, sp.label FROM timeslots ts
   JOIN schoolperiods sp ON sp.periodnumber = ts.periodnumber AND sp.tenantid = ts.tenantid
   WHERE ts.id = newId
7. RETURN 201 { timeSlot }
```

### Flow: recordClassAttendance (unchanged)

```
FUNCTION recordClassAttendance(timeSlotId, date, defaultStatus, exceptions, callerId, callerRoles, tenantId)

1. Verify attendance feature enabled → 403 if not
2. SELECT ts.* FROM timeslots WHERE id = timeSlotId AND tenantid = tenantId AND deletedat IS NULL
   IF not found → 404
3. IF date > TODAY → 400 FUTUREDATE
4. IF Admin NOT IN callerRoles AND ts.teacherid != callerId → 403
5. SELECT id FROM attendancerecords WHERE timeslotid = timeSlotId AND date = date LIMIT 1
   IF found → 409 already recorded
6. SELECT id FROM students WHERE classid = ts.classid AND tenantid = tenantId AND deletedat IS NULL
7. FOR each student:
     status = exceptions[student.id] ?? defaultStatus
     INSERT INTO attendancerecords (tenantId, studentId, timeslotId, date, status, recordedby)
8. RETURN 201 { recorded, present, absent, late, date, timeSlot }
```

### Flow: correctAttendance (CR-09, unchanged)

```
FUNCTION correctAttendance(recordId, newStatus, callerId, callerRoles, tenantId)

1. SELECT ar.*, ts.teacherid FROM attendancerecords ar
   JOIN timeslots ts ON ts.id = ar.timeslotid
   WHERE ar.id = recordId AND ar.tenantid = tenantId
   IF not found → 404
2. IF ar.date > TODAY → 400 FUTUREDATE
3. effectiveStatus = ar.correctedstatus ?? ar.status
   IF newStatus == effectiveStatus → 400 SAMESTATUS
4. IF Admin NOT IN callerRoles:
     IF Teacher NOT IN callerRoles → 403
     IF ts.teacherid != callerId → 403
5. UPDATE attendancerecords
   SET correctedstatus = newStatus, correctedby = callerId, correctedat = NOW()
   WHERE id = recordId
6. RETURN 200 { record: { id, date, originalStatus: ar.status, status: newStatus, correctedBy, correctedAt, timeSlot } }
```

### Flow: softDeleteUser (v3.4, unchanged)

```
FUNCTION softDeleteUser(userId, tenantId)
BEGIN TRANSACTION
1. SELECT id FROM users WHERE id = userId AND tenantid = tenantId AND deletedat IS NULL
   IF not found → 404
2. Check RESTRICT constraints (timeslots, attendancerecords)
   IF referenced → 409 HASREFERENCES
3. UPDATE users SET deletedat = NOW() WHERE id = userId
4. UPDATE students SET userid = NULL WHERE userid = userId AND tenantid = tenantId
COMMIT
RETURN 204
```

---

## 5. Integrations & Failure Behavior

**None.** No external integrations in MVP.

---

## 6. Observability, Audit, Safety

**Logging (structured, pino):**
- Required fields: `requestId`, `userId` (if known), `tenantId` (if known), `route`, `statusCode`, `latencyMs`
- PII rules: `passwordhash`, raw passwords, DOB MUST NEVER be logged

**Audit log:**
- Embedded in attendance correction: `correctedby`, `correctedat`, `originalstatus` — immutable, no UI viewer (out of scope)

**Metrics (minimum):**
- RPS, p95 latency, error rate, DB pool saturation

---

## 7. Acceptance Criteria (Backend)

### Phase 1 — Foundation
- [ ] DB schema applied (migrations 001–004)
- [ ] `.env.example` complete; app boots locally
- [ ] Auth works (login/logout + protected routes)
- [ ] Standard error format with timestamp

### Phase 2 — Core API
- [ ] All endpoints implemented per contract (schemas Zod-validated)
- [ ] Role-based access enforced — no privilege escalation paths
- [ ] `openapi.yaml` v3.5.0 exists, complete for MVP, matches implemented behavior
- [ ] Example payload set for every endpoint (≥1 success + 1 error)
- [ ] Student creation atomically creates user row — no orphaned students possible
- [ ] `GET /api/users` never returns Student-role users
- [ ] `POST /api/users` rejects Student role
- [ ] DOB update on student re-hashes password in same transaction
- [ ] `loginId` visible in `GET /api/students` response for admin distribution

### Phase 3 — Reliability & Security
- [ ] Input validation on all endpoints
- [ ] No sensitive data (DOB, passwordhash) leaked in errors or logs
- [ ] Contract enforcement gate passes in CI
- [ ] `ADMISSIONNUMBERCONFLICT` raised correctly on duplicate

### Phase 4 — Deployment Proof
- [ ] Staging deployment URL works
- [ ] Mock server starts from `openapi.yaml` using locked command
- [ ] Smoke test: create student → login with `admissionNumber + DDMMYYYY(dob)` → receive JWT with `roles: ["Student"]`

---

## 8. Project Structure (Backend skeleton — unchanged)

```text
/
├── .env.example
├── package.json
├── tsconfig.json
├── docs/
│   └── openapi.yaml          ← v3.5.0
├── src/
│   ├── server.ts
│   ├── app.ts
│   ├── config/
│   ├── db/
│   │   ├── pool.ts
│   │   ├── migrations/
│   │   │   ├── 001_initial_schema.sql
│   │   │   ├── 002_add_student_userid.sql
│   │   │   ├── 003_add_attendance_corrections.sql
│   │   │   └── 004_student_admission_dob.sql   ← NEW
│   │   └── seeds/
│   │       └── superadmin.ts
│   ├── middleware/
│   │   ├── tenantContext.ts
│   │   ├── superAdminAuth.ts
│   │   ├── featureGuard.ts
│   │   ├── requireRole.ts
│   │   └── asyncHandler.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── super-admin/
│   │   ├── users/
│   │   ├── students/          ← createStudent logic updated (CR-13)
│   │   ├── classes/
│   │   ├── batches/
│   │   ├── subjects/
│   │   ├── timetable/
│   │   ├── school-periods/
│   │   └── attendance/
│   ├── types/
│   └── utils/
└── tests/
    ├── unit/
    └── integration/
```

---

## 9. Constraints (Non-Functional)

**Performance Targets (LOCKED):**
- p95 latency: ≤300ms
- Error rate: <1%
- Sustained RPS: 10 for 5 minutes

**Security Baseline (LOCKED):**
- Password hashing: bcrypt rounds = 10
- HTTPS in production
- Secrets not committed
- DOB never logged or returned in API responses after creation
- `loginId` (system email) returned in `GET /api/students` for admin display only — not a real email

**Hosting/Budget Constraints:**
- Monthly hosting: $5–$45
- Single-region deployment

---

## 10. Deployment, Rollback, Backups, DR

**Deployment method:** CI pipeline → Render/Railway
**Environments:** dev → staging → prod
**Rollback strategy:** Redeploy previous Git tag; migration 004 is additive — safe to rollback app without DB rollback until `NOT NULL` is enforced
**Backup policy:** Daily automated backup, 7-day retention
**DR:** RPO 24h, RTO 2h

---

## 11. Forbidden Changes (Scope Lock)

**BANNED without a new Freeze version + price/time update:**
- Add roles/permissions model changes
- Switch DB/dialect
- Add new external integrations
- Add realtime websockets
- Change auth mode (JWT ↔ sessions)
- Change pagination standard
- Change `openapi.yaml` without a Freeze version bump
- Change student credential derivation formula
- Add email delivery (out of scope — no SMTP in MVP)
- Student self-registration endpoint

---

## 12. Change Control

**Change Request Format:**
- Requested change / Reason / Scope impact / Timeline impact / Cost impact / Risk impact
- Decision: Approved / Rejected
- New Freeze version / OpenAPI version bump

**Billing rule:** Per Change Request
**Response SLA:** 24 hours

---

## 13. Version History

| Version | Date | Summary |
|---|---|---|
| v3.0 | 2026-02-20 | Initial backend freeze |
| v3.1 | 2026-02-22 | Soft delete, multi-role support |
| v3.2 | 2026-02-24 | SuperAdmin tenant management, feature flags |
| v3.3 | 2026-02-26 | School periods, timetable versioning |
| v3.4 | 2026-03-02 | Student role, attendance correction, LASTADMIN guard, atomic tenant provisioning |
| **v3.5** | **2026-03-03** | **CR-11: Inline timetable cell entry (FE only). CR-12: Admin self-role edit unblocked in UI (FE only). CR-13: Auto student user creation via admission number + DOB; users/students page separation (Breaking)** |

---

## FRONTEND FREEZE DELTA — v3.4 → v3.5

*Backend-driven frontend changes only. Full frontend freeze document to be updated separately.*

### CR-11: Timetable Screen
- **REMOVE** standalone "Add Slot" button
- Empty cell click remains the **sole** create trigger for Admin
- Hint text: *"Click an empty cell to add a slot"*
- No API change — `POST /api/timetable` contract unchanged

### CR-12: Users Screen
- **REMOVE** `!isSelf` guard on Edit Roles button
- Admin can now open the role editor for their own account
- On `403 LASTADMIN` response, show inline error: *"Cannot remove Admin role — you are the last admin of this tenant"*

### CR-13: Students Screen
- Create student form: **ADD** `Admission Number` (required) + `Date of Birth` (required, date picker) fields
- Create student form: **REMOVE** `password` field (no longer exists in request)
- Student table: **ADD** `Admission No.`, `Date of Birth`, `Login ID` columns
- `Login ID` column: displayed as read-only text (e.g., `530@greenvalley.local`) — admin copies and gives to student
- **REMOVE** "Link Account" button and dialog from student row actions
- `PUT /api/students/:id` form: if DOB or admissionNumber edited, show tooltip: *"Changing this will reset the student's login password"*

### CR-13: Users Screen
- `GET /api/users` role filter: remove `Student` option from dropdown
- `POST /api/users` role selector: remove `Student` chip/option
- Students never appear in the Users page
