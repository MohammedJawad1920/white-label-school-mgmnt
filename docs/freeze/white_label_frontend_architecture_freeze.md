# FRONTEND PROJECT FREEZE
**White-Label School Management System**

---

**Version:** 1.6 (IMMUTABLE)  
**Date:** 2026-03-07  
**Status:** APPROVED FOR EXECUTION  
**Supersedes:** v1.5 (2026-03-05)  
**Backend Freeze:** v4.2 (2026-03-07)  
**OpenAPI:** v4.2.0

---

## CRITICAL INSTRUCTION FOR EXECUTION (HUMAN OR AI)

This document is the **Absolute Source of Truth**. v1.5 is **SUPERSEDED**.

You have **NO authority** to modify routes, API assumptions, or constraints defined below.

If any request contradicts this document, you must **REFUSE** and open a **Change Request** instead.

---

## CHANGE SUMMARY: v1.5 → v1.6

### Change Requests Applied

| CR | Title | Type | Impact |
|----|-------|------|--------|
| **CR-FE-012** | Timetable End Assignment dialog - effectiveTo field | Additive | Timetable screen |
| **CR-FE-013a** | Version sync: Backend v4.0 → v4.2, OpenAPI v4.0.0 → v4.2.0 | Breaking | Freeze header |
| **CR-FE-013b** | Bulk delete paths corrected: `POST /*/bulk-delete` → `POST /*/bulk` | Breaking | Users, Students, Classes, Batches, Subjects screens |
| **CR-FE-013c** | Attendance Summary screen - replace `GET /students/{id}/attendance` with `GET /students/{id}/attendance/summary?year=&month=` | Breaking | Attendance Summary screen |
| **CR-FE-013d** | Empty-state guard fix: `summary.totalRecords` → `summary.totalClasses` | Breaking | Attendance Summary screen |
| **CR-FE-013e** | CorrectAttendanceRequest type - `correctedStatus`, `correctedBy`, `correctedAt` nullable | Clarification | Type definitions |
| **CR-FE-013f** | NO list addition: `GET /attendance/summary` (class-level aggregate) deferred to future | Additive | NO list |
| **CR-FE-013g** | TenantFeature schema - restore `featureName` and `featureDescription` fields | Breaking | Feature Flags screen, Type definitions |

### Backend Contract Sync

- Backend Freeze: **v4.0 → v4.2**
- OpenAPI: **4.0.0 → 4.2.0**
- Backend CRs triggering frontend changes: CR-24, CR-25, CR-26, CR-27, CR-28, CR-29, CR-30

### What Changed

**Breaking changes:**
- **All bulk delete endpoints** now use `POST /*/bulk` (was `POST /*/bulk-delete`) — affects Users, Students, Classes, Batches, Subjects management screens (CR-FE-013b)
- **Attendance Summary screen** now calls `GET /students/{studentId}/attendance/summary?year={year}&month={month}` (was `GET /students/{studentId}/attendance?from={YYYY-MM-01}&to={YYYY-MM-DD}&limit=50` consuming `response.summary`) — different endpoint, different query params, dedicated response object (CR-FE-013c)
- **Attendance Summary empty-state guard** now checks `summary.totalClasses === 0` (was `summary.totalRecords === 0` — field never existed, bug fix) (CR-FE-013d)
- **TenantFeature schema** now includes `featureName: string` and `featureDescription: string` — previously missing in OpenAPI v4.0.0, restored in v4.2.0 (CR-FE-013g). Feature Flags screen now renders `featureName` as display label instead of raw `featureKey`.

**Additive changes:**
- **Timetable End Assignment dialog** now includes `effectiveTo` date input (required) with default set to today (CR-FE-012)
- `AttendanceRecord` TypeScript type clarified: `correctedStatus`, `correctedBy`, `correctedAt` are nullable (always were, now explicitly documented) (CR-FE-013e)
- `GET /attendance/summary` (class-level aggregate) added to NO list — backend-available endpoint deferred to future frontend CR, not in MVP scope (CR-FE-013f)

### Timeline Impact

- CR-FE-012: +0.5 days (single field, validation, UI update)
- CR-FE-013b: +1 day (5 screens, API path updates)
- CR-FE-013c, CR-FE-013d: +0.5 days (1 screen, endpoint swap, guard fix)
- CR-FE-013g: +0.5 days (1 screen, type update, render logic)
- **New total: 9–13 weeks + 7.5 days**

---

## 0. COMMERCIALS (Accept-and-price)

**Engagement Type:** Fixed-scope  
**Chosen Package:** Standard  
**Price:** Self-funded solo project (no external billing)  
**Payment Schedule:** N/A  
**Timeline Range (weeks):** 9–13 + 7.5 days  

### Assumptions (must be true)
- Solo developer is single decision maker
- Backend v4.2 available at staging by Week 3
- Prism mock used until backend ready

### Support Window (post-delivery)
- **Bugfix support:** 30 days
- **Enhancements:** billed as Change Requests

---

## 1. THE IRON SCOPE (Frontend only)

### Core Value Proposition (One Sentence)

A web frontend for a white-label school management SaaS, enabling teachers to record attendance, students to view their own schedules and attendance, and admins to manage timetables and school configuration — delivered as a mobile-first SPA on Cloudflare Pages.

### The 12 Frontend User Stories (COMPLETE SCOPE)

1. As a tenant user (Teacher, Admin, or Student), I can **log in with email/loginId, password, and school ID**, so that I access only my school's data.
2. As a Teacher, I can **see today's own assigned classes on a role-specific dashboard** and navigate to record attendance.
3. As an Admin, I can **see today's full schedule with a stat summary bar** on a role-specific dashboard.
4. As a Student, I can **see today's school-wide timetable (read-only) and my own attendance history** on my dashboard.
5. As a Teacher or Admin, I can **view the full timetable grid** — Admin can add a slot by clicking an empty cell and end an assignment by clicking a filled cell (CR-FE-012: with `effectiveTo` date input).
6. As a Teacher or Admin, I can **record attendance for a class period** by selecting statuses for each student.
7. As an Admin, I can **view a student's full attendance history** and correct an individual record (with `originalStatus` preserved).
8. As an Admin, I can **view a monthly attendance summary** for a student (CR-FE-013c: using dedicated `/attendance/summary` endpoint).
9. As an Admin, I can **manage users (Teacher/Admin roles only), students (with auto login account creation via admission number + date of birth), classes (including year-end promotion and graduation), batches, subjects, and school periods** (CR-FE-013b: bulk delete via `POST /*/bulk`).
10. As a multi-role user, I can **switch my active role via a dropdown** — the sidebar and dashboard immediately reflect only pages relevant to that role.
11. As a SuperAdmin, I can **manage tenants** (create with admin block and timezone, update, deactivate, reactivate) and their **feature flags** from an isolated portal (CR-FE-013g: display `featureName`, not raw `featureKey`).
12. As an Admin, I can **promote all students from one class to another OR graduate them** at year-end via a confirmation dialog.

### The NO List (Explicitly Out of Scope)

