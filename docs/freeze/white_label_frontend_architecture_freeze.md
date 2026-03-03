# FRONTEND PROJECT FREEZE: White-Label School Management System
**Version:** 1.2 | **Date:** 2026-03-02 | **Status:** APPROVED FOR EXECUTION
**Supersedes:** v1.1 (2026-03-01)
**Backend Freeze:** v3.4 (2026-03-02) | **OpenAPI:** 3.4.0

> **CRITICAL:** This is the Absolute Source of Truth. v1.1 is SUPERSEDED.
> No authority to modify routes, API assumptions, or constraints below.
> Any contradicting request → refuse + open Change Request.

---

## Change Requests Applied in v1.2

### CR-FE-002 — Backend Contract Sync v3.3 → v3.4
- Role enum: `[Teacher, Admin]` → `[Teacher, Admin, Student]` on all surfaces
- `POST /super-admin/tenants` — `admin` block now required; create form gains Section 2 (First Admin Account)
- `PUT /users/{id}/roles` 403 code: `SELFROLECHANGEFORBIDDEN` → `LASTADMIN`
- `AttendanceRecord` schema gains `originalStatus`, `correctedBy`, `correctedAt` — Attendance History screen gains inline correction via `PUT /attendance/{recordId}`
- Student Management gains "Link Account" row action via `PUT /students/{id}/link-account`
- Tenant Management gains "Reactivate" button for inactive tenants via `PUT /super-admin/tenants/{id}/reactivate`
- **Contract Gap CG-01 (BLOCKED):** No endpoint to discover own `studentId` for Student-role users. Student attendance self-view rendered as placeholder: "Contact your admin for your attendance records." No invented endpoint called. Resolved when backend adds `GET /students/me` or `userId` filter — requires backend CR first.
- Timeline impact: +3–4 days

### CR-FE-003 — UX/Visual Refresh
- Sidebar: branded top bar, filled active-item highlight, icons + labels, role context badge
- Cards: `shadow-sm`, `rounded-xl`, strong header padding, subtle border
- Tables: `hover:bg-muted/40` rows, badge-styled status chips, row-hover-only action buttons
- Dashboard: stat summary bar (Admin), colored period badges in timetable cells
- Typography: `font-semibold` headings, `text-muted-foreground` secondary labels
- Timetable grid: colored header band per period, filled cells use subject-accent chip, empty cells dashed on hover
- Zero new routes, zero API changes — Tailwind class changes only
- Timeline impact: +2 days

### CR-FE-004 — Timetable Inline Cell Click to Add Slot
- "Add Slot" top-level button removed
- Empty cell (Admin hover): `bg-muted/30` + dashed border + `+` icon → click opens create drawer pre-filled with `dayOfWeek` + `periodNumber` (read-only in form)
- Filled cell (Admin click): opens details `<Popover>` with subject/teacher/class/dates + "End Assignment" button
- State: `createDrawerOpen: boolean` → `activeCell: { dayOfWeek: string; periodNumber: number } | null`; `activeSlotId: string | null`
- Same `POST /timetable` + `PUT /timetable/{id}/end` — no API change
- Teacher/Student: cells non-interactive
- Timeline impact: +1 day

### CR-FE-005 — Role Switcher Dropdown
- `RoleSwitcher` replaced with shadcn/ui `<DropdownMenu>` showing `activeRole` + `ChevronDown`
- Opening lists all `user.roles`; active role shows checkmark; click calls `POST /auth/switch-role`
- Loading: items disabled + spinner while in-flight
- Error: toast "Failed to switch role. Please try again."
- Only shown when `user.roles.length > 1` — unchanged rule
- Handles 3-role users (Teacher + Admin + Student) correctly
- Timeline impact: +0.5 days

### CR-FE-006 — Role-Gated Sidebar + Role-Specific Dashboards
- Sidebar nav derived strictly from `user.activeRole`, not `user.roles` array
- Admin-only pages not rendered in nav when `activeRole !== 'Admin'`; direct URL → inline "Not authorized for current role. Switch to Admin to access this page."
- Dashboard content split per `activeRole` (Teacher/Admin/Student)
- Timeline impact: +1.5 days

**Total added:** ~8 days | **New timeline:** 9–12 weeks

---

## 0. Commercials

**Engagement Type:** Fixed-scope | **Package:** Standard
**Price:** Self-funded solo project (no external billing)
**Timeline:** 9–12 weeks
**Assumptions:**
- Solo developer is single decision maker
- Backend v3.4 available at staging by Week 3
- Prism mock used until backend ready
- CG-01 resolved via backend CR before Student attendance self-view is built

**Support:** 30-day bugfix post first user test; enhancements as Change Requests

---

## 1. Iron Scope (Frontend only)

**Core Value Proposition:**
> A web frontend for a white-label school management SaaS enabling teachers to record attendance, students to view schedules, and admins to manage timetables and school configuration — delivered as a mobile-first SPA on Cloudflare Pages.

**The 11 Frontend User Stories (COMPLETE SCOPE):**

1. As a **tenant user (Teacher, Admin, or Student)**, I can log in with email, password, and school ID, so that I access only my school's data.
2. As a **Teacher**, I can see today's own assigned classes on a role-specific dashboard and navigate to record attendance.
3. As an **Admin**, I can see today's full schedule with a stat summary bar on a role-specific dashboard.
4. As a **Student**, I can see today's school-wide timetable read-only on a role-specific dashboard.
5. As a **Teacher or Admin**, I can view the full timetable grid; Admin can add a slot by clicking an empty cell and end an assignment by clicking a filled cell.
6. As a **Teacher or Admin**, I can record attendance for a class period by selecting statuses for each student.
7. As an **Admin**, I can view a student's full attendance history and correct an individual record (with `originalStatus` preserved).
8. As an **Admin**, I can view a monthly attendance summary for a student.
9. As an **Admin**, I can manage users, students (including linking a user account), classes, batches, subjects, and school periods.
10. As a **multi-role user**, I can switch my active role via a dropdown; the sidebar and dashboard immediately reflect only pages relevant to that role.
11. As a **SuperAdmin**, I can manage tenants (create with admin block, update, deactivate, reactivate) and their feature flags from an isolated portal.

**The NO List (Explicitly Out of Scope):**
- No forgot password / password reset flow
- No student self-service attendance view (CG-01 blocked — placeholder only)
- No parent portal or parent role
- No real-time updates (no WebSocket, no polling)
- No CSV bulk import UI
- No audit log viewer UI
- No custom branding / theme UI (no logo upload, no color picker)
- No multi-language / i18n (English only)
- No charts or graph visualizations (summary tables only)
- No inline timetable slot edit (no `PUT /timetable/:id` in contract — End Assignment via popover only)
- No `PUT /features/:featureKey` from tenant app (deprecated since v3.2, returns 403)
- No SSR/SEO (login-gated SPA)
- No analytics or telemetry
- No SuperAdmin self-registration screen
- No JWT token blacklist / forced session invalidation UI
- No SuperAdmin tenant hard-delete (deactivate + reactivate only)
- No student bulk-linking or CSV import (manual one-by-one via `PUT /students/{id}/link-account` only)

