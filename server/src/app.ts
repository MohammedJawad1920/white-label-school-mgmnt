import express, { Application } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config/env";
import { requestLogger } from "./utils/logger";
import { globalErrorHandler } from "./utils/errors";

// Phase 2
import superAdminRouter from "./modules/super-admin/routes";
// Phase 3
import authRouter from "./modules/auth/routes";
import usersRouter from "./modules/users/routes";
import batchesRouter from "./modules/batches/routes";
import subjectsRouter from "./modules/subjects/routes";
import classesRouter from "./modules/classes/routes";
import studentsRouter from "./modules/students/routes";
import featuresRouter from "./modules/features/routes";
import schoolPeriodsRouter from "./modules/school-periods/routes";
import timetableRouter from "./modules/timetable/routes";
import attendanceRouter, {
  studentAttendanceRouter,
} from "./modules/attendance/routes";
import eventsRouter from "./modules/events/routes";
// Phase 4 (v5.0)
import academicSessionsRouter, {
  promotionsRouter,
} from "./modules/academic-sessions/routes";
import schoolProfileRouter from "./modules/school-profile/routes";
import settingsRouter from "./modules/settings/routes";

export function createApp(): Application {
  const app = express();

  app.use(
    cors({
      origin: config.ALLOWED_ORIGINS.length > 0 ? config.ALLOWED_ORIGINS : "*",
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: false }));

  // Global rate limiting (Freeze §1.5)
  const globalLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    skip: () => !config.RATE_LIMIT_ENABLED,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(globalLimiter);

  // Stricter limit on login — 10 req/min per IP
  const authLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    skip: () => !config.RATE_LIMIT_ENABLED,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/v1/auth/login", authLimiter);

  app.use(requestLogger);

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "5.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  // SuperAdmin (no tenantContextMiddleware inside)
  app.use("/api/v1/super-admin", superAdminRouter);

  // Tenant auth + CRUD resources
  // tenantContextMiddleware is applied inside each router individually
  // so /api/v1/auth/login stays public
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/batches", batchesRouter);
  app.use("/api/v1/subjects", subjectsRouter);
  app.use("/api/v1/classes", classesRouter);
  app.use("/api/v1/students", studentsRouter);
  app.use("/api/v1/students", studentAttendanceRouter);
  app.use("/api/v1/features", featuresRouter);
  app.use("/api/v1/school-periods", schoolPeriodsRouter);
  app.use("/api/v1/timetable", timetableRouter);
  app.use("/api/v1/attendance", attendanceRouter);
  app.use("/api/v1/events", eventsRouter);
  // v5.0 modules
  app.use("/api/v1/academic-sessions", academicSessionsRouter);
  app.use("/api/v1/promotions", promotionsRouter);
  app.use("/api/v1/school-profile", schoolProfileRouter);
  app.use("/api/v1/settings", settingsRouter);

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Endpoint not found",
        details: {},
      },
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use(globalErrorHandler);
  return app;
}
