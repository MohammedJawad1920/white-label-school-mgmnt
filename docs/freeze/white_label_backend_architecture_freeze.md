# BACKEND PROJECT FREEZE: White-Label School Management System

**Version:** 4.2 (IMMUTABLE)
**Date:** 2026-03-07
**Status:** APPROVED FOR EXECUTION
**Previous Version:** v4.1 — 2026-03-07
**OpenAPI:** v4.2.0

> **CRITICAL INSTRUCTION FOR EXECUTION (HUMAN OR AI):**
> This document is the Absolute Source of Truth. You have NO authority to modify schema, API
> contracts, or scope defined below. If any request contradicts this document, you must REFUSE
> and open a Change Request instead.

***

## ⚠️ OPENAPI CORRECTION REQUIRED BEFORE IMPLEMENTATION

The submitted `openapi.yaml` v4.2.0 contains one error that MUST be corrected before it is used
for mock serving or contract enforcement:

| Incorrect (v4.2.0 as submitted) | Correct (per this Freeze) |
|----------------------------------|---------------------------|
| `DELETE /users/bulk` | `POST /users/bulk` |
| `DELETE /batches/bulk` | `POST /batches/bulk` |
| `DELETE /subjects/bulk` | `POST /subjects/bulk` |
| `DELETE /classes/bulk` | `POST /classes/bulk` |
| `DELETE /students/bulk` | `POST /students/bulk` |

Correction: change HTTP method from `delete` to `post` on all five `/*/bulk` path operations.
No other changes to OpenAPI are required. OpenAPI is NOT valid for use until this correction is made.

***

## CHANGE SUMMARY v4.1 → v4.2

### CRs Applied

| CR | Title | Type | Scope |
|----|-------|------|-------|
| **CR-25** | Formal label: `GET /students/{studentId}/attendance/summary` | Clarification | Students — attendance summary |
| **CR-26** | Add `POST /auth/logout` | Additive | Auth |
| **CR-27** | Bulk-delete restructure: `POST /*/bulk-delete` → `POST /*/bulk` | Breaking | Users, Batches, Subjects, Classes, Students |
| **CR-28** | Add `GET /attendance/summary` (class-level aggregate) | Additive | Attendance — Admin + Teacher |
| **CR-29** | Path rename: `/schoolperiods` → `/school-periods` | Breaking | School Periods (all 3 endpoints) |
| **CR-30** | Schema correction: `AttendanceRecord` nullable fields | Clarification | OpenAPI schema only |

### Additional Breaking Change (Retroactively Documented)

**`POST /api/attendance` → `POST /api/attendance/record-class`** — No CR was filed at v4.1.
Discovered during v4.2 Freeze generation via OpenAPI diff. Frontend Freeze v1.5 already
references the new path `POST /attendance/record-class` (CR-FE-010 context). Retroactively
captured here as part of v4.2 breaking changes. No new CR number assigned — documented as
inline breaking change.

### Breaking Changes Summary

1. `POST /api/users/bulk-delete` removed → replaced by `POST /api/users/bulk`
2. `POST /api/batches/bulk-delete` removed → replaced by `POST /api/batches/bulk`
3. `POST /api/subjects/bulk-delete` removed → replaced by `POST /api/subjects/bulk`
4. `POST /api/classes/bulk-delete` removed → replaced by `POST /api/classes/bulk`
5. `POST /api/students/bulk-delete` removed → replaced by `POST /api/students/bulk`
6. `GET /api/schoolperiods` removed → replaced by `GET /api/school-periods`
7. `POST /api/schoolperiods` removed → replaced by `POST /api/school-periods`
8. `GET /api/schoolperiods/{id}` removed → replaced by `GET /api/school-periods/{id}`
9. `PUT /api/schoolperiods/{id}` removed → replaced by `PUT /api/school-periods/{id}`
10. `DELETE /api/schoolperiods/{id}` removed → replaced by `DELETE /api/school-periods/{id}`
11. `POST /api/attendance` removed → replaced by `POST /api/attendance/record-class`

