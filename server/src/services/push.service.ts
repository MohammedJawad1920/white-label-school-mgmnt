/**
 * Push Notification Service (v5.0)
 *
 * VAPID web-push delivery. Non-blocking — called after response is sent.
 * Handles 410 Gone by deleting stale subscriptions from DB.
 * 5-second timeout, 2 retries on transient failures.
 */

import webpush from "web-push";
import { pool } from "../db/pool";
import { config } from "../config/env";
import { logger } from "../utils/logger";
import { NotificationType } from "../types";

let vapidConfigured = false;

function ensureVapidConfigured(): void {
  if (vapidConfigured) return;
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) return;
  webpush.setVapidDetails(
    config.VAPID_SUBJECT || "mailto:admin@school.local",
    config.VAPID_PUBLIC_KEY,
    config.VAPID_PRIVATE_KEY,
  );
  vapidConfigured = true;
}

export function isPushConfigured(): boolean {
  return !!(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY);
}

export interface PushPayload {
  type: NotificationType;
  title: string;
  body: string;
  route?: string;
  data?: Record<string, unknown>;
}

export interface PushSubscriptionData {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function removeSubscription(
  subscriptionId: string,
  tenantId: string,
): Promise<void> {
  try {
    await pool.query(
      "DELETE FROM push_subscriptions WHERE id = $1 AND tenant_id = $2",
      [subscriptionId, tenantId],
    );
  } catch (err) {
    logger.error(
      { err, subscriptionId },
      "Failed to remove stale push subscription",
    );
  }
}

/**
 * Send a push notification to a single subscription.
 * Non-blocking — call without await after sending HTTP response.
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  tenantId: string,
  payload: PushPayload,
): Promise<void> {
  if (!isPushConfigured()) return;
  ensureVapidConfigured();

  const pushSub = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: {
      type: payload.type,
      route: payload.route ?? "/notifications",
      ...payload.data,
    },
  });

  const options: webpush.RequestOptions = {
    TTL: 86400, // 1 day
    urgency: "normal",
    timeout: 5000,
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await webpush.sendNotification(pushSub, body, options);
      return;
    } catch (err) {
      const status = err instanceof webpush.WebPushError ? err.statusCode : 500;

      if (status === 410) {
        // Subscription expired — remove it and stop retrying
        await removeSubscription(subscription.id, tenantId);
        return;
      }

      lastError = err instanceof Error ? err : new Error(String(err));

      if (status === 400 || status === 404) {
        // Bad subscription — no point retrying
        break;
      }

      // Transient error — retry after short delay
      if (attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 200 * (attempt + 1)),
        );
      }
    }
  }

  if (lastError) {
    logger.warn(
      { err: lastError, endpoint: subscription.endpoint },
      "Push notification delivery failed",
    );
  }
}

/**
 * Send push notification to all subscriptions of a user.
 * Non-blocking.
 */
export async function sendPushToUser(
  userId: string,
  tenantId: string,
  payload: PushPayload,
): Promise<void> {
  if (!isPushConfigured()) return;

  try {
    const { rows } = await pool.query<{
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }>(
      `SELECT id, endpoint, p256dh, auth
       FROM push_subscriptions
       WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    await Promise.allSettled(
      rows.map((sub) => sendPushNotification(sub, tenantId, payload)),
    );
  } catch (err) {
    logger.error(
      { err, userId, tenantId },
      "Failed to fetch push subscriptions",
    );
  }
}
