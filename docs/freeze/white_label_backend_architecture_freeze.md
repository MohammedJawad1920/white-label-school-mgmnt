
# BACKEND PROJECT FREEZE: White-Label School Management System
**Version:** 3.4 (IMMUTABLE)
**Date:** 2026-03-02
**Status:** APPROVED FOR EXECUTION
**Previous Version:** v3.3 — 2026-02-26

> **CRITICAL INSTRUCTION FOR EXECUTION (HUMAN OR AI):**
> This document is the Absolute Source of Truth. You have NO authority to modify schema, API
> contracts, or scope defined below. If any request contradicts this document, you must REFUSE
> and open a Change Request instead.

---

## CHANGE SUMMARY v3.3 → v3.4

### CRs Applied
- **CR-06** Atomic tenant + admin provisioning (Breaking)
- **CR-07** Tenant reactivation (Additive)
- **CR-08** Student role + students.user_id linkage (Breaking)
- **CR-09** Attendance correction with audit trail (Additive)
- **CR-10** Admin self-role edit with last-admin guard (Breaking)

### What Changed
1. `POST /api/super-admin/tenants` — `admin` block now required; atomically creates tenant + periods + first Admin user
2. New endpoint: `PUT /api/super-admin/tenants/{tenantId}/reactivate`
3. Role enum expanded: `[Teacher, Admin]` → `[Teacher, Admin, Student]` across all surfaces
4. `students` table gains `user_id VARCHAR(50) NULLABLE FK → users.id` (unique partial index)
5. New endpoint: `PUT /api/students/{studentId}/link-account` (Admin only)
6. `GET /api/students/{studentId}/attendance` — Student role can access own record
7. `attendancerecords` gains `correctedstatus`, `correctedby`, `correctedat` columns
8. New endpoint: `PUT /api/attendance/{recordId}` (Teacher own-class / Admin any)
9. `PUT /api/users/{id}/roles` — Admin may now target self; `SELFROLECHANGEFORBIDDEN` removed; `LASTADMIN` guard added
10. `AttendanceRecord` response shape gains `originalStatus`, `correctedBy`, `correctedAt`

### Breaking Changes
- `POST /api/super-admin/tenants` request: `admin` block required (was not present)
- All role enums: `[Teacher, Admin]` → `[Teacher, Admin, Student]`
- `PUT /api/users/{id}/roles`: 403 case changed (`SELFROLECHANGEFORBIDDEN` → `LASTADMIN`)
- `AttendanceRecord` schema extended

### New Error Codes
- `LASTADMIN` — Cannot remove own Admin role; last admin in tenant
- `STUDENT_ACCESS_DENIED` — Student-role caller accessing another student's record
- `USER_ALREADY_LINKED` — userId already linked to a different student record
- `FUTURE_DATE` — Attendance correction attempted on a future record
- `SAME_STATUS` — Correction status equals current effective status
- `ALREADY_ACTIVE` — Tenant reactivation on already-active tenant
- `ADMIN_EMAIL_TAKEN` — Admin email conflict during tenant creation

### User Story Count
12 unchanged

---

## 0. Commercials (Accept-and-price)

**Engagement Type:** Fixed-scope
**Chosen Package:** Standard
**Price & Payment Schedule:** Unchanged from v3.3
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

---

### The 12 User Stories (COMPLETE SCOPE)

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

---

### The "NO" List (Explicitly Out of Scope for MVP)

- Student enrollment workflow / approval-rejection process
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
- Forgot password flow (admin resets only)
- Parent communication features
- **Library, transportation, hostel management** — `Librarian` role is NOT implemented; introduce via Change Request when library module is scoped
- Exam scheduling, report card generation
- SuperAdmin self-registration (seeded via DB script only)
- JWT token blacklist / forced invalidation on role update
- SuperAdmin tenant hard-delete (deactivate/reactivate only)
- Student-to-user bulk linking / CSV import — manual one-by-one via `PUT /api/students/{id}/link-account` only
- Student role users creating or managing any resource other than reading own attendance and timetable

---

### User Roles (Backend authorization truth)

**SuperAdmin** — Platform-level operator, exists outside tenant scope
- Authenticated via `POST /api/super-admin/auth/login` (no `tenantSlug` required)
- JWT payload: `{ superAdminId, role: "SuperAdmin" }` — no `tenantId`
- Can create, list, update, deactivate, and **reactivate** tenants
- Can enable/disable feature flags for any tenant
- SuperAdmin JWT is rejected by `tenantContextMiddleware`
- SuperAdmin routes use `superAdminAuthMiddleware` exclusively
- Provisioned only via one-time DB seed script (no registration endpoint)

**Admin** — Tenant-scoped
- Full CRUD access to all tenant resources (users, batches, subjects, classes, students, timetable, attendance, schoolperiods)
- Can view all reports and summaries
- Can view enabled features (`GET /api/features`, read-only)
- Cannot toggle feature flags (`PUT /api/features/:featureKey` removed in v3.2)
- Can end any TimeSlot assignment
- Can update any user's roles including own — **EXCEPT** cannot remove own `Admin` role if they are the last Admin in the tenant (`LASTADMIN`)
- Can bulk-delete users, students, classes, batches, subjects
- Full CRUD on `schoolperiods`
- Can link/unlink student user accounts (`PUT /api/students/{id}/link-account`)
- Can correct any attendance record (`PUT /api/attendance/{recordId}`)

**Teacher** — Tenant-scoped
- Can view timetable (all classes, all teachers, read-only)
- Can view own assigned classes
- Can record attendance for own classes
- Can view attendance for students in own classes
- Can view `schoolperiods` (read-only)
- Can correct attendance records for own-class timeslots only
- Cannot end TimeSlot assignments (Admin-only)

**Student** — Tenant-scoped *(v3.4 NEW)*
- Can view timetable (read-only)
- Can view `schoolperiods` (read-only)
- Can view own attendance: `GET /api/students/{studentId}/attendance` where `students.user_id = req.user.userId` only — 403 `STUDENT_ACCESS_DENIED` otherwise
- Cannot record, correct, or delete any data
- Student-role user account is separate from `students` enrollment row; linked via `students.user_id FK → users.id`

**Multiple Roles (v3.1, unchanged)**
- Users can hold multiple roles simultaneously (e.g., `["Teacher", "Admin"]`)
- Authorization checks if user has required role using array membership
- `activeRole` in JWT is a **UI context hint only** — it does NOT gate API access
- All write authorization checks validate against the full `roles` array

---

### Module Structure
- **Timetable Management** — Core module, can be enabled standalone
- **Attendance Tracking** — Dependent module, REQUIRES Timetable to be enabled

---

## 1.2 Assumptions & External Dependencies

**External Systems:** None

**Operational Assumptions:**
- Hosting: Single monolith deployment (Render/Fly.io/Railway or equivalent $5–$45/month tier)
- Data retention: Indefinite (no automated deletion)
- Expected user scale: 5–50 schools initially, 25,000 total students max, 10 concurrent RPS
- Admin/support operations: Manual DB access for SuperAdmin seeding only

---

## 1.5 System Configuration (The Environment)

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration (PostgreSQL required)
DATABASE_URL="postgresql://username:password@localhost:5432/school_management"
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Authentication & Security
JWT_SECRET="your-256-bit-secret-key-min-32-characters-required"
JWT_EXPIRES_IN="365d"
BCRYPT_ROUNDS=10

