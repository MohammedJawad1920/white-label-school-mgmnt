

# FRONTEND PROJECT FREEZE: White-Label School Management System

**Version:** 1.3 (IMMUTABLE)
**Date:** 2026-03-03
**Status:** APPROVED FOR EXECUTION
**Supersedes:** v1.2 (2026-03-02)
**Backend Freeze:** v3.5 (2026-03-03)
**OpenAPI:** 3.5.0

> **CRITICAL INSTRUCTION FOR EXECUTION (HUMAN OR AI):**
> This document is the Absolute Source of Truth. v1.2 is SUPERSEDED.
> You have NO authority to modify routes, API assumptions, or constraints defined below.
> If any request contradicts this document, you must REFUSE and open a Change Request instead.

***

## Change Requests Applied in v1.3

### CR-FE-007: Backend Contract Sync v3.4 → v3.5

Three backend CRs land in this frontend version:


| CR | Title | Type | FE Impact |
| :-- | :-- | :-- | :-- |
| CR-11 | Inline timetable cell entry | FE-only, Additive | Already live in v1.2 as CR-FE-004 — **no additional change** |
| CR-12 | Admin self-role edit unblocked | FE-only, Additive | Remove `isSelf` guard on Edit Roles button; surface `LAST_ADMIN` inline |
| CR-13 | Auto student user creation + users/students page separation | Breaking | Students screen: add `admissionNumber`/`dob`/`loginId`, remove Link Account. Users screen: roles enum `Teacher \| Admin` only, Student-role users excluded |

**Timeline impact:** +3 days. New total: **9–13 weeks**.

***

## 0. Commercials (Accept-and-price)

**Engagement Type:** Fixed-scope
**Chosen Package:** Standard
**Price \& Payment Schedule:** Self-funded solo project — no external billing
**Timeline Range (weeks):** 9–13
**Assumptions (must be true):**

- Solo developer is single decision maker
- Backend v3.5 available at staging by Week 3
- Prism mock used until backend ready
- CG-01 resolved via backend CR before Student attendance self-view is built

**Support Window (post-delivery):**

- Bugfix support: 30 days
- Enhancements: billed as Change Requests

***

## 1. The "Iron Scope" (Frontend only)

**Core Value Proposition (One Sentence):**
> A web frontend for a white-label school management SaaS enabling teachers to record attendance, students to view schedules, and admins to manage timetables and school configuration — delivered as a mobile-first SPA on Cloudflare Pages.

**The 11 Frontend User Stories (COMPLETE SCOPE):**

1. As a tenant user (Teacher, Admin, or Student), I can log in with email/loginId, password, and school ID, so that I access only my school's data.
2. As a Teacher, I can see today's own assigned classes on a role-specific dashboard and navigate to record attendance.
3. As an Admin, I can see today's full schedule with a stat summary bar on a role-specific dashboard.
4. As a Student, I can see today's school-wide timetable (read-only) on a role-specific dashboard.
5. As a Teacher or Admin, I can view the full timetable grid — Admin can add a slot by clicking an empty cell and end an assignment by clicking a filled cell.
6. As a Teacher or Admin, I can record attendance for a class period by selecting statuses for each student.
7. As an Admin, I can view a student's full attendance history and correct an individual record with `originalStatus` preserved.
8. As an Admin, I can view a monthly attendance summary for a student.
9. As an Admin, I can manage users (Teacher/Admin roles only), students (with auto login account creation via admission number + date of birth), classes, batches, subjects, and school periods.
10. As a multi-role user, I can switch my active role via a dropdown — the sidebar and dashboard immediately reflect only pages relevant to that role.
11. As a SuperAdmin, I can manage tenants (create with admin block, update, deactivate, reactivate) and their feature flags from an isolated portal.

**The "NO" List (Explicitly Out of Scope):**

- No forgot password / password reset flow (admin resets via DB or automatic Reset Login on DOB update)
- No student attendance self-view (CG-01 blocked — placeholder only)
- No parent portal or parent role
- No real-time updates (no WebSocket, no polling)
- No CSV bulk import UI
- No audit log viewer UI
- No custom branding/theme UI (no logo upload, no color picker)
- No multi-language / i18n (English only)
- No charts or graph visualizations (summary tables only)
- No inline timetable slot edit (no `PUT /timetable/:id` in contract — End Assignment via popover only)
- No `PUT /features/:featureKey` from tenant app (deprecated since v3.2, returns 403)
- No SSR/SEO (login-gated SPA)
- No analytics or telemetry
- No SuperAdmin self-registration screen
- No JWT token blacklist / forced session invalidation UI
- No SuperAdmin tenant hard-delete (deactivate/reactivate only)
- **No student-to-user manual linking** (Link Account action removed in v1.3; auto-created via `POST /students` since v3.5)
- No `PUT /students/:id/link-account` in any frontend flow (deprecated endpoint, migration-only on backend)

**User Roles (UI behavior truth):**


| activeRole | Sidebar Items | Key Restrictions |
| :-- | :-- | :-- |
| Teacher | Dashboard, Timetable, Record Attendance | Timetable read-only; no attendance summary/history |
| Admin | Dashboard, Timetable, Attendance Summary, Attendance History, Manage Users, Students, Classes, Batches, Subjects, School Periods | Users page shows Teacher/Admin only; Students page shows Student accounts; Edit Roles shown for self with LAST_ADMIN inline guard |
| Student | Dashboard, Timetable | All read-only; no record/manage/attendance actions; CG-01 placeholder on dashboard |
| SuperAdmin | Isolated portal: Tenants, Feature Flags | No tenant app access whatsoever |

Role switcher shown only when `user.roles.length > 1`.

**Success Definition (measurable):**

