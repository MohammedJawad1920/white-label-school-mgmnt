import React from "react";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "../api/notifications.api";
import { QUERY_KEYS } from "../utils/queryKeys";

// IMPORTANT: Only create this component after BATCH D creates notifications.api.ts and queryKeys.ts
// This component polls for unread notification count every 60 seconds

export function NotificationBell() {
  const { data } = useQuery({
    queryKey: QUERY_KEYS.notifications.unreadCount(),
    queryFn: () => notificationsApi.list({ limit: 1, unreadOnly: true }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const unreadCount = data?.unreadCount ?? 0;

  return (
    <a
      href="/notifications"
      className="relative inline-flex items-center p-2 text-gray-500 hover:text-gray-700"
      aria-label={
        unreadCount > 0
          ? `${unreadCount} unread notifications`
          : "Notifications"
      }
    >
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </a>
  );
}
