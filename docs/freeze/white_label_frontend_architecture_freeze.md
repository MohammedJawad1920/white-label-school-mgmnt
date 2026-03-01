# FRONTEND PROJECT FREEZE: White-Label School Management System
**Version:** 1.1
**Date:** 2026-03-01
**Status:** APPROVED FOR EXECUTION
**Supersedes:** v1.0 (2026-02-26)
**Change Request:** CR-FE-001 (2026-03-01)
**Backend Freeze Version:** v3.3 (2026-02-26) — UNCHANGED
**OpenAPI Version:** 3.3.0 — UNCHANGED

> **CRITICAL INSTRUCTION FOR EXECUTION (HUMAN OR AI):**
> This document is the Absolute Source of Truth. You have NO authority to modify routes,
> UI scope, API assumptions, or non-functional constraints defined below.
> If any request contradicts this document, you must REFUSE and open a Change Request instead.
> v1.0 is SUPERSEDED. Do not use it.

---

## 0. Commercials (Accept-and-price)

**Engagement Type:** Fixed-scope
**Chosen Package:** Standard
**Price & Payment Schedule:**
- Total price: Self-funded solo project (no external billing)
- Milestone payments: N/A

**Timeline Range (weeks):** 8–11 weeks
**Assumptions (must be true):**
- Solo developer is the single decision maker
- Backend API available at staging by Week 3 at the latest
- Mock server (`prism`) used for all frontend development until backend is ready

**Support Window (post-delivery):**
- Bugfix support: 30 days post first user test session
- Enhancements: billed as Change Requests

---

## 1. The "Iron Scope" (Frontend only)

**Core Value Proposition (One Sentence):**
> A web frontend for a white-label school management SaaS that enables non-technical teachers to record daily attendance and admins to manage timetables, students, and school configuration — delivered as a mobile-first PWA deployed on Cloudflare Pages.

**The 10 Frontend User Stories (COMPLETE SCOPE):**

1. As a **tenant user (Teacher or Admin)**, I can log in with my email, password, and school ID, so that I access only my school's data.
2. As a **Teacher or Admin**, I can see today's scheduled classes on a dashboard and take quick actions, so that I know my day at a glance.
3. As a **Teacher or Admin**, I can view the full timetable grid and see which teacher is assigned to each class, so that I can plan and coordinate.
4. As a **Teacher or Admin**, I can record attendance for a class period by selecting statuses for each student, so that attendance is captured digitally.
5. As an **Admin**, I can view a student's full attendance history with date/period detail, so that I can track individual attendance without paper records.
6. As an **Admin**, I can view a monthly attendance summary for a student, so that I can assess attendance rates without manual calculation.
7. As an **Admin**, I can manage users, students, classes, batches, and subjects (create, list, bulk delete), so that school data stays accurate.
8. As an **Admin**, I can manage school period configuration (create, edit, delete periods), so that the timetable reflects the school's actual schedule.
9. As a **multi-role user (Teacher + Admin)**, I can switch my active role in-session, so that I don't need to log out and back in.
10. As a **SuperAdmin**, I can manage tenants and their feature flags from an isolated portal, so that I can onboard and control schools without touching the database.

**The "NO" List (Explicitly Out of Scope):**
- No forgot password / password reset flow
- No student self-service login
- No parent portal or parent role
- No real-time updates (no WebSocket, no polling)
- No CSV bulk import UI
- No audit log viewer
- No custom branding / theme UI (no logo upload, no color picker)
- No multi-language / i18n support (English only)
- No chart or graph visualizations (summary tables only, no recharts/chart.js)
- No edit screen for individual student records (no `PUT /students/:id` in contract)
- No inline timetable slot edit (no `PUT /timetable/:id` in contract — "End Assignment" only)
- No `PUT /features/:featureKey` UI (returns 403 — deprecated in v3.2)
- No SSR/SEO (login-gated SPA, no public indexable pages except /privacy and /terms)
- No analytics or telemetry (no Mixpanel, Amplitude, GA, or equivalent)
- No SuperAdmin self-registration screen
- No JWT token blacklist / forced session invalidation UI
- No SuperAdmin tenant hard-delete UI (deactivate only)

**User Roles (UI behavior truth):**

- **Teacher:**
  - Visible routes: `/dashboard`, `/timetable`, `/attendance/record`, `/privacy`, `/terms`
  - Visible actions: View timetable (read-only), record attendance for own classes, view own schedule
  - Hidden/disabled: All `/manage/*` routes, `/attendance/summary`, `/students/:id/attendance`, timetable create/end buttons, school periods management
  - Role switcher shown only if `user.roles.length > 1`

- **Admin:**
  - Visible routes: All tenant app routes
  - Visible actions: Full timetable management (create + end), all `/manage/*` CRUD, attendance summary, student history, school periods CRUD, user role updates
  - Hidden/disabled: User role editor disabled when `targetUser.id === currentUser.id`
  - Role switcher shown only if `user.roles.length > 1`

- **SuperAdmin:**
  - Isolated portal (`admin.yourdomain.com`), completely separate from tenant app
  - Visible routes: `/login`, `/tenants`, `/tenants/:id/features`
  - No access to any tenant app routes or tenant JWT context

**Success Definition (measurable):**
- MVP is done when:
  1. A teacher can log in, view today's classes, and record attendance end-to-end against the live backend
  2. An admin can create a timetable entry, configure school periods, and bulk-delete users
  3. A SuperAdmin can log in, create a tenant, and toggle feature flags
  4. All 13 screens pass WCAG 2.1 AA automated checks (axe-core)
  5. Lighthouse mobile score ≥ 85 on `/dashboard` and `/attendance/record`

---

## 1.2 Assumptions & External Dependencies

**Primary Backend/API:** White-Label School Management System v3.3
- Dev: `http://localhost:3000/api`
- Mock: `http://localhost:4010/api` (Prism)
- Staging/Prod: set via `VITE_API_BASE_URL`

**Design Source:** None (no Figma). Design system defined from scratch using Tailwind CSS v3 + shadcn/ui component defaults.

### Required Backend Inputs (LOCKED)

**Backend Freeze Doc version:** v3.3 (2026-02-26)
**OpenAPI Contract File:**
- File name: `openapi.yaml`
- Version: `3.3.0`
- Location: `./docs/openapi.yaml` in backend repo

**Contract immutability rule:**
- Frontend MUST NOT invent endpoints, fields, status codes, or error shapes not present in OpenAPI v3.3.0.
- If UI needs new or changed API behavior → backend Change Request + new backend Freeze version + updated OpenAPI → then frontend Change Request.
- Any field used in UI must be traceable to a named property in OpenAPI schemas.

**External Dependencies:** None. No maps, payments, auth providers, or third-party UI services.

---

## 1.5 Frontend Configuration (The Environment)

