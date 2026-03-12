# FRONTEND PROJECT FREEZE: White-Label School Management SaaS

**Version:** 3.0 (IMMUTABLE)
**Date:** 2026-03-12
**Status:** APPROVED FOR EXECUTION
**Supersedes:** v2.8 (2026-03-11)
**Backend Freeze:** v5.0 (2026-03-12)
**OpenAPI:** v5.0.2 (2026-03-12)

> **CRITICAL INSTRUCTION FOR EXECUTION (HUMAN OR AI):**
> This document is the Absolute Source of Truth. You have NO authority to modify routes,
> UI scope, API assumptions, or non-functional constraints defined below.
> If any request contradicts this document, you must REFUSE and open a Change Request instead.
> v2.8 is SUPERSEDED. All implementation aligns to v3.0 and Backend Freeze v5.0.

---

## 0. Commercials (Accept-and-price)

**Engagement Type:** Fixed-scope
**Chosen Package:** Pro (full feature set — all 15 CR modules)

**Price & Payment Schedule:**
- Total price: To be priced per module per CR-FE-01 through CR-FE-15 billing items
- Milestone payments: 30% on foundation complete (CR-FE-01 accepted), 40% on P1 modules accepted (CR-FE-02–06, 11), 30% on P2/P3 modules accepted and UAT passed

**Timeline Range (weeks):**
- P0+P1 only (CR-FE-01–06, 11): 8 weeks
- All modules approved: 18 weeks
- Each CR timeline is additive; parallel execution possible after CR-FE-01–03 complete

**Assumptions (must be true):**
- Backend Freeze v5.0 is fully implemented and Prism mock server is running at port 4000 before frontend development begins.
- OpenAPI v5.0.2 (`openapi.yaml`) is the contract source; no undocumented endpoints will be consumed.
- School branding assets (logo, principal signature image) are provided by client in PNG/JPG/SVG format before CR-FE-11 begins.
- A single technical decision maker is available within 24 hours for clarifications.
- `VITE_TENANT_ID` (UUID) is provided per deployment by client before any production build.

**Support Window (post-delivery):**
- Bugfix support: 30 days post-UAT acceptance per CR module
- Enhancements: billed as Change Requests against this freeze

---

## 1. The "Iron Scope" (Frontend only)

**Core Value Proposition (One Sentence):**
> A role-aware PWA that gives Admins, Teachers, Students, and Guardians of a residential Islamic educational institution a unified interface for managing sessions, attendance, leave, exams, fees, assignments, announcements, and institutional communication — deployed as a white-label instance per school.

**The 15 Frontend User Stories (COMPLETE SCOPE):**

1. As Admin, I can manage the platform shell (login, password change, role-based navigation, tenant branding) so that every role has a secure, correctly scoped entry point into the system.
2. As Admin, I can manage academic sessions, batches, classes, and batch promotions with wizard-guided workflows so that the school's annual academic structure is correctly configured.
3. As Admin, I can manage student records and guardian accounts (create, edit, link, reset passwords) so that all student data is accurate and guardians can access the portal.
4. As Admin and Teacher, I can view and manage class timetables so that attendance recording and schedule visibility are always grounded in the correct period structure.
5. As Admin and Teacher, I can record, correct, and report on daily and monthly attendance so that student presence is tracked accurately at the period level.
6. As Admin and Class Teacher, I can manage the full leave request lifecycle (approve, reject, depart, return, off-campus monitoring) so that student whereabouts are tracked at all times.
7. As Admin and Teacher, I can create exams, enter marks per subject, publish results, and download report cards so that academic performance is formally recorded and visible to all stakeholders.
8. As Admin, I can raise fee charges (single and bulk), record payments, and view outstanding dues summaries so that fee collection is tracked without a manual ledger.
9. As Admin and Teacher, I can create assignments and track per-student completion with remarks so that homework accountability is maintained.
10. As Admin and Teacher, I can create and manage targeted announcements with scheduled publish and audience control so that institutional communication is centralised.
11. As Admin, I can configure the school profile (branding, logo, principal signature, active levels) so that the white-label instance is correctly branded and grade/level configuration drives all other modules.
12. As Admin, I can bulk-import students and users via a validated CSV wizard with error reporting and TTL-aware confirmation so that session-start enrollment is efficient and corruption-free.
13. As all roles, I can receive push notifications and view an in-app notification centre so that critical events (leave approvals, exam results, overdue alerts) reach me in real time.
14. As Guardian, I can view my linked child's attendance calendar, leave history, exam results, fees, assignments, and timetable so that I have full self-service visibility without contacting the school office.
15. As Student, I can view my own dashboard, attendance, results, assignments, fees, and timetable so that I have self-service access to my academic record from my phone.

**The "NO" List (Explicitly Out of Scope):**
- Transport management UI
- In-app messaging or chat
- WhatsApp Business API integration
- Email notification channel or preferences
- Online fee payment gateway (Razorpay, Stripe, UPI)
- Guardian self-registration (Admin creates guardian accounts only)
- Multi-tenancy admin delegation
- Analytics dashboard or data export beyond CSV monthly sheet
- React Native mobile app (PWA only)
- External exam workflow (record-only, read-only UI)
- Library management
- Student registration/affiliation number tracking
- SSR, SSG, or ISR (SPA only)
- i18n / multi-language support
- Offline data entry beyond static asset caching
- File upload by students or teachers (physical submission model throughout)
- SuperAdmin portal extension (SuperAdmin screens from v2.8 are inherited unchanged)

**User Roles (UI behaviour truth):**

| Role | Visible Routes | Key Actions | Blocked / Hidden |
|------|---------------|-------------|-----------------|
| SuperAdmin | `/login`, `/change-password`, inherited SuperAdmin routes from v2.8 | Tenant management (inherited) | All academic routes |
| Admin | All `/admin/*`, `/announcements/*`, `/notifications` | Full CRUD on all modules, fee charges, bulk import, school profile, password resets | Cannot access other tenants |
| Teacher | `/teacher/*`, `/announcements/*`, `/notifications` | Mark attendance, own timetable, create assignments for own class+subject, create announcements | No leave approval unless `isClassTeacher`; no fee write access |
| Teacher (isClassTeacher) | All Teacher routes + `/teacher/leave` | Approve/reject leave, mark depart/return, view class fees summary | Same as Teacher otherwise |
| Student | `/student/*`, `/notifications` | Read-only: own attendance, results, assignments, fees, timetable, announcements | No write actions except reading notifications |
| Guardian | `/guardian/*`, `/notifications` | Submit leave (if `canSubmitLeave`), read child data across all guardian portal endpoints | Read-only on everything except leave submission |

> `isClassTeacher` is derived at runtime: `role === 'Teacher' && classTeacherOf !== null` from JWT payload. It is NOT a separate `UserRole` enum value.

**Success Definition (measurable):**
- All 15 CR modules pass UAT acceptance criteria without open P0/P1 defects.
- LCP ≤ 2500ms, INP ≤ 200ms, CLS ≤ 0.1 on Chrome 90+ / Safari 14+ on a mid-range Android device measured via Lighthouse CI.
- Initial JS bundle ≤ 200KB gzipped; per-route lazy chunk ≤ 100KB gzipped, enforced in CI.
- axe-core Playwright audit returns 0 WCAG 2.1 AA violations on all 5 critical-path screens.
- Zero TypeScript compile errors against openapi-typescript generated types from `openapi.yaml` v5.0.2.
- No frontend-originated 4xx errors caused by sending fields, shapes, or values not present in OpenAPI v5.0.2.

---

## 1.2 Assumptions & External Dependencies

**Primary Backend/API:** School Management SaaS API v5.0.2, base URL from `VITE_API_BASE_URL`
**Environments:** development (`http://localhost:3000`), staging, production

**Design Source:** No Figma. Design system is the inherited Scofist pattern from Frontend Freeze v2.0 (CR-FE-017): CSS custom properties token system, shadcn/ui components, Tailwind CSS, Montserrat font via `@fontsource/montserrat`.

**External Dependencies:**

- **Dependency 1:** `vite-plugin-pwa` + browser Web Push API (VAPID)
  - Purpose: PWA manifest, service worker for offline shell caching and push notification delivery
  - Failure UX: If push permission is denied, a dismissible banner is shown: "Enable notifications in browser settings." In-app bell remains fully functional. Push subscription failure (network error on `POST /push/subscribe`) is non-blocking — logged to Sentry, user continues normally.

- **Dependency 2:** Cloudflare R2 (via `SchoolProfile.logoUrl`, `SchoolProfile.principalSignatureUrl`)
  - Purpose: Serves uploaded school assets (logo, principal signature) as public URLs
  - Failure UX: If an asset URL returns a non-200 response, a fallback placeholder (school name initials for logo, blank space for signature) is rendered. The upload flow shows an inline error if `POST /school-profile/upload` returns 4xx/5xx.

---

## 1.5 Frontend Configuration (The Environment)

```bash
# .env.example

# Environment
VITE_APP_ENV="development"           # development | staging | production

# API
VITE_API_BASE_URL="http://localhost:3000/api/v1"
VITE_APP_BASE_URL="http://localhost:5173"

# Tenant (set per deployment — one build per school)
VITE_TENANT_ID=""                    # UUID of the tenant — required, no default

# Auth
VITE_AUTH_MODE="jwt"                 # jwt only — locked by Backend Freeze v5.0

# Web Push
VITE_VAPID_PUBLIC_KEY=""             # VAPID public key from backend .env

# Observability
VITE_SENTRY_DSN=""                   # Empty string disables Sentry
VITE_BUILD_SHA="local"               # Injected by CI at build time

# PWA
VITE_APP_NAME="School Portal"        # Displayed in PWA manifest and browser tab
VITE_THEME_COLOR="#1A5276"           # Overridden at runtime by brandingColor from school profile
```

**Configuration Rules:**
- `VITE_TENANT_ID` must be a valid UUID. Application boot fails with an error screen if absent or malformed.
- `VITE_API_BASE_URL` must be set per environment. No trailing slash.
- No secrets are placed in any `VITE_*` variable. JWT is runtime-only (sessionStorage).
- `VITE_VAPID_PUBLIC_KEY` must exactly match the backend `VAPID_PUBLIC_KEY`. Mismatch causes silent push subscription failure.
- `VITE_APP_ENV` drives Sentry environment tagging and enables/disables Prism request logging in development.
- `.env.local` is gitignored. Contains `VITE_TENANT_ID` for local development.

---

## 1.6 Tech Stack & Key Libraries (Frontend toolbelt)

**Core Stack (LOCKED):**

| Category | Library / Version | Notes |
|----------|------------------|-------|
| Framework | React 18 | Carry forward from v2.8 |
| Build tool | Vite | Required for vite-plugin-pwa |
| Language | TypeScript (strict mode) | Carry forward from v2.8 |
| Routing | react-router-dom v6 | Carry forward from v2.8 |
| Data fetching / caching | TanStack Query v5 | Carry forward from v2.8 (QC1–QC4 rules apply) |
| Forms / validation | react-hook-form + zod | Carry forward from v2.8 |
| UI library | shadcn/ui + Tailwind CSS | Carry forward from v2.8 Scofist pattern |
| State management | Zustand | Carry forward from v2.8 |
| Date handling | date-fns + date-fns-tz | All date display uses `tenantTimezone` from JWT |
| HTTP client | Axios | Carry forward from v2.8 |
| PWA | vite-plugin-pwa | NEW in v3.0 (CR-FE-01) |
| Table virtualization | @tanstack/react-virtual | NEW in v3.0 — monthly sheet, large student lists |
| CSV export | papaparse | NEW in v3.0 — client-side error report generation |
| API type generation | openapi-typescript | Generates types from `openapi.yaml` v5.0.2 |
| Error boundaries | react-error-boundary | Carry forward from v2.0 SP10 |
| Toast notifications | sonner | Carry forward from v2.7 (CR-FE-024) |
| Font | @fontsource/montserrat | Carry forward from v2.1 E1 fix |
| Progress indicator | nprogress (top-loader) | Carry forward from v2.0 |

**Explicitly Banned Libraries/Patterns:**
- No Redux (Zustand is sufficient and locked)
- No class components
- No jQuery
- No moment.js — use date-fns-tz exclusively
- No `localStorage` at any point — ESLint rule: `'no-restricted-globals': ['error', 'localStorage']`
- No `dangerouslySetInnerHTML`
- No `tabIndex > 0`
- No uncontrolled global singletons outside Zustand stores
- No HK4 (`useEffect` for data fetching) — use TanStack Query exclusively
- No HK5 (`useState` + `useEffect` for derived server state) — use TanStack Query selectors
- No `next/font` (Vite project, not Next.js)
- No 6 rejected Scofist patterns from CR-FE-017

---

## 2. Routes, Screens, and Navigation (UI truth)

**Routing mode:** SPA (react-router-dom v6, `createBrowserRouter`)
**Auth gating model:** Protected routes + `mustChangePassword` redirect guard + role-based route guards

### Route Map (ALL routes)

**Public (no auth required):**
- `/login` → Login Screen, auth: public, roles: all (unauthenticated)

**Forced redirect (authenticated, all roles):**
- `/change-password` → Change Password Screen, auth: protected (any role), guard: accessible by all authenticated users; all other protected routes redirect here if `mustChangePassword === true`

**Admin routes (auth: protected, role: Admin):**
- `/admin/dashboard` → Admin Dashboard
- `/admin/sessions` → Session List
- `/admin/sessions/:id` → Session Detail
- `/admin/sessions/:id/promote` → Batch Promotion Wizard
- `/admin/batches` → Batch Management
- `/admin/classes` → Class Management (current session scoped)
- `/admin/students` → Student List
- `/admin/students/new` → Create Student
- `/admin/students/:id` → Student Detail + Guardian Management
- `/admin/timetable` → Timetable Builder
- `/admin/attendance/correct` → Attendance Correction
- `/admin/attendance/daily` → Daily Attendance Summary
- `/admin/attendance/monthly` → Monthly Attendance Sheet
- `/admin/leave` → Full Leave Management
- `/admin/exams` → Exam List
- `/admin/exams/:id` → Exam Detail + Subjects
- `/admin/exams/:id/results` → Consolidated Results
- `/admin/fees` → Fee Charge List
- `/admin/fees/bulk` → Bulk Charge Wizard
- `/admin/fees/summary` → Outstanding Summary
- `/admin/assignments` → Assignment List + Create
- `/admin/import` → CSV Import Wizard
- `/admin/import/history` → Import History
- `/admin/settings/profile` → School Profile + Uploads
- `/admin/settings/grade-config` → Grade Config (read-only)
- `/admin/settings/features` → Feature Flags (read-only)

**Teacher routes (auth: protected, role: Teacher):**
- `/teacher/dashboard` → Teacher Dashboard
- `/teacher/timetable` → Teacher Timetable (own, read-only)
- `/teacher/attendance` → Mark Attendance
- `/teacher/leave` → Leave Queue (guard: `isClassTeacher` only — non-ClassTeacher redirected to `/teacher/dashboard`)
- `/teacher/exams` → Assigned Exam List (mark sheets)
- `/teacher/exams/:id/marks/:subjectId` → Marks Entry Sheet
- `/teacher/assignments` → Assignment List + Create + Marking