- No forgot password / password reset flow (admin resets via DB or automatic "Reset Login" on DOB/admissionNumber update)
- No parent portal or parent role
- No real-time updates (no WebSocket, no polling)
- No CSV bulk import UI
- No audit log viewer UI
- No custom branding/theme UI (no logo upload, no color picker)
- No multi-language / i18n (English only)
- No charts or graph visualizations (summary tables only)
- No inline timetable slot edit (no `PUT /timetable/{id}` in contract; "End Assignment" via popover only, CR-FE-012: with `effectiveTo` input)
- No `PUT /features/{featureKey}` from tenant app (deprecated since v3.2, returns 403)
- No SSR/SEO (login-gated SPA)
- No analytics or telemetry
- No SuperAdmin self-registration screen
- No JWT token blacklist / forced session invalidation UI
- No SuperAdmin tenant hard-delete (deactivate/reactivate only)
- No student-to-user manual linking (auto-created via `POST /students` since v3.5)
- No `PUT /students/{id}/link-account` in any frontend flow (deprecated endpoint, migration-only on backend)
- No attendance submission status on Admin dashboard (Admin navigates to "Record Attendance" screen to check)
- No year-end class promotion dedicated route (inline dialog in `/manage/classes` only)
- No student profile fields beyond school data (no photo, address, guardian contact)
- **No `GET /attendance/summary` class-level aggregate screen (CR-FE-013f)** — backend endpoint exists (returns `totalStudents`, `totalClasses`, `averageAttendanceRate` for a class over a date range), but **deferred to future frontend CR**. Admin dashboard stat bar remains timetable-derived (scheduled/unassigned period counts), not attendance-derived.

### User Roles (UI behavior truth)

| activeRole | Sidebar Items | Key Restrictions |
|------------|---------------|------------------|
| **Teacher** | Dashboard, Timetable, Record Attendance | Timetable read-only; no attendance summary/history |
| **Admin** | Dashboard, Timetable, Attendance Summary, Attendance History, Manage (Users, Students, Classes, Batches, Subjects, School Periods) | Users page shows Teacher/Admin only; Students page shows Student accounts; Edit Roles shown for self with `LASTADMIN` inline guard |
| **Student** | Dashboard, Timetable | Timetable read-only; Attendance self-view read-only; no record/manage actions |
| **SuperAdmin** | *Isolated portal:* Tenants, Feature Flags | No tenant app access whatsoever |

**Role switcher** shown only when `user.roles.length > 1`.

### Success Definition (measurable)

1. Teacher can log in, view own classes, and record attendance end-to-end against live backend.
2. Admin can create a timetable entry by clicking an empty cell, correct an attendance record, create a student (auto-provisioned login account), promote/graduate a class, and bulk-delete users (CR-FE-013b: via `POST /*/bulk`).
3. Student can log in with `loginId`, view today's timetable, and view own attendance history.
4. Multi-role (Teacher+Admin) user switches roles via dropdown — sidebar changes immediately, no page reload.
5. SuperAdmin can create a tenant (with admin block and timezone), reactivate an inactive tenant, and toggle feature flags (CR-FE-013g: sees `featureName` labels).
6. All 16 screens pass WCAG 2.1 AA automated checks (axe-core) + Lighthouse mobile ≥85 on dashboard and `/attendance/record`.

---

## 1.2 ASSUMPTIONS / EXTERNAL DEPENDENCIES

### Primary Backend/API

**White-Label School Management System:**
- **Dev:** `http://localhost:3000/api`
- **Mock:** `http://localhost:4010/api` (Prism)
- **Staging/Prod:** `VITE_API_BASE_URL` from env

### Design Source

**None** (no Figma). Tailwind CSS v3 + shadcn/ui. CR-FE-003 visual rules locked in Section 5.

---

## 1.2 ASSUMPTIONS / EXTERNAL DEPENDENCIES — Required Backend Inputs (LOCKED)

### Backend Freeze Doc version

**v4.2 (2026-03-07)**

### OpenAPI Contract File (REQUIRED)

- **File name:** `openapi.yaml`
- **Version:** 4.2.0
- **Location:** `.docs/openapi.yaml`

### Contract immutability rule

- Frontend **MUST NOT** invent endpoints, fields, status codes, or error shapes not present in OpenAPI 4.2.0.
- Any new UI need → backend Change Request → new backend Freeze version + updated OpenAPI → **then** frontend Change Request.

### External Dependencies

**None**

---

## 1.5 FRONTEND CONFIGURATION (The Environment)

### Tenant App

```bash
# .env.example
VITE_APP_ENV=development # development | staging | production
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_BASE_URL=http://localhost:5173
VITE_APP_NAME=School Management
```

### SuperAdmin Portal

```bash
# .env.example
VITE_APP_ENV=development
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_BASE_URL=http://localhost:5174
VITE_APP_NAME=Platform Admin
```

### Configuration Rules

- `VITE_API_BASE_URL` must be set per environment (no hardcoded URLs in source).
- No secrets in frontend env — all values are public (build-time only).
- Tenant app and SuperAdmin portal are **separate Vite projects** with separate `.env` files.

---

## 1.6 TECH STACK (Key Libraries) — Frontend toolbelt

| Concern | Library / Version |
|---------|-------------------|
| **Framework** | React 18.x |
| **Build tool** | Vite 5.x |
| **Language** | TypeScript 5.x (strict mode) |
| **Routing** | React Router v6.x |
| **Data fetching/caching** | TanStack Query v5.x |
| **Forms/validation** | react-hook-form + zod (latest stable) |
| **UI components** | shadcn/ui (latest stable) |
| **Styling** | Tailwind CSS v3.x |
| **Date handling** | date-fns v3.x |
| **HTTP client** | axios v1.x (typed interceptors) |
| **Icons** | lucide-react (latest stable) |

### Routing mode

**SPA** (React Router v6)

### Auth gating

**Protected route wrapper + role guard.**
- Unauthenticated → redirect `/login`.
- Wrong `activeRole` for route → inline: *"Not authorized for current role. Switch to {Role} to access this page."* (no redirect).

### Explicitly Banned

- No Redux or Zustand
- No jQuery, no Moment.js
- No `dangerouslySetInnerHTML`
- No inline styles (Tailwind classes only)
- No class components (hooks only)
- No direct `fetch` calls outside `src/api`
- No prop drilling beyond 2 levels
- No hardcoded tenant slugs, IDs, or API URLs in component files

---

## 2. ROUTES, SCREENS, AND NAVIGATION (UI truth)

### Route Map — Tenant App (`app.yourdomain.com`)

| Route | Screen | Auth | activeRole |
|-------|--------|------|------------|
| `/login` | Tenant Login | Public | — |
| `/` (dashboard) | Dashboard | Protected | Teacher, Admin, Student |
| `/timetable` | Timetable | Protected | Teacher (read), Admin (r/w), Student (read) |
| `/attendance/record` | Record Attendance | Protected | Teacher, Admin |
| `/attendance/summary` | Attendance Summary | Protected | Admin only |
| `/students/{studentId}/attendance` | Student Attendance History | Protected | Admin only; Student self-view (pending CG-01 backend CR) |
| `/manage/users` | User Management | Protected | Admin only |
| `/manage/students` | Student Management | Protected | Admin only |
| `/manage/classes` | Class Management | Protected | Admin only |
| `/manage/batches` | Batch Management | Protected | Admin only |
| `/manage/subjects` | Subject Management | Protected | Admin only |
| `/manage/school-periods` | School Periods | Protected | Admin only |
| `/privacy` | Privacy Policy | Public | — |
| `/terms` | Terms of Service | Public | — |

**Total screens:** 16

### Route Map — SuperAdmin Portal (`admin.yourdomain.com`)

| Route | Screen | Auth | Role |
|-------|--------|------|------|
| `/login` | SuperAdmin Login | Public | — |
| `/tenants` | Tenant Management | Protected | SuperAdmin only |
| `/tenants/{tenantId}/features` | Tenant Feature Flags | Protected | SuperAdmin only |

**Total screens:** 16 (tenant + SuperAdmin)

---

## 2.1 SCREEN SPECIFICATIONS

### Screen: Tenant Login

**Goal:** Authenticate tenant user, store JWT, handle all error cases.

**API calls:**
1. `POST /auth/login`
   - `200` → store `token` + `user` in `localStorage.auth`, redirect `/` (dashboard)
   - `401` → "Invalid email or password."
   - `403 TENANT_INACTIVE` → "This school account has been deactivated. Contact your platform administrator."
   - `404` → "School not found. Check the school ID and try again."
   - `400` → field-level errors from `error.details`.