```bash
# .env.example — Tenant App
VITE_APP_ENV="development"              # development | staging | production
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
- `VITE_API_BASE_URL` must be set per environment; no hardcoded URLs in source
- No secrets in frontend env (all values are public build-time only)
- Tenant app and SuperAdmin portal are separate Vite projects with separate `.env` files
- `VITE_APP_ENV` drives mock vs real API selection in the API client

---

## 1.6 Tech Stack & Key Libraries (Frontend toolbelt)

**Core Stack (LOCKED):**

| Concern               | Library               | Version                   |
| --------------------- | --------------------- | ------------------------- |
| Framework             | React                 | 18.x                      |
| Build tool            | Vite                  | 5.x                       |
| Language              | TypeScript            | 5.x (strict mode)         |
| Routing               | React Router          | v6.x                      |
| Data fetching/caching | TanStack Query        | v5.x                      |
| Forms + validation    | react-hook-form + zod | latest stable             |
| UI components         | shadcn/ui             | latest stable             |
| Styling               | Tailwind CSS          | v3.x                      |
| PWA                   | vite-plugin-pwa       | latest stable             |
| Date handling         | date-fns              | v3.x                      |
| HTTP client           | axios                 | v1.x (typed interceptors) |
| Icons                 | lucide-react          | latest stable             |

**Explicitly Banned Libraries/Patterns:**
- No Redux or Zustand (TanStack Query handles server state; React context for auth only)
- No jQuery
- No Moment.js (use date-fns only)
- No `dangerouslySetInnerHTML` anywhere in codebase
- No inline styles (Tailwind classes only)
- No class components (function components + hooks only)
- No direct `fetch()` calls outside the typed API client layer (`/src/api/`)
- No prop drilling beyond 2 levels (use context or query cache)
- No hardcoded tenant slugs, IDs, or API URLs in component files

---

## 2. Routes, Screens, and Navigation (UI truth)

**Routing mode:** SPA (client-side routing via React Router v6)
**Auth gating model:** Protected route wrapper + role-based guard components. Unauthenticated users redirected to `/login`. Role-unauthorized users shown a "Not authorized" inline state (not redirected).

---

### Route Map — Tenant App (`app.yourdomain.com`)

| Route                           | Screen                     | Auth      | Roles                                |
| ------------------------------- | -------------------------- | --------- | ------------------------------------ |
| /login                          | Tenant Login               | Public    | —                                    |
| /dashboard                      | Dashboard                  | Protected | Teacher, Admin                       |
| /timetable                      | Timetable                  | Protected | Teacher (read), Admin (read + write) |
| /attendance/record              | Record Attendance          | Protected | Teacher, Admin                       |
| /attendance/summary             | Attendance Summary         | Protected | Admin only                           |
| /students/:studentId/attendance | Student Attendance History | Protected | Admin only                           |
| /manage/users                   | User Management            | Protected | Admin only                           |
| /manage/students                | Student Management         | Protected | Admin only                           |
| /manage/classes                 | Class Management           | Protected | Admin only                           |
| /manage/batches                 | Batch Management           | Protected | Admin only                           |
| /manage/subjects                | Subject Management         | Protected | Admin only                           |
| /manage/school-periods          | School Periods             | Protected | Admin only                           |
| /privacy                        | Privacy Policy             | Public    | —                                    |
| /terms                          | Terms of Service           | Public    | —                                    |

### Route Map — SuperAdmin Portal (`admin.yourdomain.com`)

| Route                       | Screen               | Auth      | Roles           |
| --------------------------- | -------------------- | --------- | --------------- |
| /login                      | SuperAdmin Login     | Public    | —               |
| /tenants                    | Tenant Management    | Protected | SuperAdmin only |
| /tenants/:tenantId/features | Tenant Feature Flags | Protected | SuperAdmin only |

---

### Screen Specifications

---

**Screen: Tenant Login**
- **Goal:** Authenticate a tenant user and store JWT; handle inactive tenant gracefully.
- **Entry points:** Direct URL `/login`, redirect from any protected route on 401.
- **Required API calls:**
  1. `POST /auth/login` — on 200: store `token` + `user` in localStorage, redirect to `/dashboard`; on 401: show "Invalid email or password."; on 403 TENANT_INACTIVE: show "This school account has been deactivated. Contact your platform administrator."; on 404: show "School not found. Check the school ID and try again."; on 400: show field-level validation errors.
- **Local state:** form fields (email, password, tenantSlug), submitting boolean, error message string.
- **Server state:** None (no TanStack Query — form POST only).
- **Loading state:** Submit button shows spinner + disabled during request.
- **Empty state:** N/A.
- **Error states:** Inline error message below form; field-level errors on blur.
- **Form validation rules:**
  - `email`: required, valid email format
  - `password`: required, minLength 8
  - `tenantSlug`: required, minLength 1, maxLength 100
- **Permissions:** No auth required. If already authenticated, redirect to `/dashboard`.
- **Accessibility:** Form labels associated via `htmlFor`; error messages linked via `aria-describedby`; submit on Enter; autofocus on email field.
- **Performance notes:** Minimal bundle — no data fetching libraries loaded on this route.

---

**Screen: Dashboard**
- **Goal:** Show today's scheduled classes and provide quick-action entry points to attendance recording.
- **Entry points:** Post-login redirect, nav item.
- **Required API calls:**
  1. `GET /timetable?date={today}` — on 200: render today's slots grouped by period; on 403 FEATURE_DISABLED: show "Timetable feature not enabled for your school." full-page state; on 401: trigger session expiry flow.
- **Local state:** None beyond query state.
- **Server state:** TanStack Query key: `['timetable', 'today', isoDate]`. Stale time: 5 minutes. Refetch on window focus.
- **Loading state:** Skeleton cards (3 placeholder period rows).
- **Empty state:** "No classes scheduled for today." with a calendar illustration (inline SVG).
- **Error states:** Toast "Failed to load timetable. Tap to retry." with retry action.
- **Form validation rules:** N/A.
- **Permissions:** Teacher sees only own assigned slots (filter client-side by `teacherId === currentUser.id`). Admin sees all slots. Quick-action "Record Attendance" button visible on each slot for Teacher (own) and Admin (all).
- **Accessibility:** Each class card is a landmark region; "Record Attendance" button has `aria-label="Record attendance for {className} {subjectName} Period {n}"`.
- **Performance notes:** `GET /timetable?date=today` returns max ~50 slots for a school; no virtualization needed.

---

**Screen: Timetable**
- **Goal:** Display full timetable grid; allow Admin to create new slots and end existing assignments.
- **Entry points:** Nav item.
- **Required API calls:**
  1. `GET /timetable?status=Active` — on 200: render grid; on 403 FEATURE_DISABLED: full-page feature-not-enabled state.
  2. `GET /school-periods` — on 200: populate period rows in grid header; on 403: show inline warning "School periods not configured."
  3. (Admin create) `POST /timetable` — on 201: invalidate `['timetable']` query, close drawer, show success toast; on 400 PERIOD_NOT_CONFIGURED: inline form error "Period {n} is not configured. Set it up in School Periods first."; on 409: "This slot is already occupied for this class, day, and period."; on 403 FEATURE_DISABLED: toast error.
  4. (Admin end) `PUT /timetable/{timeSlotId}/end` — on 200: invalidate `['timetable']` query, show success toast; on 404: toast "Slot not found."; on 403: toast "Not authorized."
- **Local state:** `selectedFilters` (dayOfWeek, classId, teacherId), `createDrawerOpen` boolean, `endConfirmSlotId` string|null.
- **Server state:** TanStack Query keys: `['timetable', filters]`, `['school-periods']`. Stale time: 5 minutes.
- **Loading state:** Full grid skeleton (7 columns × N period rows).
- **Empty state:** "No timetable entries found. Use filters to adjust or create a new entry." (Admin only sees create button).
- **Error states:** Toast on mutation failure; inline error on create form fields.
- **Form validation rules (create slot):**
  - `classId`: required
  - `subjectId`: required
  - `teacherId`: required (must be a user with Teacher role)
  - `dayOfWeek`: required, enum Monday–Sunday
  - `periodNumber`: required, integer ≥ 1 (no max — unlimited per v3.3)
  - `effectiveFrom`: required, date format YYYY-MM-DD, must not be in the past
    ⚠️ UX policy only — not API-enforced. Backend accepts backdated values. Removing this guard requires only a Frontend Change Request; no backend CR or OpenAPI change needed.
- **Permissions:** Teacher: no create button, no "End Assignment" button. Admin: create button + "End Assignment" action on each active slot. No "Edit" button exists for any user.
- **Accessibility:** Grid uses `role="grid"` with `role="row"` and `role="gridcell"`; create drawer traps focus; escape closes drawer.
- **Performance notes:** Filter queries use query params; no client-side full dataset filtering for large schools.

---

**Screen: Record Attendance**
- **Goal:** Record attendance status for all students in a selected class period.
- **Entry points:** "Record Attendance" button on dashboard slot card; nav item; direct URL.
- **Required API calls:**
  1. `GET /timetable?teacherId={currentUserId}&date={today}` — on 200: populate class/period selector for Teacher; Admin gets `GET /timetable?date={today}`.
  2. `GET /students?classId={selectedClassId}&limit=200` — on 200: render student list for selected class. Uses the documented `classId` query param from OpenAPI v3.3.0 directly. Called once per class selection; result cached under key `['students', 'classId', selectedClassId]`.
  3. `POST /attendance/record-class` — on 201: show success summary toast "{recorded} records saved. {present} present, {absent} absent, {late} late."; on 400 future date: inline date error "Attendance cannot be recorded for a future date."; on 409: "Attendance already recorded for this class, date, and period."; on 403 FEATURE_DISABLED: full-page feature-not-enabled state; on 403 teacher not authorized: toast "You are not assigned to this class.".
- **Local state:** `selectedTimeSlotId`, `selectedDate`, `defaultStatus` ('Present'|'Absent'|'Late'), `exceptions` map (studentId → status), `submitting` boolean.
- **Server state:** TanStack Query keys: `['timetable', 'myToday']`, `['students', 'classId', selectedClassId]`. On 201: invalidate `['attendance']`.
- **Loading state:** Student list skeleton (10 placeholder rows).
- **Empty state:** "No students found in this class." inline message.
- **Error states:** Inline field errors; toast for network/server errors.
- **Form validation rules:**
  - `timeSlotId`: required (must select a slot)
  - `date`: required, must not be a future date (client-side guard + server 400)
  - `defaultStatus`: required, enum Present|Absent|Late
  - Each exception `studentId`: must be from the loaded student list; `status`: enum Present|Absent|Late
- **Permissions:** Teacher sees only own assigned slots in the slot selector. Admin sees all slots. Both can submit.
- **Accessibility:** Each student row has a status radio group with `aria-label="{studentName} attendance status"`; keyboard navigable row-by-row; form submit accessible via Enter on last field.
- **Performance notes:** Up to ~60 students per class. No virtualization needed. Exceptions stored as a Map for O(1) lookup. `limit=200` is the OpenAPI maximum — one request loads the full class roster.

---

**Screen: Student Attendance History**
- **Goal:** Show paginated attendance records for a single student with date/period/subject detail.
- **Entry points:** Student list row action (Admin), `/students/:studentId/attendance` direct URL.
- **Required API calls:**
  1. `GET /students/{studentId}/attendance?from={from}&to={to}&limit={limit}&offset={offset}` — on 200: render records table + student identity header from `response.student` + summary stats from `response.summary`; on 404: "Student not found."; on 403: "You do not have access to this student's records."; on 401: session expiry flow.
- **Local state:** `dateFrom` filter, `dateTo` filter, `page` (derived from offset/limit).
- **Server state:** TanStack Query key: `['student-attendance', studentId, from, to, page]`. Stale time: 2 minutes.
- **Loading state:** Table skeleton (10 placeholder rows).
- **Empty state:** "No attendance records found for this period."
- **Error states:** Full-page error state with retry button for 500; inline message for 404/403.
- **Form validation rules (filters):**
  - `from`: optional date, must be ≤ `to` if both set
  - `to`: optional date, must not be in the future
  - `limit`: fixed at 50 per page
- **Permissions:** Admin only. Route guard redirects Teacher with inline "Not authorized" state (not full redirect).
- **Accessibility:** Date filter inputs have associated labels; table has `<caption>` with student name; pagination controls labeled.
- **Performance notes:** Paginated server-side (limit 50). No client-side full list fetching.

---

**Screen: Attendance Summary**
- **Goal:** Show monthly attendance summary (present/absent/late counts and attendance rate) for a student.
- **Entry points:** Student list row action (Admin), nav.
- **Required API calls:**
  1. `GET /students/{studentId}/attendance?from={YYYY-MM-01}&to={YYYY-MM-{lastDay}}&limit=50`
     — on 200: render summary table from `response.summary`; on 403: "Not authorized."; on 404: "Student not found."; on 401: session expiry flow.
     — Month bounds computed client-side using `date-fns`: `startOfMonth` / `endOfMonth` → formatted as `YYYY-MM-DD`.
     — Only `response.summary` is consumed on this screen; `response.records` is ignored.
- **Local state:** `selectedStudentId`, `selectedMonth` (YYYY-MM format, defaults to current month).
- **Server state:** TanStack Query key: `['student-attendance', studentId, from, to]`. Stale time: 5 minutes.
  — Shares cache with Student Attendance History screen (same endpoint, same key shape).
- **Loading state:** Summary card skeleton.
- **Empty state:** "No attendance data for {month}." (shown when `response.summary.totalRecords === 0`)
- **Error states:** Toast for server errors; inline for 404.
- **Form validation rules:**
  - `studentId`: required
  - `month`: required, format YYYY-MM, must not be a future month
- **Permissions:** Admin only.
- **Accessibility:** Summary table has `<caption>`; month picker has visible label.
- **Performance notes:** Single summary object consumed from existing paginated response — no extra API call needed.

---

**Screen: User Management (`/manage/users`)**
- **Goal:** List all users, create new users, update user roles, bulk delete.
- **Entry points:** Nav item (Admin only).
- **Required API calls:**
  1. `GET /users?role={filter}&search={q}` — on 200: render table.
  2. `POST /users` — on 201: invalidate `['users']`, close drawer, toast "User created."; on 409: "Email already exists for this school."; on 400: field-level errors.
  3. `PUT /users/{id}/roles` — on 200: invalidate `['users']`, toast "Roles updated."; on 403 self-target: (button hidden — never reached); on 404: toast "User not found.".
  4. `DELETE /users/bulk` — on 200: show result toast + highlight failed items; on 400: toast "Invalid selection.".
  5. `DELETE /users/{id}` — on 204: invalidate `['users']`, toast "User deleted."; on 409: "Cannot delete: user has active timetable assignments or attendance records.".
- **Local state:** `selectedIds` Set, `createDrawerOpen`, `roleEditUserId`, `searchQuery`, `roleFilter`.
- **Server state:** TanStack Query key: `['users', roleFilter, searchQuery]`. Stale time: 2 minutes. On any mutation: invalidate `['users']`.
- **Loading state:** Table skeleton (8 placeholder rows).
- **Empty state:** "No users found. Create the first user."
- **Error states:** Bulk delete shows failed rows highlighted red with reason inline. Individual delete 409 shown as toast.
- **Form validation rules (create user):**
  - `name`: required, maxLength 255
  - `email`: required, valid email format
  - `password`: required, minLength 8
  - `roles`: required, at least 1, values in [Teacher, Admin]
- **Form validation rules (update roles):**
  - `roles`: required, non-empty array, values in [Teacher, Admin], no duplicates
- **Permissions:** Role editor hidden/disabled when `targetUser.id === currentUser.id`. Delete button hidden for current user.
- **Accessibility:** Table rows have checkbox with `aria-label="Select {userName}"`; bulk action bar announces count via `aria-live="polite"`.
- **Performance notes:** Search + role filter are server-side query params. No client-side filtering of full list.

---

**Screen: Student Management (`/manage/students`)**
- **Goal:** List all students, create new students, bulk delete.
- **Entry points:** Nav item (Admin only).
- **Required API calls:**
  1. `GET /students` — on 200: render table.
  2. `POST /students` — on 201: invalidate `['students']`, close drawer, toast "Student added."; on 400: field-level errors (including batch/class mismatch).
  3. `DELETE /students/bulk` — on 200: show result toast + highlight failed rows.
  4. `DELETE /students/{id}` — on 204: invalidate `['students']`, toast "Student deleted."; on 409: "Cannot delete: student has attendance records.".
- **Local state:** `selectedIds` Set, `createDrawerOpen`, `searchQuery`.
- **Server state:** TanStack Query key: `['students']`. Stale time: 2 minutes.
- **Loading state:** Table skeleton (8 rows).
- **Empty state:** "No students found. Add the first student."
- **Error states:** 400 on create for batch/class mismatch shown as inline form error: "The selected class does not belong to the selected batch."
- **Form validation rules (create student):**
  - `name`: required, maxLength 255
  - `classId`: required
  - `batchId`: required; must match `class.batchId` (client-side cross-field check + server 400)
- **Permissions:** No edit button (no `PUT /students/:id` in contract). Bulk delete + single delete only.
- **Accessibility:** Same checkbox pattern as User Management.
- **Performance notes:** No pagination in OpenAPI for `/students` — if list grows large, add server-side search filter. Virtualize rows if > 200 students rendered.

---

**Screen: Class Management (`/manage/classes`)**
- **Goal:** List classes, create, update, bulk delete.
- **Entry points:** Nav item (Admin only).
- **Required API calls:**
  1. `GET /classes` — on 200: render table.
  2. `POST /classes` — on 201: invalidate `['classes']`, toast "Class created."
  3. `PUT /classes/{id}` — on 200: invalidate `['classes']`, toast "Class updated."
  4. `DELETE /classes/bulk` — on 200: result toast + failed rows highlighted.
  5. `DELETE /classes/{id}` — on 204: toast "Class deleted."; on 409: "Cannot delete: students are enrolled in this class."
- **Local state:** `selectedIds`, `createDrawerOpen`, `editClassId`.
- **Server state:** TanStack Query key: `['classes']`. Stale time: 2 minutes.
- **Loading state:** Table skeleton.
- **Empty state:** "No classes found."
- **Error states:** 409 on delete shown as inline toast.
- **Form validation rules (create/edit):**
  - `name`: required, maxLength 255
  - `batchId`: required
- **Permissions:** Admin only.
- **Accessibility:** Edit/delete action buttons have `aria-label="Edit {className}"` / `aria-label="Delete {className}"`.
- **Performance notes:** Small lists (< 100 classes per school). No virtualization.

---

**Screen: Batch Management (`/manage/batches`)**
- **Goal:** List batches, create, update, bulk delete.
- **Entry points:** Nav item (Admin only).
- **Required API calls:**
  1. `GET /batches` — on 200: render table.
  2. `POST /batches` — on 201: invalidate `['batches']`.
  3. `PUT /batches/{id}` — on 200: invalidate `['batches']`.
  4. `DELETE /batches/bulk` — on 200: result toast.
  5. `DELETE /batches/{id}` — on 204; on 409: "Cannot delete: classes reference this batch."
- **Local state:** `selectedIds`, `createDrawerOpen`, `editBatchId`.
- **Server state:** TanStack Query key: `['batches']`. Stale time: 5 minutes.
- **Loading state:** Table skeleton.
- **Empty state:** "No batches found."
- **Form validation rules:**
  - `name`: required, maxLength 100
  - `startYear`: required, integer, 4 digits
  - `endYear`: required, integer, 4 digits, must be > `startYear`
  - `status`: required, enum Active|Archived
- **Permissions:** Admin only.
- **Accessibility:** Standard table + drawer pattern.
- **Performance notes:** Tiny lists. No virtualization.

---

**Screen: Subject Management (`/manage/subjects`)**
- **Goal:** List subjects, create, update, bulk delete.
- **Entry points:** Nav item (Admin only).
- **Required API calls:**
  1. `GET /subjects` — on 200: render table.
  2. `POST /subjects` — on 201: invalidate `['subjects']`.
  3. `PUT /subjects/{id}` — on 200: invalidate `['subjects']`.
  4. `DELETE /subjects/bulk` — on 200: result toast.
  5. `DELETE /subjects/{id}` — on 204; on 409: "Cannot delete: timetable slots reference this subject."
- **Local state:** `selectedIds`, `createDrawerOpen`, `editSubjectId`.
- **Server state:** TanStack Query key: `['subjects']`. Stale time: 5 minutes.
- **Loading state:** Table skeleton.
- **Empty state:** "No subjects found."
- **Form validation rules:**
  - `name`: required, maxLength 255
  - `code`: optional, maxLength 50
- **Permissions:** Admin only.
- **Accessibility:** Standard pattern.
- **Performance notes:** Small lists.

---

**Screen: School Periods (`/manage/school-periods`)**
- **Goal:** List, create, update, and delete school periods for the current tenant.
- **Entry points:** Nav item (Admin only).
- **Required API calls:**
  1. `GET /school-periods` — on 200: render list ordered by `periodNumber`; on 403 FEATURE_DISABLED: full-page "Timetable feature not enabled" state.
  2. `POST /school-periods` — on 201: invalidate `['school-periods']`, toast "Period added."; on 409: "Period number {n} already exists."; on 400 PERIOD_TIME_INVALID: inline "Start time must be before end time."
  3. `PUT /school-periods/{id}` — on 200: invalidate `['school-periods']`, toast "Period updated."; on 400 PERIOD_TIME_INVALID: inline "Start time must be before end time."; on 404: toast "Period not found."
  4. `DELETE /school-periods/{id}` — on 204: invalidate `['school-periods']`, toast "Period deleted."; on 409 HAS_REFERENCES: inline "Cannot delete — active timetable slots use this period."
- **Local state:** `createDrawerOpen`, `editPeriodId`, `deleteConfirmPeriodId`.
- **Server state:** TanStack Query key: `['school-periods']`. Stale time: 5 minutes. On any mutation: invalidate `['school-periods']` AND `['timetable']` (timetable grid derives times from periods).
- **Loading state:** List skeleton (8 placeholder rows matching default period count).
- **Empty state:** "No periods configured. Add your first period." (should not normally be empty — 8 seeded on tenant creation).
- **Error states:** 409 on delete shown inline on the row; 400 PERIOD_TIME_INVALID shown inline on form.
- **Form validation rules (create/edit):**
  - `periodNumber`: required, integer ≥ 1, no upper bound; must be unique per tenant (409 if duplicate)
  - `label`: optional, maxLength 100
  - `startTime`: required, format HH:MM (24-hour); client-side pattern `^\d{2}:\d{2}$`
  - `endTime`: required, format HH:MM (24-hour); must be strictly after `startTime` (client-side cross-field + server 400 PERIOD_TIME_INVALID)
  - `periodNumber` is **immutable after creation** — field is read-only in edit form
- **Permissions:** Admin only. Teacher has no access to this route.
- **Accessibility:** Time inputs use `type="time"` with `aria-label`; edit form disables `periodNumber` field with `aria-disabled="true"` + tooltip "Period number cannot be changed after creation."
- **Performance notes:** Max ~15 periods per school. No virtualization.

---

**Screen: SuperAdmin Login (`admin.yourdomain.com/login`)**
- **Goal:** Authenticate SuperAdmin and store SuperAdmin JWT in isolated localStorage key.
- **Entry points:** Direct URL, redirect from protected SA routes on 401.
- **Required API calls:**
  1. `POST /super-admin/auth/login` — on 200: store `token` + `superAdmin` in localStorage key `sa_auth`, redirect to `/tenants`; on 401: "Invalid email or password."; on 400: field-level errors.
- **Local state:** form fields, submitting boolean, error string.
- **Loading state:** Submit button spinner.
- **Empty state:** N/A.
- **Error states:** Inline below form.
- **Form validation rules:**
  - `email`: required, valid email format
  - `password`: required, minLength 8
- **Permissions:** Public. If already authenticated as SuperAdmin, redirect to `/tenants`.
- **Accessibility:** Same as tenant login.
- **Performance notes:** Minimal bundle.

---

**Screen: Tenant Management (`/tenants`)**
- **Goal:** List all tenants with status; create new tenants; deactivate tenants; navigate to feature flags.
- **Entry points:** Post-login redirect, nav.
- **Required API calls:**
  1. `GET /super-admin/tenants?status={filter}&search={q}` — on 200: render table.
  2. `POST /super-admin/tenants` — on 201: invalidate `['sa-tenants']`, close drawer, toast "Tenant created. 8 default periods seeded."; on 409: "Tenant ID or slug already exists.".
  3. `PUT /super-admin/tenants/{id}` — on 200: invalidate `['sa-tenants']`, toast "Tenant updated."; on 409: "Slug already taken.".
  4. `PUT /super-admin/tenants/{id}/deactivate` — on 200: invalidate `['sa-tenants']`, toast "Tenant deactivated."; on 409: "Tenant is already inactive.".
- **Local state:** `createDrawerOpen`, `editTenantId`, `deactivateConfirmTenantId`, `searchQuery`, `statusFilter`.
- **Server state:** TanStack Query key: `['sa-tenants', statusFilter, searchQuery]`. Stale time: 1 minute.
- **Loading state:** Table skeleton (5 rows).
- **Empty state:** "No tenants found."
- **Error states:** 409 shown inline on form or as toast for deactivate.
- **Form validation rules (create tenant):**
  - `id`: required, maxLength 50, alphanumeric + dash
  - `name`: required, maxLength 255
  - `slug`: required, maxLength 100, pattern `^[a-z0-9-]+$`
- **Form validation rules (update tenant):**
  - `name`: optional, maxLength 255
  - `slug`: optional, maxLength 100, pattern `^[a-z0-9-]+$`
- **Permissions:** SuperAdmin only. Deactivate button hidden for already-inactive tenants (status === 'inactive').
- **Accessibility:** Deactivate action has confirmation dialog with focus trap; escape cancels.
- **Performance notes:** Full list (no pagination in OpenAPI). Search is server-side via query param.

---

**Screen: Tenant Feature Flags (`/tenants/:tenantId/features`)**
- **Goal:** View and toggle feature flags (timetable, attendance) for a specific tenant.
- **Entry points:** "Manage Features" action on tenant row.
- **Required API calls:**
  1. `GET /super-admin/tenants/{tenantId}/features` — on 200: render feature toggle list; on 404: "Tenant not found."
  2. `PUT /super-admin/tenants/{tenantId}/features/{featureKey}` — on 200: invalidate `['sa-features', tenantId]`, show updated toggle state; on 400 FEATURE_DEPENDENCY: inline warning "Attendance requires Timetable to be enabled first."; on 404: toast "Feature or tenant not found."
- **Local state:** Optimistic toggle state per feature key.
- **Server state:** TanStack Query key: `['sa-features', tenantId]`. Stale time: 30 seconds.
- **Loading state:** Toggle skeleton (2 rows).
- **Empty state:** N/A (always 2 features: timetable, attendance).
- **Error states:** On 400 FEATURE_DEPENDENCY: revert optimistic toggle + show inline warning under the attendance toggle. On 500: revert toggle + toast.
- **Form validation rules:** None (toggle is boolean only).
- **Permissions:** SuperAdmin only. Attendance toggle is disabled (greyed) if timetable is currently disabled — client-side guard mirrors server rule.
- **Accessibility:** Each toggle is a `role="switch"` with `aria-checked` and `aria-label="{featureName}"`.
- **Performance notes:** 2 items only. No loading concerns.

---

**Static Screen: Privacy Policy (`/privacy`)**
- **Goal:** Display DPDPA 2023-compliant privacy policy.
- **Entry points:** Footer link (all pages).
- **Required API calls:** None.
- **Content:** Static hardcoded text. Must cover: data collected, purpose, retention, user rights under DPDPA 2023, contact for data requests.
- **Permissions:** Public.

---

**Static Screen: Terms of Service (`/terms`)**
- **Goal:** Display terms of service.
- **Entry points:** Footer link (all pages).
- **Required API calls:** None.
- **Content:** Static hardcoded text.
- **Permissions:** Public.

---

## 3. API Assumptions (Frontend contract expectations)

### 3.0 Backend Contract Link (LOCKED)

**Backend Freeze version:** v3.3 (2026-02-26)
**OpenAPI file:** `openapi.yaml`
**OpenAPI version:** `3.3.0`
**API versioning scheme:** No URL versioning (`/api/` prefix only). Version tracked via OpenAPI file version. Breaking changes require new Freeze.

**Base URL:** `VITE_API_BASE_URL` (from env, no hardcoding)
**Auth:** Bearer JWT. Header: `Authorization: Bearer {token}`. Stored in `localStorage` key `auth` (tenant) and `sa_auth` (superadmin).

**Global error shape expected (MUST match OpenAPI v3.3.0):**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  },
  "timestamp": "ISO8601"
}
```

