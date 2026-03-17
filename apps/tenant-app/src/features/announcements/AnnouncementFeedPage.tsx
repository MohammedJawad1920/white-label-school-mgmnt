/**
 * AnnouncementFeedPage — Feed list of announcements.
 * Admin sees Manage buttons (edit/delete). All users see the feed.
 * Filter by audience. Shows title, body preview, audience badge, publishAt.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { announcementsApi } from "@/api/announcements.api";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import { useAuth } from "@/hooks/useAuth";
import type { Announcement, AudienceType } from "@/types/api";

const AUDIENCE_TYPES: AudienceType[] = [
  "All",
  "Teachers",
  "Students",
  "Guardians",
  "Class",
];

const AUDIENCE_COLORS: Record<AudienceType, string> = {
  All: "bg-blue-100 text-blue-800",
  Teachers: "bg-teal-100 text-teal-800",
  Students: "bg-violet-100 text-violet-800",
  Guardians: "bg-orange-100 text-orange-800",
  Class: "bg-amber-100 text-amber-800",
};

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AnnouncementFeedPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useAppToast();
  const { user } = useAuth();

  const isAdmin = user?.activeRole === "Admin";
  const canCreate =
    user?.activeRole === "Admin" || user?.activeRole === "Teacher";

  const [audienceFilter, setAudienceFilter] = useState<AudienceType | "">("");
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 20;

  const announcementsQuery = useQuery({
    queryKey: ["announcements", { limit: PAGE_SIZE, offset }],
    queryFn: () => announcementsApi.list({ limit: PAGE_SIZE, offset }),
    staleTime: 2 * 60 * 1000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => announcementsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Announcement deleted.");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const allAnnouncements = announcementsQuery.data?.announcements ?? [];
  const total = announcementsQuery.data?.total ?? 0;

  const announcements = audienceFilter
    ? allAnnouncements.filter((a) => a.audienceType === audienceFilter)
    : allAnnouncements;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            School announcements and updates.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => navigate("/announcements/new")}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + New Announcement
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={audienceFilter}
          onChange={(e) =>
            setAudienceFilter(e.target.value as AudienceType | "")
          }
          aria-label="Filter by audience"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Audiences</option>
          {AUDIENCE_TYPES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {announcementsQuery.isError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
        >
          {parseApiError(announcementsQuery.error).message}
        </div>
      )}

      {announcementsQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg border p-4 space-y-2 animate-pulse"
            >
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No announcements found.
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a: Announcement) => (
            <article
              key={a.id}
              className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow"
              aria-label={a.title}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <h2 className="text-sm font-semibold">{a.title}</h2>
                {isAdmin && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/announcements/${a.id}/edit`)
                      }
                      className="rounded px-2.5 py-1 text-xs font-medium border border-input hover:bg-muted transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (window.confirm("Delete this announcement?")) {
                          deleteMut.mutate(a.id);
                        }
                      }}
                      className="rounded px-2.5 py-1 text-xs font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                {a.body}
              </p>

              <div className="mt-3 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${AUDIENCE_COLORS[a.audienceType]}`}
                >
                  {a.audienceType}
                  {a.audienceClassName && ` · ${a.audienceClassName}`}
                </span>
                {a.publishAt && (
                  <span>Publishes: {formatDateTime(a.publishAt)}</span>
                )}
                {a.expiresAt && (
                  <span>Expires: {formatDateTime(a.expiresAt)}</span>
                )}
                <span>By {a.createdByName}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!announcementsQuery.isLoading && total > PAGE_SIZE && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            Previous
          </button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            {offset / PAGE_SIZE + 1} / {Math.ceil(total / PAGE_SIZE)}
          </span>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