# Tenant Configuration
DEFAULT_TENANT_SLUG=school1

# CORS Configuration (comma-separated origins)
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"

# Logging
LOG_LEVEL=info

# Future: Email Service (not required for MVP)
# EMAIL_SERVICE_API_KEY=
# EMAIL_FROM_ADDRESS=

# Future: File Storage (not required for MVP)
# CLOUDINARY_CLOUD_NAME=
# CLOUDINARY_API_KEY=
# CLOUDINARY_API_SECRET=
```

**Configuration Rules:**

- `JWT_SECRET` must be at least 32 characters (256 bits)
- `DATABASE_URL` must use PostgreSQL connection string format
- `PORT` defaults to 3000 if not specified
- `NODE_ENV` must be one of `development`, `production`, `test`
- `BCRYPT_ROUNDS` must be between 10–12
- `JWT_EXPIRES_IN` uses format `365d`, `30d`, `7d` — do not use less than `7d`

---

## 1.6 Tech Stack \& Key Libraries (Backend toolbelt)

**Core Stack:**

- **Language/Runtime:** TypeScript + Node.js
- **Framework:** Express
- **DB:** PostgreSQL
- **ORM/Query:** Knex.js or pg (raw)
- **Validation:** Zod
- **Auth:** jsonwebtoken + bcrypt
- **OpenAPI:** swagger-ui-express

**Critical Packages:**

- Logging: `pino`
- Env/config validation: `zod`, `dotenv`
- Testing: `vitest` + `supertest`
- Migration tooling: `knex` migrations

**Dialect:** PostgreSQL
**Extensions:** None required

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
  id            VARCHAR(50)   PRIMARY KEY,
  name          VARCHAR(255)  NOT NULL,
  slug          VARCHAR(100)  UNIQUE NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'active'
                  CHECK(status IN ('active','inactive')),
  deactivatedat TIMESTAMPTZ   DEFAULT NULL,
  createdat     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updatedat     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tenants_slug   ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);

-- --------------------------------------------------------
-- SUPERADMINS TABLE (v3.2: platform-level, no tenantid)
-- --------------------------------------------------------
CREATE TABLE superadmins (
  id           VARCHAR(50)  PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  passwordhash VARCHAR(255) NOT NULL,
  createdat    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updatedat    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_superadmins_email ON superadmins(email);

-- --------------------------------------------------------
-- USERS TABLE (Teachers, Admins, Students — tenant-scoped)
-- v3.1: added deletedat, updated email uniqueness
-- v3.4: roles enum expands to include 'Student'
-- --------------------------------------------------------
CREATE TABLE users (
  id           VARCHAR(50)  PRIMARY KEY,
  tenantid     VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  passwordhash VARCHAR(255) NOT NULL,
  roles        JSONB        NOT NULL DEFAULT '["Teacher"]'::jsonb,
  deletedat    TIMESTAMPTZ  DEFAULT NULL,
  createdat    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updatedat    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX        idx_users_tenantid    ON users(tenantid);
CREATE INDEX        idx_users_email       ON users(tenantid, email);
CREATE INDEX        idx_users_roles       ON users USING GIN(roles);
CREATE INDEX        idx_users_deleted     ON users(tenantid, deletedat) WHERE deletedat IS NULL;
CREATE UNIQUE INDEX idx_users_email_active ON users(tenantid, email) WHERE deletedat IS NULL;

-- --------------------------------------------------------
-- BATCHES TABLE (Academic Years)
-- --------------------------------------------------------
CREATE TABLE batches (
  id        VARCHAR(50)  PRIMARY KEY,
  tenantid  VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      VARCHAR(100) NOT NULL,
  startyear INTEGER      NOT NULL,
  endyear   INTEGER      NOT NULL,
  status    VARCHAR(50)  NOT NULL DEFAULT 'Active'
              CHECK(status IN ('Active','Archived')),
  deletedat TIMESTAMPTZ  DEFAULT NULL,
  createdat TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updatedat TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_batches_tenantid ON batches(tenantid);
CREATE INDEX idx_batches_status   ON batches(tenantid, status);
CREATE INDEX idx_batches_deleted  ON batches(tenantid, deletedat) WHERE deletedat IS NULL;

-- --------------------------------------------------------
-- SUBJECTS TABLE
-- --------------------------------------------------------
CREATE TABLE subjects (
  id        VARCHAR(50)  PRIMARY KEY,
  tenantid  VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      VARCHAR(255) NOT NULL,
  code      VARCHAR(50),
  deletedat TIMESTAMPTZ  DEFAULT NULL,
  createdat TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updatedat TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_subjects_tenantid ON subjects(tenantid);
CREATE INDEX idx_subjects_deleted  ON subjects(tenantid, deletedat) WHERE deletedat IS NULL;

-- --------------------------------------------------------
-- CLASSES TABLE
-- --------------------------------------------------------
CREATE TABLE classes (
  id        VARCHAR(50)  PRIMARY KEY,
  tenantid  VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      VARCHAR(255) NOT NULL,
  batchid   VARCHAR(50)  NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  deletedat TIMESTAMPTZ  DEFAULT NULL,
  createdat TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updatedat TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_classes_tenantid ON classes(tenantid);
CREATE INDEX idx_classes_batchid  ON classes(batchid);
CREATE INDEX idx_classes_deleted  ON classes(tenantid, deletedat) WHERE deletedat IS NULL;

-- --------------------------------------------------------
-- STUDENTS TABLE
-- v3.4: added user_id FK → users.id (nullable, unique)
-- --------------------------------------------------------
CREATE TABLE students (
  id        VARCHAR(50)  PRIMARY KEY,
  tenantid  VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      VARCHAR(255) NOT NULL,
  classid   VARCHAR(50)  NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  batchid   VARCHAR(50)  NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  user_id   VARCHAR(50)  DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
  deletedat TIMESTAMPTZ  DEFAULT NULL,
  createdat TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updatedat TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX        idx_students_tenantid ON students(tenantid);
CREATE INDEX        idx_students_classid  ON students(classid);
CREATE INDEX        idx_students_batchid  ON students(batchid);
CREATE INDEX        idx_students_deleted  ON students(tenantid, deletedat) WHERE deletedat IS NULL;
CREATE UNIQUE INDEX idx_students_userid   ON students(user_id) WHERE user_id IS NOT NULL;

-- --------------------------------------------------------
-- SCHOOL PERIODS TABLE (v3.3: dynamic per-tenant config)
-- --------------------------------------------------------
CREATE TABLE schoolperiods (
  id           VARCHAR(50)  PRIMARY KEY,
  tenantid     VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  periodnumber INTEGER      NOT NULL CHECK(periodnumber >= 1),
  label        VARCHAR(100) NOT NULL DEFAULT '',
  starttime    TIME         NOT NULL,
  endtime      TIME         NOT NULL,
  createdat    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updatedat    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
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
  periodnumber  INTEGER     NOT NULL CHECK(periodnumber >= 1),
  starttime     TIME,
  endtime       TIME,
  effectivefrom DATE        NOT NULL,
  effectiveto   DATE,
  deletedat     TIMESTAMPTZ DEFAULT NULL,
  createdat     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX        idx_timeslots_tenantid      ON timeslots(tenantid);
CREATE INDEX        idx_timeslots_classid       ON timeslots(classid);
CREATE INDEX        idx_timeslots_teacherid     ON timeslots(teacherid);
CREATE INDEX        idx_timeslots_effectivedates ON timeslots(effectivefrom, effectiveto);
CREATE INDEX        idx_timeslots_deleted       ON timeslots(tenantid, deletedat) WHERE deletedat IS NULL;
CREATE UNIQUE INDEX idx_timeslots_active_unique ON timeslots(tenantid, classid, dayofweek, periodnumber)
  WHERE effectiveto IS NULL AND deletedat IS NULL;

-- --------------------------------------------------------
-- ATTENDANCE RECORDS TABLE
-- v3.4: added correctedstatus, correctedby, correctedat
--       originalstatus (status column) is NEVER mutated
-- --------------------------------------------------------
CREATE TABLE attendancerecords (
  id              VARCHAR(50)  PRIMARY KEY,
  tenantid        VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  studentid       VARCHAR(50)  NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  timeslotid      VARCHAR(50)  NOT NULL REFERENCES timeslots(id) ON DELETE CASCADE,
  date            DATE         NOT NULL,
  status          VARCHAR(50)  NOT NULL
                    CHECK(status IN ('Present','Absent','Late')),
  recordedby      VARCHAR(50)  NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recordedat      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  correctedstatus VARCHAR(50)  DEFAULT NULL
                    CHECK(correctedstatus IN ('Present','Absent','Late')),
  correctedby     VARCHAR(50)  DEFAULT NULL REFERENCES users(id) ON DELETE RESTRICT,
  correctedat     TIMESTAMPTZ  DEFAULT NULL,
  UNIQUE(studentid, timeslotid, date)
);
CREATE INDEX idx_attendance_tenantid        ON attendancerecords(tenantid);
CREATE INDEX idx_attendance_studentid       ON attendancerecords(studentid);
CREATE INDEX idx_attendance_timeslotid      ON attendancerecords(timeslotid);
CREATE INDEX idx_attendance_date            ON attendancerecords(date);
CREATE INDEX idx_attendance_student_daterange ON attendancerecords(studentid, date);

-- --------------------------------------------------------
-- FEATURES TABLE (system-wide module definitions)
-- --------------------------------------------------------
CREATE TABLE features (
  id          VARCHAR(50)  PRIMARY KEY,
  key         VARCHAR(100) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  createdat   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
INSERT INTO features (id, key, name, description) VALUES
  ('F001','timetable','Timetable Management','Create and manage class schedules with teacher assignments'),
  ('F002','attendance','Attendance Tracking','Record and view student attendance per class period');

-- --------------------------------------------------------
-- TENANT FEATURES TABLE (per-tenant module activation)
-- --------------------------------------------------------
CREATE TABLE tenantfeatures (
  id         VARCHAR(50) PRIMARY KEY,
  tenantid   VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  featurekey VARCHAR(100) NOT NULL REFERENCES features(key) ON DELETE CASCADE,
  enabled    BOOLEAN     NOT NULL DEFAULT FALSE,
  enabledat  TIMESTAMPTZ,
  UNIQUE(tenantid, featurekey)
);
CREATE INDEX idx_tenantfeatures_tenantid ON tenantfeatures(tenantid);
CREATE INDEX idx_tenantfeatures_enabled  ON tenantfeatures(tenantid, enabled);
```


