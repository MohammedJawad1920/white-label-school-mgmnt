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
    console.log(JSON.stringify(logEntry));
  });

  next();
}
