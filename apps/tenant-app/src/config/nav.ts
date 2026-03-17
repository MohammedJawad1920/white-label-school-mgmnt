/**
 * nav.ts — Single source of truth for all navigation links.
 *
 * WHY centralised here (not duplicated in Sidebar + BottomTabBar):
 * Both components share the same items array. If a route is added/removed,
 * one edit here propagates to desktop sidebar AND mobile tab bar automatically.
 *
 * Freeze §5 nav.ts (CR-FE-017):
 *   icon is a LucideIcon — no string-based NavIcon pattern (banned §1.6 S17).
 *   Role visibility rules (Phase 1):
 *     Admin:    Dashboard, Timetable (canonical), Attendance Summary,
 *               Monthly Sheet, Record Attendance, Manage group, Events,
 *               Leave Management, Exams, Fees, Assignments, Announcements,
 *               Import (sub-item), Notifications
 *     Teacher:  Dashboard, Timetable, Record Attendance, Monthly Sheet,
 *               Leave Queue, Exams, Assignments, Announcements, Notifications
 *     Student:  Dashboard, Attendance, Results, Assignments, Fees,
 *               Timetable, Announcements, Notifications
 *     Guardian: Dashboard, Attendance, Leave, Results, Fees, Assignments,
 *               Timetable, Notifications
 */
import type { LucideIcon } from "lucide-react";
import type { FeatureKey } from "@/types/api";
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
  CalendarCheck2,
  Building2,
  FileCheck2,
  ClipboardList,
  FileText,
  Wallet,
  BookCheck,
  Upload,
  Megaphone,
  Bell,
  Award,
  Settings,
  SlidersHorizontal,
} from "lucide-react";