---

### Data Invariants (Application-Enforced Rules)

- `Student.batchid` MUST equal `Class.batchid` — validate on insert/update
- Cannot delete Class if Student records reference it (`RESTRICT`)
- Cannot delete Subject if TimeSlot records reference it (`RESTRICT`)
- Cannot delete User if TimeSlot or AttendanceRecord references them (`RESTRICT`)
- TimeSlot updates must create new records, not modify existing (immutability)
- `AttendanceRecord.date` cannot be in the future
- `Feature.attendance` can only be enabled if `timetable` is enabled
- `User.roles` must be a non-empty array containing only `'Teacher'`, `'Admin'`, `'Student'`
- `User.roles` must not contain duplicates — deduplicate before saving
- `TimeSlot.teacherid` must reference a User with `'Teacher'` in their `roles` array
- Admin calling `PUT /api/users/{id}/roles` targeting self: allowed, EXCEPT removing own `Admin` role when no other active Admin exists in the tenant → 403 `LASTADMIN`
- A tenant with `status = 'inactive'` causes all its users to receive `403 Tenant is inactive` on every API call — enforced in `tenantContextMiddleware`
- SuperAdmin credentials must be seeded via DB script only (no API creation path)
- `students.user_id` is unique per non-null value (enforced by partial unique index)
- A `Student`-role user may only call `GET /api/students/{studentId}/attendance` where `students.user_id = caller.userId`; all other student records → 403 `STUDENT_ACCESS_DENIED`
- When a user is soft-deleted (`deletedat = NOW()`): if `students.user_id = userId`, set `students.user_id = NULL` in the same transaction
- `attendancerecords.status` (original) is **never mutated** after insert; corrections write only to `correctedstatus` / `correctedby` / `correctedat`
- Only one correction level per record — re-correcting overwrites `correctedstatus`, `correctedby`, `correctedat` in place; `status` (original) remains unchanged forever
- `Student` role: no write access to any resource

**v3.3 Invariants (unchanged):**

- `timeslots.periodnumber` must exist in `schoolperiods` for the same `tenantid` — validated at app layer on `POST /api/timetable`
- Cannot delete a `schoolperiod` if any active (`effectiveto IS NULL`) timeslot references that `periodnumber` for the same tenant → 409 `HAS_REFERENCES`
- `schoolperiods` must be configured before any timetable entry can be created → 400 `PERIOD_NOT_CONFIGURED`
- `schoolperiods.starttime < endtime` enforced on create/update
- `schoolperiods.periodnumber` is immutable after creation (to renumber: delete and recreate)

---

### Soft Delete Policy (v3.1, unchanged)

- All `DELETE` operations MUST set `deletedat = NOW()` instead of removing rows — applies to: users, batches, subjects, classes, students, timeslots
- All read queries MUST include `WHERE deletedat IS NULL` filter
- Hard delete ONLY via manual DB admin action
- Attendance records are **NOT** soft-deleted — immutable audit trail
- Features, tenantfeatures, tenants, superadmins, schoolperiods are **NOT** soft-deleted

---

## 2.1 Transactions, Concurrency, Idempotency

**Transaction boundaries:**


| Workflow | Tables touched | Commit/rollback condition |
| :-- | :-- | :-- |
| Create tenant (CR-06) | `tenants`, `schoolperiods` (×8), `users` | All-or-nothing; any failure → full rollback |
| Record class attendance | `attendancerecords` | Per-student insert; partial failure returns which students failed |
| Soft delete user | `users`, `students` (user_id nullify) | Both in single transaction |

**Concurrency strategy:**

- No optimistic locking required at MVP scale (10 RPS)
- Unique indexes enforce slot-level timetable conflicts at DB layer
- Attendance unique constraint `(studentid, timeslotid, date)` prevents double-recording at DB layer

**Idempotency:**

- No `Idempotency-Key` header in MVP
- Attendance recording is idempotent by DB unique constraint — duplicate → 409

---

