/**
 * Notifications Controller
 *
 * GET  /api/v1/notifications          — paginated list, optional unreadOnly filter
 * PUT  /api/v1/notifications/read-all — batch-mark all unread as read
 * PUT  /api/v1/notifications/:id/read — mark a single notification as read
 */

import { Request, Response } from "express";
import { pool } from "../../db/pool";
import { send404 } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { NotificationRow, ApiNotification } from "../../types";

// ─── Formatter ───────────────────────────────────────────────────────────────

function fmtNotification(r: NotificationRow): ApiNotification {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    userId: r.user_id,
    type: r.type,
    title: r.title,
    body: r.body,
    data: r.data,
    readAt:
      r.read_at instanceof Date
        ? r.read_at.toISOString()
        : r.read_at
          ? String(r.read_at)
          : null,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  };
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/v1/notifications
// ═══════════════════════════════════════════════════════════════════

export async function listNotifications(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  const {
    limit: limitStr,
    offset: offsetStr,
    unreadOnly,
  } = req.query as {
    limit?: string;
    offset?: string;
    unreadOnly?: string;
  };

  const limit = Math.max(1, parseInt(limitStr ?? "20", 10) || 20);
  const offset = Math.max(0, parseInt(offsetStr ?? "0", 10) || 0);
  const filterUnread = unreadOnly === "true";

  const unreadClause = filterUnread ? "AND read_at IS NULL" : "";

  type NotificationRowWithCount = NotificationRow & { total_count: string };

  const result = await pool.query<NotificationRowWithCount>(
    `SELECT *, COUNT(*) OVER() AS total_count
     FROM notifications
     WHERE user_id = $1
       AND tenant_id = $2
       ${unreadClause}
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [userId, tenantId, limit, offset],
  );

  const total =
    result.rows.length > 0 ? parseInt(result.rows[0]!.total_count, 10) : 0;

  res.status(200).json({
    data: result.rows.map(fmtNotification),
    total,
  });
}

// ═══════════════════════════════════════════════════════════════════
// PUT /api/v1/notifications/:id/read
// ═══════════════════════════════════════════════════════════════════

export async function markOneRead(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const { id } = req.params;

  // First check the notification exists for this user+tenant
  const existing = await pool.query<NotificationRow>(
    `SELECT * FROM notifications
     WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
    [id, userId, tenantId],
  );
  if (existing.rows.length === 0) {
    send404(res, "Notification not found");
    return;
  }

  const current = existing.rows[0]!;

  // Only update if not already read
  if (current.read_at === null) {
    const updated = await pool.query<NotificationRow>(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND tenant_id = $3
       RETURNING *`,
      [id, userId, tenantId],
    );

    logger.info(
      { tenantId, userId, action: "notification.read", notificationId: id },
      "notification.read",
    );

    res.status(200).json(fmtNotification(updated.rows[0]!));
    return;
  }

  // Already read — return current state as-is
  res.status(200).json(fmtNotification(current));
}

// ═══════════════════════════════════════════════════════════════════
// PUT /api/v1/notifications/read-all
// ═══════════════════════════════════════════════════════════════════

export async function markAllRead(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  const result = await pool.query(
    `UPDATE notifications
     SET read_at = NOW()
     WHERE user_id = $1 AND tenant_id = $2 AND read_at IS NULL`,
    [userId, tenantId],
  );

  logger.info(
    {
      tenantId,
      userId,
      action: "notification.read_all",
      updated: result.rowCount,
    },
    "notification.read_all",
  );

  res.status(200).json({ updated: result.rowCount ?? 0 });
}
