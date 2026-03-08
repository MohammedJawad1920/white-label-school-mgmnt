# BACKEND PROJECT FREEZE: White-Label School Management System

**Version:** 4.3 (IMMUTABLE)  
**Date:** 2026-03-07  
**Status:** APPROVED FOR EXECUTION  
**Previous Version:** v4.2 — 2026-03-07  
**OpenAPI:** v4.3.0

> **CRITICAL INSTRUCTION FOR EXECUTION (HUMAN OR AI):**  
> This document is the Absolute Source of Truth. You have NO authority to modify schema, API contracts, or scope defined below. If any request contradicts this document, you must REFUSE and open a Change Request instead.

***

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

### Additive Changes

- `PUT /api/timetable/{timeSlotId}` — **NEW**: edit teacherId and/or subjectId directly
- `DELETE /api/timetable/{timeSlotId}` — **NEW**: soft-delete timeslot

### Schema Changes

**Migration 008:**
```sql
ALTER TABLE timeslots DROP COLUMN effectivefrom, DROP COLUMN effectiveto;
```

### Retired CRs

- **CR-24** (Timeslot Active definition) — fully superseded by CR-31; "Active" concept no longer exists

### Simplified

- Teacher authorization (2 locations): `effectiveto IS NULL` condition **REMOVED**, simplified to `deletedat IS NULL` only
- Timeslot conflict check: overlapping-date-range logic **REPLACED** with simple unique constraint on non-deleted slots

### Unchanged from v4.2

- All attendance endpoints and business logic (except teacher auth query simplification)
- All other entity management (users, students, batches, classes, subjects, school periods)
- All auth, JWT, tenant context middleware
- All soft-delete policies
- All data invariants except updated teacher auth checks
- Sections 0, 1, 1.2, 1.5, 2.1, 5, 6, 8, 9, 10, 11, 12

***

## 0. Commercials — Unchanged from v4.2

***

## 1. The "Iron Scope" — Unchanged from v4.2

### The 13 Backend User Stories (v4.3 COMPLETE SCOPE)

All 13 stories unchanged from v4.2.

### The "NO" List — Unchanged from v4.2

### User Roles (v4.3 — CR-31 simplification in **bold**)

**Admin** — All v4.2 capabilities unchanged

**Teacher** — All v4.2 capabilities, authorization simplified:
- **Can call `GET /api/attendance/summary?classId=&from=&to=` only for classIds where teacher has ≥1 non-deleted timeslot (was: `effectiveto IS NULL`) → `403 FORBIDDEN` if no assignment found**

**Student, SuperAdmin** — Unchanged from v4.2

***

## 1.2–1.6 — All Unchanged from v4.2

***

## 2. Data Layer

### 2.1 Database Schema

**Schema unchanged except timeslots table (CR-31):**

#### timeslots (v4.3 — CR-31 UPDATED)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | VARCHAR(255) | PK | ULID |
| tenantid | VARCHAR(255) | FK tenants.id, NOT NULL, indexed | Tenant isolation |
| classid | VARCHAR(255) | FK classes.id, NOT NULL, indexed | Which class |
| subjectid | VARCHAR(255) | FK subjects.id, NOT NULL | Which subject |
| teacherid | VARCHAR(255) | FK users.id, NOT NULL, indexed | Which teacher |
| dayofweek | ENUM | NOT NULL | Monday–Sunday |
| periodnumber | INTEGER | NOT NULL, ≥1 | Which period |
| deletedat | TIMESTAMP | NULL, indexed | Soft-delete timestamp |
| createdat | TIMESTAMP | DEFAULT NOW() | |
| updatedat | TIMESTAMP | DEFAULT NOW() | |

**CR-31 REMOVED COLUMNS:**
- ~~effectivefrom~~ — dropped
- ~~effectiveto~~ — dropped

**Indexes:**
```sql
CREATE INDEX idx_timeslots_tenant ON timeslots(tenantid);
CREATE INDEX idx_timeslots_class ON timeslots(classid);
CREATE INDEX idx_timeslots_teacher ON timeslots(teacherid);
CREATE INDEX idx_timeslots_day ON timeslots(dayofweek);
CREATE INDEX idx_timeslots_deletedat ON timeslots(deletedat);
CREATE UNIQUE INDEX idx_timeslots_unique_slot ON timeslots(tenantid, classid, dayofweek, periodnumber)
  WHERE deletedat IS NULL;
```

**All other tables unchanged from v4.2.**

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
```

**Migration 008 (CR-31):**
```sql
-- src/db/migrations/008_timeslot_remove_effective_dates.sql

ALTER TABLE timeslots
  DROP COLUMN effectivefrom,
  DROP COLUMN effectiveto;