**User Roles (UI behavior truth):**

| `activeRole` | Sidebar Items | Key Restrictions |
|---|---|---|
| `Teacher` | Dashboard, Timetable, Record Attendance | Timetable read-only; no `/manage/*`; no attendance summary/history |
| `Admin` | Dashboard, Timetable, Attendance (Summary + History), Manage (Users, Students, Classes, Batches, Subjects, School Periods) | Role editor hidden when `targetUser.id === currentUser.id`; own delete hidden |
| `Student` | Dashboard, Timetable | All read-only; no record/manage/attendance actions; CG-01 placeholder on dashboard |
| `SuperAdmin` | Isolated portal: Tenants, Feature Flags | No tenant app access whatsoever |

Role switcher shown only when `user.roles.length > 1`.

**Success Definition (measurable):**
1. Teacher can log in, view own classes, and record attendance end-to-end against live backend
2. Admin can create a timetable entry by clicking an empty cell, correct an attendance record, link a student account, and bulk-delete users
3. Multi-role Teacher+Admin user switches roles via dropdown — sidebar changes immediately, no page reload
4. SuperAdmin can create a tenant with admin block, reactivate an inactive tenant, and toggle feature flags
5. All 15 screens pass WCAG 2.1 AA automated checks (axe-core); Lighthouse mobile ≥ 85 on `/dashboard` and `/attendance/record`

---

## 1.2 Assumptions & External Dependencies

**Primary Backend/API:** White-Label School Management System v3.4
- Dev: `http://localhost:3000/api`
- Mock: `http://localhost:4010/api` (Prism)
- Staging/Prod: `VITE_API_BASE_URL`

**Design Source:** None (no Figma). Tailwind CSS v3 + shadcn/ui + CR-FE-003 visual rules locked in Section 5.

**Backend Freeze version:** v3.4 (2026-03-02)
**OpenAPI file:** `openapi.yaml` | **Version:** `3.4.0` | **Location:** `./docs/openapi.yaml`

**Contract immutability rule:** Frontend MUST NOT invent endpoints, fields, status codes, or error shapes not in OpenAPI 3.4.0. CG-01 is a known gap — explicitly stubbed, no invented endpoint called.

**External Dependencies:** None.

---

## 1.5 Frontend Configuration

```bash
# .env.example — Tenant App
VITE_APP_ENV="development"
VITE_API_BASE_URL="http://localhost:3000/api"
VITE_APP_BASE_URL="http://localhost:5173"
VITE_APP_NAME="School Management"

# .env.example — SuperAdmin Portal
VITE_APP_ENV="development"
VITE_API_BASE_URL="http://localhost:3000/api"
VITE_APP_BASE_URL="http://localhost:5174"
VITE_APP_NAME="Platform Admin"
```

**Rules:**
- `VITE_API_BASE_URL` must be set per environment — no hardcoded URLs in source
- No secrets in frontend env (all values are public build-time only)
- Tenant app and SuperAdmin portal are separate Vite projects with separate `.env` files

---

## 1.6 Tech Stack & Key Libraries (LOCKED)

| Concern | Library | Version |
|---|---|---|
| Framework | React | 18.x |
| Build tool | Vite | 5.x |
| Language | TypeScript | 5.x (strict mode) |
| Routing | React Router | v6.x |
| Data fetching/caching | TanStack Query | v5.x |
| Forms + validation | react-hook-form + zod | latest stable |
| UI components | shadcn/ui (DropdownMenu, Popover added v1.2) | latest stable |
| Styling | Tailwind CSS | v3.x |
| Date handling | date-fns | v3.x |
| HTTP client | axios | v1.x (typed interceptors) |
| Icons | lucide-react | latest stable |

**Explicitly Banned:**
- No Redux or Zustand
- No jQuery, no Moment.js
- No `dangerouslySetInnerHTML`
- No inline styles (Tailwind classes only)
- No class components (hooks only)
- No direct `fetch()` calls outside `/src/api/`
- No prop drilling beyond 2 levels
- No hardcoded tenant slugs, IDs, or API URLs in component files

---

## 2. Routes, Screens, and Navigation

**Routing mode:** SPA (React Router v6)
**Auth gating:** Protected route wrapper + role guard. Unauthenticated → redirect `/login`. Wrong `activeRole` for route → inline "Not authorized for current role. Switch to [Role] to access this page." — no redirect.

### Route Map — Tenant App (`app.yourdomain.com`)

| Route | Screen | Auth | activeRole |
|---|---|---|---|
| /login | Tenant Login | Public | — |
| /dashboard | Dashboard | Protected | Teacher, Admin, Student |
| /timetable | Timetable | Protected | Teacher (read), Admin (rw), Student (read) |
| /attendance/record | Record Attendance | Protected | Teacher, Admin |
| /attendance/summary | Attendance Summary | Protected | Admin only |
| /students/:studentId/attendance | Student Attendance History | Protected | Admin only |
| /manage/users | User Management | Protected | Admin only |
| /manage/students | Student Management | Protected | Admin only |
| /manage/classes | Class Management | Protected | Admin only |
| /manage/batches | Batch Management | Protected | Admin only |
| /manage/subjects | Subject Management | Protected | Admin only |
| /manage/school-periods | School Periods | Protected | Admin only |
| /privacy | Privacy Policy | Public | — |
| /terms | Terms of Service | Public | — |

### Route Map — SuperAdmin Portal (`admin.yourdomain.com`)

| Route | Screen | Auth | Role |
|---|---|---|---|
| /login | SuperAdmin Login | Public | — |
| /tenants | Tenant Management | Protected | SuperAdmin only |
| /tenants/:tenantId/features | Tenant Feature Flags | Protected | SuperAdmin only |

---

## 2.1 Screen Specifications

### Screen: Tenant Login
- **Goal:** Authenticate tenant user; store JWT; handle all error cases.
- **API calls:** `POST /auth/login` — 200: store `{token, user}` in `localStorage['auth']`, redirect `/dashboard`; 401: "Invalid email or password."; 403 `TENANT_INACTIVE`: "This school account has been deactivated. Contact your platform administrator."; 404: "School not found. Check the school ID and try again."; 400: field-level errors from `error.details`.
- **Local state:** form fields, `submitting: boolean`, `globalError: string | null`
- **Server state:** None (form POST only — no TanStack Query)
- **Loading:** Submit button spinner + disabled
- **Form validation:** `email` required + valid email; `password` required minLength 8; `tenantSlug` required minLength 1 maxLength 100
- **Permissions:** Public. Already authenticated → redirect `/dashboard`.
- **A11y:** `htmlFor` labels; `aria-describedby` on error messages; autofocus on email; submit on Enter.

