/**
 * Sidebar — desktop navigation (≥ 768px).
 *
 * Role visibility rules (Freeze §User Roles):
 *   - Each nav item declares which roles can see it
 *   - RoleSwitcher only renders when user.roles.length > 1
 *   - Logout: fire-and-forget POST /auth/logout, then clear + redirect
 *
 * WHY useLocation for active state (not NavLink className alone):
 * The Manage item uses matchPrefix=true — it must be active for ALL /manage/*
 * sub-routes. NavLink's `end` prop would only match exact path. Using
 * useLocation + startsWith gives us prefix-matching correctly.
 */
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { RoleSwitcher } from "@/features/auth/RoleSwitcher";
import { NavIcon } from "./NavIcon";
import { NAV_ITEMS } from "@/config/nav";
import { cn } from "@/utils/cn";

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  // Filter nav items to those the current role can see
  const visibleItems = NAV_ITEMS.filter(
    (item) => !user || item.roles.some((r) => user.roles.includes(r)),
  );

  function isActive(item: (typeof NAV_ITEMS)[0]): boolean {
    if (item.matchPrefix) return location.pathname.startsWith(item.href);
    return (
      location.pathname === item.href ||
      // handle /manage/school-periods matching the Periods item exactly
      location.pathname.startsWith(item.href)
    );
  }

  return (
    <aside
      className="hidden md:flex md:flex-col w-60 border-r bg-background shrink-0"
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
          <svg
            className="w-4 h-4 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
            />
          </svg>
        </div>
        <span className="text-sm font-semibold truncate">
          {import.meta.env.VITE_APP_NAME ?? "School App"}
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" role="navigation">
        {visibleItems.map((item) => {
          const active = isActive(item);
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                navigate(item.href);
              }}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-[44px]",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <NavIcon icon={item.icon} className="h-4 w-4 shrink-0" />
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Bottom: role switcher + user info + logout */}
      <div className="border-t p-3 space-y-2 shrink-0">
        <RoleSwitcher variant="compact" />

        {/* User info */}
        {user && (
          <div className="flex items-center gap-2.5 px-1">
            {/* Avatar initials */}
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-semibold shrink-0"
              aria-hidden="true"
            >
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user.activeRole}
              </p>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-[44px]"
          aria-label="Sign out"
        >
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