**Local state:** form fields, `submitting` boolean, `globalError` string | null

**Server state:** None (form POST only, no TanStack Query)

**Loading:** Submit button spinner, disabled

**Form validation:**
- `email`: `z.string().min(1)` (NOT `.email()` — student loginIds like `530@school.local` are pseudo-emails exempt from RFC 5322)
- `password`: required, minLength 8
- `tenantSlug`: required, minLength 1, maxLength 100

**Field placeholder:** email field → `"Email or Student Login ID"`

**Permissions:** Public. Already authenticated → redirect `/` (dashboard).

**A11y:** `htmlFor` labels, `aria-describedby` on error messages, autofocus on email, submit on Enter.

---

### Screen: Dashboard

**Goal:** Role-specific view of today's schedule with relevant CTAs.

**API calls:**
1. `GET /timetable?date={today}`
   - `200` → render per-role content
   - `403 FEATURE_DISABLED` → full-page "Timetable feature not enabled"
   - `401` → session expiry flow.
2. **Student only:** `GET /students/{studentId}/attendance?from={30daysAgo}&to={today}&limit=10`
   - `200` → render recent attendance list
   - `403 STUDENT_ACCESS_DENIED` → show CG-01 placeholder (pending backend CR for `studentId` discovery).

**Server state:**
- TQ key: `['timetable', 'today', isoDate]`. Stale: 5 min. Refetch on focus.
- TQ key: `['student-attendance', studentId, from, to]` (Student only). Stale: 5 min.

**Loading:** 3 skeleton slot cards.

**Role-specific content:**
- **Teacher:** Filter client-side: `slot.teacherId === currentUser.id`. Slot cards with "Record Attendance" CTA → `/attendance/record` with `state.slotId`. Empty: "No classes assigned to you today."
- **Admin:** All slots. Stat summary bar: "Total Periods: {N} | Scheduled: {N} | Unassigned: {N}" (derived client-side from timetable data). No record CTA. Empty: "No classes scheduled for today."
- **Student:** All slots (read-only). Below timetable: recent attendance list (last 10 records, read-only). If CG-01 backend CR unresolved: placeholder — "My Attendance (coming soon). Contact your admin for your attendance records."

**A11y:** Each slot card is `<article>`. "Record Attendance" button `aria-label="Record attendance for {className} – {subjectName} (Period {n})"`.

---

### Screen: Timetable

**Goal:** Full timetable grid. Admin: inline cell interactions (CR-FE-012: End Assignment with `effectiveTo` input). Teacher/Student: read-only.

**API calls:**
1. `GET /timetable?status=Active`
   - `200` → render grid
   - `403 FEATURE_DISABLED` → full-page gate.
2. `GET /school-periods`
   - `200` → column headers
   - `403` → inline "School periods not configured."
3. **Admin:** `POST /timetable`
   - `201` → invalidate `['timetable', filters]`, close drawer, toast "Slot created."
   - `400 PERIOD_NOT_CONFIGURED` → inline "Period {n} not configured."
   - `409` → "Slot already occupied."
   - `403` → toast.
4. **Admin:** `PUT /timetable/{id}/end` **(CR-FE-012: body now includes `effectiveTo: string (YYYY-MM-DD)`)**
   - `200` → invalidate `['timetable']`, close popover, toast "Assignment ended."
   - `404/403` → toast.

**Local state:** `selectedFilters`, `activeCell: { dayOfWeek: string, periodNumber: number } | null`, `activeSlotId: string | null`, `endDialogSlotId: string | null` **(CR-FE-012)**

**Server state:** TQ keys: `['timetable', filters]`, `['school-periods']`. Stale: 5 min.

**Loading:** Full grid skeleton. Empty: "No timetable entries found." Admin hint: "Click an empty cell to add a slot."

**Cell interactions:**
- **Empty cell (Admin):** hover `bg-muted/30 border-dashed` + icon → click → `setActiveCell({dayOfWeek, periodNumber})` → create drawer. Fields: `classId` (select, required), `subjectId` (select, required), `teacherId` (select Teacher-role users, required), `effectiveFrom` (date, required) — `dayOfWeek`/`periodNumber` pre-filled (read-only). CR-FE-011: If `selectedFilters.classId` or `selectedFilters.teacherId` is set, pre-fill those fields as well (editable, not locked).
- **Filled cell (Admin):** click → `setActiveSlotId(slot.id)` → Popover with subject/teacher/class/dates → **"End Assignment"** → **CR-FE-012: Dialog with `effectiveTo` date input (required, default: today) → Confirm → `PUT /timetable/{id}/end` with body `{ effectiveTo: "YYYY-MM-DD" }`**.
- **Teacher/Student:** cells non-interactive, plain read-only display.

**Form validation (create):**
- `classId`: required
- `subjectId`: required
- `teacherId`: required
- `dayOfWeek`: pre-filled (read-only)
- `periodNumber`: pre-filled (read-only), integer ≥1
- `effectiveFrom`: required, YYYY-MM-DD, UX warn if past (not API-enforced).

**Form validation (end assignment - CR-FE-012):**
- `effectiveTo`: required, YYYY-MM-DD, UX warn if past (not API-enforced). Default value: today's date.

**A11y:** `role="grid"`, `role="row"`, `role="gridcell"`. Empty clickable cells: `aria-label="Add slot for {dayOfWeek} Period {n}"`. Drawers/dialogs trap focus, Escape closes.

**Performance:** `overflow-x-auto` on mobile. No virtualization needed (7 days × ≤15 periods).

---

### Screen: Record Attendance

**Goal:** Record attendance for all students in a selected class period.

**API calls:**
1. **Teacher:** `GET /timetable?teacherId={currentUser.id}&date={today}`  
   **Admin:** `GET /timetable?date={today}`
2. `GET /students?classId={selectedClassId}&limit=200`
3. **CR-FE-010:** Per-student pre-fetch: `GET /students/{studentId}/attendance?from={date}&to={date}&limit=10` (enabled when `selectedSlotId` is set) — auto-detect `alreadyRecorded` if any record matches `selectedSlotId`.
4. **New (create mode):** `POST /attendance/record-class`
   - `201` → toast "{recorded} records saved. ({present} present, {absent} absent, {late} late)."
   - `400 FUTURE_DATE` → inline error
   - `409 CONFLICT` / `ATTENDANCE_ALREADY_RECORDED` → set `alreadyRecorded = true` (silently switch to update mode)
   - `403 FEATURE_DISABLED` → full-page gate
   - `403` (not-assigned) → toast.
5. **Update mode (CR-FE-010):** Parallel `PUT /attendance/{recordId}` for each changed student
   - `200` → invalidate `['student-attendance']`, toast "Attendance updated for {N} student(s)."
   - `400 SAME_STATUS` → inline (per-student, no change needed)
   - `400 FUTURE_DATE` → inline

**Local state:** `selectedTimeSlotId`, `selectedDate` (default: today), `defaultStatus`, `exceptions: Map<studentId, AttendanceStatus>`, `submitError`, `successMsg`, `alreadyRecorded: boolean`

**Server state:**
- TQ keys: `['timetable', myToday]`, `['students', classId, id]`, `['student-attendance', studentId, date, 'correction']` (per-student queries). On 201 or update success → invalidate `['attendance']`.

**Loading:** Student list skeleton (10 rows). Empty: "No students found in this class."

**Pre-fetch detection (CR-FE-010):**
- `useQueries` fires per-student history queries when slot selected.
- `useEffect` watches results → if any record matches `selectedSlotId` → `setAlreadyRecorded(true)`.
- Auto-seed: when `alreadyRecorded` flips true → compute most common existing status as new `defaultStatus`, seed `exceptions` only for students who differ.

