/**
 * Push Subscription Controller
 *
 * POST   /api/v1/push/subscribe  — UPSERT a Web Push subscription for the current user
 * DELETE /api/v1/push/subscribe  — remove a Web Push subscription by endpoint
 */

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../../db/pool";
import { send400 } from "../../utils/errors";
import { logger } from "../../utils/logger";

// ═══════════════════════════════════════════════════════════════════
// POST /api/v1/push/subscribe
// ═══════════════════════════════════════════════════════════════════

export async function subscribe(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  const { endpoint, p256dh, auth, deviceLabel } = req.body as {
    endpoint?: string;
    p256dh?: string;
    auth?: string;
    deviceLabel?: string;
  };

  // ── Validation ────────────────────────────────────────────────────
  if (!endpoint || typeof endpoint !== "string" || endpoint.trim() === "") {
    send400(res, "endpoint is required", "VALIDATION_ERROR", {
      field: "endpoint",
      issue: "required",
    });
    return;
  }
  if (!p256dh || typeof p256dh !== "string" || p256dh.trim() === "") {
    send400(res, "p256dh is required", "VALIDATION_ERROR", {
      field: "p256dh",
      issue: "required",
    });
    return;
  }
  if (!auth || typeof auth !== "string" || auth.trim() === "") {
    send400(res, "auth is required", "VALIDATION_ERROR", {
      field: "auth",
      issue: "required",
    });
    return;
  }

  // ── UPSERT push subscription ──────────────────────────────────────
  await pool.query(
    `INSERT INTO push_subscriptions
       (id, user_id, tenant_id, endpoint, p256dh, auth, device_label)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, endpoint)
     DO UPDATE SET
       p256dh       = EXCLUDED.p256dh,
       auth         = EXCLUDED.auth,
       device_label = EXCLUDED.device_label`,
    [
      uuidv4(),
      userId,
      tenantId,
      endpoint.trim(),
      p256dh.trim(),
      auth.trim(),
      deviceLabel ?? null,
    ],
  );

  logger.info(
    { tenantId, userId, action: "push.subscribed" },
    "push.subscribed",
  );

  res.status(201).json({ message: "Subscribed successfully" });
}

// ═══════════════════════════════════════════════════════════════════
// DELETE /api/v1/push/subscribe
// ═══════════════════════════════════════════════════════════════════

export async function unsubscribe(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  const { endpoint } = req.body as {
    endpoint?: string;
  };

  // ── Validation ────────────────────────────────────────────────────
  if (!endpoint || typeof endpoint !== "string" || endpoint.trim() === "") {
    send400(res, "endpoint is required", "VALIDATION_ERROR", {
      field: "endpoint",
      issue: "required",
    });
    return;
  }

  // ── Delete subscription ───────────────────────────────────────────
  await pool.query(
    `DELETE FROM push_subscriptions
     WHERE user_id = $1 AND tenant_id = $2 AND endpoint = $3`,
    [userId, tenantId, endpoint.trim()],
  );

  logger.info(
    { tenantId, userId, action: "push.unsubscribed" },
    "push.unsubscribed",
  );

  res.status(200).json({ message: "Unsubscribed successfully" });
}
