# BACKEND PROJECT FREEZE: White-Label School Management System

**Version:** 4.5 (IMMUTABLE)
**Date:** 2026-03-08
**Status:** APPROVED FOR EXECUTION
**Previous Version:** v4.4 — 2026-03-08
**OpenAPI:** v4.5.0

> **CRITICAL INSTRUCTION FOR EXECUTION (HUMAN OR AI):**
> This document is the Absolute Source of Truth. You have NO authority to modify schema, API
> contracts, or scope defined below. If any request contradicts this document, you must REFUSE
> and open a Change Request instead.

---

## CHANGE SUMMARY v4.4 → v4.5

### CRs Applied

| CR | Title | Type | Scope |
|----|-------|------|-------|
| **CR-33** | Continuous absence streak per student × subject | Additive | Attendance — 1 new GET endpoint |
| **CR-34** | Attendance toppers (ranked by overall %) | Additive | Attendance — 1 new GET endpoint |
| **CR-35** | Daily slot attendance summary (timetable cell counts) | Additive | Attendance — 1 new GET endpoint |
| **CR-36** | Monthly attendance sheet (student × day grid) | Additive | Attendance — 1 new GET endpoint |
| **CR-37** | Academic calendar events | Additive | New domain — 1 new table, 4 new endpoints |
| **CR-38** | studentId in JWT + Student dashboard enablement | Breaking (JWT shape) | Auth — login + switch-role responses updated |

### Breaking Changes Summary

1. **CR-38:** `POST /api/auth/login` and `POST /api/auth/switch-role` — response `user` object gains `studentId: string | null`. JWT payload gains `studentId: string | null`. Old tokens without `studentId` field remain valid — `tenantContextMiddleware` treats missing field as `null`. No forced re-login required.

### Additive Changes (non-breaking)

- `GET /api/attendance/streaks` — new (CR-33)
- `GET /api/attendance/toppers` — new (CR-34)
- `GET /api/attendance/daily-summary` — new (CR-35)
- `GET /api/attendance/monthly-sheet` — new (CR-36)
- `POST /api/events` — new (CR-37)
- `GET /api/events` — new (CR-37)
- `PUT /api/events/{eventId}` — new (CR-37)
- `DELETE /api/events/{eventId}` — new (CR-37)
- New table: `events` (CR-37), migration 009

### Unchanged from v4.4

- All timetable endpoints (GET/POST/DELETE timetable)
- All attendance endpoints (POST record-class, PUT correction, GET summary, GET student attendance)
- All entity management endpoints (users, students, batches, classes, subjects, school periods)
- All auth endpoints except login/switch-role response body shape (CR-38)
- All schema except new `events` table (CR-37)
- All migrations 001–008
- Sections 0, 1.2–1.6, 3.3, 3.4, 5–6, 8–12

---

## CHANGE SUMMARY v4.3 → v4.4

### CRs Applied

| CR | Title | Type | Scope |
|----|-------|------|-------|
| **CR-32** | Remove timeslot edit endpoint — DELETE + POST is sufficient | Simplification / Breaking | Timetable (1 endpoint removed) |

### Breaking Changes Summary (1 endpoint removed)

1. `PUT /api/timetable/{timeSlotId}` — **REMOVED ENTIRELY**

No compatibility shim. Callers will receive `404 NOT_FOUND` immediately.

### Retired CRs

- **CR-31's additive change** (`PUT /api/timetable/{timeSlotId}` — NEW) — superseded and retired by CR-32

### Correction Workflow (replaces PUT)

To correct a timeslot's teacher or subject:
1. `DELETE /api/timetable/{timeSlotId}` — soft-deletes the existing slot
2. `POST /api/timetable` — creates a new slot with corrected fields

The unique constraint allows re-creation of the same `(tenantId, classId, dayOfWeek, periodNumber)` after soft-delete.

---

## CHANGE SUMMARY v4.2 → v4.3

### CRs Applied

| CR | Title | Type | Scope |
|----|-------|------|-------|
| **CR-31** | Strip effectiveFrom/effectiveTo from timeslots — Simplification | Breaking | Timetable (schema + 4 endpoints) |

### Breaking Changes Summary (4 endpoints removed/changed)

1. `PUT /api/timetable/{timeSlotId}/end` — **REMOVED ENTIRELY**
2. `POST /api/timetable` — `effectiveFrom` field **REMOVED** from request body
3. `GET /api/timetable` — `date` and `status` query params **REMOVED**
4. `TimeSlot` schema — `effectiveFrom` and `effectiveTo` fields **REMOVED**

No compatibility shims. Old patterns immediately fail.

---

## 0. Commercials — Unchanged from v4.2

---

## 1. The "Iron Scope"

### The 13 Backend User Stories (v4.5 COMPLETE SCOPE)

All 13 stories unchanged from v4.2, plus the following additions:

14. As a Teacher or Admin, I can **view a student's consecutive absence streak per subject** so that I can identify at-risk students during attendance marking.
15. As an Admin, Teacher, or Student, I can **view students ranked by overall attendance percentage for a class** over a date range, so that attendance performance is visible.
16. As an Admin, Teacher, or Student, I can **view per-slot attendance counts for a class on a specific date** so that the timetable can be colour-coded with marking status.
17. As an Admin or Teacher, I can **view a monthly attendance grid for a class and subject** showing each student's per-day period-level records, so that monthly review and correction is possible.
18. As an Admin, I can **create, update, and delete academic calendar events** (holidays, exams, functions), and all roles can read them, so that the school calendar is visible across the platform.
19. As a Student, I can **see my studentId in my JWT** so that I can call my own attendance and streak endpoints from the dashboard without an extra API round-trip.

### The "NO" List — Unchanged from v4.2

### User Roles (v4.5 — CR-33–CR-38 additions in **bold**)

**Admin** — All v4.4 capabilities, plus:
- **Can call `GET /api/attendance/streaks?timeSlotId=X` for any non-deleted timeslot in tenant**
- **Can call `GET /api/attendance/toppers?classId=X&from=&to=` for any classId in tenant**
- **Can call `GET /api/attendance/daily-summary?classId=X&date=Y` for any classId in tenant**
- **Can call `GET /api/attendance/monthly-sheet?classId=X&subjectId=Y&year=&month=` for any class+subject in tenant**
- **Can call POST, GET, PUT, DELETE on `/api/events`**