No compatibility shims. No redirects. Old paths return `404` immediately.

### Additive Changes

- `POST /api/auth/logout` — new endpoint (CR-26)
- `GET /api/attendance/summary` — new endpoint (CR-28)
- `GET /api/students/{studentId}/attendance/summary` — formally documented (CR-25)
- `AttendanceRecord.correctedStatus`, `.correctedBy`, `.correctedAt` — explicitly `nullable: true` in OpenAPI (CR-30, schema correction only, no behavior change)

### New Error Codes (v4.2)

None. All error conditions covered by existing registry.

### Unchanged from v4.1

- All DB schemas and migrations
- All auth, JWT, and tenant context middleware
- All soft-delete policies
- All data invariants
- All business logic flows except as noted in Section 4
- All user role capabilities except Teacher gains `GET /attendance/summary` for own classes
- Sections 0, 1, 1.2, 1.5, 1.6, 2, 2.1, 5, 6, 8, 9, 10, 11, 12

***

## 0. Commercials — Unchanged from v4.1

***

## 1. The "Iron Scope" — Updated

### The 13 Backend User Stories (v4.2 — COMPLETE SCOPE)

Stories 1–12 unchanged from v4.1. Added:

13. As a Teacher or Admin, I want to see a class-level attendance summary for a date range,
    so that I can assess overall class attendance without reviewing individual records.

### The "NO" List — Unchanged from v4.1

### User Roles (Backend authorization truth — v4.2 changes in **bold**)

**Admin** — All capabilities from v4.1, plus:
- **Can call `GET /api/attendance/summary?classId=&from=&to=` for any class in tenant**

**Teacher** — All capabilities from v4.1, plus:
- **Can call `GET /api/attendance/summary?classId=&from=&to=` only for classIds where
  teacher has at least one active (`effectiveto IS NULL`) timeslot assignment**
- **`403 FORBIDDEN` if `classId` resolves to a class with no active assignment for that teacher**

**Student** — Unchanged from v4.1.

**SuperAdmin** — Unchanged from v4.1.

***

## 1.2 Assumptions & External Dependencies — Unchanged from v4.1

## 1.5 System Configuration — Unchanged from v4.1

## 1.6 Tech Stack & Key Libraries — Unchanged from v4.1

***

## 2. Data Layer — Unchanged from v4.1

No schema changes. No new migrations. Migration list remains:

```
src/db/migrations/001_initial_schema.sql                   — v3.1 base
src/db/migrations/002_add_student_userid.sql               — v3.4 CR-08
src/db/migrations/003_add_attendance_corrections.sql       — v3.4 CR-09
src/db/migrations/004_student_admission_dob.sql            — v3.5 CR-13
src/db/migrations/005_tenant_timezone.sql                  — v3.6 CR-17
src/db/migrations/006_student_status_classid_nullable.sql  — v4.0 CR-21 + CR-22
src/db/migrations/007_batch_status_graduated.sql           — v4.0 CR-23
```

### Data Invariants — v4.2 additions (append to v4.1 list)

- **v4.2 CR-25:** A Student-role user may only call
  `GET /api/students/:studentId/attendance/summary` where `students.userId = caller.userId`
  — `403 STUDENT_ACCESS_DENIED` otherwise
- **v4.2 CR-28:** `GET /api/attendance/summary` — Teacher caller must have at least one
  `timeslots` row where `timeslots.classid = :classId AND timeslots.teacherid = caller.userId
  AND timeslots.effectiveto IS NULL AND timeslots.deletedat IS NULL`
  — `403 FORBIDDEN` otherwise
- **v4.2 CR-28:** `GET /api/attendance/summary` requires attendance feature enabled
  — `403 FEATURE_DISABLED` otherwise
- **v4.2 CR-28:** `from` must not be after `to` — `400 VALIDATION_ERROR` otherwise

***

## 2.1 Transactions, Concurrency, Idempotency — Unchanged from v4.1

