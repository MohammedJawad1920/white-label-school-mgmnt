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

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(
    JSON.stringify({
      event: "server_started",
      port: config.PORT,
      nodeEnv: config.NODE_ENV,
      version: "3.5.0",
      timestamp: new Date().toISOString(),
    }),
  );
});

// Graceful shutdown — wait for in-flight requests before exiting.
// WHY: A hard kill during an open DB transaction can corrupt data or leave
// locks. SIGTERM from Docker/K8s gives the process time to drain.
function shutdown(signal: string) {
  console.log(JSON.stringify({ event: "shutdown_signal", signal }));
  server.close(() => {
    console.log(JSON.stringify({ event: "server_closed" }));
    process.exit(0);
  });

  // Force-kill after 10 seconds if connections don't drain
  setTimeout(() => {
    console.error(JSON.stringify({ event: "shutdown_timeout_force_exit" }));
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Catch unhandled rejections — log and exit so the process doesn't silently
// continue in a broken state under a process manager that will restart it.
process.on("unhandledRejection", (reason) => {
  console.error(
    JSON.stringify({ event: "unhandled_rejection", reason: String(reason) }),
  );
  process.exit(1);
});