**Teacher** — All v4.4 capabilities, plus:
- **Can call `GET /api/attendance/streaks?timeSlotId=X` only for timeslots where `timeslots.teacherid = caller.userId AND timeslots.deletedat IS NULL` → `403 FORBIDDEN` otherwise**
- **Can call `GET /api/attendance/toppers?classId=X` only for classIds where teacher has ≥1 non-deleted timeslot → `403 FORBIDDEN` otherwise**
- **Can call `GET /api/attendance/daily-summary?classId=X&date=Y` only for classIds where teacher has ≥1 non-deleted timeslot → `403 FORBIDDEN` otherwise**
- **Can call `GET /api/attendance/monthly-sheet?classId=X&subjectId=Y` only where teacher has ≥1 non-deleted timeslot matching both classId AND subjectId → `403 FORBIDDEN` otherwise**
- **Can call `GET /api/events` (read-only)**
- **Cannot call POST, PUT, DELETE on `/api/events` → `403 FORBIDDEN`**

**Student** — All v4.4 capabilities, plus:
- **JWT now contains `studentId: string | null` when `activeRole = Student` (CR-38)**
- **Can call `GET /api/attendance/streaks?timeSlotId=X` for any non-deleted timeslot in tenant. Response restricted to own studentId entry only**
- **Can call `GET /api/attendance/toppers?classId=X` — full ranking returned (student sees own position)**
- **Can call `GET /api/attendance/daily-summary?classId=X&date=Y` — full slot list, class-level counts only (no PII)**
- **Can call `GET /api/events` (read-only)**
- **Cannot call `GET /api/attendance/monthly-sheet` → `403 FORBIDDEN`**
- **Cannot call POST, PUT, DELETE on `/api/events` → `403 FORBIDDEN`**

**SuperAdmin** — Unchanged from v4.2. Cannot call any of the new endpoints → `403 FORBIDDEN`.

---

## 1.2–1.6 — All Unchanged from v4.2

---

## 2. Data Layer

### 2.1 Database Schema

**Schema unchanged from v4.4 except: new `events` table added (CR-37).**

All tables from v4.4 (timeslots, attendance_records, users, students, classes, batches, subjects, school_periods, tenants, tenant_features, features) remain unchanged.

#### events (NEW — CR-37)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | VARCHAR(50) | PK | ULID |
| tenant_id | VARCHAR(50) | FK tenants.id ON DELETE CASCADE, NOT NULL | Tenant isolation |
| title | VARCHAR(255) | NOT NULL | 1–255 chars |
| type | VARCHAR(50) | NOT NULL, CHECK IN ('Holiday','Exam','Event','Other') | Event category |
| start_date | DATE | NOT NULL | Inclusive |
| end_date | DATE | NOT NULL | Inclusive, ≥ start_date |
| description | TEXT | DEFAULT NULL | Optional, max 1000 chars |
| created_by | VARCHAR(50) | FK users.id ON DELETE RESTRICT, NOT NULL | Admin who created |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | DEFAULT NULL | Soft-delete |

**Constraint:**
```sql
CONSTRAINT chk_events_date_range CHECK (end_date >= start_date)
```

**Indexes:**
```sql
CREATE INDEX idx_events_tenant_id  ON events(tenant_id);
CREATE INDEX idx_events_start_date ON events(tenant_id, start_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_type       ON events(tenant_id, type)       WHERE deleted_at IS NULL;
```

### Migrations

```
src/db/migrations/001_initial_schema.sql                   (v3.1)
src/db/migrations/002_add_student_userid.sql               (v3.4 CR-08)
src/db/migrations/003_add_attendance_corrections.sql       (v3.4 CR-09)
src/db/migrations/004_student_admission_dob.sql            (v3.5 CR-13)
src/db/migrations/005_tenant_timezone.sql                  (v3.6 CR-17)
src/db/migrations/006_student_status_classid_nullable.sql  (v4.0 CR-21, CR-22)
src/db/migrations/007_batch_status_graduated.sql           (v4.0 CR-23)
src/db/migrations/008_timeslot_remove_effective_dates.sql  (v4.3 CR-31)
src/db/migrations/009_academic_calendar_events.sql         (v4.5 CR-37)
```

**Migration 009 (CR-37):**
```sql
-- src/db/migrations/009_academic_calendar_events.sql
-- FREEZE VERSION: v4.5
-- CR-37: Academic calendar events table

CREATE TABLE events (
  id           VARCHAR(50)  PRIMARY KEY,
  tenant_id    VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  type         VARCHAR(50)  NOT NULL
                 CHECK(type IN ('Holiday', 'Exam', 'Event', 'Other')),
  start_date   DATE         NOT NULL,
  end_date     DATE         NOT NULL,
  description  TEXT         DEFAULT NULL,
  created_by   VARCHAR(50)  NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ  DEFAULT NULL,
  CONSTRAINT chk_events_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_events_tenant_id  ON events(tenant_id);
CREATE INDEX idx_events_start_date ON events(tenant_id, start_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_type       ON events(tenant_id, type)       WHERE deleted_at IS NULL;
```

No data backfill required. New table only.

### Data Invariants (v4.5 — CR-33–CR-38 additions appended)

All v4.4 invariants remain unchanged. Append:

**CR-33 (Attendance Streaks):**
- `GET /api/attendance/streaks` — Teacher caller must have ≥1 non-deleted timeslot where `timeslots.teacherid = caller.userId AND timeslots.deletedat IS NULL` for the resolved classId → `403 FORBIDDEN` otherwise
- `GET /api/attendance/streaks` — Student caller receives response filtered to own studentId only (`students.userid = caller.userId`). No timeslot ownership check applied to Student role
- Streak = count of consecutive `Absent` records ordered by `date DESC` per student+subject, stopping at first record where `COALESCE(corrected_status, status) ≠ 'Absent'`. Value is `0` for students with no records or whose most recent record is non-Absent

**CR-34 (Attendance Toppers):**
- `GET /api/attendance/toppers` — Teacher caller must have ≥1 non-deleted timeslot for the requested `classId` → `403 FORBIDDEN` otherwise. Identical check to `GET /api/attendance/summary`
- `attendancePercentage` is `null` (not `0`) when `totalPeriods = 0`. Frontend must handle null explicitly
- `limit` hard cap = 50. Values above 50 → `400 VALIDATION_ERROR`
- `rank` reflects global position pre-pagination, not position within the current page

