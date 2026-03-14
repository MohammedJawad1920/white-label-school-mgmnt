/**
 * Sidebar — desktop navigation (≥ 768px).
 *
 * Role visibility rules (Freeze §5):
 *   - Each nav item declares which roles can see it via allowedRoles[]
 *   - RoleSwitcher only renders when user.roles.length > 1
 *   - Logout: fire-and-forget POST /auth/logout, then clear + redirect
 *   - Icons: lucide-react with strokeWidth={1.75} (Freeze §5 sidebar spec)
 */
import { LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { RoleSwitcher } from "@/features/auth/RoleSwitcher";
import { NAV_ITEMS } from "@/config/nav";
import { cn } from "@/utils/cn";
import type { NavItem } from "@/config/nav";

export function Sidebar() {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  // Filter nav items to those the user's current activeRole can see
  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      !user ||
      item.allowedRoles.includes(
        user.activeRole as "Teacher" | "Admin" | "Student",
      ),
  );

  function isActive(item: NavItem): boolean {
    if (item.matchPrefix) return location.pathname.startsWith(item.url);
    return location.pathname === item.url;
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
              d="M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
            />
          </svg>
        </div>
        <span className="text-sm font-semibold truncate">
          {import.meta.env.VITE_APP_NAME ?? "School App"}
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" role="navigation">
        {visibleItems.map((item, index) => {
          const active = isActive(item);
          const prevItem = visibleItems[index - 1];
          const showGroupLabel =
            item.groupLabel &&
            (!prevItem || prevItem.groupLabel !== item.groupLabel);

          return (
            <div key={item.url}>
              {/* Section group header */}
              {showGroupLabel && (
                <p className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {item.groupLabel}
                </p>
              )}

              <a
                href={item.url}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.url);
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-[40px] truncate",
                  item.isSubItem ? "pl-4" : "",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon
                  className="h-4 w-4 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden={true}
                />
                {item.label}
              </a>
            </div>
          );
        })}
      </nav>

      {/* Bottom: role switcher + user info + logout */}
      <div className="border-t p-3 space-y-2 shrink-0">
        <RoleSwitcher variant="compact" />

        {user && (
          <div className="flex items-center gap-2.5 px-1">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-semibold shrink-0"
              aria-hidden="true"
            >
              {user.name?.slice(0, 2).toUpperCase() ?? "??"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user.activeRole}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-1">
          <button
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={
              resolvedTheme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" strokeWidth={1.75} aria-hidden={true} />
            ) : (
              <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden={true} />
            )}
            <span>{resolvedTheme === "dark" ? "Light" : "Dark"}</span>
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Sign out"
        >
          <LogOut
            className="h-4 w-4 shrink-0"
            strokeWidth={1.75}
            aria-hidden={true}
          />
          Sign out
        </button>
      </div>
    </aside>
  );
}