1. Teacher can log in, view own classes, and record attendance end-to-end against live backend.
2. Admin can create a timetable entry by clicking an empty cell, correct an attendance record, create a student (auto-provisioned login account), and bulk-delete users.
3. Multi-role Teacher+Admin user switches roles via dropdown — sidebar changes immediately, no page reload.
4. SuperAdmin can create a tenant with admin block, reactivate an inactive tenant, and toggle feature flags.
5. All 15 screens pass WCAG 2.1 AA automated checks (axe-core); Lighthouse mobile ≥ 85 on dashboard and `/attendance/record`.

***

## 1.2 Assumptions \& External Dependencies

**Primary Backend/API:** White-Label School Management System

- Dev: `http://localhost:3000/api`
- Mock: `http://localhost:4010/api` (Prism)
- Staging/Prod: `VITE_API_BASE_URL` from env

**Design Source:** None — no Figma. Tailwind CSS v3 + shadcn/ui. CR-FE-003 visual rules locked in Section 5.

### Required Backend Inputs (LOCKED)

**Backend Freeze Doc version:** v3.5 (2026-03-03)
**OpenAPI Contract File (REQUIRED):**

- File name: `openapi.yaml`
- Version: `3.5.0`
- Location: `.docs/openapi.yaml`

**Contract immutability rule:**

- Frontend MUST NOT invent endpoints, fields, status codes, or error shapes not present in OpenAPI 3.5.0.
- CG-01 is a known gap — explicitly stubbed, no invented endpoint called.
- Any new UI need → backend Change Request + new backend Freeze version + updated OpenAPI → then frontend Change Request.

**External Dependencies:** None.

***

## 1.5 Frontend Configuration (The Environment)

```bash
# .env.example — Tenant App
VITE_APP_ENV="development"           # development | staging | production
VITE_API_BASE_URL="http://localhost:3000/api"
VITE_APP_BASE_URL="http://localhost:5173"
VITE_APP_NAME="School Management"

# .env.example — SuperAdmin Portal
VITE_APP_ENV="development"
VITE_API_BASE_URL="http://localhost:3000/api"
VITE_APP_BASE_URL="http://localhost:5174"
VITE_APP_NAME="Platform Admin"
```

**Configuration Rules:**

- `VITE_API_BASE_URL` must be set per environment — no hardcoded URLs in source.
- No secrets in frontend env (all values are public build-time only).
- Tenant app and SuperAdmin portal are separate Vite projects with separate `.env` files.

***

## 1.6 Tech Stack \& Key Libraries (LOCKED)

| Concern | Library | Version |
| :-- | :-- | :-- |
| Framework | React | 18.x |
| Build tool | Vite | 5.x |
| Language | TypeScript | 5.x strict mode |
| Routing | React Router | v6.x |
| Data fetching/caching | TanStack Query | v5.x |
| Forms/validation | react-hook-form + zod | latest stable |
| UI components | shadcn/ui | latest stable |
| Styling | Tailwind CSS | v3.x |
| Date handling | date-fns | v3.x |
| HTTP client | axios | v1.x typed interceptors |
| Icons | lucide-react | latest stable |

**Routing mode:** SPA (React Router v6)
**Auth gating:** Protected route wrapper + role guard. Unauthenticated → redirect `/login`. Wrong `activeRole` for route → inline "Not authorized for current role. Switch to [Role] to access this page." — no redirect.

**Explicitly Banned:**

- No Redux or Zustand
- No jQuery, no Moment.js
- No `dangerouslySetInnerHTML`
- No inline styles (Tailwind classes only)
- No class components (hooks only)
- No direct `fetch` calls outside `src/api`
- No prop drilling beyond 2 levels
- No hardcoded tenant slugs, IDs, or API URLs in component files

***

## 2. Routes, Screens, and Navigation (UI truth)

### Route Map — Tenant App (`app.yourdomain.com`)

| Route | Screen | Auth | activeRole |
| :-- | :-- | :-- | :-- |
| `/login` | Tenant Login | Public | — |
| `/dashboard` | Dashboard | Protected | Teacher, Admin, Student |
| `/timetable` | Timetable | Protected | Teacher (read), Admin (rw), Student (read) |
| `/attendance/record` | Record Attendance | Protected | Teacher, Admin |
| `/attendance/summary` | Attendance Summary | Protected | Admin only |
| `/students/:studentId/attendance` | Student Attendance History | Protected | Admin only |
| `/manage/users` | User Management | Protected | Admin only |
| `/manage/students` | Student Management | Protected | Admin only |
| `/manage/classes` | Class Management | Protected | Admin only |
| `/manage/batches` | Batch Management | Protected | Admin only |
| `/manage/subjects` | Subject Management | Protected | Admin only |
| `/manage/school-periods` | School Periods | Protected | Admin only |
| `/privacy` | Privacy Policy | Public | — |
| `/terms` | Terms of Service | Public | — |

### Route Map — SuperAdmin Portal (`admin.yourdomain.com`)

| Route | Screen | Auth | Role |
| :-- | :-- | :-- | :-- |
| `/login` | SuperAdmin Login | Public | — |
| `/tenants` | Tenant Management | Protected | SuperAdmin only |
| `/tenants/:tenantId/features` | Tenant Feature Flags | Protected | SuperAdmin only |


***

## 2.1 Screen Specifications

### Screen: Tenant Login

- **Goal:** Authenticate tenant user, store JWT, handle all error cases.
- **API calls:**

1. `POST /auth/login` → 200: store token + user in `localStorage['auth']`, redirect `/dashboard` | 401: "Invalid email or password." | 403 `TENANT_INACTIVE`: "This school account has been deactivated. Contact your platform administrator." | 404: "School not found. Check the school ID and try again." | 400: field-level errors from `error.details`.
- **Local state:** form fields, `submitting: boolean`, `globalError: string | null`
- **Server state:** None (form POST only — no TanStack Query)
- **Loading:** Submit button spinner, disabled
- **Form validation:** `email` required valid email | `password` required minLength 8 | `tenantSlug` required minLength 1 maxLength 100
- **Permissions:** Public. Already authenticated → redirect `/dashboard`.
- **A11y:** `htmlFor` labels, `aria-describedby` on error messages, autofocus on email, submit on Enter.

