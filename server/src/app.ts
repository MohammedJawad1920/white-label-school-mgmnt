import express, { Application } from "express";
import cors from "cors";
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

export function createApp(): Application {
  const app = express();

  app.use(
    cors({
      origin: config.ALLOWED_ORIGINS.length > 0 ? config.ALLOWED_ORIGINS : "*",
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(requestLogger);

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "3.5.0",
      timestamp: new Date().toISOString(),
    });
  });

  // Phase 2 — SuperAdmin (no tenantContextMiddleware inside)
  app.use("/api/super-admin", superAdminRouter);

  // Phase 3 — Tenant auth + CRUD resources
  // tenantContextMiddleware is applied inside each router individually
  // so /api/auth/login stays public
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/batches", batchesRouter);
  app.use("/api/subjects", subjectsRouter);
  app.use("/api/classes", classesRouter);
  app.use("/api/students", studentsRouter);
  app.use("/api/students", studentAttendanceRouter);
  app.use("/api/features", featuresRouter);
  app.use("/api/school-periods", schoolPeriodsRouter);
  app.use("/api/timetable", timetableRouter);
  app.use("/api/attendance", attendanceRouter);

  // Phase 4+ — uncomment as phases complete:
  // app.use('/api/timetable',  featureGuard('timetable'),  timetableRouter);
  // app.use('/api/attendance', featureGuard('attendance'), attendanceRouter);

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Endpoint not found",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.use(globalErrorHandler);
  return app;
}