All error handling in the API client layer reads `error.code` for programmatic decisions and `error.message` for user-facing display.

---

### 3.1 Mock Server (REQUIRED)

**Mock server tool:** Prism (`@stoplight/prism-cli`)

**Install (one-time):**
```bash
npm install -g @stoplight/prism-cli
```

**Run command (locked):**
```bash
prism mock ./docs/openapi.yaml --port 4010
```

**Frontend env for mock:**
```bash
VITE_API_BASE_URL=http://localhost:4010/api
```

**Failure simulation plan:**

| Scenario                       | Header           | Endpoint                                          |
| ------------------------------ | ---------------- | ------------------------------------------------- |
| Missing/invalid token (401)    | Prefer: code=401 | Any protected endpoint                            |
| Inactive tenant login (403)    | Prefer: code=403 | POST /auth/login                                  |
| Insufficient permissions (403) | Prefer: code=403 | Any write endpoint                                |
| Period not configured (400)    | Prefer: code=400 | POST /timetable                                   |
| Duplicate email/slug (409)     | Prefer: code=409 | POST /users, POST /super-admin/tenants            |
| Resource not found (404)       | Prefer: code=404 | Any {id} endpoint                                 |
| Feature dependency block (400) | Prefer: code=400 | PUT /super-admin/tenants/{id}/features/attendance |
| Server error (500)             | Prefer: code=500 | Any endpoint                                      |

