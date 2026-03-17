import React from "react";

interface CalendarDay {
  date: string;
  dayOfWeek: number; // 0=Sun, 6=Sat
  status: string | null;
}

interface CalendarGridProps {
  month: string; // "YYYY-MM"
  days: CalendarDay[];
}

const STATUS_COLORS: Record<string, string> = {
  Present: "bg-green-500",
  Absent: "bg-red-500",
  Late: "bg-yellow-400",
  Excused: "bg-blue-400",
};

export function CalendarGrid({ month, days }: CalendarGridProps) {
  const [year, monthNum] = month.split("-").map(Number);
  const firstDay = new Date(year!, monthNum! - 1, 1).getDay();
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const daysInMonth = new Date(year!, monthNum!, 0).getDate();
  const cells: (CalendarDay | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const date = `${month}-${String(i + 1).padStart(2, "0")}`;
      return (
        dayMap.get(date) ?? {
          date,
          dayOfWeek: (firstDay + i) % 7,
          status: null,
        }
      );
    }),
  ];

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-gray-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) =>
          day === null ? (
            <div key={`empty-${i}`} />
          ) : (
            <div key={day.date} className="flex flex-col items-center py-1">
              <span className="text-xs text-gray-700">
                {new Date(day.date + "T00:00:00").getDate()}
              </span>
              <div
                className={`mt-0.5 h-3 w-3 rounded-full ${day.status ? (STATUS_COLORS[day.status] ?? "bg-gray-300") : "bg-gray-100"}`}
                title={day.status ?? "No record"}
              />
            </div>
          ),
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={`h-3 w-3 rounded-full ${color}`} />
            <span>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