***

## 3. API Contract (Backend truth)

### JWT Payload Shapes — Unchanged from v4.1

### Global Error Response Format — Unchanged from v4.1

### Common HTTP Status Codes — Unchanged from v4.1

### Error Code Registry — Unchanged from v4.1

No new error codes in v4.2.

### 3.1 OpenAPI Contract Artifact

- **File name:** `openapi.yaml`
- **Repo path:** `./docs/openapi.yaml`
- **OpenAPI version:** 3.1.0
- **API version identifier:** `4.2.0` (bumped from 4.1.0 — contains breaking changes)

**⚠️ See top-of-document correction notice.** The submitted v4.2.0 OpenAPI must have all
`DELETE /*/bulk` operations corrected to `POST /*/bulk` before it is valid.

**Consistency rule (hard):** Endpoint list + schemas + status codes in this Freeze MUST match
`openapi.yaml` exactly. If mismatch exists → Freeze is invalid until corrected.

### 3.2 Example Payload Set — Additions for v4.2 endpoints

#### POST /api/auth/logout success
```json
{
  "exampleName": "POST /api/auth/logout success",
  "request": {
    "headers": { "Authorization": "Bearer <valid_jwt>" },
    "body": null
  },
  "response": {
    "status": 200,
    "body": { "message": "Logged out successfully" }
  }
}
```

#### POST /api/auth/logout error_401
```json
{
  "exampleName": "POST /api/auth/logout error_401",
  "request": {
    "headers": {},
    "body": null
  },
  "response": {
    "status": 401,
    "body": {
      "error": { "code": "UNAUTHORIZED", "message": "Missing or invalid token", "details": {} },
      "timestamp": "2026-03-07T04:30:00Z"
    }
  }
}
```

#### POST /api/attendance/record-class success
```json
{
  "exampleName": "POST /api/attendance/record-class success",
  "request": {
    "headers": { "Authorization": "Bearer <teacher_jwt>" },
    "body": {
      "timeSlotId": "TS001",
      "date": "2026-03-07",
      "attendance": [
        { "studentId": "STU001", "status": "Present" },
        { "studentId": "STU002", "status": "Absent" }
      ]
    }
  },
  "response": {
    "status": 201,
    "body": { "recorded": 2, "failed": [] }
  }
}
```

#### POST /api/attendance/record-class error_409
```json
{
  "exampleName": "POST /api/attendance/record-class error_409",
  "request": {
    "headers": { "Authorization": "Bearer <teacher_jwt>" },
    "body": {
      "timeSlotId": "TS001",
      "date": "2026-03-07",
      "attendance": [{ "studentId": "STU001", "status": "Present" }]
    }
  },
  "response": {
    "status": 409,
    "body": {
      "error": { "code": "CONFLICT", "message": "Attendance already recorded for this slot and date", "details": {} },
      "timestamp": "2026-03-07T04:30:00Z"
    }
  }
}
```

#### GET /api/attendance/summary success (Admin)
```json
{
  "exampleName": "GET /api/attendance/summary success",
  "request": {
    "headers": { "Authorization": "Bearer <admin_jwt>" },
    "query": { "classId": "CLS001", "from": "2026-03-01", "to": "2026-03-07" }
  },
  "response": {
    "status": 200,
    "body": {
      "summary": {
        "classId": "CLS001",
        "className": "Grade 10A",
        "from": "2026-03-01",
        "to": "2026-03-07",
        "totalStudents": 30,
        "totalClasses": 210,
        "averageAttendanceRate": 91.5
      }
    }
  }
}
```

#### GET /api/attendance/summary error_403 (Teacher — not assigned)
```json
{
  "exampleName": "GET /api/attendance/summary error_403",
  "request": {
    "headers": { "Authorization": "Bearer <teacher_jwt>" },
    "query": { "classId": "CLS_OTHER", "from": "2026-03-01", "to": "2026-03-07" }
  },
  "response": {
    "status": 403,
    "body": {
      "error": { "code": "FORBIDDEN", "message": "You are not assigned to this class", "details": {} },
      "timestamp": "2026-03-07T04:30:00Z"
    }
  }
}
```