**CR-35 (Daily Slot Summary):**
- `GET /api/attendance/daily-summary` — Teacher caller must have ≥1 non-deleted timeslot for the requested `classId` → `403 FORBIDDEN` otherwise
- `attendanceMarked: false` when no `attendance_records` exist for `timeSlotId + date`. In this case `absentCount = 0` (not null)
- Empty `slots` array (no timeslots for derived dayOfWeek) is a valid 200 — not a 404
- `dayOfWeek` is derived server-side from the `date` param. Client does not send it
- No restriction on future dates — valid 200 with `attendanceMarked: false` for all slots

**CR-36 (Monthly Attendance Sheet):**
- `GET /api/attendance/monthly-sheet` — Teacher caller must have ≥1 non-deleted timeslot where `classid = :classId AND subjectid = :subjectId AND teacherid = caller.userId AND deletedat IS NULL` → `403 FORBIDDEN` if not found. Both class AND subject must match — class-only match is insufficient
- `days` object always contains keys `"1"` through `"<daysInMonth>"` — no sparse keys. Future days have empty arrays
- `effectiveStatus` = `COALESCE(corrected_status, status)` — raw `status` never exposed separately
- `isCorrected: true` when `corrected_status IS NOT NULL` on the underlying record
- Entries within a day ordered by `periodNumber ASC`

**CR-37 (Academic Calendar Events):**
- `end_date` must be ≥ `start_date` → `400 VALIDATION_ERROR` if violated (also enforced at DB level via CHECK constraint)
- Events are soft-delete only. No hard delete. `deleted_at` set on DELETE call. Not reversible via API
- `created_by` must be an Admin-role user in the same tenant — enforced by auth middleware
- Events are tenant-scoped. Cross-tenant event IDs return `404 NOT_FOUND`
- GET filter semantics: returns events where `start_date <= :to AND end_date >= :from` — correctly catches multi-day events overlapping the range boundary

**CR-38 (studentId in JWT):**
- `studentId` in JWT is `null` for `activeRole ∈ {Admin, Teacher}` — always, even if the user has a linked student record
- `studentId` in JWT may be `null` for `activeRole = Student` if `students.userid` link does not exist. Frontend must handle null gracefully and show a degraded state: "Your student profile is not yet linked — contact your administrator"
- `studentId` is resolved at token-issue time. If a student record is subsequently soft-deleted, the JWT retains the stale `studentId` until token expiry. Endpoints receiving a deleted `studentId` return `404 NOT_FOUND` — correct and expected behaviour
- `tenantContextMiddleware` extracts `studentId` from JWT payload and attaches to `req.studentId`. Missing field treated as `null` (backward compatibility for existing tokens)

### Soft & Hard Delete Rules (v4.5 — CR-37 addition)

All v4.4 rules unchanged. Append:

| Entity | Soft delete | Hard delete | Retention | Restore |
|--------|-------------|-------------|-----------|---------|
| events | Yes | No | Indefinite | Not supported — create new event |

### 2.1 Transactions, Concurrency, Idempotency — Unchanged from v4.2

---

## 3. API Contract

### 3.1 OpenAPI Contract Artifact

- **File:** `openapi.yaml`
- **Path:** `./docs/openapi.yaml`
- **OpenAPI version:** 3.1.0
- **API version:** `4.5.0` (bumped from 4.4.0 — breaking: JWT/auth response shape; additive: 9 new endpoints)

### 3.2 Example Payloads (v4.5 — all v4.4 examples remain valid)

All v4.4 examples remain valid. Append:

---

#### GET /api/attendance/streaks — success (Teacher/Admin, all students)
```json
{
  "request": {
    "headers": {"Authorization": "Bearer <teacher_jwt>"},
    "query": {"timeSlotId": "ts_001"}
  },
  "response": {
    "status": 200,
    "body": {
      "classId": "cls_01HX",
      "subjectId": "sub_MATHS",
      "streaks": [
        {"studentId": "stu_001", "consecutiveAbsentCount": 3},
        {"studentId": "stu_002", "consecutiveAbsentCount": 0},
        {"studentId": "stu_003", "consecutiveAbsentCount": 1}
      ]
    }
  }
}
```

#### GET /api/attendance/streaks — success (Student self-view)
```json
{
  "response": {
    "status": 200,
    "body": {
      "classId": "cls_01HX",
      "subjectId": "sub_MATHS",
      "streaks": [
        {"studentId": "stu_001", "consecutiveAbsentCount": 3}
      ]
    }
  }
}
```

#### GET /api/attendance/streaks — error_403 (Teacher not assigned)
```json
{
  "response": {
    "status": 403,
    "body": {
      "error": {"code": "FORBIDDEN", "message": "You are not assigned to this timeslot", "details": {}},
      "requestId": "req_abc123",
      "timestamp": "2026-03-08T10:00:00Z"
    }
  }
}
```

#### GET /api/attendance/streaks — error_404 (timeslot not found)
```json
{
  "response": {
    "status": 404,
    "body": {
      "error": {"code": "NOT_FOUND", "message": "Timeslot not found", "details": {}},
      "requestId": "req_abc124",
      "timestamp": "2026-03-08T10:00:01Z"
    }
  }
}
```

---

#### GET /api/attendance/toppers — success (page 1)
```json
{
  "request": {
    "headers": {"Authorization": "Bearer <admin_jwt>"},
    "query": {"classId": "cls_01HX", "from": "2026-01-01", "to": "2026-03-08", "limit": "10", "offset": "0"}
  },
  "response": {
    "status": 200,
    "body": {
      "classId": "cls_01HX",
      "from": "2026-01-01",
      "to": "2026-03-08",
      "total": 42,
      "limit": 10,
      "offset": 0,
      "toppers": [
        {"rank": 1, "studentId": "stu_007", "studentName": "Aisha Nair", "totalPeriods": 60, "presentCount": 59, "attendancePercentage": 98.33},
        {"rank": 2, "studentId": "stu_003", "studentName": "Arjun Mehta", "totalPeriods": 60, "presentCount": 57, "attendancePercentage": 95.00},
        {"rank": 42, "studentId": "stu_040", "studentName": "Rohan Das", "totalPeriods": 0, "presentCount": 0, "attendancePercentage": null}
      ]
    }
  }
}
```

