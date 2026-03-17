import React from "react";
import type { ExamResult } from "../types/api";

interface MarkingSheetProps {
  marks: ExamResult[];
  maxMarks: number;
  readOnly?: boolean;
  onChange?: (
    studentId: string,
    value: { marksObtained?: number; isAbsent?: boolean },
  ) => void;
}

export function MarkingSheet({
  marks,
  maxMarks,
  readOnly = false,
  onChange,
}: MarkingSheetProps) {
  return (
    <div className="overflow-x-auto">
      {readOnly && (
        <div className="mb-3 rounded-md bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
          Results published — marks are locked
        </div>
      )}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left">
            <th className="py-2 pl-3 pr-4 font-medium text-gray-600">
              Student
            </th>
            <th className="py-2 px-4 font-medium text-gray-600">Adm. No.</th>
            <th className="py-2 px-4 font-medium text-gray-600">
              Marks (/{maxMarks})
            </th>
            <th className="py-2 px-4 font-medium text-gray-600">Absent</th>
            <th className="py-2 px-4 font-medium text-gray-600">Grade</th>
          </tr>
        </thead>
        <tbody>
          {marks.map((row) => (
            <tr key={row.studentId} className="border-b hover:bg-gray-50">
              <td className="py-2 pl-3 pr-4">{row.studentName}</td>
              <td className="py-2 px-4 text-gray-500">{row.admissionNumber}</td>
              <td className="py-2 px-4">
                <input
                  type="number"
                  min={0}
                  max={maxMarks}
                  step={0.5}
                  disabled={readOnly || row.isAbsent}
                  defaultValue={row.marksObtained ?? ""}
                  onChange={(e) =>
                    onChange?.(row.studentId, {
                      marksObtained: parseFloat(e.target.value) || undefined,
                    })
                  }
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
                />
              </td>
              <td className="py-2 px-4">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  defaultChecked={row.isAbsent}
                  onChange={(e) =>
                    onChange?.(row.studentId, { isAbsent: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 disabled:opacity-50"
                />
              </td>
              <td className="py-2 px-4">{row.grade ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