**Student routes (auth: protected, role: Student):**
- `/student/dashboard` → Student Dashboard
- `/student/attendance` → Own Attendance Monthly View
- `/student/results` → Own Exam Results
- `/student/assignments` → Own Assignment List
- `/student/fees` → Own Fee Charges
- `/student/timetable` → Class Timetable (read-only)
- `/student/announcements` → Announcement Feed

**Guardian routes (auth: protected, role: Guardian):**
- `/guardian/dashboard` → Child Switcher + Summary
- `/guardian/attendance` → Child Attendance Calendar
- `/guardian/leave` → Child Leave History
- `/guardian/leave/new` → Submit Leave Form
- `/guardian/results` → Child Exam Results
- `/guardian/fees` → Child Fee Charges
- `/guardian/assignments` → Child Assignment List
- `/guardian/timetable` → Child Timetable (read-only)

**Shared routes (auth: protected, all roles except SuperAdmin):**
- `/announcements` → Announcement Feed
- `/announcements/new` → Create Announcement (Admin, Teacher only; non-permitted roles redirected)
- `/announcements/:id/edit` → Edit Announcement (creator only, before `publishAt`)
- `/notifications` → Full Notification History

---

### Screen Specifications

---

**Screen:** Login
- Goal: Authenticate user with email + password + tenant context; hydrate auth store; enforce `mustChangePassword` redirect.
- Entry points: Direct navigation, post-logout redirect, post-session-expiry redirect.
- Required API calls:
  1. `POST /auth/login` with `{ email, password, tenantId: import.meta.env.VITE_TENANT_ID }`. On success: store token in `sessionStorage['auth_token']`, decode JWT, hydrate `useAuthStore`, navigate to role-default route. On failure 401: display inline error "Email or password is incorrect". On 422: display field-level zod errors. On 429: display "Too many login attempts. Try again in a moment."
- Local state: `email`, `password`, `isSubmitting`.
- Server state: none (auth is a mutation, not a query).
- Loading state: submit button shows spinner, inputs disabled.
- Empty state: n/a.
- Error states: 401 inline below form; 429 inline; 422 per-field; network error toast "Connection error — check your network".
- Form validation rules: `email` must be valid email format (zod). `password` minLength 1.
- Permissions: Shown only to unauthenticated users. Authenticated users are redirected to their role-default route on mount.
- Accessibility requirements: Form has `<form role="form">`, inputs have associated `<label>`, errors have `aria-live="polite"`, submit button has explicit `type="submit"`.
- Performance notes: No data fetched on this page. Bundle must be split so login chunk is minimal.

---

**Screen:** Change Password
- Goal: Force new password entry when `mustChangePassword === true`; receive new JWT; clear the `mustChangePassword` flag.
- Entry points: Redirect from any protected route when `user.mustChangePassword === true`. Also accessible voluntarily.
- Required API calls:
  1. `POST /auth/change-password` with `{ currentPassword, newPassword }`. On success: update `sessionStorage['auth_token']` with new token, re-decode JWT (new token has `mustChangePassword: false`), navigate to role-default route. On 401: "Current password is incorrect". On 422: per-field errors.
- Local state: `currentPassword`, `newPassword`, `confirmNewPassword`, `isSubmitting`.
- Server state: none.
- Loading state: submit button spinner, inputs disabled.
- Error states: 401 inline; 422 per-field; `newPassword !== confirmNewPassword` validated client-side before submit.
- Form validation rules: `newPassword` minLength 8. `confirmNewPassword` must equal `newPassword`. Both validated via zod on `react-hook-form`.
- Permissions: Accessible by all authenticated roles. When `mustChangePassword === true`, the layout shell hides all nav — only the Change Password form is shown.
- Accessibility requirements: All inputs labeled. Password fields have `type="password"`. Confirmation mismatch error announced via `aria-live`.
- Performance notes: None.

---

