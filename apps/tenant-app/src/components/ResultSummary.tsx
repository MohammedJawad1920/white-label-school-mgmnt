import React from "react";
import type { ExamStudentSummary } from "../types/api";
import { GradeBadge } from "./GradeBadge";

interface ResultSummaryProps {
  summary: ExamStudentSummary;
}

export function ResultSummary({ summary }: ResultSummaryProps) {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-semibold">{summary.studentName}</p>
          <p className="text-sm text-gray-500">{summary.admissionNumber}</p>
        </div>
        <div className="text-right">
          <GradeBadge grade={summary.overallGrade} />
          {summary.classRank !== null && (
            <p className="mt-1 text-xs text-gray-500">
              Rank #{summary.classRank}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-md bg-gray-50 p-2">
          <div className="font-bold text-gray-900">
            {summary.totalMarksObtained}/{summary.totalMarksPossible}
          </div>
          <div className="text-xs text-gray-500">Total Marks</div>
        </div>
        <div className="rounded-md bg-gray-50 p-2">
          <div className="font-bold text-gray-900">
            {summary.aggregatePercentage.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Percentage</div>
        </div>
        <div className="rounded-md bg-gray-50 p-2">
          <div
            className={`font-bold ${summary.overallResult === "PASS" ? "text-green-600" : "text-red-600"}`}
          >
            {summary.overallResult}
          </div>
          <div className="text-xs text-gray-500">Result</div>
        </div>
      </div>
    </div>
  );
}