---

### 3.2 Typed API Surface (LOCKED — matches OpenAPI v3.3.0 exactly)

```ts
// ─── ERROR ───────────────────────────────────────────────────────────────────
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
interface TenantUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  roles: Array<'Teacher' | 'Admin'>;
  activeRole: 'Teacher' | 'Admin';
}
interface TenantLoginRequest { email: string; password: string; tenantSlug: string; }
interface TenantLoginResponse { token: string; user: TenantUser; }
interface SwitchRoleRequest { role: 'Teacher' | 'Admin'; }
interface SwitchRoleResponse { token: string; user: TenantUser; }

// ─── SUPER ADMIN AUTH ─────────────────────────────────────────────────────────
interface SuperAdminProfile { id: string; name: string; email: string; }
interface SuperAdminLoginRequest { email: string; password: string; }
interface SuperAdminLoginResponse { token: string; superAdmin: SuperAdminProfile; }

// ─── TENANTS ──────────────────────────────────────────────────────────────────
interface Tenant {
  id: string; name: string; slug: string;
  status: 'active' | 'inactive'; deactivatedAt: string | null; createdAt: string;
}
interface ListTenantsResponse { tenants: Tenant[]; }
interface CreateTenantRequest { id: string; name: string; slug: string; }
interface CreateTenantResponse { tenant: Tenant; }
interface UpdateTenantRequest { name?: string; slug?: string; }
interface UpdateTenantResponse { tenant: Tenant; }
interface DeactivateTenantResponse { tenant: Tenant; }

// ─── FEATURES ─────────────────────────────────────────────────────────────────
interface Feature { key: 'timetable' | 'attendance'; name: string; enabled: boolean; enabledAt: string | null; }
interface ListFeaturesResponse { features: Feature[]; }
interface ToggleFeatureRequest { enabled: boolean; }
interface ToggleFeatureResponse { feature: Feature; }

// ─── SCHOOL PERIODS ───────────────────────────────────────────────────────────
interface SchoolPeriod { id: string; periodNumber: number; label?: string; startTime: string; endTime: string; }
interface ListSchoolPeriodsResponse { periods: SchoolPeriod[]; }
interface CreateSchoolPeriodRequest { periodNumber: number; label?: string; startTime: string; endTime: string; }
interface CreateSchoolPeriodResponse { period: SchoolPeriod; }
interface UpdateSchoolPeriodRequest { label?: string; startTime?: string; endTime?: string; }
interface UpdateSchoolPeriodResponse { period: SchoolPeriod; }

// ─── USERS ────────────────────────────────────────────────────────────────────
interface User { id: string; name: string; email: string; roles: Array<'Teacher' | 'Admin'>; }
interface ListUsersResponse { users: User[]; }
interface CreateUserRequest { name: string; email: string; password: string; roles: Array<'Teacher' | 'Admin'>; }
interface CreateUserResponse { user: User; }
interface UpdateUserRolesRequest { roles: Array<'Teacher' | 'Admin'>; }
interface UpdateUserRolesResponse { user: User; }

// ─── STUDENTS ─────────────────────────────────────────────────────────────────
interface Student { id: string; name: string; classId: string; className?: string; batchId: string; batchName?: string; }
interface ListStudentsResponse { students: Student[]; pagination: Pagination; }
interface CreateStudentRequest { name: string; classId: string; batchId: string; }
interface CreateStudentResponse { student: Student; }

// ─── BATCHES ──────────────────────────────────────────────────────────────────
interface Batch { id: string; name: string; startYear: number; endYear: number; status: 'Active' | 'Archived'; }
interface ListBatchesResponse { batches: Batch[]; }
interface CreateBatchRequest { name: string; startYear: number; endYear: number; status: 'Active' | 'Archived'; }
interface UpdateBatchRequest { name?: string; startYear?: number; endYear?: number; status?: 'Active' | 'Archived'; }

// ─── SUBJECTS ─────────────────────────────────────────────────────────────────
interface Subject { id: string; name: string; code?: string | null; }
interface ListSubjectsResponse { subjects: Subject[]; }
interface CreateSubjectRequest { name: string; code?: string; }
interface UpdateSubjectRequest { name?: string; code?: string; }

// ─── CLASSES ──────────────────────────────────────────────────────────────────
interface Class { id: string; name: string; batchId: string; batchName?: string; }
interface ListClassesResponse { classes: Class[]; }
interface CreateClassRequest { name: string; batchId: string; }
interface UpdateClassRequest { name?: string; batchId?: string; }

// ─── BULK ─────────────────────────────────────────────────────────────────────
interface BulkDeleteRequest { ids: string[]; }
interface BulkDeleteResponse {
  deleted: string[];
  failed: Array<{ id: string; reason: 'NOT_FOUND' | 'HAS_REFERENCES'; message: string; }>;
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────
interface Pagination { limit: number; offset: number; total: number; }

// ─── TIMETABLE ────────────────────────────────────────────────────────────────
interface TimeSlot {
  id: string; classId: string; className?: string;
  subjectId: string; subjectName?: string;
  teacherId: string; teacherName?: string;
  dayOfWeek: 'Monday'|'Tuesday'|'Wednesday'|'Thursday'|'Friday'|'Saturday'|'Sunday';
  periodNumber: number; label?: string; startTime?: string; endTime?: string;
  effectiveFrom: string; effectiveTo: string | null;
}
interface ListTimetableResponse { timetable: TimeSlot[]; }
interface CreateTimeSlotRequest {
  classId: string; subjectId: string; teacherId: string;
  dayOfWeek: TimeSlot['dayOfWeek']; periodNumber: number; effectiveFrom: string;
  // NOTE: startTime and endTime are REMOVED in v3.3 — do NOT send them
}
interface CreateTimeSlotResponse { timeSlot: TimeSlot; }
interface EndTimeSlotRequest { effectiveTo: string; }
interface EndTimeSlotResponse { timeSlot: { id: string; effectiveTo: string; }; }

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────
interface AttendanceRecord {
  id: string; date: string; status: 'Present' | 'Absent' | 'Late';
  timeSlot: { id: string; subjectName?: string; periodNumber: number; dayOfWeek: string; };
  recordedBy: string; recordedAt: string;
}

interface RecordClassAttendanceRequest {
  timeSlotId: string; date: string; defaultStatus: 'Present' | 'Absent' | 'Late';
  exceptions?: Array<{ studentId: string; status: 'Present' | 'Absent' | 'Late'; }>;
}
interface RecordClassAttendanceResponse {
  recorded: number; present: number; absent: number; late: number;
  date: string; timeSlot: { id: string; className: string; subjectName: string; periodNumber: number; };
}

// ─── ATTENDANCE SUMMARY (CR-FE-001: uses student attendance endpoint) ─────────
// NOTE: There is NO dedicated /attendance/summary?studentId endpoint in OpenAPI v3.3.0.
// The Attendance Summary screen reads response.summary from GET /students/{id}/attendance.
// AttendanceSummaryResponse is REMOVED. Use StudentAttendanceSummary below.

interface StudentAttendanceSummary {
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number; // float, e.g. 0.87 = 87%
}

interface StudentAttendanceResponse {
  student: Student;
  records: AttendanceRecord[];
  summary: StudentAttendanceSummary; // always present per OpenAPI required[] — CR-FE-001
  pagination: Pagination;
}
```