**Screen:** Admin Dashboard
- Goal: Provide Admin with a real-time operational overview (today's attendance, class statuses, recent leave activity).
- Entry points: Post-login for Admin role. Sidebar nav "Dashboard".
- Required API calls:
  1. `GET /academic-sessions/current` — populate current session context in global session store (on app boot, not repeated).
  2. `GET /attendance/daily-summary?date=today` — feed `AdminStatBar` and `TodayTimetableGrid`.
  3. `GET /attendance/absentees/:timeslotId` — lazy-loaded per cell Popover click.
- Local state: selected date (default today), grid view mode toggle (grid/list on mobile).
- Server state: TQ keys `['sessions', 'current']`, `['attendance', 'daily-summary', classId, date]`, `['attendance', 'absentees', timeslotId, date]`.
- Loading state: Skeleton grid matching `TodayTimetableGrid` dimensions.
- Empty state: "No timetable configured for today" if no periods exist.
- Error states: TQ `QueryCache({onError})` global handler for 401 (logout), 403 (toast "Access denied"), 500 (toast "Server error — try again").
- Permissions: Admin only.
- Accessibility: Grid is `role="grid"`. Each cell is `role="gridcell"`. Today's column has `ring-2 ring-primary` + `aria-label="Today"` on header.
- Performance notes: `TodayTimetableGrid` auto-refreshes every 5 minutes and supports manual ↻ button. Absentee popovers are lazy-loaded.

---

**Screen:** Teacher Dashboard
- Goal: Show Teacher their own periods for today with attendance-marking CTA; include class rankings and attendance streaks.
- Entry points: Post-login for Teacher role.
- Required API calls:
  1. `GET /academic-sessions/current` — on app boot.
  2. `GET /timetable?classId=own&sessionId=current` — feed `TodayTimetableGrid`.
  3. `GET /attendance/daily-summary?classId=own&date=today` — grid cell marking-status colours.
  4. `GET /attendance/absentees/:timeslotId` — lazy on popover open (unrestricted for Teacher per CR-40/41).
- Local state: Grid/list toggle on mobile.
- Server state: TQ keys as above.
- Loading state: Skeleton grid.
- Empty state: "No periods scheduled today."
- Error states: Global handler.
- Permissions: Teacher role. `isClassTeacher` guard is not needed for dashboard — both Teacher and ClassTeacher share this view.
- Accessibility: Same as Admin Dashboard grid spec.
- Performance notes: 5-minute auto-refresh + manual ↻ + "last updated" timestamp.

---

**Screen:** Session List (`/admin/sessions`)
- Goal: List all academic sessions with status badges; provide create and activate/close actions.
- Entry points: Admin sidebar → Academic → Sessions.
- Required API calls:
  1. `GET /academic-sessions` on mount. On success: render list. On failure: error state.
- Local state: None beyond TQ.
- Server state: TQ key `['sessions']`, stale time 60s.
- Loading state: Skeleton rows (3).
- Empty state: "No sessions yet. Create your first academic session."
- Error states: Inline error with retry button.
- Form (Create Session): `name` (required), `startDate`, `endDate`. Zod: `endDate > startDate`. Submitted via `POST /academic-sessions`. On success: invalidate `['sessions']`, show toast "Session created", navigate to `/admin/sessions/:id`.
- Permissions: Admin only.
- Accessibility: Status badges (`UPCOMING`/`ACTIVE`/`COMPLETED`) have `aria-label` including the text, not colour alone.
- Performance notes: None.

---

**Screen:** Session Detail (`/admin/sessions/:id`)
- Goal: Show session metadata; provide activate, close, copy-timetable actions; display classes configured for the session.
- Entry points: Session list row click.
- Required API calls:
  1. `GET /academic-sessions/:id` on mount.
  2. `GET /classes?sessionId=:id` on mount — list classes in session.
  3. `PUT /academic-sessions/:id/activate` on button click. On `409 CLASSES_NOT_CONFIGURED`: show inline error listing `error.details.unconfiguredBatches`. On success: invalidate `['sessions']`, toast "Session activated".
  4. `PUT /academic-sessions/:id/close` on confirm. On success: invalidate `['sessions']`, toast "Session closed".
  5. `POST /academic-sessions/:id/copy-timetable` with source session picker. On success: toast "Timetable copied".
- Local state: `copyTimetableSourceId` picker value.
- Server state: TQ keys `['sessions', id]`, `['classes', id]`.
- Loading state: Detail skeleton.
- Error states: `409 CLASSES_NOT_CONFIGURED` shown as inline warning with batch names, not a toast.
- Permissions: Admin only. Activate button hidden when `status !== 'UPCOMING'`. Close button hidden when `status !== 'ACTIVE'`.
- Accessibility: Confirm dialogs use `<ConfirmDialog>` component (SP from v2.7). Focus returns to trigger button on close.
- Performance notes: None.

---

**Screen:** Batch Promotion Wizard (`/admin/sessions/:id/promote`)
- Goal: Guide Admin through 3-step batch promotion: target session → preview per-batch student list → commit. TTL-aware.
- Entry points: Session Detail page "Promote Batches" button.
- Required API calls:
  1. Step 1 → `POST /academic-sessions/:id/transition/preview` with `{ targetSessionId }`. On success: advance to Step 2, store `promotionPreviewId` + `expiresAt` in local state, start countdown timer.
  2. Step 2 (commit) → `POST /academic-sessions/:id/transition/commit` with `{ promotionPreviewId, batches: [...] }`. On `410 PREVIEW_EXPIRED`: reset wizard to Step 1, show "Preview expired — please regenerate." On success: navigate to `/admin/sessions`, toast "Promotion complete".
  3. Rollback → `POST /promotions/:id/rollback`. On `409 ALREADY_ROLLED_BACK`: toast "Already rolled back". On success: toast "Rollback complete". Rollback button visible on `promotion_log` entries only to Admin.
- Local state: `currentStep` (1|2|3), `promotionPreviewId`, `expiresAt`, `batches` (include/exclude per-student checkboxes), `timeRemainingSeconds`.
- Server state: TQ key `['sessions', id]` invalidated on commit.
- Loading state: Step 1 → spinner while preview generates. Step 2 → progress indicator on commit.
- Empty state: n/a.
- Error states: `410 PREVIEW_EXPIRED` resets to Step 1. `400` validation errors shown inline. Countdown reaches 0: auto-reset to Step 1 with "Preview expired" message before user can click Confirm.
- Form validation rules: At least one student must be included per batch to proceed.
- Permissions: Admin only.
- Accessibility: Stepper has `aria-current="step"` on active step. Countdown timer announces "Preview expires in X minutes" via `aria-live="polite"` on 5-minute and 1-minute marks.
- Performance notes: Preview may list up to ~500 students across batches. Batch preview tables are virtualised with `@tanstack/react-virtual`.

---

**Screen:** Batch Management (`/admin/batches`)
- Goal: List, create, and edit batches.
- Entry points: Admin sidebar → Academic → Batches.
- Required API calls:
  1. `GET /batches` on mount.
  2. `POST /batches` on create form submit. On success: invalidate `['batches']`, toast.
  3. `PUT /batches/:id` on edit. On success: invalidate `['batches', id]`.
- Server state: TQ key `['batches']`, stale time 60s.
- Loading / empty states: Skeleton rows; "No batches configured."
- Form validation: `name` required. `entryLevel` required (StudentLevel enum from `tenant.activeLevels`). `startYear` and `endYear` integers, `endYear > startYear`. `entrySessionId` required (session picker).
- Permissions: Admin only.
- Accessibility: Standard form a11y.
- Performance notes: None.

---

**Screen:** Class Management (`/admin/classes`)
- Goal: List and create classes for the current session; assign class teachers.
- Entry points: Admin sidebar → Academic → Classes.
- Required API calls:
  1. `GET /classes?sessionId=currentSession.id` on mount.
  2. `POST /classes` on create. On `409 UNIQUE_CONSTRAINT` (class teacher already assigned): inline error "This teacher is already a class teacher in the current session."
  3. `PUT /classes/:id` on edit (including class teacher assignment).
- Server state: TQ key `['classes', currentSession.id]`, stale time 60s.
- Loading / empty states: Skeleton rows; "No classes configured for this session."
- Form validation: `batchId`, `sessionId`, `name` required. `level` derived from batch progression. `section` optional string.
- Permissions: Admin only. Class teacher assignment field shows only users with `role === 'Teacher'`.
- Accessibility: Class teacher picker is an accessible `<Select>` with search.
- Performance notes: None.

---

**Screen:** Student List (`/admin/students`)
- Goal: List all students with search and filter by class/batch/level/status.
- Entry points: Admin sidebar → Students.
- Required API calls:
  1. `GET /students` on mount. Filters: `classId`, `batchId`, `status` — sent as query params if set.
- Server state: TQ key `['students', filters]`, stale time 30s.
- Loading state: Skeleton rows (5).
- Empty state: "No students found."
- Client-side filtering: `name` and `admissionNumber` use case-insensitive `includes` on `.data` array (same `useMemo` pattern as v2.8 UsersPage). `classId`, `batchId`, `status` are exact-match selects.
- Permissions: Admin only.
- Accessibility: Table has `min-w-[900px]` with horizontal scroll wrapper. Student name column `whitespace-nowrap`.
- Performance notes: If total students > 200, enable `@tanstack/react-virtual` row virtualization.

---

**Screen:** Student Detail (`/admin/students/:id`)
- Goal: View and edit student profile; manage linked guardians; reset password.
- Entry points: Student list row click.
- Required API calls:
  1. `GET /students/:id` on mount.
  2. `GET /students/:id/guardians` on mount.
  3. `PUT /students/:id` on edit form submit. On success: invalidate `['students', id]`, toast.
  4. `DELETE /students/:id` (soft-deactivate) on confirm. On success: invalidate `['students']`, navigate back.
  5. `POST /users/:userId/reset-password` — Admin only. On success: display `temporaryPassword` in one-time modal (copy-to-clipboard button). Modal has no "show again" path — `temporaryPassword` is cleared from component state on modal close via `onOpenChange`.
  6. `POST /guardians` — create guardian. On success: if `createUserAccount === true`, show `temporaryPassword` one-time modal. Invalidate `['students', id, 'guardians']`.
  7. `PUT /guardians/:id` — edit guardian. On success: invalidate.
  8. `DELETE /guardians/:id` — unlink. On confirm: invalidate.
- Local state: edit mode toggle, guardian form open state, reset password modal state, `temporaryPassword` (cleared on modal close).
- Server state: TQ keys `['students', id]`, `['students', id, 'guardians']`.
- Permissions: Admin only. Reset password button hidden for SuperAdmin users. `canSubmitLeave` toggle on guardian record only visible to Admin.
- Accessibility: One-time password modal traps focus. `aria-label="Temporary password"` on password display field.
- Performance notes: None.

---

**Screen:** Timetable Builder (`/admin/timetable`)
- Goal: Build and manage the class timetable via a weekly grid. Add/edit/delete timeslots.
- Entry points: Admin sidebar → Timetable.
- Required API calls:
  1. `GET /timetable?classId=&sessionId=` on filter change (class picker + session picker).
  2. `POST /timetable` on new slot creation. On success: invalidate `['timetable', classId, sessionId]`.
  3. `DELETE /timetable/:id` on delete confirm. On success: invalidate. (No PUT — delete-then-recreate correction workflow from v1.8.)
  4. `POST /academic-sessions/:id/copy-timetable` — copy from previous session picker.
- Local state: `filterClassId`, `filterSessionId` (defaults to `currentSession.id`), `activeCell` for `CreateSlotDrawer`.
- Server state: TQ key `['timetable', classId, sessionId]`, stale time 300s (`Cache-Control: private, max-age=300` respected).
- Loading state: Grid skeleton.
- Empty state: "No timetable configured. Select a class and add slots." (only shown when `filterClassId` is set).
- Add-slot affordance guard: `isAdmin && cellIsEmpty && !!filterClassId` — all 4 guard sites (className, aria-label, tabIndex, onClick/onKeyDown) updated atomically per CR-FE-028a.
- Permissions: Admin: full CRUD. Teacher/Student/Guardian: read-only (`/teacher/timetable`, `/student/timetable`, `/guardian/timetable`).
- Accessibility: WCAG "today" column highlight per CR-FE-027D: `ring-2 ring-primary` + `aria-label="Today"` on column header.
- Performance notes: `SlotCell` multi-slot overflow fix per CR-FE-028b: no `h-full` on outer div; row has no fixed `min-h`, auto-sizes.

---

**Screen:** Teacher Timetable (`/teacher/timetable`)
- Goal: Show the Teacher their own weekly schedule. Read-only.
- Entry points: Teacher sidebar → Timetable.
- Required API calls:
  1. `GET /timetable?teacherId=:ownUserId&sessionId=currentSession.id` on mount.
- Server state: TQ key `['timetable', 'teacher']`, stale time 300s.
- Loading state: Grid skeleton.
- Empty state: "No periods assigned."
- Permissions: Teacher only. No add/edit/delete affordances.
- Accessibility: Today's column highlighted per CR-FE-027D.
- Performance notes: None.

---

**Screen:** Mark Attendance (`/teacher/attendance`)
- Goal: Allow Admin and Teacher to mark attendance per period for today's classes.
- Entry points: Teacher sidebar → Attendance; Admin sidebar → Attendance → Mark.
- Required API calls:
  1. `GET /timetable?classId=&sessionId=currentSession.id` — load today's periods for class picker.
  2. `GET /attendance/daily-summary?classId=&date=today` — check if period already marked (edit mode).
  3. `POST /attendance/record-class` with `{ timeslotId, date, students: [{studentId, status}] }`. On `400 BACKDATING_NOT_ALLOWED`: toast "Backdating not allowed". On success: invalidate `['attendance', ...]`, show absentees panel.
  4. `GET /attendance/absentees/:timeslotId` — after marking, show absentees panel.
- Local state: `selectedClassId`, `selectedTimeslotId`, `studentStatuses` (map of studentId → AttendanceStatus), `isEditMode`.
- Server state: TQ keys `['attendance', 'daily-summary', classId, date]`, `['attendance', 'absentees', timeslotId, date]`.
- Loading state: Student row skeletons while fetching class.
- Empty state: "Select a class and period to begin."
- Error states: `400 BACKDATING_NOT_ALLOWED` toast. `403` toast "You are not authorised to record attendance for this class."
- Form validation: Date picker locked to today (min=max=today, frontend-enforced). `Excused` status is not available to Teacher — it renders as read-only if already set by Admin; Teacher cannot set it (client-side and server-side enforcement).
- Permissions: Admin and Teacher. Admin sees class picker for any class. Teacher sees own assigned classes only (derived from JWT `classId`).
- Accessibility: Status radio buttons use `aria-label` per student name + status. Student name uses `break-words` (not `truncate`) per CR-FE-023F. Mobile: status buttons show `P`/`A`/`L` with `aria-label` unchanged per CR-FE-020B.
- Performance notes: Student list up to 200 items (`maxItems: 200` per Backend Freeze). If class size > 60, `@tanstack/react-virtual` row virtualization required.

---

**Screen:** Attendance Correction (`/admin/attendance/correct`)
- Goal: Allow Admin to correct any student's attendance record, including setting `Excused` status.
- Entry points: Admin sidebar → Attendance → Correct.
- Required API calls:
  1. `GET /students` + `GET /timetable` — populate student and timeslot pickers.
  2. `PUT /attendance/:recordId` with `{ status }`. On success: invalidate relevant attendance TQ keys, toast "Attendance updated".
- Local state: `studentId`, `date`, `timeslotId`, `newStatus` pickers.
- Server state: TQ key `['attendance', 'daily-summary', classId, date]` invalidated on update.
- Permissions: Admin only. `Excused` status option visible only in this screen.
- Accessibility: Status picker is a `<Select>` with label.
- Performance notes: None.

---

**Screen:** Daily Attendance Summary (`/admin/attendance/daily`)
- Goal: Show Admin and Class Teacher a per-class, per-period summary for a selected date.
- Entry points: Admin sidebar → Attendance → Daily.
- Required API calls:
  1. `GET /attendance/daily-summary?classId=&date=` on picker change.
- Server state: TQ key `['attendance', 'daily-summary', classId, date]`.
- Loading state: Summary card skeletons.
- Empty state: "No attendance recorded for this class on this date."
- Permissions: Admin (any class), Teacher (`isClassTeacher` only for own class).
- Accessibility: `aria-live="polite"` on summary container per CR-FE-027B pattern.
- Performance notes: None.

---

**Screen:** Monthly Attendance Sheet (`/admin/attendance/monthly`)
- Goal: Show Admin and Teacher a full month × student matrix with colour-coded statuses and export.
- Entry points: Admin sidebar → Attendance → Monthly.
- Required API calls:
  1. `GET /attendance/monthly-sheet?classId=&month=` on picker change.
- Server state: TQ key `['attendance', 'monthly-sheet', classId, month]`, stale time 120s.
- Loading state: Skeleton table.
- Empty state: "No attendance records for this class/month."
- Colour coding: Present=green, Absent=red, Late=yellow, Excused=blue. Today's date column highlighted per CR-FE-027D.
- Export: Client-side CSV generation via `papaparse` — "Export CSV" button. No API call.
- Attendance percentage column: Excused days excluded from denominator — matches server computation. Shown as `%` value, not colour-only (text badge alongside bar per CR-FE-027C).
- Permissions: Admin (any class), Teacher (`isClassTeacher` for own class — server enforces, Frontend shows class picker limited to own class for Teacher).
- Accessibility: Table `overflow-x-auto` + `min-w-` constraint. Student column sticky (`sticky left-0 bg-background z-10 border-r`) per CR-FE-022D. Today column `ring-2 ring-primary` per CR-FE-027D. For Student role: same endpoint called server-filters to own row. `aria-label="Attendance percentage: X%"` on percentage cell.
- Performance notes: 30 days × 50 students = 1,500 cells. `@tanstack/react-virtual` column virtualization required when column count > 15.

---

**Screen:** Leave Queue — Class Teacher (`/teacher/leave`)
- Goal: Show Class Teacher all pending leave requests for their class; approve, reject, mark depart/return; monitor off-campus students.
- Entry points: Teacher sidebar → Leave (visible only when `isClassTeacher`).
- Required API calls:
  1. `GET /leave?classId=classTeacherOf&status=PENDING` on mount.
  2. `GET /leave/on-campus` for off-campus panel — poll every 30 seconds.
  3. `PUT /leave/:id/approve` on confirm. On `409 LEAVE_ALREADY_REVIEWED`: toast "Already reviewed by another approver — refresh the list." On success: invalidate `['leave', ...]`.
  4. `PUT /leave/:id/reject` with `{ rejectionReason }` (required textarea). On success: invalidate.
  5. `PUT /leave/:id/depart` on confirm. Shown only when `status === 'APPROVED'`.
  6. `PUT /leave/:id/return` on confirm. Shown only when `status === 'ACTIVE'`.
- Local state: `rejectionReason` textarea state, polling interval ref, filter tab (Pending / All).
- Server state: TQ keys `['leave', { classId: classTeacherOf, status: 'PENDING' }]`, `['leave', 'on-campus']`. Off-campus key refetchInterval: 30000ms.
- Loading state: Leave card skeletons (3).
- Empty state: "No pending leave requests for your class."
- Error states: `409 LEAVE_ALREADY_REVIEWED` shown as toast; list auto-refetches. 
- Off-campus panel: OVERDUE students (expected return past current time) highlighted red. Off-campus list shows `expectedReturnAt` formatted in `tenantTimezone`.
- Status timeline: Shown on `<LeaveDetail>` component — PENDING → APPROVED → ACTIVE → COMPLETED/OVERDUE sequential badge row.
- Permissions: `isClassTeacher` guard at route level. Non-ClassTeacher Teacher is redirected to `/teacher/dashboard`.
- Accessibility: Off-campus panel has `aria-live="polite"` to announce new off-campus entries during polling. OVERDUE badge has `role="alert"`.
- Performance notes: 30-second poll on off-campus only — not on the full leave list.

---

**Screen:** Leave Management — Admin (`/admin/leave`)
- Goal: Full leave management across all classes: all role-level actions + cancel + proxy submission + filters.
- Entry points: Admin sidebar → Leave.
- Required API calls:
  1. `GET /leave` with filters: `classId`, `studentId`, `status`, `startDate`, `endDate` — as query params.
  2. `GET /leave/on-campus` — off-campus panel, 30-second poll.
  3. All leave mutation endpoints (approve, reject, cancel, depart, return) — same as ClassTeacher screen.
  4. `POST /leave` — submit on behalf of guardian (`proxyFor: guardianId` shown).
- Local state: filter state, proxy submission form open, `rejectionReason`.
- Server state: TQ key `['leave', filters]`. Mutations invalidate on success.
- Permissions: Admin only. `Excused` attendance via Admin correction is separate. Cancel action only available on `status === 'PENDING'`.
- Accessibility: Filter bar collapses on mobile. Status machine timeline on `<LeaveDetail>`.
- Performance notes: Default page size 50 (`limit=50`, `offset` pagination). Server-side pagination — no client-side virtualization required.

---

**Screen:** Leave History — Student (`/student/leave` — embedded in student portal)
- Goal: Read-only leave history for the authenticated student.
- Entry points: Student sidebar → Leave History (shown within `/student/dashboard` or dedicated tab).
- Required API calls:
  1. `GET /leave?studentId=jwtPayload.studentId` on mount.
- Server state: TQ key `['leave', { studentId }]`.
- Loading state: Skeleton rows.
- Empty state: "No leave requests yet."
- Permissions: Student only. No action buttons. Rejection reason shown if `status === 'REJECTED'`.
- Accessibility: Status badges have text labels.
- Performance notes: None.

---

**Screen:** Leave Form — Guardian (`/guardian/leave/new`)
- Goal: Allow Guardian to submit a leave request for their selected child.
- Entry points: Guardian sidebar → Leave → New Request.
- Required API calls:
  1. `POST /leave` with `{ studentId: selectedChildId, leaveType, durationType, startDate, endDate, reason, expectedReturnAt }`. On `400 LEAVE_SUBMISSION_NOT_ALLOWED`: show non-dismissible inline error "You are not authorised to submit leave for this student. Contact the school office." Do not render the form. On success: navigate to `/guardian/leave`, toast "Leave request submitted. Request ID: [id]."
- Local state: form fields, `isSubmitting`.
- Guard: `GET /guardian/children` first — if `canSubmitLeave === false` for `selectedChildId`, render the error message without showing the form at all.
- Form validation: `leaveType` required (LeaveType enum). `durationType` required. `startDate` required, ≥ today. `endDate` ≥ `startDate`. `reason` required, minLength 10. `expectedReturnAt` required datetime (tenant timezone context label shown).
- Permissions: Guardian role. `canSubmitLeave` check done client-side before rendering form; server enforces as final guard.
- Accessibility: All pickers have associated labels. Datetime picker shows timezone label.
- Performance notes: None.

---

**Screen:** Exam List (`/admin/exams`)
- Goal: List exams with status badges; allow create and navigate to detail.
- Entry points: Admin sidebar → Exams.
- Required API calls:
  1. `GET /exams?classId=&sessionId=currentSession.id` with optional filters.
  2. `POST /exams` on create form submit. On success: navigate to `/admin/exams/:id`, toast "Exam created."
- Server state: TQ key `['exams', filters]`.
- Loading state: Skeleton cards.
- Empty state: "No exams. Create your first exam."
- Form validation: `classId` required, `sessionId` required (defaults to `currentSession.id`), `name` required, `type` required (ExamType). `gradeBoundaries` editor pre-filled with defaults from `/settings/grade-config`; editable collapsible section.
- Permissions: Admin only for create. Teacher sees only assigned exams at `/teacher/exams`.
- Accessibility: Status badges have text labels.
- Performance notes: None.

---

**Screen:** Exam Detail + Subjects (`/admin/exams/:id`)
- Goal: Manage exam subjects, assign teachers, set exam dates; publish/unpublish.
- Entry points: Exam list row click.
- Required API calls:
  1. `GET /exams/:id` on mount (includes `subjects[]`).
  2. `POST /exams/:id/subjects` — add subject. On success: invalidate `['exams', id]`.
  3. `PUT /exams/:id/subjects/:subjectId` — edit. On success: invalidate.
  4. `DELETE /exams/:id/subjects/:subjectId` — delete. On confirm: invalidate.
  5. `PUT /exams/:id/publish` — publish. Guard: all subjects must have `marksStatus === 'ENTERED'`. On `409 MARKS_NOT_COMPLETE`: show inline error listing `error.details.pendingSubjects`. Confirm dialog: "This will compute grades and notify all students and guardians." On success: invalidate, toast "Exam published."
  6. `PUT /exams/:id/unpublish` — warning dialog: "Marks will be unlocked for correction." On success: invalidate, toast "Exam unpublished."
  7. `DELETE /exams/:id` — only when `status === 'DRAFT'`, confirm dialog.
- Local state: add/edit subject drawer open state.
- Server state: TQ key `['exams', id]`.
- Permissions: Admin only. Publish button hidden when any subject `marksStatus !== 'ENTERED'`. Delete button hidden when `status !== 'DRAFT'`. Unpublish button hidden when `status !== 'PUBLISHED'`.
- Accessibility: `marksStatus` badges have text. Publish confirm dialog traps focus.
- Performance notes: None.

---

**Screen:** Marks Entry Sheet (`/teacher/exams/:id/marks/:subjectId`)
- Goal: Allow assigned Teacher to enter marks per student for their subject.
- Entry points: Teacher assigned exams list → subject row.
- Required API calls:
  1. `GET /exams/:id` — load exam detail (grade boundaries, total marks, pass marks).
  2. `GET /exams/:id/results` filtered to `subjectId` — load existing marks if any.
  3. `PUT /exams/:id/marks` (or subject-level marks endpoint per OpenAPI) — save draft or submit. On success: invalidate, toast.
- Local state: per-student `marksObtained` (number | null), `isAbsent` (boolean), `remarks`. `isAbsent === true` disables marks input.
- Validation: `marksObtained ≤ totalMarks` enforced client-side on blur; zod schema. Server enforces as final guard.
- Locked when `exam.status === 'PUBLISHED'` — all inputs read-only, no submit button.
- Server state: TQ keys `['exams', id]`, `['exams', id, 'results']`.
- Loading state: Skeleton rows.
- Empty state: n/a (exam always has students).
- Permissions: Teacher only. Teacher must be assigned to this `subjectId` in the exam — server enforces; frontend hides route if not in assigned subjects list.
- Accessibility: Each marks input has `aria-label="Marks for [student name]"`. Absent checkbox has `aria-label="Mark [student name] as absent"`.
- Performance notes: Up to 50 students. Virtualization not required at this scale.

---

**Screen:** Consolidated Results (`/admin/exams/:id/results`)
- Goal: Show Admin and Class Teacher a per-student, per-subject results grid with grades, rank, and PASS/FAIL.
- Entry points: Exam detail page → "View Results" button (shown when `status === 'PUBLISHED'`).
- Required API calls:
  1. `GET /exams/:id/results` on mount.
- Server state: TQ key `['exams', id, 'results']`.
- Loading state: Skeleton table.
- Empty state: "Results not published yet." (guard: only reachable when PUBLISHED).
- Grade computation: Frontend NEVER re-computes grades. Only displays `overallGrade`, `aggregatePercentage`, `classRank` from API response.
- Report cards: "Download All Report Cards" → `GET /exams/:id/report-cards`. Triggers file download (`Content-Disposition: attachment`). Loading state: spinner + "Generating report cards…" message (may take 10–30s for large classes — no timeout on frontend, no polling required).
- Permissions: Admin (any class), `isClassTeacher` (own class only).
- Accessibility: PASS/FAIL badge has `role="status"`.
- Performance notes: 50 students × 10 subjects = 500 cells. `@tanstack/react-virtual` column virtualization required.

---

**Screen:** Student / Guardian Results View
- Goal: Show PUBLISHED exam results and report card download for own/child's exams.
- Routes: `/student/results`, `/guardian/results`
- Required API calls:
  1. Student: `GET /exams?sessionId=currentSession.id` (server filters to own class, published only).
  2. Guardian: `GET /guardian/children/:studentId/results?sessionId=currentSession.id`.
  3. Report card: `GET /exams/:id/report-card/:studentId` — PDF blob download.
- Server state: TQ keys `['exams', filters]`, `['guardian', studentId, 'results', sessionId]`.
- Permissions: Student sees own exams only. Guardian sees selected child's exams only. Neither can see unpublished exams — server enforces.
- Performance notes: None.

---

**Screen:** Fee Charge List (`/admin/fees`)
- Goal: List all fee charges with balances; record payments; delete zero-balance charges.
- Entry points: Admin sidebar → Fees → Charges.
- Required API calls:
  1. `GET /fees/charges?sessionId=currentSession.id` with optional filters: `studentId`, `classId`, `hasBalance=true`.
  2. `POST /fees/charges/:id/payments` — record payment modal. On `400 OVERPAYMENT`: inline error in modal: "Payment exceeds balance of ₹[balance]." Client-side pre-validation: `amount ≤ charge.balance` using zod `.max(charge.balance)`. On success: invalidate `['fees', 'charges', ...]`, close modal, toast "Payment recorded."
  3. `DELETE /fees/charges/:id` — only when `totalPaid === 0`. On `400 CHARGE_HAS_PAYMENTS`: toast "Cannot delete — charge has recorded payments." On success: invalidate.
- Local state: payment modal open state, selected charge for modal, filter values.
- Server state: TQ key `['fees', 'charges', filters]`.
- Loading state: Skeleton rows.
- Empty state: "No charges for this session."
- Balance highlight: `balance > 0 && dueDate < today` → red text on balance cell.
- Delete button: hidden when `totalPaid > 0`.
- Permissions: Admin only for write. `isClassTeacher` and Student/Guardian see read-only views on their respective routes.
- Accessibility: Payment modal traps focus. Amount input `aria-label="Payment amount (max ₹[balance])"`.
- Performance notes: Default server page size 50. Paginated.

---

**Screen:** Bulk Charge Wizard (`/admin/fees/bulk`)
- Goal: Raise the same charge for a group of students in 2 steps: configure → preview count → confirm.
- Entry points: Admin fees page → "Bulk Charge" button.
- Required API calls:
  1. `POST /fees/charges/bulk` with `{ targetType, studentIds/classId/level, sessionId, description, category, amount, dueDate }`. On success: show count toast "X students charged. Y skipped (duplicate)." Navigate to `/admin/fees`.
- Local state: `targetType` picker, target selection, form fields.
- Validation: `targetType` required. For `students`: at least 1 studentId. `amount` > 0. `category` required.
- Permissions: Admin only.
- Accessibility: Target type radio group with associated descriptions.
- Performance notes: None.

---

**Screen:** Outstanding Fees Summary (`/admin/fees/summary`)
- Goal: Show Admin and Class Teacher aggregate outstanding fees with per-student breakdown.
- Entry points: Admin sidebar → Fees → Summary.
- Required API calls:
  1. `GET /fees/summary?sessionId=currentSession.id&classId=optional`.
- Server state: TQ key `['fees', 'summary', filters]`.
- Loading state: Summary card skeletons.
- Empty state: "No outstanding fees."
- Sort: per-student breakdown table sortable by `balance` descending by default.
- Permissions: Admin (all classes), `isClassTeacher` (own class).
- Performance notes: None.

---

**Screen:** Student / Guardian Fee View
- Goal: Read-only fee charges and payment history for own/child's account.
- Routes: `/student/fees`, `/guardian/fees`
- Required API calls:
  1. Student: `GET /fees/charges?studentId=jwtPayload.studentId&sessionId=currentSession.id`.
  2. Guardian: `GET /guardian/children/:studentId/fees?sessionId=currentSession.id`.
- Expandable payment history per charge row.
- Total outstanding prominently displayed in a banner if `balance > 0`.
- Permissions: Student sees own only. Guardian sees selected child only.
- Performance notes: None.

---

**Screen:** Assignment List + Create (`/admin/assignments`, `/teacher/assignments`)
- Goal: List assignments; create new; navigate to marking sheet.
- Required API calls:
  1. `GET /assignments?classId=&sessionId=currentSession.id` with filters: `subjectId`, `status`.
  2. `POST /assignments` on create. On success: toast "Assignment created — X submission records auto-generated." Invalidate `['assignments', ...]`.
  3. `PUT /assignments/:id` — edit (before `dueDate`). Edit button hidden after `dueDate`.
  4. `DELETE /assignments/:id` — confirm. On success: invalidate.
  5. `PUT /assignments/:id/close` — closes assignment (locks marking sheet).
- Form validation: `classId` required, `subjectId` required, `title` required, `type` required, `dueDate` required (≥ today). `isGraded` toggle → shows `maxMarks` number field when true (required, > 0).
- Completion rate display: `X/Y submitted` derived from submissions list (loaded lazily on expand).
- Permissions: Admin sees all classes. Teacher sees own class+subject assignments only.
- Performance notes: None.

---

**Screen:** Marking Sheet (`/teacher/assignments` → inline or `/admin/assignments`)
- Goal: Per-student status picker + optional marks + remarks for an assignment.
- Required API calls:
  1. `GET /assignments/:id` — load assignment with `submissions[]`.
  2. `PUT /assignments/:id/submissions` with `{ submissions: [{studentId, status, marksObtained?, remark?}] }`. On success: invalidate, toast "Marking saved."
- Local state: per-student `status`, `marksObtained`, `remark`.
- Locked when `assignment.status === 'CLOSED'` — all inputs read-only.
- "Mark All Present" shortcut: sets all `status = 'COMPLETED'`.
- Validation: `marksObtained ≤ maxMarks` when `isGraded`.
- Permissions: Admin (any class), Teacher (own class+subject).
- Accessibility: `<MarkingSheet>` shared component (SP from v2.8).
- Performance notes: Up to 50 students. No virtualization needed.

---

**Screen:** Student / Guardian Assignment View
- Goal: Read-only assignment list with own/child's submission status.
- Routes: `/student/assignments`, `/guardian/assignments`
- Required API calls:
  1. Student: `GET /assignments?classId=jwtPayload.classId&sessionId=currentSession.id`.
  2. Guardian: `GET /guardian/children/:studentId/assignments?sessionId=currentSession.id`.
- Status badges: PENDING=orange, COMPLETED=green, INCOMPLETE=red, NOT_SUBMITTED=grey.
- Permissions: Read-only. No marking capability.
- Performance notes: None.

---

**Screen:** Announcement Feed (`/announcements`)
- Goal: Show all roles their relevant announcements in reverse chronological order.
- Entry points: Shared nav → Announcements for all roles.
- Required API calls:
  1. `GET /announcements?limit=20&offset=0` — infinite scroll (load more on scroll to bottom).
- Server state: TQ key `['announcements', filters]`, stale time 30s.
- Loading state: Skeleton cards.
- Empty state: "No announcements."
- Audience badge: shown on each card (All, Class, Batch, etc.).
- Read/unread: derived from `readAt` field. Unread items highlighted.
- Expired announcements: visually muted (grey).
- Link button: shown only when `linkUrl` is set.
- Permissions: Server-side audience filtering — frontend renders what it receives. All roles share this route.
- Accessibility: Infinite scroll uses `IntersectionObserver` (not `onScroll`). "Load more" button as fallback. Each announcement card has `role="article"`.
- Performance notes: Paginated server-side. No client-side virtualization required.

---

**Screen:** Create / Edit Announcement (`/announcements/new`, `/announcements/:id/edit`)
- Goal: Allow Admin and Teacher to create or edit announcements with audience targeting.
- Required API calls:
  1. `POST /announcements` on create. On success: navigate to `/announcements`, toast.
  2. `PUT /announcements/:id` on edit. On success: invalidate `['announcements']`, navigate back.
  3. `DELETE /announcements/:id` on confirm. Admin can delete any; Teacher only own.
- Form validation: `title` required. `body` required. `audienceType` required. If `audienceType === 'Class'`: `audienceClassId` required. If `audienceType === 'Batch'`: `audienceBatchId` required. `publishAt` defaults to now. `expiresAt` optional, must be > `publishAt` if set.
- Teacher constraint: `audienceType` locked to `Class`, `audienceClassId` auto-populated from JWT `classId`, picker hidden.
- Edit availability: Edit button hidden when `publishAt < now` (already published).
- Scheduled publish indicator: "Scheduled for [datetime in tenantTimezone]" badge shown when `publishAt > now`.
- Permissions: Admin and Teacher for create. Teacher can only edit/delete own announcements.
- Accessibility: Datetime pickers labelled with timezone context. Draft preview before submit is optional (not in scope — CR-FE-10 spec does not require it).
- Performance notes: None.

---

**Screen:** School Profile (`/admin/settings/profile`)
- Goal: Edit tenant branding, upload logo and principal signature, manage active levels.
- Entry points: Admin sidebar → Settings → School Profile.
- Required API calls:
  1. `GET /school-profile` on mount.
  2. `PUT /school-profile` on save. On success: invalidate `['school-profile']`, toast. Apply `brandingColor` as CSS variable `--brand-color` on the document root immediately (no full reload).
  3. `POST /school-profile/upload?type=logo` — file upload. Client-side validation: max 2MB, PNG/JPG/SVG only. On `400 FILE_TOO_LARGE`: inline error. On `400` wrong type: inline error. On success: invalidate `['school-profile']`, update preview.
  4. `POST /school-profile/upload?type=signature` — max 1MB, PNG/JPG only. Same flow as logo.
- Local state: logo preview blob URL, signature preview blob URL, `hexColorInput` (controlled), file input refs.
- Server state: TQ key `['school-profile']`.
- Loading state: Profile form skeleton.
- Active levels warning: If a level is unchecked while active classes exist at that level (derived from `GET /classes` list), show inline warning: "Deactivating [level] will hide it from all pickers. Existing classes are unaffected."
- Branding color: Live preview on sidebar/header using CSS variable update.
- Permissions: Admin only.
- Accessibility: Logo upload has `aria-label="Upload school logo"`. Signature upload has `aria-label="Upload principal signature"`. File type errors are `aria-live`.
- Performance notes: Image preview uses `URL.createObjectURL` — revoke on unmount.

---

**Screen:** Grade Config (read-only) (`/admin/settings/grade-config`)
- Goal: Display default grade boundaries. Link to per-exam override.
- Required API calls:
  1. `GET /settings/grade-config` on mount.
- Fully read-only. "Grade boundaries can be overridden per exam in Exam Settings" note shown.
- Permissions: Admin only.
- Performance notes: None.

---

**Screen:** Feature Flags (read-only) (`/admin/settings/features`)
- Goal: Display enabled/disabled feature flags. No toggle capability.
- Required API calls:
  1. `GET /admin/features` on mount.
- Fully read-only. "Feature flags are managed by SuperAdmin only" note shown.
- Permissions: Admin only.
- Performance notes: None.

---

**Screen:** CSV Import Wizard (`/admin/import`)
- Goal: 3-step wizard: upload CSV → validation result → confirm import. TTL-aware (30 min).
- Entry points: Admin sidebar → Import.
- Required API calls:
  1. Step 1 → `GET /import/template/:entity` — template CSV download link. Rendered as `<a download>` from direct URL.
  2. Step 1 (upload) → `POST /import/preview` with CSV file as `multipart/form-data`. On success: store `jobId`, `expiresAt`, `errorRows`, `validRows`, `previewData`, `errorData` in local state. Advance to Step 2. Start 30-minute TTL countdown.
  3. Step 3 (confirm) → `POST /import/:jobId/confirm`. On `400 IMPORT_HAS_ERRORS`: reset to Step 1, toast "Import has validation errors. Fix and re-upload." On `410 IMPORT_EXPIRED`: reset to Step 1, toast "Preview expired — please re-upload your CSV." On success: navigate to `/admin/import/history`, toast "X records imported successfully."
  4. Cancel → `DELETE /import/:jobId`.
- Local state: `currentStep` (1|2|3), `jobId`, `expiresAt`, `previewData`, `errorRows`, `validRows`, `errorData`, `entityType`, `sessionId`, `timeRemainingSeconds`.
- TTL countdown: `expiresAt` from Step 1 response. Client computes remaining seconds. Auto-reset to Step 1 when `timeRemainingSeconds <= 0` (before user can confirm). `aria-live="polite"` announces countdown at 10-minute and 2-minute marks.
- Step 2 — no errors: green panel, preview table (first 10 rows). "Confirm Import" active.
- Step 2 — has errors: red panel listing errors with row number + field + message. "Confirm Import" disabled. "Download Error Report" button: generates CSV from `errorData` via `papaparse` client-side. "Re-upload" link resets to Step 1 (DELETE `jobId` first).
- Permissions: Admin only.
- Accessibility: Stepper `aria-current="step"`. Error list is `role="list"`. Countdown `aria-live="polite"`.
- Performance notes: None.

---

**Screen:** Import History (`/admin/import/history`)
- Goal: Table of past import jobs with status and counts.
- Required API calls:
  1. `GET /import/history` on mount.
- Server state: TQ key `['import', 'history']`.
- Loading / empty state: Skeleton rows; "No imports yet."
- Permissions: Admin only.
- Performance notes: None.

---

**Screen:** Notification Bell + Full Notification Page (`/notifications`)
- Goal: In-app notification centre accessible from global nav for all roles.
- Entry points: Bell icon in top nav (all roles). `/notifications` full page link.
- Required API calls:
  1. Bell dropdown: `GET /notifications?limit=20` on dropdown open.
  2. Unread count badge: `GET /notifications?unreadOnly=true&limit=1` polled every 60 seconds.
  3. Single read: `PUT /notifications/:id/read` on notification click. On success: invalidate unread count key.
  4. Mark all read: `PUT /notifications/read-all`. On success: invalidate notifications key.
  5. Full page: `GET /notifications?limit=20&offset=0` with infinite scroll.
- Server state: TQ keys `['notifications', filters]`, `['notifications', 'unread-count']`. Unread count: `refetchInterval: 60000`.
- Navigation routing on click (locked map):

| NotificationType | Navigate To |
|-----------------|-------------|
| LEAVE_SUBMITTED | `/teacher/leave` or `/admin/leave` |
| LEAVE_APPROVED | `/guardian/leave` |
| LEAVE_REJECTED | `/guardian/leave` |
| STUDENT_DEPARTED | `/teacher/leave` or `/admin/leave` |
| STUDENT_RETURNED | `/teacher/leave` or `/admin/leave` |
| LEAVE_OVERDUE | `/teacher/leave` or `/admin/leave` |
| ABSENCE_ALERT | `/admin/attendance/daily` |
| EXAM_PUBLISHED | `/student/results` or `/guardian/results` |
| ASSIGNMENT_CREATED | `/student/assignments` or `/guardian/assignments` |
| ANNOUNCEMENT | `/announcements` |
| FEE_CHARGED | `/student/fees` or `/guardian/fees` |

- Permissions: All roles except SuperAdmin.
- Accessibility: Bell icon has `aria-label="Notifications (X unread)"`. Dropdown has `role="menu"`. Each notification is `role="menuitem"`.
- Performance notes: 60-second poll for unread count only — not the full list.

---

**Screen:** Push Subscription Setup
- Goal: Request browser push permission on first login; register subscription with backend.
- Entry points: Triggered once after successful login, before main content renders, on first session only.
- Required API calls:
  1. (On permission granted) `POST /push/subscribe` with `{ endpoint, p256dh, auth, deviceLabel }`.
  2. (On logout) `DELETE /push/subscribe` with `{ endpoint }`.
- Flow: `navigator.permissions.query({ name: 'notifications' })` → if `'default'`: show in-context permission prompt banner. If `'denied'`: show dismissible banner "Enable notifications in browser settings." If `'granted'`: register immediately without prompt.
- VAPID public key: `import.meta.env.VITE_VAPID_PUBLIC_KEY` used in `PushManager.subscribe({ applicationServerKey })`.
- Failure handling: If `POST /push/subscribe` fails (network or 401): non-blocking — log to Sentry, continue. User is not notified of push registration failure.
- Service worker push click: `self.addEventListener('push', ...)` in `sw.ts`. On notification click: `clients.openWindow(routeFromData)` using `notification.data` field. If app window is closed, user re-authenticates on next open (sessionStorage is cleared when PWA window closes).
- iOS note: Push notifications require iOS 16.4+. Older iOS: in-app bell functions normally; push subscription is not attempted (`'serviceWorker' in navigator` check).
- Permissions: All roles.
- Performance notes: None. Push subscription is fire-and-forget, does not block page render.

---

**Screen:** Guardian Dashboard (`/guardian/dashboard`)
- Goal: Child switcher landing with summary cards for attendance, pending leave, and assignments.
- Entry points: Post-login for Guardian role.
- Required API calls:
  1. `GET /guardian/children` — populate child switcher. Store `selectedChildId` in `useGuardianStore`.
  2. `GET /guardian/children/:studentId/attendance?month=currentMonth` — summary card.
  3. `GET /guardian/children/:studentId/leave?status=PENDING` — pending count.
  4. `GET /guardian/children/:studentId/assignments` — pending assignments count.
- Server state: TQ keys `['guardian', 'children']`, `['guardian', studentId, 'attendance', month]`, etc.
- Child switcher: shown in top nav when `linkedStudentIds.length > 1`. `selectedChildId` persists in `useGuardianStore` (Zustand, not sessionStorage) for the session duration.
- Loading state: Skeleton summary cards.
- Empty state: (Unlikely — Guardian always has at least 1 child linked.) "No linked students."
- Permissions: Guardian role. All `/guardian/children/:studentId/*` calls validated server-side — `403` on unlinked child (URL manipulation). Frontend handles `403` with toast "Access denied" + redirect to `/guardian/dashboard`.
- Accessibility: Child switcher is an accessible `<Select>` with `aria-label="Select child"`.
- Performance notes: None.

---

**Screen:** Guardian Attendance Calendar (`/guardian/attendance`)
- Goal: Per-day colour-coded attendance calendar for the selected month, with summary cards.
- Required API calls:
  1. `GET /guardian/children/:studentId/attendance?month=YYYY-MM`.
- Calendar rendering: DOM calendar grid (7 columns × ~5 rows). Days present in `records[]` are colour-coded using dominant-status logic: `Absent (red) > Late (yellow) > Excused (blue) > Present (green)`. Days absent from `records[]` are grey.
- Month picker: defaults to current month. On change: refetch with new `month` param.
- Summary cards: `presentDays`, `absentDays`, `lateDays`, `excusedDays`, `attendancePercentage`, `consecutiveAbsentStreak` (shown prominently if > 0).
- Server state: TQ key `['guardian', studentId, 'attendance', month]`.
- Loading state: Calendar skeleton.
- Empty state: `records: []` → all days grey, summary cards show 0.
- Permissions: Guardian. `selectedChildId` from `useGuardianStore`.
- Accessibility: Each calendar cell has `aria-label="[date]: [dominant status]"`. Colour is supplemental — status text rendered in cell.
- Performance notes: None.

---

**Screen:** Student Dashboard (`/student/dashboard`)
- Goal: Show Student today's periods, current attendance %, pending assignments, latest announcement.
- Required API calls:
  1. `GET /timetable?classId=jwtPayload.classId&sessionId=currentSession.id` — today's periods.
  2. `GET /attendance/monthly-sheet?classId=jwtPayload.classId&month=currentMonth` — server filters to own row.
  3. `GET /assignments?classId=jwtPayload.classId&sessionId=currentSession.id` — pending count.
  4. `GET /announcements?limit=1` — latest card.
- Server state: Respective TQ keys.
- Loading state: Card skeletons.
- Permissions: Student role. Read-only throughout.
- Accessibility: Standard.
- Performance notes: None.

---

**Screen:** Student Attendance View (`/student/attendance`)
- Goal: Monthly attendance sheet for the authenticated student (own row only).
- Required API calls:
  1. `GET /attendance/monthly-sheet?classId=jwtPayload.classId&month=YYYY-MM` — server filters to own row.
- Displays: calendar-style month view with status per day. Summary: attendance %, consecutive absent streak (shown prominently if > 0).
- Server state: TQ key `['attendance', 'monthly-sheet', classId, month]`.
- Permissions: Student. Own data only — enforced server-side.
- Performance notes: None.

---

## 3. API Assumptions (Frontend contract expectations)

**Base URL:** `import.meta.env.VITE_API_BASE_URL` (e.g., `https://api.school.example.com/api/v1`)
**Auth:** Bearer JWT in `Authorization: Bearer <token>` header on all protected endpoints.
**Axios interceptor (locked pattern):**

```typescript
// src/api/client.ts
axiosInstance.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosInstance.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;
    if (status === 401) {
      if (code === 'TOKEN_REVOKED') {
        useAuthStore.getState().logout();
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);
```

**Global error shape expected (locked from OpenAPI v5.0.2):**

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  },
  "requestId": "string (UUID)",
  "timestamp": "ISO8601"
}
```

**Typed API surface (MVP — complete, generated from openapi.yaml v5.0.2):**

```typescript
// src/types/api.ts — generated via openapi-typescript, do NOT edit manually

