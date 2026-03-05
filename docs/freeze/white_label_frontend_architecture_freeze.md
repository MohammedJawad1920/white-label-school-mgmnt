
# FRONTEND PROJECT FREEZE: White-Label School Management System

**Version:** 1.4 (IMMUTABLE)
**Date:** 2026-03-04
**Status:** APPROVED FOR EXECUTION
**Supersedes:** v1.3 (2026-03-03)
**Backend Freeze:** v3.6 (2026-03-03)
**OpenAPI:** 3.6.0

> **CRITICAL INSTRUCTION FOR EXECUTION (HUMAN OR AI):**
> This document is the Absolute Source of Truth. v1.3 is SUPERSEDED.
> You have NO authority to modify routes, API assumptions, or constraints defined below.
> If any request contradicts this document, you must REFUSE and open a Change Request instead.

***

## Change Requests Applied in v1.4

### CR-FE-008: Backend Contract Sync v3.5 → v3.6 + Gap Resolutions

| CR / Gap | Title | Type | FE Impact |
| :-- | :-- | :-- | :-- |
| CR-14 | SNAKE_CASE error codes | Breaking | All error codes in screen specs verified against v3.6 enum — already SNAKE_CASE, no screen changes required |
| CR-15 | Single-resource GET for users/students | Additive | Available for edit drawer detail fetching in future CRs — not yet used in screen specs |
| CR-17 | Tenant timezone field | Additive | `timezone` field added to Tenant create/edit form in SuperAdmin portal |
| CR-18 | Class promotion endpoint | Additive | Promotion UI added inline to `/manage/classes` — dialog per row, no new route |
| CR-19 | loginId pseudo-email validator | Clarification | Login email validator fixed: `z.string().min(1)` replaces `z.string().email()` |
| CG-01 | Student attendance self-view | Unblocked | Student dashboard gains own attendance history (read-only). Backend auth guard live in v3.6 |
| GAP-03 | Login placeholder | UX | Field placeholder updated to `"Email or Student Login ID"` |
| GAP-04 | Caching table incomplete | Structural | Full caching table completed — all TQ keys locked |
| GAP-05 | Security section | Hardening | CSP + `X-Frame-Options` via Cloudflare Pages `_headers` |
| GAP-06 | Change control placeholders | Structural | Billing and SLA values filled |
| GAP-07 | v1.1 history | Structural | Marked undocumented — retroactively unrecoverable |
| GAP-08 | No CI/CD definition | Structural | GitHub Actions pipeline locked |
| GAP-09 | Class promotion missing from NO list | Scope | Promotion UI scoped into v1.4 (inline dialog) |
| GAP-11 | Admin attendance dashboard visibility | Scope | Explicitly added to NO list |
| GATE-01 | Error boundaries | New | Per-route + root boundary defined |
| GATE-02 | Browser support matrix | New | Locked |
| GATE-03 | Dependency governance | New | Strict approval checklist locked |

**Timeline impact:** +1 day (class promotion UI). New total: **9–13 weeks + 4 days**.

***

## 0. Commercials (Accept-and-price)

**Engagement Type:** Fixed-scope
**Chosen Package:** Standard
**Price \& Payment Schedule:** Self-funded solo project — no external billing
**Timeline Range (weeks):** 9–13 (+4 days)
**Assumptions (must be true):**

- Solo developer is single decision maker
- Backend v3.6 available at staging by Week 3
- Prism mock used until backend ready

**Support Window (post-delivery):**

- Bugfix support: 30 days
- Enhancements: billed as Change Requests

***

## 1. The "Iron Scope" (Frontend only)

**Core Value Proposition (One Sentence):**
> A web frontend for a white-label school management SaaS enabling teachers to record attendance, students to view their own schedules and attendance, and admins to manage timetables and school configuration — delivered as a mobile-first SPA on Cloudflare Pages.

**The 12 Frontend User Stories (COMPLETE SCOPE):**

1. As a tenant user (Teacher, Admin, or Student), I can log in with email/loginId, password, and school ID, so that I access only my school's data.
2. As a Teacher, I can see today's own assigned classes on a role-specific dashboard and navigate to record attendance.
3. As an Admin, I can see today's full schedule with a stat summary bar on a role-specific dashboard.
4. As a Student, I can see today's school-wide timetable (read-only) and my own attendance history on my dashboard.
5. As a Teacher or Admin, I can view the full timetable grid — Admin can add a slot by clicking an empty cell and end an assignment by clicking a filled cell.
6. As a Teacher or Admin, I can record attendance for a class period by selecting statuses for each student.
7. As an Admin, I can view a student's full attendance history and correct an individual record with `originalStatus` preserved.
8. As an Admin, I can view a monthly attendance summary for a student.
9. As an Admin, I can manage users (Teacher/Admin roles only), students (with auto login account creation via admission number + date of birth), classes (including year-end promotion), batches, subjects, and school periods.
10. As a multi-role user, I can switch my active role via a dropdown — the sidebar and dashboard immediately reflect only pages relevant to that role.
11. As a SuperAdmin, I can manage tenants (create with admin block and timezone, update, deactivate, reactivate) and their feature flags from an isolated portal.
12. As an Admin, I can promote all students from one class to another at year-end via a confirmation dialog.

**The "NO" List (Explicitly Out of Scope):**

- No forgot password / password reset flow (admin resets via DB or automatic Reset Login on DOB/admissionNumber update)
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
- No student-to-user manual linking (auto-created via `POST /students` since v3.5)
- No `PUT /students/:id/link-account` in any frontend flow (deprecated endpoint, migration-only on backend)
- No attendance submission status on Admin dashboard (Admin navigates to Record Attendance screen to check)
- No year-end class promotion dedicated route (inline dialog in `/manage/classes` only)
- No student profile fields beyond school data (no photo, address, guardian contact)