### Screen: Dashboard
- **Goal:** Role-specific view of today's schedule with relevant CTAs.
- **API calls:** `GET /timetable?date={today}` — 200: render per-role content; 403 `FEATURE_DISABLED`: full-page "Timetable feature not enabled"; 401: session expiry flow.
- **Server state:** TQ key `['timetable', 'today', isoDate]`. Stale: 5 min. Refetch on focus.
- **Loading:** 3 skeleton slot cards.
- **Role-specific content (CR-FE-006):**
  - **Teacher:** Filter client-side `slot.teacherId === currentUser.id`. Slot cards with "Record Attendance" CTA → `/attendance/record` with `state.slotId`. Empty: "No classes assigned to you today."
  - **Admin:** All slots. Stat summary bar: `Total Periods: N` | `Scheduled: N (N%)` | `Unassigned: N` (derived client-side). No record CTA. Empty: "No classes scheduled for today."
  - **Student:** All slots read-only. CG-01 placeholder below list: "My Attendance — coming soon. Contact your admin for your attendance records." Empty: "No classes scheduled today."
- **A11y:** Each slot card is `<article>`; "Record Attendance" button has `aria-label="Record attendance for {className} {subjectName} Period {n}"`.

### Screen: Timetable
- **Goal:** Full timetable grid. Admin: inline cell interactions. Teacher/Student: read-only.
- **API calls:**
  1. `GET /timetable?status=Active` — 200: render grid; 403 `FEATURE_DISABLED`: full-page gate.
  2. `GET /school-periods` — 200: column headers; 403: inline "School periods not configured."
  3. (Admin) `POST /timetable` — 201: invalidate `['timetable']`, close drawer, toast "Slot created."; 400 `PERIOD_NOT_CONFIGURED`: inline "Period {n} not configured."; 409: "Slot already occupied."; 403: toast.
  4. (Admin) `PUT /timetable/{id}/end` — 200: invalidate `['timetable']`, close popover, toast "Assignment ended."; 404/403: toast.
- **Local state:** `selectedFilters`, `activeCell: { dayOfWeek: string; periodNumber: number } | null`, `activeSlotId: string | null`
- **Server state:** TQ keys `['timetable', filters]`, `['school-periods']`. Stale: 5 min.
- **Loading:** Full grid skeleton. **Empty:** "No timetable entries found." Admin hint: "Click an empty cell to add a slot."
- **Cell interactions (CR-FE-004):**
  - Empty cell (Admin hover): `bg-muted/30` + dashed border + `+` icon
  - Empty cell (Admin click): `setActiveCell({dayOfWeek, periodNumber})` → create drawer. Drawer: `classId` (select, required), `subjectId` (select, required), `teacherId` (select Teacher-role users, required), `effectiveFrom` (date, required); `dayOfWeek` + `periodNumber` pre-filled read-only.
  - Filled cell (Admin click): `setActiveSlotId(slot.id)` → `<Popover>` with subject/teacher/class/dates. "End Assignment" → confirmation dialog → `PUT /timetable/{id}/end`.
  - Teacher/Student: cells non-interactive, plain read-only display.
- **Form validation (create):** `classId` required; `subjectId` required; `teacherId` required (Teacher-role user); `dayOfWeek` pre-filled read-only; `periodNumber` pre-filled read-only integer ≥ 1; `effectiveFrom` required YYYY-MM-DD, UX warn if past (not API-enforced).
- **A11y:** `role="grid"`, `role="row"`, `role="gridcell"`; empty clickable cells `aria-label="Add slot for {dayOfWeek} Period {n}"`; drawers trap focus; Escape closes.
- **Performance:** Scroll-x on mobile. No virtualization for ≤ 15 periods.

### Screen: Record Attendance
- **Goal:** Record attendance for all students in a selected class period.
- **API calls:**
  1. Teacher: `GET /timetable?teacherId={currentUser.id}&date={today}`; Admin: `GET /timetable?date={today}`
  2. `GET /students?classId={selectedClassId}&limit=200` — TQ key `['students', 'classId', selectedClassId]`
  3. `POST /attendance/record-class` — 201: toast "{recorded} records saved. {present} present, {absent} absent, {late} late."; 400 `FUTURE_DATE`: inline error; 409: "Attendance already recorded."; 403 `FEATURE_DISABLED`: full-page gate; 403 not-assigned: toast.
- **Local state:** `selectedTimeSlotId`, `selectedDate` (default today), `defaultStatus`, `exceptions: Map<studentId, AttendanceStatus>`, `submitError`, `successMsg`
- **Server state:** TQ keys `['timetable', 'myToday']`, `['students', 'classId', id]`. On 201: invalidate `['attendance']`.
- **Loading:** Student list skeleton 10 rows. **Empty:** "No students found in this class."
- **Form validation:** `timeSlotId` required; `date` required not future; `defaultStatus` required enum Present|Absent|Late
- **Permissions:** Teacher: own slots only. Admin: all slots. Student: direct URL → inline "Not authorized for current role."
- **A11y:** Each student row `role="radiogroup"` with `aria-label="{studentName} attendance status"`.
- **Performance:** `exceptions` as `Map` for O(1) lookup. `limit=200` is OpenAPI max.

### Screen: Student Attendance History
- **Goal:** Paginated attendance records for a student. Admin can correct individual records (v3.4).
- **API calls:**
  1. `GET /students/{studentId}/attendance?from={from}&to={to}&limit={limit}&offset={offset}` — 200: table + student header; 404: "Student not found."; 403: "You do not have access to this student's records."
  2. (Admin) `PUT /attendance/{recordId}` — 200: invalidate `['student-attendance', studentId]`, toast "Attendance corrected."; 400 `SAME_STATUS`: inline "Status is already {status} — no change needed."; 400 `FUTURE_DATE`: inline "Cannot correct a future record."; 403/404: toast.
- **Local state:** `dateFrom`, `dateTo`, `page`, `correctingRecordId: string | null`, `correctionStatus: string`
- **Server state:** TQ key `['student-attendance', studentId, from, to, page]`. Stale: 2 min.
- **Loading:** Table skeleton 10 rows. **Empty:** "No attendance records found for this period."
- **Correction (v3.4):** Table columns: Date | Subject | Period | `originalStatus` (badge, never changes) | `status` (effective badge) | Corrected By | Action (Admin). "Correct" → inline Select → Confirm → `PUT /attendance/{recordId}`. `originalStatus` always visible — immutable audit trail.
- **Form validation (correction):** `status` required enum Present|Absent|Late, must differ from current effective `status` (client guard + server 400 `SAME_STATUS`).
- **Permissions:** Admin only. Others: inline "Not authorized for current role."
- **A11y:** Table `<caption>` with student name; correction select `aria-label="Correct attendance status for {date} Period {n}"`.
- **Performance:** Server-side pagination, limit 50.

