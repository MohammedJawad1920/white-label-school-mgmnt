/**
 * server.ts — TCP entry point
 *
 * WHY separate from app.ts:
 * app.ts exports createApp() — a pure factory that builds the Express app
 * without binding to any port. This lets integration tests import createApp()
 * and call supertest(createApp()) without spinning up a real TCP server.
 *
 * server.ts is the ONLY file that calls app.listen(). It is never imported
 * by tests.
 */

import { createApp } from "./app";
import { config } from "./config/env";
import { logger } from "./utils/logger";
import { startAllJobs, stopAllJobs } from "./services/cron.service";

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info(
    {
      event: "server_started",
      port: config.PORT,
      nodeEnv: config.NODE_ENV,
      version: "6.0.0",
    },
    "Server started",
  );
  // Start background cron jobs after server is listening
  startAllJobs();
});

// Graceful shutdown — wait for in-flight requests before exiting.
// WHY: A hard kill during an open DB transaction can corrupt data or leave
// locks. SIGTERM from Docker/K8s gives the process time to drain.
function shutdown(signal: string) {
  logger.info({ event: "shutdown_signal", signal }, "Shutdown signal received");
  stopAllJobs();
  server.close(() => {
    logger.info({ event: "server_closed" }, "Server closed");
    process.exit(0);
  });

  // Force-kill after 10 seconds if connections don't drain
  setTimeout(() => {
    logger.error(
      { event: "shutdown_timeout_force_exit" },
      "Shutdown timeout — force exit",
    );
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Catch unhandled rejections — log and exit so the process doesn't silently
// continue in a broken state under a process manager that will restart it.
process.on("unhandledRejection", (reason) => {
  logger.error(
    { event: "unhandled_rejection", reason: String(reason) },
    "Unhandled rejection",
  );
  process.exit(1);
});