export type Role = "Teacher" | "Admin" | "Student" | "Guardian"; // v5.0

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
  /**
   * M-02: Feature flag key — if set, this nav item is only shown when the
   * named feature is enabled (mirrors FeatureGate on the corresponding route).
   * undefined = always visible (no feature gate).
   */
  featureKey?: FeatureKey;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    url: "/admin/dashboard",
    allowedRoles: ["Admin"],
    icon: LayoutDashboard,
  },
  {
    label: "Timetable",
    url: "/timetable",
    allowedRoles: ["Admin"],
    icon: CalendarDays,
    featureKey: "timetable",
  },
  {
    label: "Record Attendance",
    url: "/attendance/record",
    allowedRoles: ["Admin", "Teacher"],
    icon: ClipboardCheck,
    featureKey: "attendance",
  },
  {
    label: "Attendance Summary",
    url: "/attendance/summary",
    allowedRoles: ["Admin"],
    icon: BarChart3,
    featureKey: "attendance",
  },
  // v4.5 CR-36: Monthly sheet — Admin + Teacher
  {
    label: "Monthly Sheet",
    url: "/attendance/monthly-sheet",
    allowedRoles: ["Admin", "Teacher"],
    icon: Sheet,
    featureKey: "attendance",
  },
  // Phase 1: Attendance correction — Admin only
  {
    label: "Attendance Correction",
    url: "/admin/attendance/correction",
    allowedRoles: ["Admin"],
    icon: ClipboardCheck,
    featureKey: "attendance",
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
    url: "/admin/students",
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
    featureKey: "timetable",
  },
  // v4.5 CR-37: Events — Admin only
  {
    label: "Events",
    url: "/manage/events",
    allowedRoles: ["Admin"],
    icon: CalendarRange,
    isSubItem: true,
  },
  // v5.0 M-013: Academic Sessions — Admin only
  {
    label: "Sessions",
    url: "/admin/sessions",
    allowedRoles: ["Admin"],
    icon: CalendarCheck2,
    isSubItem: true,
  },
  // v5.0 M-017: School Profile — Admin only
  {
    label: "School Profile",
    url: "/admin/settings/profile",
    allowedRoles: ["Admin"],
    icon: Building2,
    isSubItem: true,
  },
  // Phase 1: Grade Config — Admin only
  {
    label: "Grade Config",
    url: "/admin/settings/grades",
    allowedRoles: ["Admin"],
    icon: SlidersHorizontal,
    isSubItem: true,
  },
  // Phase 1: Feature Flags — Admin only
  {
    label: "Feature Flags",
    url: "/admin/settings/features",
    allowedRoles: ["Admin"],
    icon: Settings,
    isSubItem: true,
  },

  // ── Phase 1 Admin items ───────────────────────────────────────────────────────
  {
    label: "Leave Management",
    url: "/admin/leave",
    allowedRoles: ["Admin"],
    icon: FileCheck2,
  },
  {
    label: "Exams",
    url: "/admin/exams",
    allowedRoles: ["Admin"],
    icon: FileText,
  },
  {
    label: "Fees",
    url: "/admin/fees",
    allowedRoles: ["Admin"],
    icon: Wallet,
  },
  {
    label: "Outstanding Fees",
    url: "/admin/fees/summary",
    allowedRoles: ["Admin"],
    icon: Wallet,
    isSubItem: true,
  },
  {
    label: "Assignments",
    url: "/admin/assignments",
    allowedRoles: ["Admin"],
    icon: BookCheck,
  },
  {
    label: "Announcements",
    url: "/announcements",
    allowedRoles: ["Admin"],
    icon: Megaphone,
  },
  {
    label: "Import",
    url: "/admin/import",
    allowedRoles: ["Admin"],
    icon: Upload,
    isSubItem: true,
  },

  // ── Phase 1 Teacher items ─────────────────────────────────────────────────────
  {
    label: "Dashboard",
    url: "/teacher/dashboard",
    allowedRoles: ["Teacher"],
    icon: LayoutDashboard,
  },
  {
    label: "Timetable",
    url: "/teacher/timetable",
    allowedRoles: ["Teacher"],
    icon: CalendarDays,
    featureKey: "timetable",
  },
  {
    label: "Leave Queue",
    url: "/teacher/leave",
    allowedRoles: ["Teacher"],
    icon: ClipboardList,
  },
  {
    label: "Exams",
    url: "/teacher/exams",
    allowedRoles: ["Teacher"],
    icon: FileText,
  },
  {
    label: "Assignments",
    url: "/teacher/assignments",
    allowedRoles: ["Teacher"],
    icon: BookCheck,
  },
  {
    label: "Announcements",
    url: "/announcements",
    allowedRoles: ["Teacher"],
    icon: Megaphone,
  },

  // ── Phase 1 Student portal items ─────────────────────────────────────────────
  {
    label: "Dashboard",
    url: "/student/dashboard",
    allowedRoles: ["Student"],
    icon: LayoutDashboard,
  },
  {
    label: "Attendance",
    url: "/student/attendance",
    allowedRoles: ["Student"],
    icon: ClipboardCheck,
    featureKey: "attendance",
  },
  {
    label: "Results",
    url: "/student/results",
    allowedRoles: ["Student"],
    icon: Award,
  },
  {
    label: "Assignments",
    url: "/student/assignments",
    allowedRoles: ["Student"],
    icon: BookCheck,
  },
  {
    label: "Fees",
    url: "/student/fees",
    allowedRoles: ["Student"],
    icon: Wallet,
  },
  {
    label: "Timetable",
    url: "/student/timetable",
    allowedRoles: ["Student"],
    icon: CalendarDays,
    featureKey: "timetable",
  },
  {
    label: "Announcements",
    url: "/announcements",
    allowedRoles: ["Student"],
    icon: Megaphone,
  },

  // ── Phase 1 Guardian portal items ────────────────────────────────────────────
  {
    label: "Dashboard",
    url: "/guardian/dashboard",
    allowedRoles: ["Guardian"],
    icon: LayoutDashboard,
  },
  {
    label: "Attendance",
    url: "/guardian/attendance",
    allowedRoles: ["Guardian"],
    icon: ClipboardCheck,
    featureKey: "attendance",
  },
  {
    label: "Leave",
    url: "/guardian/leave",
    allowedRoles: ["Guardian"],
    icon: FileCheck2,
  },
  {
    label: "Results",
    url: "/guardian/results",
    allowedRoles: ["Guardian"],
    icon: Award,
  },
  {
    label: "Fees",
    url: "/guardian/fees",
    allowedRoles: ["Guardian"],
    icon: Wallet,
  },
  {
    label: "Assignments",
    url: "/guardian/assignments",
    allowedRoles: ["Guardian"],
    icon: BookCheck,
  },
  {
    label: "Announcements",
    url: "/announcements",
    allowedRoles: ["Guardian"],
    icon: Megaphone,
  },
  {
    label: "Timetable",
    url: "/guardian/timetable",
    allowedRoles: ["Guardian"],
    icon: CalendarDays,
    featureKey: "timetable",
  },

  // ── All roles ─────────────────────────────────────────────────────────────────
  {
    label: "Notifications",
    url: "/notifications",
    allowedRoles: ["Admin", "Teacher", "Student", "Guardian"],
    icon: Bell,
  },
];

/**
 * Bottom tab bar source — all non-sub-items.
 * Role filtering + slice(0, 5) happens at render time in BottomTabBar,
 * NOT here — slicing before role filter would expose forbidden-role items (E5 fix).
 * Freeze §5 nav.ts (CR-FE-017).
 */
export const BOTTOM_TAB_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.isSubItem);