### Screen: Attendance Summary
- **Goal:** Monthly summary for a student.
- **API calls:** `GET /students/{studentId}/attendance?from={YYYY-MM-01}&to={YYYY-MM-DD}&limit=50` — consume `response.summary` only; 403: "Not authorized."; 404: "Student not found."
- **Local state:** `selectedStudentId`, `selectedMonth` (YYYY-MM, default current month)
- **Server state:** TQ key `['student-attendance', studentId, from, to]`. Stale: 5 min.
- **Loading:** Summary card skeleton. **Empty:** "No attendance data for {month}." (when `summary.totalRecords === 0`)
- **Form validation:** `studentId` required; `month` required YYYY-MM not future.
- **Permissions:** Admin only.

### Screen: User Management (`/manage/users`)
- **API calls:**
  1. `GET /users?role={filter}&search={q}`
  2. `POST /users` — 201: invalidate `['users']`; 409: "Email already exists."; 400: field errors.
  3. `PUT /users/{id}/roles` — 200: invalidate; 403 `LASTADMIN`: toast "Cannot remove Admin role — this user is the last admin."; 404: toast.
  4. `DELETE /users/bulk` — 200: result toast + failed rows highlighted red.
  5. `DELETE /users/{id}` — 204: toast; 409: "Cannot delete: user has active records."
- **Local state:** `selectedIds: Set<string>`, `createDrawerOpen`, `roleEditUserId`, `searchQuery`, `roleFilter`
- **Server state:** TQ key `['users', roleFilter, searchQuery]`. Stale: 2 min.
- **Form validation (create):** `name` required max 255; `email` required valid; `password` required min 8; `roles` required ≥ 1 values in `[Teacher, Admin, Student]` (v3.4)
- **Form validation (update roles):** `roles` required non-empty, values in `[Teacher, Admin, Student]`, no duplicates
- **Permissions:** Role editor hidden when `targetUser.id === currentUser.id`. Delete hidden for current user.
- **A11y:** Checkbox rows `aria-label="Select {userName}"`; bulk bar `aria-live="polite"`.

### Screen: Student Management (`/manage/students`)
- **API calls:**
  1. `GET /students`
  2. `POST /students` — 201: invalidate; 400: field errors (batch/class mismatch).
  3. `PUT /students/{id}/link-account` (v3.4) — 200: invalidate, toast "Account linked."; 409 `USER_ALREADY_LINKED`: "This user is already linked to another student."; 400/404: toast.
  4. `DELETE /students/bulk` — 200: result toast.
  5. `DELETE /students/{id}` — 204: toast; 409: "Cannot delete: student has attendance records."
- **Local state:** `selectedIds: Set<string>`, `createDrawerOpen`, `linkAccountStudentId: string | null`, `searchQuery`
- **Server state:** TQ key `['students']`. Stale: 2 min.
- **Link Account (v3.4):** Table column shows `userId` or "Not linked". "Link Account" row button → dialog with `userId` text input → `PUT /students/{id}/link-account`.
- **Form validation (create):** `name` required max 255; `classId` required; `batchId` required must match `class.batchId`
- **Form validation (link account):** `userId` required non-empty string
- **A11y:** Link Account dialog traps focus; `aria-label="Enter user ID to link"`.
- **Performance:** Virtualize rows if > 200 students.

### Screens: Class / Batch / Subject Management

| Screen | Route | TQ key | Create fields | Key 409 |
|---|---|---|---|---|
| Classes | /manage/classes | `['classes']` | `name` required max 255, `batchId` required | "Cannot delete: students enrolled." |
| Batches | /manage/batches | `['batches']` | `name` max 100, `startYear`, `endYear` (> startYear), `status` Active|Archived | "Cannot delete: classes reference this batch." |
| Subjects | /manage/subjects | `['subjects']` | `name` required max 255, `code` optional max 50 | "Cannot delete: timetable slots reference this subject." |

All: stale 5 min; table skeleton; "No {entity} found." empty state; create + edit drawer + bulk delete + single delete; Admin only; standard `aria-label` on edit/delete buttons.

### Screen: School Periods (`/manage/school-periods`)
- **API calls:**
  1. `GET /school-periods` — 200: list by `periodNumber`; 403 `FEATURE_DISABLED`: full-page gate.
  2. `POST /school-periods` — 201: invalidate `['school-periods']`; 409: "Period number {n} already exists."; 400 `PERIOD_TIME_INVALID`: "Start time must be before end time."
  3. `PUT /school-periods/{id}` — 200: invalidate; 400: inline time error; 404: toast.
  4. `DELETE /school-periods/{id}` — 204: invalidate `['school-periods']` AND `['timetable']`; 409 `HAS_REFERENCES`: inline "Cannot delete — active timetable slots use this period."
- **Local state:** `createDrawerOpen`, `editPeriodId`, `deleteConfirmPeriodId`
- **Server state:** TQ key `['school-periods']`. Stale: 5 min. Any mutation: invalidate `['school-periods']` AND `['timetable']`.
- **Loading:** Skeleton 8 rows. **Empty:** "No periods configured. Add your first period."
- **Form validation:** `periodNumber` required integer ≥ 1 unique immutable after creation; `label` optional max 100; `startTime` required `^\d{2}:\d{2}$`; `endTime` required strictly after `startTime`.
- **A11y:** `type="time"` inputs with `aria-label`; edit form `periodNumber` is `aria-disabled="true"` + tooltip "Period number cannot be changed after creation."

### Screen: SuperAdmin Login
- **API calls:** `POST /super-admin/auth/login` — 200: store in `localStorage['sa_auth']`, redirect `/tenants`; 401: "Invalid email or password."; 400: field errors.
- **Form validation:** `email` required valid; `password` required minLength 8.
- **Permissions:** Public. Authenticated → redirect `/tenants`.

### Screen: Tenant Management (`/tenants`)
- **API calls:**
  1. `GET /super-admin/tenants?status={filter}&search={q}`
  2. `POST /super-admin/tenants` — 201: invalidate `['sa-tenants']`, toast "Tenant created. 8 default periods seeded."; 409 `CONFLICT`: "Tenant ID or slug already exists."; 409 `ADMIN_EMAIL_TAKEN`: "Admin email already exists."; 400: field errors incl. "admin block is required."
  3. `PUT /super-admin/tenants/{id}` — 200: invalidate, toast; 409: "Slug already taken."
  4. `PUT /super-admin/tenants/{id}/deactivate` — 200: invalidate, toast; 409 `ALREADY_INACTIVE`: "Tenant is already inactive."
  5. `PUT /super-admin/tenants/{id}/reactivate` (v3.4) — 200: invalidate, toast "Tenant reactivated."; 409 `ALREADY_ACTIVE`: "Tenant is already active."
- **Local state:** `createDrawerOpen`, `editTenantId`, `deactivateConfirmId`, `reactivateConfirmId`, `searchQuery`, `statusFilter`
- **Server state:** TQ key `['sa-tenants', statusFilter, searchQuery]`. Stale: 1 min.
- **Create Tenant form (v3.4 — admin block required):**
  - Section 1 (Tenant): `id` required alphanumeric+dash max 50; `name` required max 255; `slug` required `^[a-z0-9-]+$` max 100
  - Section 2 (First Admin): `admin.name` required max 255; `admin.email` required valid; `admin.password` required minLength 8
  - Both sections required — submit blocked if any field missing.