-- Add unique constraint for non-deleted slots
CREATE UNIQUE INDEX idx_timeslots_unique_slot ON timeslots(tenantid, classid, dayofweek, periodnumber)
  WHERE deletedat IS NULL;
```

No data backfill required. Columns dropped, attendance records unaffected.

### Data Invariants (v4.3 — CR-31 updates in **bold**)

All v4.2 invariants remain, with updates:

**Updated:**
- **v4.3 CR-31:** Teacher auth check for `POST /attendance/record-class` — Teacher must have ≥1 timeslots row where `timeslots.classid = :classId AND timeslots.teacherid = caller.userId AND timeslots.deletedat IS NULL` (was: `effectiveto IS NULL AND deletedat IS NULL`) → `403 FORBIDDEN` otherwise
- **v4.3 CR-31:** Teacher auth check for `GET /attendance/summary` — Teacher must have ≥1 timeslots row where `timeslots.classid = :classId AND timeslots.teacherid = caller.userId AND timeslots.deletedat IS NULL` → `403 FORBIDDEN` otherwise
- **v4.3 CR-31:** Timeslot conflict — `(tenantid, classid, dayofweek, periodnumber)` must be unique among non-deleted timeslots → `409 CONFLICT`

**Removed:**
- ~~v4.1 CR-24: Timeslot Active definition~~ — retired, no longer applicable

***

## 3. API Contract

### 3.1 OpenAPI Contract Artifact

- **File:** `openapi.yaml`
- **Path:** `./docs/openapi.yaml`
- **OpenAPI version:** 3.1.0
- **API version:** `4.3.0` (bumped from 4.2.0 — breaking changes)

### 3.2 Example Payloads (v4.3 additions)

**All v4.2 examples remain valid.**

#### POST /timetable success (CR-31 — effectiveFrom removed)
```json
{
  "request": {
    "headers": {"Authorization": "Bearer <admin_jwt>"},
    "body": {
      "classId": "CLS001",
      "subjectId": "SUB001",
      "teacherId": "TCH001",
      "dayOfWeek": "Monday",
      "periodNumber": 1
    }
  },
  "response": {
    "status": 201,
    "body": {
      "timeSlot": {
        "id": "TS001",
        "classId": "CLS001",
        "className": "Grade 10A",
        "subjectId": "SUB001",
        "subjectName": "Mathematics",
        "teacherId": "TCH001",
        "teacherName": "John Doe",
        "dayOfWeek": "Monday",
        "periodNumber": 1,
        "periodLabel": "Period 1",
        "startTime": "08:00",
        "endTime": "08:45",
        "createdAt": "2026-03-07T10:00:00Z",
        "updatedAt": "2026-03-07T10:00:00Z"
      }
    }
  }
}
```

#### GET /timetable success (CR-31 — date and status removed)
```json
{
  "request": {
    "headers": {"Authorization": "Bearer <teacher_jwt>"},
    "query": {"teacherId": "TCH001"}
  },
  "response": {
    "status": 200,
    "body": {
      "timetable": [
        {
          "id": "TS001",
          "classId": "CLS001",
          "className": "Grade 10A",
          "subjectId": "SUB001",
          "subjectName": "Mathematics",
          "teacherId": "TCH001",
          "teacherName": "John Doe",
          "dayOfWeek": "Monday",
          "periodNumber": 1,
          "periodLabel": "Period 1",
          "startTime": "08:00",
          "endTime": "08:45"
        }
      ]
    }
  }
}
```

#### PUT /timetable/{timeSlotId} success (CR-31 NEW)
```json
{
  "request": {
    "headers": {"Authorization": "Bearer <admin_jwt>"},
    "body": {"teacherId": "TCH002"}
  },
  "response": {
    "status": 200,
    "body": {
      "timeSlot": {
        "id": "TS001",
        "teacherId": "TCH002",
        "teacherName": "Jane Smith"
      }
    }
  }
}
```

#### DELETE /timetable/{timeSlotId} success (CR-31 NEW)
```json
{
  "request": {
    "headers": {"Authorization": "Bearer <admin_jwt>"}
  },
  "response": {"status": 204}
}
```

#### PUT /timetable/{timeSlotId}/end error404 (CR-31 — endpoint removed)
```json
{
  "response": {
    "status": 404,
    "body": {
      "error": {
        "code": "NOT_FOUND",
        "message": "Endpoint not found",
        "details": {},
        "timestamp": "2026-03-07T10:00:00Z"
      }
    }
  }
}
```

### 3.3 Mock Server

```bash
prism mock ./docs/openapi.yaml --port 4010
```

**Failure simulation (v4.3 updates):**

| Scenario | Header | Endpoint |
|----------|--------|----------|
| Slot already occupied | `Prefer: code=409` | `POST /timetable` |
| Neither field provided | `Prefer: code=400` | `PUT /timetable/{id}` |
| Teacher not assigned | `Prefer: code=403` | `POST /attendance/record-class` |

**Removed:**
- ~~effectiveTo in the past → PUT /timetable/{id}/end~~ (endpoint removed)

### 3.4 Contract Enforcement — Unchanged from v4.2

### 3.5 Endpoints (v4.3 — ALL)

**All v4.2 endpoints unchanged except timetable group.**

---

#### GET /timetable — UPDATED (CR-31)

- Auth: Teacher (own slots filtered client-side), Admin (all slots), Student (read-only)
- **Query params REMOVED:** `date`, `status`
- **Query params KEPT:** `dayOfWeek` (enum), `teacherId` (string), `classId` (string)
- Response 200: `{"timetable": TimeSlot[]}`
- Behavior: Returns all non-deleted timeslots matching filters
- Errors: `401 UNAUTHORIZED`, `403 FEATURE_DISABLED`

---

#### POST /timetable — UPDATED (CR-31)

- Auth: Admin only
- Request body: `{"classId": string, "subjectId": string, "teacherId": string, "dayOfWeek": enum, "periodNumber": integer}`
- **REMOVED:** `effectiveFrom` field (was required in v4.2)
- Response 201: `{"timeSlot": TimeSlot}`
- Errors: `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `409 CONFLICT` (slot occupied)