**User Roles (UI behavior truth):**


| activeRole | Sidebar Items | Key Restrictions |
| :-- | :-- | :-- |
| Teacher | Dashboard, Timetable, Record Attendance | Timetable read-only; no attendance summary/history |
| Admin | Dashboard, Timetable, Attendance Summary, Attendance History, Manage Users, Students, Classes, Batches, Subjects, School Periods | Users page shows Teacher/Admin only; Students page shows Student accounts; Edit Roles shown for self with LAST_ADMIN inline guard |
| Student | Dashboard, Timetable | Timetable read-only; Attendance self-view read-only; no record/manage actions |
| SuperAdmin | Isolated portal: Tenants, Feature Flags | No tenant app access whatsoever |

Role switcher shown only when `user.roles.length > 1`.

**Success Definition (measurable):**

1. Teacher can log in, view own classes, and record attendance end-to-end against live backend.
2. Admin can create a timetable entry by clicking an empty cell, correct an attendance record, create a student (auto-provisioned login account), promote a class, and bulk-delete users.
3. Student can log in with loginId, view today's timetable, and view own attendance history.
4. Multi-role Teacher+Admin user switches roles via dropdown — sidebar changes immediately, no page reload.
5. SuperAdmin can create a tenant with admin block and timezone, reactivate an inactive tenant, and toggle feature flags.
6. All 16 screens pass WCAG 2.1 AA automated checks (axe-core); Lighthouse mobile ≥ 85 on `/dashboard` and `/attendance/record`.

***

## 1.2 Assumptions \& External Dependencies

**Primary Backend/API:** White-Label School Management System

- Dev: `http://localhost:3000/api`
- Mock: `http://localhost:4010/api` (Prism)
- Staging/Prod: `VITE_API_BASE_URL` from env

**Design Source:** None — no Figma. Tailwind CSS v3 + shadcn/ui. CR-FE-003 visual rules locked in Section 5.

### Required Backend Inputs (LOCKED)

**Backend Freeze Doc version:** v3.6 (2026-03-03)
**OpenAPI Contract File (REQUIRED):**

- File name: `openapi.yaml`
- Version: `3.6.0`
- Location: `.docs/openapi.yaml`

**Contract immutability rule:**

- Frontend MUST NOT invent endpoints, fields, status codes, or error shapes not present in OpenAPI 3.6.0.
- Any new UI need → backend Change Request + new backend Freeze version + updated OpenAPI → then frontend Change Request.

**Known implementation dependency (CG-01 residual):**
Student self-view requires the student's `studentId`. This is NOT present in the JWT payload (JWT contains `userId` only). Resolution: backend must include `studentId` in the login response for Student-role users, OR expose `GET /students/me`. This is a pending backend CR. Student attendance self-view screen is specced but must not be built until this dependency is resolved. If unresolved at implementation time, the CG-01 placeholder remains.

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
| `/students/:studentId/attendance` | Student Attendance History | Protected | Admin only (Student self-view pending CG-01 backend CR) |
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

**Total screens: 16**

***

## 2.1 Screen Specifications

### Screen: Tenant Login

- **Goal:** Authenticate tenant user, store JWT, handle all error cases.
- **API calls:**

1. `POST /auth/login` → 200: store token + user in `localStorage['auth']`, redirect `/dashboard` | 401: "Invalid email or password." | 403 `TENANT_INACTIVE`: "This school account has been deactivated. Contact your platform administrator." | 404: "School not found. Check the school ID and try again." | 400: field-level errors from `error.details`.
- **Local state:** form fields, `submitting: boolean`, `globalError: string | null`
- **Server state:** None (form POST only — no TanStack Query)
- **Loading:** Submit button spinner, disabled
- **Form validation:** `email` → `z.string().min(1)` (**NOT `.email()` — student loginIds like `530@school.local` are pseudo-emails exempt from RFC 5322**) | `password` required minLength 8 | `tenantSlug` required minLength 1 maxLength 100
- **Field placeholder:** `email` field → `"Email or Student Login ID"`
- **Permissions:** Public. Already authenticated → redirect `/dashboard`.
- **A11y:** `htmlFor` labels, `aria-describedby` on error messages, autofocus on email, submit on Enter.

***

### Screen: Dashboard

- **Goal:** Role-specific view of today's schedule with relevant CTAs.
- **API calls:**

1. `GET /timetable?date=today` → 200: render per-role content | 403 `FEATURE_DISABLED`: full-page "Timetable feature not enabled" | 401: session expiry flow.
2. Student only: `GET /students/:studentId/attendance?from={30daysAgo}&to={today}&limit=10` → 200: render recent attendance list | 403 `STUDENT_ACCESS_DENIED`: show CG-01 placeholder (pending backend CR for studentId discovery).
- **Server state:** TQ key `['timetable', 'today', isoDate]`. Stale 5 min. Refetch on focus. TQ key `['student-attendance', studentId, from, to]` (Student only). Stale 5 min.
- **Loading:** 3 skeleton slot cards.
- **Role-specific content:**
    - **Teacher:** Filter client-side `slot.teacherId === currentUser.id`. Slot cards with "Record Attendance" CTA → `/attendance/record` with `state.slotId`. Empty: "No classes assigned to you today."
    - **Admin:** All slots. Stat summary bar: Total Periods N | Scheduled N | Unassigned N (derived client-side). No record CTA. Empty: "No classes scheduled for today."
    - **Student:** All slots read-only. Below timetable: recent attendance list (last 10 records, read-only). If CG-01 backend CR unresolved: placeholder "My Attendance coming soon. Contact your admin for your attendance records."
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
- **Cell interactions:**
    - Empty cell (Admin): hover `bg-muted/30 border-dashed` + icon → click → `setActiveCell({dayOfWeek, periodNumber})` → create drawer. Fields: `classId` select required, `subjectId` select required, `teacherId` select (Teacher-role users) required, `effectiveFrom` date required — `dayOfWeek` + `periodNumber` pre-filled read-only.
    - Filled cell (Admin): click → `setActiveSlotId(slot.id)` → Popover with subject/teacher/class/dates + "End Assignment" confirmation dialog → `PUT /timetable/:id/end`.
    - Teacher/Student: cells non-interactive, plain read-only display.