## 3. API Contract (Backend truth)

**Protocol:** REST
**Auth Mechanism:** Bearer Token (JWT)
**Header:** `Authorization: Bearer <token>`
**Base Path:** `/api`
**Request Content-Type:** `application/json`
**Response Content-Type:** `application/json`

---

### JWT Payload Shapes (v3.4)

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
- `activeRole` enum: `["Teacher", "Admin", "Student"]`

**SuperAdmin:**

```json
{
  "superAdminId": "SA001",
  "role": "SuperAdmin",
  "exp": 1234567890
}
```


---

### Global Error Response Format (LOCKED)

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  },
  "timestamp": "2026-03-02T07:00:00Z"
}
```


---

### Common HTTP Status Codes

| Code | Meaning |
| :-- | :-- |
| 200 | Success (GET, PUT, bulk DELETE) |
| 201 | Created (POST) |
| 204 | No Content (single DELETE) |
| 400 | Bad Request — validation failure |
| 401 | Unauthorized — missing/invalid token |
| 403 | Forbidden — insufficient permissions, feature disabled, inactive tenant |
| 404 | Not Found |
| 409 | Conflict — duplicate entry, referential integrity violation |
| 500 | Internal Server Error |


---

### 3.1 OpenAPI Contract Artifact (REQUIRED, LOCKED)

- **File name:** `openapi.yaml`
- **Repo path:** `docs/openapi.yaml`
- **OpenAPI version:** 3.1.0
- **API version identifier:** `3.4.0` (bumped from 3.3.0)

**Consistency rule (hard):** Endpoint list + schemas + status codes in this Freeze MUST match `openapi.yaml` exactly. If mismatch exists → Freeze is invalid until corrected.

**Breaking change rules:**

- Major version bump requires Freeze version bump
- Minor version bump for additive changes only
- Patch version bump for clarifications/fixes only

---

### 3.2 Example Payload Set (REQUIRED)

At least 1 success + 1 error example per endpoint. Examples must match OpenAPI schemas exactly. Refer to `openapi.yaml` for complete examples.

**Key examples for v3.4:**

`POST /api/super-admin/tenants` — success:

```json
{
  "id": "T002", "name": "New School", "slug": "newschool",
  "admin": { "name": "School Admin", "email": "admin@newschool.com", "password": "securepass1" }
}
→ 201
{
  "tenant": { "id": "T002", "name": "New School", "slug": "newschool", "status": "active", "deactivatedAt": null, "createdAt": "2026-03-02T07:00:00Z" },
  "admin": { "id": "U001", "name": "School Admin", "email": "admin@newschool.com", "roles": ["Admin"] }
}
```

`POST /api/super-admin/tenants` — error (missing admin block):

```json
→ 400 { "error": { "code": "VALIDATION_ERROR", "message": "admin block is required", "details": {}, "timestamp": "2026-03-02T07:00:00Z" } }
```

`PUT /api/super-admin/tenants/{tenantId}/reactivate` — success:

```json
→ 200 { "tenant": { "id": "T001", "status": "active", "deactivatedAt": null } }
```

`PUT /api/students/{studentId}/link-account` — success:

```json
{ "userId": "U456" }
→ 200 { "student": { "id": "S001", "name": "Alice Smith", "classId": "C001", "batchId": "B001", "userId": "U456" } }
```

`PUT /api/attendance/{recordId}` — success:

```json
{ "status": "Present" }
→ 200
{
  "record": {
    "id": "AR001", "date": "2026-03-01",
    "originalStatus": "Absent", "status": "Present",
    "correctedBy": "U123", "correctedAt": "2026-03-02T07:30:00Z",
    "timeSlot": { "id": "TS001", "subjectName": "Mathematics", "periodNumber": 3, "dayOfWeek": "Monday" }
  }
}
```

`PUT /api/users/{id}/roles` — last admin error:

```json
→ 403 { "error": { "code": "LAST_ADMIN", "message": "Cannot remove Admin role: you are the last admin of this tenant", "timestamp": "2026-03-02T07:00:00Z" } }
```


---

### 3.3 Mock Server (REQUIRED)

**Tool:** Prism (serves mocks directly from `openapi.yaml`, no extra code)

**Install (one-time):**

```bash
npm install -g @stoplight/prism-cli
```

**Run command (LOCKED):**

```bash
prism mock ./docs/openapi.yaml --port 4010
```

File path contract: `openapi.yaml` MUST live at `./docs/openapi.yaml` in the repo root. This command is the only allowed mock server invocation.

**Frontend usage:**

- Base URL for mocks: `http://localhost:4010/api`
- Set `VITE_API_BASE_URL=http://localhost:4010/api` or equivalent env var

**Failure simulation via `Prefer` header:**


| Scenario | Header | Endpoint |
| :-- | :-- | :-- |
| Missing/invalid token | `Prefer: code=401` | Any protected endpoint |
| Inactive tenant login | `Prefer: code=403` | `POST /api/auth/login` |
| Period not configured | `Prefer: code=400` | `POST /api/timetable` |
| Duplicate email on create user | `Prefer: code=409` | `POST /api/users` |
| Student batch mismatch | `Prefer: code=400` | `POST /api/students` |
| Resource not found | `Prefer: code=404` | Any `/{id}` endpoint |
| Last admin guard | `Prefer: code=403` | `PUT /api/users/{id}/roles` |
| User already linked | `Prefer: code=409` | `PUT /api/students/{id}/link-account` |
| Same status correction | `Prefer: code=400` | `PUT /api/attendance/{id}` |


---

### 3.4 Contract Enforcement (REQUIRED)

**Provider contract testing approach:** OpenAPI-driven contract tests (Dredd or equivalent)

**CI Gate (locked):**

- Runs on: PR to `main` branch
- Must fail build if: OpenAPI mismatch OR contract tests fail OR examples fail schema validation
- Artifacts published: `openapi.yaml` versioned file

---

## 3.5 Endpoints (MVP only — ALL listed)


---

### AUTHENTICATION ENDPOINTS

#### `POST /api/auth/login`

- **Purpose:** Authenticate tenant user and establish session
- **Auth required:** No
- **Request body:**

```json
{ "email": "string (required)", "password": "string (required, min 8)", "tenantSlug": "string (required, 1–100 chars)" }
```

- **Response 200:**

```json
{ "token": "eyJ...", "user": { "id": "U123", "tenantId": "T001", "name": "John Doe", "email": "teacher@school1.com", "roles": ["Teacher"], "activeRole": "Teacher" } }
```

- **Errors:**
    - `400` — email, password, and tenantSlug are required
    - `401` — Invalid credentials
    - `403` — `TENANT_INACTIVE` — Tenant is inactive
    - `404` — Tenant does not exist

---

#### `POST /api/auth/logout`

- **Purpose:** Invalidate current session
- **Auth required:** Yes (any tenant role)
- **Request body:** Empty
- **Response:** `204 No Content`

---

#### `POST /api/auth/switch-role`

- **Purpose:** Switch active role context for multi-role users. Issues new JWT with updated `activeRole`.
- **Auth required:** Yes (any tenant user)
- **Request body:**

```json
{ "role": "Teacher | Admin | Student (required, must exist in caller's roles array)" }
```

- **Response 200:**