---

#### PUT /timetable/{timeSlotId} — NEW (CR-31)

- Auth: Admin only
- Request body: `{"teacherId"?: string, "subjectId"?: string}` (at least one required)
- Response 200: `{"timeSlot": TimeSlot}` (full updated slot)
- Errors: `400 VALIDATION_ERROR` (neither field), `403 FORBIDDEN`, `404 NOT_FOUND`
- Behavior: Direct field update. No conflict check (slot identity unchanged).

---

#### DELETE /timetable/{timeSlotId} — NEW (CR-31)

- Auth: Admin only
- Response 204 (no content)
- Errors: `403 FORBIDDEN`, `404 NOT_FOUND`
- Behavior: Soft-delete (`deletedat = NOW()`). Existing attendance records preserved (orphaned timeslotid acceptable — historical audit).

---

#### PUT /timetable/{timeSlotId}/end — REMOVED (CR-31)

Returns 404 immediately. No replacement endpoint — use `DELETE /timetable/{id}` to remove slots.

---

**All other endpoints unchanged from v4.2.**

***

## 4. Critical Business Logic

### Flow: getTimetable (CR-31 UPDATED)

```
FUNCTION getTimetable(filters, tenantId)
  -- filters: dayOfWeek?, teacherId?, classId?

1. Verify timetable feature enabled → 403 FEATURE_DISABLED

2. SELECT timeslots.*
   FROM timeslots
   WHERE tenantid = :tenantId
     AND deletedat IS NULL
     [AND dayofweek = :dayOfWeek IF provided]
     [AND teacherid = :teacherId IF provided]
     [AND classid = :classId IF provided]

3. JOIN schoolperiods ON periodnumber
   JOIN classes ON classid
   JOIN subjects ON subjectid
   JOIN users ON teacherid

4. RETURN 200 { timetable }
```

**CR-31 REMOVED:** `date` and `status` param handling, date-range filtering logic.

### Flow: createTimeslot (CR-31 UPDATED)

```
FUNCTION createTimeslot(classId, subjectId, teacherId, dayOfWeek, periodNumber, tenantId)

1. Verify timetable feature enabled → 403 FEATURE_DISABLED

2. Verify class WHERE id = :classId AND tenantid = :tenantId AND deletedat IS NULL → 404 NOT_FOUND
   Verify subject WHERE id = :subjectId AND tenantid = :tenantId AND deletedat IS NULL → 404 NOT_FOUND
   Verify teacher (user with Teacher role) WHERE id = :teacherId AND tenantid = :tenantId AND deletedat IS NULL → 404 NOT_FOUND

3. Conflict check:
   SELECT 1 FROM timeslots
     WHERE tenantid = :tenantId
       AND classid = :classId
       AND dayofweek = :dayOfWeek
       AND periodnumber = :periodNumber
       AND deletedat IS NULL
     LIMIT 1
   → 409 CONFLICT "Slot already occupied" if found

4. INSERT timeslots (id, tenantid, classid, subjectid, teacherid, dayofweek, periodnumber, createdat, updatedat)

5. RETURN 201 { timeSlot with joins }
```

**CR-31 REMOVED:** `effectiveFrom` param, overlapping-date-range conflict check.