- **Form validation (create):** `classId` required | `subjectId` required | `teacherId` required | `dayOfWeek` pre-filled read-only | `periodNumber` pre-filled read-only integer ≥ 1 | `effectiveFrom` required YYYY-MM-DD (UX warn if past — not API-enforced).
- **A11y:** `role="grid"`, `role="row"`, `role="gridcell"`. Empty clickable cells: `aria-label="Add slot for {dayOfWeek} Period {n}"`. Drawers trap focus, Escape closes.
- **Performance:** `overflow-x-auto` on mobile. No virtualization needed (≤ 7 days × 15 periods).

***

### Screen: Record Attendance

- **Goal:** Record attendance for all students in a selected class period.
- **API calls:**

1. Teacher: `GET /timetable?teacherId={currentUser.id}&date=today` | Admin: `GET /timetable?date=today`
2. `GET /students?classId={selectedClassId}&limit=200`
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

1. `GET /students/:studentId/attendance?from={from}&to={to}&limit={limit}&offset={offset}` → 200: table + student header | 404: "Student not found." | 403 `STUDENT_ACCESS_DENIED`: "You do not have access to this student's records."
2. Admin: `PUT /attendance/:recordId` → 200: invalidate `['student-attendance', studentId]`, toast "Attendance corrected." | 400 `SAME_STATUS`: inline "Status is already {status} — no change needed." | 400 `FUTURE_DATE`: inline "Cannot correct a future record." | 403/404: toast.
- **Local state:** `dateFrom`, `dateTo`, `page`, `correctingRecordId: string | null`, `correctionStatus: string`
- **Server state:** TQ key `['student-attendance', studentId, from, to, page]`. Stale 2 min.
- **Loading:** Table skeleton 10 rows. **Empty:** "No attendance records found for this period."
- **Correction:** Table columns: Date | Subject | Period | `originalStatus` badge (never changes) | `status` effective badge | Corrected By | Action (Admin only). `originalStatus` always visible — immutable audit trail.
- **Form validation:** correction `status` required enum `Present|Absent|Late`, must differ from current effective status (client guard; server 400 `SAME_STATUS`).
- **Permissions:** Admin: any student in tenant. Student: own record only (pending CG-01 backend CR). Others → inline "Not authorized for current role."
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

### Screen: User Management (`/manage/users`)

- **Goal:** List, create, update roles, and delete Teacher/Admin users. Student-role users NOT shown here.
- **API calls:**

1. `GET /users?role={filter}&search={q}` — Student-role excluded automatically; role filter enum `Teacher | Admin` only.
2. `POST /users` → 201: invalidate `users` | 409: "Email already exists." | 400 `INVALID_ROLE`: "Student accounts must be created via the Students page." | 400: field errors.
3. `PUT /users/:id/roles` → 200: invalidate | 403 `LAST_ADMIN`: inline in role edit drawer "Cannot remove Admin role — you are the last admin of this school." | 404: toast.
4. `DELETE /users/bulk` → 200: result toast, failed rows highlighted red.
5. `DELETE /users/:id` → 204: toast | 409: "Cannot delete user — has active records."
- **Local state:** `selectedIds: Set<string>`, `createDrawerOpen`, `roleEditUserId`, `searchQuery`, `roleFilter`
- **Server state:** TQ key `['users', roleFilter, searchQuery]`. Stale 2 min.
- **Loading:** Table skeleton 10 rows. **Empty:** "No users found."
- **Form validation (create):** `name` required max 255 | `email` required valid | `password` required min 8 | `roles` required ≥ 1, values in `['Teacher', 'Admin']` only.
- **Form validation (update roles):** `roles` required non-empty, values in `['Teacher', 'Admin']`, no duplicates.
- **Permissions:** Edit Roles button shown for ALL users including current user (isSelf guard REMOVED — CR-12). 403 `LAST_ADMIN` → inline error in drawer (not toast). Delete button hidden for current user.
- **A11y:** Checkbox rows `aria-label="Select {userName}"`. Bulk bar `aria-live="polite"`. LAST_ADMIN inline error: `role="alert"`.

***

### Screen: Student Management (`/manage/students`)

- **Goal:** List, create, update, and delete students. Each student auto-has a login account.
- **API calls:**

1. `GET /students?classId=&batchId=&search=&limit=50&offset=0`
2. `POST /students` → 201: toast "Student created. Login ID: {loginId}" | 409 `ADMISSION_NUMBER_CONFLICT`: inline | 400 `CLASS_BATCH_MISMATCH`: inline.
3. `PUT /students/:id` → 200: invalidate | 409 `ADMISSION_NUMBER_CONFLICT`: inline | 400/404: toast.
4. `DELETE /students/bulk` → 200: result toast.
5. `DELETE /students/:id` → 204 | 409: "Cannot delete student — has attendance records."
- **Local state:** `selectedIds: Set<string>`, `createDrawerOpen`, `editStudentId: string | null`, `searchQuery`
- **Server state:** TQ key `['students']`. Stale 2 min.
- **Loading:** Table skeleton 10 rows. **Empty:** "No students found."
- **Table columns:** Name | Class | Batch | Admission No. | Date of Birth | Login ID (read-only `<code>`, copy button) | Actions
- **Login ID display:** Read-only `<code>`. Copy-to-clipboard button. Tooltip: "Share this login ID with the student. Password is their admission number + date of birth (DDMMYYYY)."
- **Form validation (create):** `name` required max 255 | `classId` required | `batchId` required, must match `class.batchId` | `admissionNumber` required max 50 | `dob` required YYYY-MM-DD | No `email` or `password` field.
- **Form validation (edit):** All fields optional. If `dob` or `admissionNumber` touched: warning tooltip "Changing this will reset the student's login password."
- **Permissions:** Admin only.
- **A11y:** Login ID copy button: `aria-label="Copy login ID for {studentName}"`. DOB/admission fields `aria-describedby` pointing to reset-password warning.
- **Performance:** Virtualize rows if > 200 students.

