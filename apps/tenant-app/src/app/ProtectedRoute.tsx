import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * WHY redirect to /login with location state:
 * After login succeeds, LoginPage reads location.state.from and navigates
 * the user back to what they were trying to access before auth expired.
 *
 * v5.0 M-011: mustChangePassword guard.
 * If the JWT carries mustChangePassword=true, every protected route (except
 * /change-password itself) redirects to /change-password. The user cannot
 * access any feature until they set a new password.
 */
export function ProtectedRoute() {
  const { isAuthenticated, mustChangePassword } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force password change — allow access to /change-password only
  if (mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
