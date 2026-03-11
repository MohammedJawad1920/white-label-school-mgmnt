# FRONTEND PROJECT FREEZE
**White-Label School Management System**

---

**Version:** 2.7 (IMMUTABLE)
**Date:** 2026-03-11
**Status:** APPROVED FOR EXECUTION
**Supersedes:** v2.6 (2026-03-10)
**Backend Freeze:** v4.8 (2026-03-10)
**OpenAPI:** v4.8.0

---

## CRITICAL INSTRUCTION FOR EXECUTION (HUMAN OR AI)

This document is the **Absolute Source of Truth**. v2.6 is **SUPERSEDED**.

You have **NO authority** to modify routes, API assumptions, or constraints defined below.

If any request contradicts this document, you must **REFUSE** and open a **Change Request** instead.

---

## CHANGE SUMMARY: v2.6 → v2.7

### Backend Contract Aligned To
- **Backend Freeze:** v4.8 (unchanged)
- **OpenAPI:** v4.8.0 (unchanged)
- **No backend/API changes.** All four CRs are frontend-only.

### Change Requests Applied

| CR | Title | Type | Impact |
|----|-------|------|--------|
| **CR-FE-024** | Toast Notification Standardization | Non-breaking UX improvement | 9 manage pages — `onSuccess`/`onError` handlers |
| **CR-FE-025** | Confirmation Dialogs for Destructive Actions | Non-breaking UX safety | UsersPage, StudentsPage, ClassesPage, TimetablePage |
| **CR-FE-026** | Search & Filter Gaps on Manage Screens | Non-breaking UX improvement | StudentsPage, ClassesPage, EventsPage |
| **CR-FE-027** | Key Accessibility Improvements | Non-breaking A11y | Layout.tsx, AttendanceSummaryPage, TimetablePage, MonthlySheetPage |

### What Changed

**No API, OpenAPI, or backend Freeze changes.** All CRs are additive frontend-only changes (mutation feedback, safety guards, client-side filtering, and WCAG 2.1 AA gap fixes).

---

#### A. Record Attendance nav item — Teacher restored (reverts CR-FE-022 nav cut)

`nav.ts` Record Attendance `allowedRoles` → `["Admin", "Teacher"]`.

Teacher date picker in `RecordAttendancePage`: `min={isTeacher ? todayISO() : undefined}` `max={todayISO()}`. Teacher is locked to today only. Admin retains unrestricted past-date access (`max` only).

**⚠️ Frontend-only enforcement note:** `POST /attendance/record-class` validates "not a future date" only — no server-side today-only guard for Teacher. A Teacher calling the API directly can record past dates. This is accepted. No backend CR required.

---

#### B. Dashboard — slot cards removed, `TodayTimetableGrid` introduced (both Admin and Teacher)

The existing `SlotCard` list render is **removed** for both Admin and Teacher. Replaced by a single `<TodayTimetableGrid>` component.

`AdminStatBar` is **kept** above the grid for Admin.

**Dashboard layout (Admin and Teacher):**

```
[Header]
[AdminStatBar]          ← Admin only, unchanged
[TodayTimetableGrid]    ← NEW — both Admin and Teacher
[ClassRankingsCard]     ← Admin: all uniqueClassIds (NEW); Teacher: own classIds (existing)
[UpcomingEventsCard]    ← unchanged
```

---

#### C. `TodayTimetableGrid` — full specification

**Component:** `src/features/dashboard/TodayTimetableGrid.tsx`

