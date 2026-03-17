/**
 * NotificationHistoryPage — Full notification list.
 * Mark individual read. Mark all read button.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/api/notifications.api";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import type { Notification } from "@/types/api";

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const TYPE_COLORS: Record<string, string> = {
  LEAVE_APPROVED: "bg-green-100 text-green-800",
  LEAVE_REJECTED: "bg-red-100 text-red-800",
  LEAVE_SUBMITTED: "bg-yellow-100 text-yellow-800",
  EXAM_PUBLISHED: "bg-blue-100 text-blue-800",
  EXAM_MARKS_ENTRY_OPEN: "bg-violet-100 text-violet-800",
  ANNOUNCEMENT: "bg-teal-100 text-teal-800",
  FEE_REMINDER: "bg-orange-100 text-orange-800",
  ATTENDANCE_ALERT: "bg-amber-100 text-amber-800",
  ASSIGNMENT_DUE: "bg-indigo-100 text-indigo-800",
};

export default function NotificationHistoryPage() {
  const qc = useQueryClient();
  const toast = useAppToast();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const PAGE_SIZE = 50;

  const notificationsQuery = useQuery({
    queryKey: [
      "notifications",
      { unreadOnly: showUnreadOnly, limit: PAGE_SIZE },
    ],
    queryFn: () =>
      notificationsApi.list({
        unreadOnly: showUnreadOnly || undefined,
        limit: PAGE_SIZE,
      }),
    staleTime: 1 * 60 * 1000,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const markAllReadMut = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(
        `${data.updatedCount} notification${data.updatedCount !== 1 ? "s" : ""} marked as read.`,
      );
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const total = notificationsQuery.data?.total ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0 ? (
              <span className="font-medium text-primary">
                {unreadCount} unread
              </span>
            ) : (
              "All caught up"
            )}
            {total > 0 && (
              <span className="ml-1 text-muted-foreground">
                · {total} total
              </span>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            disabled={markAllReadMut.isPending}
            onClick={() => markAllReadMut.mutate()}
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            {markAllReadMut.isPending ? "Marking…" : "Mark All Read"}
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showUnreadOnly}
            onChange={(e) => setShowUnreadOnly(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
          />
          Show unread only
        </label>
      </div>

      {notificationsQuery.isError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
        >
          {parseApiError(notificationsQuery.error).message}
        </div>
      )}

      {notificationsQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-lg border p-4 animate-pulse space-y-2"
            >
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          {showUnreadOnly
            ? "No unread notifications."
            : "No notifications found."}
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="Notifications">
          {notifications.map((n: Notification) => {
            const isUnread = !n.readAt;
            return (
              <article
                key={n.id}
                role="listitem"
                className={`rounded-lg border p-4 transition-colors ${
                  isUnread
                    ? "bg-primary/5 border-primary/20"
                    : "bg-card hover:bg-muted/20"
                }`}
                aria-label={`${isUnread ? "Unread: " : ""}${n.title}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {isUnread && (
                        <span
                          className="h-2 w-2 rounded-full bg-primary flex-shrink-0"
                          aria-label="Unread"
                        />
                      )}
                      <h3 className="text-sm font-medium">{n.title}</h3>
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_COLORS[n.type] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {n.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(n.createdAt)}
                    </p>
                  </div>
                  {isUnread && (
                    <button
                      type="button"
                      disabled={markReadMut.isPending}
                      onClick={() => markReadMut.mutate(n.id)}
                      className="shrink-0 rounded px-2.5 py-1 text-xs font-medium border border-input hover:bg-muted transition-colors disabled:opacity-50"
                      aria-label={`Mark "${n.title}" as read`}
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
