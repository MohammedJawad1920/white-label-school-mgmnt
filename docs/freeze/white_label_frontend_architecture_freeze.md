# FRONTEND PROJECT FREEZE
**White-Label School Management System**

---

**Version:** 1.9 (IMMUTABLE)
**Date:** 2026-03-08
**Status:** APPROVED FOR EXECUTION
**Supersedes:** v1.8 (2026-03-08)
**Backend Freeze:** v4.5 (2026-03-08)
**OpenAPI:** v4.5.0

---

## CRITICAL INSTRUCTION FOR EXECUTION (HUMAN OR AI)

This document is the **Absolute Source of Truth**. v1.8 is **SUPERSEDED**.

You have **NO authority** to modify routes, API assumptions, or constraints defined below.

If any request contradicts this document, you must **REFUSE** and open a **Change Request** instead.

---

## CHANGE SUMMARY: v1.8 → v1.9

### Change Requests Applied

| CR | Title | Type | Impact |
|----|-------|------|--------|
| **CR-FE-016a** | Version header sync: Backend v4.4→v4.5, OpenAPI 4.4.0→4.5.0 | Non-breaking | Header, §3.0 |
| **CR-FE-016b** | CR-38: `studentId` in JWT — type update + CG-01 Student dashboard resolution | Breaking (type), non-breaking UX | Auth types, Dashboard (Student) |
| **CR-FE-016c** | CR-35: Daily slot summary → Dashboard API-driven stat bar + Timetable marking-status color-coding | Additive | Dashboard (Admin/Teacher), Timetable |
| **CR-FE-016d** | CR-33: Absence streaks panel in Record Attendance screen | Additive | Record Attendance |
| **CR-FE-016e** | CR-34: Toppers — Teacher Dashboard "Class Rankings" card + Admin Attendance Summary "Rankings" tab | Additive | Dashboard (Teacher), Attendance Summary (Admin) |
| **CR-FE-016f** | CR-36: New screen `/attendance/monthly-sheet` (Admin + Teacher) | Additive — new route | New screen: Monthly Sheet |
| **CR-FE-016g** | CR-37: New screen `/manage/events` (Admin CRUD) + Upcoming Events card on Dashboard (all roles) | Additive — new route + widget | New screen: Events; Dashboard |

### Backend Contract Sync

- **Backend Freeze:** v4.4 → v4.5
- **OpenAPI:** 4.4.0 → 4.5.0
- **Backend CRs triggering frontend changes:** CR-33, CR-34, CR-35, CR-36, CR-37, CR-38

### What Changed

**Breaking changes:**

- **`TenantUser` type** gains `studentId: string | null` (CR-38, CR-FE-016b). Must be present in `AuthContext`. Frontend must handle `null` gracefully — show degraded state: *"Your student profile is not yet linked — contact your administrator."*
- **`TenantUserResponse` / login response type** updated identically (CR-38, CR-FE-016b).
- **Student dashboard** CG-01 placeholder **removed** — replaced with live `GET /students/{studentId}/attendance` call using `user.studentId` from JWT. Degraded state shown when `studentId === null` (CR-FE-016b).

**Additive — Dashboard:**

- **Admin dashboard stat bar**: no longer client-side timetable-derived. Now calls `GET /attendance/daily-summary?classId=ALL&date=today` per class for actual marking status. Stat bar shows: "Total Periods: {N} | Marked: {N} | Unmarked: {N}" (CR-FE-016c).
- **Teacher dashboard**: new "Class Rankings" card per assigned class — calls `GET /attendance/toppers?classId=X&from=30daysAgo&to=today&limit=5` (read-only, collapsed by default) (CR-FE-016e).
- **All roles dashboard**: new "Upcoming Events" card — calls `GET /events` with default month range (CR-FE-016g).

**Additive — Timetable:**

- Filled cells gain marking-status indicator: `bg-green-100` (marked), `bg-yellow-50` (unmarked), derived from `GET /attendance/daily-summary` for today's date (CR-FE-016c). Indicator rendered only when viewing today's column.

**Additive — Record Attendance:**

- "At-Risk Students" collapsible panel added. Calls `GET /attendance/streaks?timeSlotId={selectedTimeSlotId}` when slot is selected. Shows students with `consecutiveAbsentCount ≥ 3` (configurable constant) highlighted with badge (CR-FE-016d).

**Additive — Attendance Summary:**

- New "Rankings" tab added to existing `/attendance/summary` screen (Admin only). Calls `GET /attendance/toppers?classId={selectedClassId}&from={from}&to={to}` with pagination (limit 10, offset) (CR-FE-016e).

**New screens:**

- `/attendance/monthly-sheet` — Monthly attendance grid (Admin + Teacher). New sidebar item for both roles (CR-FE-016f).
- `/manage/events` — Academic calendar CRUD (Admin). New sidebar item for Admin (CR-FE-016g).

**Type additions:**

- `StudentStreak`, `AttendanceTopper`, `DailySlotSummary`, `MonthlySheetStudent`, `CalendarEvent` (all below in §3.2).

**Removals:**

- None.

### User Story count

v1.8: 12 stories. v1.9: **18 stories** (6 added).

### Timeline Impact

| CR | Delta |
|----|-------|
| CR-FE-016a–b | +0 days (type update, CG-01 was stubbed) |
| CR-FE-016c | +1 day |
| CR-FE-016d | +1 day |
| CR-FE-016e | +1 day |
| CR-FE-016f | +2 days |
| CR-FE-016g | +3 days |
| **Net** | **+8 days** |

**New total: 9–13 weeks + 18 days**

---

## 0. COMMERCIALS (Accept-and-price)

**Engagement Type:** Fixed-scope
**Chosen Package:** Standard
**Price:** Self-funded solo project (no external billing)
**Payment Schedule:** N/A
**Timeline Range (weeks):** 9–13 + 18 days

### Assumptions (must be true)
- Solo developer is single decision maker
- Backend v4.5 available at staging by Week 3
- Prism mock used until backend ready

### Support Window (post-delivery)
- **Bugfix support:** 30 days
- **Enhancements:** billed as Change Requests

---

## 1. THE IRON SCOPE (Frontend only)

### Core Value Proposition (One Sentence)

A web frontend for a white-label school management SaaS, enabling teachers to record attendance and view at-risk student streaks, students to view their own schedules and attendance, and admins to manage timetables, academic calendar events, and school configuration — delivered as a mobile-first SPA on Cloudflare Pages.

### The 18 Frontend User Stories (COMPLETE SCOPE)

1. As a tenant user (Teacher, Admin, or Student), I can **log in with email/loginId, password, and school ID**, so that I access only my school's data.
2. As a Teacher, I can **see today's own assigned classes on a role-specific dashboard** and navigate to record attendance.
3. As an Admin, I can **see today's full schedule with an API-driven stat bar** (Total Periods / Marked / Unmarked) on a role-specific dashboard.
4. As a Student, I can **see today's school-wide timetable (read-only) and my own recent attendance history** on my dashboard — using `studentId` from my JWT.
5. As a Teacher or Admin, I can **view the full timetable grid** with marking-status color-coding on today's cells — Admin can add a slot by clicking an empty cell, and delete a slot by clicking a filled cell; to correct a slot's teacher or subject, Admin deletes and recreates the slot.
6. As a Teacher or Admin, I can **record attendance for a class period**, and see an "At-Risk Students" panel showing students with consecutive absences ≥ 3.
7. As an Admin, I can **view a student's full attendance history** and correct an individual record (with `originalStatus` preserved).
8. As an Admin, I can **view a monthly attendance summary** for a student, and view a **ranked leaderboard** of students by attendance percentage for a class.
9. As an Admin or Teacher, I can **view a monthly attendance grid** (student × day × period) for a class and subject at `/attendance/monthly-sheet`.
10. As an Admin, I can **manage users (Teacher/Admin roles only), students (with auto login account creation), classes (including year-end promotion and graduation), batches, subjects, and school periods**.
11. As a multi-role user, I can **switch my active role via a dropdown** — the sidebar and dashboard immediately reflect only pages relevant to that role.
12. As a SuperAdmin, I can **manage tenants** (create with admin block and timezone, update, deactivate, reactivate) and their **feature flags** from an isolated portal.
13. As an Admin, I can **promote all students from one class to another OR graduate them** at year-end via a confirmation dialog.
14. As a Teacher, I can **see a "Class Rankings" card on my dashboard** showing the top 5 students by attendance percentage for each of my assigned classes over the last 30 days.
15. As an Admin, I can **create, update, and delete academic calendar events** (holidays, exams, functions) at `/manage/events`.
16. As any authenticated user (Admin, Teacher, Student), I can **see upcoming calendar events for the current month** in a card on my dashboard.
17. As an Admin or Teacher, I can **view a daily slot attendance summary** showing which periods have been marked for a class on a specific date.
18. As a Student, I can **see my consecutive absence streak** for each subject on my dashboard (self-view only, via JWT `studentId`).

