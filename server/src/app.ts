/**
 * Express App Factory
 *
 * WHY split app.ts from server.ts:
 * Tests import createApp() without starting a real TCP server.
 */

import express, { Application } from "express";
import cors from "cors";
import { config } from "./config/env";
import { requestLogger } from "./utils/logger";
import { globalErrorHandler } from "./utils/errors";
import superAdminRouter from "./modules/super-admin/routes";

export function createApp(): Application {
  const app = express();

  // ── Security & Parsing ─────────────────────────────────────────────────
  app.use(
    cors({
      origin: config.ALLOWED_ORIGINS.length > 0 ? config.ALLOWED_ORIGINS : "*",
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  // ── Structured Logging ─────────────────────────────────────────────────
  app.use(requestLogger);

  // ── Health Check (unauthenticated) ────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "3.3.0",
      timestamp: new Date().toISOString(),
    });
  });

  // ── Phase 2: SuperAdmin Routes ─────────────────────────────────────────
  app.use("/api/super-admin", superAdminRouter);

  // Phase 3+: routes added here as phases complete
  // app.use('/api/auth', authRouter);
  // app.use('/api/users', tenantContextMiddleware, usersRouter);
  // app.use('/api/school-periods', tenantContextMiddleware, schoolPeriodsRouter);
  // app.use('/api/timetable', tenantContextMiddleware, featureGuard('timetable'), timetableRouter);
  // app.use('/api/attendance', tenantContextMiddleware, featureGuard('attendance'), attendanceRouter);

  // ── 404 Handler ────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Endpoint not found", details: {} },
      timestamp: new Date().toISOString(),
    });
  });

  // ── Global Error Handler (must be last) ───────────────────────────────
  app.use(globalErrorHandler);

  return app;
}