**Axes:**
- **Y axis (rows):** Unique class names from today's timetable, sorted alphabetically by `className`. Derived from `GET /timetable?dayOfWeek=today` — all slots, no role filter.
- **X axis (columns):** Period numbers 1–N (union of all `periodNumber` values in today's slots), sorted ascending. Column header: `P{N}` with `{startTime}–{endTime}` subtext from `GET /school-periods`.

**Data queries (all fired from `DashboardPage` — passed as props to grid):**

```ts
// Q1 — timetable (already exists on DashboardPage)
useQuery({
  queryKey: ['timetable', { dayOfWeek: todayDayOfWeek() }],
  queryFn: () => timetableApi.list({ dayOfWeek: todayDayOfWeek() }),
  staleTime: 5 * 60 * 1000,
  refetchInterval: 5 * 60 * 1000,  // CR-FE-023 improvement E
})

// Q2 — school periods for column headers (same pattern as TimetablePage periodsQ)
useQuery({
  queryKey: ['school-periods'],
  queryFn: () => schoolPeriodsApi.list(),
  staleTime: 10 * 60 * 1000,
})

// Derive uniqueClassIds from ALL slots (no role filter — CR-40/CR-41 allow Teacher full access)
const allSlots = timetableData?.timetable ?? []
const uniqueClassIds = [...new Set(allSlots.map(s => s.classId))]

// Q3 — parallel daily-summary per classId (same pattern as TimetablePage + AdminStatBar)
useQueries({
  queries: uniqueClassIds.map(classId => ({
    queryKey: ['daily-summary', classId, TODAY],
    queryFn: () => attendanceApi.getDailySummary(classId, TODAY),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,  // CR-FE-023 improvement E
    enabled: uniqueClassIds.length > 0,
  })),
})
```

**Build maps (same pattern as `TimetablePage`):**

```ts
// Slot map: "classId::periodNumber" → TimeSlot
const slotMap = new Map<string, TimeSlot>()
for (const s of allSlots) slotMap.set(`${s.classId}::${s.periodNumber}`, s)

// Summary map: "classId::periodNumber" → DailySlotSummary
const summaryMap = new Map<string, DailySlotSummary>()
for (const q of dailySummaryQueries) {
  if (q.data) {
    for (const slot of q.data.slots) {
      summaryMap.set(`${q.data.classId}::${slot.periodNumber}`, slot)
    }
  }
}
```

**Cell states:**

| State | Background | Content |
|---|---|---|
| Marked, 0 absent | `bg-green-100 border-green-200` | Subject · Teacher |
| Marked, N absent | `bg-green-100 border-green-200` | Subject · Teacher · 🔴 **N** badge |
| Unmarked, period ongoing/future | `bg-yellow-50 border-yellow-200` | Subject · Teacher · ⏳ |
| Unmarked, period overdue (Improvement B) | `bg-orange-50 border-orange-300` | Subject · Teacher · ⚠ Overdue |
| Empty (no slot) | `bg-muted/20 border-transparent` | — |

**Overdue logic (Improvement B — client-side only):**
```ts
// slot is overdue if: current time > slot.endTime AND attendanceMarked === false
const isOverdue = (slot: TimeSlot, summary?: DailySlotSummary): boolean => {
  if (!slot.endTime || summary?.attendanceMarked !== false) return false
  const [h, m] = slot.endTime.split(':').map(Number)
  const now = new Date()
  return now.getHours() > h! || (now.getHours() === h! && now.getMinutes() > m!)
}
```
`endTime` is sourced from `SchoolPeriod` (via `periodsQ`), not from `TimeSlot.endTime` (optional). Fallback: if `SchoolPeriod` not loaded, overdue state is not shown for that cell — graceful degradation.

**Absent badge:**
```tsx
// Only rendered when attendanceMarked: true AND absentCount > 0
{summary.attendanceMarked && summary.absentCount > 0 && (
  <button
    onClick={e => { e.stopPropagation(); openAbsenteePopup(summary.timeSlotId) }}
    className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-semibold px-1.5 min-w-[18px] h-[18px] hover:bg-red-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
    aria-label={`${summary.absentCount} absent students — click to view names`}
  >
    {summary.absentCount}
  </button>
)}
```

`e.stopPropagation()` — prevents the cell-level `onClick` (navigate to Record Attendance) from firing when the badge is clicked.

**Cell click — navigate to Record Attendance:**
```ts
function handleCellClick(slot: TimeSlot) {
  if (activeRole === 'Admin') {
    navigate('/attendance/record', { state: { slotId: slot.id } })
  } else if (activeRole === 'Teacher' && slot.teacherId === currentUser.id) {
    navigate('/attendance/record', { state: { slotId: slot.id } })
  }
  // Teacher on another teacher's slot: no navigation on cell click
}
```

Cell cursor:
- Admin / Teacher on own slot: `cursor-pointer` + `hover:ring-2 hover:ring-primary/30 transition-all`
- Teacher on another's slot: `cursor-default`
- Empty: `cursor-default`

Teacher's own slot cells additionally receive `border-l-2 border-l-primary` left accent — visually distinguishes their assigned periods from others at a glance.

**Absentee popup (Radix `Popover`):**
- Trigger: absent badge button click
- Lazy TQ: `['absentees', timeSlotId, TODAY]`, `enabled: popupOpen`
- Loading: 3 skeleton name rows (`animate-pulse h-3 bg-muted rounded`)
- Popup header: `"{N} absent of {totalStudents} students"` — shows present count context (A3 pattern: present count lives here, not in cell)
- Each row: `studentName` · `admissionNumber` · streak badge `{N} consecutive` in `bg-red-100 text-red-700 rounded-full px-1.5 text-xs` — streak badge rendered only when `consecutiveAbsentCount >= 2`
- Empty state (`absentees.length === 0`): "No absences recorded for this period."
- `403 FEATURE_DISABLED`: popup body "Attendance feature not enabled."
- `404`: popup body "Period not found."
- Other errors: popup body "Failed to load. Tap to retry." with retry button
- Close: outside click, Escape (Radix Popover default)

**Improvement E — Manual refresh + auto-refresh:**
- `refetchInterval: 5 * 60 * 1000` on timetable query and all daily-summary queries
- Grid header right side: `↻ Refresh` button — calls `refetch()` on timetable query + `Promise.all(dailySummaryQueries.map(q => q.refetch()))`
- "Last updated: {HH:MM}" timestamp displayed beside the button, updated on every successful fetch
- During refetch: button shows spinner + disabled state. Grid data remains visible (no loading overlay)
- `lastUpdatedAt` tracked in local state: `const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)` — set in `onSuccess` callback via TQ `queryCache` or `onSettled`

**Improvement C — Grid skeleton:**
```tsx
function TodayTimetableGridSkeleton({ rows = 3, cols = 4 }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px] border-collapse">
        <thead>
          <tr>
            <th className="w-24" />
            {[...Array(cols)].map((_, i) => (
              <th key={i} className="p-2">
                <div className="h-3 bg-muted rounded animate-pulse w-16 mx-auto" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, r) => (
            <tr key={r}>
              <td className="p-2">
                <div className="h-3 bg-muted rounded animate-pulse w-20" />
              </td>
              {[...Array(cols)].map((_, c) => (
                <td key={c} className="p-1">
                  <div className="rounded border bg-muted/30 p-2 h-16 animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```
Skeleton is shown when `timetableQ.isLoading || periodsQ.isLoading`. Skeleton row/col counts derived from previous render if available (avoids 3×4 hard-code); falls back to 3×4.

**Improvement D — Mobile grid/list toggle:**
```tsx
const [mobileView, setMobileView] = useState<'grid' | 'list'>('grid')
// Toggle button visible only on < sm breakpoint
<button
  className="sm:hidden text-xs text-muted-foreground border rounded px-2 py-1"
  onClick={() => setMobileView(v => v === 'grid' ? 'list' : 'grid')}
  aria-label={`Switch to ${mobileView === 'grid' ? 'list' : 'grid'} view`}
>
  {mobileView === 'grid' ? '≡ List' : '⊞ Grid'}
</button>
```
List view renders the same slot data as simple cards (subject · teacher · badge) stacked vertically — reuses the existing `SlotCard` layout without the Record Attendance CTA. Grid state is session-only (`useState` — not persisted).

**Improvement G — Dashboard max-width:**
- Grid section: `max-w-5xl mx-auto` — wider than previous `max-w-3xl` to accommodate 6+ period columns
- Header, AdminStatBar, ClassRankingsCard, UpcomingEventsCard: `max-w-3xl mx-auto` — unchanged for readability
- Grid section gets its own `<div className="w-full overflow-x-auto">` wrapper

**Mobile — sticky first column:**
```tsx
// Class name column (Y axis label)
<td className="sticky left-0 bg-background z-10 border-r border-border px-3 py-2 text-sm font-medium whitespace-nowrap min-w-[100px]">
  {className}
</td>
```
Same pattern already locked for Monthly Sheet (CR-FE-019-D).

---

#### D. ClassRankingsCard — Admin receives it

`ClassRankingsCard` is role-agnostic. Previously rendered only for Teacher.

Change: rendered for both Admin and Teacher when `uniqueClassIds.length > 0`.

- **Admin:** `uniqueClassIds` = all classes in today's timetable. Toppers query: `GET /attendance/toppers?classId=X&from=THIRTY_DAYS_AGO&to=TODAY&limit=5`. Admin has access to any classId ✅.
- **Teacher:** `uniqueClassIds` = only own assigned classes (teacher-filtered slots). Toppers query: same. Teacher restricted to own classIds by `/attendance/toppers` endpoint ✅.

No component changes required. Just remove the `user?.activeRole === 'Teacher'` conditional guard.

---

### New TypeScript types (append to `src/types/api.ts`)

```ts
// CR-FE-023: Absentee popup response (CR-39 OpenAPI v4.6.0)
export interface AbsenteeEntry {
  studentId: string
  studentName: string
  admissionNumber: string
  /** Consecutive absence streak for this student × subject, including today. Always >= 1. */
  consecutiveAbsentCount: number
}
export interface GetAbsenteesResponse {
  timeSlotId: string
  date: string
  classId: string
  subjectId: string
  absentees: AbsenteeEntry[]
}
```

### New API client method (append to `src/api/attendance.ts`)

```ts
// CR-FE-023: Absentee names for a timeslot on a date (CR-39 OpenAPI v4.6.0)
getAbsentees: (timeSlotId: string, date: string) =>
  apiClient
    .get<GetAbsenteesResponse>('/attendance/absentees', {
      params: { timeSlotId, date },
    })
    .then(r => r.data),
```

### New TQ key

```ts
// Absentee popup (lazy — enabled only when popup opens)
['absentees', timeSlotId, date]
// Stale time: 2 min
// Retry: false on 403, 404
// Never retry: 403 FEATURE_DISABLED
```

---

## CHANGE SUMMARY: v2.4 → v2.5

### Change Requests Applied

| CR | Title | Type | Impact |
|----|-------|------|--------|
| **CR-FE-022** | Record Attendance: Admin-only access + Dashboard role separation | **Breaking scope change** — Teacher loses Record Attendance entirely | §1 Stories, §1 User Roles, §2 Route Map, §2.1 Dashboard, §2.1 Record Attendance, §5 nav.ts, §10 Tests, §13 |

### What Changed

**No API/backend changes. OpenAPI unchanged at v4.5.0.**

This is a **breaking UX scope change**. Teacher loses the ability to record attendance.

#### A. Record Attendance — Admin only

`nav.ts` Record Attendance item: `allowedRoles: ["Teacher", "Admin"]` → `allowedRoles: ["Admin"]`.

Consequence: route guard on `/attendance/record` for Teacher role automatically triggers inline "Not authorized for current role. Switch to Admin to access this page." — existing role guard handles this.

Teacher sidebar: Record Attendance item removed.
BottomTabBar Teacher: Record Attendance item removed. Teacher now has 3 non-sub-items (Dashboard, Timetable, Monthly Sheet) — all fit in 5 tabs, no More sheet overflow nav items.

#### B. Dashboard — Admin: no slot cards

Admin dashboard removes the slot list render entirely. The timetable query (`GET /timetable?dayOfWeek=today`) is still fired — it remains necessary to derive `uniqueClassIds` for `AdminStatBar`.

**Admin dashboard after CR-FE-022:**
- `AdminStatBar` (Marked / Unmarked counts) — kept
- Slot list (`<SlotCard>` rows) — **removed**
- `UpcomingEventsCard` — kept
- `ClassRankingsCard` — never rendered for Admin (Teacher-only, unchanged)
- Empty/loading/error state for slot list — removed from Admin branch

`handleRecordAttendance` function and its `navigate("/attendance/record", ...)` call — removed from Admin dashboard entirely.

#### C. Dashboard — Teacher: slot cards without Record Attendance CTA

Teacher still sees today's own assigned slot cards (unchanged). `SlotCard` component's "Record Attendance" button is **removed** — Teacher can view periods but cannot initiate recording from dashboard or any other route.

`SlotCard` component loses the `onRecordAttendance` prop and the `<button>` element entirely. The `handleRecordAttendance` callback is removed from the render tree that feeds Teacher slots.

#### D. Stories and role table updated

Story #2 (Teacher dashboard): CTA to record attendance removed.
Story #6: Actor changes from "Teacher or Admin" to "Admin only".
User Roles table: Teacher row — Record Attendance removed from sidebar items.

#### E. Date picker — no change

`RecordAttendancePage` date picker (`max={todayISO()}`, no `min`) is unchanged. Admin retains the ability to record for any past date. Teacher has no access to the page at all.

---

## CHANGE SUMMARY: v2.3 → v2.4

### Change Requests Applied

| CR | Title | Type | Impact |
|----|-------|------|--------|
| **CR-FE-021** | More Sheet: full role-filtered nav overflow — sub-items were unreachable on mobile | Logic fix — no API/state/route changes | §5 BottomTabBar, §13 |

### What Changed

**No scope changes. No API/backend changes. OpenAPI unchanged at v4.5.0.**

#### Root cause

`BOTTOM_TAB_NAV_ITEMS = NAV_ITEMS.filter(!isSubItem)` produces exactly **5 items** for Admin (Dashboard, Timetable, Record Attendance, Attendance Summary, Monthly Sheet). `visibleTabs = slice(0,5)` consumes all 5. `overflowTabs = slice(5)` is an empty array.

The 7 sub-items (`Users`, `Students`, `Classes`, `Batches`, `Subjects`, `School Periods`, `Events`) are `isSubItem: true` and were never included in `BOTTOM_TAB_NAV_ITEMS`. They were **completely unreachable on mobile** — no path to `/manage/*` or `/manage/events` existed on any mobile viewport.

#### Fix

The More Sheet overflow source changes from `overflowTabs` (derived from `BOTTOM_TAB_NAV_ITEMS`) to a new derived list: **all role-filtered `NAV_ITEMS` entries not already displayed as a visible tab.**

```ts
// Visible tabs — unchanged
const filteredNonSubItems = BOTTOM_TAB_NAV_ITEMS.filter(item =>
  item.allowedRoles.includes(activeRole)
)
const visibleTabs = filteredNonSubItems.slice(0, 5)
const visibleUrls = new Set(visibleTabs.map(t => t.url))

// More sheet overflow — ALL role-filtered items not already a visible tab
const moreItems = NAV_ITEMS.filter(item =>
  item.allowedRoles.includes(activeRole) && !visibleUrls.has(item.url)
)
```

`moreItems` includes sub-items. The "More" tab remains always rendered (CR-FE-020). The overflow nav section in the sheet renders when `moreItems.length > 0` (always true for Admin, Teacher; false for Student).

**Group header rendering in More Sheet:** same pattern as Sidebar — when an item has `item.groupLabel` and it differs from the previous item's `groupLabel`, render a non-interactive section label before the item row.

```tsx
{moreItems.map((item, i) => {
  const prevGroupLabel = i > 0 ? moreItems[i - 1].groupLabel : undefined
  const showGroupHeader = item.groupLabel && item.groupLabel !== prevGroupLabel
  return (
    <Fragment key={item.url}>
      {showGroupHeader && (
        <p className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {item.groupLabel}
        </p>
      )}
      <button
        onClick={() => handleNav(item.url)}
        aria-current={isActive(item, location.pathname) ? 'page' : undefined}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-[44px]',
          item.isSubItem ? 'pl-6' : '',
          isActive(item, location.pathname)
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" strokeWidth={isActive(item, location.pathname) ? 2.5 : 1.75} aria-hidden />
        {item.label}
      </button>
    </Fragment>
  )
})}
```

**Result per role:**
- **Admin:** More sheet nav section = Record Attendance (if slot 6+) + Manage group header + Users, Students, Classes, Batches, Subjects, School Periods + Events (all 7 sub-items). All `/manage/*` routes now reachable on mobile.
- **Teacher:** More sheet nav section = (none — Teacher has 4 non-sub items, all fit in 5 tabs). Nav section renders empty, only user profile shown.
- **Student:** More sheet nav section = (none — 2 items, both fit). Only user profile shown.

---

## CHANGE SUMMARY: v2.2 → v2.3

### Change Requests Applied

| CR | Title | Type | Impact |
|----|-------|------|--------|
| **CR-FE-020** | Mobile UX: Always-visible logout/role-switch + status button abbreviation | CSS/layout + additive render logic — zero API/state/route changes | §5 BottomTabBar, §2.1 Record Attendance, §6 A11y, §13 |

### What Changed

**No scope changes. No API/backend changes. OpenAPI unchanged at v4.5.0.**

#### 020-A — "More" tab always rendered; sheet gains user profile section

**Problem:** "More" tab was only rendered when `overflowTabs.length > 0`. Logout and RoleSwitcher live in the desktop sidebar (`hidden md:flex`) — completely inaccessible on mobile.

**Fix:** "More" tab is now **always rendered** regardless of overflow count. The "More" Sheet bottom section always includes:
- Horizontal divider (`border-t`)
- User initials avatar + name + `<RoleBadge>` for `activeRole`
- `<RoleSwitcher>` — rendered only when `user.roles.length > 1`
- Logout button — fire-and-forget `POST /auth/logout` + `queryClient.clear()` + clear `localStorage.auth` + navigate `/login`

The overflow nav items section in the sheet renders conditionally (only when `overflowTabs.length > 0`) above the divider. The divider + user section always renders.

#### 020-B — Status button abbreviation on mobile

**Problem:** `StudentRow` status buttons (`Present` / `Absent` / `Late`) have `min-w-[60px]` each. At 375px with 3 buttons, the button group pushes the student name row to wrap badly — screenshot shows "MUHAMME D JAWAD T.S".

**Fix:** Responsive label rendering inside each status `<label>`:
```tsx
<span className="sm:hidden" aria-hidden="true">{status[0]}</span>
<span className="hidden sm:inline" aria-hidden="true">{status}</span>
```
Button `min-w`: `min-w-[32px] sm:min-w-[60px]`.

`aria-label` on the hidden `<input type="radio">` is unchanged — it already carries the full status name (`aria-label="{status} for {student.name}"`), so screen readers are unaffected.

---

## CHANGE SUMMARY: v2.1 → v2.2

### Change Requests Applied

| CR | Title | Type | Impact |
|----|-------|------|--------|
| **CR-FE-019** | UI Polish & Mobile Fixes | CSS/props only — zero API, state, or logic changes | §2.1, §5, §5.5, §11, §13 |

### What Changed

**No scope changes. No API/backend changes. OpenAPI unchanged at v4.5.0.**

All changes are CSS class additions, a single additive prop on `ActionBtn`, and one documentation path correction.

#### A. `ActionBtn` — new `ariaLabel?` prop (§5.5)

`ActionBtn` in `src/components/manage/shared.tsx` gains an optional `ariaLabel?: string` prop. When provided, `aria-label` uses `ariaLabel`; otherwise falls back to `label` (backward-compatible). Visible button text is always `label`. No breaking change.

#### B. Action button labels — all manage screens (§2.1)

All `<ActionBtn>` call sites in manage screens now use short visible labels (`"Edit"`, `"Delete"`, `"Edit roles"`) with the full context in `ariaLabel`. Previously `label` carried the full string (e.g. `"Edit roles for Test Admin"`), which rendered verbosely in the visible button.

Affected screens: UsersPage, StudentsPage, SchoolPeriodsPage, BatchesPage, ClassesPage, SubjectsPage.

#### C. Table min-width — prevent mobile column collapse (§2.1)

- `StudentsPage` `<table>`: `min-w-[900px]`. Student name `<td>`: `whitespace-nowrap`.
- `UsersPage` `<table>`: `min-w-[560px]`.
- Attendance Summary rankings table wrapper: `overflow-x-auto`, inner div `min-w-[400px]`.

#### D. Monthly Sheet — mobile filter grid + sticky student column (§2.1)

- Filter bar: `grid grid-cols-2 gap-3 mb-5 sm:flex sm:flex-wrap` — 2-column grid on mobile.
- Student column header: `sticky left-0 bg-muted/50 z-10 border-r border-border`.
- Student name rowheader: `sticky left-0 bg-background z-10 border-r border-border`, `truncate` removed from both inner `<span>` elements.

#### E. Attendance Summary — stat card left-border accents + rankings fix (§2.1)

- `StatCard` gains optional `accentBorder?: string` prop (`border-l-4` variant). Total Classes → `border-l-blue-400`, Present → `border-l-green-500`, Absent → `border-l-red-500`, Late → `border-l-yellow-500`.
- Rankings student name cell: `truncate` removed, `min-w-[120px]` added.

#### F. Record Attendance — student name wrapping (§2.1)

`StudentRow` name `<span>`: `truncate` → `break-words`. Fixes "MUHAMM..." truncation on 375px screens.

#### G. Timetable — hover-reveal Delete button in slot cells (§2.1)

`SlotCell` outer `<div>` gains `group`. Delete `<button>` gains `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all`. Always in DOM (a11y preserved), visually hidden until hover or focus-within.

#### H. Path correction: `src/app/nav.ts` → `src/config/nav.ts` (§5, §11, §13)

The freeze incorrectly referenced `src/app/nav.ts`. Actual file is `src/config/nav.ts` (confirmed from source). All three reference locations corrected.

---

## CHANGE SUMMARY: v2.0 → v2.1

### Change Requests Applied

| CR | Title | Type | Impact |
|----|-------|------|--------|
| **CR-FE-018** | v2.0 Error Corrections (6 bugs, 1 omission) | Corrective (no scope/API change) | §1.6, §5, §5.7, §8 |

### What Changed

**No scope changes. No API/backend changes. OpenAPI unchanged at v4.5.0.**

All 7 items are corrections to errors introduced in v2.0 (CR-FE-017):

| # | Severity | Location | Error | Fix |
|---|----------|----------|-------|-----|
| E1 | 🔴 Runtime | §5 Typography | `next/font` referenced — Next.js-only API, incompatible with Vite | Replaced with `@fontsource/montserrat` |
| E2 | 🔴 Runtime | §5.7 Print Rules | `-webkit-print-color-adjust` and `print-color-adjust` were bare properties outside any CSS selector — invalid CSS, ignored by browsers | Moved inside `*, *::before, *::after {}` block |
| E3 | 🔴 Runtime | §8 CSP | `VITE_API_BASE_URL` used literally in static `_headers` file — Vite env vars are not interpolated in static files | Replaced with build-step note and per-environment instruction |
| E4 | 🟡 Misleading | §5.5 SP1, SP4 | `class=` used in JSX component specs — must be `className=` in React | Corrected to `className=` |
| E5 | 🟡 Logic | §5 nav.ts | `BOTTOM_TAB_ITEMS` statically sliced to 5 before role filtering — would include forbidden-role items | Export renamed `BOTTOM_TAB_NAV_ITEMS`, slice moved to render-time after role filter |
| E6 | 🟡 Doc | §15 | v2.0 version history entry contained copy-pasted v1.9 content appended at end | Truncated to correct v2.0 summary only |
| O1 | ⚪ Omission | §1.6 | `next-themes` missing from tech stack table despite being used for `ThemeProvider` | Added to stack table |

---

## CHANGE SUMMARY: v1.9 → v2.0

### Change Requests Applied

| CR | Title | Type | Impact |
|----|-------|------|--------|
| **CR-FE-017** | Scofist Pattern Adoption — Implementation Architecture Lock | Additive (no API/backend impact) | §1.6, §4, §5, §5.5, §5.6, §5.7, §6, §13 |

### What Changed

**No API contract changes. No backend freeze changes. OpenAPI unchanged at v4.5.0.**

This CR formalises 174 implementation-level decisions from the Scofist UI pattern review. All decisions were validated against Freeze v1.9 before adoption. 6 Scofist patterns were explicitly rejected due to freeze conflicts (logged below).

**§1.6 Tech Stack:**
- Added `react-error-boundary` as required package (replaces banned class-component ErrorBoundary pattern)
- Added explicit bans: `useLocalStorage()` generic hook, `useConfirm()` imperative hook, `window.location.reload()` on role switch

**§4 — New §4.2 QueryClient Configuration:**
- `QueryCache({ onError })` pattern locked for TanStack Query v5 global 401 handling (v4 global `onError` removed in v5)
- Stale-time split locked: `staleTime: 0` for attendance queries, `staleTime: 5min` for reference data — per-query override
- `queryClient.clear()` on logout and role switch — explicitly locked

**§5 Design System — significant expansion:**
- CSS custom property token system locked (HSL, `--sidebar-*`, `.dark {}` inversion)
- Montserrat font locked via CSS variable, weights 100–900
- Top-loader bar spec locked (`fixed h-[3px] top-0`, keyframe, `bg-primary`)
- Custom scrollbar locked (6px, transparent track, `.hide-scrollbar` utility)
- Sidebar implementation rules locked
- BottomTabBar spec locked
- `nav.ts` single-source rule — `BOTTOM_TAB_ITEMS` derived from same array as sidebar
- Role badge color mapping locked
- Print rules locked

**§5.5 — New: Shared Component Specifications (SP1–SP10)**

**§5.6 — New: Hook Inventory (HK1–HK6)**

**§5.7 — New: Print Rules (PR1–PR7)**

**§6 A11y additions:** skip link, aria-live/busy, prefers-reduced-motion, aria-hidden on decorative icons, heading hierarchy, no tabindex>0, axe-core/playwright in CI

**§13:** 4 new forbidden patterns added

### Explicitly Rejected Scofist Patterns (6)

| Item | Pattern | Reason |
|------|---------|--------|
| T10 | `.poster-text` antialiasing | YAGNI — no certificates in scope |
| S8 | Role switch → `window.location.reload()` | Freeze mandates no-reload role switch (§4, Success Definition §1.1 item 4) |
| S17 | `NavIcon` inline SVG component | `lucide-react` is locked stack; inline SVGs create parallel icon system |
| SP10 | Custom class-component `<ErrorBoundary>` | Freeze §1.6 bans class components → replaced by `react-error-boundary` package |
| HK4 | `useConfirm()` imperative hook | Duplicates SP6 declarative `<ConfirmDialog>` pattern |
| HK5 | `useLocalStorage()` generic hook | Only `localStorage.auth` is authorised (§8); generic hook enables undisciplined storage use |

### Backend Contract Sync

None. Backend Freeze v4.5 and OpenAPI v4.5.0 unchanged.

### Timeline Impact

None. Implementation architecture constraints only — no new user stories or screens.

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
2. As a Teacher, I can **see today's full school timetable grid on the dashboard** — all classes × all periods with colour-coded attendance status and absent counts. I can click my own assigned period cells to record attendance, and click any absent badge to view absent student names.
3. As an Admin, I can **see today's full schedule with an API-driven stat bar** (Total Periods / Marked / Unmarked) on a role-specific dashboard.
4. As a Student, I can **see today's school-wide timetable (read-only) and my own recent attendance history** on my dashboard — using `studentId` from my JWT.
5. As a Teacher or Admin, I can **view the full timetable grid** with marking-status color-coding on today's cells — Admin can add a slot by clicking an empty cell, and delete a slot by clicking a filled cell; to correct a slot's teacher or subject, Admin deletes and recreates the slot.
6. As an Admin, I can **record attendance for any class period on any past date up to today**. As a Teacher, I can **record attendance for my own assigned periods for today only**. Both roles see an "At-Risk Students" panel showing students with ≥ 3 consecutive absences.
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
| **Teacher** | Dashboard, Timetable, **Record Attendance**, Monthly Sheet | Dashboard shows full school timetable grid (all classes) — cell click navigates to Record Attendance only on own assigned slots; other slots read-only; absent badge clickable on all slots (CR-41); Record Attendance date picker locked to today (`min=max=today`) — frontend-only enforcement |
| **Admin** | Dashboard, Timetable, Attendance Summary, Student Attendance History, Monthly Sheet, Record Attendance, Manage (Users, Students, Classes, Batches, Subjects, School Periods), Events | Dashboard shows AdminStatBar + full timetable grid + ClassRankingsCard (all classes); any cell click navigates to Record Attendance; Record Attendance allows any past date (`max=today`, no `min`) |
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
| **Theme** | `next-themes` (latest stable) |
| **Error boundaries** | `react-error-boundary` (latest stable) |

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
- No class components (hooks only) — including custom `ErrorBoundary` class components; use `react-error-boundary` package
- No direct `fetch` calls outside `src/api`
- No prop drilling beyond 2 levels
- No hardcoded tenant slugs, IDs, or API URLs in component files
- No `useLocalStorage()` generic hook — only `localStorage.auth` and `localStorage.sa-auth` are authorised storage keys (§8)
- No `useConfirm()` imperative hook — use `<ConfirmDialog>` (SP6, declarative) everywhere
- No `window.location.reload()` on role switch — role switch is context update + `queryClient.clear()` only (§4)

---

## 2. ROUTES, SCREENS, AND NAVIGATION (UI truth)

### Route Map — Tenant App (`app.yourdomain.com`)

| Route | Screen | Auth | activeRole |
|-------|--------|------|------------|
| `/login` | Tenant Login | Public | — |
| `/` (dashboard) | Dashboard | Protected | Teacher, Admin, Student |
| `/timetable` | Timetable | Protected | Teacher (read), Admin (r/w), Student (read) |
| `/attendance/record` | Record Attendance | Protected | Admin, Teacher |
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

**Goal:** Today's full timetable grid for Admin and Teacher — colour-coded attendance status, absent counts, absentee popup, cell-click navigation. Student dashboard unchanged.

**API calls:**
1. `GET /timetable?dayOfWeek={todayDayName}` — Admin and Teacher (all slots, no role filter)
   - `200` → feed `TodayTimetableGrid`, derive `uniqueClassIds` (all classes)
   - `403 FEATURE_DISABLED` → full-page "Timetable feature not enabled"
   - `401` → session expiry flow
2. `GET /school-periods` — Admin and Teacher (column headers for grid)
   - `200` → period time labels in grid column headers
   - Error → headers show `P{N}` only — graceful degradation, no error state
3. `GET /attendance/daily-summary?classId=X&date=today` — parallel per `uniqueClassId` (Admin: any classId ✅; Teacher: any classId per CR-40 ✅)
   - `200` → cell colour + absent badge count
   - Error per query → affected cells render grey/neutral — silent degradation, no toast
4. `GET /attendance/toppers?classId=X&from={30daysAgo}&to={today}&limit=5` — lazy, per classId, fired only when `ClassRankingsCard` accordion expands
   - Admin: any classId ✅; Teacher: own classIds only (backend enforced)
   - `200` → rankings rows; `403` → "No data available for this class."
5. `GET /attendance/absentees?timeSlotId=X&date=today` — lazy, fired only when absent badge clicked (`enabled: popupSlotId === timeSlotId`)
   - Admin and Teacher: any timeslot per CR-41 ✅
   - `200` → absentee popup content
   - `403 FEATURE_DISABLED` → popup shows "Attendance feature not enabled."
   - `404` → popup shows "Period not found."
   - Network error → popup shows "Failed to load." + retry
6. `GET /events` — all roles (Upcoming Events card)
7. `GET /students/{studentId}/attendance` — Student only (unchanged)
8. `GET /attendance/streaks` — Student only (unchanged)

**Server state (updated):**
- TQ `['timetable', { dayOfWeek }]` — stale: 5 min. `refetchInterval: 5 * 60 * 1000`.
- TQ `['school-periods']` — stale: 10 min.
- TQ `['daily-summary', classId, TODAY]` — stale: 2 min. `refetchInterval: 5 * 60 * 1000`.
- TQ `['toppers', classId, from, to]` — stale: 5 min. `enabled: open` (lazy).
- TQ `['absentees', timeSlotId, TODAY]` — stale: 2 min. `enabled: popupSlotId === timeSlotId` (lazy).
- TQ `['events', 'current-month']` — stale: 10 min.
- Student TQ keys: unchanged.

**Local state:**
- `popupSlotId: string | null` — controls absentee popup
- `mobileView: 'grid' | 'list'` — default `'grid'`, session-only
- `lastUpdatedAt: Date | null` — updated on successful timetable + daily-summary fetches

**Role-specific content:**

- **Admin:**
  - `AdminStatBar` — kept, unchanged, above grid
  - `TodayTimetableGrid` — all classes × all periods. Every populated cell: `cursor-pointer` + cell click → `navigate('/attendance/record', { state: { slotId } })`
  - `ClassRankingsCard` — `uniqueClassIds` from all today's slots (NEW for Admin in v2.6)
  - `UpcomingEventsCard`

- **Teacher:**
  - `TodayTimetableGrid` — all classes × all periods (CR-40/41). Own slot cells: `cursor-pointer` + left border accent + cell click → `/attendance/record`. Other slots: `cursor-default`, no navigation. Absent badge clickable on all slots.
  - `ClassRankingsCard` — own assigned `classIds` only (teacher-filtered — existing behaviour)
  - `UpcomingEventsCard`

- **Student:** Unchanged — `StudentDashboard` + `UpcomingEventsCard`.

**`TodayTimetableGrid` cell states:**

| State | Background | Content |
|---|---|---|
| Marked, 0 absent | `bg-green-100 border-green-200` | Subject · Teacher |
| Marked, N absent | `bg-green-100 border-green-200` | Subject · Teacher · 🔴 **N** badge |
| Unmarked, not overdue | `bg-yellow-50 border-yellow-200` | Subject · Teacher · ⏳ |
| Unmarked, overdue | `bg-orange-50 border-orange-300` | Subject · Teacher · ⚠ Overdue |
| Empty | `bg-muted/20 border-transparent` | — |

Overdue = current time > `SchoolPeriod.endTime` AND `attendanceMarked === false`. Client-side comparison only. Falls back to non-overdue style if `SchoolPeriod` not loaded.

**Absent badge:** Rendered only when `attendanceMarked: true && absentCount > 0`. Click → `e.stopPropagation()` + open popup. `aria-label="{N} absent students — click to view names"`.

**Absentee popup (Radix Popover):**
- Header: `"{absentCount} absent of {totalStudents} students"` — present count implied (`totalStudents - absentCount` present)
- Rows: `studentName` · `admissionNumber` · streak badge `{N} consecutive` (`bg-red-100 text-red-700 text-xs rounded-full px-1.5`) — streak badge only when `consecutiveAbsentCount >= 2`
- Loading: 3 skeleton rows. Empty: "No absences recorded." Errors: per-state messages above.

**Refresh (Improvement E):**
- `refetchInterval: 5 * 60 * 1000` on timetable + all daily-summary queries
- Grid header right: `↻ Refresh` button — calls all refetch in parallel
- `"Last updated: {HH:MM}"` beside button. During refetch: spinner + `disabled`. Data visible.

**Mobile (Improvement D):**
- Default: horizontal-scroll grid. Class name column: `sticky left-0 bg-background z-10 border-r border-border whitespace-nowrap`
- Toggle button (`sm:hidden`): `⊞ Grid` / `≡ List`. List view = slot cards without Record CTA.
- Grid section: `max-w-5xl mx-auto`. Other sections: `max-w-3xl mx-auto` (Improvement G).

**Loading:** `TodayTimetableGridSkeleton` — grid-shaped placeholder, rows × cols matching expected layout. Shown when `timetableQ.isLoading || periodsQ.isLoading`.

**Empty:** "No classes scheduled for today." — when `allSlots.length === 0` after successful load.

**Error:** `ErrorState` + retry — when `timetableQ.isError && code !== 'FEATURE_DISABLED'`.

**Upcoming Events card (all roles — CR-FE-016g):** Unchanged from v2.5.

**A11y:**
- Grid: `role="grid"`, `aria-label="Today's timetable"`. Rows: `role="row"`. Cells: `role="gridcell"`.
- Own-slot cells (Teacher): visually hidden `"Your assigned period"` note via `aria-describedby`.
- Popup: `role="dialog"`, `aria-label="Absent students — {subjectName} Period {N}"`, focus trapped, Escape closes.
- Overdue badge: `aria-label="Attendance overdue"`.

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

**Slot cell Delete button (CR-FE-019):**
- `SlotCell` outer `<div>` has `group` class.
- Delete `<button>` classes: `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all` — hover-reveal pattern.
- Button is always present in DOM. A11y: `aria-label` preserved. Screen readers can still reach the button via keyboard.
- Mobile note: `group-focus-within:opacity-100` exposes the button on tap-focus for touch users.

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

**Goal:** Record attendance for a class period. Admin: any date up to today, any slot. Teacher: today only, own assigned slots only (frontend-enforced date restriction).

**API calls:**
1. `GET /timetable?dayOfWeek={todayDayName}` — Admin (all slots) and Teacher (all slots, filtered client-side to own: `slot.teacherId === currentUser.id`)
2. `GET /students?classId={selectedClassId}&limit=200`
3. Per-student pre-fetch: `GET /students/{studentId}/attendance?from={date}&to={date}&limit=10` — auto-detect `alreadyRecorded`.
4. **At-Risk streaks (CR-FE-016d):** `GET /attendance/streaks?timeSlotId={selectedTimeSlotId}` — fires when `selectedTimeSlotId` is set.
   - `200` → populate "At-Risk Students" panel. Filter client-side: `consecutiveAbsentCount >= AT_RISK_THRESHOLD` (constant: 3).
   - `403 FORBIDDEN` → panel hidden silently.
   - `403 FEATURE_DISABLED` → panel hidden silently.
5. **Create mode:** `POST /attendance/record-class`
   - `201` → toast "{recorded} records saved. ({present} present, {absent} absent, {late} late)."
   - `400 FUTURE_DATE` → inline error
   - `409 CONFLICT` / `ATTENDANCE_ALREADY_RECORDED` → set `alreadyRecorded = true`
   - `403 FEATURE_DISABLED` → full-page gate
   - `403` → toast.
6. **Update mode:** Parallel `PUT /attendance/{recordId}` for each changed student.
   - `200` → invalidate `['student-attendance']`, toast "Attendance updated for {N} student(s)."
   - `400 SAME_STATUS` → inline per-student
   - `400 FUTURE_DATE` → inline

**Local state:** `selectedTimeSlotId`, `selectedDate` (default: today), `defaultStatus`, `exceptions: Map<studentId, AttendanceStatus>`, `submitError`, `successMsg`, `alreadyRecorded: boolean`

**Server state:**
- TQ `['timetable', { dayOfWeek }]` — stale: 5 min. (Teacher: all slots fetched, filtered client-side)
- TQ `['students', classId]` — stale: 2 min.
- TQ `['student-attendance', studentId, date, 'correction']` — stale: 2 min. (per-student)
- TQ `['attendance-streaks', selectedTimeSlotId]` — stale: 5 min. `enabled: !!selectedTimeSlotId`.

**Date picker (LOCKED — CR-FE-023):**
```tsx
const isTeacher = user?.activeRole === 'Teacher'
<input
  type="date"
  value={selectedDate}
  min={isTeacher ? todayISO() : undefined}
  max={todayISO()}
  onChange={...}
/>
```
- **Teacher:** `min=today max=today` — effectively a read-only date display. Teacher cannot select any date other than today.
- **Admin:** `max=today` only — any past date selectable.
- **⚠️ Frontend-only enforcement:** `POST /attendance/record-class` has no server-side today-only guard for Teacher role. A Teacher calling the API directly can submit past dates. Accepted — no backend CR.

**Slot selector (Teacher):** Slot dropdown filtered client-side to `slot.teacherId === currentUser.id`. Teacher sees only own assigned slots for today.

**At-Risk Students panel (CR-FE-016d):** Unchanged — collapsible accordion, `AT_RISK_THRESHOLD = 3`, skeleton while loading, silent on error.

**Student row name (CR-FE-019):** `break-words` on name span.

**Student row status buttons (CR-FE-020-B):** `P`/`A`/`L` on mobile, `Present`/`Absent`/`Late` on `sm+`.

**Single action button:**
```tsx
{alreadyRecorded ? "Update Attendance for N Student(s)" : "Save Attendance for N Student(s)"}
```

**Permissions:**
- Admin: full access, all slots, any past date.
- Teacher: own assigned slots only (client-side filter), today only (date picker locked).
- Student (direct URL): inline "Not authorized for current role."

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

**Stat cards (CR-FE-019):**
- `StatCard` component accepts optional `accentBorder?: string` prop, rendered as `border-l-4 {accentBorder}`.
- Default (no `accentBorder`): `border-l-border` (neutral).
- Call sites: Total Classes → `border-l-blue-400`, Present → `border-l-green-500`, Absent → `border-l-red-500`, Late → `border-l-yellow-500`.

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

**Rankings table (CR-FE-019):**
- Table wrapper: `overflow-x-auto`. Inner div: `min-w-[400px]`.
- Student name cell: `min-w-[120px]` — no `truncate`.

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

**Filter bar layout (CR-FE-019):**
- Mobile: `grid grid-cols-2 gap-3 mb-5 sm:flex sm:flex-wrap` — Class and Subject on row 1, Year and Month on row 2.

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

**Sticky student column (CR-FE-019):**
- Student column header: `sticky left-0 bg-muted/50 z-10 border-r border-border`.
- Student name rowheader: `sticky left-0 bg-background z-10 border-r border-border`. No `truncate` on name or admission number spans — full text visible.

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

### Screen: User Management

All behavior unchanged from v1.8. **ActionBtn label pattern (CR-FE-019):** `label="Edit roles"` + `ariaLabel="Edit roles for {user.name}"` and `label="Delete"` + `ariaLabel="Delete {user.name}"`. Table: `min-w-[560px]` on `<table>` element.

### Screen: Student Management

All behavior unchanged from v1.8. **ActionBtn label pattern (CR-FE-019):** `label="Edit"` + `ariaLabel="Edit {student.name}"`, `label="Delete"` + `ariaLabel="Delete {student.name}"`. Table: `min-w-[900px]` on `<table>` element. Student name `<td>`: `whitespace-nowrap`.

### Screen: Class Management — Unchanged from v1.8

ActionBtn label pattern (CR-FE-019): `label="Edit"` + `ariaLabel="Edit {cls.name}"`, `label="Delete"` + `ariaLabel="Delete {cls.name}"`.

### Screens: Batch & Subject Management — Unchanged from v1.8

ActionBtn label pattern (CR-FE-019): `label="Edit"` + `ariaLabel="Edit {item.name}"`, `label="Delete"` + `ariaLabel="Delete {item.name}"`.

### Screen: School Periods — Unchanged from v1.8

ActionBtn label pattern (CR-FE-019): `label="Edit"` + `ariaLabel="Edit Period {period.periodNumber}"`, `label="Delete"` + `ariaLabel="Delete Period {period.periodNumber}"`.

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

// ABSENTEE POPUP — CR-39 (OpenAPI v4.6.0 / aligned in FE v2.6)
interface AbsenteeEntry {
  studentId: string
  studentName: string
  admissionNumber: string
  /** Consecutive absence streak for this student × subject, including today. Always >= 1. */
  consecutiveAbsentCount: number
}

interface GetAbsenteesResponse {
  timeSlotId: string
  date: string       // YYYY-MM-DD
  classId: string
  subjectId: string
  absentees: AbsenteeEntry[]  // [] when unmarked or no absences. Ordered by studentName ASC.
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
| `['daily-summary', classId, date]` | 2 min | `POST /attendance/record-class`, `PUT /attendance/{recordId}`. `refetchInterval: 5 * 60 * 1000` on Dashboard (CR-FE-023) |
| `['attendance-daily-summary', classId, date]` | 5 min | `POST /attendance/record-class`, `PUT /attendance/{recordId}` |
| `['absentees', timeSlotId, date]` | 2 min | `POST /attendance/record-class`, `PUT /attendance/{recordId}`. Lazy — `enabled` only when popup open. Never retry on 403/404. |
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

- **Per-route boundary:** Every route wrapped in its own `<ErrorBoundary>` from `react-error-boundary`. Inline error card + Retry button.
- **Root boundary:** Single boundary at `App.tsx`.
- **Observability:** Console logs only in dev. Stripped in production.
- **Implementation:** `react-error-boundary` package only. No custom class-component ErrorBoundary (banned §1.6).

---

## 4.2 QUERYCLIENT CONFIGURATION (LOCKED — CR-FE-017)

### QueryClient instantiation

```ts
import { QueryClient, QueryCache } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 401) {
        window.dispatchEvent(new CustomEvent('AUTH_EXPIRED'))
      }
    }
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isAxiosError(error) && error.response?.status) return false // never retry 4xx
        return failureCount < 3 // retry network errors up to 3 times
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false, // never auto-retry mutations
    }
  }
})
```

### Stale-time rules (LOCKED)

Two tiers — applied via per-query `staleTime` override, not global:

| Tier | Queries | staleTime |
|------|---------|-----------|
| **Attendance** (must reflect current state) | `attendance-streaks`, `attendance-daily-summary`, `attendance-monthly-sheet`, `student-attendance` | `0` (always refetch on mount) |
| **Reference data** (stable within session) | `timetable`, `students`, `users`, `classes`, `batches`, `subjects`, `school-periods`, `events`, `sa-tenants`, `sa-features`, `attendance-toppers` | Per §3.3 table |

### Cache clear rules (LOCKED)

- **Logout:** `queryClient.clear()` + clear `localStorage.auth` + reset `AuthContext`
- **Role switch:** `queryClient.clear()` triggered by `ROLE_SWITCHED` custom event listener in `App.tsx` (§4)
- **No partial cache invalidation on role switch** — full clear prevents cross-role data leaks

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
- **Stat card accent borders (CR-FE-019):** Total Classes: `border-l-blue-400`, Present: `border-l-green-500`, Absent: `border-l-red-500`, Late: `border-l-yellow-500`

### Token System (LOCKED — CR-FE-017)

- **CSS custom properties:** HSL format for all color tokens — `--background: H S% L%`, enables runtime opacity modifiers via `bg-background/50`
- **Dark mode:** `.dark {}` class on `<html>` defines fully inverted token set — zero JS theme logic in components; Tailwind reads CSS vars
- **Sidebar tokens:** Independent `--sidebar-background`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border` token set — sidebar themed independently from main surface
- **Border radius:** `--radius: 0.5rem` (shadcn/ui default)
- **`ThemeProvider`** at root: `defaultTheme="system" enableSystem disableTransitionOnChange`

### Typography (LOCKED — CR-FE-017)

- **Font family:** Montserrat, loaded via `@fontsource/montserrat` package (CSS variable `--font-sans`)
- **Installation:** `npm install @fontsource/montserrat`
- **Import in `main.tsx`** (one import per weight used):
  ```ts
  import '@fontsource/montserrat/300.css'
  import '@fontsource/montserrat/400.css'
  import '@fontsource/montserrat/500.css'
  import '@fontsource/montserrat/600.css'
  import '@fontsource/montserrat/700.css'
  ```
- **CSS variable in `global.css`:** `--font-sans: 'Montserrat', sans-serif;`
- **Weights loaded:** 300, 400, 500, 600, 700 (load only weights in use — all 9 weights unnecessary for a management UI)
- **Scale:** Tailwind default `text-xs` through `text-4xl` — no custom scale additions
- **Antialiasing:** Standard browser default (no `.poster-text` class — out of scope)

### Spacing scale — Unchanged from v1.8

### Scrollbar utilities (LOCKED — CR-FE-017)

```css
/* global.css */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 3px; }
.hide-scrollbar { scrollbar-width: none; }
.hide-scrollbar::-webkit-scrollbar { display: none; }
```

### Top-loader bar (LOCKED — CR-FE-017)

Replaces NProgress. Pure CSS — no JS library.

```css
/* Triggered by adding .loading class to <html> during route transitions */
.top-loader {
  position: fixed; top: 0; left: 0;
  width: 100%; height: 3px;
  background: hsl(var(--primary));
  animation: toploader 1s ease-in-out infinite;
  z-index: 9999;
}
@keyframes toploader {
  0% { width: 0; } 70% { width: 70%; } 100% { width: 100%; opacity: 0; }
}
```

Respects `prefers-reduced-motion` — animation disabled when user opts out (§6, A17).

### Sidebar (LOCKED — CR-FE-017)

- Fixed left, `w-60 hidden md:flex flex-col` — CSS-only mobile hide (no JS)
- `SidebarProvider`: `defaultOpen={true}` on `md+` breakpoint, `defaultOpen={false}` on mobile
- **Nav item filtering:** `useMemo(() => menuItems.filter(item => item.allowedRoles.includes(activeRole)), [activeRole])` — zero re-renders on unrelated state
- **`allowedRoles: Role[]`** per nav item in `nav.ts` — single `.filter()` gates visibility
- **Sub-menus:** `SidebarMenuSub / SidebarMenuSubItem / SidebarMenuSubButton` for "Manage" group (6 items: Users, Students, Classes, Batches, Subjects, School Periods)
- **Active state:** `data-active={location.pathname.startsWith(item.url)}` — `useLocation()` from `react-router-dom`, **not** `usePathname()`. Supports `matchPrefix` so `/manage/users` keeps "Manage" group highlighted
- **Icon stroke:** `strokeWidth={1.75}` on all sidebar icons (lucide-react) — consistent, softer than lucide default `2`
- **Auto-close on navigation:** `useEffect` listening on `location.pathname` (React Router v6)
- **Auto-close on outside click:** `mousedown` listener + `useCallback` + cleanup on unmount
- **Brand section:** Small logo mark + `VITE_APP_NAME` from env — white-label tenant name
- **Group divider:** Non-clickable `groupLabel` + `isSubItem` pattern for "Manage" section header
- **Bottom of sidebar:** `RoleSwitcher` (Popover + Command, shown only when `user.roles.length > 1`) + user initials avatar + name + `activeRole` badge + logout
- **Touch target:** `min-h-[40px]` on all nav items (WCAG 2.1 AA)
- **v2.6 sidebar items (CR-FE-023 — Record Attendance restored for Teacher):**
  - Teacher: Dashboard, Timetable, **Record Attendance**, Monthly Sheet
  - Admin: Dashboard, Timetable, Record Attendance, Attendance Summary, Student Attendance History, Monthly Sheet, Manage (group with 6 sub-items), Events
  - Student: Dashboard, Timetable

### BottomTabBar — Mobile (LOCKED — CR-FE-017, CR-FE-020, CR-FE-021)

Shown only on `< md` breakpoint. Sidebar is hidden on mobile.

- **Container:** `fixed bottom-0 left-0 w-full h-16 bg-background border-t flex md:hidden z-20`
- **Source:** Derived from same `nav.ts` array as sidebar — **not a separate hardcoded list**
- **Max tabs:** 5 visible. Overflow items collapse into "More" Sheet.
- **Active indicator:** `strokeWidth={2.5}` + `font-medium` label (active) vs `strokeWidth={1.75}` (inactive). No filled icon variants — lucide-react has none
- **Active detection:** `useLocation().pathname` from `react-router-dom`
- **Label:** Truncate at 10 characters, `text-[10px]` — e.g. "Monthly Sheet" → "Monthly"
- **A11y:** `role="tablist"` on container, `aria-label` per tab, `aria-current="page"` on active tab, `min-h-[40px]` on each tab

**Derived lists (CR-FE-021 — LOCKED):**

```ts
// Step 1: non-sub-items for tab slots
const filteredNonSubItems = BOTTOM_TAB_NAV_ITEMS.filter(item =>
  item.allowedRoles.includes(activeRole)
)
const visibleTabs = filteredNonSubItems.slice(0, 5)
const visibleUrls = new Set(visibleTabs.map(t => t.url))

// Step 2: ALL role-filtered items not already a visible tab (includes sub-items)
const moreItems = NAV_ITEMS.filter(item =>
  item.allowedRoles.includes(activeRole) && !visibleUrls.has(item.url)
)
```

This is the **only correct derivation**. Using `BOTTOM_TAB_NAV_ITEMS.slice(5)` for overflow is a freeze violation — it silently drops all `isSubItem` routes from mobile.

**"More" tab (CR-FE-020 — always rendered):**

The "More" tab is **always rendered** unconditionally.

"More" Sheet structure:
1. **Header:** "More" title + close button
2. **Nav overflow section** (rendered when `moreItems.length > 0`):
   - Items rendered in `NAV_ITEMS` order. Group headers rendered when `item.groupLabel` changes.
   - Group header: `<p className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{item.groupLabel}</p>`
   - Item row: `pl-6` when `item.isSubItem`, `pl-3` otherwise. Full `item.label` always shown (no truncation in sheet).
   - Active item: `bg-primary text-primary-foreground`. Inactive: `hover:bg-muted hover:text-foreground`.
3. **Divider** (`<div className="border-t mx-4 my-2">`) — always rendered
4. **User profile section** (always rendered):
   - User initials avatar (`h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-medium`) + name + `<RoleBadge activeRole>` inline
   - `<RoleSwitcher variant="inline">` — rendered only when `user.roles.length > 1`
   - Logout button: `"Log out"` label, `LogOut` lucide icon, `text-destructive hover:bg-destructive/10`. On click: fire-and-forget `POST /auth/logout` → `queryClient.clear()` → clear `localStorage.auth` → navigate `/login`

**Result per role (CR-FE-022 updated):**
- **Admin:** `moreItems` = Users, Students, Classes, Batches, Subjects, School Periods, Events (7 sub-items, all under "Manage" group header). All `/manage/*` routes reachable on mobile. Admin's 5 non-sub-items (Dashboard, Timetable, Record Attendance, Attendance Summary, Monthly Sheet) occupy all 5 tab slots.
- **Teacher:** `moreItems` = empty. Teacher now has 3 non-sub-items (Dashboard, Timetable, Monthly Sheet) — all fit in 5 tabs. Nav section hidden. Sheet shows only divider + user profile.
- **Student:** `moreItems` = empty. Sheet shows only divider + user profile.

**Logout in "More" Sheet — implementation rules:**
- Same logout logic as sidebar: fire-and-forget, never block UI on network failure
- `queryClient.clear()` called before navigate
- `localStorage.auth` cleared before navigate
- No `window.location.reload()` (banned §13)

### `nav.ts` — Single Source of Truth (LOCKED — CR-FE-017, path corrected CR-FE-019)

`src/config/nav.ts` is the **only** place nav items are defined. Both sidebar and BottomTabBar derive from it.

```ts
interface NavItem {
  label: string
  url: string
  icon: LucideIcon
  allowedRoles: Role[]
  isSubItem?: boolean
  groupLabel?: string
}

export const NAV_ITEMS: NavItem[] = [/* ... */]