#### POST /api/users/bulk success
```json
{
  "exampleName": "POST /api/users/bulk success",
  "request": {
    "headers": { "Authorization": "Bearer <admin_jwt>" },
    "body": { "userIds": ["U001", "U002"] }
  },
  "response": {
    "status": 200,
    "body": { "deletedCount": 2 }
  }
}
```

#### GET /api/school-periods success
```json
{
  "exampleName": "GET /api/school-periods success",
  "request": { "headers": { "Authorization": "Bearer <admin_jwt>" } },
  "response": {
    "status": 200,
    "body": {
      "schoolPeriods": [
        { "id": "SP001", "tenantId": "T001", "periodNumber": 1, "label": "Period 1",
          "startTime": "08:00", "endTime": "08:45", "createdAt": "2026-01-15T00:00:00Z",
          "updatedAt": "2026-01-15T00:00:00Z" }
      ]
    }
  }
}
```

#### GET /api/students/{studentId}/attendance/summary success
```json
{
  "exampleName": "GET /api/students/STU001/attendance/summary success",
  "request": {
    "headers": { "Authorization": "Bearer <admin_jwt>" },
    "query": { "year": 2026, "month": 3 }
  },
  "response": {
    "status": 200,
    "body": {
      "summary": {
        "studentId": "STU001",
        "year": 2026,
        "month": 3,
        "totalClasses": 42,
        "present": 38,
        "absent": 3,
        "late": 1,
        "attendancePercentage": 90.48
      }
    }
  }
}
```

#### GET /api/students/{studentId}/attendance/summary error_403
```json
{
  "exampleName": "GET /api/students/STU002/attendance/summary error_403",
  "request": {
    "headers": { "Authorization": "Bearer <student_jwt_for_STU001>" },
    "query": { "year": 2026, "month": 3 }
  },
  "response": {
    "status": 403,
    "body": {
      "error": { "code": "STUDENT_ACCESS_DENIED",
        "message": "You can only view your own attendance summary", "details": {} },
      "timestamp": "2026-03-07T04:30:00Z"
    }
  }
}
```

### 3.3 Mock Server — Updated run command

```bash
# Install (if not already)
npm install -g @stoplight/prism-cli

# Serve — uses corrected openapi.yaml (DELETE → POST on bulk endpoints)
prism mock ./docs/openapi.yaml --port 4010

# .env for frontend:
VITE_API_BASE_URL=http://localhost:4010/api
```

**Failure simulation additions for v4.2:**

| Scenario | Header | Endpoint |
|----------|--------|----------|
| Teacher accesses unassigned class summary | `Prefer: code=403` | `GET /attendance/summary` |
| Attendance feature disabled on summary | `Prefer: code=403` | `GET /attendance/summary` |
| Invalid date range (from > to) | `Prefer: code=400` | `GET /attendance/summary` |
| Student accesses another student summary | `Prefer: code=403` | `GET /students/{id}/attendance/summary` |
| Logout with invalid token | `Prefer: code=401` | `POST /auth/logout` |

All v4.1 simulation scenarios remain valid.

### 3.4 Contract Enforcement — Unchanged from v4.1

### 3.5 Endpoints (MVP — ALL — v4.2)

**CHANGED PATHS (v4.2):**

---

#### POST /api/auth/logout — NEW (CR-26)
- Auth required: Yes (Bearer JWT — any valid tenant or SuperAdmin token)
- Request body: none
- Response 200: `{ "message": "Logged out successfully" }`
- Errors: `401 UNAUTHORIZED` (missing/invalid token only)
- Behavior: Server no-op. No DB writes. No token blacklist. Client must discard token.
- SuperAdmin token: also accepted — returns 200, no-op.

---

