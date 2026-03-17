/**
 * GradeConfigPage — Read-only display of grade boundaries.
 * Displays the default grade boundaries table (A+ ≥ 90, A ≥ 80, etc.).
 * No edit UI.
 */

const DEFAULT_GRADE_BOUNDARIES: {
  grade: string;
  minPercent: number;
  label: string;
}[] = [
  { grade: "A+", minPercent: 90, label: "Outstanding" },
  { grade: "A", minPercent: 80, label: "Excellent" },
  { grade: "B+", minPercent: 70, label: "Very Good" },
  { grade: "B", minPercent: 60, label: "Good" },
  { grade: "C+", minPercent: 50, label: "Above Average" },
  { grade: "C", minPercent: 45, label: "Average" },
  { grade: "D", minPercent: 40, label: "Pass" },
  { grade: "F", minPercent: 0, label: "Fail" },
];

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-emerald-100 text-emerald-800",
  A: "bg-green-100 text-green-800",
  "B+": "bg-teal-100 text-teal-800",
  B: "bg-blue-100 text-blue-800",
  "C+": "bg-indigo-100 text-indigo-800",
  C: "bg-violet-100 text-violet-800",
  D: "bg-orange-100 text-orange-800",
  F: "bg-red-100 text-red-800",
};

export default function GradeConfigPage() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Grade Configuration</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Default grade boundaries applied to exam results.
        </p>
      </div>

      <div
        role="note"
        className="mb-5 flex items-start gap-2 rounded-md bg-muted border border-border px-3 py-2 text-sm text-muted-foreground"
      >
        <svg
          className="h-4 w-4 shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Grade boundaries are configured per exam. These are the system defaults
        used when no custom boundaries are specified.
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <caption className="sr-only">Grade boundaries</caption>
          <thead className="bg-muted/50 border-b">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left font-medium text-muted-foreground"
              >
                Grade
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-medium text-muted-foreground"
              >
                Minimum %
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-medium text-muted-foreground"
              >
                Description
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-medium text-muted-foreground"
              >
                Pass / Fail
              </th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_GRADE_BOUNDARIES.map((boundary, i) => {
              const next = DEFAULT_GRADE_BOUNDARIES[i + 1];
              const maxPct = next ? `${next.minPercent}%` : null;
              return (
                <tr
                  key={boundary.grade}
                  className="border-b last:border-b-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${GRADE_COLORS[boundary.grade] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {boundary.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    ≥ {boundary.minPercent}%
                    {maxPct && (
                      <span className="ml-1 text-xs text-muted-foreground font-normal">
                        (up to {maxPct})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {boundary.label}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        boundary.grade === "F"
                          ? "bg-red-100 text-red-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {boundary.grade === "F" ? "Fail" : "Pass"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        To customise grade boundaries for a specific exam, edit the exam and set
        custom boundaries.
      </p>
    </div>
  );
}