***

### Screen: Dashboard

- **Goal:** Role-specific view of today's schedule with relevant CTAs.
- **API calls:**

1. `GET /timetable?date=today` → 200: render per-role content | 403 `FEATURE_DISABLED`: full-page "Timetable feature not enabled" | 401: session expiry flow.
- **Server state:** TQ key `['timetable', 'today', isoDate]`. Stale 5 min. Refetch on focus.
- **Loading:** 3 skeleton slot cards.
- **Role-specific content (CR-FE-006):**
    - **Teacher:** Filter client-side `slot.teacherId === currentUser.id`. Slot cards with "Record Attendance" CTA → `/attendance/record` with `state.slotId`. Empty: "No classes assigned to you today."
    - **Admin:** All slots. Stat summary bar: Total Periods N | Scheduled N | Unassigned N (derived client-side). No record CTA. Empty: "No classes scheduled for today."
    - **Student:** All slots read-only. CG-01 placeholder below list: "My Attendance coming soon. Contact your admin for your attendance records." Empty: "No classes scheduled today."
- **A11y:** Each slot card is `<article>`. "Record Attendance" button: `aria-label="Record attendance for {className} {subjectName} Period {n}"`.

***

### Screen: Timetable

- **Goal:** Full timetable grid. Admin inline cell interactions. Teacher/Student read-only.
- **API calls:**

1. `GET /timetable?status=Active` → 200: render grid | 403 `FEATURE_DISABLED`: full-page gate.
2. `GET /school-periods` → 200: column headers | 403: inline "School periods not configured."
3. Admin `POST /timetable` → 201: invalidate `timetable`, close drawer, toast "Slot created." | 400 `PERIOD_NOT_CONFIGURED`: inline "Period {n} not configured." | 409: "Slot already occupied." | 403: toast.
4. Admin `PUT /timetable/:id/end` → 200: invalidate `timetable`, close popover, toast "Assignment ended." | 404/403: toast.
- **Local state:** `selectedFilters`, `activeCell: { dayOfWeek: string; periodNumber: number } | null`, `activeSlotId: string | null`
- **Server state:** TQ keys `['timetable', filters]`, `['school-periods']`. Stale 5 min.
- **Loading:** Full grid skeleton. **Empty:** "No timetable entries found." Admin hint: "Click an empty cell to add a slot."
- **Cell interactions (CR-FE-004 — unchanged from v1.2, CR-11 already implemented):**
    - Empty cell (Admin): hover `bg-muted/30 border-dashed` + icon → click → `setActiveCell({dayOfWeek, periodNumber})` → create drawer. Drawer fields: `classId` select required, `subjectId` select required, `teacherId` select (Teacher-role users) required, `effectiveFrom` date required — `dayOfWeek` + `periodNumber` pre-filled read-only.
    - Filled cell (Admin): click → `setActiveSlotId(slot.id)` → Popover with subject/teacher/class/dates + "End Assignment" confirmation dialog → `PUT /timetable/:id/end`.
    - Teacher/Student: cells non-interactive, plain read-only display.
- **Form validation (create):** `classId` required | `subjectId` required | `teacherId` required (Teacher-role user) | `dayOfWeek` pre-filled read-only | `periodNumber` pre-filled read-only integer ≥ 1 | `effectiveFrom` required YYYY-MM-DD (UX warn if past — not API-enforced).
- **A11y:** `role="grid"`, `role="row"`, `role="gridcell"`. Empty clickable cells: `aria-label="Add slot for {dayOfWeek} Period {n}"`. Drawers trap focus, Escape closes.
- **Performance:** `overflow-x-auto` on mobile. No virtualization needed (≤ 7 days × 15 periods).

***

### Screen: Record Attendance

- **Goal:** Record attendance for all students in a selected class period.
- **API calls:**

1. Teacher: `GET /timetable?teacherId={currentUser.id}&date=today` | Admin: `GET /timetable?date=today`
2. `GET /students?classId={selectedClassId}&limit=200` — TQ key `['students', 'classId', selectedClassId]`
3. `POST /attendance/record-class` → 201: toast "{recorded} records saved. {present} present, {absent} absent, {late} late." | 400 `FUTURE_DATE`: inline error | 409: "Attendance already recorded." | 403 `FEATURE_DISABLED`: full-page gate | 403 not-assigned: toast.
- **Local state:** `selectedTimeSlotId`, `selectedDate` (default today), `defaultStatus`, `exceptions: Map<studentId, AttendanceStatus>`, `submitError`, `successMsg`
- **Server state:** TQ keys `['timetable', 'myToday']`, `['students', 'classId', id]`. On 201 invalidate `attendance`.
- **Loading:** Student list skeleton 10 rows. **Empty:** "No students found in this class."
- **Form validation:** `timeSlotId` required | `date` required, not future | `defaultStatus` required enum `Present|Absent|Late`
- **Permissions:** Teacher own slots only. Admin all slots. Student direct URL → inline "Not authorized for current role."
- **A11y:** Each student row `role="radiogroup"` with `aria-label="{studentName} attendance status"`.
- **Performance:** `exceptions` as `Map` for O(1) lookup. `limit=200` is OpenAPI max.

***

### Screen: Student Attendance History

- **Goal:** Paginated attendance records for a student. Admin can correct individual records.
- **API calls:**

