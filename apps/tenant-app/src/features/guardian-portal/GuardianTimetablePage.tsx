import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useGuardianSelectedChild } from "../../hooks/useGuardianSelectedChild";
import { guardianPortalApi } from "../../api/guardian-portal.api";
import { QUERY_KEYS } from "../../utils/queryKeys";
import { getErrorMessage } from "../../utils/errors";

/**
 * The guardian timetable API returns periods as a generic record.
 * This local interface reflects the expected shape from the backend
 * (mirrors TimeSlot fields relevant for display).
 */
interface TimetablePeriod {
  dayOfWeek?: string;
  periodNumber?: number;
  subjectName?: string;
  teacherName?: string;
  startTime?: string;
  endTime?: string | null;
  label?: string;
}

const DAYS_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DayName = (typeof DAYS_ORDER)[number];

function groupByDay(
  periods: TimetablePeriod[],
): Partial<Record<DayName, TimetablePeriod[]>> {
  const grouped: Partial<Record<DayName, TimetablePeriod[]>> = {};
  for (const period of periods) {
    const day = period.dayOfWeek as DayName | undefined;
    if (day && DAYS_ORDER.includes(day)) {
      if (!grouped[day]) grouped[day] = [];
      grouped[day]!.push(period);
    }
  }
  // Sort periods within each day by periodNumber
  for (const day of DAYS_ORDER) {
    if (grouped[day]) {
      grouped[day]!.sort(
        (a, b) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0),
      );
    }
  }
  return grouped;
}

function PeriodCard({ period }: { period: TimetablePeriod }) {
  const timeLabel =
    period.startTime && period.endTime
      ? `${period.startTime} – ${period.endTime}`
      : (period.label ??
        (period.periodNumber ? `Period ${period.periodNumber}` : ""));

  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        {period.periodNumber !== undefined && (
          <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
            P{period.periodNumber}
          </span>
        )}
        {timeLabel && (
          <span className="text-xs text-muted-foreground">{timeLabel}</span>
        )}
      </div>
      <p className="font-medium mt-1">{period.subjectName ?? "—"}</p>
      {period.teacherName && (
        <p className="text-xs text-muted-foreground mt-0.5">
          {period.teacherName}
        </p>
      )}
    </div>
  );
}

export default function GuardianTimetablePage() {
  const { selectedChildId, selectedChild, children, setSelectedChild } =
    useGuardianSelectedChild();

  const timetableQuery = useQuery({
    queryKey: QUERY_KEYS.guardianPortal.timetable(selectedChildId ?? ""),
    queryFn: () => guardianPortalApi.childTimetable(selectedChildId!),
    enabled: !!selectedChildId,
    staleTime: 10 * 60 * 1000,
  });

  // Cast the generic Record<string, unknown>[] to our local interface
  const periods = (timetableQuery.data?.periods ?? []) as TimetablePeriod[];

  const grouped = groupByDay(periods);
  const activeDays = DAYS_ORDER.filter((day) => !!grouped[day]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Class Timetable</h1>
      </div>

      {/* Child switcher */}
      {children.length > 1 && (
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">Viewing: </label>
          <select
            value={selectedChildId ?? ""}
            onChange={(e) => setSelectedChild(e.target.value)}
            className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {children.map((c) => (
              <option key={c.studentId} value={c.studentId}>
                {c.studentName}
              </option>
            ))}
          </select>
        </div>
      )}

      {!selectedChild ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading children...</p>
        </div>
      ) : (
        <>
          {/* Loading */}
          {timetableQuery.isLoading && (
            <div
              className="animate-pulse space-y-4"
              aria-busy="true"
              aria-label="Loading timetable"
            >
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-lg border bg-card p-4">
                  <div className="h-4 bg-muted rounded w-24 mb-3" />
                  <div className="space-y-2">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="h-14 bg-muted rounded" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {timetableQuery.isError && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {getErrorMessage(timetableQuery.error)}
            </div>
          )}

          {/* Empty */}
          {!timetableQuery.isLoading &&
            !timetableQuery.isError &&
            activeDays.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  No timetable available for {selectedChild.studentName}.
                </p>
              </div>
            )}

          {/* Timetable grouped by day */}
          {!timetableQuery.isLoading &&
            !timetableQuery.isError &&
            activeDays.length > 0 && (
              <div className="space-y-5">
                {activeDays.map((day) => (
                  <section
                    key={day}
                    className="rounded-lg border bg-card overflow-hidden"
                    aria-label={`${day} timetable`}
                  >
                    <div className="bg-muted/40 px-4 py-2.5 border-b">
                      <h2 className="text-sm font-semibold">{day}</h2>
                    </div>
                    <div className="p-3 space-y-2">
                      {(grouped[day] ?? []).map((period, idx) => (
                        <PeriodCard
                          key={`${day}-${period.periodNumber ?? idx}`}
                          period={period}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
        </>
      )}
    </div>
  );
}