- **Row actions:** Active → "Edit" + "Deactivate". Inactive → "Edit" + "Reactivate".
- **A11y:** Deactivate/reactivate confirmations are `<Dialog>` with focus trap; Escape cancels.

### Screen: Tenant Feature Flags (`/tenants/:tenantId/features`)
- **API calls:**
  1. `GET /super-admin/tenants/{tenantId}/features` — 200: render toggles; 404: "Tenant not found."
  2. `PUT /super-admin/tenants/{tenantId}/features/{featureKey}` — 200: update toggle; 400 `FEATURE_DEPENDENCY`: revert + inline "Attendance requires Timetable to be enabled first."; 404: toast.
- **Local state:** Optimistic toggle state per feature key.
- **Server state:** TQ key `['sa-features', tenantId]`. Stale: 30 sec.
- **Error:** 400 `FEATURE_DEPENDENCY`: revert optimistic toggle + inline warning. 500: revert + toast.
- **Permissions:** Attendance toggle disabled (greyed) when timetable is disabled.
- **A11y:** `role="switch"` with `aria-checked`, `aria-label="{featureName}"`.

### Static Screens: `/privacy` and `/terms`
- Public. Hardcoded text. `/privacy` covers DPDPA 2023: data collected, purpose, retention, user rights, contact.

---

## 3. API Assumptions

### 3.0 Backend Contract (LOCKED)

**Backend Freeze:** v3.4 (2026-03-02) | **OpenAPI:** 3.4.0 | **File:** `./docs/openapi.yaml`
**Base URL:** `VITE_API_BASE_URL` (from env — never hardcoded)
**Auth:** Bearer JWT. Header: `Authorization: Bearer {token}`.
**Token storage:** `localStorage['auth']` (tenant); `localStorage['sa_auth']` (superadmin).

**Global error shape (MUST match OpenAPI 3.4.0):**
```json
{
  "error": { "code": "ERROR_CODE", "message": "Human-readable", "details": {} },
  "timestamp": "ISO8601"
}
```

### 3.1 Mock Server (REQUIRED)

```bash
npm install -g @stoplight/prism-cli
prism mock ./docs/openapi.yaml --port 4010
# Frontend env: VITE_API_BASE_URL=http://localhost:4010/api
```

**Failure simulation (v3.4):**

| Scenario | Header | Endpoint |
|---|---|---|
| Invalid token (401) | `Prefer: code=401` | Any protected endpoint |
| Inactive tenant (403) | `Prefer: code=403` | `POST /auth/login` |
| Single-role switch (403) | `Prefer: code=403` | `POST /auth/switch-role` |
| Last admin guard (403) | `Prefer: code=403` | `PUT /users/{id}/roles` |
| Period not configured (400) | `Prefer: code=400` | `POST /timetable` |
| Slot occupied (409) | `Prefer: code=409` | `POST /timetable` |
| Duplicate email (409) | `Prefer: code=409` | `POST /users` |
| User already linked (409) | `Prefer: code=409` | `PUT /students/{id}/link-account` |
| Same status correction (400) | `Prefer: code=400` | `PUT /attendance/{recordId}` |
| Future date correction (400) | `Prefer: code=400` | `PUT /attendance/{recordId}` |
| Feature dependency (400) | `Prefer: code=400` | `PUT /super-admin/tenants/{id}/features/attendance` |
| Missing admin block (400) | `Prefer: code=400` | `POST /super-admin/tenants` |
| Admin email taken (409) | `Prefer: code=409` | `POST /super-admin/tenants` |
| Already inactive (409) | `Prefer: code=409` | `PUT /super-admin/tenants/{id}/deactivate` |
| Already active (409) | `Prefer: code=409` | `PUT /super-admin/tenants/{id}/reactivate` |
| Not found (404) | `Prefer: code=404` | Any `/{id}` endpoint |
| Server error (500) | `Prefer: code=500` | Any endpoint |

### 3.2 Typed API Surface (LOCKED — matches OpenAPI 3.4.0 exactly)

