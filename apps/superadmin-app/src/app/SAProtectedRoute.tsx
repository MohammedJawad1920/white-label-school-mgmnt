import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSAAuth } from "@/features/auth/SAAuthContext";

export function SAProtectedRoute() {
  const { isAuthenticated } = useSAAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
