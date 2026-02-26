import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import TimetablePage from "./pages/TimetablePage";
import AttendancePage from "./pages/AttendancePage";
import AttendanceHistoryPage from "./pages/AttendanceHistoryPage";
import AttendanceReportsPage from "./pages/AttendanceReportsPage";
import StudentsPage from "./pages/StudentsPage";
import ClassesPage from "./pages/ClassesPage";
import SubjectsPage from "./pages/SubjectsPage";
import TeachersPage from "./pages/TeachersPage";
import BatchesPage from "./pages/BatchesPage";
import FeaturesPage from "./pages/FeaturesPage";
import Layout from "./components/Layout";

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/timetable" element={<TimetablePage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route
                  path="/attendance/history"
                  element={<AttendanceHistoryPage />}
                />
                <Route
                  path="/attendance/reports"
                  element={<AttendanceReportsPage />}
                />
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/classes" element={<ClassesPage />} />
                <Route path="/subjects" element={<SubjectsPage />} />
                <Route path="/teachers" element={<TeachersPage />} />
                <Route path="/batches" element={<BatchesPage />} />
                <Route path="/features" element={<FeaturesPage />} />
                <Route
                  path="/"
                  element={<Navigate to="/dashboard" replace />}
                />
                <Route
                  path="*"
                  element={
                    <div className="p-8 text-center">Page not found</div>
                  }
                />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
