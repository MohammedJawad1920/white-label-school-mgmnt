/**
 * StudentListPage — Phase 1 Admin student list.
 * Navigates to /admin/students/:id for detail view.
 * Navigates to /admin/students/new to create a student.
 *
 * Freeze §2 route: /admin/students
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { studentsApi } from "@/api/students";
import { parseApiError } from "@/utils/errors";
import type { StudentStatus } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

export default function StudentListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StudentStatus | "">("");

  const studentsQuery = useQuery({
    queryKey: QUERY_KEYS.custom("students", statusFilter),
    queryFn: () => studentsApi.list({ status: statusFilter || undefined }),
    staleTime: 2 * 60 * 1000,
  });

  const students = studentsQuery.data?.students ?? [];

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return students.filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.loginId.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q);
      return matchesSearch;
    });
  }, [students, searchQuery]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Students</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {studentsQuery.isLoading
              ? "Loading…"
              : `${students.length} student${students.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/students/new")}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, login ID or admission no…"
          aria-label="Search students"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as StudentStatus | "")
          }
          aria-label="Filter by status"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="DroppedOff">Dropped Off</option>
          <option value="Graduated">Graduated</option>
        </select>
      </div>

      {studentsQuery.isError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
        >
          {parseApiError(studentsQuery.error).message}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Student list</caption>
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Name
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Admission No.
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Class
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Batch
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Login ID
              </th>
            </tr>
          </thead>
          <tbody>
            {studentsQuery.isLoading && (
              <tr>
                <td colSpan={6} className="p-4">
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                </td>
              </tr>
            )}
            {!studentsQuery.isLoading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  {students.length === 0
                    ? "No students found. Add the first student."
                    : "No students match your filters."}
                </td>
              </tr>
            )}
            {filtered.map((student) => (
              <tr
                key={student.id}
                className="border-b last:border-b-0 hover:bg-muted/20 cursor-pointer"
                onClick={() => navigate(`/admin/students/${student.id}`)}
              >
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  {student.name}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      student.status === "Active"
                        ? "bg-green-100 text-green-800"
                        : student.status === "DroppedOff"
                          ? "bg-red-100 text-red-800"
                          : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {student.status === "DroppedOff"
                      ? "Dropped Off"
                      : student.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {student.admissionNumber}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {student.classId === null
                    ? "—"
                    : (student.className ?? student.classId)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {student.batchName ?? student.batchId}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {student.loginId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