```ts
// ─── ERRORS ───────────────────────────────────────────────────────────────────
interface ApiError {
  error: { code: string; message: string; details?: Record<string, unknown> };
  timestamp: string;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
type TenantRole = 'Teacher' | 'Admin' | 'Student'; // v3.4: Student added

interface TenantUser {
  id: string; tenantId: string; name: string; email: string;
  roles: TenantRole[]; // min 1
  activeRole: TenantRole;
}
interface TenantLoginRequest  { email: string; password: string; tenantSlug: string; }
interface TenantLoginResponse { token: string; user: TenantUser; }
interface SwitchRoleRequest   { role: TenantRole; }
interface SwitchRoleResponse  { token: string; user: TenantUser; }

// ─── SUPER ADMIN AUTH ──────────────────────────────────────────────────────────
interface SuperAdminProfile { id: string; name: string; email: string; }
interface SALoginRequest    { email: string; password: string; }
interface SALoginResponse   { token: string; superAdmin: SuperAdminProfile; }

// ─── TENANTS ──────────────────────────────────────────────────────────────────
interface Tenant {
  id: string; name: string; slug: string;
  status: 'active' | 'inactive';
  deactivatedAt: string | null; createdAt: string;
}
interface CreateTenantRequest {
  id: string; name: string; slug: string;
  admin: { name: string; email: string; password: string }; // v3.4: required
}
interface CreateTenantResponse {
  tenant: Tenant;
  admin: { id: string; name: string; email: string; roles: TenantRole[] };
}
interface UpdateTenantRequest { name?: string; slug?: string; }

// ─── FEATURES ─────────────────────────────────────────────────────────────────
interface Feature {
  key: 'timetable' | 'attendance'; name: string;
  enabled: boolean; enabledAt: string | null;
}
interface ToggleFeatureRequest  { enabled: boolean; }
interface ToggleFeatureResponse { feature: Feature; }

// ─── USERS ────────────────────────────────────────────────────────────────────
interface User { id: string; name: string; email: string; roles: TenantRole[]; }
interface CreateUserRequest  { name: string; email: string; password: string; roles: TenantRole[]; }
interface UpdateRolesRequest { roles: TenantRole[]; }

// ─── SCHOOL PERIODS ───────────────────────────────────────────────────────────
interface SchoolPeriod {
  id: string; periodNumber: number; label: string;
  startTime: string; endTime: string; // HH:MM
}
interface CreatePeriodRequest { periodNumber: number; label?: string; startTime: string; endTime: string; }
interface UpdatePeriodRequest { label?: string; startTime?: string; endTime?: string; }

// ─── TIMETABLE ────────────────────────────────────────────────────────────────
type DayOfWeek = 'Monday'|'Tuesday'|'Wednesday'|'Thursday'|'Friday'|'Saturday'|'Sunday';

interface TimeSlot {
  id: string; classId: string; className: string;
  subjectId: string; subjectName: string;
  teacherId: string; teacherName: string;
  dayOfWeek: DayOfWeek; periodNumber: number;
  label: string; startTime: string; endTime: string;
  effectiveFrom: string; effectiveTo: string | null;
}
interface CreateTimeSlotRequest {
  classId: string; subjectId: string; teacherId: string;
  dayOfWeek: DayOfWeek; periodNumber: number; effectiveFrom: string;
}
interface TimetableResponse { timetable: TimeSlot[]; }

// ─── STUDENTS ─────────────────────────────────────────────────────────────────
interface Student {
  id: string; name: string; classId: string; className: string;
  batchId: string; batchName: string;
  userId: string | null; // v3.4: nullable FK to users.id
}
interface CreateStudentRequest { name: string; classId: string; batchId: string; }
interface LinkAccountRequest   { userId: string; }
interface LinkAccountResponse  { student: Student; }

// ─── BATCHES ──────────────────────────────────────────────────────────────────
interface Batch { id: string; name: string; startYear: number; endYear: number; status: 'Active'|'Archived'; }
interface CreateBatchRequest { name: string; startYear: number; endYear: number; status: 'Active'|'Archived'; }

// ─── CLASSES ──────────────────────────────────────────────────────────────────
interface Class  { id: string; name: string; batchId: string; batchName: string; }
interface CreateClassRequest { name: string; batchId: string; }

// ─── SUBJECTS ─────────────────────────────────────────────────────────────────
interface Subject { id: string; name: string; code: string | null; }
interface CreateSubjectRequest { name: string; code?: string; }

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────
type AttendanceStatus = 'Present' | 'Absent' | 'Late';

interface AttendanceRecord {
  id: string; date: string;
  originalStatus: AttendanceStatus; // v3.4: never mutated after insert
  status: AttendanceStatus;         // effective (equals correctedStatus if corrected)
  correctedBy: string | null;       // v3.4
  correctedAt: string | null;       // v3.4
  timeSlot: { id: string; subjectName: string; periodNumber: number; dayOfWeek: string; };
  recordedBy: string; recordedAt: string;
}
interface RecordClassRequest {
  timeSlotId: string; date: string;
  defaultStatus: AttendanceStatus;
  exceptions: Array<{ studentId: string; status: AttendanceStatus }>;
}
interface RecordClassResponse { recorded: number; present: number; absent: number; late: number; }
interface CorrectAttendanceRequest  { status: AttendanceStatus; } // v3.4
interface CorrectAttendanceResponse { record: AttendanceRecord; } // v3.4

// ─── PAGINATION ───────────────────────────────────────────────────────────────
interface Pagination { limit: number; offset: number; total: number; }

// ─── BULK DELETE ──────────────────────────────────────────────────────────────
interface BulkDeleteRequest  { ids: string[]; }
interface BulkDeleteResponse {
  deleted: string[];
  failed: Array<{ id: string; reason: 'NOT_FOUND'|'HAS_REFERENCES'; message: string }>;
}
```

### 3.3 Caching & Invalidation Rules (LOCKED)

| TQ Key | Stale Time | Invalidated By |
|---|---|---|
| `['timetable', filters]` | 5 min | `POST /timetable`, `PUT /timetable/{id}/end`, `DELETE /school-periods/{id}` |
| `['timetable', 'today', date]` | 5 min | Same as above |
| `['school-periods']` | 5 min | `POST/PUT/DELETE /school-periods` |
| `['students', 'classId', id]` | 2 min | `POST /students`, `DELETE /students/{id}`, `DELETE /students/bulk`, `PUT /students/{id}/link-account` |
| `['students']` | 2 min | Same as above |
| `['users', role, search]` | 2 min | `POST /users`, `PUT /users/{id}/roles`, `DELETE /users/{id}`, `DELETE /users/bulk` |
| `['classes']` | 2 min | `POST/PUT /classes`, `DELETE /classes/{id}`, `DELETE /classes/bulk` |
| `['batches']` | 5 min | `POST/PUT /batches`, `DELETE /batches/{id}`, `DELETE /batches/bulk` |
| `['subjects']` | 5 min | `POST/PUT /subjects`, `DELETE /subjects/{id}`, `DELETE /subjects/bulk` |
| `['student-attendance', id, from, to, page]` | 2 min | `PUT /attendance/{recordId}` |
| `['sa-tenants', status, search]` | 1 min | `POST/PUT /super-admin/tenants`, deactivate, reactivate |
| `['sa-features', tenantId]` | 30 sec | `PUT /super-admin/tenants/{id}/features/{key}` |

**Optimistic updates:** Feature flag toggles only (revert on error). No other optimistic updates.
**Refetch triggers:** Window focus (all queries). No polling.

### 3.4 Retry Rules (LOCKED)

- **GET requests:** Retry up to 3 times, exponential backoff (1s, 2s, 4s)
- **Mutations (POST/PUT/DELETE):** Never retry automatically
- **401:** Axios interceptor fires `window.CustomEvent('AUTH_EXPIRED')`, clears `localStorage['auth']`, `isExpired = true` → `<SessionExpiredModal>` → user clicks "Log in" → navigate `/login`
- **403:** Surface `error.code` + `error.message` inline or toast. No retry.
- **429:** Toast "Too many requests. Please wait a moment." No auto-retry.
- **500:** Toast + retry button for GET; toast error for mutations.
- **Network error:** Toast "Connection lost." Retry button for GET.

---

## 4. State Management & Data Flow (LOCKED)

| Layer | Tool | What lives here |
|---|---|---|
| Server state | TanStack Query | All API data |
| Auth/session | React Context (`AuthContext`) | `user`, `token`, `isAuthenticated`, `isExpired` |
| UI state | Local `useState` | Drawer open/close, selected IDs, active cell, form state |
| Persistent | `localStorage` | `auth` (tenant JWT+user), `sa_auth` (SuperAdmin JWT) |

**AuthContext responsibilities:**
- `login(token, user)` — writes `localStorage['auth']` + React state atomically
- `logout()` — fire-and-forget `POST /auth/logout`, clear storage, reset state
- `switchRole(req)` — calls `POST /auth/switch-role`, on 200: `login(newToken, newUser)` + dispatch `window.CustomEvent('ROLE_SWITCHED')`
- `dismissExpired()` — clears `isExpired` flag

**ROLE_SWITCHED handler (App.tsx):**
```ts
window.addEventListener('ROLE_SWITCHED', () => queryClient.clear());
```
Clears all TQ cache so next render fetches data scoped to new `activeRole`.

**Cross-tab:** No multi-tab sync. Each tab independently handles 401. Logout clears localStorage — other tabs show session expired modal on next API call.

---

## 5. Design System & UI Constraints (CR-FE-003)

**Color system:**
- Background: `bg-background`; Surface: `bg-card border border-border shadow-sm`; Primary: shadcn/ui default indigo
- Status badges: Present → `bg-green-100 text-green-800`; Absent → `bg-red-100 text-red-800`; Late → `bg-yellow-100 text-yellow-800`
- Contrast minimum: 4.5:1 (WCAG 2.1 AA)

