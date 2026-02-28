import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SAAuthProvider } from "@/features/auth/SAAuthContext";
import { SAProtectedRoute } from "./SAProtectedRoute";
import { SASessionExpiredModal } from "./SASessionExpiredModal";

const SALoginPage = lazy(() => import("@/features/auth/SALoginPage"));
const SALayout = lazy(() => import("@/components/SALayout"));
const TenantsPage = lazy(() => import("@/features/tenants/TenantsPage"));
const TenantFeaturesPage = lazy(
  () => import("@/features/tenants/TenantFeaturesPage"),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount: number, error: unknown): boolean => {
        if (failureCount >= 2) return false;
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        return status === undefined || status >= 500;
      },
      retryDelay: (attempt: number): number =>
        Math.min(1000 * 2 ** attempt, 4000),
      staleTime: 2 * 60 * 1000,
    },
    mutations: { retry: false },
  },
});

function PageLoader() {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      aria-label="Loading"
    >
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SAAuthProvider>
        <BrowserRouter>
          <SASessionExpiredModal />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<SALoginPage />} />

              <Route element={<SAProtectedRoute />}>
                <Route element={<SALayout />}>
                  <Route index element={<Navigate to="/tenants" replace />} />
                  <Route path="/tenants" element={<TenantsPage />} />
                  <Route
                    path="/tenants/:tenantId/features"
                    element={<TenantFeaturesPage />}
                  />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/tenants" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </SAAuthProvider>
    </QueryClientProvider>
  );
}
