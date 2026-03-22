/**
 * Structured Request Logger
 *
 * Freeze §6 required log fields: requestId, userId (if known), route,
 * statusCode, latencyMs.
 * PII rule: Do NOT log passwords, tokens, or raw JWT payloads.
 *
 * WHY attach requestId: Lets you correlate a single HTTP request's logs
 * across middleware, controller, and DB query in a log aggregator.
 */

import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import pino from "pino";
import { config } from "../config/env";

// Extend Request type locally to carry requestId
interface RequestWithId extends Request {
  requestId?: string;
  userId?: string;
  superAdminId?: string;
}

export function requestLogger(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const requestId = randomUUID();
  const startMs = Date.now();

  req.requestId = requestId;

  res.on("finish", () => {
    logger.info(
      {
        requestId,
        userId: req.userId ?? req.superAdminId ?? null,
        route: `${req.method} ${req.path}`,
        statusCode: res.statusCode,
        latencyMs: Date.now() - startMs,
      },
      "http.request",
    );
  });

  next();
}

// ─── Application Logger ───────────────────────────────────────────────────────
// Simple structured logger for use in service and controller code.
// Never log passwords, tokens, or PII.

export const logger = pino({
  level: config.LOG_LEVEL,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});