### The NO List (Explicitly Out of Scope)

- No forgot password / password reset flow
- No parent portal or parent role
- No real-time updates (no WebSocket, no polling)
- No CSV bulk import UI
- No audit log viewer UI
- No custom branding/theme UI
- No multi-language / i18n (English only)
- No charts or graph visualizations (summary tables and badge counts only)
- **No inline timetable slot edit** — `PUT /timetable/{id}` does not exist (CR-32). Correction = delete + recreate.
- No `PUT /features/{featureKey}` from tenant app (deprecated since v3.2, returns 403)
- No SSR/SEO (login-gated SPA)
- No analytics or telemetry
- No SuperAdmin self-registration screen
- No JWT token blacklist / forced session invalidation UI
- No SuperAdmin tenant hard-delete (deactivate/reactivate only)
- No student-to-user manual linking (auto-created via `POST /students`)
- No `PUT /students/{id}/link-account` in any frontend flow (deprecated endpoint)
- No year-end class promotion dedicated route (inline dialog in `/manage/classes` only)
- No student profile fields beyond school data (no photo, address, guardian contact)
- **No `GET /attendance/summary` class-level aggregate screen** — deferred to future CR
- **`GET /attendance/monthly-sheet` not accessible to Student** — backend returns 403; no Student route
- **No event soft-delete restore UI** — DELETE is irreversible; user must create a new event
- **No pagination on `GET /events`** — backend returns all events in range (bounded by date filter); no infinite scroll needed
- **No `GET /attendance/streaks` dedicated screen** — streaks surfaced inline within Record Attendance only; Student sees own streak badge on Dashboard only

### User Roles (UI behavior truth)

| activeRole | Sidebar Items | Key Restrictions |
|------------|---------------|------------------|
| **Teacher** | Dashboard, Timetable, Record Attendance, Monthly Sheet | Timetable read-only; no attendance summary/history; Monthly Sheet restricted to own class+subject (403 handled inline) |
| **Admin** | Dashboard, Timetable, Attendance Summary, Student Attendance History, Monthly Sheet, Manage (Users, Students, Classes, Batches, Subjects, School Periods), Events | Full access to all tenant app routes |
| **Student** | Dashboard, Timetable | Timetable read-only; attendance self-view read-only; no record/manage/events/monthly-sheet actions |
| **SuperAdmin** | *Isolated portal:* Tenants, Feature Flags | No tenant app access whatsoever |

**Role switcher** shown only when `user.roles.length > 1`.

### Success Definition (measurable)

1. Teacher can log in, view own classes, record attendance, see at-risk streak panel, and see Class Rankings card on dashboard.
2. Admin can create a timetable entry, delete a filled slot (recreate to correct), correct an attendance record, view monthly sheet, create/edit/delete a calendar event, create a student, promote/graduate a class, and bulk-delete users.
3. Student can log in with `loginId`, view today's timetable, view own recent attendance history (live from JWT `studentId`), and see degraded state if `studentId` is null.
4. Multi-role user switches roles — sidebar changes immediately, no page reload, query cache cleared.
5. SuperAdmin can create a tenant, reactivate an inactive tenant, and toggle feature flags.
6. All 18 screens pass WCAG 2.1 AA automated checks (axe-core) + Lighthouse mobile ≥85 on dashboard and `/attendance/record`.

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

**v4.5 (2026-03-08)**

### OpenAPI Contract File (REQUIRED)

- **File name:** `openapi.yaml`
- **Version:** 4.5.0
- **Location:** `.docs/openapi.yaml`

### Contract immutability rule

- Frontend **MUST NOT** invent endpoints, fields, status codes, or error shapes not present in OpenAPI 4.5.0.
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
| `/attendance/monthly-sheet` | Monthly Attendance Sheet | Protected | Admin, Teacher |
| `/students/{studentId}/attendance` | Student Attendance History | Protected | Admin only |
| `/manage/users` | User Management | Protected | Admin only |
| `/manage/students` | Student Management | Protected | Admin only |
| `/manage/classes` | Class Management | Protected | Admin only |
| `/manage/batches` | Batch Management | Protected | Admin only |
| `/manage/subjects` | Subject Management | Protected | Admin only |
| `/manage/school-periods` | School Periods | Protected | Admin only |
| `/manage/events` | Academic Calendar | Protected | Admin only |
| `/privacy` | Privacy Policy | Public | — |
| `/terms` | Terms of Service | Public | — |

**Total screens:** 18

### Route Map — SuperAdmin Portal (`admin.yourdomain.com`)

| Route | Screen | Auth | Role |
|-------|--------|------|------|
| `/login` | SuperAdmin Login | Public | — |
| `/tenants` | Tenant Management | Protected | SuperAdmin only |
| `/tenants/{tenantId}/features` | Tenant Feature Flags | Protected | SuperAdmin only |

**Total screens (all apps):** 21

---

## 2.1 SCREEN SPECIFICATIONS

### Screen: Tenant Login

**Goal:** Authenticate tenant user, store JWT, handle all error cases.

**API calls:**
1. `POST /auth/login`
   - `200` → store `token` + `user` (including `studentId`) in `localStorage.auth`, redirect `/` (dashboard)
   - `401` → "Invalid email or password."
   - `403 TENANT_INACTIVE` → "This school account has been deactivated. Contact your platform administrator."
   - `404` → "School not found. Check the school ID and try again."
   - `400` → field-level errors from `error.details`.

**Local state:** form fields, `submitting` boolean, `globalError: string | null`

**Server state:** None (form POST only, no TanStack Query)

**Loading:** Submit button spinner, disabled

**Form validation:**
- `email`: `z.string().min(1)` (NOT `.email()` — student loginIds like `530@school.local` are pseudo-emails)
- `password`: required, minLength 8
- `tenantSlug`: required, minLength 1, maxLength 100

**Field placeholder:** email field → `"Email or Student Login ID"`

**Permissions:** Public. Already authenticated → redirect `/` (dashboard).

**A11y:** `htmlFor` labels, `aria-describedby` on error messages, autofocus on email, submit on Enter.

---

### Screen: Dashboard

**Goal:** Role-specific view of today's schedule with relevant CTAs, upcoming events, and (for Teacher) class rankings.

**API calls:**
1. `GET /timetable?dayOfWeek={todayDayName}` — all roles
   - `200` → render per-role content
   - `403 FEATURE_DISABLED` → full-page "Timetable feature not enabled"
   - `401` → session expiry flow.
2. **Admin — stat bar (CR-FE-016c):** `GET /attendance/daily-summary?classId={classId}&date={today}` — one call per unique classId from timetable slots.
   - `200` → derive Marked/Unmarked counts from `slots[].attendanceMarked`.
   - `403 FEATURE_DISABLED` → stat bar hidden.