// ─── Enums ────────────────────────────────────────────────────────
type UserRole = 'SuperAdmin' | 'Admin' | 'Teacher' | 'Student' | 'Guardian';
type StudentLevel = 'Std8' | 'Std9' | 'Std10' | 'PlusOne' | 'PlusTwo' | 'Degree1' | 'Degree2' | 'Degree3' | 'PG1' | 'PG2';
type SessionStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';
type LeaveStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'ACTIVE' | 'COMPLETED' | 'OVERDUE';
type LeaveType = 'HomeVisit' | 'Medical' | 'Emergency' | 'ExternalExam' | 'OfficialDuty' | 'Personal';
type DurationType = 'HalfDayAM' | 'HalfDayPM' | 'FullDay' | 'MultiDay';
type ExamType = 'TermExam' | 'PeriodicTest';
type ExamStatus = 'DRAFT' | 'SCHEDULED' | 'ONGOING' | 'MARKS_PENDING' | 'UNDER_REVIEW' | 'PUBLISHED' | 'UNPUBLISHED';
type MarksStatus = 'PENDING' | 'ENTERED' | 'LOCKED';
type FeeCategory = 'BoardExamFee' | 'UniversityExamFee' | 'InternalExamFee' | 'Books' | 'Other';
type PaymentMode = 'Cash' | 'SelfPaid';
type AudienceType = 'All' | 'Class' | 'Batch' | 'StudentsOnly' | 'TeachersOnly' | 'GuardiansOnly';
type AssignmentType = 'Written' | 'Memorization' | 'Reading' | 'ProblemSet' | 'Project' | 'Revision';
type AssignmentStatus = 'ACTIVE' | 'CLOSED';
type SubmissionStatus = 'PENDING' | 'COMPLETED' | 'INCOMPLETE' | 'NOT_SUBMITTED';
type ImportEntityType = 'Student' | 'User';
type NotificationType =
  | 'LEAVE_SUBMITTED' | 'LEAVE_APPROVED' | 'LEAVE_REJECTED'
  | 'STUDENT_DEPARTED' | 'STUDENT_RETURNED' | 'LEAVE_OVERDUE'
  | 'ABSENCE_ALERT' | 'EXAM_PUBLISHED' | 'ASSIGNMENT_CREATED'
  | 'ANNOUNCEMENT' | 'FEE_CHARGED';

