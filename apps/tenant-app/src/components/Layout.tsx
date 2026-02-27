import { Outlet } from "react-router-dom";

/** Full sidebar + nav implemented in FE Phase 3. Renders plain wrapper for now. */
export default function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}