3. **Teacher — Class Rankings (CR-FE-016e):** `GET /attendance/toppers?classId={classId}&from={30daysAgo}&to={today}&limit=5` — one call per unique classId in teacher's assigned slots.
   - `200` → render collapsed "Class Rankings" card.
   - `403` → card hidden for that class.
4. **All roles — Upcoming Events (CR-FE-016g):** `GET /events` (default range = current month in tenant timezone — no params sent; backend defaults apply).
   - `200` → render "Upcoming Events" card.
   - Empty → card shows "No events this month."
5. **Student — attendance (CR-FE-016b, resolves CG-01):** `GET /students/{studentId}/attendance?from={30daysAgo}&to={today}&limit=10` — only when `user.studentId !== null`.
   - `200` → render recent attendance list.
   - When `user.studentId === null` → show degraded state card: *"Your student profile is not yet linked — contact your administrator."* No API call made.
6. **Student — own streaks (CR-FE-016d, Story 18):** `GET /attendance/streaks?timeSlotId={timeSlotId}` per assigned slot from timetable. Response always filtered to own studentId by backend.
   - `200` → render streak badge (`consecutiveAbsentCount`) per subject slot if > 0.
   - `404/403` → badge hidden.

**Server state:**
- TQ key: `['timetable', { dayOfWeek: todayDayName }]`. Stale: 5 min. Refetch on focus.
- TQ key: `['attendance-daily-summary', classId, today]`. Stale: 5 min. (Admin, one per classId)
- TQ key: `['attendance-toppers', classId, '30d']`. Stale: 5 min. (Teacher, one per classId)
- TQ key: `['events', 'current-month']`. Stale: 10 min. (all roles)
- TQ key: `['student-attendance', studentId, from, to]`. Stale: 5 min. (Student only)
- TQ key: `['attendance-streaks', timeSlotId]`. Stale: 5 min. (Student only, per slot)

**Loading:** 3 skeleton slot cards. Each additional card section has its own skeleton.

**Role-specific content:**

- **Teacher:**
  - Slot cards filtered client-side: `slot.teacherId === currentUser.id`. "Record Attendance" CTA → `/attendance/record`. Empty: "No classes assigned to you today."
  - **Class Rankings card** (CR-FE-016e): Collapsed `<Accordion>` per unique classId. Header: "Class Rankings — {className}". On expand: top-5 student rows with rank badge + attendance %. If `attendancePercentage === null` → display "—". Link: "View full rankings →" (no route — same screen, no new route for Teacher).
  - **Upcoming Events card** (CR-FE-016g): see below.

- **Admin:**
  - All slots. Stat summary bar (CR-FE-016c): "Total Periods: {N} | Marked: {N} | Unmarked: {N}" — API-driven from daily-summary calls. Skeleton while loading. Error → stat bar hidden with muted "Could not load marking status."
  - **Upcoming Events card** (CR-FE-016g): see below.

- **Student:**
  - All slots (read-only).
  - Recent attendance list (last 10 records). When `studentId === null`: degraded state card (no spinner, immediate render).
  - Streak badges on timetable slot cards: `{N} consecutive absence(s)` badge in `bg-red-100 text-red-800` shown only when `consecutiveAbsentCount > 0`.
  - **Upcoming Events card** (CR-FE-016g): see below.

**Upcoming Events card (all roles — CR-FE-016g):**
- Positioned below slot cards, above attendance section (Student) / below stat bar (Admin).
- Title: "This Month's Events". Event rows: `{title}` + type badge + date range. If `startDate === endDate`: single date format. Multi-day: "{startDate} – {endDate}".
- Empty state: "No events scheduled this month."
- Error: card hidden silently (events are non-critical).

**A11y:** Each slot card is `<article>`. "Record Attendance" button `aria-label="Record attendance for {className} – {subjectName} (Period {n})"`. Class Rankings accordion: `aria-expanded`. Streak badge: `aria-label="{N} consecutive absent day(s) for {subjectName}"`. Upcoming Events list: `role="list"`, each event `role="listitem"`.

---

### Screen: Timetable

**Goal:** Full timetable grid. Admin: inline cell interactions. Teacher/Student: read-only. Today's cells show marking-status color (CR-FE-016c).

**API calls:**
1. `GET /timetable` (no params — all non-deleted slots for tenant)
   - `200` → render grid
   - `403 FEATURE_DISABLED` → full-page gate.
2. `GET /school-periods`
   - `200` → column headers
   - `403` → inline "School periods not configured."
3. **Today marking-status (CR-FE-016c — Admin only):** `GET /attendance/daily-summary?classId={classId}&date={today}` — one call per unique classId visible in grid.
   - `200` → map `timeSlotId → attendanceMarked` for today's column coloring.
   - `403 FEATURE_DISABLED` → marking-status color suppressed.
4. **Admin — create:** `POST /timetable`
   - Body: `{ classId, subjectId, teacherId, dayOfWeek, periodNumber }`
   - `201` → invalidate `['timetable', filters]`, close drawer, toast "Slot created."
   - `400 PERIOD_NOT_CONFIGURED` → inline "Period {n} not configured."
   - `409` → "Slot already occupied."
   - `403` → toast.
5. **Admin — delete slot:** `DELETE /timetable/{id}`
   - `204` → invalidate `['timetable', filters]`, close popover, toast "Slot deleted."
   - `403/404` → toast.

**Local state:** `selectedFilters`, `activeCell: { dayOfWeek: string, periodNumber: number } | null`, `activeSlotId: string | null`, `deleteConfirmSlotId: string | null`

**Server state:** TQ keys: `['timetable', filters]`, `['school-periods']`. Stale: 5 min. TQ key: `['attendance-daily-summary', classId, today]` (Admin, per classId). Stale: 5 min.

**Loading:** Full grid skeleton. Empty: "No timetable entries found." Admin hint: "Click an empty cell to add a slot."