1. `GET /students/:studentId/attendance?from={from}&to={to}&limit={limit}&offset={offset}` → 200: table + student header | 404: "Student not found." | 403: "You do not have access to this student's records."
2. Admin: `PUT /attendance/:recordId` → 200: invalidate `['student-attendance', studentId]`, toast "Attendance corrected." | 400 `SAME_STATUS`: inline "Status is already {status} — no change needed." | 400 `FUTURE_DATE`: inline "Cannot correct a future record." | 403/404: toast.
- **Local state:** `dateFrom`, `dateTo`, `page`, `correctingRecordId: string | null`, `correctionStatus: string`
- **Server state:** TQ key `['student-attendance', studentId, from, to, page]`. Stale 2 min.
- **Loading:** Table skeleton 10 rows. **Empty:** "No attendance records found for this period."
- **Correction:** Table columns: Date | Subject | Period | `originalStatus` badge (never changes) | `status` effective badge | Corrected By | Action (Admin). Correct: inline Select + Confirm → `PUT /attendance/:recordId`. `originalStatus` always visible — immutable audit trail.
- **Form validation:** correction `status` required enum `Present|Absent|Late`, must differ from current effective status (client guard; server 400 `SAME_STATUS`).
- **Permissions:** Admin only. Others → inline "Not authorized for current role."
- **A11y:** Table `<caption>` with student name. Correction select: `aria-label="Correct attendance status for {date} Period {n}"`.
- **Performance:** Server-side pagination, limit 50.

***

### Screen: Attendance Summary

- **Goal:** Monthly summary for a student.
- **API calls:** `GET /students/:studentId/attendance?from={YYYY-MM-01}&to={YYYY-MM-DD}&limit=50` — consume `response.summary` only | 403: "Not authorized." | 404: "Student not found."
- **Local state:** `selectedStudentId`, `selectedMonth` (YYYY-MM, default current month)
- **Server state:** TQ key `['student-attendance', studentId, from, to]`. Stale 5 min.
- **Loading:** Summary card skeleton. **Empty:** "No attendance data for {month}." when `summary.totalRecords === 0`.
- **Form validation:** `studentId` required | `month` required YYYY-MM, not future.
- **Permissions:** Admin only.

***

### Screen: User Management (`/manage/users`) — CR-12, CR-13

- **Goal:** List, create, update roles, and delete Teacher/Admin users. **Student-role users are NOT shown here** — managed exclusively via Students page.
- **API calls:**

1. `GET /users?role={filter}&search={q}` — **v3.5 CR-13:** Student-role users excluded by backend automatically; role filter enum is `Teacher | Admin` only.
2. `POST /users` → 201: invalidate `users` | 409: "Email already exists." | **400 `INVALID_ROLE` (if Student slips through — frontend must not allow):** "Student accounts must be created via the Students page." | 400: field errors.
3. `PUT /users/:id/roles` → 200: invalidate | **v3.5 CR-12:** 403 `LAST_ADMIN`: show **inline in role edit drawer** "Cannot remove Admin role — you are the last admin of this school." | 404: toast.
4. `DELETE /users/bulk` → 200: result toast, failed rows highlighted red.
5. `DELETE /users/:id` → 204: toast | 409: "Cannot delete user — has active records."
- **Local state:** `selectedIds: Set<string>`, `createDrawerOpen`, `roleEditUserId`, `searchQuery`, `roleFilter`
- **Server state:** TQ key `['users', roleFilter, searchQuery]`. Stale 2 min.
- **Loading:** Table skeleton 10 rows. **Empty:** "No users found."
- **Form validation (create):** `name` required max 255 | `email` required valid | `password` required min 8 | `roles` required ≥ 1, values in `['Teacher', 'Admin']` only — **Student is not an option in this form.**
- **Form validation (update roles):** `roles` required non-empty, values in `['Teacher', 'Admin']`, no duplicates — **Student is not an option.**
- **Permissions (v1.3 — CR-12):**
    - **Edit Roles button shown for ALL users including current user (isSelf guard REMOVED).**
    - Role edit drawer for self: if Admin attempts to remove own Admin role → backend returns 403 `LAST_ADMIN` → display **inline error in drawer:** "Cannot remove Admin role — you are the last admin of this school." Drawer stays open. **Not a toast.**
    - Delete button hidden for current user (unchanged).
- **A11y:** Checkbox rows `aria-label="Select {userName}"`. Bulk bar `aria-live="polite"`. Role edit drawer traps focus. LAST_ADMIN inline error has `role="alert"`.

***

### Screen: Student Management (`/manage/students`) — CR-13

- **Goal:** List, create, update, and delete students. Each student auto-has a login account. Login ID shown read-only for admin to distribute. **No manual link-account step.**
- **API calls:**

1. `GET /students?classId=&batchId=&search=&limit=50&offset=0` → 200: table with `admissionNumber`, `dob`, `loginId`, `userId` columns.
2. `POST /students` **(v3.5 CR-13)** → 201: invalidate `students`, toast "Student created. Login ID: {loginId}" | 409 `ADMISSION_NUMBER_CONFLICT`: inline "Admission number {n} already exists for this school." | 400 batch/class mismatch: inline. **Atomically creates `users` row + `students` row — no separate step.**
3. `PUT /students/:id` → 200: invalidate `students` | 409 `ADMISSION_NUMBER_CONFLICT`: inline | 400/404: toast. **If `dob` or `admissionNumber` changed:** show tooltip on those fields: "Changing this will reset the student's login password (Reset Login)."
4. `DELETE /students/bulk` → 200: result toast, failed rows highlighted red.
5. `DELETE /students/:id` → 204: toast | 409: "Cannot delete student — has attendance records."
    - **`PUT /students/:id/link-account` is REMOVED from frontend entirely (deprecated in v3.5).**
