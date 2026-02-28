/**
 * BottomTabBar — mobile navigation (< 768px), Teacher-focused.
 *
 * Freeze §5 Design System:
 *   Mobile (< 768px): Bottom tab bar navigation
 *   Minimum touch target: 44×44px on all interactive elements
 *
 * WHY only 3 tabs (not all nav items):
 * Freeze §FE Phase 3: "BottomTabBar (mobile, Teacher-focused)".
 * Mobile screen real estate is limited — only the 3 primary Teacher actions
 * are shown. Admin-only items (Manage, Summary, Periods) are reachable via
 * the desktop sidebar when on a larger screen. On mobile, Admins use the
 * same 3-tab bar (they still need dashboard/timetable/attendance daily).
 *
 * WHY hidden on md+:
 * Sidebar takes over at md breakpoint. Both exist in DOM but CSS controls
 * visibility — avoids layout shift on resize.
 */
import { useLocation, useNavigate } from "react-router-dom";
import { NavIcon } from "./NavIcon";
import { BOTTOM_TAB_ITEMS } from "@/config/nav";
import { cn } from "@/utils/cn";

export function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 flex border-t bg-background"
      aria-label="Mobile navigation"
    >
      {BOTTOM_TAB_ITEMS.map((item) => {
        const active =
          location.pathname === item.href ||
          location.pathname.startsWith(item.href + "/");

        return (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              // min 44×44 touch target — Freeze §5
              "flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-xs font-medium transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <NavIcon icon={item.icon} className="h-5 w-5" />
            <span className="text-[11px] leading-none">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
