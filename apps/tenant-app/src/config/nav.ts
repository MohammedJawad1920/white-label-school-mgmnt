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
    | "periods";
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
    roles: ["Admin"], // Teacher: hidden per Freeze
    icon: "summary",
  },
  {
    label: "Manage",
    href: "/manage/users",
    roles: ["Admin"], // Teacher: hidden per Freeze
    matchPrefix: true,
    icon: "manage",
  },
  {
    label: "School Periods",
    href: "/manage/school-periods",
    roles: ["Admin"], // Teacher: hidden per Freeze
    icon: "periods",
  },
];

/** Bottom tab bar shows only Teacher-relevant primary actions (max 4 tabs) */
export const BOTTOM_TAB_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (item) =>
    item.roles.includes("Teacher") &&
    ["dashboard", "timetable", "attendance"].includes(item.icon),
);