***

### Screen: Class Management (`/manage/classes`)

- **Goal:** List, create, delete classes. Year-end student promotion via inline dialog.
- **API calls:**

1. `GET /classes` → 200: list.
2. `POST /classes` → 201: invalidate `['classes']`.
3. `DELETE /classes/bulk` → 200.
4. `DELETE /classes/:id` → 204 | 409: "Cannot delete — students enrolled."
5. `PUT /classes/:sourceClassId/promote` → 200: invalidate `['students']` + `['classes']`, toast "Students promoted to {targetClass}." | 400 `SAME_CLASS`: inline "Source and target class cannot be the same." | 404: toast.
- **Promote action (per row — Admin only):**
    - Button disabled with tooltip "No students to promote." if class has 0 students.

```
- Click → `<Dialog>`: source class pre-filled read-only, target class `<Select>` (all classes, source excluded) required → confirm "Move all students from {sourceClass} to {targetClass}? This cannot be undone." → `PUT /classes/:sourceClassId/promote { targetClassId }`.
```

- **Local state:** `createDrawerOpen`, `promoteSourceClassId: string | null`, `promoteTargetClassId: string | null`
- **Server state:** TQ key `['classes']`. Stale 5 min.
- **A11y:** Promote dialog focus trap. Confirm button `aria-describedby` warning text. Escape cancels.

***

### Screens: Batch / Subject Management

| Screen | Route | TQ Key | Create Fields | Key 409 |
| :-- | :-- | :-- | :-- | :-- |
| Batches | `/manage/batches` | `['batches']` | `name` max 100, `startYear`, `endYear`, `status` Active/Archived | Cannot delete — classes reference this batch |
| Subjects | `/manage/subjects` | `['subjects']` | `name` required max 255, `code` optional max 50 | Cannot delete — timetable slots reference this subject |

All: stale 5 min | skeleton + "No {entity} found." | create/edit drawer | bulk delete + single delete (Admin only).

***

### Screen: School Periods (`/manage/school-periods`)

- **API calls:**

1. `GET /school-periods` → 200 | 403 `FEATURE_DISABLED`: full-page gate.
2. `POST /school-periods` → 201: invalidate | 409: "Period number {n} already exists." | 400 `PERIOD_TIME_INVALID`: "Start time must be before end time."
3. `PUT /school-periods/:id` → 200: invalidate | 400: inline | 404: toast.
4. `DELETE /school-periods/:id` → 204: invalidate `['school-periods']` AND `['timetable']` | 409 `HAS_REFERENCES`: inline "Cannot delete — active timetable slots use this period."
- **Local state:** `createDrawerOpen`, `editPeriodId`, `deleteConfirmPeriodId`
- **Server state:** TQ key `['school-periods']`. Stale 5 min.
- **Form validation:** `periodNumber` required integer ≥ 1, unique, immutable after creation | `label` optional max 100 | `startTime` required `HH:mm` | `endTime` required, strictly after `startTime`.
- **A11y:** `periodNumber` is `aria-disabled="true"` on edit with tooltip "Period number cannot be changed after creation."

***

### Screen: SuperAdmin Login

- **API calls:** `POST /super-admin/auth/login` → 200: store in `localStorage['sa-auth']`, redirect `/tenants` | 401: "Invalid email or password." | 400: field errors.
- **Form validation:** `email` required valid | `password` required minLength 8.
- **Permissions:** Public. Authenticated → redirect `/tenants`.

***

### Screen: Tenant Management (`/tenants`)

- **Goal:** List, create, update, deactivate, reactivate tenants.
- **API calls:**

1. `GET /super-admin/tenants?status={filter}&search={q}`
2. `POST /super-admin/tenants` → 201: invalidate `['sa-tenants']`, toast "Tenant created." | 409 `CONFLICT`: "Tenant ID or slug already exists." | 409 `ADMIN_EMAIL_TAKEN`: "Admin email already exists." | 400: field error.
3. `PUT /super-admin/tenants/:id` → 200: invalidate.
4. `PUT /super-admin/tenants/:id/deactivate` → 200 | 409 `ALREADY_INACTIVE`: "Tenant is already inactive."
5. `PUT /super-admin/tenants/:id/reactivate` → 200: toast "Tenant reactivated." | 409 `ALREADY_ACTIVE`: "Tenant is already active."
- **Local state:** `createDrawerOpen`, `editTenantId`, `deactivateConfirmId`, `reactivateConfirmId`, `searchQuery`, `statusFilter`
- **Server state:** TQ key `['sa-tenants', statusFilter, searchQuery]`. Stale 1 min.
- **Create form:**
    - Section 1: `id` required alphanumeric/dash max 50 | `name` required max 255 | `slug` required `a-z0-9-` max 100 | `timezone` optional, default `Asia/Kolkata` (IANA select, date-fns powered)
    - Section 2: `admin.name` required max 255 | `admin.email` required valid | `admin.password` required minLength 8
