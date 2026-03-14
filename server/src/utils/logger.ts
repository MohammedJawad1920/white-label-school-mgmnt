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
    const logEntry = {
      requestId,
      userId: req.userId ?? req.superAdminId ?? null,
      route: `${req.method} ${req.path}`,
      statusCode: res.statusCode,
      latencyMs: Date.now() - startMs,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(logEntry));
  });

  next();
}

// ─── Application Logger ───────────────────────────────────────────────────────
// Simple structured logger for use in service and controller code.
// Never log passwords, tokens, or PII.

type LogLevel = "info" | "error" | "debug" | "warn";

function log(
  level: LogLevel,
  data: Record<string, unknown>,
  message: string,
): void {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ level, message, ...data, ts: new Date().toISOString() }),
  );
}

export const logger = {
  info: (data: Record<string, unknown>, message: string) =>
    log("info", data, message),
  error: (data: Record<string, unknown>, message: string) =>
    log("error", data, message),
  debug: (data: Record<string, unknown>, message: string) =>
    log("debug", data, message),
  warn: (data: Record<string, unknown>, message: string) =>
    log("warn", data, message),
};