#### POST /api/auth/login — Unchanged from v4.1
#### POST /api/auth/switch-role — Unchanged from v4.1
#### POST /api/super-admin/auth/login — Unchanged from v4.1
#### All /super-admin/tenants/* — Unchanged from v4.1
#### GET /api/features — Unchanged from v4.1
#### All /users/* (non-bulk) — Unchanged from v4.1
#### All /batches/* (non-bulk) — Unchanged from v4.1
#### All /subjects/* (non-bulk) — Unchanged from v4.1
#### All /classes/* (non-bulk, non-promote) — Unchanged from v4.1
#### PUT /api/classes/{sourceClassId}/promote — Unchanged from v4.1
#### All /students/* (non-bulk, non-attendance) — Unchanged from v4.1
#### GET /api/timetable — Unchanged from v4.1
#### POST /api/timetable — Unchanged from v4.1
#### PUT /api/timetable/{timeSlotId}/end — Unchanged from v4.1
#### PUT /api/attendance/{recordId} — Unchanged from v4.1

---

#### POST /api/users/bulk — RENAMED (CR-27, was POST /api/users/bulk-delete)
- Auth required: Yes (Admin only)
- Request body: `{ "userIds": string[] }` — must be non-empty array
- Response 200: `{ "deletedCount": integer }`
- Errors: `400 VALIDATION_ERROR` (empty array), `401`, `403`
- Behavior: Soft-delete. Identical partial-failure behavior to v4.1.
- Same pattern applies to: `POST /api/batches/bulk`, `POST /api/subjects/bulk`,
  `POST /api/classes/bulk`, `POST /api/students/bulk`

---

#### GET /api/school-periods — RENAMED (CR-29, was GET /api/schoolperiods)
- Identical spec to v4.1 `GET /api/schoolperiods`

#### POST /api/school-periods — RENAMED (CR-29, was POST /api/schoolperiods)
- Identical spec to v4.1 `POST /api/schoolperiods`

#### GET /api/school-periods/{periodId} — RENAMED (CR-29)
- Identical spec to v4.1 `GET /api/schoolperiods/{periodId}`

#### PUT /api/school-periods/{periodId} — RENAMED (CR-29)
- Identical spec to v4.1 `PUT /api/schoolperiods/{periodId}`

#### DELETE /api/school-periods/{periodId} — RENAMED (CR-29)
- Identical spec to v4.1 `DELETE /api/schoolperiods/{periodId}`

---

#### POST /api/attendance/record-class — RENAMED (retroactive, was POST /api/attendance)
- Auth required: Yes (Teacher: own-class timeslots only; Admin: any timeslot in tenant)
- Request body:
  - `timeSlotId`: string, required
  - `date`: string (YYYY-MM-DD), required — must not be future in tenant timezone
  - `attendance`: array, required, min 1 item
    - `studentId`: string, required
    - `status`: enum `Present | Absent | Late`, required
- Response 201: `{ "recorded": integer, "failed": [{ "studentId": string, "reason": string }] }`
- Errors: `400 FUTURE_DATE`, `403 FEATURE_DISABLED`, `403 FORBIDDEN` (teacher not assigned),
  `409 CONFLICT` (attendance already recorded for this slot+date combination)

---

#### GET /api/attendance/summary — NEW (CR-28)
- Auth required: Yes
  - Admin: any classId in tenant
  - Teacher: only classIds where caller has `timeslots.teacherid = caller.userId
    AND timeslots.effectiveto IS NULL AND timeslots.deletedat IS NULL`
    → `403 FORBIDDEN` if no active assignment found for that classId
  - Student: `403 FORBIDDEN`
- Query params:
  - `classId`: string, required
  - `from`: string (YYYY-MM-DD), required
  - `to`: string (YYYY-MM-DD), required — must be >= `from`