### Flow: updateTimeslot (CR-31 NEW)

```
FUNCTION updateTimeslot(timeSlotId, teacherId?, subjectId?, caller, tenantId)

1. Verify caller is Admin → 403 FORBIDDEN

2. Validate request: at least one of teacherId or subjectId must be present → 400 VALIDATION_ERROR

3. Fetch timeslot WHERE id = :timeSlotId AND tenantid = :tenantId AND deletedat IS NULL → 404 NOT_FOUND

4. IF teacherId provided:
     Verify user WHERE id = :teacherId AND tenantid = :tenantId AND deletedat IS NULL AND roles CONTAINS 'Teacher' → 404 NOT_FOUND

5. IF subjectId provided:
     Verify subject WHERE id = :subjectId AND tenantid = :tenantId AND deletedat IS NULL → 404 NOT_FOUND

6. UPDATE timeslots
     SET teacherid = COALESCE(:teacherId, teacherid),
         subjectid = COALESCE(:subjectId, subjectid),
         updatedat = NOW()
     WHERE id = :timeSlotId

7. RETURN 200 { timeSlot with joins }
```

### Flow: deleteTimeslot (CR-31 NEW)

```
FUNCTION deleteTimeslot(timeSlotId, caller, tenantId)

1. Verify caller is Admin → 403 FORBIDDEN

2. Fetch timeslot WHERE id = :timeSlotId AND tenantid = :tenantId AND deletedat IS NULL → 404 NOT_FOUND

3. UPDATE timeslots SET deletedat = NOW() WHERE id = :timeSlotId

4. RETURN 204
```

### Flow: endTimeslot (CR-31 REMOVED)

No replacement. Deleted entirely.

### Flow: recordClassAttendance (CR-31 teacher auth UPDATED)

**Step 4 updated:**

```
4. IF caller is Teacher (not Admin):
     teacherSlot = SELECT 1 FROM timeslots
       WHERE id = :timeSlotId
         AND teacherid = caller.userId
         AND deletedat IS NULL  -- CR-31: removed effectiveto IS NULL
         AND tenantid = :tenantId
       LIMIT 1
     → 403 FORBIDDEN if not found
```

**All other steps unchanged from v4.2.**

### Flow: getAttendanceSummary (CR-31 teacher auth UPDATED)

**Step 4 updated:**

```
4. IF caller.roles contains 'Teacher' AND NOT 'Admin':
     activeSlot = SELECT 1 FROM timeslots
       WHERE classid = :classId
         AND teacherid = :caller.userId
         AND deletedat IS NULL  -- CR-31: removed effectiveto IS NULL
         AND tenantid = :tenantId
       LIMIT 1
     → 403 FORBIDDEN if no row
```

**All other steps unchanged from v4.2.**

### Other Flows — Unchanged from v4.2

All other business logic flows unchanged (tenantContextMiddleware, createUser, createStudent, updateStudent, promoteClass, correctAttendance, getStudentAttendanceSummary, updateUserRoles).

***

## 5–12. All Sections Unchanged from v4.2

Sections 5 (Security), 6 (Performance), 8 (Testing), 9 (Error Handling), 10 (Monitoring), 11 (Infrastructure), 12 (Deployment) are unchanged from v4.2.

***

## 7. Acceptance Criteria (v4.3 additions)

All v4.2 criteria remain. Append:

- [ ] `GET /timetable` returns all non-deleted slots; `date` and `status` params ignored or return error (implementation choice)
- [ ] `POST /timetable` without `effectiveFrom` field succeeds; if `effectiveFrom` provided, field is ignored
- [ ] `PUT /timetable/{id}` with `teacherId` updates teacher; with `subjectId` updates subject; with both updates both; with neither returns 400
- [ ] `DELETE /timetable/{id}` soft-deletes; slot no longer in GET results; attendance records with that timeslotid remain intact
- [ ] `PUT /timetable/{id}/end` returns 404
- [ ] Teacher can record attendance if ANY non-deleted timeslot exists for that classId (no `effectiveto` check)
- [ ] Teacher can access `GET /attendance/summary` if ANY non-deleted timeslot exists for that classId
- [ ] Migration 008 runs on existing tenants without data loss
- [ ] Unique constraint enforced: cannot create duplicate (tenantid, classid, dayofweek, periodnumber) among non-deleted slots

***

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
- **v4.3 (2026-03-07): CR-31 timeslot simplification — effectiveFrom/effectiveTo columns dropped, PUT /timetable/{id}/end removed, PUT /timetable/{id} and DELETE /timetable/{id} added, teacher auth simplified. 4 breaking changes. Migration 008. CR-24 retired.**

***

**END OF FREEZE v4.3**