#### GET /api/attendance/toppers — error_400 (from after to)
```json
{
  "response": {
    "status": 400,
    "body": {
      "error": {"code": "VALIDATION_ERROR", "message": "'from' must not be after 'to'", "details": {}},
      "requestId": "req_xyz789",
      "timestamp": "2026-03-08T11:00:00Z"
    }
  }
}
```

---

#### GET /api/attendance/daily-summary — success (mixed marked/unmarked)
```json
{
  "request": {
    "headers": {"Authorization": "Bearer <admin_jwt>"},
    "query": {"classId": "cls_01HX", "date": "2026-03-09"}
  },
  "response": {
    "status": 200,
    "body": {
      "classId": "cls_01HX",
      "date": "2026-03-09",
      "dayOfWeek": "Monday",
      "slots": [
        {
          "timeSlotId": "ts_001",
          "periodNumber": 1,
          "subjectId": "sub_MATHS",
          "subjectName": "Mathematics",
          "teacherId": "usr_T01",
          "teacherName": "Ravi Kumar",
          "attendanceMarked": true,
          "totalStudents": 40,
          "absentCount": 3
        },
        {
          "timeSlotId": "ts_002",
          "periodNumber": 2,
          "subjectId": "sub_ENG",
          "subjectName": "English",
          "teacherId": "usr_T02",
          "teacherName": "Priya Nair",
          "attendanceMarked": false,
          "totalStudents": 40,
          "absentCount": 0
        }
      ]
    }
  }
}
```

#### GET /api/attendance/daily-summary — success (Sunday, empty slots)
```json
{
  "response": {
    "status": 200,
    "body": {
      "classId": "cls_01HX",
      "date": "2026-03-08",
      "dayOfWeek": "Sunday",
      "slots": []
    }
  }
}
```

---

#### GET /api/attendance/monthly-sheet — success (excerpt)
```json
{
  "request": {
    "headers": {"Authorization": "Bearer <admin_jwt>"},
    "query": {"classId": "cls_01HX", "subjectId": "sub_MATHS", "year": "2026", "month": "3"}
  },
  "response": {
    "status": 200,
    "body": {
      "classId": "cls_01HX",
      "subjectId": "sub_MATHS",
      "subjectName": "Mathematics",
      "year": 2026,
      "month": 3,
      "daysInMonth": 31,
      "students": [
        {
          "studentId": "stu_001",
          "studentName": "Aisha Nair",
          "admissionNumber": "ADM2024001",
          "days": {
            "1": [],
            "2": [
              {"recordId": "rec_001", "periodNumber": 2, "effectiveStatus": "Present", "isCorrected": false}
            ],
            "3": [],
            "4": [
              {"recordId": "rec_002", "periodNumber": 2, "effectiveStatus": "Absent", "isCorrected": true},
              {"recordId": "rec_003", "periodNumber": 4, "effectiveStatus": "Present", "isCorrected": false}
            ]
          }
        }
      ]
    }
  }
}
```

#### GET /api/attendance/monthly-sheet — error_403 (Teacher wrong subject)
```json
{
  "response": {
    "status": 403,
    "body": {
      "error": {"code": "FORBIDDEN", "message": "You are not assigned to this subject in the specified class", "details": {}},
      "requestId": "req_abc126",
      "timestamp": "2026-03-08T13:00:00Z"
    }
  }
}
```

---

#### POST /api/events — success (single-day holiday)
```json
{
  "request": {
    "headers": {"Authorization": "Bearer <admin_jwt>"},
    "body": {"title": "Eid Al-Fitr", "type": "Holiday", "startDate": "2026-03-31", "endDate": "2026-03-31"}
  },
  "response": {
    "status": 201,
    "body": {
      "event": {
        "id": "evt_01HX",
        "title": "Eid Al-Fitr",
        "type": "Holiday",
        "startDate": "2026-03-31",
        "endDate": "2026-03-31",
        "description": null,
        "createdBy": "usr_ADM01",
        "createdAt": "2026-03-08T14:00:00Z",
        "updatedAt": "2026-03-08T14:00:00Z"
      }
    }
  }
}
```

#### GET /api/events — success (March 2026)
```json
{
  "request": {
    "headers": {"Authorization": "Bearer <teacher_jwt>"},
    "query": {"from": "2026-03-01", "to": "2026-03-31"}
  },
  "response": {
    "status": 200,
    "body": {
      "events": [
        {
          "id": "evt_02HX",
          "title": "Term 1 Final Exams",
          "type": "Exam",
          "startDate": "2026-03-20",
          "endDate": "2026-03-25",
          "description": "All classes. Hall tickets issued separately.",
          "createdBy": "usr_ADM01",
          "createdAt": "2026-03-08T14:01:00Z",
          "updatedAt": "2026-03-08T14:01:00Z"
        }
      ],
      "total": 1
    }
  }
}
```

#### POST /api/events — error_400 (endDate before startDate)
```json
{
  "response": {
    "status": 400,
    "body": {
      "error": {"code": "VALIDATION_ERROR", "message": "endDate must be greater than or equal to startDate", "details": {}},
      "requestId": "req_abc127",
      "timestamp": "2026-03-08T14:02:00Z"
    }
  }
}
```

#### DELETE /api/events/{eventId} — success
```json
{
  "request": {"headers": {"Authorization": "Bearer <admin_jwt>"}},
  "response": {"status": 204}
}
```

---

#### POST /api/auth/login — success (Student role, CR-38)
```json
{
  "request": {
    "body": {"email": "aisha@school.edu", "password": "secret", "tenantSlug": "greenwood"}
  },
  "response": {
    "status": 200,
    "body": {
      "token": "eyJhbGciOiJIUzI1NiJ9...",
      "user": {
        "id": "usr_STU01",
        "tenantId": "tnt_001",
        "name": "Aisha Nair",
        "email": "aisha@school.edu",
        "roles": ["Student"],
        "activeRole": "Student",
        "studentId": "stu_001"
      }
    }
  }
}
```

#### POST /api/auth/login — success (Admin role, CR-38)
```json
{
  "response": {
    "status": 200,
    "body": {
      "token": "eyJhbGciOiJIUzI1NiJ9...",
      "user": {
        "id": "usr_ADM01",
        "tenantId": "tnt_001",
        "name": "Ravi Kumar",
        "email": "ravi@school.edu",
        "roles": ["Admin"],
        "activeRole": "Admin",
        "studentId": null
      }
    }
  }
}
```