- Response 200:
  ```json
  {
    "summary": {
      "classId": "string",
      "className": "string",
      "from": "YYYY-MM-DD",
      "to": "YYYY-MM-DD",
      "totalStudents": "integer",
      "totalClasses": "integer",
      "averageAttendanceRate": "float"
    }
  }
  ```
  - `totalStudents`: count of active students (`deletedat IS NULL`) in the class
  - `totalClasses`: total attendance records in range (all students × all timeslots in range)
  - `averageAttendanceRate`: `(present + late) / totalClasses * 100`, rounded to 2dp;
    effective status = `correctedstatus ?? status`
- Errors: `400 VALIDATION_ERROR` (from > to; missing required params),
  `403 FEATURE_DISABLED` (attendance feature), `403 FORBIDDEN` (Teacher not assigned),
  `404 NOT_FOUND` (classId not found in tenant)

---

#### GET /api/students/{studentId}/attendance/summary — FORMALLY DOCUMENTED (CR-25)
- Auth required: Yes
  - Admin: any student in tenant
  - Teacher: any student in own-class timeslots
  - Student: own record only (`students.userid = caller.userId`) → `403 STUDENT_ACCESS_DENIED`
- Query params:
  - `year`: integer, required
  - `month`: integer, required (1–12)
- Response 200:
  ```json
  {
    "summary": {
      "studentId": "string",
      "year": "integer",
      "month": "integer",
      "totalClasses": "integer",
      "present": "integer",
      "absent": "integer",
      "late": "integer",
      "attendancePercentage": "float"
    }
  }
  ```
  - `attendancePercentage`: `(present + late) / totalClasses * 100`, rounded to 2dp;
    0 if `totalClasses = 0`
  - Effective status: `correctedstatus ?? status`
- Errors: `403 STUDENT_ACCESS_DENIED`, `403 FEATURE_DISABLED`, `404 NOT_FOUND`

---

#### GET /api/students/{studentId}/attendance — Unchanged from v4.1

***

## 4. Critical Business Logic — v4.2 additions

### Flow: getAttendanceSummary — class-level (CR-28)

```
FUNCTION getAttendanceSummary(classId, from, to, caller, tenantId)

1. Verify attendance feature enabled → 403 FEATURE_DISABLED if not

2. Validate from <= to → 400 VALIDATION_ERROR if not

3. Fetch class WHERE id = :classId AND tenantid = :tenantId AND deletedat IS NULL
   → 404 NOT_FOUND if missing

4. IF caller.roles contains 'Teacher' AND NOT contains 'Admin':
     activeSlot = SELECT 1 FROM timeslots
       WHERE classid = :classId
         AND teacherid = :caller.userId
         AND effectiveto IS NULL
         AND deletedat IS NULL
         AND tenantid = :tenantId
       LIMIT 1
     → 403 FORBIDDEN if no row found

5. totalStudents = COUNT students WHERE classid = :classId AND deletedat IS NULL
                   AND tenantid = :tenantId

6. records = SELECT ar.*, COALESCE(ar.correctedstatus, ar.status) AS effectiveStatus
     FROM attendancerecords ar
     JOIN students s ON s.id = ar.studentid
     WHERE s.classid = :classId
       AND ar.tenantid = :tenantId
       AND ar.date BETWEEN :from AND :to

7. totalClasses = COUNT(records)
   present = COUNT WHERE effectiveStatus = 'Present'
   absent  = COUNT WHERE effectiveStatus = 'Absent'
   late    = COUNT WHERE effectiveStatus = 'Late'
   rate    = IF totalClasses > 0 THEN ROUND((present + late) / totalClasses * 100, 2)
             ELSE 0

8. RETURN 200 { summary: { classId, className, from, to,
     totalStudents, totalClasses, averageAttendanceRate: rate } }
```

---

### Flow: getStudentAttendanceSummary — per-student monthly (CR-25)