**Cell color logic (today's column, CR-FE-016c):**
- `attendanceMarked: true` → `bg-green-100`
- `attendanceMarked: false` → `bg-yellow-50`
- Daily summary not yet loaded / feature disabled → default cell color (no indicator)
- Non-today columns → no color indicator (structural weekly schedule, not date-specific)

**Cell interactions:** (unchanged from v1.8)
- **Empty cell (Admin):** hover `bg-muted/30 border-dashed` + icon → click → create drawer.
- **Filled cell (Admin):** click → Popover with "Delete Slot" button + muted helper: *"To change teacher or subject, delete this slot and create it again."*
- **Teacher/Student:** cells non-interactive, plain read-only display.

**Form validation (create):**
- `classId`: required
- `subjectId`: required
- `teacherId`: required
- `dayOfWeek`: pre-filled (read-only)
- `periodNumber`: pre-filled (read-only), integer ≥1

**A11y:** `role="grid"`, `role="row"`, `role="gridcell"`. Empty clickable cells: `aria-label="Add slot for {dayOfWeek} Period {n}"`. Delete confirm dialog: focus trap, Escape cancels, confirm button `aria-describedby` warning text. Marking-status color: supplemented by `aria-label="Attendance marked"` / `aria-label="Attendance not marked"` on cell.

**Performance:** `overflow-x-auto` on mobile. No virtualization needed (7 days × ≤15 periods).

---

### Screen: Record Attendance

**Goal:** Record attendance for all students in a selected class period. Show "At-Risk Students" streak panel (CR-FE-016d).

**API calls:**
1. **Teacher:** `GET /timetable?teacherId={currentUser.id}&dayOfWeek={todayDayName}`
   **Admin:** `GET /timetable?dayOfWeek={todayDayName}`
2. `GET /students?classId={selectedClassId}&limit=200`
3. Per-student pre-fetch: `GET /students/{studentId}/attendance?from={date}&to={date}&limit=10` — auto-detect `alreadyRecorded`.
4. **At-Risk streaks (CR-FE-016d):** `GET /attendance/streaks?timeSlotId={selectedTimeSlotId}` — fires when `selectedTimeSlotId` is set.
   - `200` → populate "At-Risk Students" panel. Filter client-side: `consecutiveAbsentCount >= AT_RISK_THRESHOLD` (constant: 3).
   - `403 FORBIDDEN` (Teacher not assigned) → panel hidden silently.
   - `403 FEATURE_DISABLED` → panel hidden silently.
5. **Create mode:** `POST /attendance/record-class`
   - `201` → toast "{recorded} records saved. ({present} present, {absent} absent, {late} late)."
   - `400 FUTURE_DATE` → inline error
   - `409 CONFLICT` / `ATTENDANCE_ALREADY_RECORDED` → set `alreadyRecorded = true`
   - `403 FEATURE_DISABLED` → full-page gate
   - `403` (not-assigned) → toast.
6. **Update mode:** Parallel `PUT /attendance/{recordId}` for each changed student.
   - `200` → invalidate `['student-attendance']`, toast "Attendance updated for {N} student(s)."
   - `400 SAME_STATUS` → inline per-student
   - `400 FUTURE_DATE` → inline

**Local state:** `selectedTimeSlotId`, `selectedDate` (default: today), `defaultStatus`, `exceptions: Map<studentId, AttendanceStatus>`, `submitError`, `successMsg`, `alreadyRecorded: boolean`

**Server state:**
- TQ key: `['timetable', { teacherId, dayOfWeek }]` (Teacher) / `['timetable', { dayOfWeek }]` (Admin). Stale: 5 min.
- TQ key: `['students', classId, id]`. Stale: 2 min.
- TQ key: `['student-attendance', studentId, date, 'correction']` (per-student). Stale: 2 min.
- TQ key: `['attendance-streaks', selectedTimeSlotId]`. Stale: 5 min. Enabled only when `selectedTimeSlotId !== null`.

**At-Risk Students panel (CR-FE-016d):**
- Collapsible `<Accordion>` below the slot/class selector, above the student list.
- Header: "⚠ At-Risk Students ({N})". Collapsed by default.
- Visible only when `selectedTimeSlotId` is set AND at least 1 student has `consecutiveAbsentCount >= 3`.
- Rows: `{studentName}` + badge `{N} consecutive absent(s)` in `bg-red-100 text-red-800`.
- `AT_RISK_THRESHOLD = 3` — defined as a named constant in `src/utils/attendance.ts`, not hardcoded in component.
- Student role: panel not rendered (Teacher/Admin only — Student calls same endpoint but has different UI context per Story 18 / Dashboard).
- Loading: 3 skeleton rows while streaks query is loading.
- Error (403, 404, network): panel hidden silently — non-critical UI.

**Single action button:** (unchanged from v1.8)
```tsx
{alreadyRecorded ? "Update Attendance for N Student(s)" : "Save Attendance for N Student(s)"}
```

**Form validation:** (unchanged from v1.8)

**Permissions:** Teacher: own slots only. Admin: all slots. Student (direct URL): inline "Not authorized for current role."

**A11y:** Each student row: `role="radiogroup"` with `aria-label="{studentName} attendance status"`. At-Risk accordion: `aria-expanded`. Streak badge: `aria-label="{N} consecutive absent day(s)"`. Panel: `role="region"` with `aria-label="At-risk students"`.

**Performance:** `exceptions` as `Map` for O(1) lookup. `limit=200` is OpenAPI max.

---

### Screen: Attendance Summary

**Goal:** Monthly summary for a student (existing) + ranked toppers leaderboard for a class (CR-FE-016e, Admin only). Two tabs: "Summary" and "Rankings".

**Tab: Summary (unchanged from v1.8)**

**API calls (Summary tab):**
- `GET /students/{studentId}/attendance/summary?year={YYYY}&month={1-12}`
  - `200` → render summary card
  - `403` → "Not authorized."
  - `404` → "Student not found."

**Tab: Rankings (CR-FE-016e — NEW)**

**API calls (Rankings tab):**
- `GET /attendance/toppers?classId={selectedClassId}&from={from}&to={to}&limit=10&offset={offset}`
  - `200` → render ranked table
  - `400` → inline "Invalid parameters."
  - `403 FEATURE_DISABLED` → tab disabled with tooltip "Attendance feature not enabled."
  - `404` → "Class not found."

**Local state:** `activeTab: 'summary' | 'rankings'`, `selectedStudentId`, `selectedYear: number`, `selectedMonth: number` (Summary), `rankingsClassId`, `rankingsFrom`, `rankingsTo`, `rankingsOffset: number` (Rankings)

**Rankings tab defaults:**
- `rankingsFrom`: first day of current month (YYYY-MM-01)
- `rankingsTo`: today's date
- `limit`: 10 (fixed)
- `offset`: 0 (pagination controlled by prev/next buttons)

**Server state:**
- TQ key: `['student-attendance-summary', studentId, year, month]`. Stale: 5 min. (Summary tab)
- TQ key: `['attendance-toppers', classId, from, to, offset]`. Stale: 5 min. (Rankings tab)

**Rankings table columns:** Rank | Student Name | Total Periods | Present Count | Attendance %

- `attendancePercentage === null` → display "—" (student has no records in range)
- `rank` is global (pre-pagination) — always shown as-received from API
- Pagination: "Previous" / "Next" buttons. Previous disabled when `offset === 0`. Next disabled when `offset + limit >= total`.

**Loading (Rankings):** Table skeleton (10 rows). Empty (`toppers.length === 0`): "No students found for this class."

**Form validation (Rankings):**
- `classId`: required
- `from`: required, valid date
- `to`: required, valid date, must be ≥ `from`
- Date range: no future `to` restriction (backend allows it, returns empty counts for future dates)

**Permissions:** Admin only. Both tabs admin-gated.

**A11y:** Tab list: `role="tablist"`, each tab: `role="tab"`, `aria-selected`. Rankings table: `<caption>` with class name and date range. `attendancePercentage` null cells: `aria-label="No data"`.

---

### Screen: Monthly Attendance Sheet (NEW — CR-FE-016f)

**Route:** `/attendance/monthly-sheet`
**Accessible to:** Admin, Teacher
**Sidebar item:** Added for both Admin and Teacher

**Goal:** View a full student × day × period attendance grid for a selected class, subject, month, and year. Admin: any class/subject. Teacher: restricted to own class+subject intersections (backend enforces 403).

**API calls:**
1. `GET /classes` — populate class selector.
2. `GET /subjects` — populate subject selector.
3. `GET /attendance/monthly-sheet?classId={}&subjectId={}&year={}&month={}` — fires when all 4 params are selected.
   - `200` → render grid
   - `403 FORBIDDEN` (Teacher wrong subject) → inline: "You are not assigned to this subject in the selected class."
   - `403 FEATURE_DISABLED` → full-page gate
   - `404` → "Class or subject not found."
   - `400` → inline parameter error

**Local state:** `selectedClassId: string | null`, `selectedSubjectId: string | null`, `selectedYear: number` (default: current year), `selectedMonth: number` (default: current month, 1–12)

**Server state:**
- TQ key: `['classes']`. Stale: 5 min.
- TQ key: `['subjects']`. Stale: 5 min.
- TQ key: `['attendance-monthly-sheet', classId, subjectId, year, month]`. Stale: 2 min. Enabled only when all 4 params selected.

**Loading:** Full grid skeleton (placeholder rows × day columns). Empty (`students.length === 0`): "No students enrolled in this class."

**Grid layout:**
- Fixed left column: student name + admission number.
- Day columns: `"1"` through `"<daysInMonth>"` (always all keys — no sparse columns).
- Cell content: For each day, render attendance entries ordered by `periodNumber ASC`.
  - `effectiveStatus = 'Present'` → green dot / "P"
  - `effectiveStatus = 'Absent'` → red dot / "A"
  - `effectiveStatus = 'Late'` → yellow dot / "L"
  - `isCorrected: true` → append asterisk (*) with tooltip "Corrected record"
  - Empty array → blank cell
- Future days: blank cells (no records exist)
- `overflow-x-auto` on all viewports — grid can be very wide (31 columns).

**Form validation:**
- `classId`: required
- `subjectId`: required
- `year`: required, integer 2000–2099
- `month`: required, integer 1–12

**Permissions:**
- Admin: any class + subject in tenant.
- Teacher: access allowed; 403 from backend shown inline (not full-page) — allows teacher to change selection.
- Other roles: inline "Not authorized for current role."

**A11y:** `role="grid"`, `role="row"`, `role="gridcell"`. Table caption with class name, subject, month/year. Corrected record asterisk: `aria-label="Corrected record"`. Status dots: `aria-label="{status}"` (not color-only).

**Performance:** `overflow-x-auto`. Virtualize rows if `students.length > 100`. No column virtualization (31 columns is manageable).

---

### Screen: Academic Calendar (`/manage/events`) (NEW — CR-FE-016g)

**Route:** `/manage/events`
**Accessible to:** Admin only
**Sidebar item:** Added under Admin "Manage" group

**Goal:** Create, update, soft-delete academic calendar events (holidays, exams, functions).

**API calls:**
1. `GET /events?from={monthStart}&to={monthEnd}` — filtered to current viewed month.
   - `200` → render event list
   - `403` → inline "Not authorized."
2. `POST /events`
   - Body: `{ title, type, startDate, endDate, description? }`
   - `201` → invalidate `['events']`, close drawer, toast "Event created."
   - `400 VALIDATION_ERROR` (endDate < startDate) → inline "End date must be on or after start date."
   - `400` (other) → field-level errors from `error.details`.
   - `403` → toast.
3. `PUT /events/{eventId}`
   - Body: partial — any of `{ title?, type?, startDate?, endDate?, description? }`. `description: null` clears the field.
   - `200` → invalidate `['events']`, close drawer, toast "Event updated."
   - `400 VALIDATION_ERROR` → inline (merged date check)
   - `403/404` → toast.
4. `DELETE /events/{eventId}`
   - `204` → invalidate `['events']`, close dialog, toast "Event deleted."
   - `403/404` → toast.

**Local state:** `createDrawerOpen: boolean`, `editEventId: string | null`, `deleteConfirmEventId: string | null`, `viewMonth: Date` (default: current month, controls `from`/`to` filter params)

**Server state:** TQ key: `['events', viewMonthStart, viewMonthEnd]`. Stale: 2 min.

**Loading:** List skeleton (5 rows). Empty: "No events for {monthName} {year}. Click 'Add Event' to create one."

**Event list columns:** Title | Type (badge) | Date Range | Description (truncated) | Actions (Edit, Delete)

**Type badges:**
- `Holiday` → `bg-red-100 text-red-800`
- `Exam` → `bg-purple-100 text-purple-800`
- `Event` → `bg-blue-100 text-blue-800`
- `Other` → `bg-gray-100 text-gray-800`

**Month navigation:** "← Previous" / "Next →" buttons update `viewMonth`. Updates TQ key, triggers new `GET /events` with new month range.

**Create/Edit drawer (shared, `<Sheet>`):**
- `title`: required, max 255
- `type`: required, select (`Holiday | Exam | Event | Other`)
- `startDate`: required, date picker
- `endDate`: required, date picker, must be ≥ `startDate` (client guard: zod `refine`)
- `description`: optional, textarea, max 1000 chars

**Delete confirmation (`<Dialog>`):**
- *"Delete '{title}'? This cannot be undone. The event will be permanently removed from the calendar."*
- Confirm → `DELETE /events/{eventId}` → 204.
- Note: soft-delete on backend, but no restore via API — treat as permanent from UI perspective.

**Form validation:**
- `title`: required, min 1, max 255
- `type`: required, enum `Holiday | Exam | Event | Other`
- `startDate`: required, valid date
- `endDate`: required, valid date, `endDate >= startDate` (zod `refine`)
- `description`: optional, max 1000 chars

**Permissions:** Admin only. Teacher/Student (direct URL) → inline "Not authorized for current role."

**A11y:** Delete confirm dialog: focus trap, Escape cancels, confirm button `aria-describedby` pointing to warning text. Type badges: `aria-label="{type}"`. Date range: `aria-label="From {startDate} to {endDate}"`.

---

### Screen: Student Attendance History — Unchanged from v1.8

### Screen: User Management — Unchanged from v1.8

### Screen: Student Management — Unchanged from v1.8

### Screen: Class Management — Unchanged from v1.8

### Screens: Batch & Subject Management — Unchanged from v1.8

### Screen: School Periods — Unchanged from v1.8

### Screen: SuperAdmin Login — Unchanged from v1.8

### Screen: Tenant Management — Unchanged from v1.8

### Screen: Tenant Feature Flags — Unchanged from v1.8

### Static Screens: Privacy / Terms — Unchanged from v1.8

---

## 3. API ASSUMPTIONS (Frontend contract expectations)

### 3.0 Backend Contract Link (LOCKED)

**Backend Freeze version:** v4.5 (2026-03-08)
**OpenAPI file:** `openapi.yaml`
**OpenAPI version:** 4.5.0
**File path:** `.docs/openapi.yaml`

**Base URL:** `VITE_API_BASE_URL` from env (never hardcoded).

**Auth:** Bearer JWT. Header: `Authorization: Bearer {token}`.
**Storage:** `localStorage.auth` (tenant), `localStorage.sa-auth` (SuperAdmin).

**Global error shape MUST match OpenAPI 4.5.0:**

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

All error codes are **SNAKE_CASE**.

---

### 3.1 Mock Server (REQUIRED)

**Tool:** Prism (`@stoplight/prism-cli`)

```bash
npm install -g @stoplight/prism-cli
prism mock .docs/openapi.yaml --port 4010

# Set in .env:
VITE_API_BASE_URL=http://localhost:4010/api
```

**Failure simulation plan (v1.9 additions appended):**

| Scenario | Header | Endpoint |
|----------|--------|----------|
| Missing/invalid token | `Prefer: code=401` | Any protected endpoint |
| Inactive tenant login | `Prefer: code=403` | `POST /auth/login` |
| Period not configured | `Prefer: code=400` | `POST /timetable` |
| Slot already occupied | `Prefer: code=409` | `POST /timetable` |
| Duplicate email | `Prefer: code=409` | `POST /users` |
| Student role in `POST /users` | `Prefer: code=400` | `POST /users` |
| Duplicate admission number | `Prefer: code=409` | `POST /students` |
| Batch mismatch | `Prefer: code=400` | `POST /students` |
| Resource not found | `Prefer: code=404` | Any `/{id}` endpoint |
| Last admin guard | `Prefer: code=403` | `PUT /users/{id}/roles` |
| Same status correction | `Prefer: code=400` | `PUT /attendance/{recordId}` |
| Same class promotion | `Prefer: code=400` | `PUT /classes/{sourceClassId}/promote` |
| Student access denied | `Prefer: code=403` | `GET /students/{studentId}/attendance` |
| Slot not found (delete) | `Prefer: code=404` | `DELETE /timetable/{id}` |
| Teacher not assigned | `Prefer: code=403` | `POST /attendance/record-class` |
| Teacher not assigned to timeslot → 403 | `Prefer: code=403` | `GET /attendance/streaks` |
| Attendance feature disabled → 403 | `Prefer: code=403` | `GET /attendance/toppers` |
| Teacher not assigned to class → 403 | `Prefer: code=403` | `GET /attendance/daily-summary` |
| Teacher wrong subject → 403 | `Prefer: code=403` | `GET /attendance/monthly-sheet` |
| endDate before startDate → 400 | `Prefer: code=400` | `POST /events`, `PUT /events/{id}` |
| Event not found → 404 | `Prefer: code=404` | `PUT /events/{id}`, `DELETE /events/{id}` |
| Student `studentId` null (no linked record) | Response `studentId: null` | `POST /auth/login` (Student role) |

---

### 3.2 Typed API Surface (MVP only — MUST match OpenAPI 4.5.0 exactly)

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

// AUTH — CR-38: TenantUser gains studentId
type TenantRole = 'Teacher' | 'Admin' | 'Student'
type UserRole = 'Teacher' | 'Admin'

interface TenantUser {
  id: string
  tenantId: string
  name: string
  email: string
  roles: TenantRole[]
  activeRole: TenantRole
  studentId: string | null  // CR-38: populated when activeRole = Student and linked record exists; null otherwise
}

interface LoginResponse {
  token: string
  user: TenantUser
}

// USERS
interface CreateUserRequest {
  name: string
  email: string
  password?: string
  roles: UserRole[]
}

interface CreateUserResponse {
  user: User
  temporaryPassword: string | null
}

// STUDENTS
type StudentStatus = 'Active' | 'DroppedOff' | 'Graduated'

interface Student {
  id: string
  name: string
  classId: string | null
  className: string | null
  batchId: string
  batchName: string
  admissionNumber: string
  dob: string
  status: StudentStatus
  loginId: string
  userId: string | null
}

interface UpdateStudentRequest {
  name?: string
  classId?: string
  batchId?: string
  admissionNumber?: string
  dob?: string
  status?: 'Active' | 'DroppedOff'
}

// BATCHES
type BatchStatus = 'Active' | 'Graduated'

interface Batch {
  id: string
  name: string
  startYear: number
  endYear: number
  status: BatchStatus
  createdAt: string
  updatedAt: string
}

// CLASSES
type PromoteRequest =
  | { targetClassId: string }
  | { action: 'graduate' }

type PromoteResponse =
  | { updated: number; failed: Array<{id: string; reason: string}> }
  | { graduated: number; failed: Array<{id: string; reason: string}> }

// TIMETABLE
interface TimeSlot {
  id: string
  tenantId: string
  classId: string
  className: string
  subjectId: string
  subjectName: string
  teacherId: string
  teacherName: string
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
  periodNumber: number
  periodLabel: string
  startTime: string
  endTime: string | null
  createdAt: string
  updatedAt: string
}

interface CreateTimeslotRequest {
  classId: string
  subjectId: string
  teacherId: string
  dayOfWeek: string
  periodNumber: number
}
// UpdateTimeslotRequest REMOVED — PUT /timetable/{id} does not exist (CR-32)

// ATTENDANCE
type AttendanceStatus = 'Present' | 'Absent' | 'Late'

interface AttendanceRecord {
  id: string
  date: string
  originalStatus: AttendanceStatus
  status: AttendanceStatus
  correctedBy: string | null
  correctedAt: string | null
  timeSlot: TimeSlot
  recordedBy: string
  recordedAt: string
}

interface CorrectAttendanceRequest {
  correctedStatus: AttendanceStatus
}

// ATTENDANCE SUMMARY
interface AttendanceSummary {
  studentId: string
  year: number
  month: number
  totalClasses: number
  present: number
  absent: number
  late: number
  attendancePercentage: number
}

// ATTENDANCE STREAKS — CR-33
interface StudentStreak {
  studentId: string
  consecutiveAbsentCount: number
}

interface AttendanceStreaksResponse {
  classId: string
  subjectId: string
  streaks: StudentStreak[]
}

// ATTENDANCE TOPPERS — CR-34
interface AttendanceTopper {
  rank: number
  studentId: string
  studentName: string
  totalPeriods: number
  presentCount: number
  attendancePercentage: number | null  // null when totalPeriods = 0
}

interface AttendanceToppersResponse {
  classId: string
  from: string
  to: string
  total: number
  limit: number
  offset: number
  toppers: AttendanceTopper[]
}

// DAILY SLOT SUMMARY — CR-35
interface DailySlotSummary {
  timeSlotId: string
  periodNumber: number
  subjectId: string
  subjectName: string
  teacherId: string
  teacherName: string
  attendanceMarked: boolean
  totalStudents: number
  absentCount: number
}

interface AttendanceDailySummaryResponse {
  classId: string
  date: string
  dayOfWeek: string
  slots: DailySlotSummary[]
}

// MONTHLY SHEET — CR-36
interface MonthlySheetEntry {
  recordId: string
  periodNumber: number
  effectiveStatus: AttendanceStatus
  isCorrected: boolean
}

interface MonthlySheetStudent {
  studentId: string
  studentName: string
  admissionNumber: string
  days: Record<string, MonthlySheetEntry[]>  // keys: "1".."<daysInMonth>", always fully populated
}

interface AttendanceMonthlySheetResponse {
  classId: string
  subjectId: string
  subjectName: string
  year: number
  month: number
  daysInMonth: number
  students: MonthlySheetStudent[]
}

// CALENDAR EVENTS — CR-37
type EventType = 'Holiday' | 'Exam' | 'Event' | 'Other'

interface CalendarEvent {
  id: string
  title: string
  type: EventType
  startDate: string   // YYYY-MM-DD
  endDate: string     // YYYY-MM-DD
  description: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface CreateEventRequest {
  title: string
  type: EventType
  startDate: string
  endDate: string
  description?: string
}

interface UpdateEventRequest {
  title?: string
  type?: EventType
  startDate?: string
  endDate?: string
  description?: string | null  // null explicitly clears the field
}

interface EventsListResponse {
  events: CalendarEvent[]
  total: number
}

// TENANT FEATURES
interface TenantFeature {
  id: string
  tenantId: string
  featureKey: string
  featureName: string
  featureDescription: string
  enabled: boolean
  enabledAt: string | null
}

// BULK OPERATIONS
interface BulkDeleteRequest {
  userIds?: string[]
  studentIds?: string[]
  classIds?: string[]
  batchIds?: string[]
  subjectIds?: string[]
}

interface BulkDeleteResponse {
  deletedCount: number
}
```

---

### 3.3 Caching / Invalidation Rules (LOCKED — complete)

| TQ Key | Stale Time | Invalidated By |
|--------|------------|----------------|
| `['timetable', filters]` | 5 min | `POST /timetable`, `DELETE /timetable/{id}`, `DELETE /school-periods/{id}` |
| `['timetable', { dayOfWeek: string }]` | 5 min | Refetch on window focus |
| `['students']` | 2 min | `POST /students`, `PUT /students/{id}`, `DELETE /students/{id}`, `POST /students/bulk`, `PUT /classes/{id}/promote` |
| `['students', classId, classId]` | 2 min | `POST /students`, `PUT /students/{id}`, `DELETE /students/{id}`, `POST /students/bulk` |
| `['users', roleFilter, searchQuery]` | 2 min | `POST /users`, `PUT /users/{id}/roles`, `DELETE /users/{id}`, `POST /users/bulk` |
| `['student-attendance', studentId, from, to, page]` | 2 min | `PUT /attendance/{recordId}` |
| `['student-attendance', studentId, from, to]` | 5 min | `PUT /attendance/{recordId}` |
| `['student-attendance-summary', studentId, year, month]` | 5 min | Not invalidated by corrections |
| `['attendance-streaks', timeSlotId]` | 5 min | `POST /attendance/record-class`, `PUT /attendance/{recordId}` |
| `['attendance-toppers', classId, from, to, offset]` | 5 min | `PUT /attendance/{recordId}` |
| `['attendance-daily-summary', classId, date]` | 5 min | `POST /attendance/record-class`, `PUT /attendance/{recordId}` |
| `['attendance-monthly-sheet', classId, subjectId, year, month]` | 2 min | `PUT /attendance/{recordId}` |
| `['batches']` | 5 min | `POST /batches`, `PUT /batches/{id}`, `DELETE /batches/{id}`, `POST /batches/bulk` |
| `['classes']` | 5 min | `POST /classes`, `PUT /classes/{id}`, `DELETE /classes/{id}`, `POST /classes/bulk`, `PUT /classes/{sourceClassId}/promote` |
| `['subjects']` | 5 min | `POST /subjects`, `PUT /subjects/{id}`, `DELETE /subjects/{id}`, `POST /subjects/bulk` |
| `['school-periods']` | 5 min | `POST /school-periods`, `PUT /school-periods/{id}`, `DELETE /school-periods/{id}` |
| `['events', fromDate, toDate]` | 2 min | `POST /events`, `PUT /events/{id}`, `DELETE /events/{id}` |
| `['events', 'current-month']` | 10 min | `POST /events`, `PUT /events/{id}`, `DELETE /events/{id}` |
| `['sa-tenants', statusFilter, searchQuery]` | 1 min | `POST /super-admin/tenants`, `PUT /super-admin/tenants/{id}`, deactivate, reactivate |
| `['sa-features', tenantId]` | 30 sec | `PUT /super-admin/tenants/{tenantId}/features/{featureKey}` |

---

### 3.4 Retry Rules (LOCKED) — Unchanged from v1.8

- **GET requests:** Retry up to 3 times, exponential backoff (1s, 2s, 4s).
- **Mutations (POST/PUT/DELETE):** Never retry automatically.
- **401:** Axios interceptor fires `window.CustomEvent('AUTH_EXPIRED')`, clears `localStorage.auth`, sets `isExpired = true` → `<SessionExpiredModal>`.
- **403:** Surface `error.code` + `error.message` inline or toast. `LAST_ADMIN` shown inline in drawer. `STUDENT_ACCESS_DENIED` shown inline on attendance screen. `FORBIDDEN` (streaks/toppers/monthly-sheet) shown inline within the relevant panel — non-critical, does not block screen.
- **429:** Toast "Too many requests. Please wait a moment." No auto-retry.
- **500:** Toast + retry button for GET; toast error for mutations.

---

## 4. STATE MANAGEMENT (Data Flow LOCKED)

### State boundaries

- **Server state:** TanStack Query (all API data)
- **Auth/session:** React Context (`AuthContext`: `user`, `token`, `isAuthenticated`, `isExpired`)
- **UI state:** Local `useState` (drawer open/close, selected IDs, active cell, delete confirm IDs, form state, active tab)
- **Persistent:** `localStorage.auth` (tenant JWT+user including `studentId`), `localStorage.sa-auth` (SuperAdmin JWT)

### AuthContext responsibilities

- `login(token, user)` → writes `localStorage.auth` + React state atomically. `user` shape now includes `studentId: string | null`.
- `logout()` → fire-and-forget `POST /auth/logout`, clear storage, reset state
- `switchRole(req)` → calls `POST /auth/switch-role` → on 200: `login(newToken, newUser)` (new `user` includes updated `studentId`), dispatch `window.CustomEvent('ROLE_SWITCHED')`
- `dismissExpired()` → clears `isExpired` flag

### `studentId` access rules (CR-FE-016b)

- `user.studentId` is the **single source of truth** — extracted from JWT at login/switch-role, stored in `AuthContext`.
- Student dashboard calls `GET /students/{user.studentId}/attendance` directly — no extra API round-trip.
- When `user.studentId === null` and `activeRole === 'Student'` → render degraded state card: *"Your student profile is not yet linked — contact your administrator."* Do NOT attempt the attendance API call.
- `user.studentId` is always `null` for `activeRole ∈ {Admin, Teacher}` — no Student data shown.

### ROLE_SWITCHED handler (`App.tsx`) — Unchanged from v1.8

```ts
window.addEventListener('ROLE_SWITCHED', () => {
  queryClient.clear()
})
```

**Cross-tab:** No multi-tab sync. Each tab independently handles 401.

---

## 4.1 ERROR BOUNDARY STRATEGY (LOCKED) — Unchanged from v1.8

- **Per-route boundary:** Every route wrapped in its own `<ErrorBoundary>`. Inline error card + Retry button.
- **Root boundary:** Single boundary at `App.tsx`.
- **Observability:** Console logs only in dev. Stripped in production.

---

## 5. DESIGN SYSTEM (UI Constraints)

### Color system

- **Background:** `bg-background`, Surface: `bg-card border border-border shadow-sm`, Primary: shadcn/ui default
- **Status badges:** Present: `bg-green-100 text-green-800`, Absent: `bg-red-100 text-red-800`, Late: `bg-yellow-100 text-yellow-800`
- **Streak / At-Risk badge:** `bg-red-100 text-red-800` (same as Absent)
- **Event type badges:** Holiday: `bg-red-100 text-red-800`, Exam: `bg-purple-100 text-purple-800`, Event: `bg-blue-100 text-blue-800`, Other: `bg-gray-100 text-gray-800`
- **Timetable marking-status:** Marked today: `bg-green-100`, Unmarked today: `bg-yellow-50`, default (non-today / feature disabled): no override
- **Attendance % null:** Display "—" (em dash), `text-muted-foreground`
- **Contrast minimum:** 4.5:1 (WCAG 2.1 AA)

### Typography (LOCKED) — Unchanged from v1.8

### Spacing scale — Unchanged from v1.8

### Sidebar

- Fixed left, `w-56` desktop, collapses on mobile
- Top: app name, RoleSwitcher dropdown (if `roles.length > 1`) + role badge
- Active nav: `bg-primary/10 text-primary font-medium rounded-lg`; Inactive: `text-muted-foreground hover:bg-muted`
- **v1.9 additions:**
  - Teacher sidebar: + "Monthly Sheet" (`/attendance/monthly-sheet`)
  - Admin sidebar: + "Monthly Sheet" (`/attendance/monthly-sheet`), + "Events" (`/manage/events`)

### Component standards — Unchanged from v1.8

### Component inventory (MVP)

Button, Input, Select, Checkbox, RadioGroup, Switch, Badge, Card, Table, Sheet, Dialog, Popover, DropdownMenu, Toast (Sonner), Skeleton, Avatar, Tooltip, Copy button, **Accordion**, **Tabs**.

### Responsiveness — Unchanged from v1.8

---

## 6. ACCESSIBILITY (A11y Baseline — LOCKED)

**Target:** WCAG 2.1 AA

### Mandatory behaviors (v1.9 additions appended)

All v1.8 behaviors unchanged. Append:

- At-Risk Students accordion: `aria-expanded`, `aria-controls`
- Streak badge: `aria-label="{N} consecutive absent day(s) for {subjectName}"`
- At-Risk panel region: `role="region"` with `aria-label="At-risk students"`
- Class Rankings accordion (Teacher dashboard): `aria-expanded`
- Upcoming Events list: `role="list"`, each event `role="listitem"`
- Attendance Summary tabs: `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"`
- Monthly sheet grid: `role="grid"`, `role="row"`, `role="gridcell"`, corrected-record asterisk: `aria-label="Corrected record"`, status indicators: `aria-label="{status}"` (not color-only)
- Event type badges: `aria-label="{type}"`
- Events delete confirm: focus trap, Escape cancels, confirm button `aria-describedby` warning text

### Testing

axe-core in CI on all 18 screens (was 16).

---

## 7. PERFORMANCE BUDGETS (LOCKED)

### Targets — Unchanged from v1.8

- **LCP:** ≤2,500ms (mobile 4G)
- **INP:** ≤200ms
- **CLS:** ≤0.1
- **Initial JS bundle:** tenant app ≤250KB gzipped; SA portal ≤150KB gzipped
- **Lighthouse mobile:** ≥85 on dashboard and `/attendance/record`

### Techniques

- Code splitting: `React.lazy` + `<Suspense>` per route — **Monthly Sheet** and **Events** are new lazy chunks
- Icons: SVG only (lucide-react, tree-shaken)
- Virtualized lists: Student list if >200 rows; Monthly Sheet student rows if >100
- No image assets in MVP

### CI enforcement

Bundle size check on every PR — fail if limits exceeded.

---

## 8. SECURITY / PRIVACY (Frontend) — Unchanged from v1.8

| Vector | Mitigation |
|--------|------------|
| **XSS (script injection)** | `script-src 'self'` CSP. No `dangerouslySetInnerHTML` anywhere. |
| **XSS (user input)** | react-hook-form + zod validation. No `.innerHTML` usage. |
| **CSRF** | Backend handles (SameSite cookies + token verification). Frontend: no state-changing GET. |
| **Token exposure** | JWT in `localStorage` (XSS risk accepted — no httpOnly cookies in SPA). Never log tokens. |
| **Clickjacking** | `X-Frame-Options: DENY` via Cloudflare Pages headers. |
| **Sensitive data** | Mask admission numbers in logs. Never store PII in browser beyond login session. |
| **Dependency vulnerabilities** | `npm audit` in CI. Block deploy if critical vulnerabilities. |

### CSP (via Cloudflare Pages `_headers` file) — Unchanged from v1.8

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' VITE_API_BASE_URL; frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

---

## 9. OBSERVABILITY (Frontend) — Unchanged from v1.8

**Logging/telemetry:** None in MVP.
**Error reporting:** Console logs only (dev mode). No Sentry/DataDog.

---

## 10. TESTING STRATEGY (Frontend)

### Test layers (LOCKED) — Unchanged from v1.8

- **Unit:** Utility functions, form validation schemas (zod), `AT_RISK_THRESHOLD` constant
- **Component:** Critical UI components — Vitest + Testing Library
- **E2E:** Auth flows, critical workflows per user story — Playwright
- **Visual regression:** No

### Contract alignment checks (REQUIRED) — Unchanged from v1.8

### MVP test checklist (v1.9 additions appended)

All v1.8 checklist items unchanged. Append:

- **CR-FE-016b:** Student login with `studentId` populated → attendance list renders. Student login with `studentId: null` → degraded state card renders, no API call made.
- **CR-FE-016c:** Admin dashboard stat bar shows Marked/Unmarked counts from daily-summary API. Timetable today-column cells show correct color indicator.
- **CR-FE-016d:** At-Risk panel visible in Record Attendance when slot selected and streaks ≥ 3 exist. Panel hidden on 403.
- **CR-FE-016e:** Teacher dashboard Class Rankings card renders top-5. Admin Attendance Summary Rankings tab renders paginated toppers. `attendancePercentage: null` displays "—".
- **CR-FE-016f:** Monthly Sheet loads grid with all day columns (1–31). Teacher 403 on wrong subject → inline error (not full-page). `isCorrected: true` shows asterisk. Empty day cells render blank.
- **CR-FE-016g:** Events CRUD — create with `endDate < startDate` → inline error. Delete → event removed from list. Teacher/Student sees Upcoming Events card on dashboard, cannot access `/manage/events`. Month navigation updates event list.

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
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── timetable/
│   │   ├── attendance/
│   │   │   ├── record/
│   │   │   ├── summary/
│   │   │   ├── history/
│   │   │   └── monthly-sheet/    # NEW CR-FE-016f
│   │   ├── events/               # NEW CR-FE-016g
│   │   └── manage/
│   ├── hooks/
│   ├── styles/
│   ├── utils/
│   │   └── attendance.ts         # AT_RISK_THRESHOLD constant + helpers
│   └── types/
├── tests/
│   ├── unit/
│   └── e2e/
```

**Naming convention:** camelCase
**Import alias:** `@/` → `src/`

---

## 12. DEPLOYMENT, ROLLBACK, ENVIRONMENTS — Unchanged from v1.8

**Hosting:** Cloudflare Pages
**Build command:** `npm run build`
**Env mapping:** `.env.development` / `.env.staging` / `.env.production`
**Rollback:** Previous build redeploy + Cloudflare automatic CDN invalidation.

---

## 13. FORBIDDEN CHANGES (Scope Lock)

### BANNED without a new Freeze version + price/time update

- Add routes/screens
- Change routing mode (SPA ↔ SSR/SSG)
- Change state management library
- Change auth mode (JWT ↔ sessions)
- Add i18n
- Add offline/PWA
- Change API assumptions derived from OpenAPI (endpoints/fields/status codes/error shape)
- Expose `GET /attendance/monthly-sheet` to Student role (backend 403 is authoritative)
- Add `GET /attendance/streaks` as a standalone screen (streaks are inline-only in this Freeze)
- Surface event soft-delete restore UI (no backend support)

**If requested:** create Change Request → re-price → approve/reject.

---

## 14. CHANGE CONTROL (Accept-and-price rules) — Unchanged from v1.8

### Change Request Format

- **Requested change:** {description}
- **Reason:** {business justification}
- **Scope impact:** {screens affected}
- **Timeline impact:** {+N days}
- **Cost impact:** {self-funded / N/A}
- **Risk impact:** {Low/Medium/High}
- **Decision:** Approved / Rejected
- **New Freeze version:** {e.g., v1.9}
- **Backend Freeze dependency:** unchanged / updated → backend Freeze version {value}
- **OpenAPI dependency:** unchanged / updated → new OpenAPI version {value}

**Billing rule:** Self-funded solo project — no external billing.
**Response SLA for change requests:** 24 hours (self-review).

---

## 15. VERSION HISTORY

- **v1.0** (date unknown): Initial frontend freeze approved for execution.
- **v1.1** (date unknown): Undocumented.
- **v1.2** (date unknown): Undocumented.
- **v1.3** (2026-03-03): Backend v3.6 sync.
- **v1.4** (2026-03-04): Backend v3.6 final sync, CR-FE-008 applied.
- **v1.5** (2026-03-05): Backend v4.0 sync. CR-FE-009 (a/b/c/d), CR-FE-010, CR-FE-011 applied.
- **v1.6** (2026-03-07): Backend v4.2 sync. CR-FE-012, CR-FE-013 (a/b/c/d/e/f/g) applied.
- **v1.7** (2026-03-07): Backend v4.3 sync (CR-31). CR-FE-014 (a/b/c/d/e/f/g) applied.
- **v1.8** (2026-03-08): Backend v4.4 sync (CR-32). CR-FE-015 (a/b/c/d/e) applied. `PUT /timetable/{id}` removed, delete-then-recreate correction workflow.
- **v1.9** (2026-03-08): Backend v4.5 sync (CR-33–38). CR-FE-016 (a/b/c/d/e/f/g) applied. Breaking: `TenantUser.studentId` field added (CR-38), CG-01 Student dashboard placeholder resolved. Additive: API-driven Admin stat bar (CR-35), Timetable marking-status color (CR-35), At-Risk streaks panel in Record Attendance (CR-33), Teacher Class Rankings card on Dashboard (CR-34), Admin Toppers Rankings tab in Attendance Summary (CR-34), Monthly Sheet screen `/attendance/monthly-sheet` Admin+Teacher (CR-36), Academic Calendar screen `/manage/events` Admin (CR-37), Upcoming Events card on Dashboard all roles (CR-37), Student self-streak badges on Dashboard (CR-33+38). 2 new routes, 6 new TQ keys, 5 new types. Timeline: 9–13 weeks + 18 days.

---

**END OF FRONTEND FREEZE v1.9**