#### POST /api/auth/switch-role — success (switching to Student, CR-38)
```json
{
  "request": {"body": {"role": "Student"}},
  "response": {
    "status": 200,
    "body": {
      "token": "eyJhbGciOiJIUzI1NiJ9...",
      "user": {
        "id": "usr_MULTI01",
        "tenantId": "tnt_001",
        "name": "Arjun Mehta",
        "email": "arjun@school.edu",
        "roles": ["Teacher", "Student"],
        "activeRole": "Student",
        "studentId": "stu_042"
      }
    }
  }
}
```

---

### 3.3 Mock Server — Unchanged from v4.4

```bash
prism mock ./docs/openapi.yaml --port 4010
```

**Failure simulation additions for v4.5:**

| Scenario | Header | Endpoint |
|----------|--------|----------|
| Teacher not assigned to timeslot → 403 | `Prefer: code=403` | `GET /attendance/streaks` |
| Attendance feature disabled → 403 | `Prefer: code=403` | `GET /attendance/toppers` |
| Teacher not assigned to class → 403 | `Prefer: code=403` | `GET /attendance/daily-summary` |
| Teacher wrong subject → 403 | `Prefer: code=403` | `GET /attendance/monthly-sheet` |
| endDate before startDate → 400 | `Prefer: code=400` | `POST /events` |
| Event not found → 404 | `Prefer: code=404` | `PUT /events/{id}`, `DELETE /events/{id}` |

All v4.4 failure simulations remain valid.

### 3.4 Contract Enforcement — Unchanged from v4.2

### 3.5 Endpoints (v4.5 — ALL)

**All v4.4 endpoints unchanged.** New endpoints below.

---

#### GET /api/attendance/streaks — NEW (CR-33)

- Auth required: Yes
  - Admin: any non-deleted timeslot in tenant
  - Teacher: only timeslots where `timeslots.teacherid = caller.userId AND timeslots.deletedat IS NULL` → `403 FORBIDDEN`
  - Student: any non-deleted timeslot in tenant — response filtered to own studentId only
  - SuperAdmin: `403 FORBIDDEN`
- Query params:
  - `timeSlotId`: string, required
- Response 200:
  ```json
  {
    "classId": "string",
    "subjectId": "string",
    "streaks": [
      {"studentId": "string", "consecutiveAbsentCount": 0}
    ]
  }
  ```
  - Only active students (`students.deletedat IS NULL`) included
  - `consecutiveAbsentCount: 0` for students with no records or whose last record is non-Absent
  - Effective status: `COALESCE(corrected_status, status)`
  - Student role: `streaks` array contains exactly 1 entry (own record)
- Errors: `400 VALIDATION_ERROR` (missing timeSlotId), `403 FEATURE_DISABLED`, `403 FORBIDDEN`, `404 NOT_FOUND`

---

#### GET /api/attendance/toppers — NEW (CR-34)

- Auth required: Yes
  - Admin: any classId in tenant
  - Teacher: only classIds where ≥1 non-deleted timeslot assigned → `403 FORBIDDEN`
  - Student: any classId in tenant — full ranking returned
  - SuperAdmin: `403 FORBIDDEN`
- Query params:
  - `classId`: string, required
  - `from`: string (YYYY-MM-DD), required
  - `to`: string (YYYY-MM-DD), required — must be ≥ `from`
  - `limit`: integer, optional, default 10, min 1, max 50
  - `offset`: integer, optional, default 0, min 0
- Response 200:
  ```json
  {
    "classId": "string",
    "from": "YYYY-MM-DD",
    "to": "YYYY-MM-DD",
    "total": 42,
    "limit": 10,
    "offset": 0,
    "toppers": [
      {
        "rank": 1,
        "studentId": "string",
        "studentName": "string",
        "totalPeriods": 60,
        "presentCount": 58,
        "attendancePercentage": 96.67
      }
    ]
  }
  ```
  - `attendancePercentage`: `null` when `totalPeriods = 0` (not 0)
  - `presentCount`: records where `COALESCE(corrected_status, status) IN ('Present', 'Late')`
  - `rank`: global 1-based, pre-pagination. Ordered `attendancePercentage DESC NULLS LAST`, `studentName ASC` as tiebreaker
  - `total`: count of all active students in class
- Errors: `400 VALIDATION_ERROR` (from > to; limit > 50; missing params), `403 FEATURE_DISABLED`, `403 FORBIDDEN`, `404 NOT_FOUND`

---

#### GET /api/attendance/daily-summary — NEW (CR-35)

- Auth required: Yes
  - Admin: any classId in tenant
  - Teacher: only classIds where ≥1 non-deleted timeslot assigned → `403 FORBIDDEN`
  - Student: any classId in tenant — class-level counts, no PII
  - SuperAdmin: `403 FORBIDDEN`
- Feature guard: timetable feature flag (not attendance — slot structure valid regardless)
- Query params:
  - `classId`: string, required
  - `date`: string (YYYY-MM-DD), required — no restriction on future dates
- Response 200:
  ```json
  {
    "classId": "string",
    "date": "YYYY-MM-DD",
    "dayOfWeek": "Monday",
    "slots": [
      {
        "timeSlotId": "string",
        "periodNumber": 1,
        "subjectId": "string",
        "subjectName": "string",
        "teacherId": "string",
        "teacherName": "string",
        "attendanceMarked": true,
        "totalStudents": 40,
        "absentCount": 3
      }
    ]
  }
  ```
  - `slots`: non-deleted timeslots for class whose `dayOfWeek` matches date-derived day, ordered by `periodNumber ASC`
  - Empty `slots` array is valid 200 (e.g. Sunday)
  - `attendanceMarked: false` → `absentCount: 0` (not null)
  - `dayOfWeek` derived server-side from `date`
  - `absentCount`: `COALESCE(corrected_status, status) = 'Absent'`
- Errors: `400 VALIDATION_ERROR` (missing/invalid params), `403 FEATURE_DISABLED`, `403 FORBIDDEN`, `404 NOT_FOUND`

---

#### GET /api/attendance/monthly-sheet — NEW (CR-36)

