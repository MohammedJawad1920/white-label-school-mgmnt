/**
 * Layout — shell that wraps all protected tenant-app pages.
 *
 * Structure:
 *   <Sidebar />      — desktop left rail (hidden on mobile via CSS)
 *   <main>           — scrollable page content
 *     <TopBar />     — mobile header with app name + role badge
 *     <Outlet />     — current page renders here
 *   </main>
 *   <BottomTabBar /> — mobile bottom nav (hidden on desktop via CSS)
 *
 * WHY pb-16 on main (mobile):
 * BottomTabBar is fixed-position and 56px tall. Without bottom padding,
 * page content would be obscured behind it on mobile.
 *
 * WHY TopBar only on mobile:
 * Desktop has the sidebar which shows user/role info. On mobile the sidebar
 * is hidden so we need a top bar to show the app name + current role.
 */
import { Outlet } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Sidebar } from "./Sidebar";
import { BottomTabBar } from "./BottomTabBar";
import { useAuth } from "@/hooks/useAuth";

function TopBar() {
  const { user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <header className="md:hidden flex items-center justify-between px-4 h-14 border-b bg-background shrink-0">
      <span className="text-sm font-semibold">
        {import.meta.env.VITE_APP_NAME ?? "School App"}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        </button>
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {user.activeRole}
            </span>
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-semibold"
              aria-label={`Signed in as ${user.name ?? "User"}`}
            >
              {user.name?.slice(0, 2).toUpperCase() ?? "??"}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Page area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <TopBar />

        {/* Page content — scrollable, padded for mobile bottom bar */}
        <main
          className="flex-1 overflow-y-auto pb-16 md:pb-0"
          id="main-content"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomTabBar />
    </div>
  );
}
