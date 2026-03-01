# BACKEND PROJECT FREEZE: White-Label School Management System
**Version:** 3.3 (IMMUTABLE)  
**Date:** 2026-02-26  
**Status:** APPROVED FOR EXECUTION  
**Previous Version:** v3.2 (2026-02-26)

> **CRITICAL INSTRUCTION FOR EXECUTION (HUMAN OR AI):**  
> This document is the Absolute Source of Truth. You have NO authority to modify schema, API contracts, or scope defined below.  
> If any request contradicts this document, you must REFUSE and open a Change Request instead.

---

## CHANGE SUMMARY v3.2 → v3.3

**CR-05: Dynamic Per-Tenant Period Configuration (Breaking)**

### What Changed
1. **New table**: `school_periods` — each tenant now owns their period definitions (unlimited count)
2. **Breaking API change**: `POST /api/timetable` — removed `startTime` and `endTime` from request body
3. **Schema change**: Dropped hard CHECK constraint on `timeslots.periodnumber <= 10`
4. **New endpoints**: `GET/POST/PUT/DELETE /api/school-periods` (Admin CRUD)
5. **Tenant provisioning**: 8 default periods seeded on tenant creation (within same transaction)
6. **OpenAPI version**: 3.2.0 → 3.3.0

### Breaking Changes
- `POST /api/timetable` no longer accepts `startTime`/`endTime` fields → 400 if sent
- `periodNumber` max constraint removed from DB and OpenAPI (was 10, now unlimited)

### New Error Codes
- `PERIOD_NOT_CONFIGURED` (400): Attempted to create timeslot with undefined period
- `PERIOD_TIME_INVALID` (400): startTime >= endTime validation failure

### User Story Count
12 (unchanged)

---

## 0. Commercials (Accept-and-price)
**Engagement Type:** Fixed-scope  
**Chosen Package:** Standard  
**Price & Payment Schedule:**  
*(unchanged from v3.2)*

**Timeline Range (weeks):** 8–10  
**Assumptions (must be true):**  
- Single decision maker available within 24 hours for clarifications
- Staging environment accessible by Week 3

**Support Window (post-delivery):**  
- Bugfix support: 30 days  
- Enhancements: billed as Change Requests

---

## 1. The "Iron Scope" (Backend only)

### Core Value Proposition (One Sentence)
A white-label school management system for small institutions (<500 students) that provides timetable scheduling and attendance tracking, deployable on low-cost infrastructure with per-school module activation managed by a central SuperAdmin.

### The 12 User Stories (COMPLETE SCOPE)

1. As a **teacher**, I want to record student attendance for each class period, so that attendance is captured once and not lost on paper.
2. As a **school admin**, I want to view a student's complete attendance history, so that I don't have to search through physical records.
3. As a **school admin**, I want to see a student's attendance summary for a given month, so that I can quickly assess attendance without manual calculation.
4. As a **teacher**, I want to know which classes I am responsible for today, so that I don't miss or duplicate class sessions.
5. As a **teacher**, I want to see the full timetable for the current day, so that I can plan my work without asking other staff.
6. As a **school admin**, I want to know which teacher is assigned to each class, so that classes are not left unattended.
7. As a **school admin**, I want to identify classes without an assigned teacher, so that I can adjust schedules before students are affected.
8. As a **teacher**, I want to adjust my class schedule when another teacher is unavailable, so that classes continue without disruption. *(Informal scheduling via empty period utilization, not timeSlot modification.)*
9. As a **SuperAdmin**, I want to create and manage tenants, so that I can onboard new schools without touching the database.
10. As a **SuperAdmin**, I want to control which features each tenant can access, so that I can manage product tiers centrally.
11. As a **multi-role user**, I want to switch my active role context in-session, so that I don't need to log out and log back in to act as Teacher or Admin.
12. As an **Admin**, I want to bulk-delete records, so that I can clean up data efficiently without repeating individual delete calls.

### The "NO" List (Explicitly Out of Scope for MVP)
- Student enrollment workflow (approval/rejection process)
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
- Student self-service login (future phase)
- Parent communication features
- Library, transportation, hostel management
- Exam scheduling, report card generation
- SuperAdmin self-registration (seeded via DB script only)
- JWT token blacklist (forced invalidation on role update)
- SuperAdmin tenant hard-delete (deactivate only)

### User Roles (Backend authorization truth)

**SuperAdmin** (Platform-level operator, exists outside tenant scope)
- Authenticated via `POST /api/super-admin/auth/login` (no tenantSlug required)
- JWT payload: `{ superAdminId, role: "SuperAdmin" }` (no tenantId)
- Can create, list, update, deactivate tenants
- Can enable/disable feature flags for any tenant
- SuperAdmin JWT is rejected by `tenantContextMiddleware`
- SuperAdmin routes use `superAdminAuthMiddleware` exclusively
- Provisioned only via one-time DB seed script (no registration endpoint)

**Admin** (tenant-scoped)
- Full CRUD access to all tenant resources (users, batches, subjects, classes, students, timetable, attendance, **school_periods**)
- Can view all reports and summaries
- Can view enabled features (`GET /api/features`, read-only)
- *v3.2 Change:* Can NO LONGER toggle feature flags (`PUT /api/features/{featureKey}` removed)
- Can end any TimeSlot assignment
- Can update user roles (`PUT /api/users/{id}/roles`, cannot target self)
- Can bulk-delete users, students, classes, batches, subjects
- *v3.3 New:* Full CRUD on `school_periods`

**Teacher** (tenant-scoped)
- Can view timetable (all classes, all teachers, read-only)
- Can view own assigned classes
- Can record attendance for own classes
- Can view attendance for students in own classes
- *v3.3 New:* Can view `school_periods` (read-only)
- Cannot end TimeSlot assignments (Admin-only)

### Multiple Roles (v3.1)
Users can have multiple roles simultaneously (e.g., `["Teacher", "Admin"]`). Authorization checks if user has **required role** using array membership. `activeRole` in JWT is a **UI context hint only** — it does NOT gate API access. All write authorization checks validate against the **full `roles` array**.

### Module Structure
- **Timetable Management**: Core module, can be enabled standalone
- **Attendance Tracking**: Dependent module, **REQUIRES** Timetable to be enabled

---

## 1.2 Assumptions & External Dependencies

**External Systems:** None  