- **Local state:** `selectedIds: Set<string>`, `createDrawerOpen`, `editStudentId: string | null`, `searchQuery`
- **Server state:** TQ key `['students']`. Stale 2 min. Invalidated by: `POST /students`, `PUT /students/:id`, `DELETE /students/:id`, `DELETE /students/bulk`.
- **Loading:** Table skeleton 10 rows. **Empty:** "No students found."
- **Table columns:** Name | Class | Batch | **Admission No.** | **Date of Birth** | **Login ID** (read-only `<code>` text, copy button) | Actions (Edit, Delete)
- **Login ID display:** Shown as read-only `<code>` element in table row and in edit/detail view. Copy-to-clipboard button. Tooltip: "Share this login ID with the student. They use it as their username to log in. Password is their admission number + date of birth (DDMMYYYY)."
- **Row actions:** Edit (opens edit drawer), Delete. **No "Link Account" button/dialog.**
- **Form validation (create):**
    - `name` required max 255
    - `classId` required
    - `batchId` required, must match `class.batchId`
    - **`admissionNumber` required max 50, unique per tenant (409 on conflict)**
    - **`dob` required YYYY-MM-DD date picker (date-fns formatted)**
    - **No `email` or `password` field** (auto-derived on backend: email = `{admissionNumber}@{tenantSlug}.local`, password = `{admissionNumber}{DDMMYYYY(dob)}`)
- **Form validation (edit):**
    - All fields optional (minProperties 1)
    - If `dob` or `admissionNumber` field touched: show warning tooltip "Changing this will reset the student's login password (Reset Login)"
- **Permissions:** Admin only.
- **A11y:** Create drawer: `aria-label="Add student"`. Login ID copy button: `aria-label="Copy login ID for {studentName}"`. Edit drawer: DOB/admission fields have `aria-describedby` pointing to reset-password warning.
- **Performance:** Virtualize rows if > 200 students.

***

### Screens: Class / Batch / Subject Management

| Screen | Route | TQ key | Create fields | Key 409 |
| :-- | :-- | :-- | :-- | :-- |
| Classes | `/manage/classes` | `classes` | `name` required max 255, `batchId` required | Cannot delete — students enrolled |
| Batches | `/manage/batches` | `batches` | `name` max 100, `startYear`, `endYear`, `status` Active/Archived | Cannot delete — classes reference this batch |
| Subjects | `/manage/subjects` | `subjects` | `name` required max 255, `code` optional max 50 | Cannot delete — timetable slots reference this subject |

All: stale 5 min | skeleton + "No {entity} found." empty state | create/edit drawer | bulk delete + single delete (Admin only) | standard `aria-label` on edit/delete buttons.

***

### Screen: School Periods (`/manage/school-periods`)

- **API calls:**

1. `GET /school-periods` → 200: list by `periodNumber` | 403 `FEATURE_DISABLED`: full-page gate.
2. `POST /school-periods` → 201: invalidate `school-periods` | 409: "Period number {n} already exists." | 400 `PERIOD_TIME_INVALID`: "Start time must be before end time."
3. `PUT /school-periods/:id` → 200: invalidate | 400: inline time error | 404: toast.
4. `DELETE /school-periods/:id` → 204: invalidate `school-periods` AND `timetable` | 409 `HAS_REFERENCES`: inline "Cannot delete — active timetable slots use this period."
- **Local state:** `createDrawerOpen`, `editPeriodId`, `deleteConfirmPeriodId`
- **Server state:** TQ key `['school-periods']`. Stale 5 min. Any mutation invalidates `school-periods` AND `timetable`.
- **Loading:** Skeleton 8 rows. **Empty:** "No periods configured. Add your first period."
- **Form validation:** `periodNumber` required integer ≥ 1, unique, **immutable after creation** | `label` optional max 100 | `startTime` required `HH:mm` | `endTime` required, strictly after `startTime`.
- **A11y:** `type="time"` inputs with `aria-label`. Edit form: `periodNumber` is `aria-disabled="true"` with tooltip "Period number cannot be changed after creation."

***

### Screen: SuperAdmin Login

- **API calls:** `POST /super-admin/auth/login` → 200: store in `localStorage['sa-auth']`, redirect `/tenants` | 401: "Invalid email or password." | 400: field errors.
- **Form validation:** `email` required valid | `password` required minLength 8.
- **Permissions:** Public. Authenticated → redirect `/tenants`.

***

### Screen: Tenant Management (`/tenants`)

- **API calls:**

1. `GET /super-admin/tenants?status={filter}&search={q}`
2. `POST /super-admin/tenants` → 201: invalidate `sa-tenants`, toast "Tenant created. 8 default periods seeded." | 409 `CONFLICT`: "Tenant ID or slug already exists." | 409 `ADMIN_EMAIL_TAKEN`: "Admin email already exists." | 400 `admin block is required`: field error.
3. `PUT /super-admin/tenants/:id` → 200: invalidate | 409: "Slug already taken."
4. `PUT /super-admin/tenants/:id/deactivate` → 200: invalidate | 409 `ALREADY_INACTIVE`: "Tenant is already inactive."
5. `PUT /super-admin/tenants/:id/reactivate` → 200: invalidate, toast "Tenant reactivated." | 409 `ALREADY_ACTIVE`: "Tenant is already active."
- **Local state:** `createDrawerOpen`, `editTenantId`, `deactivateConfirmId`, `reactivateConfirmId`, `searchQuery`, `statusFilter`
- **Server state:** TQ key `['sa-tenants', statusFilter, searchQuery]`. Stale 1 min.
- **Create Tenant form (Section 1: Tenant details — Section 2: First Admin block, both required):**
    - Section 1: `id` required alphanumeric/dash max 50 | `name` required max 255 | `slug` required `a-z0-9-` max 100
    - Section 2: `admin.name` required max 255 | `admin.email` required valid | `admin.password` required minLength 8
    - Submit blocked if any field in either section is missing.
- **Row actions:** Active → Edit, Deactivate. Inactive → Edit, Reactivate.
- **A11y:** Deactivate/Reactivate confirmations are `<Dialog>` with focus trap — Escape cancels.

***

### Screen: Tenant Feature Flags (`/tenants/:tenantId/features`)

- **API calls:**