// ─── JWT Payload (decoded from token at login — never re-fetched) ──
interface JWTPayload {
  userId: string;
  tenantId: string;
  activeRole: UserRole;
  tokenVersion: number;
  mustChangePassword: boolean;
  tenantTimezone: string;        // IANA e.g. "Asia/Kolkata"
  classTeacherOf: string | null; // classId; null if not a class teacher
  studentId: string | null;      // Student role only
  classId: string | null;        // Student role only
  batchId: string | null;        // Student role only
  linkedStudentIds: string[];    // Guardian role only
}

// ─── isClassTeacher derived guard (locked) ─────────────────────────
// const isClassTeacher = user.activeRole === 'Teacher' && user.classTeacherOf !== null;

// ─── Shared API wrapper ────────────────────────────────────────────
type ApiResult<T> = { data: T; meta?: Record<string, unknown> };

// ─── Auth ──────────────────────────────────────────────────────────
interface LoginRequest { email: string; password: string; tenantId: string; }
interface LoginResponse { token: string; user: { id: string; name: string; role: UserRole; mustChangePassword: boolean; }; }
interface ChangePasswordRequest { currentPassword: string; newPassword: string; }
interface ChangePasswordResponse { token: string; }

// ─── Academic Sessions ────────────────────────────────────────────
interface AcademicSession { id: string; tenantId: string; name: string; startDate: string; endDate: string; isCurrent: boolean; status: SessionStatus; createdAt: string; }
interface CreateSessionRequest { name: string; startDate: string; endDate: string; }
interface TransitionPreviewRequest { targetSessionId: string; }
interface TransitionPreviewResponse { promotionPreviewId: string; expiresAt: string; batches: BatchPromotionPreview[]; }
interface BatchPromotionPreview { batchId: string; batchName: string; currentLevel: StudentLevel; nextLevel: StudentLevel; students: StudentPromotionPreview[]; }
interface StudentPromotionPreview { studentId: string; name: string; admissionNumber: string; include: boolean; }
interface TransitionCommitRequest { promotionPreviewId: string; batches: { batchId: string; studentIds: string[]; }[]; }

// ─── Batches ──────────────────────────────────────────────────────
interface Batch { id: string; tenantId: string; name: string; startYear: number; endYear: number; entryLevel: StudentLevel; entrySessionId: string; status: 'Active' | 'Graduated'; }
interface CreateBatchRequest { name: string; entryLevel: StudentLevel; entrySessionId: string; startYear: number; endYear: number; }

// ─── Classes ──────────────────────────────────────────────────────
interface Class { id: string; tenantId: string; batchId: string; sessionId: string; level: StudentLevel; section: string | null; name: string; classTeacherId: string | null; }
interface CreateClassRequest { batchId: string; sessionId: string; level: StudentLevel; section?: string; name: string; }

// ─── Students ────────────────────────────────────────────────────
interface Student { id: string; tenantId: string; userId: string; batchId: string; classId: string; admissionNumber: string; name: string; gender: 'Male' | 'Female'; dateOfBirth: string; phone: string; status: 'Active' | 'DroppedOff' | 'Graduated'; enrolledAt: string; droppedAt: string | null; }
interface CreateStudentRequest { name: string; gender: 'Male' | 'Female'; dateOfBirth: string; phone: string; admissionNumber: string; classId: string; batchId: string; enrolledAt: string; }

// ─── Guardians ───────────────────────────────────────────────────
interface Guardian { id: string; tenantId: string; name: string; phone: string; email: string | null; relationship: string; isPrimary: boolean; canSubmitLeave: boolean; }
interface CreateGuardianRequest { studentId: string; name: string; phone: string; email?: string; relationship: string; isPrimary: boolean; canSubmitLeave: boolean; createUserAccount: boolean; }
interface CreateGuardianResponse { guardian: Guardian; temporaryPassword?: string; }