```json
{ "token": "eyJ...", "user": { "id": "U123", "roles": ["Admin","Teacher"], "activeRole": "Teacher" } }
```

- **Errors:**
    - `400` — `ROLE_NOT_ASSIGNED` — Requested role is not assigned to this user
    - `403` — `SINGLE_ROLE_USER` — User has only one role, switching not applicable

---

### SUPER ADMIN AUTH ENDPOINTS

> All routes under `/api/super-admin` require `superAdminAuthMiddleware`. They do NOT use `tenantContextMiddleware`.

#### `POST /api/super-admin/auth/login`

- **Purpose:** Authenticate SuperAdmin (no tenantSlug required)
- **Auth required:** No
- **Request body:**

```json
{ "email": "string (required)", "password": "string (required, min 8)" }
```

- **Response 200:**

```json
{ "token": "eyJ...", "superAdmin": { "id": "SA001", "name": "Platform Admin", "email": "admin@platform.com" } }
```

- **Errors:**
    - `400` — email and password are required
    - `401` — Invalid credentials

---

### SUPER ADMIN TENANT MANAGEMENT ENDPOINTS

#### `GET /api/super-admin/tenants`

- **Purpose:** List all tenants
- **Auth required:** SuperAdmin only
- **Query params:**
    - `status` — String, optional, enum: `active | inactive`
    - `search` — String, optional, searches `name` and `slug`
- **Response 200:**

```json
{ "tenants": [{ "id": "T001", "name": "Sunrise School", "slug": "sunrise", "status": "active", "deactivatedAt": null, "createdAt": "2026-01-01T00:00:00Z" }] }
```


---

#### `POST /api/super-admin/tenants` *(v3.4 BREAKING — admin block required)*

- **Purpose:** Create new tenant; atomically seeds 8 default periods + first Admin user
- **Auth required:** SuperAdmin only
- **Request body:**

```json
{
  "id": "string (required, 1–50 chars, alphanumeric-dash, unique)",
  "name": "string (required, 1–255 chars)",
  "slug": "string (required, 1–100 chars, alphanumeric-dash, unique)",
  "admin": {
    "name": "string (required)",
    "email": "string (required, valid email)",
    "password": "string (required, min 8 chars)"
  }
}
```

- **Response 201:**

```json
{
  "tenant": { "id": "T002", "name": "New School", "slug": "newschool", "status": "active", "deactivatedAt": null, "createdAt": "2026-03-02T07:00:00Z" },
  "admin": { "id": "U001", "name": "School Admin", "email": "admin@newschool.com", "roles": ["Admin"] }
}
```

- **Errors:**
    - `400` — `admin` block missing or invalid (name/email/password)
    - `409` — Tenant `id` or `slug` already exists
    - `409` — `ADMIN_EMAIL_TAKEN` — admin.email already exists for this tenant

**Transaction (atomic — all or nothing):**

```sql
BEGIN;
  INSERT INTO tenants (id, name, slug, status) VALUES (...);
  INSERT INTO schoolperiods ... (8 rows, same defaults as v3.3);
  INSERT INTO users (id, tenantid, name, email, passwordhash, roles)
    VALUES (genId(), tenantId, admin.name, admin.email, bcrypt(admin.password), '["Admin"]');
COMMIT;
```


---

#### `PUT /api/super-admin/tenants/{tenantId}`

- **Purpose:** Update tenant name or slug
- **Auth required:** SuperAdmin only
- **Request body:**

```json
{ "name": "string (optional)", "slug": "string (optional)" }
```

- **Response 200:** `{ "tenant": { ... } }`
- **Errors:**
    - `404` — Tenant does not exist
    - `409` — Slug already taken

---

#### `PUT /api/super-admin/tenants/{tenantId}/deactivate`

- **Purpose:** Deactivate a tenant. Sets `status = 'inactive'`. All tenant user logins return 403 after this.
- **Auth required:** SuperAdmin only
- **Request body:** Empty
- **Response 200:**

```json
{ "tenant": { "id": "T001", "status": "inactive", "deactivatedAt": "2026-03-02T00:00:00Z" } }
```

- **Errors:**
    - `404` — Tenant does not exist
    - `409` — `ALREADY_INACTIVE` — Tenant is already inactive

---

#### `PUT /api/super-admin/tenants/{tenantId}/reactivate` *(v3.4 NEW)*

- **Purpose:** Reactivate an inactive tenant. All tenant users regain API access immediately.
- **Auth required:** SuperAdmin only
- **Request body:** Empty
- **Response 200:**

```json
{ "tenant": { "id": "T001", "status": "active", "deactivatedAt": null } }
```

- **Errors:**
    - `404` — Tenant does not exist
    - `409` — `ALREADY_ACTIVE` — Tenant is already active

---

#### `GET /api/super-admin/tenants/{tenantId}/features`

- **Purpose:** Get feature flags for a specific tenant
- **Auth required:** SuperAdmin only
- **Response 200:**

```json
{ "features": [{ "key": "timetable", "name": "Timetable Management", "enabled": true, "enabledAt": "2026-01-01T00:00:00Z" }, { "key": "attendance", "name": "Attendance Tracking", "enabled": false, "enabledAt": null }] }
```

- **Errors:** `404` — Tenant does not exist

---

#### `PUT /api/super-admin/tenants/{tenantId}/features/{featureKey}`

- **Purpose:** Enable or disable a feature for a specific tenant
- **Auth required:** SuperAdmin only
- **Request body:** `{ "enabled": boolean (required) }`
- **Validation:** If `featureKey = attendance` AND `enabled = true`, verify `timetable` is enabled for this tenant first
- **Response 200:** `{ "feature": { "key": "attendance", "enabled": true, "enabledAt": "2026-03-02T06:00:00Z" } }`
- **Errors:**
    - `400` — `FEATURE_DEPENDENCY` — Attendance module requires Timetable to be enabled first
    - `404` — Tenant or feature does not exist

---

### FEATURE MANAGEMENT ENDPOINTS (Tenant-level, read-only for Admin)

#### `GET /api/features`

- **Purpose:** List feature flags for current tenant
- **Auth required:** Yes (Admin only, read-only)
- **Response 200:** `{ "features": [{ "key": "timetable", "name": "Timetable Management", "enabled": true, "enabledAt": "..." }] }`

---

#### `PUT /api/features/{featureKey}` *(REMOVED in v3.2 — returns 403 for all callers)*

- **Response:** `403 FORBIDDEN` — Feature management is restricted to platform administrators

---

### SCHOOL PERIODS ENDPOINTS (v3.3, unchanged)

#### `GET /api/school-periods`

- **Purpose:** List all periods configured for current tenant
- **Auth required:** Yes (Teacher read-only, Admin read-only, **Student read-only** v3.4)
- **Response 200:** `{ "periods": [{ "id": "SP001", "periodNumber": 1, "label": "Period 1", "startTime": "08:00", "endTime": "08:45" }] }`
- **Errors:** `403` — Timetable feature not enabled

---

#### `POST /api/school-periods`

- **Purpose:** Create a new period for current tenant
- **Auth required:** Yes (Admin only)
- **Request body:**

```json
{ "periodNumber": 9, "label": "Period 9 (optional)", "startTime": "15:30 (required, HH:MM)", "endTime": "16:15 (required, HH:MM)" }
```