- **Edit form:** `name`, `slug`, `timezone` — all optional.
- **Row actions:** Active → Edit, Deactivate. Inactive → Edit, Reactivate.
- **A11y:** Deactivate/Reactivate confirmations are `<Dialog>` with focus trap — Escape cancels.

***

### Screen: Tenant Feature Flags (`/tenants/:tenantId/features`)

- **API calls:**

1. `GET /super-admin/tenants/:tenantId/features` → 200 | 404: "Tenant not found."
2. `PUT /super-admin/tenants/:tenantId/features/:featureKey` → 200 | 400 `FEATURE_DEPENDENCY`: revert optimistic toggle, inline "Attendance requires Timetable to be enabled first." | 404: toast.
- **Local state:** Optimistic toggle state per feature key.
- **Server state:** TQ key `['sa-features', tenantId]`. Stale 30 sec.
- **Permissions:** Attendance toggle disabled/greyed when timetable is disabled.
- **A11y:** `role="switch"`, `aria-checked`, `aria-label="{featureName}"`.

***

### Static Screens: Privacy \& Terms

Public. Hardcoded text. Privacy covers DPDPA 2023: data collected, purpose, retention, user rights, contact.

***

## 3. API Assumptions (Frontend contract expectations)

### 3.0 Backend Contract (LOCKED)

**Backend Freeze version:** v3.6 (2026-03-03)
**OpenAPI file:** `openapi.yaml`
**OpenAPI version:** `3.6.0`
**File path:** `.docs/openapi.yaml`

**Base URL:** `VITE_API_BASE_URL` from env — never hardcoded.
**Auth:** Bearer JWT. Header: `Authorization: Bearer {token}`. Storage: `localStorage['auth']` (tenant), `localStorage['sa-auth']` (SuperAdmin).

**Global error shape (MUST match OpenAPI 3.6.0):**

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

All error codes are `SNAKE_CASE` — standardized in v3.6 CR-14.

***

### 3.1 Mock Server (REQUIRED)

**Tool:** Prism (`@stoplight/prism-cli`)

```bash
npm install -g @stoplight/prism-cli
prism mock .docs/openapi.yaml --port 4010
# VITE_API_BASE_URL=http://localhost:4010/api
```

**Failure simulation plan:**


| Scenario | Header | Endpoint |
| :-- | :-- | :-- |
| Missing/invalid token | `Prefer: code=401` | Any protected endpoint |
| Inactive tenant login | `Prefer: code=403` | `POST /auth/login` |
| Period not configured | `Prefer: code=400` | `POST /timetable` |
| Duplicate email | `Prefer: code=409` | `POST /users` |
| Student role in POST users | `Prefer: code=400` | `POST /users` |
| Duplicate admission number | `Prefer: code=409` | `POST /students` |
| Batch mismatch | `Prefer: code=400` | `POST /students` |
| Resource not found | `Prefer: code=404` | Any `/:id` endpoint |
| Last admin guard | `Prefer: code=403` | `PUT /users/:id/roles` |
| Same status correction | `Prefer: code=400` | `PUT /attendance/:recordId` |
| Same class promotion | `Prefer: code=400` | `PUT /classes/:sourceClassId/promote` |
| Student access denied | `Prefer: code=403` | `GET /students/:studentId/attendance` |


***

### 3.2 Typed API Surface (LOCKED — matches OpenAPI 3.6.0 exactly)

```ts
// ERRORS
interface ApiError {
  error: { code: string; message: string; details?: Record<string, unknown> };
  timestamp: string;
}

// AUTH
type TenantRole = 'Teacher' | 'Admin' | 'Student';
type UserRole   = 'Teacher' | 'Admin';

interface TenantUser {
  id: string; tenantId: string; name: string; email: string;
  roles: TenantRole[]; activeRole: TenantRole;
}
interface TenantLoginRequest  { email: string; password: string; tenantSlug: string; }
interface TenantLoginResponse { token: string; user: TenantUser; }
interface SwitchRoleRequest   { role: TenantRole; }
interface SwitchRoleResponse  { token: string; user: TenantUser; }

// TENANT (v3.6 CR-17)
interface Tenant {
  id: string; name: string; slug: string;
  status: 'active' | 'inactive';
  timezone: string;
  deactivatedAt: string | null;
  createdAt: string; updatedAt: string;
}
interface CreateTenantRequest {
  id: string; name: string; slug: string;
  timezone?: string;
  admin: { name: string; email: string; password: string; };
}
interface UpdateTenantRequest { name?: string; slug?: string; timezone?: string; }

// STUDENTS
interface Student {
  id: string; name: string;
  classId: string; className: string;
  batchId: string; batchName: string;
  admissionNumber: string; dob: string;
  loginId: string; userId: string | null;
}
interface CreateStudentRequest {
  name: string; classId: string; batchId: string;
  admissionNumber: string; dob: string;
}
interface UpdateStudentRequest {
  name?: string; classId?: string; batchId?: string;
  admissionNumber?: string; dob?: string;
}

// USERS
interface User               { id: string; name: string; email: string; roles: UserRole[]; }
interface CreateUserRequest  { name: string; email: string; password: string; roles: UserRole[]; }
interface UpdateRolesRequest { roles: UserRole[]; }

// CLASSES (v3.6 CR-18)
interface PromoteRequest  { targetClassId: string; }
interface PromoteResponse {
  promoted: string[];
  failed: Array<{ id: string; reason: string }>;
}

// ATTENDANCE
type AttendanceStatus = 'Present' | 'Absent' | 'Late';
interface AttendanceRecord {
  id: string; date: string;
  originalStatus: AttendanceStatus;
  status: AttendanceStatus;
  correctedBy: string | null; correctedAt: string | null;
  timeSlot: TimeSlot;
  recordedBy: string; recordedAt: string;
}
interface CorrectAttendanceRequest { status: AttendanceStatus; }

// FEATURES
interface Feature {
  id: string; key: 'timetable' | 'attendance';
  name: string; description: string; enabled: boolean;
}

// PAGINATION
interface Pagination { limit: number; offset: number; total: number; }
```