**Typography (LOCKED):**
- Page headings: `text-2xl font-bold tracking-tight`
- Section headings: `text-base font-semibold`
- Table headers: `text-xs font-semibold text-muted-foreground uppercase tracking-wide`
- Body/label: `text-sm`; Helper: `text-xs text-muted-foreground`

**Sidebar (CR-FE-003 + CR-FE-006):**
- Fixed left, `w-56` desktop; collapses on mobile
- Top: app name + logo mark; below brand: `RoleSwitcher` dropdown (if `roles.length > 1`); role context badge `text-xs text-muted-foreground`
- Active nav: `bg-primary/10 text-primary font-medium rounded-lg`; inactive: `text-muted-foreground hover:bg-muted`
- Nav items rendered strictly from `user.activeRole` (CR-FE-006)
- Bottom: user name + email + logout button

**RoleSwitcher (CR-FE-005):**
```
[activeRole  ▾]    ← DropdownMenu trigger, only if roles.length > 1
  ✓ Admin           ← checkmark on active
    Teacher
    Student         ← only if in user.roles
```

**Component standards:**
- Cards: `rounded-xl border bg-card shadow-sm p-4`
- Tables: header `bg-muted/50 border-b`; rows `border-b last:border-b-0 hover:bg-muted/40`; action buttons `opacity-0 group-hover:opacity-100`
- Timetable: colored column header band; filled cells as subject-accent chip `rounded-md px-2 py-1 text-xs font-medium`; empty cells Admin hover: `bg-muted/30 border-dashed cursor-pointer` + `+` icon
- Modals/Drawers: shadcn/ui `<Sheet>` (right side) for forms; `<Dialog>` for confirmations
- Toasts: shadcn/ui Sonner; success = default; error = destructive; max 3 visible
- Buttons: min-height 44px (touch target); disabled: `opacity-50 pointer-events-none`

**Responsiveness:** Mobile-first; breakpoints: Tailwind defaults; timetable grid: `overflow-x-auto` on < 768px.

**Component inventory (MVP):** Button, Input, Select, Checkbox, RadioGroup, Switch, Badge, Card, Table, Sheet, Dialog, Popover, DropdownMenu, Toast/Sonner, Skeleton, Avatar (initials), Separator, ScrollArea, Tooltip.

---

## 6. Accessibility Baseline (LOCKED)

**Target:** WCAG 2.1 AA

**Mandatory behaviors:**
- Full keyboard navigation (Tab, Shift+Tab, Enter, Space, Escape, Arrow keys in menus)
- Visible focus ring: `focus-visible:ring-2 focus-visible:ring-ring` on all interactive elements
- Form errors: `role="alert"` + `aria-describedby`
- Dialog/Sheet/Popover: focus trap on open; Escape closes; focus returns to trigger
- Tables: `<caption>` (visually hidden acceptable)
- Status badges: text label always present (not color alone)
- Decorative icons: `aria-hidden="true"`; standalone icon buttons: `aria-label` required
- Timetable grid: `role="grid"`, `role="row"`, `role="gridcell"`; interactive empty cells: `aria-label="Add slot for {dayOfWeek} Period {n}"`
- RoleSwitcher: `aria-haspopup="menu"`, `aria-expanded`; menu items `role="menuitem"`
- Feature toggles: `role="switch"`, `aria-checked`
- Attendance radio groups: `role="radiogroup"` + `aria-label` per student

**Testing:** axe-core in CI against all 15 screens. Manual keyboard walkthrough on Dashboard, Timetable, Record Attendance before each release.

---

## 7. Performance Budgets (LOCKED)

- LCP: ≤ 2500ms (mobile 4G); INP: ≤ 200ms; CLS: ≤ 0.1
- Initial JS bundle (tenant app): ≤ 250KB gzipped; (SA portal): ≤ 150KB gzipped

**Techniques:**
- Code splitting: yes — `React.lazy` + `<Suspense>` per route
- Images: SVG icons only (lucide-react); no bitmap images in app shell
- Virtualized lists: Student list in Record Attendance + Student Management if > 200 rows
- Timetable grid: no virtualization needed (≤ 105 cells)

**Route budgets:** `/dashboard` ≤ 1 API call + ≤ 100KB chunk; `/attendance/record` ≤ 2 API calls + ≤ 120KB chunk; `/timetable` ≤ 2 API calls + ≤ 120KB chunk.

---

## 8. Security & Privacy (Frontend)

- **XSS:** No `dangerouslySetInnerHTML`. All user strings rendered as React text nodes (auto-escaped).
- **CSRF:** Not applicable (Bearer JWT in Authorization header — no auth cookies).
- **Token storage:** `localStorage`. Acceptable tradeoff for non-financial/non-medical school data.
- **PII:** Student/teacher names + emails rendered in UI — never logged to console in production; never in URL query params.
- **Secrets:** No secrets in `VITE_*` env vars (all build-time public).
- **Tenant isolation:** Enforced by backend JWT. Frontend never mixes `tenantId` data between sessions.

---

## 9. Observability (Frontend)

**Logging/telemetry:** None. No Sentry, Mixpanel, Amplitude, GA, or equivalent in MVP.

**Console rules:**
- Development: `console.error` on caught API errors acceptable.
- Production: no `console.log` / `console.error` (strip via Vite minify + ESLint `no-console`).

---

## 10. Testing Strategy (LOCKED)

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | Utility functions, Zod schemas, role-gating logic, date helpers |
| Component | Vitest + RTL | Forms, RoleSwitcher dropdown, attendance correction row, timetable cell interactions |
| Integration | Vitest + MSW | Full screen flows against mocked API responses matching OpenAPI 3.4.0 shapes |
| E2E | Playwright | Login → dashboard, Teacher record attendance, Admin create slot via cell click, role switch updates sidebar, SuperAdmin create tenant |
| A11y | axe-core | All 15 screens in CI |
| Visual regression | None (out of scope) | — |

**Contract alignment (REQUIRED):** All MSW handlers must use shapes from `openapi.yaml` 3.4.0. Any invented API call → test must fail until backend CR approved.

**MVP test checklist (required before first production deploy):**
- [ ] Tenant login — all 5 error states (400, 401, 403 TENANT_INACTIVE, 404)
- [ ] Role switch dropdown — success, 403 SINGLE_ROLE_USER, loading state
- [ ] Sidebar — correct items per activeRole (Teacher/Admin/Student)
- [ ] Dashboard — role-specific content for each activeRole
- [ ] Timetable cell click (empty) — create drawer opens with pre-filled dayOfWeek + periodNumber
- [ ] Timetable cell click (filled) — popover shows details + End Assignment
- [ ] Record Attendance — full submit including exception map
- [ ] Attendance correction — SAME_STATUS guard, successful correction, originalStatus never changes
- [ ] Student Management link-account — success + USER_ALREADY_LINKED error
- [ ] Tenant create — admin block required validation
- [ ] Tenant reactivate — ALREADY_ACTIVE error
- [ ] All 15 screens — WCAG 2.1 AA axe-core pass
- [ ] Session expired modal — appears on 401, clears auth, redirects to login