- **Response 201:** `{ "period": { "id": "SP009", "periodNumber": 9, "label": "Period 9", "startTime": "15:30", "endTime": "16:15" } }`
- **Errors:**
    - `400` — `PERIOD_TIME_INVALID` — startTime ≥ endTime
    - `403` — Timetable feature not enabled
    - `409` — periodNumber already exists for tenant

---

#### `PUT /api/school-periods/{id}`

- **Purpose:** Update period label or times (`periodNumber` is immutable)
- **Auth required:** Yes (Admin only)
- **Request body:** At least one of: `label`, `startTime`, `endTime`
- **Response 200:** `{ "period": { ... } }`
- **Errors:**
    - `400` — `PERIOD_TIME_INVALID`
    - `403` — Timetable feature not enabled
    - `404` — Period not found

---

#### `DELETE /api/school-periods/{id}`

- **Purpose:** Delete a period (blocked if active timeslots reference it)
- **Auth required:** Yes (Admin only)
- **Response:** `204 No Content`
- **Errors:**
    - `404` — Period not found
    - `409` — `HAS_REFERENCES` — Active timeslots reference this period

---

### TIMETABLE ENDPOINTS

#### `GET /api/timetable`

- **Purpose:** Query timetable
- **Auth required:** Yes (Teacher read-only, Admin read-only, **Student read-only** v3.4)
- **Query params:** `date`, `dayOfWeek`, `teacherId`, `classId`, `status (Active|All, default Active)`
- **Response 200:**

```json
{ "timetable": [{ "id": "TS001", "classId": "C001", "className": "Grade 10A", "subjectId": "SUB001", "subjectName": "Mathematics", "teacherId": "U123", "teacherName": "John Doe", "dayOfWeek": "Monday", "periodNumber": 3, "label": "Period 3", "startTime": "09:40", "endTime": "10:25", "effectiveFrom": "2026-01-01", "effectiveTo": null }] }
```

- **Errors:** `403` — Timetable feature not enabled

> `startTime`, `endTime`, `label` are derived via JOIN from `schoolperiods` at query time.

---

#### `POST /api/timetable`

- **Purpose:** Create timetable entry
- **Auth required:** Yes (Admin only)
- **Request body (v3.3 — startTime/endTime removed):**

```json
{ "classId": "string", "subjectId": "string", "teacherId": "string", "dayOfWeek": "Monday...Sunday", "periodNumber": 3, "effectiveFrom": "2026-03-01" }
```

- **Response 201:** `{ "timeSlot": { ...with startTime/endTime/label from schoolperiods JOIN... } }`
- **Errors:**
    - `400` — Validation failure / teacher lacks Teacher role / `PERIOD_NOT_CONFIGURED`
    - `403` — Timetable feature not enabled
    - `409` — Slot already occupied for this class/day/period

---

#### `PUT /api/timetable/{timeSlotId}/end`

- **Purpose:** End a timetable assignment
- **Auth required:** Yes (Admin only)
- **Request body:** `{ "effectiveTo": "2026-03-31" }`
- **Response 200:** `{ "timeSlot": { "id": "TS001", "effectiveTo": "2026-03-31" } }`
- **Errors:** `404` — TimeSlot not found

---

### STANDARD CRUD ENDPOINTS (Users, Classes, Batches, Subjects, Students)

All follow standard pattern:

- `GET /api/{resource}` — List (excludes deleted)
- `POST /api/{resource}` — Create
- `PUT /api/{resource}/{id}` — Update
- `DELETE /api/{resource}/{id}` — Soft delete (204)
- `DELETE /api/{resource}/bulk` — Bulk soft delete (200, partial result)
- Auth: Admin only for writes; Teacher read-only (varies by resource)

---

#### `GET /api/users`

- **Auth:** Yes (Admin only)
- **Query params:** `role (Teacher|Admin|Student)`, `search`
- **Response 200:** `{ "users": [{ "id": "U123", "name": "John Doe", "email": "john@school1.com", "roles": ["Teacher"] }] }`


#### `POST /api/users`

- **Auth:** Yes (Admin only)
- **Request body:**

```json
{ "name": "string", "email": "string", "password": "string (min 8)", "roles": ["Teacher|Admin|Student (min 1)"] }
```

- **Response 201:** `{ "user": { ... } }`
- **Errors:** `400` validation, `409` duplicate email


#### `PUT /api/users/{id}/roles` *(v3.4 MODIFIED — SELFROLECHANGEFORBIDDEN removed)*

- **Auth:** Yes (Admin only)
- **Request body:** `{ "roles": ["Teacher","Admin","Student"] (min 1, unique) }`
- **Response 200:** `{ "user": { "id": "U124", "name": "...", "roles": ["Teacher","Admin"] } }`
- **Errors:**
    - `400` — Invalid roles array
    - `403` — `LAST_ADMIN` — Cannot remove own Admin role: last admin in tenant *(only when caller targets self)*
    - `404` — User not found


#### `DELETE /api/users/{id}` — Soft delete, `204`

#### `DELETE /api/users/bulk` — Bulk soft delete, `200` partial result


---

#### `GET /api/students`

- **Auth:** Yes (Admin only for list; Teacher scoped to own classes)
- **Query params:** `classId`, `batchId`, `search`, `limit (default 50)`, `offset (default 0)`
- **Response 200:** `{ "students": [...], "pagination": { "limit": 50, "offset": 0, "total": 120 } }`

**`Student` schema (v3.4 — adds `userId`):**

```json
{ "id": "S001", "name": "Alice Smith", "classId": "C001", "className": "Grade 10A", "batchId": "B001", "batchName": "2025-26", "userId": "U456" }
```


#### `POST /api/students`

- **Auth:** Yes (Admin only)
- **Request body:** `{ "name": "string", "classId": "string", "batchId": "string" }`
- **Errors:** `400` — batchId mismatch with class's batchId


#### `PUT /api/students/{studentId}/link-account` *(v3.4 NEW)*

- **Purpose:** Link or unlink a user account to a student enrollment record
- **Auth:** Yes (Admin only)
- **Request body:** `{ "userId": "U456" }` — pass `null` to unlink: `{ "userId": null }`
- **Response 200:** `{ "student": { ...with userId field... } }`
- **Errors:**
    - `400` — `INVALID_USER` — userId not found OR user does not have `Student` in roles
    - `404` — Student not found
    - `409` — `USER_ALREADY_LINKED` — userId is already linked to a different student record


#### `DELETE /api/students/{id}` — Soft delete, `204`

#### `DELETE /api/students/bulk` — Bulk soft delete, `200` partial result


---

#### Batches, Subjects, Classes — standard CRUD (unchanged from v3.3)

All support: `GET`, `POST`, `PUT /{id}`, `DELETE /{id}` (soft), `DELETE /bulk`
Auth: Admin for writes, Teacher read-only where applicable.

---

### ATTENDANCE ENDPOINTS

#### `POST /api/attendance/record-class`

- **Purpose:** Record attendance for entire class
- **Auth required:** Yes (Teacher own classes; Admin all classes)
- **Request body:**

```json
{
  "timeSlotId": "string",
  "date": "YYYY-MM-DD",
  "defaultStatus": "Present|Absent|Late",
  "exceptions": [{ "studentId": "string", "status": "Present|Absent|Late" }]
}
```

- **Response 201:**