// ─── Timetable ───────────────────────────────────────────────────
interface Timeslot { id: string; classId: string; dayOfWeek: number; periodNumber: number; startTime: string; endTime: string; subjectId: string; subjectName: string; teacherId: string; teacherName: string; }
interface CreateTimeslotRequest { classId: string; dayOfWeek: number; periodNumber: number; startTime: string; endTime: string; subjectId: string; teacherId: string; }

// ─── Attendance ──────────────────────────────────────────────────
interface AttendanceRecord { id: string; timeslotId: string; studentId: string; studentName: string; classId: string; date: string; status: AttendanceStatus; updatedBy: string | null; updatedAt: string | null; }
interface RecordClassAttendanceRequest { timeslotId: string; date: string; students: { studentId: string; status: AttendanceStatus; }[]; }
interface UpdateAttendanceRequest { status: AttendanceStatus; }
interface MonthlySheetResponse { month: string; classId: string; workingDays: number; students: MonthlySheetStudent[]; }
interface MonthlySheetStudent { studentId: string; studentName: string; presentDays: number; absentDays: number; lateDays: number; excusedDays: number; attendancePercentage: number; }

// ─── Leave ───────────────────────────────────────────────────────
interface LeaveRequest { id: string; tenantId: string; sessionId: string; studentId: string; studentName: string; requestedByUserId: string; requestedByRole: string; leaveType: LeaveType; durationType: DurationType; startDate: string; endDate: string; reason: string; attachmentUrl: string | null; status: LeaveStatus; reviewedBy: string | null; reviewedAt: string | null; rejectionReason: string | null; departedAt: string | null; expectedReturnAt: string; returnedAt: string | null; createdAt: string; }
interface SubmitLeaveRequest { studentId: string; leaveType: LeaveType; durationType: DurationType; startDate: string; endDate: string; reason: string; expectedReturnAt?: string; }
interface RejectLeaveRequest { rejectionReason: string; }

// ─── Exams ───────────────────────────────────────────────────────
interface GradeBoundary { grade: string; minPercentage: number; maxPercentage: number; label: string; }
interface Exam { id: string; tenantId: string; sessionId: string; classId: string; name: string; type: ExamType; status: ExamStatus; gradeBoundaries: GradeBoundary[]; publishedBy: string | null; publishedAt: string | null; createdAt: string; }
interface ExamSubject { id: string; examId: string; subjectId: string; subjectName: string; teacherId: string; teacherName: string; examDate: string | null; startTime: string | null; endTime: string | null; totalMarks: number; passMarks: number; marksStatus: MarksStatus; }
interface ExamResult { examSubjectId: string; studentId: string; studentName: string; marksObtained: number | null; isAbsent: boolean; grade: string | null; isPass: boolean | null; }
interface ExamStudentSummary { studentId: string; studentName: string; totalMarksObtained: number; totalMarksPossible: number; aggregatePercentage: number; overallGrade: string; overallResult: 'PASS' | 'FAIL'; classRank: number | null; }

// ─── Fees ────────────────────────────────────────────────────────
interface FeeCharge { id: string; tenantId: string; studentId: string; studentName: string; sessionId: string; description: string; category: FeeCategory; amount: number; dueDate: string | null; totalPaid: number; balance: number; notes: string | null; createdAt: string; }
interface FeePayment { id: string; chargeId: string; studentId: string; amountPaid: number; paymentMode: PaymentMode; paidAt: string; receiptNumber: string | null; recordedBy: string; notes: string | null; recordedAt: string; }
interface CreateChargeRequest { studentId: string; sessionId: string; description: string; category: FeeCategory; amount: number; dueDate?: string; notes?: string; }
interface BulkChargeRequest { targetType: 'students' | 'class' | 'level'; studentIds?: string[]; classId?: string; level?: StudentLevel; sessionId: string; description: string; category: FeeCategory; amount: number; dueDate?: string; }
interface RecordPaymentRequest { amount: number; paymentMode: PaymentMode; paidAt: string; receiptNumber?: string; notes?: string; }
interface FeeSummary { totalCharged: number; totalPaid: number; totalOutstanding: number; studentsWithBalance: number; students: FeeStudentSummary[]; }
interface FeeStudentSummary { studentId: string; studentName: string; totalCharged: number; totalPaid: number; balance: number; }

// ─── Assignments ─────────────────────────────────────────────────
interface Assignment { id: string; tenantId: string; sessionId: string; classId: string; subjectId: string; subjectName: string; createdBy: string; title: string; description: string | null; type: AssignmentType; dueDate: string; isGraded: boolean; maxMarks: number | null; status: AssignmentStatus; createdAt: string; }
interface CreateAssignmentRequest { classId: string; subjectId: string; title: string; description?: string; type: AssignmentType; dueDate: string; isGraded: boolean; maxMarks?: number; sessionId: string; }
interface AssignmentSubmission { id: string; assignmentId: string; studentId: string; studentName: string; status: SubmissionStatus; marksObtained: number | null; remark: string | null; markedBy: string | null; markedAt: string | null; }
interface BulkUpdateSubmissionsRequest { submissions: { studentId: string; status: SubmissionStatus; marksObtained?: number; remark?: string; }[]; }

// ─── Announcements ───────────────────────────────────────────────
interface Announcement { id: string; tenantId: string; sessionId: string; title: string; body: string; linkUrl: string | null; linkLabel: string | null; audienceType: AudienceType; audienceClassId: string | null; audienceBatchId: string | null; createdByRole: string; publishAt: string; expiresAt: string | null; createdAt: string; readAt: string | null; }
interface CreateAnnouncementRequest { title: string; body: string; audienceType: AudienceType; audienceClassId?: string; audienceBatchId?: string; linkUrl?: string; linkLabel?: string; publishAt?: string; expiresAt?: string; }

// ─── Import ──────────────────────────────────────────────────────
interface ImportJob { id: string; entityType: ImportEntityType; status: 'PREVIEW' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'FAILED'; totalRows: number; validRows: number; errorRows: number; previewData: Record<string, unknown>[] | null; errorData: Record<string, unknown>[] | null; importedRows: number | null; expiresAt: string; createdAt: string; }
interface ImportPreviewResponse { jobId: string; entityType: ImportEntityType; totalRows: number; validRows: number; errorRows: number; previewData: Record<string, unknown>[] | null; errors: { row: number; field: string; code: string; message: string; }[] | null; expiresAt: string; }

// ─── Notifications ───────────────────────────────────────────────
interface Notification { id: string; type: NotificationType; title: string; body: string; data: Record<string, unknown> | null; readAt: string | null; createdAt: string; }

// ─── School Profile ──────────────────────────────────────────────
interface SchoolProfile { id: string; name: string; subdomain: string; timezone: string; logoUrl: string | null; address: string | null; phone: string | null; email: string | null; website: string | null; brandingColor: string | null; principalName: string | null; principalSignatureUrl: string | null; activeLevels: StudentLevel[]; }
interface UpdateProfileRequest { name?: string; address?: string; phone?: string; email?: string; website?: string; brandingColor?: string; principalName?: string; activeLevels?: StudentLevel[]; }

// ─── Guardian Portal ─────────────────────────────────────────────
interface GuardianChild { studentId: string; name: string; admissionNumber: string; className: string; level: StudentLevel; status: string; }
interface GuardianAttendanceResponse { attendancePercentage: number; consecutiveAbsentStreak: number; presentDays: number; lateDays: number; absentDays: number; excusedDays: number; month: string; records: { date: string; statuses: AttendanceStatus[]; }[]; }
```

**Caching & invalidation rules (LOCKED):**

```typescript
// src/lib/queryKeys.ts — locked query key factory
export const QK = {
  sessions:                 ()                              => ['sessions']                              as const,
  session:                  (id: string)                   => ['sessions', id]                          as const,
  currentSession:           ()                              => ['sessions', 'current']                   as const,
  batches:                  ()                              => ['batches']                               as const,
  classes:                  (sessionId: string)            => ['classes', sessionId]                    as const,
  students:                 (f?: object)                   => ['students', f]                           as const,
  student:                  (id: string)                   => ['students', id]                          as const,
  studentGuardians:         (id: string)                   => ['students', id, 'guardians']             as const,
  timetable:                (cId: string, sId: string)     => ['timetable', cId, sId]                   as const,
  teacherTimetable:         ()                              => ['timetable', 'teacher']                  as const,
  attendanceDailySummary:   (cId: string, date: string)    => ['attendance', 'daily-summary', cId, date] as const,
  attendanceAbsentees:      (tId: string, date: string)    => ['attendance', 'absentees', tId, date]    as const,
  attendanceMonthlySheet:   (cId: string, month: string)   => ['attendance', 'monthly-sheet', cId, month] as const,
  leave:                    (f?: object)                   => ['leave', f]                              as const,
  leaveDetail:              (id: string)                   => ['leave', id]                             as const,
  leaveOnCampus:            ()                              => ['leave', 'on-campus']                   as const,
  exams:                    (f?: object)                   => ['exams', f]                              as const,
  exam:                     (id: string)                   => ['exams', id]                             as const,
  examResults:              (id: string)                   => ['exams', id, 'results']                  as const,
  feeCharges:               (f?: object)                   => ['fees', 'charges', f]                   as const,
  feeSummary:               (f?: object)                   => ['fees', 'summary', f]                   as const,
  assignments:              (f?: object)                   => ['assignments', f]                        as const,
  assignment:               (id: string)                   => ['assignments', id]                       as const,
  announcements:            (f?: object)                   => ['announcements', f]                      as const,
  importHistory:            ()                              => ['import', 'history']                    as const,
  notifications:            (f?: object)                   => ['notifications', f]                      as const,
  notificationsUnreadCount: ()                              => ['notifications', 'unread-count']         as const,
  schoolProfile:            ()                              => ['school-profile']                       as const,
  gradeConfig:              ()                              => ['settings', 'grade-config']             as const,
  features:                 ()                              => ['settings', 'features']                 as const,
  guardianChildren:         ()                              => ['guardian', 'children']                 as const,
  guardianAttendance:       (sId: string, m: string)       => ['guardian', sId, 'attendance', m]        as const,
  guardianResults:          (sId: string, ssnId?: string)  => ['guardian', sId, 'results', ssnId]       as const,
  guardianFees:             (sId: string, ssnId?: string)  => ['guardian', sId, 'fees', ssnId]          as const,
  guardianAssignments:      (sId: string, ssnId?: string)  => ['guardian', sId, 'assignments', ssnId]   as const,
  guardianLeave:            (sId: string, f?: object)      => ['guardian', sId, 'leave', f]             as const,
  guardianTimetable:        (sId: string)                  => ['guardian', sId, 'timetable']            as const,
} as const;
```

**Stale times (LOCKED):**

| Data Category | staleTime |
|--------------|-----------|
| Current session | 300,000ms (5 min) |
| Timetable | 300,000ms (5 min) — matches `Cache-Control: private, max-age=300` |
| Attendance daily summary | 60,000ms |
| Attendance monthly sheet | 120,000ms |
| Leave list | 30,000ms |
| Leave on-campus | 30,000ms (polled) |
| School profile | 600,000ms (10 min) |
| Grade config, features | 600,000ms (10 min) |
| Students, batches, classes | 60,000ms |
| Exams, results | 60,000ms |
| Fees | 30,000ms |
| Assignments | 60,000ms |
| Announcements | 30,000ms |
| Notifications unread count | 60,000ms (polled) |
| Guardian portal data | 60,000ms |

**Refetch triggers (LOCKED):**

- `refetchOnWindowFocus: false` globally (QC2 from v2.0).
- `refetchOnMount: true` globally.
- Leave on-campus: `refetchInterval: 30_000`.
- Notifications unread count: `refetchInterval: 60_000`.
- Admin/Teacher dashboard grid: `refetchInterval: 300_000` + manual ↻ button.
- All others: no automatic polling.

**Mutation invalidations (LOCKED):**

| Mutation | Invalidates |
|----------|------------|
| Create/update/delete session | `QK.sessions()` |
| Activate/close session | `QK.sessions()`, `QK.currentSession()` |
| Batch promotion commit | `QK.sessions()`, `QK.students()` |
| Create/update/delete batch | `QK.batches()` |
| Create/update/delete class | `QK.classes(sessionId)` |
| Create/update student | `QK.students()`, `QK.student(id)` |
| Create/update/delete guardian | `QK.studentGuardians(studentId)` |
| Create/delete timetable slot | `QK.timetable(classId, sessionId)` |
| Record / update attendance | `QK.attendanceDailySummary(...)`, `QK.attendanceMonthlySheet(...)` |
| Leave mutations (all) | `QK.leave(...)`, `QK.leaveDetail(id)`, `QK.leaveOnCampus()` |
| Create/update exam | `QK.exams(...)`, `QK.exam(id)` |
| Publish/unpublish exam | `QK.exam(id)`, `QK.examResults(id)` |
| Save marks | `QK.examResults(id)` |
| Create/delete fee charge | `QK.feeCharges(...)`, `QK.feeSummary(...)` |
| Record payment | `QK.feeCharges(...)` |
| Create/update/delete assignment | `QK.assignments(...)`, `QK.assignment(id)` |
| Save marking sheet | `QK.assignment(id)` |
| Create/update/delete announcement | `QK.announcements(...)` |
| Confirm import | `QK.importHistory()` |
| Mark notification read | `QK.notifications(...)`, `QK.notificationsUnreadCount()` |
| Update school profile | `QK.schoolProfile()` |
| Upload logo/signature | `QK.schoolProfile()` |

**Optimistic updates:** None. All mutations wait for server confirmation before updating UI. Exception: notification read state (mark as read) may optimistically flip `readAt` for perceived responsiveness.

**Retry rules (LOCKED):**

- Default TanStack Query retry: 1 retry for GET queries on network errors only.
- No retry on 4xx responses (client errors are final).
- No retry on POST mutations (non-idempotent writes).
- Exception: `GET /notifications?unreadOnly=true` (polling) retries up to 3 times silently.

---

## 4. State Management & Data Flow (LOCKED)

**State boundaries:**

| State Type | Owner | Notes |
|-----------|-------|-------|
| Server state | TanStack Query v5 | All API data — no duplication in Zustand |
| Auth state | Zustand `useAuthStore` | Token + decoded JWT payload |
| Current session | Zustand `useSessionStore` | `currentSession` fetched on app boot, shared globally |
| Guardian selected child | Zustand `useGuardianStore` | `selectedChildId` — in-memory, cleared on logout |
| Promotion wizard state | Local `useState` | `currentStep`, `promotionPreviewId`, `expiresAt`, `batches` |
| Import wizard state | Local `useState` | `currentStep`, `jobId`, `expiresAt`, etc. |
| Form state | react-hook-form | Per form component |
| UI state (modals, drawers, pickers) | Local `useState` | Per component |
| Persistent auth token | `sessionStorage['auth_token']` | Survives tab refresh; cleared on tab close |

**Auth store implementation (locked pattern):**

```typescript
// src/stores/auth.store.ts
const TOKEN_KEY = 'auth_token';