---

## 11. Project Structure (Frontend skeleton)

```
/                                        ← Tenant app (Vite project)
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── /src
│   ├── main.tsx
│   ├── /app
│   │   ├── App.tsx                      ← Router + QueryClient + ROLE_SWITCHED handler
│   │   ├── Layout.tsx                   ← Sidebar (role-gated nav) + outlet
│   │   └── ProtectedRoute.tsx           ← Auth + activeRole guard
│   ├── /api
│   │   ├── client.ts                    ← Axios instance + 401/429 interceptors
│   │   ├── auth.ts
│   │   ├── timetable.ts
│   │   ├── attendance.ts
│   │   ├── students.ts
│   │   ├── users.ts
│   │   ├── classes.ts
│   │   ├── batches.ts
│   │   ├── subjects.ts
│   │   └── schoolPeriods.ts
│   ├── /components
│   │   ├── /ui                          ← shadcn/ui primitives
│   │   ├── RoleSwitcher.tsx             ← CR-FE-005: DropdownMenu variant
│   │   ├── SessionExpiredModal.tsx
│   │   ├── BulkActionBar.tsx
│   │   └── StatusBadge.tsx
│   ├── /features
│   │   ├── /auth
│   │   │   ├── AuthContext.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   └── useAuth.ts
│   │   ├── /dashboard
│   │   │   └── DashboardPage.tsx        ← role-specific content (CR-FE-006)
│   │   ├── /timetable
│   │   │   ├── TimetablePage.tsx
│   │   │   ├── TimetableGrid.tsx
│   │   │   ├── TimetableCell.tsx        ← empty/filled cell logic (CR-FE-004)
│   │   │   └── CreateSlotDrawer.tsx
│   │   ├── /attendance
│   │   │   ├── RecordAttendancePage.tsx
│   │   │   ├── AttendanceSummaryPage.tsx
│   │   │   └── StudentAttendanceHistoryPage.tsx  ← + correction row (CR-FE-002)
│   │   └── /manage
│   │       ├── UsersPage.tsx
│   │       ├── StudentsPage.tsx         ← + link-account action (CR-FE-002)
│   │       ├── ClassesPage.tsx
│   │       ├── BatchesPage.tsx
│   │       ├── SubjectsPage.tsx
│   │       └── SchoolPeriodsPage.tsx
│   ├── /hooks
│   │   └── useAuth.ts
│   ├── /styles
│   │   └── globals.css
│   ├── /types
│   │   └── api.ts                       ← All interfaces from Section 3.2
│   └── /utils
│       ├── cn.ts
│       ├── dates.ts
│       ├── errors.ts
│       └── roles.ts                     ← isMultiRole, getNavItemsForRole (CR-FE-006)
└── /tests
    ├── /unit
    ├── /component
    ├── /integration                     ← MSW handlers matching OpenAPI 3.4.0
    └── /e2e                             ← Playwright

/admin-portal                            ← SuperAdmin portal (separate Vite project)
├── .env.example
├── package.json
├── vite.config.ts
└── /src
    ├── /api
    │   └── superAdmin.ts
    ├── /features
    │   ├── /auth
    │   │   ├── SAAuthContext.tsx
    │   │   └── SALoginPage.tsx
    │   ├── /tenants
    │   │   ├── TenantsPage.tsx          ← + reactivate action (CR-FE-002)
    │   │   └── CreateTenantDrawer.tsx   ← + admin block Section 2 (CR-FE-002)
    │   └── /features
    │       └── TenantFeaturesPage.tsx
    └── /types
        └── api.ts
```

**Naming:** `PascalCase` for components/types; `camelCase` for variables/functions/files (except components); `kebab-case` for CSS.
**Import alias:** `@/` → `/src/`

---

## 12. Deployment, Rollback, Environments

**Hosting:** Cloudflare Pages

**Build commands (LOCKED):**
```bash
cd app && npm run build          # output: dist/
cd admin-portal && npm run build # output: dist/
```

**Environment mapping:**

| Env | `VITE_APP_ENV` | `VITE_API_BASE_URL` |
|---|---|---|
| Development | `development` | `http://localhost:3000/api` (or `:4010` for Prism) |
| Staging | `staging` | `https://api-staging.yourdomain.com/api` |
| Production | `production` | `https://api.yourdomain.com/api` |

**Rollback:** Cloudflare Pages deployment history — reactivate previous deployment (< 60 seconds).
**Cache/CDN invalidation:** Automatic on each Cloudflare Pages deploy.

---

## 13. Forbidden Changes (Scope Lock)

**BANNED without new Freeze version + re-pricing:**
- Add routes or screens
- Change routing mode (SPA → SSR/SSG)
- Change state management library
- Change auth mode (localStorage JWT → cookies/sessions)
- Change UI component library (shadcn/ui → anything else)
- Change build tool (Vite → Next.js or anything else)
- Add i18n / multi-language support
- Add offline/PWA capability
- Add analytics or telemetry of any kind
- Change API assumptions derived from OpenAPI 3.4.0 (endpoints, fields, status codes, error shapes)
- Implement Student attendance self-view without first resolving CG-01 via backend CR
- Call any endpoint, field, or error code not present in OpenAPI 3.4.0

**If requested:** create Change Request → re-price → approve/reject → new Freeze version.

---

## 14. Change Control

**Change Request Format:**
```
- Requested change:
- Reason:
- Scope impact:
- Timeline impact (+/- days):
- Cost impact:
- Risk impact:
- API contract impact (unchanged / requires backend CR + new OpenAPI version):
- Backend Freeze dependency (unchanged / updated to vX.X):
- OpenAPI dependency (unchanged / updated to X.X.X):
- Decision: Approved / Rejected
- New Freeze version: v1.X
```

**Billing rule:** Solo project — no billing. Log as decision record only.
**Response SLA:** 24 hours.

---

## 15. Version History

| Version | Date | Summary |
|---|---|---|
| v1.0 | 2026-02-26 | Initial freeze. Backend v3.3 / OpenAPI 3.3.0. 10 user stories. |
| v1.1 | 2026-03-01 | CR-FE-001: Student role scoping, attendance summary screen, school periods screen, bulk delete pattern. Backend v3.3 unchanged. |
| v1.2 | 2026-03-02 | CR-FE-002 (backend v3.4 sync: Student role, attendance correction, student link-account, tenant reactivate, admin block on create tenant, LASTADMIN error); CR-FE-003 (UX/visual refresh); CR-FE-004 (timetable inline cell click); CR-FE-005 (role switcher dropdown); CR-FE-006 (role-gated sidebar + role-specific dashboards). Backend v3.4 / OpenAPI 3.4.0. 11 user stories. |