```json
{ "recorded": 30, "present": 28, "absent": 1, "late": 1, "date": "2026-03-01", "timeSlot": { "id": "TS001", "className": "Grade 10A", "subjectName": "Mathematics", "periodNumber": 1 } }
```

- **Errors:**
    - `400` — Validation failure / future date / teacher not assigned to this slot
    - `403` — Attendance feature not enabled / teacher not authorized
    - `409` — Attendance already recorded for this class/date/timeslot

---

#### `PUT /api/attendance/{recordId}` *(v3.4 NEW)*

- **Purpose:** Correct an attendance record (audit-safe — original `status` never mutated)
- **Auth required:** Yes (Teacher — own-class records only; Admin — any record in tenant)
- **Request body:** `{ "status": "Present|Absent|Late" }`
- **Response 200:**

```json
{
  "record": {
    "id": "AR001",
    "date": "2026-03-01",
    "originalStatus": "Absent",
    "status": "Present",
    "correctedBy": "U123",
    "correctedAt": "2026-03-02T07:30:00Z",
    "timeSlot": { "id": "TS001", "subjectName": "Mathematics", "periodNumber": 3, "dayOfWeek": "Monday" }
  }
}
```

- **Errors:**
    - `400` — `FUTURE_DATE` — Record date is in the future
    - `400` — `SAME_STATUS` — Correction status equals current effective status (`correctedstatus ?? status`)
    - `403` — Teacher not assigned to this record's timeslot
    - `404` — Record not found

---

#### `GET /api/students/{studentId}/attendance`

- **Purpose:** Get student attendance history
- **Auth required:**
    - Admin: any student in tenant
    - Teacher: students in own assigned classes only
    - **Student (v3.4):** only where `students.user_id = req.user.userId` — else 403 `STUDENT_ACCESS_DENIED`
- **Query params:** `from`, `to`, `limit (default 50)`, `offset (default 0)`
- **Response 200:**

```json
{
  "student": { "id": "S001", "name": "Alice Smith", "className": "Grade 10A" },
  "records": [{
    "id": "AR001", "date": "2026-02-26",
    "originalStatus": "Absent",
    "status": "Present",
    "correctedBy": "U123", "correctedAt": "2026-03-02T07:30:00Z",
    "timeSlot": { "id": "TS001", "subjectName": "Mathematics", "periodNumber": 1, "dayOfWeek": "Monday" },
    "recordedBy": "U123", "recordedAt": "2026-02-26T09:00:00Z"
  }],
  "summary": { "totalRecords": 120, "present": 110, "absent": 8, "late": 2, "attendanceRate": 91.67 },
  "pagination": { "limit": 50, "offset": 0, "total": 120 }
}
```

- **Errors:**
    - `403` — Attendance feature not enabled / `STUDENT_ACCESS_DENIED`
    - `404` — Student not found

> `status` field in each record reflects the **effective** status (`correctedstatus ?? status`). `originalStatus` is always the raw recorded value.

---

#### `GET /api/attendance/summary`

- **Purpose:** Get aggregated attendance summary
- **Auth required:** Yes (Teacher own classes; Admin all classes)
- **Query params:** `classId`, `from (required)`, `to (required)`
- **Response 200:**

```json
{
  "class": { "id": "C001", "name": "Grade 10A", "studentCount": 30 },
  "period": { "from": "2026-02-01", "to": "2026-02-28", "days": 28 },
  "summary": { "totalRecords": 840, "present": 780, "absent": 50, "late": 10, "attendanceRate": 92.86 },
  "byStudent": [{ "studentId": "S001", "studentName": "Alice Smith", "present": 26, "absent": 2, "late": 0, "attendanceRate": 92.86 }]
}
```

- **Errors:**
    - `400` — `from` and `to` are required
    - `403` — Attendance feature not enabled

> Summary values use **effective** status (corrected where applicable).

---

## 4. Critical Business Logic (Pseudocode only)

### Flow: `createTenantWithAdmin` (CR-06)

```
FUNCTION createTenantWithAdmin(id, name, slug, admin)
  BEGIN TRANSACTION
    1. VALIDATE admin.name (non-empty), admin.email (valid email format),
               admin.password (min 8 chars)
       IF invalid → ROLLBACK → 400

    2. INSERT INTO tenants (id, name, slug, status='active')
       IF id or slug conflict → ROLLBACK → 409

    3. INSERT INTO schoolperiods (8 default rows):
       (tenantId, 1, 'Period 1', '08:00', '08:45')
       (tenantId, 2, 'Period 2', '08:50', '09:35')
       (tenantId, 3, 'Period 3', '09:40', '10:25')
       (tenantId, 4, 'Period 4', '10:30', '11:15')
       (tenantId, 5, 'Period 5', '11:20', '12:05')
       (tenantId, 6, 'Period 6', '13:00', '13:45')
       (tenantId, 7, 'Period 7', '13:50', '14:35')
       (tenantId, 8, 'Period 8', '14:40', '15:25')

    4. newUserId = genId()
       INSERT INTO users (id=newUserId, tenantId=id, name=admin.name,
                         email=admin.email,
                         passwordHash=bcrypt(admin.password, BCRYPT_ROUNDS),
                         roles='["Admin"]')
       IF email conflict for tenantId → ROLLBACK → 409 ADMIN_EMAIL_TAKEN
  COMMIT
  RETURN 201 { tenant, admin: { id, name, email, roles: ["Admin"] } }
```


---

### Flow: `reactivateTenant` (CR-07)

```
FUNCTION reactivateTenant(tenantId)
  1. SELECT id, status FROM tenants WHERE id = tenantId
     IF not found → 404
     IF status = 'active' → 409 ALREADY_ACTIVE
  2. UPDATE tenants SET status='active', deactivatedat=NULL WHERE id=tenantId
  3. RETURN 200 tenant
```


---

### Flow: `linkStudentAccount` (CR-08)

```
FUNCTION linkStudentAccount(studentId, userId, tenantId)
  1. SELECT * FROM students WHERE id=studentId AND tenantid=tenantId AND deletedat IS NULL
     IF not found → 404

  2. IF userId IS NOT NULL
       SELECT roles FROM users
         WHERE id=userId AND tenantid=tenantId AND deletedat IS NULL
       IF not found → 400 INVALID_USER
       IF 'Student' NOT IN roles → 400 INVALID_USER

       SELECT id FROM students WHERE user_id=userId AND deletedat IS NULL
       IF found AND id != studentId → 409 USER_ALREADY_LINKED

  3. UPDATE students SET user_id=userId WHERE id=studentId
  4. RETURN 200 student (with userId field)
```


---

### Flow: `softDeleteUser` (v3.4 — adds user_id nullify)

```
FUNCTION softDeleteUser(userId, tenantId)
  BEGIN TRANSACTION
    1. SELECT id FROM users WHERE id=userId AND tenantid=tenantId AND deletedat IS NULL
       IF not found → 404
    2. Check RESTRICT constraints (timeslots, attendancerecords)
       IF referenced → 409 HAS_REFERENCES
    3. UPDATE users SET deletedat=NOW() WHERE id=userId
    4. UPDATE students SET user_id=NULL WHERE user_id=userId AND tenantid=tenantId
  COMMIT
  RETURN 204
```


---

### Flow: `correctAttendance` (CR-09)