- Auth required: Yes
  - Admin: any classId + subjectId in tenant
  - Teacher: only where ≥1 non-deleted timeslot matches BOTH classId AND subjectId → `403 FORBIDDEN`
  - Student: `403 FORBIDDEN`
  - SuperAdmin: `403 FORBIDDEN`
- Query params:
  - `classId`: string, required
  - `subjectId`: string, required
  - `year`: integer, required, 2000–2099
  - `month`: integer, required, 1–12
- Response 200:
  ```json
  {
    "classId": "string",
    "subjectId": "string",
    "subjectName": "string",
    "year": 2026,
    "month": 3,
    "daysInMonth": 31,
    "students": [
      {
        "studentId": "string",
        "studentName": "string",
        "admissionNumber": "string",
        "days": {
          "1": [],
          "2": [
            {
              "recordId": "string",
              "periodNumber": 1,
              "effectiveStatus": "Present",
              "isCorrected": false
            }
          ]
        }
      }
    ]
  }
  ```
  - `days`: keys `"1"` through `"<daysInMonth>"` always fully present — no sparse keys
  - `effectiveStatus` = `COALESCE(corrected_status, status)` — raw status never exposed
  - `isCorrected: true` when `corrected_status IS NOT NULL`
  - `students` ordered by `studentName ASC`
  - Entries within each day ordered by `periodNumber ASC`
- Errors: `400 VALIDATION_ERROR` (year/month out of range; missing params), `403 FEATURE_DISABLED`, `403 FORBIDDEN`, `404 NOT_FOUND` (classId or subjectId)

---

#### POST /api/events — NEW (CR-37)

- Auth required: Yes (Admin only → `403 FORBIDDEN` for all other roles)
- Request body:
  - `title`: string, required, 1–255 chars
  - `type`: enum `Holiday | Exam | Event | Other`, required
  - `startDate`: string (YYYY-MM-DD), required
  - `endDate`: string (YYYY-MM-DD), required — must be ≥ `startDate`
  - `description`: string, optional, max 1000 chars
- Response 201:
  ```json
  {
    "event": {
      "id": "string",
      "title": "string",
      "type": "Holiday",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "description": "string | null",
      "createdBy": "string",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
  ```
- Errors: `400 VALIDATION_ERROR` (endDate < startDate; missing fields; type invalid), `403 FORBIDDEN`

---

#### GET /api/events — NEW (CR-37)

- Auth required: Yes (Admin, Teacher, Student → all read; SuperAdmin `403 FORBIDDEN`)
- Query params:
  - `from`: string (YYYY-MM-DD), optional — defaults to current month start in tenant timezone
  - `to`: string (YYYY-MM-DD), optional — defaults to current month end in tenant timezone
  - `type`: enum `Holiday | Exam | Event | Other`, optional
- Filter: events where `start_date <= :to AND end_date >= :from` (range overlap — not just start-within-range)
- Response 200:
  ```json
  {
    "events": [...],
    "total": 12
  }
  ```
  - Only non-deleted events (`deleted_at IS NULL`)
  - Ordered by `start_date ASC`, `title ASC` as tiebreaker
  - No pagination — calendar events per range are bounded in count
  - `total` = `events.length`
- Errors: `400 VALIDATION_ERROR` (from > to; invalid type value), `403 FORBIDDEN`

---

#### PUT /api/events/{eventId} — NEW (CR-37)

- Auth required: Yes (Admin only → `403 FORBIDDEN` for all other roles)
- Path param: `eventId`: string
- Request body (all fields optional — partial update):
  - `title`: string, 1–255 chars
  - `type`: enum `Holiday | Exam | Event | Other`
  - `startDate`: string (YYYY-MM-DD)
  - `endDate`: string (YYYY-MM-DD)
  - `description`: string | null — `null` clears the field
- Validation: after merging patch onto existing record, `endDate >= startDate` must hold
- Response 200: same shape as POST 201 `event` object
- Errors: `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`

---

#### DELETE /api/events/{eventId} — NEW (CR-37)

- Auth required: Yes (Admin only → `403 FORBIDDEN` for all other roles)
- Path param: `eventId`: string
- Request body: none
- Response 204: no body
- Behavior: sets `deleted_at = NOW()`. Not reversible via API
- Errors: `403 FORBIDDEN`, `404 NOT_FOUND`

---

#### POST /api/auth/login — UPDATED (CR-38)

All v4.4 behaviour unchanged. Response `user` object gains `studentId` field:

- `studentId: string` — populated when resolved `activeRole = Student` and `students.userid` link exists
- `studentId: null` — when `activeRole ∈ {Admin, Teacher}`, or when Student has no linked student record
- JWT payload gains same `studentId` field with same rules

---

#### POST /api/auth/switch-role — UPDATED (CR-38)

All v4.4 behaviour unchanged. Response `user` object gains `studentId` field with identical rules to login above. Resolution query:

```sql
SELECT id FROM students
WHERE userid = :userId
  AND tenant_id = :tenantId
  AND deleted_at IS NULL
LIMIT 1
```

Executed only when `newActiveRole = 'Student'`. Result is `null` if no row found.

---

## 4. Critical Business Logic

### Flow: getTimetable — Unchanged from v4.4

### Flow: createTimeslot — Unchanged from v4.4

### Flow: deleteTimeslot — Unchanged from v4.4

### Flow: recordClassAttendance — Unchanged from v4.4

### Flow: getAttendanceSummary — Unchanged from v4.4

---

### Flow: getAttendanceStreaks (CR-33 NEW)

```
FUNCTION getAttendanceStreaks(timeSlotId, caller, tenantId)

1. Validate timeSlotId present → 400 VALIDATION_ERROR
2. Fetch timeslot WHERE id = :timeSlotId AND tenantid = :tenantId AND deletedat IS NULL
   → 404 NOT_FOUND if not found
3. Check attendance feature enabled → 403 FEATURE_DISABLED
4. IF caller.activeRole = 'Teacher':
     SELECT 1 FROM timeslots
       WHERE id = :timeSlotId AND teacherid = caller.userId AND deletedat IS NULL
     → 403 FORBIDDEN if not found
5. Fetch active students WHERE classid = resolved classId AND deletedat IS NULL
6. IF caller.activeRole = 'Student':
     Filter student list to entry where students.userid = caller.userId
7. For each student:
   a. Fetch attendance_records for student.id + subjectId
      ordered by date DESC
   b. streak = 0
      FOR EACH record:
        IF COALESCE(corrected_status, status) = 'Absent': streak++
        ELSE: BREAK
   c. consecutiveAbsentCount = streak
8. RETURN 200 { classId, subjectId, streaks }
```

