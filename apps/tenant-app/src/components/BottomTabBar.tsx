/**
 * BottomTabBar — mobile navigation (< 768px).
 *
 * Freeze §5 (CR-FE-017, CR-FE-020):
 *   - Source: BOTTOM_TAB_NAV_ITEMS (all non-sub-items from nav.ts)
 *   - Max 5 tabs visible; overflow items collapse into "More" sheet
 *   - "More" tab ALWAYS rendered (CR-FE-020-A) — logout + role-switch must be
 *     accessible on mobile regardless of overflow count
 *   - Active: strokeWidth={2.5} + font-medium label
 *   - Inactive: strokeWidth={1.75}
 *   - Label: truncate at 10 chars, text-[10px]
 *   - A11y: role="tablist", aria-label per tab, aria-current="page" on active, min-h-[40px]
 */
import { useState } from "react";
import { LogOut, MoreHorizontal, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuth } from "@/hooks/useAuth";
import { RoleBadge } from "@/components/RoleBadge";
import { RoleSwitcher } from "@/features/auth/RoleSwitcher";
import { BOTTOM_TAB_NAV_ITEMS } from "@/config/nav";
import { cn } from "@/utils/cn";
import type { NavItem, Role } from "@/config/nav";

function isActive(item: NavItem, pathname: string): boolean {
  if (item.matchPrefix) return pathname.startsWith(item.url);
  return pathname === item.url;
}

export function BottomTabBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const activeRole = (user?.activeRole ?? "Student") as Role;

  const filteredItems = BOTTOM_TAB_NAV_ITEMS.filter((item) =>
    item.allowedRoles.includes(activeRole),
  );

  const visibleTabs = filteredItems.slice(0, 5);
  const overflowTabs = filteredItems.slice(5);

  function handleNav(url: string) {
    navigate(url);
    setMoreOpen(false);
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <nav
      role="tablist"
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 w-full h-16 bg-background border-t flex md:hidden z-20"
    >
      {visibleTabs.map((item) => {
        const active = isActive(item, location.pathname);
        const displayLabel = item.label.slice(0, 10);

        return (
          <button
            key={item.url}
            role="tab"
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            onClick={() => handleNav(item.url)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[40px] text-xs transition-colors",
              active
                ? "text-primary font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <item.icon
              className="h-5 w-5 shrink-0"
              strokeWidth={active ? 2.5 : 1.75}
              aria-hidden={true}
            />
            <span className="text-[10px] leading-none truncate max-w-[56px]">
              {displayLabel}
            </span>
          </button>
        );
      })}

      {/* "More" tab — always rendered (CR-FE-020-A): logout + role-switch must
          be reachable on mobile regardless of overflow count */}
      <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <Dialog.Trigger asChild>
          <button
            role="tab"
            aria-label="More navigation items"
            aria-current={
              overflowTabs.some((item) => isActive(item, location.pathname))
                ? "page"
                : undefined
            }
            className="flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[40px] text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MoreHorizontal
              className="h-5 w-5 shrink-0"
              strokeWidth={1.75}
              aria-hidden={true}
            />
            <span className="text-[10px] leading-none">More</span>
          </button>
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-xl bg-background border-t max-h-[60vh] overflow-y-auto"
            aria-describedby={undefined}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <Dialog.Title className="text-sm font-semibold">
                More
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                  aria-label="Close more menu"
                >
                  <X className="h-4 w-4" aria-hidden={true} />
                </button>
              </Dialog.Close>
            </div>

            {/* Overflow nav items — conditional */}
            {overflowTabs.length > 0 && (
              <div className="p-4 space-y-1">
                {overflowTabs.map((item) => {
                  const active = isActive(item, location.pathname);
                  return (
                    <button
                      key={item.url}
                      onClick={() => handleNav(item.url)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-[44px]",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <item.icon
                        className="h-5 w-5 shrink-0"
                        strokeWidth={active ? 2.5 : 1.75}
                        aria-hidden={true}
                      />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Divider — always rendered */}
            <div className="border-t mx-4 my-2" aria-hidden="true" />

            {/* User profile section — always rendered (CR-FE-020-A) */}
            <section aria-label="User account" className="p-4 space-y-3">
              {/* Avatar + name + role badge */}
              {user && (
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    {user.name?.slice(0, 2).toUpperCase() ?? "??"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <RoleBadge role={activeRole} />
                  </div>
                </div>
              )}

              {/* RoleSwitcher — only when user has multiple roles */}
              {user && user.roles.length > 1 && (
                <RoleSwitcher variant="inline" />
              )}

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Log out"
              >
                <LogOut
                  className="h-4 w-4 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden={true}
                />
                Log out
              </button>
            </section>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </nav>
  );
}