**Single action button:**
```tsx
{alreadyRecorded ? "Update Attendance for N Student(s)" : "Save Attendance for N Student(s)"}
```
- Shows "Checking…" spinner while `correctionLoading` is true.
- **Update mode:** calls parallel `PUT /attendance/{recordId}` only for changed records. If `calls.length === 0` → "No changes to save."

**Form validation:**
- `timeSlotId`: required
- `date`: required, not future
- `defaultStatus`: required, enum `Present|Absent|Late`

**Permissions:** Teacher: own slots only. Admin: all slots. Student (direct URL): inline "Not authorized for current role."

**A11y:** Each student row: `role="radiogroup"` with `aria-label="{studentName} attendance status"`.

**Performance:** `exceptions` as `Map` for O(1) lookup. `limit=200` is OpenAPI max.

---

### Screen: Student Attendance History

**Goal:** Paginated attendance records for a student. Admin can correct individual records.

**API calls:**
1. `GET /students/{studentId}/attendance?from={from}&to={to}&limit={limit}&offset={offset}`
   - `200` → table + student header
   - `404` → "Student not found."
   - `403 STUDENT_ACCESS_DENIED` → "You do not have access to this student's records."
2. **Admin:** `PUT /attendance/{recordId}`
   - Body: `{ correctedStatus: "Present" | "Absent" | "Late" }` (CR-FE-013e: type clarification — `correctedStatus`, `correctedBy`, `correctedAt` are nullable in response)
   - `200` → invalidate `['student-attendance', studentId]`, toast "Attendance corrected."
   - `400 SAME_STATUS` → inline "Status is already {status} — no change needed."
   - `400 FUTURE_DATE` → inline "Cannot correct a future record."
   - `403/404` → toast.

**Local state:** `dateFrom`, `dateTo`, `page`, `correctingRecordId: string | null`, `correctionStatus: string`

**Server state:** TQ key: `['student-attendance', studentId, from, to, page]`. Stale: 2 min.

**Loading:** Table skeleton (10 rows). Empty: "No attendance records found for this period."

**Correction:**
- Table columns: Date | Subject | Period | **originalStatus** (badge, never changes) | **status** (effective badge) | Corrected By | Action (Admin only).
- `originalStatus` always visible — immutable audit trail.
- Response `AttendanceRecord`: `correctedStatus`, `correctedBy`, `correctedAt` are nullable (CR-FE-013e).

**Form validation (correction):**
- `correctedStatus`: required, enum `Present|Absent|Late`, must differ from current effective status (client guard + server `400 SAME_STATUS`).

**Permissions:** Admin: any student in tenant. Student: own record only (pending CG-01 backend CR). Others: inline "Not authorized for current role."

**A11y:** Table caption with student name. Correction select: `aria-label="Correct attendance status for {date} Period {n}"`.

**Performance:** Server-side pagination, limit 50.

---

### Screen: Attendance Summary

**Goal:** Monthly summary for a student **(CR-FE-013c: using dedicated `/attendance/summary` endpoint)**.

**API calls:**
- **CR-FE-013c:** `GET /students/{studentId}/attendance/summary?year={YYYY}&month={1-12}`
  - `200` → `{ summary: AttendanceSummary }` where `AttendanceSummary` is:
    ```ts
    {
      studentId: string
      year: number
      month: number
      totalClasses: number
      present: number
      absent: number
      late: number
      attendancePercentage: number
    }
    ```
  - `403` → "Not authorized."
  - `404` → "Student not found."

**Local state:** `selectedStudentId`, `selectedYear: number`, `selectedMonth: number (1-12)` (default: current month/year)

**Server state:** TQ key: `['student-attendance-summary', studentId, year, month]`. Stale: 5 min.

**Loading:** Summary card skeleton. **Empty:** `"No attendance data for {month} {year}."` (when **CR-FE-013d:** `summary.totalClasses === 0` — was `summary.totalRecords` which never existed, now fixed).

**Form validation:**
- `studentId`: required
- `year`: required, integer, not future year
- `month`: required, integer 1-12, not future month (when combined with year).

**Permissions:** Admin only.

---

### Screen: User Management (`/manage/users`)

**Goal:** List, create, update roles, and delete Teacher/Admin users. Student-role users NOT shown here.

**API calls:**
1. `GET /users?role={filter}&search={q}` (Student-role excluded automatically; role filter enum: `Teacher | Admin` only).
2. `POST /users`
   - `201` → invalidate `['users']`
   - `409` → "Email already exists."
   - `400 INVALID_ROLE` → "Student accounts must be created via the Students page."
   - `400` → field errors.
3. **CR-FE-009a:** `password` is now **optional**. If omitted, backend returns `temporaryPassword: string`. Show **one-time modal** with copy button: *"Temporary password: `{value}` — copy it now, it will not be shown again."*
4. `PUT /users/{id}/roles`
   - `200` → invalidate
   - `403 LAST_ADMIN` → inline in role edit drawer: "Cannot remove Admin role — you are the last admin of this school."
   - `404` → toast.
5. **CR-FE-013b:** `POST /users/bulk` (was `POST /users/bulk-delete`)
   - Body: `{ userIds: string[] }`
   - `200` → `{ deletedCount: number }` (was `result` object with per-item failures — OpenAPI v4.2.0 simplified)
6. `DELETE /users/{id}`
   - `204` → toast
   - `409` → "Cannot delete — user has active records."

**Local state:** `selectedIds: Set<string>`, `createDrawerOpen`, `roleEditUserId`, `searchQuery`, `roleFilter`, `showTempPasswordModal: boolean`, `tempPassword: string | null`

**Server state:** TQ key: `['users', roleFilter, searchQuery]`. Stale: 2 min.

**Loading:** Table skeleton (10 rows). Empty: "No users found."

**Form validation (create):**
- `name`: required, max 255
- `email`: required, valid
- `password`: **optional** (CR-FE-009a), min 8 when provided
- `roles`: required (≥1), values in `[Teacher, Admin]` only.

**Form validation (update roles):**
- `roles`: required, non-empty, values in `[Teacher, Admin]`, no duplicates.

**Permissions:** "Edit Roles" button shown for ALL users (including current user — isSelf guard REMOVED per CR-12). `403 LAST_ADMIN` inline error in drawer (not toast). Delete button hidden for current user.

**A11y:** Checkbox rows: `aria-label="Select {userName}"`. Bulk bar: `aria-live="polite"`. `LAST_ADMIN` inline error: `role="alert"`.

---

### Screen: Student Management (`/manage/students`)

**Goal:** List, create, update, and delete students. Each student auto-has a login account.

**API calls:**
1. `GET /students?classId={}&batchId={}&status={}&search={}&limit=50&offset=0`
2. `POST /students`
   - `201` → toast "Student created. Login ID: {loginId}"
   - `409 ADMISSION_NUMBER_CONFLICT` → inline
   - `400 CLASS_BATCH_MISMATCH` → inline.
3. `PUT /students/{id}`
   - **CR-FE-009c:** `status` field added. Dropdown shows `Active | Dropped Off` (maps to `DroppedOff`) only — `Graduated` **never shown** (backend rejects with 400).
   - `200` → invalidate
   - `409 ADMISSION_NUMBER_CONFLICT` → inline
   - `400/404` → toast.
4. **CR-FE-013b:** `POST /students/bulk` (was `POST /students/bulk-delete`)
   - `200` → `{ deletedCount: number }`
5. `DELETE /students/{id}`
   - `204`
   - `409` → "Cannot delete — student has attendance records."