---

### Flow: getAttendanceToppers (CR-34 NEW)

```
FUNCTION getAttendanceToppers(classId, from, to, limit, offset, caller, tenantId)

1. Validate params → 400 if missing/invalid/from > to/limit > 50
2. Resolve classId WHERE tenantid = :tenantId AND deletedat IS NULL → 404 NOT_FOUND
3. Check attendance feature enabled → 403 FEATURE_DISABLED
4. IF caller.activeRole = 'Teacher':
     SELECT 1 FROM timeslots WHERE classid = :classId AND teacherid = caller.userId
       AND deletedat IS NULL AND tenantid = :tenantId LIMIT 1
     → 403 FORBIDDEN if not found
5. Fetch active students for classId → totalCount
6. For each student:
   a. totalPeriods = COUNT attendance_records WHERE student_id = s.id AND date BETWEEN from AND to
   b. presentCount = COUNT WHERE COALESCE(corrected_status, status) IN ('Present', 'Late')
   c. attendancePercentage = totalPeriods > 0 ? ROUND(presentCount/totalPeriods*100, 2) : null
7. ORDER BY attendancePercentage DESC NULLS LAST, studentName ASC
8. Assign rank = ROW_NUMBER() (global, 1-based, before pagination)
9. Apply LIMIT + OFFSET
10. RETURN 200 { classId, from, to, total, limit, offset, toppers }
```

---

### Flow: getAttendanceDailySummary (CR-35 NEW)

```
FUNCTION getAttendanceDailySummary(classId, date, caller, tenantId)

1. Validate params → 400 if missing/invalid date format
2. Resolve classId WHERE tenantid = :tenantId AND deletedat IS NULL → 404 NOT_FOUND
3. Check timetable feature enabled → 403 FEATURE_DISABLED
4. IF caller.activeRole = 'Teacher':
     SELECT 1 FROM timeslots WHERE classid = :classId AND teacherid = caller.userId
       AND deletedat IS NULL LIMIT 1
     → 403 FORBIDDEN if not found
5. Derive dayOfWeek server-side from date
6. totalStudents = COUNT students WHERE classid = :classId AND deletedat IS NULL
7. Fetch non-deleted timeslots WHERE classid = :classId AND dayofweek = :dayOfWeek
   JOIN school_periods ORDER BY period_number ASC
8. For each slot:
   a. recordCount = COUNT attendance_records WHERE timeslot_id = slot.id AND date = :date
   b. attendanceMarked = recordCount > 0
   c. absentCount = COUNT WHERE COALESCE(corrected_status, status) = 'Absent'
      (0 if !attendanceMarked)
9. RETURN 200 { classId, date, dayOfWeek, slots }
```

---

### Flow: getAttendanceMonthlySheet (CR-36 NEW)

```
FUNCTION getAttendanceMonthlySheet(classId, subjectId, year, month, caller, tenantId)

1. Validate params → 400 if invalid year/month/missing
2. Resolve classId WHERE tenantid = :tenantId AND deletedat IS NULL → 404 NOT_FOUND
3. Resolve subjectId WHERE tenantid = :tenantId AND deletedat IS NULL → 404 NOT_FOUND
4. Check attendance feature enabled → 403 FEATURE_DISABLED
5. IF caller.activeRole = 'Teacher':
     SELECT 1 FROM timeslots
       WHERE classid = :classId AND subjectid = :subjectId
         AND teacherid = caller.userId AND deletedat IS NULL LIMIT 1
     → 403 FORBIDDEN if not found
6. Compute rangeStart = year-month-01, rangeEnd = year-month-<daysInMonth>
7. Fetch active students for classId ORDER BY name ASC
8. Fetch all attendance_records WHERE:
     tenant_id = :tenantId
     AND student_id IN (active student ids)
     AND date BETWEEN rangeStart AND rangeEnd
   JOIN timeslots ON timeslot_id WHERE timeslots.subject_id = :subjectId
   (single query with JOIN)
9. Build days map per student:
   - Initialize keys "1".."<daysInMonth>" → []
   - For each record: append {recordId, periodNumber, effectiveStatus, isCorrected}
     to student[DAY_OF_MONTH(record.date)]
   - Sort entries per day by periodNumber ASC
10. RETURN 200 { classId, subjectId, subjectName, year, month, daysInMonth, students }
```

---

### Flow: createEvent (CR-37 NEW)

```
FUNCTION createEvent(title, type, startDate, endDate, description, caller, tenantId)

1. Validate body → 400 if missing required fields, invalid type enum
2. Assert endDate >= startDate → 400 VALIDATION_ERROR
3. Assert caller.activeRole = 'Admin' → 403 FORBIDDEN
4. INSERT events (id, tenantid, title, type, startdate, enddate, description, createdby, createdat, updatedat)
5. RETURN 201 { event }
```

---

### Flow: listEvents (CR-37 NEW)

```
FUNCTION listEvents(from, to, type, caller, tenantId)

1. Assert caller.activeRole IN ('Admin', 'Teacher', 'Student') → 403 FORBIDDEN
2. Validate params → 400 if from > to or invalid type
3. Resolve default range if from/to absent (current month in tenant timezone)
4. SELECT WHERE tenantid = :tenantId
     AND deletedat IS NULL
     AND start_date <= :to
     AND end_date >= :from
     [AND type = :type IF provided]
   ORDER BY start_date ASC, title ASC
5. RETURN 200 { events, total }
```

---

### Flow: updateEvent (CR-37 NEW)

```
FUNCTION updateEvent(eventId, patch, caller, tenantId)

1. Assert caller.activeRole = 'Admin' → 403 FORBIDDEN
2. Fetch event WHERE id = :eventId AND tenantid = :tenantId AND deletedat IS NULL
   → 404 NOT_FOUND
3. Merge patch fields onto existing record
4. Validate merged: endDate >= startDate → 400 VALIDATION_ERROR
5. UPDATE events SET ..., updatedat = NOW() WHERE id = :eventId
6. RETURN 200 { event }
```

---

### Flow: deleteEvent (CR-37 NEW)