const useAuthStore = create<AuthState>((set) => ({
  token: sessionStorage.getItem(TOKEN_KEY),
  user: decodeTokenOrNull(sessionStorage.getItem(TOKEN_KEY)),
  login: (token: string) => {
    sessionStorage.setItem(TOKEN_KEY, token);
    set({ token, user: decodeToken(token) });
  },
  logout: () => {
    sessionStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null });
  },
}));
```

- `decodeToken` uses `jwt-decode` (lightweight, no validation — backend validates). 
- Axios interceptor reads `token` from `useAuthStore.getState().token` (not from `sessionStorage` directly) to avoid redundant reads per request.
- On app mount: if `sessionStorage.getItem('auth_token')` is non-null, store is hydrated automatically (see initial state above). No explicit "restore session" step needed.

**Session store (locked pattern):**

```typescript
// src/stores/session.store.ts
const useSessionStore = create<SessionState>((set) => ({
  currentSession: null,
  setCurrentSession: (s: AcademicSession | null) => set({ currentSession: s }),
}));
```

`currentSession` is populated by `GET /academic-sessions/current` on app boot (after successful auth). Used as the default `sessionId` throughout the app. User can override `sessionId` on screens that offer a session picker (e.g., monthly sheet, results).

**Guardian store (locked pattern):**

```typescript
// src/stores/guardian.store.ts
const useGuardianStore = create<GuardianState>((set) => ({
  selectedChildId: null,
  children: [],
  setSelectedChild: (id: string) => set({ selectedChildId: id }),
  setChildren: (children: GuardianChild[]) => set({ children, selectedChildId: children[0]?.studentId ?? null }),
}));
```

`selectedChildId` is set on Guardian dashboard mount. All guardian portal API calls use this value. Tab close clears sessionStorage (and therefore triggers re-auth on next tab open), which also clears Zustand stores.

**Cross-tab / session behaviour:**

| Scenario | Behaviour |
|----------|-----------|
| Page reload (same tab) | Session survives — `sessionStorage` persists through reload |
| Tab close + reopen | Session cleared — user must re-authenticate |
| New tab from link | New independent session — must re-authenticate |
| PWA window close | Session cleared — next open requires re-auth |
| Token expiry (30 days) | Next API call returns `401 TOKEN_REVOKED` → Axios interceptor clears store + redirects to `/login` |
| `token_version` bump (admin revocation) | Same as above — `401 TOKEN_REVOKED` |
| `must_change_password` set | On next app load from sessionStorage, all protected routes redirect to `/change-password` |
| Logout | `POST /auth/logout`, `sessionStorage.removeItem('auth_token')`, Zustand `logout()`, `queryClient.clear()`, navigate to `/login` |
| Multi-tab sync | Not supported. Each tab maintains independent session. |

---

## 5. Design System & UI Constraints

**Design tokens source:** Inherited CSS custom properties from v2.8 Scofist pattern (CR-FE-017). No Figma. Tokens defined in `src/styles/globals.css`.

**Typography scale (locked — from v2.0):**
- Font: Montserrat via `@fontsource/montserrat`
- Scale: Tailwind default (`text-xs` through `text-4xl`) + custom heading sizes via CSS variables
- Body: `text-sm` (14px), line-height `leading-relaxed`

**Spacing scale (locked):** Tailwind default 4px base unit (4, 8, 12, 16, 20, 24, 32, 40, 48, 64px).

**Color system (locked):**
- CSS variables: `--background`, `--foreground`, `--primary`, `--muted`, `--accent`, `--destructive`, `--border`, `--brand-color` (tenant branding)
- Dark mode: supported via `dark:` Tailwind variants per CR-FE-028c
- Contrast: all text/background combinations ≥ 4.5:1 (AA). Dark theme: `dark:bg-green-900/40`, `dark:bg-yellow-900/30`, `dark:bg-orange-900/30` for attendance status cells.
- Status colours: Present=green, Absent=red, Late=yellow/orange, Excused=blue, Overdue=red (prominent)

**Component inventory (MVP — locked):**
Inherited from v2.8: `Button`, `Input`, `Select`, `Modal/Dialog`, `Table`, `Toast (sonner)`, `ConfirmDialog`, `RoleBadge`, `ActionBtn (SP11)`, `ErrorBoundary (SP10)`, `BottomTabBar`, `Sidebar`.

New in v3.0:
- `LeaveDetail` — status timeline (PENDING → APPROVED → ACTIVE → COMPLETED/OVERDUE) + all leave fields
- `GradeBadge` — grade string + colour band (A+=emerald, A=green, B=yellow, C=orange, F=red)
- `LeaveStatusBadge` — colour-coded by LeaveStatus
- `NotificationBell` — bell icon + unread count badge + dropdown panel
- `MarkingSheet` — shared marks entry table (used in exams + assignments)
- `ResultSummary` — aggregate %, grade, rank, PASS/FAIL badge
- `PaymentModal` — fee payment form modal
- `StepWizard` — generic 3-step wizard shell (used for promotion + import)
- `CountdownTimer` — TTL countdown display with `aria-live` announcements
- `CalendarGrid` — 7-column monthly calendar for guardian attendance view

**Responsiveness:**
- Breakpoints: Tailwind default (`sm`: 640px, `md`: 768px, `lg`: 1024px, `xl`: 1280px)
- Mobile-first: Yes
- Bottom tab bar: 4 visible tabs + More sheet (all roles) — inherited from v2.0/v2.4
- Tables: `overflow-x-auto` + `min-w-[...]` per CR-FE-022
- Monthly sheet student column: `sticky left-0 bg-background z-10 border-r` per CR-FE-022D

---

## 6. Accessibility (A11y) Baseline (LOCKED)

**Target:** WCAG 2.1 AA

**Mandatory behaviours (all inherited from v2.0, extended for v3.0 screens):**
- Keyboard navigation works for all interactive flows
- Visible focus ring on all interactive elements
- Form errors announced via `aria-live="polite"`
- Dialog focus trap + Escape key handling (all modals/dialogs)
- Colour contrast ≥ 4.5:1 for text; ≥ 3:1 for large text and UI components
- No colour-only status encoding — text label or icon + text always accompanies colour
- Skip link as first child of layout root: `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to main content</a>`
- `aria-hidden="true"` on all decorative icons
- Heading hierarchy: no skipped levels
- No `tabIndex > 0`
- `aria-live="polite"` on dynamic data containers (rankings, leave list, notification count)
- `prefers-reduced-motion` respected for transitions
- axe-core/playwright in CI: 0 violations on 5 critical screens (login, mark attendance, leave queue, exam marks entry, guardian attendance calendar)

**New A11y requirements for v3.0 screens:**
- `CountdownTimer`: announces at 10-minute and 2-minute marks via `aria-live="polite"` (import wizard + promotion wizard)
- `CalendarGrid`: each cell `aria-label="[date]: [dominant status]"` — colour supplemental only
- `NotificationBell`: `aria-label="Notifications (X unread)"` updated dynamically
- Leave status machine timeline: status steps have `aria-current="step"` on active status
- Marks entry table: each input `aria-label="Marks for [student name]"`
- Off-campus panel: new OVERDUE entries announced via `aria-live="polite"` during polling

---

## 7. Performance Budgets (LOCKED)

**Core Web Vitals targets:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| LCP | ≤ 2500ms | Lighthouse CI, Chrome 90+, mid-range Android emulation |
| INP | ≤ 200ms | Lab measurement + field data if available |
| CLS | ≤ 0.1 | Lighthouse CI |
| Initial JS bundle | ≤ 200KB gzipped | `vite-bundle-visualizer` + CI size check |
| Per-route lazy chunk | ≤ 100KB gzipped | Per-chunk size check in CI |
| API response (p95) | ≤ 300ms (Backend SLA) | Not measured by frontend CI |

**Techniques (LOCKED):**

| Technique | Applied Where |
|-----------|--------------|
| Route-level code splitting | All route components — `lazy()` + `<Suspense>` |
| Image optimization | R2-hosted assets served at optimised size; `<img loading="lazy">` on non-critical images |
| Virtualised rows | `@tanstack/react-virtual` on: attendance monthly sheet (cols > 15), student list (> 200 rows), promotion preview table, consolidated results table |
| 60s notification poll | `refetchInterval: 60_000` on unread count only |
| 30s off-campus poll | `refetchInterval: 30_000` on `QK.leaveOnCampus()` only |
| Dashboard 5-min auto-refresh | `refetchInterval: 300_000` on grid queries |
| `react-window` avoided | `@tanstack/react-virtual` used exclusively (consistent with stack) |

**CI enforcement (LOCKED):**

```bash
# vite.config.ts build.rollupOptions.output.manualChunks
# Each route group = one chunk. Chunk size > 100KB gzipped = CI fail.
# Use vite-plugin-chunk-split or manual manualChunks configuration.
```

Performance budget checked in CI on every PR via Lighthouse CI (`lhci autorun`). PR blocked if LCP > 2500ms or initial bundle > 200KB gzipped.

---

## 8. Security & Privacy (Frontend)

**Threat model assumptions:**
- Users are authenticated school staff, students, and guardians. Malicious insiders are in scope.
- XSS via injected announcement body, student name, or remark fields is the primary frontend attack surface.
- CSRF is not applicable (JWT in header, no cookies).
- Clickjacking mitigated by `X-Frame-Options: DENY` (server/CDN layer — outside frontend scope but noted as a required directive).

**Content Security Policy stance:**
CSP enforcement is at the server/CDN layer. No `<meta http-equiv="Content-Security-Policy">` in `index.html`.

Required CSP directives (document these in deployment README — enforced by server config):

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://<R2_PUBLIC_URL>;
  connect-src 'self' https://<VITE_API_BASE_URL> https://o*.ingest.sentry.io;
  font-src 'self';
  object-src 'none';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

- `'unsafe-inline'` for styles is required by shadcn/ui Tailwind classes. Script nonces are not used.
- `img-src` must include R2 public CDN domain for logo/signature display.
- `connect-src` must include Sentry ingest URL when `VITE_SENTRY_DSN` is set.

**Token storage rules:**
- JWT stored in `sessionStorage['auth_token']` only.
- `localStorage` is entirely forbidden — ESLint rule `'no-restricted-globals': ['error', 'localStorage']` enforced in `.eslintrc`.
- Token is never: logged to console, sent to Sentry, included in analytics events, placed in a URL parameter.
- Service worker does NOT access `sessionStorage` — PWA push deep-link requires re-authentication if window is closed.

**XSS mitigation:**
- No `dangerouslySetInnerHTML` anywhere. Announcement body rendered as `<pre className="whitespace-pre-wrap">{body}</pre>` — no HTML rendering.
- All user-supplied content displayed via React's JSX string interpolation (auto-escaped).
- Zod validation on all form inputs before submission.
- `openapi-typescript` generated types prevent sending extra fields.

**CSRF handling:** Not applicable. JWT in `Authorization` header on every request. No cookies in scope.

**Sensitive data rendering rules:**
- `temporaryPassword` cleared from component state on modal `onOpenChange(false)`. No copy to clipboard retained after close.
- JWT token is not rendered anywhere in the UI.
- Student `dateOfBirth`, guardian `phone`/`email` are not masked in Admin views (Admin role has full access by design) but are not included in Sentry error breadcrumbs.

**Third-party script governance:**
- No third-party scripts beyond `@fontsource/montserrat` (self-hosted via npm), `sonner`, and the Sentry SDK.
- No CDN-loaded scripts in `index.html`.
- No advertising or analytics scripts.

**Rate-limit UX handling:**
- `429` response: toast "Too many requests. Please wait a moment and try again."
- Login `429` specifically: "Too many login attempts. Try again later."
- No automatic retry on `429` from frontend.

**Clickjacking protection:**
- `X-Frame-Options: DENY` required in server/CDN config (outside frontend scope — noted in deployment README).

---

## 9. Observability (Frontend)

**Error reporting:** Sentry (SDK: `@sentry/react`). Active only when `VITE_SENTRY_DSN` is non-empty.

**What is captured:**
- Unhandled JS exceptions (via `Sentry.init` auto-instrumentation)
- React render errors caught by `react-error-boundary` (SP10 from v2.0) — `Sentry.captureException` in `onError` handler
- API error responses with `status >= 500` — logged with `requestId` and `status` only

**What is explicitly NOT captured:**
- JWT token value
- User passwords or form field values
- `temporaryPassword` values
- Student PII (name, DOB, phone, admission number)
- Guardian contact details
- Any `sessionStorage` contents

**Sentry PII scrubbing (locked):**
- `beforeSend` callback strips any event breadcrumb or extra data that contains `Authorization` header values.
- `denyUrls` includes the API base URL (API response bodies are never sent to Sentry).

**What events are explicitly NOT tracked:**
- No user behaviour analytics (no Mixpanel, Amplitude, Posthog, or equivalent).
- No page view tracking.
- No click-stream logging.
- No A/B testing frameworks.

**Build SHA tagging:** `VITE_BUILD_SHA` injected at CI build time and set as Sentry `release` tag for error grouping.

---

## 10. Testing Strategy (Frontend)

**Test layers (LOCKED):**

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | vitest | Pure functions: `decodeToken`, `dominantAttendanceStatus`, date helpers in `src/lib/timezone.ts`, countdown timer logic, CSV generation |
| Component | vitest + @testing-library/react | Shared components: `LeaveDetail`, `MarkingSheet`, `NotificationBell`, `CountdownTimer`, `CalendarGrid`, `PaymentModal`, `ConfirmDialog` |
| Integration (mock-based) | vitest + msw (Mock Service Worker) | Critical user flows with mocked API: login flow, mark attendance, submit leave, publish exam |
| E2E | Playwright | 5 critical path flows: login + `mustChangePassword` redirect, mark class attendance, Class Teacher approve leave, Admin publish exam, Guardian view attendance calendar |
| A11y | axe-core/playwright | Run on 5 critical screens: login, mark attendance, leave queue, exam marks entry, guardian attendance calendar |
| Contract conformance | openapi-typescript compile gate | TypeScript compile against generated types from `openapi.yaml` v5.0.2 — any type error = CI fail |
| Bundle size | Lighthouse CI | Per PR: initial bundle ≤ 200KB gzipped |
| Performance audit | Lighthouse CI | Per PR: LCP ≤ 2500ms, CLS ≤ 0.1 |

**MVP test checklist (must pass before any module is accepted as UAT-ready):**

- Auth flows: login success, login failure (401/429), `mustChangePassword` redirect, change password success, logout
- `TOKEN_REVOKED` (401) → forced logout and redirect
- Mark attendance: today only, no backdating, `Excused` blocked for Teacher
- `409 LEAVE_ALREADY_REVIEWED` toast on concurrent approve
- Promotion preview TTL expiry: auto-reset to Step 1
- Import preview TTL expiry: auto-reset to Step 1
- `OVERPAYMENT` guard in payment modal
- Publish exam with incomplete marks: `MARKS_NOT_COMPLETE` inline error
- Guardian attendance calendar: colour-coded cells + grey for unmarked days
- A11y: 0 axe-core violations on 5 critical screens
- Contract: 0 TypeScript compile errors on generated API types

---

## 11. Project Structure (Frontend skeleton)

```text
/
├── .env.example
├── .env.local                          (gitignored — VITE_TENANT_ID, VITE_API_BASE_URL)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .eslintrc.cjs                       (includes no-restricted-globals: localStorage)
├── lighthouserc.json                   (LCP ≤ 2500ms, bundle ≤ 200KB)
├── README.md
├── /public
│   ├── manifest.webmanifest            (vite-plugin-pwa generated)
│   └── icons/                          (PWA icons — 192px, 512px)
├── /src
│   ├── main.tsx
│   ├── /app
│   │   ├── App.tsx                     (router root + QueryProvider + Sentry wrapper)
│   │   ├── router.tsx                  (createBrowserRouter — all routes defined here)
│   │   ├── ProtectedRoute.tsx          (auth guard + mustChangePassword guard)
│   │   └── RoleRoute.tsx               (role-based route guard)
│   ├── /api
│   │   ├── client.ts                   (Axios instance + interceptors — locked pattern)
│   │   ├── auth.api.ts
│   │   ├── sessions.api.ts
│   │   ├── batches.api.ts
│   │   ├── classes.api.ts
│   │   ├── students.api.ts
│   │   ├── guardians.api.ts
│   │   ├── timetable.api.ts
│   │   ├── attendance.api.ts
│   │   ├── leave.api.ts
│   │   ├── exams.api.ts
│   │   ├── fees.api.ts
│   │   ├── assignments.api.ts
│   │   ├── announcements.api.ts
│   │   ├── import.api.ts
│   │   ├── notifications.api.ts
│   │   ├── push.api.ts
│   │   ├── school-profile.api.ts
│   │   └── guardian-portal.api.ts
│   ├── /components
│   │   ├── ConfirmDialog.tsx            (inherited from v2.7)
│   │   ├── ActionBtn.tsx               (SP11 — inherited from v2.2)
│   │   ├── RoleBadge.tsx               (inherited from v2.0)
│   │   ├── ErrorBoundary.tsx           (SP10 — react-error-boundary wrapper)
│   │   ├── LeaveDetail.tsx             (NEW — shared across Admin/Teacher/Guardian/Student)
│   │   ├── LeaveStatusBadge.tsx        (NEW)
│   │   ├── GradeBadge.tsx              (NEW)
│   │   ├── MarkingSheet.tsx            (NEW — shared by exams + assignments)
│   │   ├── ResultSummary.tsx           (NEW)
│   │   ├── PaymentModal.tsx            (NEW)
│   │   ├── NotificationBell.tsx        (NEW)
│   │   ├── StepWizard.tsx              (NEW — 3-step wizard shell)
│   │   ├── CountdownTimer.tsx          (NEW — TTL countdown + aria-live)
│   │   └── CalendarGrid.tsx            (NEW — guardian attendance calendar)
│   ├── /features
│   │   ├── /auth                       (LoginPage, ChangePasswordPage)
│   │   ├── /sessions                   (SessionListPage, SessionDetailPage, PromotionWizard)
│   │   ├── /batches                    (BatchManagementPage)
│   │   ├── /classes                    (ClassManagementPage)
│   │   ├── /students                   (StudentListPage, StudentDetailPage, CreateStudentPage)
│   │   ├── /timetable                  (TimetablePage — Admin builder; Teacher/Student/Guardian read-only)
│   │   ├── /attendance                 (MarkAttendancePage, CorrectionPage, DailySummaryPage, MonthlySheetPage)
│   │   ├── /leave                      (LeaveQueuePage, AdminLeavePage, StudentLeavePage, GuardianLeaveForm)
│   │   ├── /exams                      (ExamListPage, ExamDetailPage, MarksEntryPage, ResultsPage)
│   │   ├── /fees                       (FeeListPage, BulkChargePage, FeeSummaryPage)
│   │   ├── /assignments                (AssignmentListPage, MarkingSheetPage)
│   │   ├── /announcements              (AnnouncementFeedPage, CreateAnnouncementPage)
│   │   ├── /import                     (ImportWizardPage, ImportHistoryPage)
│   │   ├── /notifications              (NotificationsPage)
│   │   ├── /school-profile             (SchoolProfilePage, GradeConfigPage, FeaturesPage)
│   │   ├── /guardian-portal            (GuardianDashboard, GuardianAttendancePage, GuardianResultsPage, GuardianFeesPage, GuardianAssignmentsPage, GuardianTimetablePage, GuardianLeavePage)
│   │   └── /student-portal             (StudentDashboard, StudentAttendancePage, StudentResultsPage, StudentAssignmentsPage, StudentFeesPage, StudentTimetablePage)
│   ├── /hooks
│   │   ├── useAuth.ts                  (reads useAuthStore, exposes user + isClassTeacher)
│   │   ├── useCurrentSession.ts        (reads useSessionStore.currentSession)
│   │   ├── useIsClassTeacher.ts        (= role === 'Teacher' && classTeacherOf !== null)
│   │   └── useGuardianSelectedChild.ts (reads useGuardianStore.selectedChildId)
│   ├── /stores
│   │   ├── auth.store.ts               (locked pattern — see §4)
│   │   ├── session.store.ts            (currentSession global)
│   │   └── guardian.store.ts           (selectedChildId + children list)
│   ├── /lib
│   │   ├── timezone.ts                 (date-fns-tz helpers — formatInTz, parseInTz, toTenantTz)
│   │   ├── queryKeys.ts                (QK factory — locked from §3)
│   │   └── push.service.ts             (VAPID subscription + SW push click handler)
│   ├── /config
│   │   └── nav.ts                      (SINGLE SOURCE for all nav items — roles + routes)
│   ├── /styles
│   │   └── globals.css                 (CSS custom properties — inherited Scofist token system)
│   ├── /types
│   │   ├── api.ts                      (openapi-typescript generated — DO NOT EDIT MANUALLY)
│   │   └── app.ts                      (app-level types: AuthState, SessionState, GuardianState)
│   └── /utils
│       ├── decode-token.ts             (jwt-decode wrapper — returns JWTPayload | null)
│       └── dominant-status.ts          (Absent > Late > Excused > Present priority function)
└── /tests
    ├── /unit                           (vitest — pure functions)
    ├── /component                      (vitest + @testing-library/react)
    ├── /integration                    (vitest + msw)
    └── /e2e                            (playwright)