***

### 3.3 Caching \& Invalidation Rules (LOCKED — complete)

| TQ Key | Stale Time | Invalidated By |
| :-- | :-- | :-- |
| `['timetable', filters]` | 5 min | `POST /timetable`, `PUT /timetable/:id/end`, `DELETE /school-periods/:id` |
| `['timetable', 'today', isoDate]` | 5 min | Refetch on window focus |
| `['students']` | 2 min | `POST /students`, `PUT /students/:id`, `DELETE /students/:id`, `DELETE /students/bulk` |
| `['students', 'classId', classId]` | 2 min | `POST /students`, `PUT /students/:id`, `DELETE /students/:id`, `DELETE /students/bulk` |
| `['users', roleFilter, searchQuery]` | 2 min | `POST /users`, `PUT /users/:id/roles`, `DELETE /users/:id`, `DELETE /users/bulk` |
| `['student-attendance', studentId, from, to, page]` | 2 min | `PUT /attendance/:recordId` |
| `['student-attendance', studentId, from, to]` | 5 min | `PUT /attendance/:recordId` |
| `['batches']` | 5 min | `POST /batches`, `PUT /batches/:id`, `DELETE /batches/:id`, `DELETE /batches/bulk` |
| `['classes']` | 5 min | `POST /classes`, `PUT /classes/:id`, `DELETE /classes/:id`, `DELETE /classes/bulk`, `PUT /classes/:sourceClassId/promote` |
| `['subjects']` | 5 min | `POST /subjects`, `PUT /subjects/:id`, `DELETE /subjects/:id`, `DELETE /subjects/bulk` |
| `['school-periods']` | 5 min | `POST /school-periods`, `PUT /school-periods/:id`, `DELETE /school-periods/:id` |
| `['sa-tenants', statusFilter, searchQuery]` | 1 min | `POST /super-admin/tenants`, `PUT /super-admin/tenants/:id`, deactivate, reactivate |
| `['sa-features', tenantId]` | 30 sec | `PUT /super-admin/tenants/:tenantId/features/:featureKey` |


***

### 3.4 Retry Rules (LOCKED)