**Local state:** `selectedIds: Set<string>`, `createDrawerOpen`, `editStudentId: string | null`, `searchQuery`, `statusFilter: 'Active' | 'DroppedOff' | 'Graduated' | undefined`

**Server state:** TQ key: `['students']`. Stale: 2 min.

**Loading:** Table skeleton (10 rows). Empty: "No students found."

**Table columns (CR-FE-009c):**
- Name | Class | Batch | Admission No. | Date of Birth | **Status** (badge: Active → green, DroppedOff → red, Graduated → purple/muted) | Login ID (read-only `<code>`, copy button) | Actions

**Login ID display:**
- Read-only `<code>`. Copy-to-clipboard button. Tooltip: "Share this login ID with the student. Password is their admission number + date of birth (DDMMYYYY)."

**Form validation (create):**
- `name`: required, max 255
- `classId`: required
- `batchId`: required, must match `class.batchId`
- `admissionNumber`: required, max 50
- `dob`: required, YYYY-MM-DD
- No `email` or `password` field.

**Form validation (edit):**
- All fields optional.
- If `dob` or `admissionNumber` touched → warning tooltip: "Changing this will reset the student's login password."
- **CR-FE-009c:** `status` select → `Active | Dropped Off` (not `Graduated`).

**Permissions:** Admin only.

**A11y:** Login ID copy button: `aria-label="Copy login ID for {studentName}"`. DOB/admission fields: `aria-describedby` pointing to reset-password warning.

**Performance:** Virtualize rows if >200 students.

---

### Screen: Class Management (`/manage/classes`)

**Goal:** List, create, delete classes. Year-end student promotion OR graduation via inline dialog.

**API calls:**
1. `GET /classes`
   - `200` → list.
2. `POST /classes`
   - `201` → invalidate `['classes']`.
3. **CR-FE-013b:** `POST /classes/bulk` (was `POST /classes/bulk-delete`)
   - `200` → `{ deletedCount: number }`
4. `DELETE /classes/{id}`
   - `204`
   - `409` → "Cannot delete — students enrolled."
5. **CR-FE-009b:** `PUT /classes/{sourceClassId}/promote`
   - **Body:** `{ targetClassId: string } | { action: "graduate" }`
   - `200` → invalidate `['students']` + `['classes']`, toast per type:
     - Promote: `"{N} students promoted to {targetClass}."`
     - Graduate: `"{N} students graduated."`
   - `400 SAME_CLASS` → inline "Source and target class cannot be the same."
   - `400 INVALID_PROMOTION_ACTION` → inline "Provide either targetClassId or action: 'graduate'."
   - `404` → toast.

**Promote action (per row, Admin only):**
- Button disabled with tooltip "No students to promote." if class has 0 students.
- Click → Dialog:
  - Source class pre-filled (read-only)
  - **CR-FE-009b:** Two mutually exclusive options:
    ```
    ◉ Move to another class   [target class select — required when selected, source excluded]
    ○ Graduate all students   [no additional input]
    ```
  - Confirm text:
    - Move: `"Move all students from {sourceClass} to {targetClass}? This cannot be undone."`
    - Graduate: `"This will graduate all active students from {sourceClass}. They will be removed from the class. This cannot be undone."`
  - Submit: `PUT /classes/{sourceClassId}/promote` with `{ targetClassId }` or `{ action: "graduate" }`.

**Local state:** `createDrawerOpen`, `promoteSourceClassId: string | null`, `promoteTargetClassId: string`, `promoteMode: 'move' | 'graduate'`, `promoteError: string | null`

**Server state:** TQ key: `['classes']`. Stale: 5 min.

**A11y:** Promote dialog: focus trap. Confirm button `aria-describedby` warning text. Escape cancels.

---

### Screens: Batch & Subject Management

**Screen:** Route → TQ Key → Create Fields → Key 409

| Screen | Route | TQ Key | Create Fields | Bulk Delete Endpoint (CR-FE-013b) | Key 409 |
|--------|-------|--------|---------------|----------------------------------|---------|
| **Batches** | `/manage/batches` | `['batches']` | `name` (max 100), `startYear`, `endYear`, **`status: Active \| Graduated`** (CR-FE-009d — `Archived` removed) | **`POST /batches/bulk`** (was `/batches/bulk-delete`) | "Cannot delete — classes reference this batch" |
| **Subjects** | `/manage/subjects` | `['subjects']` | `name` (required, max 255), `code` (optional, max 50) | **`POST /subjects/bulk`** (was `/subjects/bulk-delete`) | "Cannot delete — timetable slots reference this subject" |

**CR-FE-009d (Batch Management):**
- Create/edit form: `status` select → `Active | Graduated` (remove `Archived`)
- Table status badge: `Graduated` → purple/muted (same as student status)
- Filter `GET /batches?status=`: enum updated to `Active | Graduated`
- Audit all fixtures/mocks/tests: replace `"Archived"` with `"Graduated"`

All: stale 5 min, skeleton, "No {entity} found.", create/edit drawer, **CR-FE-013b: bulk delete via `POST /*/bulk`**, single delete, Admin only.

---

### Screen: School Periods (`/manage/school-periods`)

**API calls:**
1. `GET /school-periods`
   - `200`
   - `403 FEATURE_DISABLED` → full-page gate.
2. `POST /school-periods`
   - `201` → invalidate
   - `409` → "Period number {n} already exists."
   - `400 PERIOD_TIME_INVALID` → "Start time must be before end time."
3. `PUT /school-periods/{id}`
   - `200` → invalidate
   - `400` → inline
   - `404` → toast.
4. `DELETE /school-periods/{id}`
   - `204` → invalidate `['school-periods']` AND `['timetable']`
   - `409 HAS_REFERENCES` → inline "Cannot delete — active timetable slots use this period."

**Local state:** `createDrawerOpen`, `editPeriodId`, `deleteConfirmPeriodId`

**Server state:** TQ key: `['school-periods']`. Stale: 5 min.

**Form validation:**
- `periodNumber`: required, integer ≥1, unique, **immutable after creation**
- `label`: optional, max 100
- `startTime`: required, HH:mm
- `endTime`: required, strictly after `startTime`.

**A11y:** `periodNumber` is `aria-disabled="true"` on edit with tooltip "Period number cannot be changed after creation."

---

### Screen: SuperAdmin Login

**API calls:**
- `POST /super-admin/auth/login`
  - `200` → store in `localStorage.sa-auth`, redirect `/tenants`
  - `401` → "Invalid email or password."
  - `400` → field errors.

**Form validation:**
- `email`: required, valid
- `password`: required, minLength 8.

**Permissions:** Public. Authenticated → redirect `/tenants`.

---

### Screen: Tenant Management (`/tenants`)

**Goal:** List, create, update, deactivate, reactivate tenants.

**API calls:**
1. `GET /super-admin/tenants?status={filter}&search={q}`
2. `POST /super-admin/tenants`
   - `201` → invalidate `['sa-tenants']`, toast "Tenant created."
   - `409 CONFLICT` → "Tenant ID or slug already exists."
   - `409 ADMIN_EMAIL_TAKEN` → "Admin email already exists."
   - `400` → field error.
3. `PUT /super-admin/tenants/{id}`
   - `200` → invalidate.
4. `PUT /super-admin/tenants/{id}/deactivate`
   - `200`
   - `409 ALREADY_INACTIVE` → "Tenant is already inactive."
5. `PUT /super-admin/tenants/{id}/reactivate`
   - `200` → toast "Tenant reactivated."
   - `409 ALREADY_ACTIVE` → "Tenant is already active."

**Local state:** `createDrawerOpen`, `editTenantId`, `deactivateConfirmId`, `reactivateConfirmId`, `searchQuery`, `statusFilter`

**Server state:** TQ key: `['sa-tenants', statusFilter, searchQuery]`. Stale: 1 min.