**Operational Assumptions:**
- Hosting: Single monolith deployment (Render/Fly.io/Railway or equivalent $5–45/month tier)
- Data retention: Indefinite (no automated deletion)
- Expected user scale: 5–50 schools initially, 25,000 total students max, <10 concurrent RPS
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
DEFAULT_TENANT_SLUG="school1"

# CORS Configuration (comma-separated origins)
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"

# Logging
LOG_LEVEL="info"

# Future: Email Service (not required for MVP)
# EMAIL_SERVICE_API_KEY=
# EMAIL_FROM_ADDRESS=

# Future: File Storage (not required for MVP)
# CLOUDINARY_CLOUD_NAME=
# CLOUDINARY_API_KEY=
# CLOUDINARY_API_SECRET=
```

### Configuration Rules
- `JWT_SECRET` must be at least 32 characters (256 bits)
- `DATABASE_URL` must use PostgreSQL connection string format
- `PORT` defaults to 3000 if not specified
- `NODE_ENV` must be one of: `development`, `production`, `test`
- `BCRYPT_ROUNDS` must be between 10–12
- `JWT_EXPIRES_IN` uses format `365d`, `30d`, `7d` (do not use less than 7d)

---

## 1.6 Tech Stack & Key Libraries (Backend toolbelt)

**Must Support:**
- PostgreSQL (primary) or MySQL (acceptable alternative)
- JWT-based authentication
- Multi-tenancy via single shared database with `tenantId` filtering
- Row-level tenant isolation at query level
- Separate SuperAdmin auth path with no tenant context

**Required Capabilities:**
- Password hashing (bcrypt or argon2)
- JWT token generation/verification
- Database connection pooling
- Datetime manipulation with timezone support (UTC storage, IST display)
- Input validation and sanitization
- CORS handling
- Error logging

**Explicitly Banned Patterns:**
- Do NOT use separate databases per tenant
- Do NOT use microservices (solo dev constraint)
- Do NOT use NoSQL as primary database
- Do NOT implement custom authentication
- Do NOT skip tenant context middleware on tenant routes
- Do NOT apply `tenantContextMiddleware` to `/api/super-admin/*` routes
- Do NOT allow SuperAdmin JWT to pass `tenantContextMiddleware`
- Do NOT expose a SuperAdmin registration endpoint

---

## 2. Data Layer (Schema Truth)

**Dialect:** PostgreSQL  
**Extensions:** None required  

### SQL DDL (Complete)

```sql
-- =====================================================
-- TENANTS TABLE (v3.2: Added status and deactivated_at)
-- =====================================================
CREATE TABLE tenants (
  id            VARCHAR(50)  PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  deactivated_at TIMESTAMPTZ DEFAULT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);

-- =====================================================
-- SUPERADMINS TABLE (v3.2: NEW — platform-level, no tenant_id)
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
-- USERS TABLE (Teachers and Admins — tenant-scoped)
-- v3.1: Added deleted_at for soft delete, updated email uniqueness
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

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(tenant_id, email);
CREATE INDEX idx_users_roles ON users USING GIN(roles);
CREATE INDEX idx_users_deleted ON users(tenant_id, deleted_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_users_email_active ON users(tenant_id, email) WHERE deleted_at IS NULL;

-- =====================================================
-- BATCHES TABLE (Academic Years)
-- =====================================================
CREATE TABLE batches (
  id         VARCHAR(50) PRIMARY KEY,
  tenant_id  VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  start_year INTEGER NOT NULL,
  end_year   INTEGER NOT NULL,
  status     VARCHAR(50) NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Archived')),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batches_tenant_id ON batches(tenant_id);
CREATE INDEX idx_batches_status ON batches(tenant_id, status);
CREATE INDEX idx_batches_deleted ON batches(tenant_id, deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- SUBJECTS TABLE
-- =====================================================
CREATE TABLE subjects (
  id         VARCHAR(50) PRIMARY KEY,
  tenant_id  VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  code       VARCHAR(50),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subjects_tenant_id ON subjects(tenant_id);
CREATE INDEX idx_subjects_deleted ON subjects(tenant_id, deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- CLASSES TABLE
-- =====================================================
CREATE TABLE classes (
  id         VARCHAR(50) PRIMARY KEY,
  tenant_id  VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  batch_id   VARCHAR(50) NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_classes_tenant_id ON classes(tenant_id);
CREATE INDEX idx_classes_batch_id ON classes(batch_id);
CREATE INDEX idx_classes_deleted ON classes(tenant_id, deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- STUDENTS TABLE
-- =====================================================
CREATE TABLE students (
  id         VARCHAR(50) PRIMARY KEY,
  tenant_id  VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  class_id   VARCHAR(50) NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  batch_id   VARCHAR(50) NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_tenant_id ON students(tenant_id);
CREATE INDEX idx_students_class_id ON students(class_id);
CREATE INDEX idx_students_batch_id ON students(batch_id);
CREATE INDEX idx_students_deleted ON students(tenant_id, deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- SCHOOL_PERIODS TABLE (v3.3: NEW — Dynamic per-tenant period config)
-- =====================================================
CREATE TABLE school_periods (
  id            VARCHAR(50) PRIMARY KEY,
  tenant_id     VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_number INTEGER NOT NULL CHECK(period_number >= 1),
  label         VARCHAR(100) NOT NULL DEFAULT '',
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, period_number)
);

CREATE INDEX idx_school_periods_tenant ON school_periods(tenant_id);

-- =====================================================
-- TIMESLOTS TABLE (Immutable Timetable Versioning)
-- v3.3: Removed CHECK constraint upper bound on period_number
-- v3.3: start_time/end_time kept for backward compat but derived from school_periods at read
-- =====================================================
CREATE TABLE timeslots (
  id             VARCHAR(50) PRIMARY KEY,
  tenant_id      VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id       VARCHAR(50) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id     VARCHAR(50) NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  teacher_id     VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  day_of_week    VARCHAR(20) NOT NULL CHECK(day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  period_number  INTEGER NOT NULL CHECK(period_number >= 1),
  start_time     TIME,
  end_time       TIME,
  effective_from DATE NOT NULL,
  effective_to   DATE,
  deleted_at     TIMESTAMPTZ DEFAULT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timeslots_tenant_id ON timeslots(tenant_id);
CREATE INDEX idx_timeslots_class_id ON timeslots(class_id);
CREATE INDEX idx_timeslots_teacher_id ON timeslots(teacher_id);
CREATE INDEX idx_timeslots_effective_dates ON timeslots(effective_from, effective_to);
CREATE INDEX idx_timeslots_deleted ON timeslots(tenant_id, deleted_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_timeslots_active_unique ON timeslots(tenant_id, class_id, day_of_week, period_number)
  WHERE effective_to IS NULL AND deleted_at IS NULL;

-- =====================================================
-- ATTENDANCE_RECORDS TABLE (immutable audit trail — no soft delete)
-- =====================================================
CREATE TABLE attendance_records (
  id          VARCHAR(50) PRIMARY KEY,
  tenant_id   VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id  VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  timeslot_id VARCHAR(50) NOT NULL REFERENCES timeslots(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      VARCHAR(50) NOT NULL CHECK(status IN ('Present', 'Absent', 'Late')),
  recorded_by VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, timeslot_id, date)
);

CREATE INDEX idx_attendance_tenant_id ON attendance_records(tenant_id);
CREATE INDEX idx_attendance_student_id ON attendance_records(student_id);
CREATE INDEX idx_attendance_timeslot_id ON attendance_records(timeslot_id);
CREATE INDEX idx_attendance_date ON attendance_records(date);
CREATE INDEX idx_attendance_student_date_range ON attendance_records(student_id, date);

-- =====================================================
-- FEATURES TABLE (System-wide Module Definitions — no soft delete)
-- =====================================================
CREATE TABLE features (
  id          VARCHAR(50) PRIMARY KEY,
  key         VARCHAR(100) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO features (id, key, name, description) VALUES
  ('F001', 'timetable', 'Timetable Management', 'Create and manage class schedules with teacher assignments'),
  ('F002', 'attendance', 'Attendance Tracking', 'Record and view student attendance per class period');

-- =====================================================
-- TENANT_FEATURES TABLE (Per-Tenant Module Activation — no soft delete)
-- =====================================================
CREATE TABLE tenant_features (
  id          VARCHAR(50) PRIMARY KEY,
  tenant_id   VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL REFERENCES features(key) ON DELETE CASCADE,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  enabled_at  TIMESTAMPTZ,
  UNIQUE(tenant_id, feature_key)
);

CREATE INDEX idx_tenant_features_tenant_id ON tenant_features(tenant_id);
CREATE INDEX idx_tenant_features_enabled ON tenant_features(tenant_id, enabled);
```

---

### Data Invariants (Application-Enforced Rules)

**Data Integrity:**
- `Student.batch_id` MUST equal `Class.batch_id` (validate on insert/update)
- Cannot delete Class if Student records reference it (RESTRICT)
- Cannot delete Subject if TimeSlot records reference it (RESTRICT)
- Cannot delete User if TimeSlot or AttendanceRecord references them (RESTRICT)
- TimeSlot updates must create new records, not modify existing (immutability)
- `AttendanceRecord.date` cannot be in the future
- `Feature.attendance` can only be enabled if `timetable` is enabled
- `User.roles` must be non-empty array containing only `["Teacher", "Admin"]`
- `User.roles` must not contain duplicates (deduplicate before saving)
- `TimeSlot.teacher_id` must reference a User with `"Teacher"` in their `roles` array
- `PUT /api/users/{id}/roles` caller cannot target their own `id`
- A tenant with `status = 'inactive'` causes all its users to receive `403 Tenant is inactive` on every API call (enforced in `tenantContextMiddleware`)
- SuperAdmin credentials must be seeded via DB script only (no API creation path)

**v3.3 New Invariants:**
- `timeslots.period_number` must exist in `school_periods` for the same `tenant_id` (validated at app layer on `POST /api/timetable`)
- Cannot delete a `school_period` if any active (`effective_to IS NULL`) `timeslot` references that `period_number` for the same tenant → `409 HAS_REFERENCES`
- `school_periods` must be configured before any timetable entry can be created → `400 PERIOD_NOT_CONFIGURED`
- `school_periods.start_time < end_time` enforced on create/update
- `school_periods.period_number` is immutable after creation (to renumber, delete and recreate)

### Soft Delete Policy (v3.1, unchanged in v3.3)
- All DELETE operations MUST set `deleted_at = NOW()` instead of removing rows (applies to: `users`, `batches`, `subjects`, `classes`, `students`, `timeslots`)
- All read queries MUST include `WHERE deleted_at IS NULL` filter
- Hard delete ONLY via manual DB admin action
- Attendance records are NOT soft deleted (immutable audit trail)
- `Features`, `tenant_features`, `tenants`, `superadmins`, **`school_periods`** are NOT soft deleted

---

## 3. API Contract (Backend truth)

**Protocol:** REST  
**Auth Mechanism:** Bearer Token (JWT)  
**Header:** `Authorization: Bearer {token}`  
**Base Path:** `/api`  
**Request Content-Type:** `application/json`  
**Response Content-Type:** `application/json`  

### JWT Payload Shapes (v3.2)

**Tenant user (Teacher / Admin):**
```json
{
  "userId": "U123",
  "tenantId": "T001",
  "roles": ["Admin", "Teacher"],
  "activeRole": "Admin",
  "exp": 1234567890
}
```

**SuperAdmin:**
```json
{
  "superAdminId": "SA001",
  "role": "SuperAdmin",
  "exp": 1234567890
}
```

*`activeRole` defaults to the first element of `roles` on initial login. Updated via `POST /api/auth/switch-role`.*

### Global Error Response Format (LOCKED)

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  },
  "timestamp": "2026-01-14T06:21:00Z"
}
```

### Common HTTP Status Codes

- **200** Success (GET, PUT, bulk DELETE)
- **201** Created (POST)
- **204** No Content (single DELETE)
- **400** Bad Request (validation failure)
- **401** Unauthorized (missing/invalid token)
- **403** Forbidden (insufficient permissions, feature disabled, or inactive tenant)
- **404** Not Found
- **409** Conflict (duplicate entry, referential integrity violation)
- **500** Internal Server Error

---

## 3.1 OpenAPI Contract Artifact (REQUIRED, LOCKED)

**OpenAPI file (source of truth):**
- File name: `openapi.yaml`
- Repo path: `/docs/openapi.yaml`
- OpenAPI version: 3.1.0
- API version identifier: **3.3.0** (bumped from 3.2.0)

**Consistency rule (hard):**
- Endpoint list + schemas + status codes in this Freeze MUST match `openapi.yaml` exactly.
- If mismatch exists → Freeze is invalid until corrected.

**Breaking change rules:**
- Major version bump requires Freeze version bump
- Minor version bump for additive changes only
- Patch version bump for clarifications/fixes only

---

## 3.2 Example Payload Set (REQUIRED)

*At least 1 success + 1 error example per endpoint; examples must match OpenAPI schemas exactly.*

*(Refer to `openapi.yaml` for complete examples. Key new examples for v3.3:)*

**POST /api/school-periods success:**
```json
{
  "periodNumber": 9,
  "label": "Period 9",
  "startTime": "15:30",
  "endTime": "16:15"
}
```
→ Response 201
```json
{
  "period": {
    "id": "SP009",
    "periodNumber": 9,
    "label": "Period 9",
    "startTime": "15:30",
    "endTime": "16:15"
  }
}
```

**POST /api/timetable error_400 (period not configured):**
```json
{
  "classId": "C001",
  "subjectId": "SUB001",
  "teacherId": "U123",
  "dayOfWeek": "Monday",
  "periodNumber": 99,
  "effectiveFrom": "2026-03-01"
}
```
→ Response 400
```json
{
  "error": {
    "code": "PERIOD_NOT_CONFIGURED",
    "message": "Period 99 is not configured for this school",
    "details": {}
  },
  "timestamp": "2026-02-26T07:00:00Z"
}
```

---

## 3.3 Mock Server (REQUIRED)

**Mock server tool:** Prism (serves mocks directly from `openapi.yaml`, no extra code)

**Install (one-time):**
```bash
npm install -g @stoplight/prism-cli
```

**Run command (locked):**
```bash
prism mock ./docs/openapi.yaml --port 4010
```

**File path contract:** `openapi.yaml` MUST live at `./docs/openapi.yaml` in the repo root. This command is the only allowed mock server invocation.

**Frontend usage:**
- Base URL for mocks: `http://localhost:4010/api`
- Change `VITE_API_BASE_URL=http://localhost:4010/api` or equivalent env var to point at mock server during frontend development

### Failure Simulation

Prism supports response code selection via the `Prefer` header. Frontend devs use this to simulate every failure case without a live backend.

**How to trigger specific status codes:**
Add header to any request: `Prefer: code={statuscode}`

| Scenario | Header Example | Endpoint |
|----------|----------------|----------|
| Missing/invalid token | `Prefer: code=401` | Any protected endpoint |
| Inactive tenant login | `Prefer: code=403` | `POST /auth/login` |
| Period not configured | `Prefer: code=400` | `POST /api/timetable` |
| Duplicate email on create user | `Prefer: code=409` | `POST /users` |
| Student batch mismatch | `Prefer: code=400` | `POST /students` |
| Resource not found | `Prefer: code=404` | Any `{id}` endpoint |

---

## 3.4 Contract Enforcement (REQUIRED)

**Provider contract testing approach:** OpenAPI-driven contract tests (Dredd or equivalent)

**CI Gate (locked):**
- Runs on: PR + main branch
- Must fail build if: OpenAPI mismatch OR contract tests fail OR examples fail schema validation
- Artifacts published: `openapi.yaml` versioned file

---

## 3.5 Endpoints (MVP only; ALL listed)

### AUTHENTICATION ENDPOINTS

#### POST /api/auth/login
**Purpose:** Authenticate tenant user and establish session  
**Auth Required:** No  
**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required, min 8 chars)",
  "tenantSlug": "string (required, 1-100 chars)"
}
```
**Response 200:**
```json
{
  "token": "eyJ...",
  "user": {
    "id": "U123",
    "tenantId": "T001",
    "name": "John Doe",
    "email": "teacher@school1.com",
    "roles": ["Teacher"],
    "activeRole": "Teacher"
  }
}
```
**Errors:**
- 400: email, password, and tenantSlug are required
- 401: Invalid credentials
- 403: Tenant is inactive
- 404: Tenant does not exist

---

#### POST /api/auth/logout
**Purpose:** Invalidate current session  
**Auth Required:** Yes (any tenant role)  
**Request Body:** Empty  
**Response:** 204 No content

---

#### POST /api/auth/switch-role
**Purpose:** Switch active role context for multi-role users. Issues new JWT with updated `activeRole`.  
**Auth Required:** Yes (any tenant user)  
**Request Body:**
```json
{
  "role": "string (required, must exist in caller's roles array)"
}
```
**Response 200:**
```json
{
  "token": "eyJ...",
  "user": {
    "id": "U123",
    "roles": ["Admin", "Teacher"],
    "activeRole": "Teacher"
  }
}
```
**Errors:**
- 400: Requested role is not assigned to this user
- 403: User has only one role (switching not applicable)

---

### SUPER ADMIN AUTH ENDPOINTS

#### POST /api/super-admin/auth/login
**Purpose:** Authenticate SuperAdmin (no tenantSlug required)  
**Auth Required:** No  
**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required, min 8 chars)"
}
```
**Response 200:**
```json
{
  "token": "eyJ...",
  "superAdmin": {
    "id": "SA001",
    "name": "Platform Admin",
    "email": "admin@platform.com"
  }
}
```
**Errors:**
- 400: email and password are required
- 401: Invalid credentials

---

*All routes under `/api/super-admin/*` require `superAdminAuthMiddleware`. They do NOT use `tenantContextMiddleware`.*

---

### SUPER ADMIN TENANT MANAGEMENT ENDPOINTS

#### GET /api/super-admin/tenants
**Purpose:** List all tenants  
**Auth Required:** SuperAdmin only  
**Query Parameters:**
- `status` (String, optional, enum: `active`, `inactive`)
- `search` (String, optional, searches name and slug)

**Response 200:**
```json
{
  "tenants": [
    {
      "id": "T001",
      "name": "Sunrise School",
      "slug": "sunrise",
      "status": "active",
      "deactivatedAt": null,
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

#### POST /api/super-admin/tenants
**Purpose:** Create new tenant (v3.3: seeds 8 default periods atomically)  
**Auth Required:** SuperAdmin only  
**Request Body:**
```json
{
  "id": "string (required, 1-50 chars, alphanumeric-dash, unique)",
  "name": "string (required, 1-255 chars)",
  "slug": "string (required, 1-100 chars, alphanumeric-dash, unique)"
}
```
**Response 201:**
```json
{
  "tenant": {
    "id": "T002",
    "name": "New School",
    "slug": "newschool",
    "status": "active"
  }
}
```
**Errors:**
- 409: Tenant id or slug already exists

**v3.3 Implementation Note:**  
This endpoint MUST atomically create tenant + 8 default `school_periods` rows in a single transaction:
```sql
-- Within transaction:
INSERT INTO school_periods (id, tenant_id, period_number, label, start_time, end_time)
VALUES
  (gen_id(), :tenantId, 1, 'Period 1', '08:00', '08:45'),
  (gen_id(), :tenantId, 2, 'Period 2', '08:50', '09:35'),
  (gen_id(), :tenantId, 3, 'Period 3', '09:40', '10:25'),
  (gen_id(), :tenantId, 4, 'Period 4', '10:30', '11:15'),
  (gen_id(), :tenantId, 5, 'Period 5', '11:20', '12:05'),
  (gen_id(), :tenantId, 6, 'Period 6', '13:00', '13:45'),
  (gen_id(), :tenantId, 7, 'Period 7', '13:50', '14:35'),
  (gen_id(), :tenantId, 8, 'Period 8', '14:40', '15:25');
```

---

#### PUT /api/super-admin/tenants/{tenantId}
**Purpose:** Update tenant name or slug  
**Auth Required:** SuperAdmin only  
**Request Body:**
```json
{
  "name": "string (optional)",
  "slug": "string (optional)"
}
```
**Response 200:**
```json
{
  "tenant": {
    "id": "T001",
    "name": "Updated School Name",
    "slug": "updated-slug",
    "status": "active"
  }
}
```
**Errors:**
- 404: Tenant does not exist
- 409: Slug already taken

---

#### PUT /api/super-admin/tenants/{tenantId}/deactivate
**Purpose:** Deactivate a tenant (sets `status = 'inactive'`). All tenant user logins return 403 after this.  
**Auth Required:** SuperAdmin only  
**Request Body:** Empty  
**Response 200:**
```json
{
  "tenant": {
    "id": "T001",
    "status": "inactive",
    "deactivatedAt": "2026-02-26T00:00:00Z"
  }
}
```
**Errors:**
- 404: Tenant does not exist
- 409: Tenant is already inactive

---

#### GET /api/super-admin/tenants/{tenantId}/features
**Purpose:** Get feature flags for a specific tenant  
**Auth Required:** SuperAdmin only  
**Response 200:**
```json
{
  "features": [
    {
      "key": "timetable",
      "name": "Timetable Management",
      "enabled": true,
      "enabledAt": "2026-01-01T00:00:00Z"
    },
    {
      "key": "attendance",
      "name": "Attendance Tracking",
      "enabled": false,
      "enabledAt": null
    }
  ]
}
```
**Errors:**
- 404: Tenant does not exist

---

#### PUT /api/super-admin/tenants/{tenantId}/features/{featureKey}
**Purpose:** Enable or disable a feature for a specific tenant  
**Auth Required:** SuperAdmin only  
**Request Body:**
```json
{
  "enabled": "boolean (required)"
}
```
**Validation:** If `featureKey = "attendance"` AND `enabled = true`, verify `timetable` is enabled for this tenant first.

**Response 200:**
```json
{
  "feature": {
    "key": "attendance",
    "enabled": true,
    "enabledAt": "2026-02-26T06:00:00Z"
  }
}
```
**Errors:**
- 400: Attendance module requires Timetable to be enabled first
- 404: Tenant or feature does not exist

---

### FEATURE MANAGEMENT ENDPOINTS (Tenant-level, read-only for Admin)

#### GET /api/features
**Purpose:** List feature flags for current tenant  
**Auth Required:** Yes (Admin only, read-only)  
**Response 200:**
```json
{
  "features": [
    {
      "key": "timetable",
      "name": "Timetable Management",
      "enabled": true,
      "enabledAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

#### PUT /api/features/{featureKey}
**Purpose:** **REMOVED in v3.2** — returns 403 for all callers  
**Auth Required:** Yes  
**Response 403:**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Feature management is restricted to platform administrators",
    "details": {}
  },
  "timestamp": "2026-02-26T07:00:00Z"
}
```

---

### SCHOOL PERIODS ENDPOINTS (v3.3: NEW)

#### GET /api/school-periods
**Purpose:** List all periods configured for current tenant  
**Auth Required:** Yes (Teacher: read-only, Admin: read-only)  
**Response 200:**
```json
{
  "periods": [
    {
      "id": "SP001",
      "periodNumber": 1,
      "label": "Period 1",
      "startTime": "08:00",
      "endTime": "08:45"
    },
    {
      "id": "SP002",
      "periodNumber": 2,
      "label": "Period 2",
      "startTime": "08:50",
      "endTime": "09:35"
    }
  ]
}
```
**Errors:**
- 403: Timetable feature not enabled

---

#### POST /api/school-periods
**Purpose:** Create a new period for current tenant  
**Auth Required:** Yes (Admin only)  
**Request Body:**
```json
{
  "periodNumber": "integer (required, >= 1)",
  "label": "string (optional, max 100 chars, default '')",
  "startTime": "string (required, format HH:MM)",
  "endTime": "string (required, format HH:MM)"
}
```
**Response 201:**
```json
{
  "period": {
    "id": "SP009",
    "periodNumber": 9,
    "label": "Period 9",
    "startTime": "15:30",
    "endTime": "16:15"
  }
}
```
**Errors:**
- 400: `startTime >= endTime` (PERIOD_TIME_INVALID)
- 403: Timetable feature not enabled
- 409: `periodNumber` already exists for tenant

---

#### PUT /api/school-periods/{id}
**Purpose:** Update label/times for a period (period_number is immutable)  
**Auth Required:** Yes (Admin only)  
**Request Body:**
```json
{
  "label": "string (optional, max 100 chars)",
  "startTime": "string (optional, format HH:MM)",
  "endTime": "string (optional, format HH:MM)"
}
```
*At least one field required.*

**Response 200:**
```json
{
  "period": {
    "id": "SP009",
    "periodNumber": 9,
    "label": "Free Period",
    "startTime": "15:30",
    "endTime": "16:15"
  }
}
```
**Errors:**
- 400: `startTime >= endTime` (PERIOD_TIME_INVALID)
- 403: Timetable feature not enabled
- 404: Period not found

---

#### DELETE /api/school-periods/{id}
**Purpose:** Delete a period (blocked if any active timeslots reference it)  
**Auth Required:** Yes (Admin only)  
**Response:** 204 No content  
**Errors:**
- 403: Timetable feature not enabled
- 404: Period not found
- 409: Active timeslots reference this period (HAS_REFERENCES)

---

### TIMETABLE ENDPOINTS

*(Unchanged from v3.1, except POST /api/timetable breaking change)*

#### GET /api/timetable
**Purpose:** Query timetable  
**Auth Required:** Yes (Teacher: view all, Admin: view all)  
**Query Parameters:**
- `date` (Date, optional)
- `dayOfWeek` (String, optional, enum)
- `teacherId` (String, optional)
- `classId` (String, optional)
- `status` (String, optional, default "Active", enum: "Active", "All")

**Response 200:**
```json
{
  "timetable": [
    {
      "id": "TS001",
      "classId": "C001",
      "className": "Grade 10A",
      "subjectId": "SUB001",
      "subjectName": "Mathematics",
      "teacherId": "U123",
      "teacherName": "John Doe",
      "dayOfWeek": "Monday",
      "periodNumber": 1,
      "startTime": "08:00",
      "endTime": "08:45",
      "label": "Period 1",
      "effectiveFrom": "2026-01-01",
      "effectiveTo": null
    }
  ]
}
```
**Errors:**
- 403: Timetable feature not enabled

**v3.3 Implementation Note:**  
`startTime`, `endTime`, and `label` are derived via JOIN from `school_periods` at query time:
```sql
SELECT ts.*, sp.start_time, sp.end_time, sp.label
FROM timeslots ts
JOIN school_periods sp ON sp.tenant_id = ts.tenant_id AND sp.period_number = ts.period_number
WHERE ts.deleted_at IS NULL AND ...
```

---

#### POST /api/timetable
**Purpose:** Create timetable entry  
**Auth Required:** Yes (Admin only)  
**Request Body (v3.3 BREAKING CHANGE — removed startTime/endTime):**
```json
{
  "classId": "string (required)",
  "subjectId": "string (required)",
  "teacherId": "string (required)",
  "dayOfWeek": "string (required, enum: Monday...Sunday)",
  "periodNumber": "integer (required, >= 1)",
  "effectiveFrom": "string (required, date format YYYY-MM-DD)"
}
```
**Response 201:**
```json
{
  "timeSlot": {
    "id": "TS002",
    "classId": "C001",
    "subjectId": "SUB001",
    "teacherId": "U123",
    "dayOfWeek": "Monday",
    "periodNumber": 3,
    "startTime": "09:40",
    "endTime": "10:25",
    "label": "Period 3",
    "effectiveFrom": "2026-03-01",
    "effectiveTo": null
  }
}
```
**Errors:**
- 400: Validation failure, teacher does not have Teacher role, **PERIOD_NOT_CONFIGURED**
- 403: Timetable feature not enabled
- 409: Conflict (slot already occupied for this class/day/period)

---

#### PUT /api/timetable/{timeSlotId}/end
**Purpose:** End a timetable assignment (sets `effective_to`)  
**Auth Required:** Yes (Admin only)  
**Request Body:**
```json
{
  "effectiveTo": "string (required, date format YYYY-MM-DD)"
}
```
**Response 200:**
```json
{
  "timeSlot": {
    "id": "TS001",
    "effectiveTo": "2026-02-28"
  }
}
```
**Errors:**
- 403: Timetable feature not enabled
- 404: TimeSlot not found

---

### ATTENDANCE ENDPOINTS

*(Unchanged from v3.1)*

#### POST /api/attendance/record-class
**Purpose:** Record attendance for entire class  
**Auth Required:** Yes (Teacher: own classes, Admin: all classes)  
**Request Body:**
```json
{
  "timeSlotId": "string (required)",
  "date": "string (required, date format YYYY-MM-DD)",
  "defaultStatus": "string (required, enum: Present, Absent, Late)",
  "exceptions": [
    {
      "studentId": "string (required)",
      "status": "string (required, enum: Present, Absent, Late)"
    }
  ]
}
```
**Response 201:**
```json
{
  "recorded": 30,
  "present": 28,
  "absent": 1,
  "late": 1,
  "date": "2026-02-26",
  "timeSlot": {
    "id": "TS001",
    "className": "Grade 10A",
    "subjectName": "Mathematics",
    "periodNumber": 1
  }
}
```
**Errors:**
- 400: Validation failure, future date, teacher not assigned
- 403: Attendance feature not enabled, teacher not authorized
- 409: Attendance already recorded for this class/date/timeslot

---

#### GET /api/students/{studentId}/attendance
**Purpose:** Get student attendance history  
**Auth Required:** Yes (Teacher: students in own classes, Admin: all students)  
**Query Parameters:**
- `from` (Date, optional)
- `to` (Date, optional)
- `limit` (Integer, default 50, min 1, max 200)
- `offset` (Integer, default 0, min 0)

**Response 200:**
```json
{
  "student": {
    "id": "S001",
    "name": "Alice Smith",
    "className": "Grade 10A"
  },
  "records": [
    {
      "id": "AR001",
      "date": "2026-02-26",
      "status": "Present",
      "timeSlot": {
        "id": "TS001",
        "subjectName": "Mathematics",
        "periodNumber": 1,
        "dayOfWeek": "Monday"
      },
      "recordedBy": "U123",
      "recordedAt": "2026-02-26T09:00:00Z"
    }
  ],
  "summary": {
    "totalRecords": 120,
    "present": 110,
    "absent": 8,
    "late": 2,
    "attendanceRate": 91.67
  },
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 120
  }
}
```
**Errors:**
- 403: Attendance feature not enabled, teacher not authorized
- 404: Student not found

---

#### GET /api/attendance/summary
**Purpose:** Get aggregated attendance summary  
**Auth Required:** Yes (Teacher: own classes, Admin: all classes)  
**Query Parameters:**
- `classId` (String, optional)
- `from` (Date, required)
- `to` (Date, required)

**Response 200:**
```json
{
  "class": {
    "id": "C001",
    "name": "Grade 10A",
    "studentCount": 30
  },
  "period": {
    "from": "2026-02-01",
    "to": "2026-02-28",
    "days": 28
  },
  "summary": {
    "totalRecords": 840,
    "present": 780,
    "absent": 50,
    "late": 10,
    "attendanceRate": 92.86
  },
  "byStudent": [
    {
      "studentId": "S001",
      "studentName": "Alice Smith",
      "present": 26,
      "absent": 2,
      "late": 0,
      "attendanceRate": 92.86
    }
  ]
}
```
**Errors:**
- 400: `from` and `to` are required
- 403: Attendance feature not enabled

---

### STANDARD CRUD ENDPOINTS (Users, Classes, Batches, Subjects, Students)

*(Unchanged from v3.2, except added DELETE /api/{resource}/bulk endpoints)*

**All follow standard pattern:**

- **GET /api/{resource}** — List (excludes deleted)
- **POST /api/{resource}** — Create
- **PUT /api/{resource}/{id}** — Update
- **DELETE /api/{resource}/{id}** — Soft delete (204)
- **DELETE /api/{resource}/bulk** (v3.2: NEW) — Bulk soft delete (200, partial result)

**Auth:** Admin only for write operations; Teacher read-only (varies by resource)

**Bulk requestresponse schema:** Identical to `DELETE /api/users/bulk` pattern (refer to v3.2 for details).

---

## 4. Critical Business Logic (Pseudocode only)

### Flow: Create TimeSlot (v3.3 UPDATED)

```
FUNCTION createTimeSlot(classId, subjectId, teacherId, dayOfWeek, periodNumber, effectiveFrom, tenantId)
  1. Verify timetable feature enabled for tenantId → 403 FORBIDDEN if not
  2. SELECT id FROM school_periods
       WHERE tenant_id = tenantId AND period_number = periodNumber
     IF not found → 400 PERIOD_NOT_CONFIGURED
       "Period {periodNumber} is not configured for this school"
  3. SELECT roles FROM users WHERE id = teacherId AND tenant_id = tenantId AND deleted_at IS NULL
     IF "Teacher" NOT IN roles → 400 BAD_REQUEST
  4. SELECT id FROM timeslots
       WHERE tenant_id = tenantId
         AND class_id = classId
         AND day_of_week = dayOfWeek
         AND period_number = periodNumber
         AND effective_to IS NULL
         AND deleted_at IS NULL
     IF found → 409 CONFLICT "This period slot is already occupied"
  5. INSERT INTO timeslots (id, tenant_id, class_id, subject_id, teacher_id, day_of_week,
       period_number, effective_from, deleted_at, created_at, updated_at)
     VALUES (gen_id(), tenantId, classId, subjectId, teacherId, dayOfWeek, periodNumber,
       effectiveFrom, NULL, NOW(), NOW())
     NOTE: start_time and end_time columns are left NULL — derived at read time via JOIN
  6. SELECT ts.*, sp.start_time, sp.end_time, sp.label
       FROM timeslots ts
       JOIN school_periods sp ON sp.tenant_id = ts.tenant_id AND sp.period_number = ts.period_number
       WHERE ts.id = {new_id}
  7. RETURN 201 timeSlot (with startTime/endTime/label from school_periods)
```

---

### Flow: Delete School Period (v3.3 NEW)

```
FUNCTION deleteSchoolPeriod(periodId, tenantId)
  1. SELECT id, period_number FROM school_periods
       WHERE id = periodId AND tenant_id = tenantId
     IF not found → 404 NOT_FOUND
  2. SELECT COUNT(*) FROM timeslots
       WHERE tenant_id = tenantId
         AND period_number = {found_period_number}
         AND effective_to IS NULL
         AND deleted_at IS NULL
     IF count > 0 → 409 HAS_REFERENCES
       "Cannot delete period — active timeslots reference it"
  3. DELETE FROM school_periods WHERE id = periodId
  4. RETURN 204 NO_CONTENT
```

---

### Flow: Feature Dependency Validation (unchanged, now SuperAdmin only)

```
FUNCTION toggleFeature(featureKey, enabled, tenantId)
  1. IF featureKey = "attendance" AND enabled = true
       SELECT enabled FROM tenant_features
         WHERE tenant_id = tenantId AND feature_key = "timetable"
       IF timetable not enabled → RETURN 400 "Attendance requires Timetable to be enabled first"
  2. UPSERT INTO tenant_features (tenant_id, feature_key, enabled, enabled_at)
       VALUES (tenantId, featureKey, enabled, IF enabled THEN NOW() ELSE NULL)
  3. RETURN 200 { feature: { key, enabled } }
```

*All other v3.1 pseudocode (`endTimeSlot`, `recordClassAttendance`, `createStudent`, `softDelete`, `bulkSoftDelete`, `updateUserRoles`) unchanged.*

---

## 5. Integrations & Failure Behavior (if any)

**External Systems:** None for MVP

---

## 6. Observability, Audit, Safety

*(Unchanged from v3.2)*

**Logging (structured):**
- Required fields: `requestId`, `userId` (if known), `route`, `statusCode`, `latencyMs`
- PII rules: Do NOT log passwords, tokens, or raw JWT payloads

**Audit log:**
- All write operations (create/update/delete) logged to DB audit table (future phase)
- Immutable, indefinite retention

**Metrics (minimum):**
- RPS, p95 latency, error rate, DB pool saturation

**Alerts (minimum):**
- Error rate >5% for 5 minutes → notify on-call
- DB pool saturation >80% → notify on-call

---

## 7. Acceptance Criteria (Backend)

### Phase 1 — Foundation (Weeks 1–2)
- [ ] DB schema applied (all 12 tables including `school_periods`)
- [ ] Migrations: Drop CHECK on `timeslots.period_number <= 10`, add new lower-bound CHECK
- [ ] `.env.example` complete; app boots locally
- [ ] `tenantContextMiddleware` rejects SuperAdmin JWT
- [ ] `superAdminAuthMiddleware` rejects tenant JWT
- [ ] Tenant inactive check enforced in `tenantContextMiddleware`
- [ ] Soft delete filter (`deleted_at IS NULL`) applied to all applicable read queries

---

### Phase 2 — SuperAdmin (Week 3)
- [ ] SuperAdmin seeding script creates one record (without API)
- [ ] `POST /api/super-admin/auth/login` works, returns SuperAdmin JWT
- [ ] All 6 super-admin tenant/feature endpoints work
- [ ] Feature dependency rule enforced (`attendance` requires `timetable`)
- [ ] `PUT /api/features/{featureKey}` returns 403 for Admin callers
- [ ] **v3.3:** `POST /api/super-admin/tenants` seeds 8 default periods atomically

---

### Phase 3 — Role Switching & Role Update (Week 4)
- [ ] `POST /api/auth/switch-role` reads `roles` from DB, not JWT
- [ ] New JWT has correct `activeRole` claim
- [ ] `PUT /api/users/{id}/roles` blocked if caller targets own id
- [ ] After role update, target user sees new roles on next `switch-role` call (without re-login)

---

### Phase 4 — Bulk Delete (Week 5)
- [ ] All 5 bulk endpoints return 200 with `deleted`/`failed` arrays
- [ ] Referential integrity checked per-record
- [ ] Max 100 ids enforced
- [ ] No wrapping transaction (partial success confirmed in test)

---

### Phase 5 — Core Timetable & Attendance Modules (Weeks 6–8)
- [ ] All v3.1 acceptance criteria for timetable/attendance unchanged
- [ ] **v3.3:** All 4 `/api/school-periods` endpoints operational (GET/POST/PUT/DELETE)
- [ ] **v3.3:** `POST /api/timetable` returns `400 PERIOD_NOT_CONFIGURED` for unknown `periodNumber`
- [ ] **v3.3:** `POST /api/timetable` rejects request if `startTime`/`endTime` sent in body → 400
- [ ] **v3.3:** `GET /api/timetable` response includes `startTime`, `endTime`, `label` via JOIN from `school_periods`
- [ ] **v3.3:** `DELETE /api/school-periods/{id}` blocked with 409 when active timeslots exist
- [ ] **v3.3:** `school_periods` validation: `startTime < endTime` enforced on create + update

---

### Phase 6 — Contract Artifacts (Week 9)
- [ ] `openapi.yaml` version **3.3.0** exists at `/docs/openapi.yaml`
- [ ] All MVP endpoints defined with exact schemas
- [ ] Example payload set exists (≥1 success + 1 error per endpoint)
- [ ] Examples validate against OpenAPI schemas
- [ ] Mock server (`prism mock ./docs/openapi.yaml --port 4010`) runs successfully
- [ ] Contract enforcement tests pass in CI (OpenAPI validation)

---

### Phase 7 — Deployment Proof (Week 10)
- [ ] Staging deployment URL works
- [ ] API docs URL works (OpenAPI matches behavior)
- [ ] Smoke test steps documented

---

## 8. Project Structure (Backend skeleton)

*(Unchanged from v3.2)*

```
/
├── .env.example
├── package.json
├── tsconfig.json
├── README.md
├── /docs
│   └── openapi.yaml (v3.3.0)
├── /src
│   ├── app.ts
│   ├── server.ts
│   ├── /config
│   ├── /db
│   │   └── /migrations
│   ├── /modules
│   │   ├── /auth
│   │   ├── /super-admin
│   │   ├── /timetable
│   │   ├── /attendance
│   │   ├── /school-periods (v3.3: NEW)
│   │   └── /users
│   ├── /routes
│   ├── /middleware
│   ├── /services
│   ├── /utils
│   └── /types
└── /tests
    ├── /unit
    └── /integration
```

---

## 9. Constraints (Non-Functional)

*(Unchanged from v3.2)*

**Performance Targets (LOCKED):**
- p95 latency: <500ms
- Error rate: <1%
- Sustained RPS: 10 for 1 hour

**Security Baseline (LOCKED):**
- Password hashing: bcrypt rounds = 10
- HTTPS in prod
- Secrets not committed
- OWASP basics: validation, authz checks, secure headers

**Hosting/Budget Constraints:**
- Must run on $5–45/month hosting budget
- Single application deployment (monolith)
- Single database instance (shared schema, multi-tenancy)
- Must support 5–50 schools initially (25,000 total students)

---

## 10. Deployment, Rollback, Backups, DR

*(Unchanged from v3.2)*

**Deployment method:** Docker + CI pipeline (GitHub Actions or equivalent)  
**Environments:** dev / staging / prod  
**Rollback strategy:** Redeploy previous Docker image tag + manual DB migration rollback if needed  
**Backup policy:** Daily automated backups (7-day retention), restore drill quarterly  
**DR (disaster recovery):** RPO 24h, RTO 4h

---

## 11. Forbidden Changes (Scope Lock)

**BANNED without a new Freeze version + price/time update:**
- Any change to SuperAdmin auth mechanism or middleware separation
- Token blacklist (forced invalidation on role change)
- Allowing Admin to toggle feature flags
- Allowing SuperAdmin to hard-delete tenants
- Changing bulk delete to atomic all-or-nothing
- Making `activeRole` gate actual API permissions
- Adding SuperAdmin registration endpoint
- Switch DB/dialect
- Add realtime websockets
- Change pagination standard
- Change `openapi.yaml` without a Freeze version bump
- **v3.3 Addition:** Reverting `school_periods` to platform-wide fixed periods
- **v3.3 Addition:** Re-adding `startTime`/`endTime` to `POST /api/timetable` request body

If requested:  
→ create Change Request → re-price → approve/reject.

---

## 12. Change Control (Accept-and-price rules)

**Change Request Format:**
- Requested change:
- Reason:
- Scope impact:
- Timeline impact:
- Cost impact:
- Risk impact:
- Decision: Approved / Rejected
- New Freeze version: v3.x / v4.0
- OpenAPI artifact change: [none / patched / breaking], new `openapi.yaml` version/tag: [value]

**Billing rule:** Per change (negotiated)  
**Response SLA for change requests:** 48 hours

---

## 13. Version History

- **v1.0** (2026-01-14): Initial backend freeze approved.
- **v2.0**: Removed Teacher authorization from `PUT /api/timetable/{id}/end`.
- **v3.0** (2026-01-29): Role model changes, user story 8 clarified.
- **v3.1** (2026-02-17): Soft delete added to 6 tables (internal only, zero API change).
- **v3.2** (2026-02-26):
  - CR-01: SuperAdmin role + tenant management
  - CR-02: Feature management moved to SuperAdmin
  - CR-03: In-session role switching + Admin role update endpoint
  - CR-04: Bulk delete for 5 resources
  - Breaking: `PUT /api/features/{featureKey}` removed from Admin scope
  - JWT payload extended with `activeRole`
  - New table: `superadmins`
  - Schema change: `tenants` adds `status`, `deactivated_at`
  - 12 user stories total
- **v3.3** (2026-02-26):
  - CR-05: Dynamic per-tenant period configuration
  - Breaking: `POST /api/timetable` removed `startTime`/`endTime` from request body
  - Breaking: `timeslots.period_number` CHECK constraint upper bound removed
  - New table: `school_periods` (unlimited periods per tenant)
  - New endpoints: `GET/POST/PUT/DELETE /api/school-periods`
  - Tenant provisioning: 8 default periods seeded atomically
  - OpenAPI version: 3.2.0 → 3.3.0
  - New error codes: `PERIOD_NOT_CONFIGURED`, `PERIOD_TIME_INVALID`
  - 12 user stories (unchanged)

---

**END OF FREEZE v3.3**