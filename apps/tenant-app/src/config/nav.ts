/**
 * nav.ts — Single source of truth for all navigation links.
 *
 * WHY centralised here (not duplicated in Sidebar + BottomTabBar):
 * Both components share the same items array. If a route is added/removed,
 * one edit here propagates to desktop sidebar AND mobile tab bar automatically.
 *
 * Freeze §User Roles — visibility rules:
 *   Teacher: dashboard, timetable, attendance/record only
 *   Admin:   all routes including manage/* and attendance summary
 */

export interface NavItem {
  label: string;
  href: string;
  /** roles that can see this item. empty = all authenticated roles */
  roles: Array<"Teacher" | "Admin">;
  /** matches child paths too (e.g. /manage matches /manage/users) */
  matchPrefix?: boolean;
  icon:
    | "dashboard"
    | "timetable"
    | "attendance"
    | "summary"
    | "manage"
    | "periods"
    | "users"
    | "students"
    | "classes"
    | "batches"
    | "subjects";
  /** if true, renders as an indented sub-item under a group */
  isSubItem?: boolean;
  /** group header label — renders a non-clickable divider above this item */
  groupLabel?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    roles: ["Teacher", "Admin"],
    icon: "dashboard",
  },
  {
    label: "Timetable",
    href: "/timetable",
    roles: ["Teacher", "Admin"],
    icon: "timetable",
  },
  {
    label: "Record Attendance",
    href: "/attendance/record",
    roles: ["Teacher", "Admin"],
    icon: "attendance",
  },
  {
    label: "Attendance Summary",
    href: "/attendance/summary",
    roles: ["Admin"],
    icon: "summary",
  },
  // ── Manage group ─────────────────────────────────────────────────────────────
  {
    label: "Users",
    href: "/manage/users",
    roles: ["Admin"],
    icon: "users",
    groupLabel: "Manage", // renders a section header above this item
    isSubItem: true,
  },
  {
    label: "Students",
    href: "/manage/students",
    roles: ["Admin"],
    icon: "students",
    isSubItem: true,
  },
  {
    label: "Classes",
    href: "/manage/classes",
    roles: ["Admin"],
    icon: "classes",
    isSubItem: true,
  },
  {
    label: "Batches",
    href: "/manage/batches",
    roles: ["Admin"],
    icon: "batches",
    isSubItem: true,
  },
  {
    label: "Subjects",
    href: "/manage/subjects",
    roles: ["Admin"],
    icon: "subjects",
    isSubItem: true,
  },
  {
    label: "School Periods",
    href: "/manage/school-periods",
    roles: ["Admin"],
    icon: "periods",
    isSubItem: true,
  },
];

/** Bottom tab bar shows only Teacher-relevant primary actions (max 4 tabs) */
export const BOTTOM_TAB_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (item) =>
    item.roles.includes("Teacher") &&
    ["dashboard", "timetable", "attendance"].includes(item.icon),
);