**Create form:**
- **Section 1:** `id` (required, alphanumeric+dash, max 50), `name` (required, max 255), `slug` (required, a-z0-9-, max 100), `timezone` (optional, default `Asia/Kolkata`, IANA select, date-fns powered)
- **Section 2:** `admin.name` (required, max 255), `admin.email` (required, valid), `admin.password` (required, minLength 8)

**Edit form:** `name`, `slug`, `timezone` — all optional.

**Row actions:** Active → Edit, Deactivate. Inactive → Edit, Reactivate.

**A11y:** Deactivate/Reactivate confirmations are `<Dialog>` with focus trap → Escape cancels.

---

### Screen: Tenant Feature Flags (`/tenants/{tenantId}/features`)

**Goal:** Toggle feature flags for a tenant **(CR-FE-013g: display `featureName` instead of raw `featureKey`)**.

**API calls:**
1. `GET /super-admin/tenants/{tenantId}/features`
   - `200` → `{ features: TenantFeature[] }` where **CR-FE-013g:** `TenantFeature` now includes:
     ```ts
     {
       id: string
       tenantId: string
       featureKey: string
       featureName: string         // NEW (CR-FE-013g) — human-readable label
       featureDescription: string  // NEW (CR-FE-013g) — descriptive text
       enabled: boolean
       enabledAt: string | null
     }
     ```
   - `404` → "Tenant not found."
2. `PUT /super-admin/tenants/{tenantId}/features/{featureKey}`
   - `200`
   - `400 FEATURE_DEPENDENCY` → revert optimistic toggle, inline "Attendance requires Timetable to be enabled first."
   - `404` → toast.

**Local state:** Optimistic toggle state per feature key.

**Server state:** TQ key: `['sa-features', tenantId]`. Stale: 30 sec.

**Rendering (CR-FE-013g):**
- Display **`featureName`** as primary label (e.g., "Timetable", "Attendance")
- Display **`featureDescription`** as secondary text below toggle
- `featureKey` remains internal identifier only (not rendered in UI)

**Permissions:** `attendance` toggle disabled/greyed when `timetable` is disabled.

**A11y:** `role="switch"`, `aria-checked`, **CR-FE-013g:** `aria-label="{featureName}"` (not `featureKey`).

---

### Static Screens: Privacy / Terms

**Privacy:** Covers DPDPA 2023 (data collected, purpose, retention, user rights, contact)  
**Terms:** Public. Hardcoded text.

---

## 3. API ASSUMPTIONS (Frontend contract expectations)

### 3.0 Backend Contract Link (LOCKED)

**Backend Freeze version:** v4.2 (2026-03-07)  
**OpenAPI file:** `openapi.yaml`  
**OpenAPI version:** 4.2.0  
**File path:** `.docs/openapi.yaml`

**Base URL:** `VITE_API_BASE_URL` from env (never hardcoded).

**Auth:** Bearer JWT. Header: `Authorization: Bearer {token}`.  
**Storage:** `localStorage.auth` (tenant), `localStorage.sa-auth` (SuperAdmin).

**Global error shape MUST match OpenAPI 4.2.0:**

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "timestamp": "2026-03-03T07:00:00Z"
  }
}
```

All error codes are **SNAKE_CASE** (standardized in v3.6 CR-14).

---

### 3.1 Mock Server (REQUIRED)

**Tool:** Prism (`@stoplight/prism-cli`)

```bash
npm install -g @stoplight/prism-cli
prism mock .docs/openapi.yaml --port 4010

# Set in .env:
VITE_API_BASE_URL=http://localhost:4010/api
```

**Failure simulation plan:**

| Scenario | Header | Endpoint |
|----------|--------|----------|
| Missing/invalid token | `Prefer: code=401` | Any protected endpoint |
| Inactive tenant login | `Prefer: code=403` | `POST /auth/login` |
| Period not configured | `Prefer: code=400` | `POST /timetable` |
| Duplicate email | `Prefer: code=409` | `POST /users` |
| Student role in `POST /users` | `Prefer: code=400` | `POST /users` |
| Duplicate admission number | `Prefer: code=409` | `POST /students` |
| Batch mismatch | `Prefer: code=400` | `POST /students` |
| Resource not found | `Prefer: code=404` | Any `/{id}` endpoint |
| Last admin guard | `Prefer: code=403` | `PUT /users/{id}/roles` |
| Same status correction | `Prefer: code=400` | `PUT /attendance/{recordId}` |
| Same class promotion | `Prefer: code=400` | `PUT /classes/{sourceClassId}/promote` |
| Student access denied | `Prefer: code=403` | `GET /students/{studentId}/attendance` |

---

### 3.2 Typed API Surface (MVP only — MUST match OpenAPI 4.2.0 exactly)

**CR-FE-009a, 009b, 009c, 009d, CR-FE-012, CR-FE-013c, CR-FE-013e, CR-FE-013g types:**

```ts
// ERRORS
interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
    timestamp: string
  }
}

// AUTH
type TenantRole = 'Teacher' | 'Admin' | 'Student'
type UserRole = 'Teacher' | 'Admin'

interface TenantUser {
  id: string
  tenantId: string
  name: string
  email: string
  roles: TenantRole[]
  activeRole: TenantRole
}

// USERS — CR-FE-009a
interface CreateUserRequest {
  name: string
  email: string
  password?: string  // was: required (CR-FE-009a — optional)
  roles: UserRole[]
}

interface CreateUserResponse {
  user: User
  temporaryPassword: string | null  // NEW (CR-FE-009a)
}

// STUDENTS — CR-FE-009c
type StudentStatus = 'Active' | 'DroppedOff' | 'Graduated'

interface Student {
  id: string
  name: string
  classId: string | null  // was: string (CR-FE-009c — nullable)
  className: string | null
  batchId: string
  batchName: string
  admissionNumber: string
  dob: string
  status: StudentStatus  // NEW (CR-FE-009c)
  loginId: string
  userId: string | null
}

interface UpdateStudentRequest {
  name?: string
  classId?: string
  batchId?: string
  admissionNumber?: string
  dob?: string
  status?: 'Active' | 'DroppedOff'  // NEW (CR-FE-009c) — Graduated excluded (never sent)
}

// BATCHES — CR-FE-009d
type BatchStatus = 'Active' | 'Graduated'  // was: 'Active' | 'Archived' (CR-FE-009d)

interface Batch {
  id: string
  name: string
  startYear: number
  endYear: number
  status: BatchStatus
  createdAt: string
  updatedAt: string
}

// CLASSES — CR-FE-009b
type PromoteRequest =
  | { targetClassId: string }
  | { action: 'graduate' }  // NEW (CR-FE-009b)

type PromoteResponse =
  | { updated: number; failed: Array<{id: string; reason: string}> }
  | { graduated: number; failed: Array<{id: string; reason: string}> }  // NEW (CR-FE-009b)

// TIMETABLE — CR-FE-012
interface EndAssignmentRequest {
  effectiveTo: string  // YYYY-MM-DD, required (CR-FE-012)
}

// ATTENDANCE — CR-FE-010, CR-FE-013c, CR-FE-013e
type AttendanceStatus = 'Present' | 'Absent' | 'Late'

interface AttendanceRecord {
  id: string
  date: string
  originalStatus: AttendanceStatus
  status: AttendanceStatus
  correctedBy: string | null  // CR-FE-013e: nullable (always was, now explicit)
  correctedAt: string | null   // CR-FE-013e: nullable
  timeSlot: TimeSlot
  recordedBy: string
  recordedAt: string
  // CR-FE-013e: correctedStatus field removed from schema (redundant — `status` is effective status)
}

interface CorrectAttendanceRequest {
  correctedStatus: AttendanceStatus  // CR-FE-013e: clarification — correctedBy/correctedAt auto-set by backend
}

