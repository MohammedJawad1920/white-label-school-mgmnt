/**
 * StudentAnnouncementsPage — Audience-filtered announcements feed.
 *
 * The backend filters announcements by the student's audience type
 * (All, Students, Class). Displays a paginated list.
 *
 * Path: /student/announcements
 */
import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { announcementsApi } from "../../api/announcements.api";
import { parseApiError } from "../../utils/errors";
import { QUERY_KEYS } from "../../utils/queryKeys";
import type { Announcement } from "../../types/api";

const PAGE_SIZE = 10;

// ── Announcement card ────────────────────────────────────────────────────
function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const [expanded, setExpanded] = useState(false);

  const date = new Date(announcement.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <article className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-semibold text-sm truncate">
            {announcement.title}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {announcement.createdByName} · {date}
            {announcement.audienceClassName && (
              <span className="ml-2">· {announcement.audienceClassName}</span>
            )}
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {announcement.audienceType}
        </span>
      </div>

      {/* Body — truncated with expand toggle */}
      {announcement.body && (
        <div className="mt-2">
          <p
            className={`text-sm text-muted-foreground ${!expanded ? "line-clamp-3" : ""}`}
          >
            {announcement.body}
          </p>
          {announcement.body.length > 150 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
              aria-expanded={expanded}
              aria-label={expanded ? "Show less" : "Read more"}
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}

      {announcement.expiresAt && (
        <p className="mt-2 text-xs text-muted-foreground">
          Expires:{" "}
          {new Date(announcement.expiresAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </p>
      )}
    </article>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function StudentAnnouncementsPage() {
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;

  const announcementsQ = useQuery({
    queryKey: QUERY_KEYS.announcements.list({ limit: PAGE_SIZE, offset }),
    queryFn: () => announcementsApi.list({ limit: PAGE_SIZE, offset }),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const announcements = announcementsQ.data?.announcements ?? [];
  const total = announcementsQ.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const apiError = announcementsQ.isError
    ? parseApiError(announcementsQ.error)
    : null;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Announcements</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          School and class announcements
        </p>
      </div>

      {/* Loading */}
      {announcementsQ.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border bg-card p-4 space-y-2"
            >
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-4/5" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {announcementsQ.isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {apiError?.message ?? "Failed to load announcements."}
        </div>
      )}

      {/* Empty */}
      {!announcementsQ.isLoading &&
        !announcementsQ.isError &&
        announcements.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border bg-muted/10">
            <p className="text-sm text-muted-foreground">
              No announcements available.
            </p>
          </div>
        )}

      {/* Announcement list */}
      {!announcementsQ.isLoading && announcements.length > 0 && (
        <>
          <ul className="space-y-3">
            {announcements.map((ann) => (
              <li key={ann.id}>
                <AnnouncementCard announcement={ann} />
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              className="mt-5 flex items-center justify-between text-sm"
              aria-label="Announcements pagination"
            >
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || announcementsQ.isFetching}
                className="rounded-md border px-3 py-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || announcementsQ.isFetching}
                className="rounded-md border px-3 py-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