---

### 3.3 Caching & Invalidation Rules (LOCKED)

| Query Key Pattern                            | Stale Time | Invalidated By                                      |
| -------------------------------------------- | ---------- | --------------------------------------------------- |
| `['timetable', 'today', isoDate]`              | 5 min      | window focus refetch                                |
| `['timetable', filters]`                     | 5 min      | POST /timetable, PUT /timetable/{id}/end            |
| `['school-periods']`                         | 5 min      | POST/PUT/DELETE /school-periods; also clears timetable key |
| `['student-attendance', id, from, to, page]` | 2 min      | none (read-only)                                    |
| `['student-attendance', id, from, to]`       | 5 min      | none (read-only) — used by Attendance Summary screen |
| `['students', 'classId', classId]`            | 2 min      | POST /students, DELETE /students                    |
| `['students']`                               | 2 min      | POST /students, DELETE /students                    |
| `['users', roleFilter, searchQuery]`         | 2 min      | POST/PUT/DELETE /users                              |
| `['classes']`                                | 2 min      | POST/PUT/DELETE /classes                            |
| `['batches']`                                | 5 min      | POST/PUT/DELETE /batches                            |
| `['subjects']`                               | 5 min      | POST/PUT/DELETE /subjects                           |
| `['sa-tenants', statusFilter, searchQuery]`  | 1 min      | POST/PUT /super-admin/tenants                       |
| `['sa-features', tenantId]`                  | 30 sec     | PUT /super-admin/tenants/{id}/features/{key}        |