// ATTENDANCE SUMMARY — CR-FE-013c
interface AttendanceSummary {
  studentId: string
  year: number
  month: number
  totalClasses: number     // CR-FE-013d: use this for empty-state guard (not totalRecords)
  present: number
  absent: number
  late: number
  attendancePercentage: number
}

// TENANT FEATURES — CR-FE-013g
interface TenantFeature {
  id: string
  tenantId: string
  featureKey: string
  featureName: string         // NEW (CR-FE-013g)
  featureDescription: string  // NEW (CR-FE-013g)
  enabled: boolean
  enabledAt: string | null
}

// BULK OPERATIONS — CR-FE-013b
interface BulkDeleteRequest {
  userIds?: string[]     // for POST /users/bulk
  studentIds?: string[]  // for POST /students/bulk
  classIds?: string[]    // for POST /classes/bulk
  batchIds?: string[]    // for POST /batches/bulk
  subjectIds?: string[]  // for POST /subjects/bulk
}

interface BulkDeleteResponse {
  deletedCount: number  // simplified in v4.2.0 (was per-item failure tracking)
}
```

---

### 3.3 Caching / Invalidation Rules (LOCKED — complete)

| TQ Key | Stale Time | Invalidated By |
|--------|------------|----------------|
| `['timetable', filters]` | 5 min | `POST /timetable`, `PUT /timetable/{id}/end`, `DELETE /school-periods/{id}` |
| `['timetable', 'today', isoDate]` | 5 min | Refetch on window focus |
| `['students']` | 2 min | `POST /students`, `PUT /students/{id}`, `DELETE /students/{id}`, **`POST /students/bulk`** (CR-FE-013b), `PUT /classes/{id}/promote` |
| `['students', classId, classId]` | 2 min | `POST /students`, `PUT /students/{id}`, `DELETE /students/{id}`, **`POST /students/bulk`** (CR-FE-013b) |
| `['users', roleFilter, searchQuery]` | 2 min | `POST /users`, `PUT /users/{id}/roles`, `DELETE /users/{id}`, **`POST /users/bulk`** (CR-FE-013b) |
| `['student-attendance', studentId, from, to, page]` | 2 min | `PUT /attendance/{recordId}` |
| `['student-attendance', studentId, from, to]` | 5 min | `PUT /attendance/{recordId}` |
| **`['student-attendance-summary', studentId, year, month]`** | 5 min | **(CR-FE-013c: NEW key)** — not invalidated by corrections (separate aggregate cache) |
| `['batches']` | 5 min | `POST /batches`, `PUT /batches/{id}`, `DELETE /batches/{id}`, **`POST /batches/bulk`** (CR-FE-013b) |
| `['classes']` | 5 min | `POST /classes`, `PUT /classes/{id}`, `DELETE /classes/{id}`, **`POST /classes/bulk`** (CR-FE-013b), `PUT /classes/{sourceClassId}/promote` |
| `['subjects']` | 5 min | `POST /subjects`, `PUT /subjects/{id}`, `DELETE /subjects/{id}`, **`POST /subjects/bulk`** (CR-FE-013b) |
| `['school-periods']` | 5 min | `POST /school-periods`, `PUT /school-periods/{id}`, `DELETE /school-periods/{id}` |
| `['sa-tenants', statusFilter, searchQuery]` | 1 min | `POST /super-admin/tenants`, `PUT /super-admin/tenants/{id}`, deactivate, reactivate |
| **`['sa-features', tenantId]`** | 30 sec | `PUT /super-admin/tenants/{tenantId}/features/{featureKey}` — **(CR-FE-013g: now returns `featureName` + `featureDescription`)** |

---

### 3.4 Retry Rules (LOCKED)

- **GET requests:** Retry up to 3 times, exponential backoff (1s, 2s, 4s).
- **Mutations (POST/PUT/DELETE):** Never retry automatically.
- **401:** Axios interceptor fires `window.CustomEvent('AUTH_EXPIRED')`, clears `localStorage.auth`, sets `isExpired = true` → `<SessionExpiredModal>`.
- **403:** Surface `error.code` + `error.message` inline or toast. `LAST_ADMIN` shown inline in drawer. `STUDENT_ACCESS_DENIED` shown inline on attendance screen.
- **429:** Toast "Too many requests. Please wait a moment." No auto-retry.
- **500:** Toast + retry button for GET; toast error for mutations.

---

## 4. STATE MANAGEMENT (Data Flow LOCKED)

### State boundaries

- **Server state:** TanStack Query (all API data)
- **Auth/session:** React Context (`AuthContext`: `user`, `token`, `isAuthenticated`, `isExpired`)
- **UI state:** Local `useState` (drawer open/close, selected IDs, active cell, form state)
- **Persistent:** `localStorage.auth` (tenant JWT+user), `localStorage.sa-auth` (SuperAdmin JWT)

### AuthContext responsibilities

- `login(token, user)` → writes `localStorage.auth` + React state atomically
- `logout()` → fire-and-forget `POST /auth/logout`, clear storage, reset state
- `switchRole(req)` → calls `POST /auth/switch-role` → on 200: `login(newToken, newUser)`, dispatch `window.CustomEvent('ROLE_SWITCHED')`
- `dismissExpired()` → clears `isExpired` flag

### ROLE_SWITCHED handler (`App.tsx`)

```ts
window.addEventListener('ROLE_SWITCHED', () => {
  queryClient.clear()
})
```

**Cross-tab:** No multi-tab sync. Each tab independently handles 401.

---

## 4.1 ERROR BOUNDARY STRATEGY (LOCKED)

- **Per-route boundary:** Every route wrapped in its own `<ErrorBoundary>`. On error: inline error card — *"Something went wrong. Try refreshing the page."* + Retry button → `onClick={() => window.location.reload()}`.
- **Root boundary:** Single boundary at `App.tsx` catches anything escaping per-route boundaries. Same error card UI.
- **Observability:** No telemetry in MVP. Errors logged to `console.error` in dev only (stripped in production).

---

## 5. DESIGN SYSTEM (UI Constraints)

### Color system

- **Background:** `bg-background`, Surface: `bg-card border border-border shadow-sm`, Primary: shadcn/ui default
- **Status badges:** Present: `bg-green-100 text-green-800`, Absent: `bg-red-100 text-red-800`, Late: `bg-yellow-100 text-yellow-800`
- **Contrast minimum:** 4.5:1 (WCAG 2.1 AA)

### Typography (LOCKED)

- Page headings: `text-2xl font-bold tracking-tight`
- Section headings: `text-base font-semibold`
- Table headers: `text-xs font-semibold text-muted-foreground uppercase tracking-wide`
- Body: `text-sm text-foreground`
- Muted/secondary: `text-xs text-muted-foreground`

### Spacing scale

Tailwind default (4px base unit). Component padding: `p-4`. Section gaps: `gap-6`.

### Sidebar

- Fixed left, `w-56` desktop, collapses on mobile
- Top: app name, RoleSwitcher dropdown (if `roles.length > 1`) + role badge
- Active nav: `bg-primary/10 text-primary font-medium rounded-lg`; Inactive: `text-muted-foreground hover:bg-muted`
- Nav items rendered strictly from `user.activeRole`

### Component standards

- **Cards:** `rounded-xl border bg-card shadow-sm p-4`
- **Tables:** header `bg-muted/50 border-b`, rows `border-b hover:bg-muted/40`
- **Timetable:** filled cells as subject chip; empty cells (Admin): `hover:bg-muted/30 border-dashed cursor-pointer`
- **Modals/Drawers:** shadcn/ui `<Sheet>` (forms), `<Dialog>` (confirmations)
- **Toasts:** shadcn/ui (Sonner)
- **Buttons:** min-height 44px (touch target)

### Component inventory (MVP)

Button, Input, Select, Checkbox, RadioGroup, Switch, Badge, Card, Table, Sheet, Dialog, Popover, DropdownMenu, Toast (Sonner), Skeleton, Avatar, Tooltip, Copy button.

### Responsiveness

**Mobile-first.** Breakpoints: `sm: 640px`, `md: 768px`, `lg: 1024px`. Timetable: `overflow-x-auto` on <768px.

---

## 6. ACCESSIBILITY (A11y Baseline — LOCKED)

**Target:** WCAG 2.1 AA

### Mandatory behaviors

- Full keyboard navigation across all interactive elements
- Visible focus ring on all focusable elements
- Form errors: `role="alert"`, `aria-describedby` on input
- Dialog/Sheet: focus trap, Escape closes
- Tables: caption on all data tables
- Status badges: text label always present
- Timetable grid: `role="grid"`, `role="row"`, `role="gridcell"`
- Empty cells: `aria-label="Add slot for {dayOfWeek} Period {n}"`
- RoleSwitcher: `aria-haspopup="menu"`, `aria-expanded`
- Feature toggles: `role="switch"`, `aria-checked`, **CR-FE-013g:** `aria-label="{featureName}"`
- Login ID copy button: `aria-label="Copy login ID for {studentName}"`
- `LAST_ADMIN` inline error: `role="alert"`
- `STUDENT_ACCESS_DENIED` inline error: `role="alert"`
- Promote confirm button: `aria-describedby` pointing to warning text
- Error boundary retry button: `aria-label="Retry loading this page"`
- **CR-FE-012:** End Assignment dialog `effectiveTo` input: `aria-label="Effective end date (YYYY-MM-DD)"`

### Testing

axe-core in CI on all 16 screens.

---

## 7. PERFORMANCE BUDGETS (LOCKED)

### Targets

- **LCP:** ≤2,500ms (mobile 4G)
- **INP:** ≤200ms
- **CLS:** ≤0.1
- **Initial JS bundle:** tenant app ≤250KB gzipped; SA portal ≤150KB gzipped
- **Lighthouse mobile:** ≥85 on dashboard and `/attendance/record`

### Techniques

- Code splitting: `React.lazy` + `<Suspense>` per route
- Icons: SVG only (lucide-react, tree-shaken)
- Virtualized lists: Student list if >200 rows
- No image assets in MVP

### CI enforcement

Bundle size check on every PR — fail if limits exceeded.

---

## 8. SECURITY / PRIVACY (Frontend)

| Vector | Mitigation |
|--------|------------|
| **XSS (script injection)** | `script-src 'self'` CSP. No `dangerouslySetInnerHTML` anywhere. |
| **XSS (user input)** | react-hook-form + zod validation. No `.innerHTML` usage. |
| **CSRF** | Backend handles (SameSite cookies + token verification). Frontend: no state-changing GET. |
| **Token exposure** | JWT in `localStorage` (XSS risk accepted — no httpOnly cookies in SPA). Never log tokens. |
| **Clickjacking** | `X-Frame-Options: DENY` via Cloudflare Pages headers. |
| **Sensitive data** | Mask admission numbers in logs. Never store PII in browser beyond login session. |
| **Dependency vulnerabilities** | `npm audit` in CI. Block deploy if critical vulnerabilities. |

### CSP (via Cloudflare Pages `_headers` file)

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' VITE_API_BASE_URL; frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

---

## 9. OBSERVABILITY (Frontend)

**Logging/telemetry:** None in MVP.

**Error reporting:** Console logs only (dev mode). No Sentry/DataDog.

---

## 10. TESTING STRATEGY (Frontend)

### Test layers (LOCKED)

- **Unit:** Utility functions, form validation schemas (zod)
- **Component:** Critical UI components (Button, Input, Form wrappers) — Vitest + Testing Library
- **E2E:** Auth flows, critical workflows per user story — Playwright
- **Visual regression:** No

### Contract alignment checks (REQUIRED)

- UI must be tested against **mock server generated from `openapi.yaml`**.
- No invented API rule enforced — if an API call/field is missing in OpenAPI, tests/spec review must fail until backend Change Request is approved.

### MVP test checklist

- Auth flows (login, logout, role switch, session expiry)
- Critical workflows per user story
- Error states + retries (401/403/409/422/429/500)
- A11y checks (axe-core) for key screens

---

## 11. PROJECT STRUCTURE (Frontend skeleton)

```
.
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/          # typed clients, endpoints map
│   ├── components/   # shared UI components
│   ├── features/     # screen-level components
│   ├── hooks/        # useAuth, etc.
│   ├── styles/       # Tailwind
│   ├── utils/        # helpers
│   ├── types/        # TS types
├── tests/
│   ├── unit/
│   ├── e2e/
```

**Naming convention:** camelCase  
**Import alias:** `@/` → `src/`

---

## 12. DEPLOYMENT, ROLLBACK, ENVIRONMENTS

### Hosting

**Cloudflare Pages**

### Build command (LOCKED)

```bash
npm run build
```

### Env mapping (dev/staging/prod rules)

- `.env.development` → local dev (`npm run dev`)
- `.env.staging` → Cloudflare Pages staging branch
- `.env.production` → Cloudflare Pages production branch

### Rollback strategy

Previous build redeploy + cache/CDN invalidation (Cloudflare automatic).

---

## 13. FORBIDDEN CHANGES (Scope Lock)

### BANNED without a new Freeze version + price/time update

- Add routes/screens
- Change routing mode (SPA ↔ SSR/SSG)
- Change state management library
- Change auth mode (JWT ↔ sessions)
- Add i18n
- Add offline/PWA
- Change API assumptions that are derived from OpenAPI (endpoints/fields/status codes/error shape)

**If requested:** create Change Request → re-price → approve/reject.

---

## 14. CHANGE CONTROL (Accept-and-price rules)

### Change Request Format

- **Requested change:** {description}
- **Reason:** {business justification}
- **Scope impact:** {screens affected}
- **Timeline impact:** {+N days}
- **Cost impact:** {self-funded / N/A}
- **Risk impact:** {Low/Medium/High}
- **Decision:** Approved / Rejected
- **New Freeze version:** {e.g., v1.6}
- **Backend Freeze dependency:** unchanged / updated → backend Freeze version {value}
- **OpenAPI dependency:** unchanged / updated → new OpenAPI version {value}

### Billing rule

Self-funded solo project — no external billing.

### Response SLA for change requests

24 hours (self-review).

---

## 15. VERSION HISTORY

- **v1.0** (date unknown): Initial frontend freeze approved for execution.
- **v1.1** (date unknown): Undocumented (retroactively unrecoverable).
- **v1.2** (date unknown): Undocumented.
- **v1.3** (2026-03-03): Backend v3.6 sync.
- **v1.4** (2026-03-04): Backend v3.6 final sync, CR-FE-008 applied.
- **v1.5** (2026-03-05): Backend v4.0 sync. CR-FE-009 (a/b/c/d), CR-FE-010, CR-FE-011 applied. Breaking changes: `BatchStatus` rename, `Student.classId` nullable, `CreateUserRequest.password` optional.
- **v1.6** (2026-03-07): Backend v4.2 sync. CR-FE-012, CR-FE-013 (a/b/c/d/e/f/g) applied. Breaking changes: bulk delete paths corrected (`POST /*/bulk`), Attendance Summary endpoint replaced (`GET /students/{id}/attendance/summary`), `TenantFeature` schema restored (`featureName`, `featureDescription`). Additive: End Assignment `effectiveTo` field, `GET /attendance/summary` deferred to NO list. Approved for execution.

---

**END OF FRONTEND FREEZE v1.6**