- **GET requests:** Retry up to 3 times, exponential backoff (1s, 2s, 4s).
- **Mutations (POST/PUT/DELETE):** Never retry automatically.
- **401:** Axios interceptor fires `window.CustomEvent('AUTH_EXPIRED')`, clears `localStorage['auth']`, sets `isExpired: true` → `SessionExpiredModal`.
- **403:** Surface `error.code` + `error.message` inline or toast. `LAST_ADMIN` shown inline in drawer. `STUDENT_ACCESS_DENIED` shown inline on attendance screen.
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
```

**Cross-tab:** No multi-tab sync. Each tab independently handles 401.

***

## 4.1 Error Boundary Strategy (LOCKED)

- **Per-route boundary:** Every route wrapped in its own `<ErrorBoundary>`. On error: inline error card — "Something went wrong. Try refreshing the page." + Retry button (`onClick={() => window.location.reload()}`).
- **Root boundary:** Single boundary at `App.tsx` catches anything escaping per-route boundaries. Same error card UI.
- **Observability:** No telemetry in MVP. Errors logged to `console.error` in dev only — stripped in production.

***

## 5. Design System \& UI Constraints

**Color system:**

- Background: `bg-background` | Surface: `bg-card border border-border shadow-sm` | Primary: shadcn/ui default
- Status badges: Present `bg-green-100 text-green-800` | Absent `bg-red-100 text-red-800` | Late `bg-yellow-100 text-yellow-800`
- Contrast minimum 4.5:1 (WCAG 2.1 AA)

**Typography (LOCKED):**

- Page headings: `text-2xl font-bold tracking-tight`
- Section headings: `text-base font-semibold`
- Table headers: `text-xs font-semibold text-muted-foreground uppercase tracking-wide`
- Body: `text-sm text-foreground`
- Muted/secondary: `text-xs text-muted-foreground`

**Spacing scale:** Tailwind default — `4px` base unit. Component padding: `p-4`. Section gaps: `gap-6`.

**Sidebar:**

- Fixed left, `w-56` desktop, collapses on mobile
- Top: app name, RoleSwitcher dropdown (if `roles.length > 1`) + role badge
- Active nav: `bg-primary/10 text-primary font-medium rounded-lg` | Inactive: `text-muted-foreground hover:bg-muted`
- Nav items rendered strictly from `user.activeRole`

**Component standards:**

- Cards: `rounded-xl border bg-card shadow-sm p-4`
- Tables: header `bg-muted/50 border-b` | rows `border-b hover:bg-muted/40`
- Timetable: filled cells as subject chip | empty cells (Admin): `hover:bg-muted/30 border-dashed cursor-pointer`
- Modals/Drawers: shadcn/ui `Sheet` (forms), `Dialog` (confirmations)
- Toasts: shadcn/ui Sonner
- Buttons: `min-height: 44px` touch target

**Component inventory (MVP):**
Button, Input, Select, Checkbox, RadioGroup, Switch, Badge, Card, Table, Sheet, Dialog, Popover, DropdownMenu, Toast (Sonner), Skeleton, Avatar, Tooltip, Copy button.

**Responsiveness:** Mobile-first. Breakpoints: `sm: 640px`, `md: 768px`, `lg: 1024px`. Timetable: `overflow-x-auto` on `< 768px`.

***

## 6. Accessibility (A11y) Baseline (LOCKED)

**Target:** WCAG 2.1 AA

**Mandatory behaviors:**

- Full keyboard navigation across all interactive elements
- Visible focus ring on all focusable elements
- Form errors: `role="alert"`, `aria-describedby` on input
- Dialog/Sheet: focus trap, Escape closes
- Tables: `<caption>` on all data tables
- Status badges: text label always present
- Timetable grid: `role="grid"`, `role="row"`, `role="gridcell"`
- Empty cells: `aria-label="Add slot for {dayOfWeek} Period {n}"`
- RoleSwitcher: `aria-haspopup="menu"`, `aria-expanded`
- Feature toggles: `role="switch"`, `aria-checked`
- Login ID copy button: `aria-label="Copy login ID for {studentName}"`
- LAST_ADMIN inline error: `role="alert"`
- STUDENT_ACCESS_DENIED inline error: `role="alert"`
- Promote confirm button: `aria-describedby` pointing to warning text
- Error boundary retry button: `aria-label="Retry loading this page"`

**Testing:** axe-core in CI on all 16 screens.

***

## 7. Performance Budgets (LOCKED)

- **LCP:** ≤ 2,500ms (mobile 4G)
- **INP:** ≤ 200ms
- **CLS:** ≤ 0.1
- **Initial JS bundle:** tenant app ≤ 250KB gzipped | SA portal ≤ 150KB gzipped
- **Lighthouse mobile:** ≥ 85 on `/dashboard` and `/attendance/record`

**Techniques:**

- Code splitting: `React.lazy` + `Suspense` per route
- Icons: SVG only (lucide-react tree-shaken)
- Virtualized lists: Student list if > 200 rows
- No image assets in MVP

**CI enforcement:** Bundle size check on every PR — fail if limits exceeded.

***

## 8. Security \& Privacy (Frontend)

| Vector | Mitigation |
| :-- | :-- |
| XSS — script injection | `script-src 'self'` CSP. No `dangerouslySetInnerHTML` anywhere |
| XSS — style injection | `style-src 'self' 'unsafe-inline'` — required for Radix UI. Accepted risk: no user-controlled style injection points in scope |
| Clickjacking | `X-Frame-Options: DENY` via `_headers` |
| Input sanitization | React JSX escaping covers all render paths |
| CSRF | Not applicable — Bearer JWT, no cookies |
| Token storage | `localStorage` — accepted risk for school data. CSP is primary XSS defense |
| PII in logs | Never logged in production. `console.*` stripped via ESLint + Vite minify |
| PII in URLs | Never in query params — route params only |
| Secrets | No secrets in `VITE_*` env vars |

**Cloudflare Pages `_headers` (LOCKED):**

```
/*
  X-Frame-Options: DENY
  Content-Security-Policy: script-src 'self'; style-src 'self' 'unsafe-inline'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```


***

## 9. Observability (Frontend)

**Logging/telemetry:** None. No Sentry, Mixpanel, GA in MVP.
**Console rules:** Production: `console.log`/`console.error` stripped via Vite minify + ESLint `no-console`.
**What is NOT tracked:** user actions, page views, errors, performance metrics — all deferred post-MVP.

***

## 10. Testing Strategy (LOCKED)

| Layer | Tool | Scope |
| :-- | :-- | :-- |
| Unit | Vitest | Utility functions, Zod schemas, role-gating logic, date formatting |
| Component | Vitest + RTL | Forms, RoleSwitcher, attendance correction row, timetable cell, promote dialog |
| Integration | Vitest + MSW | Full screen flows against mocked API (OpenAPI 3.6.0 shapes) |
| E2E | Playwright | Login→dashboard, record attendance, role switch, create tenant, promote class |
| A11y | axe-core | All 16 screens in CI |

**Contract alignment:** All MSW handlers use OpenAPI 3.6.0 shapes. Invented API call → test fails until backend CR approved.

**MVP test checklist (required before production deploy):**

- Tenant login: all error states (400, 401, 403 `TENANT_INACTIVE`, 404)
- Tenant login: student loginId (`530@school.local`) passes `z.string().min(1)` validation
- Role switch: success, 403 `SINGLE_ROLE_USER`, loading state
- Sidebar: correct items per `activeRole`
- Dashboard: Teacher slots, Admin stat bar, Student timetable + attendance
- Timetable cell click (empty): drawer opens with pre-filled `dayOfWeek` + `periodNumber`
- Timetable cell click (filled): Popover + End Assignment works
- Record Attendance: full submit including exception map
- Attendance correction: `SAME_STATUS` guard, `originalStatus` preserved
- Student attendance self-view: `403 STUDENT_ACCESS_DENIED` handled inline
- User Management: Edit Roles visible for self, `LAST_ADMIN` inline in drawer
- User Management: POST users form has no Student option, GET excludes Student-role
- Student Management: `admissionNumber` + `dob` in create, Login ID copy button, Reset Login tooltip on edit
- Class Management: Promote disabled if 0 students, `SAME_CLASS` inline, cache invalidated on success
- Tenant create: `timezone` field present, defaults `Asia/Kolkata`, `ADMIN_EMAIL_TAKEN` handled
- Tenant reactivate: `409 ALREADY_ACTIVE` handled
- Error boundary: per-route boundary renders retry card on thrown error
- All 16 screens: WCAG 2.1 AA pass (axe-core)
- Lighthouse mobile: ≥ 85 on `/dashboard` and `/attendance/record`

***

## 11. Project Structure (Frontend skeleton)

```
tenant-app/
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── _headers
├── README.md
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx
│   │   ├── Layout.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── ErrorBoundary.tsx
│   ├── api/
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── timetable.ts
│   │   ├── attendance.ts
│   │   ├── students.ts
│   │   ├── users.ts
│   │   ├── classes.ts
│   │   ├── batches.ts
│   │   ├── subjects.ts
│   │   ├── schoolPeriods.ts
│   │   └── superAdmin.ts
│   ├── components/
│   │   ├── ui/
│   │   ├── SessionExpiredModal.tsx
│   │   ├── RoleSwitcher.tsx
│   │   └── Sidebar.tsx
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── timetable/
│   │   ├── attendance/
│   │   ├── students/
│   │   ├── users/
│   │   ├── classes/
│   │   ├── batches/
│   │   ├── subjects/
│   │   └── schoolPeriods/
│   ├── hooks/
│   │   └── useAuth.ts
│   ├── types/
│   │   └── api.ts
│   └── utils/
│       ├── date.ts
│       └── roles.ts

superadmin-app/
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── _headers
├── src/
│   ├── main.tsx
│   ├── app/
│   ├── api/
│   │   └── superAdmin.ts
│   ├── features/
│   │   ├── tenants/
│   │   └── features/
│   └── types/
│       └── api.ts
```

**Naming convention:** camelCase files, PascalCase components.
**Import alias:** `@/` → `src/`.

***

## 12. Deployment, Rollback, Environments

**Hosting:** Cloudflare Pages
**Build command:** `npm run build` (Vite)
**Env mapping:** dev → Prism mock (`localhost:4010`) | staging → backend staging URL | prod → backend prod URL
**Rollback strategy:** Cloudflare Pages previous deployment instant rollback + CDN purge

**CI/CD Pipeline — GitHub Actions (LOCKED):**

```yaml
# Triggers: PR → main, push → main
jobs:
  quality-gate:
    steps:
      - tsc --noEmit
      - vitest run
      - axe-core scan (all 16 screens)
      - bundle-size-check (tenant ≤ 250KB | SA ≤ 150KB gzipped)

  deploy-staging:
    needs: quality-gate
    if: push → main
    steps:
      - Deploy to Cloudflare Pages (staging)
      - playwright test (E2E against staging)
```


***

## 13. Forbidden Changes (Scope Lock)

**BANNED without new Freeze version + time update:**

- Add routes/screens
- Change routing mode (SPA ↔ SSR/SSG)
- Change state management library
- Change auth mode (JWT ↔ sessions)
- Add i18n
- Add offline/PWA
- Change API assumptions derived from OpenAPI (endpoints/fields/status codes/error shape)
- Add telemetry/analytics tooling
- Add new npm packages without passing dependency governance checklist

If requested → create Change Request → re-price → approve/reject.

***

## 14. Dependency Governance Policy (LOCKED)

A new package is allowed **only if ALL six criteria pass:**


| Criterion | Rule |
| :-- | :-- |
| Maintenance | Actively maintained — recent commits, not abandoned |
| Adoption | Widely used — high npm downloads, community trust |
| Security | No known vulnerabilities — `npm audit` clean |
| Bundle impact | Minimal size increase — checked via bundlephobia before adding |
| License | Permissive only — MIT / Apache 2.0 / BSD |
| Necessity | Cannot be solved with existing dependencies |

**Approval rule:** Architect review required before adding any new package. No silent additions.

***

## 15. Change Control (Accept-and-price rules)

**Change Request Format:**

- Requested change:
- Reason:
- Scope impact:
- Timeline impact:
- Cost impact:
- Risk impact:
- Decision: Approved / Rejected
- New Freeze version: v1.5 / v2.0
- Backend Freeze dependency: [unchanged/updated], version: [value]
- OpenAPI dependency: [unchanged/updated], version: [value]

**Billing rule:** N/A — self-funded solo project
**Response SLA:** 48 hours

***

## 16. Browser Support Matrix (LOCKED)

| Platform | Browser | Versions |
| :-- | :-- | :-- |
| Desktop | Chrome | Last 2 |
| Desktop | Firefox | Last 2 |
| Desktop | Edge | Last 2 |
| Desktop | Safari | Last 2 |
| Mobile | Chrome Android | Last 2 |
| Mobile | Safari iOS | Last 2 |
| Excluded | Internet Explorer | All |
| Excluded | All legacy browsers | — |

**Vite build target:** `["es2020", "edge88", "firefox78", "chrome87", "safari14"]`

***

## 17. Version History

- **v1.0** (2026-02-26): Initial frontend freeze approved for execution.
- **v1.1** (2026-03-01): Changes undocumented — retroactively unrecoverable. Superseded by v1.2.
- **v1.2** (2026-03-02): Backend sync v3.3 → v3.4. Role switcher dropdown (CR-FE-005), role-gated sidebar + dashboard (CR-FE-006), timetable inline cell click (CR-FE-004), UX visual refresh (CR-FE-003).
- **v1.3** (2026-03-03): Backend sync v3.4 → v3.5. CR-12: Admin self-role edit unblocked (isSelf guard removed, LAST_ADMIN inline in drawer). CR-13: Student auto-creation with `admissionNumber` + `dob` + `loginId`, Link Account removed, users page excludes Student-role. Timeline: 9–13 weeks.
- **v1.4** (2026-03-04): CR-FE-008 — Backend sync v3.5 → v3.6. CG-01 resolved: Student attendance self-view added to dashboard and history screen. Login validator fixed (`z.string().min(1)`, placeholder updated). Class promotion UI added inline to `/manage/classes`. Tenant timezone field added to create/edit forms. Full caching table completed — all TQ keys locked. Security hardened: `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `X-Frame-Options: DENY` via Cloudflare Pages `_headers`. GitHub Actions CI/CD pipeline locked. Per-route + root error boundaries defined. Browser support matrix locked. Dependency governance policy locked. v1.1 history marked undocumented. Timeline: 9–13 weeks + 4 days.

***

**END OF FRONTEND PROJECT FREEZE v1.4**