```
FUNCTION getStudentAttendanceSummary(studentId, year, month, caller, tenantId)

1. Verify attendance feature enabled → 403 FEATURE_DISABLED if not

2. Fetch student WHERE id = :studentId AND tenantid = :tenantId AND deletedat IS NULL
   → 404 NOT_FOUND if missing

3. IF caller.roles contains 'Student':
     IF student.userid != caller.userId → 403 STUDENT_ACCESS_DENIED

4. from = DATE(year, month, 1)
   to   = LAST_DAY(year, month)

5. records = SELECT COALESCE(correctedstatus, status) AS effectiveStatus
     FROM attendancerecords
     WHERE studentid = :studentId
       AND tenantid = :tenantId
       AND date BETWEEN :from AND :to

6. totalClasses = COUNT(records)
   present = COUNT WHERE effectiveStatus = 'Present'
   absent  = COUNT WHERE effectiveStatus = 'Absent'
   late    = COUNT WHERE effectiveStatus = 'Late'
   rate    = IF totalClasses > 0 THEN ROUND((present + late) / totalClasses * 100, 2)
             ELSE 0

7. RETURN 200 { summary: { studentId, year, month, totalClasses,
     present, absent, late, attendancePercentage: rate } }
```

---

### Other Flows — unchanged from v4.1

- tenantContextMiddleware
- getTimetable (CR-24)
- createUser (CR-20)
- createStudent (CR-13)
- updateStudent (CR-22)
- promoteClass (CR-21)
- correctAttendance (CR-09)
- recordClassAttendance (path renamed, logic unchanged)
- updateUserRoles
- createTimeSlot

***

## 5. Integrations & Failure Behavior — Unchanged from v4.1 (None)

## 6. Observability, Audit, Safety — Unchanged from v4.1

## 7. Acceptance Criteria — v4.2 additions

Append to v4.1 list:

- [ ] `POST /api/auth/logout` returns 200 with any valid JWT; returns 401 with missing token
- [ ] `POST /api/attendance/record-class` works at new path; `POST /api/attendance` returns 404
- [ ] All `POST /api/*/bulk` return 200 with `deletedCount`; old `POST /*/bulk-delete` return 404
- [ ] All `GET/POST/PUT/DELETE /api/school-periods/*` work; old `/schoolperiods` returns 404
- [ ] `GET /api/attendance/summary` returns correct aggregate; Teacher forbidden from unassigned class
- [ ] `GET /api/students/{id}/attendance/summary` returns per-student monthly summary;
      Student forbidden from cross-student access
- [ ] `attendancePercentage` counts effective status (correctedstatus ?? status)

## 8. Project Structure — Unchanged from v4.1

## 9. Constraints — Unchanged from v4.1

## 10. Deployment, Rollback, Backups, DR — Unchanged from v4.1

## 11. Forbidden Changes — Unchanged from v4.1

## 12. Change Control — Unchanged from v4.1

## 13. Version History

- v1.0 (2026-01-15): Initial backend freeze
- v3.1 (2026-02-01): Multi-role support, soft-delete, bulk operations
- v3.2 (2026-02-10): Tenant status, feature flags
- v3.3 (2026-02-17): Dynamic school periods, immutable timetable versioning
- v3.4 (2026-02-24): Student role, attendance corrections, userid FK
- v3.5 (2026-03-03): CR-13 admission number + dob, student login derivation
- v3.6 (2026-03-03): CR-14–CR-19: SNAKE_CASE errors, GET single-resource endpoints, JWT 30d,
  soft-delete middleware, tenant timezone, class promote endpoint
- v4.0 (2026-03-05): CR-20–CR-23: optional teacher password, graduation action, student status
  field, batch Archived→Graduated rename (breaking)
- v4.1 (2026-03-07): CR-24: timeslot "Active" definition clarification — additive, no schema change
- **v4.2 (2026-03-07): CR-25–CR-30: attendance summary endpoints documented, POST /auth/logout,
  bulk-delete path restructure (POST /*/bulk), GET /attendance/summary (Admin+Teacher),
  /school-periods rename, AttendanceRecord nullable schema fix. Retroactive: POST /attendance
  → POST /attendance/record-class. 11 breaking path changes. OpenAPI correction required
  (DELETE → POST on bulk endpoints).**

***

**END OF FREEZE v4.2**