```
FUNCTION deleteEvent(eventId, caller, tenantId)

1. Assert caller.activeRole = 'Admin' → 403 FORBIDDEN
2. Fetch event WHERE id = :eventId AND tenantid = :tenantId AND deletedat IS NULL
   → 404 NOT_FOUND
3. UPDATE events SET deletedat = NOW() WHERE id = :eventId
4. RETURN 204
```

---

### Flow: tenantLogin — UPDATED (CR-38)

```
All existing steps unchanged. After resolving activeRole, append:

NEW STEP (before JWT sign):
  IF activeRole = 'Student':
    studentRow = SELECT id FROM students
                   WHERE userid = :userId
                     AND tenant_id = :tenantId
                     AND deleted_at IS NULL
                   LIMIT 1
    studentId = studentRow?.id ?? null
  ELSE:
    studentId = null

Include studentId in:
  - JWT payload: { userId, tenantId, roles, activeRole, studentId }
  - Response body user object: { ...existing fields, studentId }
```

---

### Flow: switchRole — UPDATED (CR-38)

```
All existing steps unchanged. After resolving newActiveRole, append identical
studentId resolution logic as tenantLogin above.
```

---

### Other Flows — Unchanged from v4.4

---

## 5–6, 8–12 — Unchanged from v4.2

---

## 7. Acceptance Criteria (v4.5 additions)

All v4.4 criteria remain. Append:

### Phase 2 — Core API (CR-33–CR-38 additions)

**CR-33 — Attendance Streaks:**
- [ ] `GET /api/attendance/streaks` returns correct consecutive absent count per student per subject
- [ ] `consecutiveAbsentCount = 0` for students with no records or last record non-Absent
- [ ] `corrected_status` overrides `status` in streak calculation
- [ ] Teacher → 403 on unassigned timeslot
- [ ] Student receives own entry only — other students' entries excluded
- [ ] Tenant isolation: cross-tenant timeSlotId → 404

**CR-34 — Attendance Toppers:**
- [ ] `GET /api/attendance/toppers` ranks students correctly: `attendancePercentage DESC NULLS LAST`, `studentName ASC` tiebreak
- [ ] `attendancePercentage: null` (not 0) for students with `totalPeriods = 0`
- [ ] `rank` is global (pre-pagination) — student at offset 10 has `rank: 11`
- [ ] `limit > 50` → 400 VALIDATION_ERROR
- [ ] Teacher → 403 on unassigned classId
- [ ] Student sees full ranking

**CR-35 — Daily Slot Summary:**
- [ ] `GET /api/attendance/daily-summary` returns all non-deleted slots for derived dayOfWeek
- [ ] `attendanceMarked: false` → `absentCount: 0` (not null)
- [ ] Sunday (or day with no slots) → `slots: []`, status 200
- [ ] Future date → valid 200, all slots `attendanceMarked: false`
- [ ] Teacher → 403 on unassigned classId
- [ ] Student sees class-level counts without PII

**CR-36 — Monthly Attendance Sheet:**
- [ ] `GET /api/attendance/monthly-sheet` returns keys `"1"` through `"<daysInMonth>"` — no sparse keys
- [ ] February 2024 → `daysInMonth: 29`; February 2025 → `daysInMonth: 28`
- [ ] `isCorrected: true` when `corrected_status IS NOT NULL`
- [ ] Multiple periods on same day → ordered by `periodNumber ASC`
- [ ] Teacher with correct class but wrong subject → 403

**CR-37 — Academic Calendar Events:**
- [ ] `POST /api/events` creates event; `endDate < startDate` → 400
- [ ] `GET /api/events` with range overlap filter — multi-day events crossing boundary returned
- [ ] `GET /api/events` default range = current month in tenant timezone
- [ ] `PUT /api/events/{id}` partial update; merged endDate < startDate → 400
- [ ] `DELETE /api/events/{id}` → 204; subsequent GET excludes it
- [ ] Teacher POST/PUT/DELETE → 403; Teacher GET → 200
- [ ] Student GET → 200; Student POST/PUT/DELETE → 403
- [ ] Tenant isolation: cross-tenant eventId → 404

**CR-38 — studentId in JWT:**
- [ ] Login as Student → `studentId` populated in JWT and response body
- [ ] Login as Admin/Teacher → `studentId: null` in JWT and response body
- [ ] Switch-role to Student → `studentId` resolved and returned
- [ ] Switch-role away from Student → `studentId: null`
- [ ] Student with no linked record → `studentId: null` (not error)
- [ ] Old tokens without `studentId` field remain valid — middleware treats as `null`
- [ ] `GET /api/students/{studentId}/attendance/summary` works end-to-end for Student using JWT-derived studentId

---

## 13. Version History

- v1.0 (2026-01-15): Initial
- v3.1 (2026-02-01): Multi-role, soft-delete, bulk ops
- v3.2 (2026-02-10): Tenant status, feature flags
- v3.3 (2026-02-17): Dynamic school periods, immutable timetable versioning
- v3.4 (2026-02-24): Student role, attendance corrections, userid FK
- v3.5 (2026-03-03): CR-13 admission + dob
- v3.6 (2026-03-03): CR-14–19 SNAKE_CASE errors, GET single-resource, JWT 30d, soft-delete middleware, timezone, promote endpoint
- v4.0 (2026-03-05): CR-20–23 optional teacher password, graduation, student status, batch Graduated rename
- v4.1 (2026-03-07): CR-24 timeslot Active definition
- v4.2 (2026-03-07): CR-25–30 attendance summaries, logout, bulk restructure, school-periods rename, nullable schema fix, retroactive /attendance path change
- v4.3 (2026-03-07): CR-31 timeslot simplification — effectiveFrom/effectiveTo dropped, PUT /end removed, DELETE added, teacher auth simplified. 4 breaking changes. Migration 008. CR-24 retired.
- v4.4 (2026-03-08): CR-32 — PUT /timetable/{id} removed. Use DELETE + POST for correction. 1 breaking change. No migration.
- **v4.5 (2026-03-08): CR-33–38 — 9 new endpoints (attendance streaks, toppers, daily-summary, monthly-sheet; events CRUD), 1 new table (events), migration 009, studentId added to JWT payload (1 breaking change to auth response shape). OpenAPI v4.5.0.**

---

**END OF FREEZE v4.5**