```
FUNCTION correctAttendance(recordId, newStatus, callerId, callerRoles, tenantId)
  1. SELECT ar.*, ts.teacherid
     FROM attendancerecords ar
     JOIN timeslots ts ON ts.id = ar.timeslotid
     WHERE ar.id = recordId AND ar.tenantid = tenantId
     IF not found → 404

  2. IF ar.date > TODAY() → 400 FUTURE_DATE

  3. effectiveStatus = ar.correctedstatus ?? ar.status
     IF newStatus = effectiveStatus → 400 SAME_STATUS

  4. IF 'Admin' NOT IN callerRoles
       IF 'Teacher' NOT IN callerRoles → 403
       IF ts.teacherid != callerId → 403 (teacher not assigned to slot)

  5. UPDATE attendancerecords
     SET correctedstatus=newStatus,
         correctedby=callerId,
         correctedat=NOW()
     WHERE id=recordId

  6. RETURN 200 {
       id, date,
       originalStatus: ar.status,
       status: newStatus,
       correctedBy: callerId,
       correctedAt: NOW(),
       timeSlot: { id, subjectName, periodNumber, dayOfWeek }
     }
```


---

### Flow: `updateUserRoles` (CR-10 — replaces v3.3 version)

```
FUNCTION updateUserRoles(targetId, newRoles, callerId, callerRoles, tenantId)
  1. VALIDATE newRoles:
       - non-empty array
       - no duplicates
       - all values in ['Teacher', 'Admin', 'Student']
     IF invalid → 400

  2. SELECT roles FROM users
     WHERE id=targetId AND tenantid=tenantId AND deletedat IS NULL
     IF not found → 404

  3. IF targetId = callerId                    ← self-edit path
       IF 'Admin' IN callerRoles
         AND 'Admin' NOT IN newRoles           ← trying to remove own Admin
         adminCount = SELECT COUNT(*) FROM users
                      WHERE tenantid=tenantId
                        AND roles @> '["Admin"]'::jsonb
                        AND deletedat IS NULL
                        AND id != callerId
         IF adminCount = 0 → 403 LAST_ADMIN

  4. UPDATE users SET roles=deduplicate(newRoles), updatedat=NOW()
     WHERE id=targetId
  5. RETURN 200 user
```


---

### Flow: `createTimeSlot` (v3.3, unchanged)

```
FUNCTION createTimeSlot(classId, subjectId, teacherId, dayOfWeek, periodNumber, effectiveFrom, tenantId)
  1. Verify timetable feature enabled for tenantId → 403 if not
  2. SELECT id FROM schoolperiods WHERE tenantid=tenantId AND periodnumber=periodNumber
     IF not found → 400 PERIOD_NOT_CONFIGURED
  3. SELECT roles FROM users WHERE id=teacherId AND tenantid=tenantId AND deletedat IS NULL
     IF 'Teacher' NOT IN roles → 400
  4. SELECT id FROM timeslots WHERE tenantid=tenantId AND classid=classId
     AND dayofweek=dayOfWeek AND periodnumber=periodNumber
     AND effectiveto IS NULL AND deletedat IS NULL
     IF found → 409 CONFLICT
  5. INSERT INTO timeslots (starttime=NULL, endtime=NULL — derived at read)
  6. SELECT ts.*, sp.starttime, sp.endtime, sp.label
     FROM timeslots ts JOIN schoolperiods sp ON sp.periodnumber=ts.periodnumber AND sp.tenantid=ts.tenantid
     WHERE ts.id = newId
  7. RETURN 201 timeSlot
```


---

### Flow: `recordClassAttendance` (unchanged)

```
FUNCTION recordClassAttendance(timeSlotId, date, defaultStatus, exceptions, callerId, callerRoles, tenantId)
  1. Verify attendance feature enabled → 403 if not
  2. SELECT ts.* FROM timeslots WHERE id=timeSlotId AND tenantid=tenantId AND deletedat IS NULL
     IF not found → 404
  3. IF date > TODAY() → 400
  4. IF 'Admin' NOT IN callerRoles
       IF ts.teacherid != callerId → 403
  5. SELECT id FROM attendancerecords WHERE timeslotid=timeSlotId AND date=date LIMIT 1
     IF found → 409 already recorded
  6. SELECT id FROM students WHERE classid=ts.classid AND tenantid=tenantId AND deletedat IS NULL
  7. FOR each student:
       status = exceptions[student.id] ?? defaultStatus
       INSERT INTO attendancerecords (tenantId, studentId, timeslotId, date, status, recordedby)
  8. RETURN 201 { recorded, present, absent, late, date, timeSlot }
```


---

### Flow: `toggleFeature` (unchanged, SuperAdmin only)

```
FUNCTION toggleFeature(featureKey, enabled, tenantId)
  1. IF featureKey='attendance' AND enabled=true
       SELECT enabled FROM tenantfeatures WHERE tenantid=tenantId AND featurekey='timetable'
       IF timetable not enabled → 400 FEATURE_DEPENDENCY
  2. UPSERT INTO tenantfeatures (tenantid, featurekey, enabled, enabledat)
       VALUES (tenantId, featureKey, enabled, IF enabled THEN NOW() ELSE NULL)
  3. RETURN 200 feature
```


---

### Flow: `deleteSchoolPeriod` (v3.3, unchanged)

```
FUNCTION deleteSchoolPeriod(periodId, tenantId)
  1. SELECT id, periodnumber FROM schoolperiods WHERE id=periodId AND tenantid=tenantId
     IF not found → 404
  2. SELECT COUNT(*) FROM timeslots WHERE tenantid=tenantId AND periodnumber=found.periodnumber
     AND effectiveto IS NULL AND deletedat IS NULL
     IF count > 0 → 409 HAS_REFERENCES
  3. DELETE FROM schoolperiods WHERE id=periodId
  4. RETURN 204
```


---

## 5. Integrations \& Failure Behavior

**None.** No external integrations in MVP.

---

## 6. Observability, Audit, Safety

**Logging (structured):**

- Required fields: `requestId`, `userId` (if known), `tenantId` (if known), `route`, `statusCode`, `latencyMs`
- PII rules: passwords, password hashes MUST NEVER be logged

**Audit log:** Implicit via `attendancerecords` immutable trail + `correctedby`/`correctedat` columns. No separate audit log table in MVP.

**Metrics (minimum):**

- RPS, p95 latency, error rate, DB pool saturation

**Alerts (minimum):**

- Error rate > 1% sustained for 5 min → notify owner
- DB pool at max saturation → notify owner

---

## 7. Acceptance Criteria (Backend)

### Phase 1 — Foundation (Weeks 1–2)

- [ ] DB schema applied — all 13 tables including `schoolperiods` + v3.4 schema changes (`students.user_id`, `attendancerecords` correction columns)
- [ ] Migrations: drop CHECK upper bound on `timeslots.periodnumber`; add new lower-bound CHECK; add `students.user_id`; add `attendancerecords` correction columns
- [ ] `.env.example` complete; app boots locally
- [ ] `tenantContextMiddleware` rejects SuperAdmin JWT
- [ ] `superAdminAuthMiddleware` rejects tenant JWT
- [ ] Tenant inactive check enforced in `tenantContextMiddleware`
- [ ] Soft delete filter `deletedat IS NULL` applied to all applicable read queries