```

**Naming convention:** camelCase for files and variables. PascalCase for React components and TypeScript interfaces/types.
**Import alias:** `@/` maps to `src/`.

---

## 12. Deployment, Rollback, Environments

**Hosting:** TBD. Output artefact is a static build (`dist/`) suitable for any static host (Vercel, Netlify, S3+CloudFront, nginx). Decision deferred — hosting is a commercial decision outside this freeze.

**Build command (LOCKED):** `vite build`
**Output directory (LOCKED):** `dist/`
**Preview command:** `vite preview`

**Environment mapping:**

| Env | `VITE_APP_ENV` | `VITE_API_BASE_URL` | Notes |
|-----|---------------|---------------------|-------|
| development | `development` | `http://localhost:3000/api/v1` | Prism mock or local backend |
| staging | `staging` | `https://api-staging.<tenant>.example.com/api/v1` | Per-tenant staging URL |
| production | `production` | `https://api.<tenant>.example.com/api/v1` | Per-tenant production URL |

**Per-tenant build strategy:**
Each school requires a separate Vite build with its own `.env.production` file setting at minimum:
- `VITE_TENANT_ID=<school-uuid>`
- `VITE_API_BASE_URL=<school-api-url>`
- `VITE_VAPID_PUBLIC_KEY=<school-vapid-key>` (same as backend if single backend, per-tenant if multi-instance)
- `VITE_APP_NAME=<school name>`

**Rollback strategy:**
- Redeploy previous build artefact (static files have no state — rollback is instant).
- No database migration rollback required for frontend rollback.
- CDN/edge cache must be invalidated after rollback deployment.

**Service worker update strategy (LOCKED):**
- `vite-plugin-pwa` configured with `registerType: 'autoUpdate'`.
- New service worker activates on next page load after user dismisses or the update is detected.
- API responses are never cached by the service worker (only static assets + app shell).
- Service worker cache must be cleared on rollback: increment `cacheVersion` in `vite-plugin-pwa` config.

---

## 13. Forbidden Changes (Scope Lock)

**BANNED without a new Freeze version (v3.1 for minor, v4.0 for major) + CR approval + price/time update:**

- Add any route not listed in §2
- Change routing mode (SPA is locked)
- Add SSR, SSG, or ISR
- Switch auth mode (sessionStorage JWT is locked per Decision 4)
- Store JWT or any token in `localStorage` or a cookie
- Add Redux, MobX, or any state management library other than Zustand
- Change the HTTP client away from Axios
- Replace TanStack Query with SWR or any other data fetching library
- Change `date-fns-tz` to `moment.js` or any other date library
- Add i18n (multi-language support)
- Add offline data entry capability (service worker caches static assets only)
- Add file upload by students or teachers
- Add in-app messaging or chat UI
- Add WhatsApp, email, or SMS notification channel
- Add online payment gateway UI
- Add native mobile app (React Native)
- Remove the `localStorage` ESLint ban
- Remove `no tabIndex > 0` rule
- Add GraphQL client
- Add any third-party analytics, advertising, or tracking SDK

If requested → create Change Request → re-price → approve/reject.

---

## 14. Change Control (Accept-and-price rules)

**Change Request Format:**

- Requested change:
- Reason:
- Scope impact (routes added/modified, components added/modified):
- Timeline impact (days):
- Cost impact (₹/$):
- Risk impact (Low / Medium / High + mitigation):
- API contract impact: Backend CR required? OpenAPI version bump required?
- Decision: Approved / Rejected
- New Freeze version: v3.1 (minor) / v4.0 (major scope revision)

**Version bump rules:**

| Change Type | Frontend Freeze Bump |
|-------------|---------------------|
| Bug fix — no route/API/scope change | Patch note only (no version bump) |
| New screen or route | v3.1 |
| Change to existing API surface consumed | v3.1 + Backend CR if API change |
| Auth mode or state management change | v4.0 |
| Major scope addition (new module) | v4.0 + full scope review + re-price |
| Breaking Backend API change | v3.1 minimum, v4.0 if behaviour change |

**API contract change rule:** Any change to `openapi.yaml` that affects a type, endpoint, or error code consumed by the frontend requires: OpenAPI version bump → Frontend type regeneration → Freeze version bump → CR approval before implementation.

**Billing rule:** Per change request (not per hour). Time impact stated in CR and approved before work begins.
**Response SLA for change requests:** 48 hours.

---

## 15. Version History

- **v1.0** (date unknown): Initial frontend freeze approved for execution.
- **v1.1** (date unknown): Undocumented.
- **v1.2** (date unknown): Undocumented.
- **v1.3** (2026-03-03): Backend v3.6 sync.
- **v1.4** (2026-03-04): Backend v3.6 final sync, CR-FE-008 applied.
- **v1.5** (2026-03-05): Backend v4.0 sync. CR-FE-009 (a/b/c/d), CR-FE-010, CR-FE-011 applied.
- **v1.6** (2026-03-07): Backend v4.2 sync. CR-FE-012, CR-FE-013 (a/b/c/d/e/f/g) applied.
- **v1.7** (2026-03-07): Backend v4.3 sync (CR-31). CR-FE-014 (a/b/c/d/e/f/g) applied.
- **v1.8** (2026-03-08): Backend v4.4 sync (CR-32). CR-FE-015 (a/b/c/d/e) applied. `PUT /timetable/{id}` removed, delete-then-recreate correction workflow.
- **v1.9** (2026-03-08): Backend v4.5 sync (CR-33–38). CR-FE-016 (a/b/c/d/e/f/g) applied.
- **v2.0** (2026-03-09): CR-FE-017 — Scofist Pattern Adoption. CSS token system, Montserrat, top-loader, scrollbar utilities, sidebar rules, BottomTabBar, `nav.ts` single-source rule, role badge mapping, shared components (SP1–SP11), hook inventory (HK1–HK6, HK4/HK5 banned), QueryClient config (QC1–QC4), print rules (PR1–PR7), A11y additions, 5 new forbidden patterns.
- **v2.1** (2026-03-09): CR-FE-018 — v2.0 Error Corrections. 6 bugs fixed (E1–E6), 1 omission (O1 `next-themes` added).
- **v2.2** (2026-03-09): CR-FE-019 — UI Polish & Mobile Fixes. `ActionBtn` SP11 formalised; table min-widths; filter bar grid on mobile; attendance summary StatCard colours; timetable SlotCell delete hover-reveal; path correction `nav.ts`.
- **v2.3** (2026-03-10): CR-FE-020 — Mobile UX gaps. "More" tab + persistent profile section; student attendance row abbreviation on mobile.
- **v2.4** (2026-03-10): CR-FE-021 — More Sheet overflow fix. Overflow derived from `NAV_ITEMS.filter(role).filter(url not in visibleUrls)` including sub-items.
- **v2.5** (2026-03-10): CR-FE-022 — Record Attendance Admin-only + Dashboard role separation.
- **v2.6** (2026-03-10): CR-FE-023 — Dashboard redesign + Teacher Record Attendance restore. `TodayTimetableGrid` introduced. Aligned to Backend v4.8 / OpenAPI v4.8.0 (CR-40, CR-41).
- **v2.7** (2026-03-11): CR-FE-024–027 — Toast standardization, ConfirmDialog wiring, client-side filters, 4 WCAG 2.1 AA gaps closed.
- **v2.8** (2026-03-11): CR-FE-028a–028e — Targeted visual/UX bug fixes (timetable add-slot guard, multi-slot overflow, dark theme text, dashboard sticky column, attendance rankings alignment).
- **v3.0** (2026-03-12): Major scope addition — aligned to Backend Freeze v5.0 / OpenAPI v5.0.2. Incorporates CR-FE-01 through CR-FE-15 (all 15 modules approved). Session-scoped data model alignment throughout. New modules: Academic Sessions + Batch Promotion, Student/Guardian Management, Leave Management, Exam Management + Results + Report Cards, Fee Management, Assignments, Announcements, Bulk CSV Import, Push Notifications + In-App Bell, Guardian Portal, Student Self-Service Portal, School Profile + Settings, PWA manifest + service worker. Auth token: sessionStorage (Decision 4). Tenant resolution: `VITE_TENANT_ID` env var (Decision 2). Guardian attendance calendar: `records[]` array per day per CR-43 / OpenAPI v5.0.1→v5.0.2. `isClassTeacher` compound check locked. Browser support: Chrome 90+, Safari 14+, Firefox 90+, Edge 90+. Performance budgets locked: LCP ≤ 2500ms, INP ≤ 200ms, CLS ≤ 0.1, initial bundle ≤ 200KB gzipped. CSP at server/CDN layer. Hosting TBD.

---

**END OF FRONTEND FREEZE v3.0**