**Retry rules (LOCKED):**
- GET requests: retry 3× with exponential backoff (1s, 2s, 4s)
- POST/PUT/DELETE mutations: no automatic retry (non-idempotent)
- 401 response: clear localStorage auth token → redirect to `/login` (no retry)
- 429 response: show toast "Too many requests. Please wait a moment." — no auto-retry

---

## 4. State Management & Data Flow (LOCKED)

**State boundaries:**
- **Server state:** TanStack Query — all API-fetched data
- **UI state:** Local component state (`useState`) or React context
- **Persistent state:** `localStorage`
  - Key `auth`: `{ token: string, user: TenantUser }` — cleared on logout or 401
  - Key `sa_auth`: `{ token: string, superAdmin: SuperAdminProfile }` — cleared on SA logout or 401

**Cross-tab/session behavior:**
- Token expiry UX: on any 401 from API client interceptor → clear `auth` from localStorage → redirect to `/login` → show toast "Your session has expired. Please log in again."
- Logout behavior: clear `auth` key → redirect `/login`; SuperAdmin logout: clear `sa_auth` key → redirect SA `/login`
- Multi-tab sync: NOT implemented (out of scope — no WebSocket/BroadcastChannel)

---

## 5. Design System & UI Constraints

**Design tokens source:** No Figma. shadcn/ui defaults + Tailwind CSS v3 utility classes.