// All non-subitem routes — role filtering + slice(0,5) happens at render time in BottomTabBar
// Do NOT slice here — slicing before role filter would include forbidden-role items
export const BOTTOM_TAB_NAV_ITEMS = NAV_ITEMS.filter(item => !item.isSubItem)

// Usage in BottomTabBar component:
// const visibleTabs = BOTTOM_TAB_NAV_ITEMS
//   .filter(item => item.allowedRoles.includes(activeRole))
//   .slice(0, 5)
```

**Rule:** Adding a route without adding it to `nav.ts` is a freeze violation.

### Role Badge Color Mapping (LOCKED — CR-FE-017)

Used in TopBar, user popover, sidebar bottom identity anchor, and User Management table.

| Role | Badge variant |
|------|--------------|
| Teacher | `bg-blue-100 text-blue-800` |
| Admin | `bg-purple-100 text-purple-800` |
| Student | `bg-green-100 text-green-800` |
| SuperAdmin | `bg-red-100 text-red-800` |

### Component standards — Unchanged from v1.8

### Component inventory (MVP)

Button, Input, Select, Checkbox, RadioGroup, Switch, Badge, Card, Table, Sheet, Dialog, Popover, DropdownMenu, Toast (Sonner), Skeleton, Avatar, Tooltip, Copy button, **Accordion**, **Tabs**.

Shared components (see §5.5): `<PageHeader>`, `<DataCard>`, `<EmptyState>`, `<InlineError>`, `<LoadingSpinner>`, `<ConfirmDialog>`, `<ToastProvider>` / `useAppToast`, `<RoleBadge>`, `<SectionCard>`.

Error boundary: `<ErrorBoundary>` from `react-error-boundary` package (not a custom component).

### Responsiveness — Unchanged from v1.8

---

## 5.5 SHARED COMPONENT SPECIFICATIONS (LOCKED — CR-FE-017, CR-FE-019)

These components are **mandatory shared implementations**. No per-screen bespoke equivalents.

### SP1 — `<PageHeader title actions?>`

- Root element: `<div className="flex items-center justify-between mb-6">`
- `title` renders as `<h1>` — the **only** `h1` on any screen
- `actions` slot: right-aligned, flex row
- Mobile: title hidden (`hidden md:block`) — TopBar owns mobile screen title
- Used on every protected screen

### SP2 — `<DataCard>`

- `<Card>` wrapper with `<CardHeader>` + `<CardContent>` + optional `<CardFooter>`
- Used for: dashboard stat bar, upcoming events card, class rankings card, student degraded state card

### SP3 — `<EmptyState icon message action?>`

- Centered layout, illustration-free (no image assets in scope)
- `message`: string. `action`: optional CTA button
- Used on every screen with a data list or table

### SP4 — `<InlineError message>`

- `<p className="text-destructive text-sm mt-1">`
- Used for: field-level form errors, 403 inline messages (Monthly Sheet teacher restriction), section-level fetch errors
- **Not** a toast — inline only

### SP5 — `<LoadingSpinner size?>`

- Centered `<Loader2>` from `lucide-react` with `animate-spin`
- Default size: `h-6 w-6`. Accepts `size` prop for larger contexts

### SP6 — `<ConfirmDialog title description onConfirm onCancel>`

- Radix `AlertDialog` wrapper
- Used for: delete timetable slot, promote/graduate class, delete event, bulk-delete users, logout confirmation
- Radix handles focus trap + Escape key natively
- `aria-describedby` on confirm button pointing to `description` text
- **This is the only confirm pattern.** `useConfirm()` imperative hook is banned (§1.6)

### SP7 — `useAppToast()`

- Wraps shadcn/ui `useToast()` / Sonner
- Exposes only: `success(message)` and `mutationError(message)`
- **Toasts for mutation feedback only** (create/update/delete success, mutation errors)
- **Never** for fetch/GET errors — those are inline via SP4 or screen-level error state
- Raw `useToast()` / `toast()` calls outside `useAppToast()` are a freeze violation

### SP8 — `<RoleBadge role>`

- `<Badge>` with color mapping from §5 Role Badge Color Mapping table
- Used in: TopBar, user popover, sidebar bottom identity, User Management table

### SP9 — `<SectionCard title children>`

- Lighter card for grouping subsections within a screen — no full `<Card>` chrome
- Used for: At-Risk Students panel, Class Rankings card sections, Monthly Sheet filter bar

### SP10 — Error Boundary

- **Implementation:** `<ErrorBoundary>` imported from `react-error-boundary` package
- **No custom class-component ErrorBoundary** — banned (§1.6)
- Per-route: inline error card + Retry button as `fallbackRender`
- Root: minimal fallback at `App.tsx`

### SP11 — `<ActionBtn>` (CR-FE-019)

Located in `src/components/manage/shared.tsx`. Used on all manage screen table rows.

```ts
interface ActionBtnProps {
  onClick: () => void
  label: string          // visible button text — MUST be short: "Edit", "Delete", "Edit roles"
  ariaLabel?: string     // REQUIRED when label alone lacks context (e.g. "Edit {student.name}")
  variant?: 'default' | 'destructive'
  disabled?: boolean
}
```

- `aria-label` resolves to `ariaLabel ?? label`.
- **Rule:** When `label` is a short generic word ("Edit", "Delete"), `ariaLabel` **must** include the target name for screen reader context.
- **Forbidden:** `label={\`Edit ${item.name}\`}` without `ariaLabel` — verbose visible text is a freeze violation (§13).

---

## 5.6 HOOK INVENTORY (LOCKED — CR-FE-017)

All custom hooks live in `src/hooks/`. No hook outside this list is authorised without a new Freeze version.

| Hook | Purpose | Notes |
|------|---------|-------|
| `useAuth()` | Reads `AuthContext`. Exposes: `user`, `token`, `activeRole`, `setActiveRole`, `logout`, `isAuthenticated`, `isExpired` | All components use this. No direct `localStorage` reads outside `src/api` |
| `usePermission(requiredRole: Role)` | Returns `boolean` — `activeRole === requiredRole` | For conditional renders. Prevents inline `activeRole === 'Admin'` checks everywhere |
| `useDebounce(value, delay)` | Debounces search input before API call | Used in User Management and Student Management search fields. Prevents per-keystroke requests |
| `useTodaySlots(role)` | Derives today's timetable slots filtered by role from TQ cache | Shared between Dashboard and Record Attendance. No extra fetch — reads existing `timetable` query cache |
| ~~`useConfirm()`~~ | **BANNED** | Duplicates SP6 `<ConfirmDialog>` declarative pattern. Use SP6 |
| ~~`useLocalStorage(key, default)`~~ | **BANNED** | Only `localStorage.auth` and `localStorage.sa-auth` are authorised. Generic hook enables undisciplined storage use |

---

## 5.7 PRINT RULES (LOCKED — CR-FE-017)

```css
@media print {
  /* Base — color-adjust must be inside a selector, not bare */
  *, *::before, *::after {
    font-size: 12px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Hide chrome */
  aside, nav, header, [data-radix-portal], .hide-on-print { display: none !important; }

  /* Fully expand scrollable content */
  .scrollable { overflow: visible !important; max-height: none !important; }

  /* Top-loader */
  .top-loader { display: none; }
}
```

**Per-screen print rules:**

| Screen | Print behaviour |
|--------|----------------|
| Monthly Sheet | Primary print target. Full student × day grid expanded (`print:block` on grid container). `overflow-x-auto` removed |
| Student History | Table fully expanded |
| Dashboard panels (At-Risk, Class Rankings) | **Do NOT force-expand** — `print:hidden` on collapsible panels. Dashboard is not a print target |
| All other screens | Default — nav/sidebar hidden, content visible |

**Print trigger:** `window.print()` button on Monthly Sheet and Student History only. No server-side PDF generation.

---

## 6. ACCESSIBILITY (A11y Baseline — LOCKED)

**Target:** WCAG 2.1 AA

### Mandatory behaviors (v2.0 — complete locked list)

**Navigation & structure:**
- `<SkipLink href="#main-content">` as first DOM element — targets `id="main-content"` on `<main>` (§2 L6)
- `role="tablist"` on BottomTabBar container, `aria-label` per tab, `aria-current="page"` on active tab
- Heading hierarchy: one `<h1>` per page (via SP1 `<PageHeader>`), sections use `<h2>` / `<h3>`. No skipped levels
- No `tabindex > 0` anywhere — natural DOM order only

**Focus & keyboard:**
- Keyboard navigation works for all flows
- Visible focus ring — `focus-visible:ring-2` — never `outline: none` without replacement
- Dialog focus trap + Escape handling — Radix `Dialog` / `AlertDialog` handles natively
- `autoFocus` on first field of modal forms; Radix handles trap automatically

**Interactive elements:**
- `min-h-[40px] min-w-[40px]` on **all** interactive elements (buttons, tabs, row actions, nav items) — WCAG minimum touch target
- `aria-hidden="true"` on all decorative lucide icons beside text labels — prevents screen reader double-reading
- Color is never the sole indicator — always pair with icon or text label (SB1 badges use text label + color)
- **ActionBtn (CR-FE-019):** When `label` is short and generic ("Edit", "Delete"), `ariaLabel` prop is mandatory — screen reader must hear the target name

**Async / loading:**
- `aria-live="polite"` on all async status regions (loading → content transitions)
- `aria-busy="true"` on loading containers while fetching

**Forms:**
- `htmlFor` on all form labels
- `aria-describedby` linking error messages to fields
- `role="alert"` on global form error messages; `aria-describedby` on field-level errors
- Form errors announced — screen readers must hear validation feedback

**Screen-specific (v1.9 — carried forward):**
- At-Risk Students accordion: `aria-expanded`, `aria-controls`
- Streak badge: `aria-label="{N} consecutive absent day(s) for {subjectName}"`
- At-Risk panel: `role="region"` with `aria-label="At-risk students"`
- Class Rankings accordion: `aria-expanded`
- Upcoming Events list: `role="list"`, each event `role="listitem"`
- Attendance Summary tabs: `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"`
- Monthly Sheet grid: `role="grid"`, `role="row"`, `role="gridcell"`, corrected asterisk: `aria-label="Corrected record"`, status: `aria-label="{status}"` (not color-only)
- Event type badges: `aria-label="{type}"`
- Events delete confirm: focus trap, Escape cancels, confirm button `aria-describedby` warning text
- Timetable grid: `role="grid"`, empty cell: `aria-label="Add slot for {dayOfWeek} Period {n}"`
- Timetable Delete button (CR-FE-019): `opacity-0` visually but always in DOM — keyboard users can reach it via Tab; `aria-label` unchanged
- "More" Sheet (CR-FE-020-A): user profile section in sheet has `aria-label="User account"` on its container region. Logout button: `aria-label="Log out"`. RoleSwitcher in sheet: same aria spec as sidebar variant.
- Record Attendance status buttons (CR-FE-020-B): abbreviated `P`/`A`/`L` spans both carry `aria-hidden="true"`. The hidden `<input type="radio">` `aria-label="{status} for {student.name}"` is the sole accessible name — full status always announced.

**Motion:**
- `prefers-reduced-motion`: disable `animate-spin`, top-loader animation, and all transitions for users who opt out
- Use Tailwind `motion-safe:` / `motion-reduce:` utilities — **not** raw CSS `@media (prefers-reduced-motion)`

**Images & icons:**
- `alt=""` on decorative images, meaningful `alt` on informative
- `aria-hidden="true"` on all decorative lucide icons (those beside a visible text label)
- Meaningful `aria-label` on icon-only buttons

**Tables:**
- `aria-label` on all tables, `scope="col"` on all column headers

### Testing

- `@axe-core/playwright` automated checks in CI on all 18 tenant app screens + 3 SuperAdmin screens
- Run as part of E2E suite (Playwright already in stack)
- CI fails if any WCAG 2.1 AA violation detected on key screens

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
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.yourdomain.com; frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

> **⚠ Build note (E3 fix):** Cloudflare Pages `_headers` is a **static file** — Vite env vars (`VITE_API_BASE_URL`) are never interpolated into it. The `connect-src` value must be a literal domain. Options:
> - **Option A (recommended):** Use a `_headers` build script that writes the correct domain per environment before deploy. Add to `package.json` build command: `npm run build:headers && npm run build`.
> - **Option B:** Hardcode the production API domain in `_headers` and accept that staging uses the same CSP. Acceptable for a solo project.
> - **Option C:** Use Cloudflare Pages Transform Rules to set CSP headers dynamically (no static file needed).
> Lock the chosen option before implementation. Default assumption: **Option A**.

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
- **CR-FE-019:** ActionBtn renders short label text. `aria-label` on button matches `ariaLabel` prop. Monthly Sheet student column is sticky on horizontal scroll. Timetable Delete button invisible until hover, reachable by keyboard.
- **CR-FE-020-A:** "More" tab visible on all mobile viewports regardless of nav item count. Logout button present in "More" Sheet → clicking clears auth, redirects `/login`, cache cleared. RoleSwitcher present in sheet only when `user.roles.length > 1`. No logout button visible on desktop (sidebar handles it). No `window.location.reload()` on logout.
- **CR-FE-020-B:** At 375px, status buttons show `P`/`A`/`L`. At 640px+, show `Present`/`Absent`/`Late`. Screen reader announces full status name from radio `aria-label`. Student name no longer wraps badly at 375px with 3 status buttons.
- **CR-FE-021:** Admin: "More" Sheet nav section shows Users, Students, Classes, Batches, Subjects, School Periods, Events under "Manage" group header. All `/manage/*` routes navigable from mobile. Teacher: More sheet nav section empty (all Teacher items fit in 5 tabs). Student: More sheet nav section empty. `BOTTOM_TAB_NAV_ITEMS.slice(5)` is not used anywhere for More sheet overflow derivation.
- **CR-FE-023:** (a) Record Attendance appears in Teacher sidebar and BottomTabBar. (b) Teacher date picker: `min` and `max` both set to today — cannot select another date. Admin: `max=today`, no `min`. (c) Dashboard renders `TodayTimetableGrid` for Admin and Teacher; slot card list gone. (d) Grid: marked cells `bg-green-100`, unmarked `bg-yellow-50`, overdue unmarked `bg-orange-50`, empty `bg-muted/20`. (e) Absent badge renders only when `attendanceMarked:true && absentCount > 0`. (f) Absent badge click opens Radix Popover with student names, admission numbers, streak badges. Popup header shows `"{N} absent of {totalStudents} students"`. (g) Admin: clicking any populated cell → navigates to `/attendance/record?slotId=X`. Teacher: clicking own slot → navigates. Teacher: clicking other's slot → no navigation. (h) Teacher own slots have `border-l-2 border-l-primary` accent. (i) `ClassRankingsCard` rendered for both Admin and Teacher. Admin gets all today's classIds; Teacher gets own classIds only. (j) Auto-refresh every 5 min on timetable + daily-summary. Manual ↻ button triggers immediate refetch. "Last updated: HH:MM" timestamp visible. (k) `TodayTimetableGridSkeleton` shown while loading — grid-shaped, not slot card list. (l) Mobile toggle `⊞ Grid / ≡ List` visible on `< sm` viewports. (m) Grid section `max-w-5xl`; other sections `max-w-3xl`. (n) Class name column sticky left on mobile scroll. (o) Student dashboard unchanged.

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
│   ├── components/   # shared UI components (PageHeader, ActionBtn, ConfirmDialog, etc.)
│   ├── config/
│   │   └── nav.ts    # SINGLE SOURCE for all nav items (sidebar + BottomTabBar)
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── timetable/
│   │   ├── attendance/
│   │   │   ├── record/
│   │   │   ├── summary/
│   │   │   ├── history/
│   │   │   └── monthly-sheet/    # CR-FE-016f
│   │   ├── events/               # CR-FE-016g
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
- Use `window.location.reload()` on role switch — role switch is context + `queryClient.clear()` only (CR-FE-017)
- Write a custom class-component `ErrorBoundary` — use `react-error-boundary` package (CR-FE-017)
- Use `useLocalStorage()` generic hook — only `localStorage.auth` / `localStorage.sa-auth` are authorised (CR-FE-017)
- Use `useConfirm()` imperative hook — use SP6 `<ConfirmDialog>` everywhere (CR-FE-017)
- Define nav items outside `src/config/nav.ts` — sidebar and BottomTabBar must derive from the same array (CR-FE-017, path corrected CR-FE-019)
- Use verbose `label` prop on `<ActionBtn>` without `ariaLabel` — e.g. `label={\`Edit ${item.name}\`}` is banned; use `label="Edit" ariaLabel={\`Edit ${item.name}\`}` (CR-FE-019)
- Render "More" tab conditionally on `overflowTabs.length > 0` — "More" tab must always render; logout and role switch must be accessible on mobile via the "More" Sheet (CR-FE-020-A)
- Duplicate logout logic outside the shared pattern — mobile logout in "More" Sheet must use identical fire-and-forget + `queryClient.clear()` + `localStorage.auth` clear + navigate pattern as sidebar logout (CR-FE-020-A)
- Render status button text without responsive abbreviation in `StudentRow` — full text `{status}` without `sm:hidden`/`hidden sm:inline` split is banned on mobile (CR-FE-020-B)
- Derive More Sheet overflow from `BOTTOM_TAB_NAV_ITEMS.slice(5)` — this silently drops all `isSubItem` routes (Users, Students, Classes, etc.) from mobile; overflow must derive from `NAV_ITEMS` filtered by role minus `visibleUrls` (CR-FE-021)
- Show "Record Attendance" nav item to Student — only Admin and Teacher may access this route (CR-FE-023)
- Allow Teacher to select past dates in the Record Attendance date picker — Teacher `min=max=today` is locked (CR-FE-023)
- Apply Teacher `min=max=today` restriction to Admin — Admin date picker is `max=today` with no `min` (CR-FE-023)
- Filter timetable slots by `teacherId` in the `GET /timetable` API call — role filtering is client-side only; `GET /timetable?dayOfWeek=today` fetches all slots for both Admin and Teacher (CR-FE-023)
- Render `TodayTimetableGrid` for Student — Student dashboard uses existing `StudentDashboard` component unchanged (CR-FE-023)
- Make absent badge clickable when `attendanceMarked: false` — badge is only rendered when `attendanceMarked: true && absentCount > 0` (CR-FE-023)
- Fire `GET /attendance/absentees` eagerly on mount — it is lazy, `enabled: popupSlotId === timeSlotId` (CR-FE-023)
- Navigate to Record Attendance when Teacher clicks another teacher's slot cell — Teacher cell navigation only on `slot.teacherId === currentUser.id` (CR-FE-023)
- Show `ClassRankingsCard` toppers for all classIds to Teacher — Teacher's rankings card uses only own assigned classIds (teacher-filtered slots) (CR-FE-023)
- Call `toast()` with raw API error message content — `toast.error(...)` must use a generic user-safe string only (CR-FE-024)
- Show toast on read-only query failures — toasts are for mutation `onSuccess`/`onError` only; query errors use inline error states (CR-FE-024)
- Use `window.confirm()` for destructive action confirmation — `<ConfirmDialog>` from `src/components/ConfirmDialog.tsx` is the only allowed confirmation mechanism (CR-FE-017, reinforced CR-FE-025)
- Fire a destructive mutation (delete single, bulk delete, Graduate) without an interstitial `<ConfirmDialog>` — all destructive actions must be guarded (CR-FE-025)
- Add a new `queryFn` parameter or query key segment for search/filter on manage screens — filtering is client-side `useMemo` only; no API changes (CR-FE-026)
- Use `aria-hidden` on the attendance tier text badge ("High"/"Medium"/"Low") — badge is the authoritative label, not decoration (CR-FE-027)
- Use `tabindex` > 0 anywhere — prohibited globally (CR-FE-017, reinforced CR-FE-027)
- Omit `aria-live="polite"` from the class rankings container in AttendanceSummaryPage — live region is mandatory for dynamic rank updates (CR-FE-027)

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
- **New Freeze version:** {e.g., v2.2}
- **Backend Freeze dependency:** unchanged / updated → backend Freeze version {value}
- **OpenAPI dependency:** unchanged / updated → new OpenAPI version {value}

**Billing rule:** Self-funded solo project — no external billing.
**Response SLA for change requests:** 24 hours (self-review).

---

### CR-FE-024 — Toast Notification Standardization

- **Requested change:** Call `toast.success(...)` in every mutation `onSuccess` handler and `toast.error(...)` for network/5xx failures in every `onError` handler across all manage pages. Inline field-level errors are unchanged.
- **Reason:** `<Toaster>` is mounted in `App.tsx` and `sonner` is already a project dependency, but no page ever calls it — users receive zero visual feedback after creates, updates, or deletes.
- **Scope impact:** RecordAttendancePage, TimetablePage, UsersPage, StudentsPage, ClassesPage, EventsPage, BatchesPage, SubjectsPage, SchoolPeriodsPage — mutation `onSuccess`/`onError` handlers only. No layout, routing, or API changes.
- **Timeline impact:** +1 day
- **Cost impact:** Self-funded / N/A
- **Risk impact:** Low — additive; no existing behaviour removed
- **Decision:** Approved
- **New Freeze version:** v2.7
- **Backend Freeze dependency:** unchanged — Backend Freeze v4.8
- **OpenAPI dependency:** unchanged — OpenAPI v4.8.0

**Implementation contract (LOCKED):**
- Import: `import { toast } from "sonner"` — no new dependency
- Success message pattern: `toast.success("<Entity> <past-tense verb> successfully.")` — e.g., `"Attendance recorded successfully."`, `"User deleted successfully."`
- Error message pattern: `toast.error("Something went wrong. Please try again.")` — generic; do NOT surface raw API error messages to users
- Trigger: `onSuccess` for all create / update / delete mutations; `onError` only for network errors and 5xx responses — 4xx validation errors continue to render inline
- No toast on read-only queries

---

### CR-FE-025 — Confirmation Dialogs for Destructive Actions

- **Requested change:** Gate every destructive mutation (delete, bulk delete, Graduate class) behind `<ConfirmDialog>` using `pendingDelete` / `pendingAction` state — exactly the pattern already used in EventsPage.
- **Reason:** UsersPage, StudentsPage, ClassesPage, and TimetablePage fire their delete mutations with zero confirmation. The Graduate/Promote action in ClassesPage is irreversible and equally unguarded. The shared `<ConfirmDialog>` component exists at `src/components/ConfirmDialog.tsx` but is unused on these screens.
- **Scope impact:**

  | Screen | Actions to guard |
  |--------|-----------------|
  | UsersPage | Delete single user, bulk delete |
  | StudentsPage | Delete single student, bulk delete |
  | ClassesPage | Delete single class, bulk delete, **Graduate action** (mark as critical in dialog copy) |
  | TimetablePage | Delete slot (hover-triggered — especially easy to misclick) |

- **Timeline impact:** +1 day
- **Cost impact:** Self-funded / N/A
- **Risk impact:** Low — wraps existing mutations; mutations themselves are unchanged
- **Decision:** Approved
- **New Freeze version:** v2.7
- **Backend Freeze dependency:** unchanged — Backend Freeze v4.8
- **OpenAPI dependency:** unchanged — OpenAPI v4.8.0

**Implementation contract (LOCKED):**
- Reference implementation: `EventsPage.tsx` — copy the `pendingDelete` state + `<ConfirmDialog onConfirm={...} onCancel={...}>` pattern verbatim
- Component: `src/components/ConfirmDialog.tsx` — no modifications to the component itself
- Graduate dialog copy must include a destructive-intent warning, e.g.: _"This will graduate all students in this class. This action cannot be undone."_
- Bulk delete dialog copy must state the count: _"Delete {n} selected users? This action cannot be undone."_
- `onConfirm` callback fires the mutation; `onCancel` clears `pendingDelete` state
- Forbidden: Do not use `window.confirm()` — `<ConfirmDialog>` only (CR-FE-017 ban preserved)

---

### CR-FE-026 — Search & Filter Gaps on Manage Screens

- **Requested change:** Add client-side search and filter controls to StudentsPage, ClassesPage, and EventsPage using the `useMemo` filter pattern already implemented in UsersPage.
- **Reason:** StudentsPage has no search at all — critical when a school has 500+ students. ClassesPage and EventsPage also lack search. All data is already loaded via TanStack Query; zero API changes are needed.
- **Scope impact:**

  | Screen | Controls to add |
  |--------|----------------|
  | StudentsPage | Text search (name / admission no.) + Class `<select>` filter + Batch `<select>` filter |
  | ClassesPage | Text search (class name) + Batch `<select>` filter |
  | EventsPage | Text search (event title) + Type `<select>` filter |

- **Timeline impact:** +1 day
- **Cost impact:** Self-funded / N/A
- **Risk impact:** Low — additive; existing query/render pipeline is read-only
- **Decision:** Approved
- **New Freeze version:** v2.7
- **Backend Freeze dependency:** unchanged — Backend Freeze v4.8
- **OpenAPI dependency:** unchanged — OpenAPI v4.8.0

**Implementation contract (LOCKED):**
- Reference implementation: `UsersPage.tsx` — copy `searchQuery` state + `useMemo` filter pattern verbatim
- Filter state: `const [searchQuery, setSearchQuery] = useState("")` + one `useState` per `<select>` filter
- `useMemo` input: the `.data` array from the existing TanStack Query result — do NOT add new queries
- Filter logic: case-insensitive `includes` on the relevant string fields; `<select>` filters are exact-match on ID
- UI placement: filter bar above the table, same layout as UsersPage
- Empty state: render existing empty-state component / message when filtered result is zero rows
- Forbidden: Do not add `queryFn` parameters or query key segments for search — client-side only (no API changes)

---

### CR-FE-027 — Key Accessibility Improvements

- **Requested change:** Fix four targeted WCAG 2.1 AA gaps identified in the codebase audit.
- **Reason:** v2.0 (CR-FE-017) locked WCAG 2.1 AA as the A11y baseline. The four issues below are confirmed violations against that baseline.
- **Scope impact:** Layout.tsx, AttendanceSummaryPage.tsx, TimetablePage.tsx, MonthlySheetPage.tsx
- **Timeline impact:** +0.5 days
- **Cost impact:** Self-funded / N/A
- **Risk impact:** Low — no logic changes; purely additive markup and CSS
- **Decision:** Approved
- **New Freeze version:** v2.7
- **Backend Freeze dependency:** unchanged — Backend Freeze v4.8
- **OpenAPI dependency:** unchanged — OpenAPI v4.8.0

**Implementation contract (LOCKED — four sub-items):**

**A. Skip link (Layout.tsx)**
- `id="main-content"` already exists on the main wrapper
- Add as the **first child** of the layout root: `<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground">Skip to main content</a>`
- Keyboard test: Tab on any page → skip link becomes visible → Enter → focus jumps to `#main-content`

**B. `aria-live` on dynamic rankings (AttendanceSummaryPage.tsx)**
- Add `aria-live="polite"` and `aria-atomic="false"` to the container `<div>` wrapping the class rankings list
- Screen reader must announce updates when ranking data re-fetches without a full page reload

**C. Text badge alongside percentage bar colour (AttendanceSummaryPage.tsx)**
- The attendance percentage bar currently encodes High/Medium/Low status via colour only (WCAG 1.4.1 violation)
- Add a visible text badge (`<span>`) alongside the bar displaying the tier label: `"High"` / `"Medium"` / `"Low"`
- Badge must also be present for screen readers — no `aria-hidden` on it
- Colour-only encoding is supplemental; text label is authoritative

**D. Today's column highlight (TimetablePage.tsx + MonthlySheetPage.tsx)**
- TimetablePage: compare each column's day name to `new Date().toLocaleDateString("en-US", { weekday: "long" })`; apply a visible ring/border class (e.g., `ring-2 ring-primary`) to today's column header and cells
- MonthlySheetPage: compare each column's date number to `new Date().getDate()`; apply the same ring/border highlight
- Provide a brief visible legend label (e.g., `"Today"` text or `aria-label="Today"` on the highlighted header) — not colour-only

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
- **v2.0** (2026-03-09): CR-FE-017 — Scofist Pattern Adoption. No API/backend changes. Implementation architecture locked: CSS token system, Montserrat font, top-loader, scrollbar utilities, sidebar implementation rules, BottomTabBar spec, `nav.ts` single-source rule, role badge color mapping, shared component specs (SP1–SP9 + react-error-boundary for SP10), hook inventory (HK1–HK6 with HK4/HK5 banned), QueryClient config (QC1–QC4, TanStack Query v5 `QueryCache({onError})` pattern), print rules (PR1–PR7), A11y additions (skip link, aria-live/busy, prefers-reduced-motion, aria-hidden on decorative icons, heading hierarchy, no tabindex>0, axe-core/playwright in CI), 5 new forbidden patterns. 6 Scofist patterns explicitly rejected.
- **v2.1** (2026-03-09): CR-FE-018 — v2.0 Error Corrections. 6 bugs fixed: E1 `next/font` → `@fontsource/montserrat`, E2 invalid bare CSS in print block, E3 `VITE_API_BASE_URL` literal in static CSP `_headers`, E4 `class=` → `className=` in SP1/SP4 specs, E5 `BOTTOM_TAB_ITEMS` static pre-role-filter slice → `BOTTOM_TAB_NAV_ITEMS` with runtime filter, E6 corrupted v2.0 history entry. 1 omission fixed: O1 `next-themes` added to §1.6 stack table. No scope, API, or backend changes.
- **v2.2** (2026-03-09): CR-FE-019 — UI Polish & Mobile Fixes. No API/backend/scope changes. CSS/props only. Changes: (A) `ActionBtn` SP11 formalised with `ariaLabel?` prop — separates visible label from accessible name; (B) all manage screen `<ActionBtn>` call sites updated to short labels + `ariaLabel`; (C) Students table `min-w-[900px]` + `whitespace-nowrap` on name `<td>`, Users table `min-w-[560px]`; (D) Monthly Sheet filter bar `grid grid-cols-2` on mobile, student column sticky with `sticky left-0 bg-background z-10 border-r`, `truncate` removed; (E) Attendance Summary `StatCard` `accentBorder?` prop with per-type left-border colors, rankings table `overflow-x-auto` + `min-w-[400px]` + name cell `min-w-[120px]`; (F) Record Attendance `StudentRow` name `break-words` instead of `truncate`; (G) Timetable `SlotCell` Delete button hover-reveal via `group`/`opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`; (H) path correction `src/app/nav.ts` → `src/config/nav.ts` in §5, §11, §13.
- **v2.3** (2026-03-10): CR-FE-020 — Mobile UX gaps. No API/backend/scope changes. (020-A) "More" tab always rendered unconditionally; "More" Sheet gains persistent user profile section at bottom: avatar + name + `<RoleBadge>` + `<RoleSwitcher>` (conditional on `user.roles.length > 1`) + Logout button with identical fire-and-forget + `queryClient.clear()` + `localStorage.auth` clear + navigate logic as sidebar. Fixes logout and role-switch inaccessibility on mobile. (020-B) `StudentRow` status buttons responsive abbreviation: `P`/`A`/`L` on mobile (`sm:hidden`) vs `Present`/`Absent`/`Late` on `sm+` (`hidden sm:inline`), both spans `aria-hidden`; button `min-w-[32px] sm:min-w-[60px]`; radio `aria-label` unchanged. Fixes student name row crowding at 375px.
- **v2.4** (2026-03-10): CR-FE-021 — More Sheet overflow source fix. No API/backend/scope changes. Root cause: `BOTTOM_TAB_NAV_ITEMS = NAV_ITEMS.filter(!isSubItem)` yields exactly 5 Admin items — all 5 consumed by `visibleTabs`, leaving `overflowTabs = []`. The 7 sub-items (Users, Students, Classes, Batches, Subjects, School Periods, Events) were completely unreachable on mobile. Fix: More Sheet overflow derived from `NAV_ITEMS.filter(role).filter(url not in visibleUrls)` — includes sub-items. Group headers rendered on `groupLabel` change (same pattern as Sidebar). Sub-items indented with `pl-6`. Banned: `BOTTOM_TAB_NAV_ITEMS.slice(5)` as overflow source.
- **v2.5** (2026-03-10): CR-FE-022 — Record Attendance: Admin-only access + Dashboard role separation. Breaking scope change. Teacher loses Record Attendance entirely. Changes: (A) nav.ts Record Attendance `allowedRoles` → `["Admin"]`; (B) Admin dashboard: slot card list removed, timetable query retained to feed `AdminStatBar`; (C) Teacher dashboard `SlotCard`: "Record Attendance" CTA button removed — slot cards read-only; (D) `RecordAttendancePage` simplified to Admin-only; (E) Stories + roles updated.
- **v2.6** (2026-03-10): CR-FE-023 — Dashboard redesign + Teacher Record Attendance restore. Aligned to Backend v4.8 / OpenAPI v4.8.0 (CR-40: Teacher `daily-summary` unrestricted; CR-41: Teacher `absentees` unrestricted). Changes: (A) Record Attendance nav restored for Teacher — `allowedRoles: ["Admin","Teacher"]`; Teacher date picker `min=max=today` frontend-only; (B) `SlotCard` list removed for both Admin and Teacher; replaced by `TodayTimetableGrid` — Y-axis classes, X-axis periods, cell colour from `daily-summary`, absent count badge, absentee Popover lazy-loaded from `/absentees`; (C) `AdminStatBar` kept above grid for Admin; (D) `ClassRankingsCard` now rendered for Admin (all classIds) and Teacher (own classIds); (E) `AbsenteeEntry` + `GetAbsenteesResponse` types added to `src/types/api.ts`; `attendanceApi.getAbsentees()` added to `src/api/attendance.ts`; TQ key `['absentees', timeSlotId, date]` locked; (F) Improvements B (overdue cells), C (grid skeleton), D (mobile grid/list toggle), E (5-min auto-refresh + manual ↻ + last-updated timestamp), G (max-w-5xl on grid section) all applied.
- **v2.7** (2026-03-11): CR-FE-024–027 — UI/UX improvement batch. No API/backend/scope changes. (024) Toast standardization: `toast.success`/`toast.error` wired into mutation handlers on all 9 manage pages — `sonner` already a dependency, `<Toaster>` already mounted. (025) ConfirmDialog wired to all destructive actions on UsersPage, StudentsPage, ClassesPage (including irreversible Graduate action), and TimetablePage — `src/components/ConfirmDialog.tsx` unchanged; EventsPage used as reference. (026) Client-side search + filter added to StudentsPage (name/admission no. + Class + Batch filters), ClassesPage (name + Batch filter), EventsPage (title + Type filter) — `useMemo` pattern from UsersPage; zero API changes. (027) Four WCAG 2.1 AA gaps closed: (A) skip link added to Layout.tsx as first child; (B) `aria-live="polite" aria-atomic="false"` on rankings container in AttendanceSummaryPage; (C) text tier badge ("High"/"Medium"/"Low") added alongside colour bar in AttendanceSummaryPage; (D) today's column `ring-2 ring-primary` highlight + "Today" label added to TimetablePage and MonthlySheetPage.

---

**END OF FRONTEND FREEZE v2.7**