1. `GET /super-admin/tenants/:tenantId/features` → 200: render toggles | 404: "Tenant not found."
2. `PUT /super-admin/tenants/:tenantId/features/:featureKey` → 200: update toggle | 400 `FEATURE_DEPENDENCY`: revert optimistic toggle, inline "Attendance requires Timetable to be enabled first." | 404: toast.
- **Local state:** Optimistic toggle state per feature key.
- **Server state:** TQ key `['sa-features', tenantId]`. Stale 30 sec.
- **Permissions:** Attendance toggle disabled/greyed when timetable is disabled.
- **A11y:** `role="switch"` with `aria-checked`, `aria-label="{featureName}"`.

***

### Static Screens: Privacy \& Terms

Public. Hardcoded text. Privacy covers DPDPA 2023: data collected, purpose, retention, user rights, contact.

***

## 3. API Assumptions (Frontend contract expectations)

### 3.0 Backend Contract (LOCKED)

**Backend Freeze version:** v3.5 (2026-03-03)
**OpenAPI file:** `openapi.yaml`
**OpenAPI version:** `3.5.0`
**File path:** `.docs/openapi.yaml`

**Base URL:** `VITE_API_BASE_URL` from env — never hardcoded.
**Auth:** Bearer JWT. Header: `Authorization: Bearer {token}`. Token storage: `localStorage['auth']` (tenant), `localStorage['sa-auth']` (SuperAdmin).

**Global error shape (MUST match OpenAPI 3.5.0):**

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


***

### 3.1 Mock Server (REQUIRED)

**Tool:** Prism (`@stoplight/prism-cli`)

```bash
# Install (one-time)
npm install -g @stoplight/prism-cli

# Run (LOCKED command)
prism mock .docs/openapi.yaml --port 4010

# Frontend env
VITE_API_BASE_URL=http://localhost:4010/api
```

**Failure simulation plan (v3.5):**


| Scenario | Header | Endpoint |
| :-- | :-- | :-- |
| Missing/invalid token | `Prefer: code=401` | Any protected endpoint |
| Inactive tenant login | `Prefer: code=403` | `POST /auth/login` |
| Period not configured | `Prefer: code=400` | `POST /timetable` |
| Duplicate email on create user | `Prefer: code=409` | `POST /users` |
| Student role in POST users | `Prefer: code=400` | `POST /users` |
| Duplicate admission number | `Prefer: code=409` | `POST /students` |
| Student batch mismatch | `Prefer: code=400` | `POST /students` |
| Resource not found | `Prefer: code=404` | Any `/:id` endpoint |
| Last admin guard | `Prefer: code=403` | `PUT /users/:id/roles` |
| Same status correction | `Prefer: code=400` | `PUT /attendance/:recordId` |


***

### 3.2 Typed API Surface (LOCKED — matches OpenAPI 3.5.0 exactly)

```ts
// ERRORS
interface ApiError {
  error: { code: string; message: string; details?: Record<string, unknown> };
  timestamp: string;
}

// AUTH
type TenantRole = 'Teacher' | 'Admin' | 'Student'; // JWT shape
type UserRole = 'Teacher' | 'Admin';                // v3.5: users form/page enum

interface TenantUser {
  id: string; tenantId: string; name: string; email: string;
  roles: TenantRole[]; // may include Student
  activeRole: TenantRole;
}
interface TenantLoginRequest  { email: string; password: string; tenantSlug: string; }
interface TenantLoginResponse { token: string; user: TenantUser; }

// STUDENTS — v3.5 CR-13
interface Student {
  id: string; name: string;
  classId: string; className: string;
  batchId: string; batchName: string;
  admissionNumber: string;    // v3.5 required
  dob: string;                // v3.5 YYYY-MM-DD
  loginId: string;            // v3.5 e.g. "530@greenvalley.local"
  userId: string | null;      // null only for pre-v3.5 unlinked
}
interface CreateStudentRequest {
  name: string; classId: string; batchId: string;
  admissionNumber: string;    // v3.5 required
  dob: string;                // v3.5 required
}
interface UpdateStudentRequest {
  name?: string; classId?: string; batchId?: string;
  admissionNumber?: string;   // resets password if changed
  dob?: string;               // resets password if changed
}

// USERS — v3.5 CR-13
interface User             { id: string; name: string; email: string; roles: UserRole[]; }
interface CreateUserRequest { name: string; email: string; password: string; roles: UserRole[]; }
interface UpdateRolesRequest { roles: UserRole[]; }

// Additional types omitted for brevity — see OpenAPI 3.5.0
```


***

### 3.3 Caching \& Invalidation Rules (LOCKED)

| TQ Key | Stale Time | Invalidated By |
| :-- | :-- | :-- |
| `['timetable', filters]` | 5 min | `POST /timetable`, `PUT /timetable/:id/end`, `DELETE /school-periods/:id` |
| `['students']` | 2 min | `POST /students`, `PUT /students/:id`, `DELETE /students/:id`, `DELETE /students/bulk` |
| `['users', role, search]` | 2 min | `POST /users`, `PUT /users/:id/roles`, `DELETE /users/:id`, `DELETE /users/bulk` |

*(Full table in original doc)*

***

### 3.4 Retry Rules (LOCKED)

- **GET requests:** Retry up to 3 times, exponential backoff (1s, 2s, 4s).
- **Mutations (POST/PUT/DELETE):** Never retry automatically.
- **401:** Axios interceptor fires `window.CustomEvent('AUTH_EXPIRED')`, clears `localStorage['auth']`, sets `isExpired: true` → `SessionExpiredModal`.
- **403:** Surface `error.code` + `error.message` inline or toast. **`LAST_ADMIN` shown inline in role edit drawer (not toast).**
- **429:** Toast "Too many requests. Please wait a moment." No auto-retry.
- **500:** Toast + retry button for GET; toast error for mutations.

***

## 4. State Management \& Data Flow (LOCKED)

**State boundaries:**