**Typography scale (locked):** Tailwind defaults (`text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`)

**Spacing scale (locked):** Tailwind defaults (4px base grid)

**Color system:** shadcn/ui default theme. Contrast ratios must meet WCAG 2.1 AA (4.5:1 text, 3:1 UI components).

**Component inventory (MVP):**
- Button (primary, secondary, destructive, ghost)
- Input, Textarea, Select, Checkbox, RadioGroup
- Form (react-hook-form wrapper with zod error display)
- Table (with sortable headers, row checkboxes, bulk action bar)
- Drawer (create/edit forms — slides from right, focus trap)
- Dialog (confirmation — deactivate/delete actions)
- Toast (success, error, warning — top-right, 4s auto-dismiss)
- Skeleton (table rows, cards, toggles)
- Badge (status indicators: Active/Archived/inactive)
- Switch (role="switch" for feature toggles)
- Pagination (prev/next + page indicator)
- EmptyState (illustration + message + optional CTA)
- FullPageError (retry button)
- FeatureDisabled (full-page gate for 403 FEATURE_DISABLED)

**Responsiveness:**
- Mobile-first (Tailwind `sm:` breakpoint at 640px, `md:` at 768px, `lg:` at 1024px)
- All tables collapse to card layout on mobile
- Drawers are full-screen on mobile, 480px panel on desktop

---

## 6. Accessibility (A11y Baseline — LOCKED)

**Target:** WCAG 2.1 AA

**Mandatory behaviors:**
- All interactive elements reachable and operable via keyboard (Tab, Enter, Space, Escape, Arrow keys)
- Visible focus ring on all focusable elements (Tailwind `focus-visible:ring`)
- All form fields have associated `<label>` via `htmlFor` or `aria-label`
- All form errors announced via `aria-describedby` pointing to error message element
- All dialogs/drawers trap focus; Escape closes them
- Toast notifications use `role="status"` or `aria-live="polite"` for non-critical; `aria-live="assertive"` for errors
- Color contrast ≥ 4.5:1 for text, ≥ 3:1 for UI components and focus indicators
- No information conveyed by color alone
- All images/icons that convey meaning have `alt` text or `aria-label`; decorative icons have `aria-hidden="true"`
- Tables have `<caption>`; complex tables have `scope` on headers

**Automated checks:** axe-core integrated in Vitest component tests. All 13 screens must pass with 0 violations.

---

## 7. Performance Budgets (LOCKED)

**Targets:**

| Metric           | Target      |
| ---------------- | ----------- |
| LCP              | ≤ 2500ms    |
| INP              | ≤ 200ms     |
| CLS              | ≤ 0.1       |
| Initial JS bundle | ≤ 200KB gzip |
| Route chunk max  | ≤ 50KB gzip  |

**Techniques (LOCKED):**
- Route-level code splitting via React Router lazy + Suspense
- No virtualization needed for current data sizes (max 60 students, 50 timetable slots, 15 periods)
- Virtualize student table only if > 200 rows rendered (use `@tanstack/react-virtual`)
- Image optimization: N/A (no user images in scope)
- PWA: service worker caches app shell only (no API response caching via SW)

