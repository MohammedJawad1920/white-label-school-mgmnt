import React from "react";

interface GradeBadgeProps {
  grade: string;
}

function gradeStyle(grade: string): string {
  switch (grade) {
    case "A+":
      return "bg-emerald-100 text-emerald-800";
    case "A":
      return "bg-green-100 text-green-800";
    case "B+":
      return "bg-teal-100 text-teal-800";
    case "B":
      return "bg-blue-100 text-blue-800";
    case "C+":
      return "bg-indigo-100 text-indigo-800";
    case "C":
      return "bg-violet-100 text-violet-800";
    case "D":
      return "bg-orange-100 text-orange-800";
    case "F":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export function GradeBadge({ grade }: GradeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${gradeStyle(grade)}`}
    >
      {grade}
    </span>
  );
}