- **Server state:** TanStack Query — all API data
- **Auth/session:** React Context (`AuthContext`) — `user`, `token`, `isAuthenticated`, `isExpired`
- **UI state:** Local `useState` — drawer open/close, selected IDs, active cell, form state
- **Persistent:** `localStorage['auth']` (tenant JWT+user), `localStorage['sa-auth']` (SuperAdmin JWT)

**AuthContext responsibilities:**

- `login(token, user)` → writes `localStorage['auth']` + React state atomically
- `logout()` → fire-and-forget `POST /auth/logout`, clear storage, reset state
- `switchRole(req)` → calls `POST /auth/switch-role` → on 200 `login(newToken, newUser)`, dispatch `window.CustomEvent('ROLE_SWITCHED')`
- `dismissExpired()` → clears `isExpired` flag

**ROLE_SWITCHED handler (App.tsx):**

```ts
window.addEventListener('ROLE_SWITCHED', () => queryClient.clear());
// Clears all TQ cache so next render fetches data scoped to new activeRole.
```

**Cross-tab:** No multi-tab sync. Each tab independently handles 401.

***

## 5. Design System \& UI Constraints

All rules from CR-FE-003 (v1.2) unchanged:

**Color system:**

- Background: `bg-background` | Surface: `bg-card border border-border shadow-sm` | Primary: shadcn/ui default
- Status badges: Present `bg-green-100 text-green-800` | Absent `bg-red-100 text-red-800` | Late `bg-yellow-100 text-yellow-800`
- Contrast minimum 4.5:1 (WCAG 2.1 AA)

**Typography (LOCKED):**

- Page headings: `text-2xl font-bold tracking-tight`
- Section headings: `text-base font-semibold`
- Table headers: `text-xs font-semibold text-muted-foreground uppercase tracking-wide`

**Sidebar (CR-FE-003 / CR-FE-006):**

- Fixed left, `w-56` desktop, collapses on mobile
- Top: app name / logo mark, RoleSwitcher dropdown (if `roles.length > 1`) + role badge
- Active nav: `bg-primary/10 text-primary font-medium rounded-lg` | Inactive: `text-muted-foreground hover:bg-muted`
- **Nav items rendered strictly from `user.activeRole`**

**Component standards:**

- Cards: `rounded-xl border bg-card shadow-sm p-4`
- Tables: header `bg-muted/50 border-b` | rows `border-b hover:bg-muted/40`
- Timetable: colored column headers | filled cells as subject chip | empty cells (Admin): `hover:bg-muted/30 border-dashed cursor-pointer`
- Modals/Drawers: shadcn/ui `Sheet` (forms), `Dialog` (confirmations)
- Toasts: shadcn/ui Sonner
- Buttons: `min-height: 44px` touch target

**Component inventory:** Button, Input, Select, Checkbox, RadioGroup, Switch, Badge, Card, Table, Sheet, Dialog, Popover, DropdownMenu, Toast, Skeleton, Avatar, Tooltip, Copy button.

**Responsiveness:** Mobile-first. Timetable: `overflow-x-auto` on `< 768px`.

***

## 6. Accessibility (A11y) Baseline (LOCKED)

**Target:** WCAG 2.1 AA

**Mandatory behaviors:**

- Full keyboard navigation
- Visible focus ring
- Form errors: `role="alert"`, `aria-describedby`
- Dialog/Sheet: focus trap, Escape closes
- Tables: `<caption>`
- Status badges: text label present
- Timetable grid: `role="grid"`, empty cells `aria-label="Add slot for {day} Period {n}"`
- RoleSwitcher: `aria-haspopup="menu"`, `aria-expanded`
- Feature toggles: `role="switch"`, `aria-checked`
- **Login ID copy button:** `aria-label="Copy login ID for {studentName}"`
- **Role edit drawer LAST_ADMIN error:** `role="alert"`

**Testing:** axe-core in CI on all 15 screens.

***

## 7. Performance Budgets (LOCKED)

- **LCP:** ≤ 2,500ms (mobile 4G)
- **INP:** ≤ 200ms
- **CLS:** ≤ 0.1
- **Initial JS bundle:** tenant app ≤ 250KB gzipped | SA portal ≤ 150KB gzipped

**Techniques:**

- Code splitting: `React.lazy` + `Suspense` per route
- Icons: SVG only (lucide-react)
- Virtualized lists: Student list if > 200 rows
- Timetable: no virtualization (≤ 7 days × 15 periods)

***

## 8. Security \& Privacy (Frontend)

- **XSS:** No `dangerouslySetInnerHTML`
- **CSRF:** Not applicable (Bearer JWT)
- **Token storage:** `localStorage` — acceptable for school data
- **PII:** Names, emails, DOB rendered — never logged in production, never in URL params
- **Secrets:** No secrets in `VITE_*` env vars
- **Login ID handling:** Displayed for admin distribution — not a real email address

***

## 9. Observability (Frontend)

**Logging/telemetry:** None. No Sentry, Mixpanel, GA in MVP.

**Console rules:** Production: no `console.log`/`console.error` — strip via Vite minify + ESLint.

***

## 10. Testing Strategy (LOCKED)

| Layer | Tool | Scope |
| :-- | :-- | :-- |
| Unit | Vitest | Utility functions, Zod schemas, role-gating logic |
| Component | Vitest + RTL | Forms, RoleSwitcher, attendance correction row, timetable cell |
| Integration | Vitest + MSW | Full screen flows against mocked API (OpenAPI 3.5.0 shapes) |
| E2E | Playwright | Login→dashboard, record attendance, role switch, create tenant |
| A11y | axe-core | All 15 screens in CI |

**Contract alignment (REQUIRED):** All MSW handlers use OpenAPI 3.5.0 shapes. Invented API calls → test fails until backend CR approved.

**MVP test checklist (required before production deploy):**