---

## 8. Security & Privacy (Frontend — LOCKED)

**Threat model assumptions:**
- XSS defense: React JSX escaping is sufficient; no `dangerouslySetInnerHTML` anywhere (enforced via banned pattern)
- CSRF: N/A — Bearer JWT in Authorization header, not cookies
- Token storage: JWT stored in `localStorage`. Acceptable risk for this threat model (no XSS vectors from banned patterns). No refresh token — session ends on expiry.
- PII handling: `email`, `name` fields rendered in UI but never logged or stored beyond `localStorage auth` key. `localStorage` cleared on logout.
- No analytics, no telemetry, no third-party scripts (out of scope)

**DPDPA 2023 compliance (India):**
- Privacy Policy screen is mandatory (public, linked in footer)
- Terms of Service screen is mandatory (public, linked in footer)
- No consent banner required (no cookies beyond session, no tracking)

---

## 9. Observability (Frontend — LOCKED)

**Logging/telemetry:** NONE. No Sentry, no Mixpanel, no GA. Explicitly out of scope.

**Error reporting:** Console errors in development only (`VITE_APP_ENV === 'development'`). No remote error reporting.

---

## 10. Testing Strategy (LOCKED)

**Test layers:**

| Layer              | Scope                                                      | Tool                     |
| ------------------ | ---------------------------------------------------------- | ------------------------ |
| Unit               | Utility functions, zod schemas, date helpers               | Vitest                   |
| Component          | All screens: loading/empty/error states, form validation   | Vitest + React Testing Library |
| Integration        | Full user flows against Prism mock server                  | Playwright               |
| A11y               | All 13 screens — 0 axe-core violations required            | axe-core (Vitest plugin) |
| Visual regression  | No (out of scope)                                          | —                        |

**Contract alignment checks (REQUIRED):**
- All API calls in component tests use MSW handlers typed against `src/api/` interfaces
- Any field or endpoint not present in OpenAPI v3.3.0 must cause test failure at review
- Prism mock used for Playwright E2E — no real backend needed for CI

**MVP test checklist:**
- [ ] Auth flows: login (success, 401, 403 TENANT_INACTIVE, 404), logout, role switch
- [ ] Dashboard: slot list, empty state, feature-disabled state
- [ ] Timetable: grid render, create slot (success + 400 + 409), end assignment
- [ ] Record Attendance: slot selection, student load via `classId` filter, submit (success + 409 + 403)
- [ ] Student Attendance History: pagination, date filters, 404 state
- [ ] Attendance Summary: month selection, summary display, empty month state
- [ ] All CRUD screens: create (success + 400 + 409), delete (success + 409), bulk delete (partial failure)
- [ ] All error states: 401 expiry redirect, 403 role guard, 500 retry
- [ ] A11y: axe-core pass on all 13 screens

---

## 11. Project Structure (Frontend skeleton)

```
/
├── apps/
│   ├── tenant/               # Tenant app (Vite project)
│   │   ├── src/
│   │   │   ├── api/          # Typed API client (axios instance + endpoint functions)
│   │   │   ├── components/   # Shared UI components (Button, Table, Drawer, Toast…)
│   │   │   ├── features/     # Screen-level feature modules (dashboard/, timetable/, …)
│   │   │   ├── hooks/        # Shared hooks (useAuth, usePagination…)
│   │   │   ├── routes/       # React Router config + ProtectedRoute + RoleGuard
│   │   │   ├── styles/       # Tailwind base + shadcn theme
│   │   │   ├── types/        # Global TypeScript types (mirrors Section 3.2)
│   │   │   └── utils/        # Date helpers (date-fns wrappers), formatters
│   │   ├── .env.example
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   └── superadmin/           # SuperAdmin portal (separate Vite project)
│       └── src/              # Same structure as tenant app, SA-specific features only
├── docs/
│   └── openapi.yaml          # OpenAPI v3.3.0 — source of truth for mock + contract tests
└── package.json              # Monorepo root (pnpm workspaces recommended)
```

**Naming conventions:**
- Files: `kebab-case` (e.g., `attendance-summary.tsx`)
- Components: `PascalCase`
- Hooks: `camelCase` prefixed with `use`
- API functions: `camelCase` (e.g., `getStudentAttendance`, `recordClassAttendance`)
- Import alias: `@/` maps to `src/` in each app

---

## 12. Deployment, Rollback & Environments (LOCKED)

**Hosting:** Cloudflare Pages (both tenant app and SuperAdmin portal as separate projects)

**Build command (locked):**
```bash
pnpm --filter tenant build    # tenant app
pnpm --filter superadmin build  # SuperAdmin portal
```

**Environment mapping:**
| `VITE_APP_ENV` | API target               | Purpose              |
| -------------- | ------------------------ | -------------------- |
| development    | localhost:3000/api       | Local dev            |
| development    | localhost:4010/api       | Local mock (Prism)   |
| staging        | staging API URL          | Integration testing  |
| production     | production API URL       | Live                 |

**Rollback strategy:** Cloudflare Pages instant rollback to previous deployment via dashboard or `wrangler pages deployment rollback`. No cache invalidation step required (assets are content-hashed).

---

## 13. Forbidden Changes (Scope Lock)

**BANNED without a new Freeze version:**
- Add routes/screens
- Change routing mode (SPA → SSR/SSG)
- Change state management library
- Change auth mode (JWT → sessions)
- Add i18n
- Add offline/PWA API caching
- Change API assumptions derived from OpenAPI endpoints/fields/status codes/error shapes
- Add analytics or telemetry
- Add any third-party auth provider

If requested → create Change Request → re-price → approve/reject.

---

## 14. Change Control

**Change Request Format:**
- CR Number
- Requested change (precise delta)
- Reason
- Scope impact
- Timeline impact
- Cost impact
- Risk impact
- Backend Freeze dependency: unchanged | updated (version)
- OpenAPI dependency: unchanged | updated (version/tag)
- Decision: Approved | Rejected
- New Freeze version

**Billing rule:** Self-funded project — no billing. CR approval by sole developer.

**Response SLA:** Immediate (solo project).

---

## 15. Version History

| Version | Date       | Description                                                                                                                                                                                                                                            | Approved By     |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| v1.0    | 2026-02-26 | Initial frontend freeze approved for execution.                                                                                                                                                                                                        | Solo developer  |
| v1.1    | 2026-03-01 | CR-FE-001: (1) Attendance Summary screen re-pointed to GET /students/{id}/attendance with month bounds — GET /attendance/summary?studentId is not in OpenAPI v3.3.0. (2) StudentAttendanceResponse.summary field added (was missing; required in OpenAPI). (3) Record Attendance classId filter note corrected — OpenAPI documents classId param on GET /students; query key scoped to classId. (4) effectiveFrom past-date validation annotated as UX policy only. Backend Freeze v3.3 unchanged. OpenAPI v3.3.0 unchanged. | Solo developer  |

---

*END OF FRONTEND PROJECT FREEZE v1.1 — White-Label School Management System*
*This document supersedes v1.0. Archive v1.0 as: white_label_frontend_architecture_freeze_v1.0_SUPERSEDED.txt*
