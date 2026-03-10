/**
 * nav.ts — Single source of truth for all navigation links.
 *
 * WHY centralised here (not duplicated in Sidebar + BottomTabBar):
 * Both components share the same items array. If a route is added/removed,
 * one edit here propagates to desktop sidebar AND mobile tab bar automatically.
 *
 * Freeze §5 nav.ts (CR-FE-017):
 *   icon is a LucideIcon — no string-based NavIcon pattern (banned §1.6 S17).
 *   Role visibility rules:
 *     Teacher:  Dashboard, Timetable, Record Attendance, Monthly Sheet
 *     Admin:    Dashboard, Timetable, Attendance Summary, Monthly Sheet,
 *               Manage group (6 sub-items), Events
 *     Student:  Dashboard, Timetable
 */
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardCheck,
  BarChart3,
  Sheet,
  Users,
  GraduationCap,
  BookOpen,
  Layers,
  BookMarked,
  Clock,
  CalendarRange,
} from "lucide-react";

export type Role = "Teacher" | "Admin" | "Student";

export interface NavItem {
  label: string;
  url: string;
  /** Roles whose activeRole matches can see this item */
  allowedRoles: Role[];
  /** LucideIcon component — no string icons (Freeze §1.6 S17) */
  icon: LucideIcon;
  /** Matches child paths too (e.g. /manage matches /manage/users) */
  matchPrefix?: boolean;
  /** If true, renders as an indented sub-item under a group */
  isSubItem?: boolean;
  /** Group header label — renders a non-clickable divider above this item */
  groupLabel?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    url: "/dashboard",
    allowedRoles: ["Teacher", "Admin", "Student"],
    icon: LayoutDashboard,
  },
  {
    label: "Timetable",
    url: "/timetable",
    allowedRoles: ["Teacher", "Admin", "Student"],
    icon: CalendarDays,
  },
  {
    label: "Record Attendance",
    url: "/attendance/record",
    allowedRoles: ["Admin", "Teacher"],
    icon: ClipboardCheck,
  },
  {
    label: "Attendance Summary",
    url: "/attendance/summary",
    allowedRoles: ["Admin"],
    icon: BarChart3,
  },
  // v4.5 CR-36: Monthly sheet — Admin + Teacher
  {
    label: "Monthly Sheet",
    url: "/attendance/monthly-sheet",
    allowedRoles: ["Admin", "Teacher"],
    icon: Sheet,
  },
  // ── Manage group ─────────────────────────────────────────────────────────────
  {
    label: "Users",
    url: "/manage/users",
    allowedRoles: ["Admin"],
    icon: Users,
    groupLabel: "Manage",
    isSubItem: true,
  },
  {
    label: "Students",
    url: "/manage/students",
    allowedRoles: ["Admin"],
    icon: GraduationCap,
    isSubItem: true,
  },
  {
    label: "Classes",
    url: "/manage/classes",
    allowedRoles: ["Admin"],
    icon: BookOpen,
    isSubItem: true,
  },
  {
    label: "Batches",
    url: "/manage/batches",
    allowedRoles: ["Admin"],
    icon: Layers,
    isSubItem: true,
  },
  {
    label: "Subjects",
    url: "/manage/subjects",
    allowedRoles: ["Admin"],
    icon: BookMarked,
    isSubItem: true,
  },
  {
    label: "School Periods",
    url: "/manage/school-periods",
    allowedRoles: ["Admin"],
    icon: Clock,
    isSubItem: true,
  },
  // v4.5 CR-37: Events — Admin only
  {
    label: "Events",
    url: "/manage/events",
    allowedRoles: ["Admin"],
    icon: CalendarRange,
    isSubItem: true,
  },
];

/**
 * Bottom tab bar source — all non-sub-items.
 * Role filtering + slice(0, 5) happens at render time in BottomTabBar,
 * NOT here — slicing before role filter would expose forbidden-role items (E5 fix).
 * Freeze §5 nav.ts (CR-FE-017).
 */
export const BOTTOM_TAB_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.isSubItem);