- Tenant login: all error states (400, 401, 403 `TENANT_INACTIVE`, 404)
- Role switch dropdown: success, 403 `SINGLE_ROLE_USER`, loading
- Sidebar: correct items per `activeRole` (Teacher/Admin/Student)
- Dashboard: role-specific content
- Timetable cell click (empty): drawer opens with pre-filled `dayOfWeek` + `periodNumber`
- Timetable cell click (filled): Popover + End Assignment works
- Record Attendance: full submit including exception map
- Attendance correction: `SAME_STATUS` guard, successful correction, `originalStatus` preserved
- **User Management: Edit Roles button visible for self (isSelf guard removed)**
- **User Management: self role edit — `LAST_ADMIN` inline error in drawer (not toast)**
- **User Management: POST users form has no Student option**
- **User Management: GET users list excludes Student-role users**
- **Student Management: create form includes `admissionNumber` + `dob`, no email/password**
- **Student Management: table shows Login ID read-only with copy button**
- **Student Management: no "Link Account" button/dialog**
- **Student Management: edit `dob`/`admissionNumber` shows Reset Login tooltip**
- Tenant create: admin block required validation, 409 `ADMIN_EMAIL_TAKEN`
- Tenant reactivate: 409 `ALREADY_ACTIVE`
- All 15 screens: WCAG 2.1 AA pass (axe-core)
- Lighthouse mobile: ≥ 85 on dashboard and `/attendance/record`

***

## 11. Project Structure (Frontend skeleton)

```text
tenant-app/
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx            # Router, QueryClient, ROLE_SWITCHED handler
│   │   ├── Layout.tsx         # Sidebar (role-gated nav), outlet
│   │   └── ProtectedRoute.tsx # Auth + activeRole guard
│   ├── api/
│   │   ├── client.ts          # Axios instance, 401/429 interceptors
│   │   ├── auth.ts
│   │   ├── timetable.ts
│   │   ├── attendance.ts
│   │   ├── students.ts
│   │   ├── users.ts
│   │   ├── classes.ts
│   │   ├── batches.ts
│   │   ├── subjects.ts
│   │   └── schoolPeriods.ts
│   ├── components/
│   │   ├── ui/                # shadcn/ui primitives
│   │   ├── RoleSwitcher.tsx   # CR-FE-005 DropdownMenu
│   │   ├── SessionExpiredModal.tsx
│   │   ├── BulkActionBar.tsx
│   │   └── StatusBadge.tsx
│   ├── features/
│   │   ├── auth/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   └── useAuth.ts
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx # role-specific CR-FE-006
│   │   ├── timetable/
│   │   │   ├── TimetablePage.tsx
│   │   │   ├── TimetableGrid.tsx
│   │   │   ├── TimetableCell.tsx # empty/filled cell logic CR-FE-004
│   │   │   └── CreateSlotDrawer.tsx
│   │   ├── attendance/
│   │   │   ├── RecordAttendancePage.tsx
│   │   │   ├── AttendanceSummaryPage.tsx
│   │   │   └── StudentAttendanceHistoryPage.tsx # correction row CR-FE-002
│   │   └── manage/
│   │       ├── UsersPage.tsx       # CR-12, CR-13
│   │       ├── StudentsPage.tsx    # CR-13
│   │       ├── ClassesPage.tsx
│   │       ├── BatchesPage.tsx
│   │       ├── SubjectsPage.tsx
│   │       └── SchoolPeriodsPage.tsx
│   ├── hooks/
│   │   └── useAuth.ts
│   ├── styles/
│   │   └── globals.css
│   └── types/
│       └── api.ts              # TypeScript interfaces from Section 3.2

superadmin-portal/
├── .env.example
├── package.json
├── src/
│   └── [similar structure, SA routes only]
└── [...]
```


***

## 12. Deployment, Rollback, Environments

**Hosting:** Cloudflare Pages
**Build command:** `npm run build` (Vite)
**Env mapping:** dev → mock (Prism) | staging → backend staging URL | prod → backend prod URL
**Rollback strategy:** Cloudflare Pages previous deployment rollback + CDN purge

***

## 13. Forbidden Changes (Scope Lock)

**BANNED without new Freeze version + price/time update:**

- Add routes/screens
- Change routing mode (SPA ↔ SSR/SSG)
- Change state management library
- Change auth mode (JWT ↔ sessions)
- Add i18n
- Add offline/PWA
- Change API assumptions derived from OpenAPI (endpoints/fields/status codes/error shape)

If requested → create Change Request → re-price → approve/reject.

***

## 14. Change Control (Accept-and-price rules)

**Change Request Format:**

- Requested change:
- Reason:
- Scope impact:
- Timeline impact:
- Cost impact:
- Risk impact:
- Decision: Approved / Rejected
- New Freeze version: v1.4 / v2.0
- Backend Freeze dependency: [unchanged/updated], backend Freeze version: [value]
- OpenAPI dependency: [unchanged/updated], new OpenAPI version: [value]

**Billing rule:** Per change / per hour / per day
**Response SLA for change requests:** [hours/days]

***

## 15. Version History

- **v1.0** (2026-02-26): Initial frontend freeze approved for execution.
- **v1.1** (2026-03-01): [changes from v1.0 → v1.1, if any]
- **v1.2** (2026-03-02): Backend sync v3.3 → v3.4. Role switcher dropdown (CR-FE-005), role-gated sidebar + dashboard (CR-FE-006), timetable inline cell click (CR-FE-004), UX visual refresh (CR-FE-003).
- **v1.3** (2026-03-03): **Backend sync v3.4 → v3.5.** CR-12: Admin self-role edit unblocked (isSelf guard removed, LAST_ADMIN inline in drawer). CR-13: Student auto-creation with `admissionNumber` + `dob` + `loginId`, Link Account removed, users page excludes Student-role, roles enum `Teacher | Admin` only. CR-11: no frontend change (already live in v1.2). Timeline: 9–13 weeks (+3 days).

***

**END OF FRONTEND PROJECT FREEZE v1.3**

