---
name: "Backend Rules"
description: "Production rules for server/** — OpenAPI + Freeze compliant"
applyTo: "server/**"
---

# Backend Instructions

Must match Backend Freeze + `server/docs/openapi.yaml` exactly.
Read the freeze doc before implementing anything.

---

## ARCHITECTURE

```
server/src/
├── app.ts              ← Express app setup, route registration, global middleware
├── server.ts           ← HTTP server bootstrap only
├── config/
│   └── env.ts          ← ALL env var access goes here; validated at startup
├── db/
│   ├── pool.ts         ← pg Pool singleton
│   ├── migrations/     ← sequential SQL files (NNN_description.sql)
│   └── seeds/          ← dev/test seed scripts
├── middleware/
│   ├── tenantContext.ts    ← extracts + validates tenantId on every tenant route
│   ├── requireRole.ts      ← role-based access control
│   ├── featureGuard.ts     ← per-tenant feature flag enforcement
│   └── superAdminAuth.ts   ← SuperAdmin JWT validation
├── modules/<feature>/
│   ├── controller.ts   ← request parsing, validation, response formatting
│   └── routes.ts       ← Express router, middleware chain, route registration
├── types/
│   └── index.ts        ← shared TypeScript types + Express augmentation
└── utils/
    ├── asyncHandler.ts ← wraps async route handlers, forwards errors
    ├── errors.ts       ← send4xx/send5xx helpers (MUST use these)
    ├── bulkDelete.ts   ← shared soft-delete helper
    └── logger.ts       ← structured logger (use instead of console.log)
```

---

## MULTI-TENANCY (non-negotiable)

- `tenantContextMiddleware` MUST run on every tenant route — it sets `req.tenantId`.
- Every SQL query on a tenant-scoped table MUST include `WHERE tenant_id = $N`.
- SuperAdmin routes MUST NOT use `tenantContextMiddleware`.
- Tenant JWT MUST be rejected on SuperAdmin routes and vice versa.
- Never derive `tenantId` from request body — only from the validated JWT/middleware.

---

## DATABASE RULES

- Use parameterized queries only — `pool.query('... WHERE id = $1', [id])`.
- Never interpolate user input into SQL strings.
- Soft delete tables: set `deleted_at = NOW()` on delete; all reads filter `WHERE deleted_at IS NULL`.
- New schema changes → new migration file `NNN_description.sql` (never edit existing migrations).
- Migration numbering: increment from the highest existing number.
- Transactions: use `BEGIN/COMMIT/ROLLBACK` for multi-step writes.
- Connection from pool only — never create standalone `pg.Client` in feature code.

---

## MODULE IMPLEMENTATION PATTERN

Every new feature module follows this exact structure:

```typescript
// modules/<feature>/routes.ts
import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { featureGuard } from "../../middleware/featureGuard";
import { asyncHandler } from "../../utils/asyncHandler";
import * as controller from "./controller";

const router = Router();

router.use(tenantContextMiddleware);

router.get("/", requireRole("Admin", "Teacher"), asyncHandler(controller.list));

router.post(
  "/",
  requireRole("Admin"),
  featureGuard("feature-key"), // only if feature-flagged
  asyncHandler(controller.create),
);

export default router;
```

```typescript
// modules/<feature>/controller.ts
import { Request, Response } from "express";
import { pool } from "../../db/pool";
import {
  send200,
  send201,
  send400,
  send404,
  send409,
} from "../../utils/errors";
import { logger } from "../../utils/logger";

export async function list(req: Request, res: Response): Promise<void> {
  const { tenantId } = req;
  const { rows } = await pool.query(
    `SELECT * FROM <table> WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId],
  );
  send200(res, rows);
}
```

Register in `app.ts`:

```typescript
import featureRouter from "./modules/<feature>/routes";
app.use("/api/<feature>", featureRouter);
```

---

## TIMETABLE RULES (v3.3)

- `POST /api/timetable` MUST reject `startTime`/`endTime` in request body.
- `GET /api/timetable` derives `label`, `startTime`, `endTime` via JOIN with `school_periods`.
- Timetable slots are immutable — end with `effective_to`, never update in place.

---

## INPUT VALIDATION

- Validate all request bodies before any DB operation.
- Use a schema validation library (Zod or Joi) — never trust `req.body` directly.
- Return `400 VALIDATION_ERROR` with field-level details on failure.
- Validate IDs are non-empty strings/UUIDs before querying DB.

---

## ERROR HANDLING

Always use the `errors.ts` helpers — never write raw `res.status().json()`:

```typescript
send400(res, "Validation failed", "VALIDATION_ERROR", {
  field: "email",
  issue: "required",
});
send401(res);
send403(res, "Feature not enabled", "FEATURE_DISABLED");
send404(res, "Student not found");
send409(res, "Email already exists");
send500(res); // for unexpected errors — logs internally
```

All unhandled async errors propagate through `asyncHandler` → global error middleware in `app.ts`.

---

## OPENAPI SYNC

- `server/docs/openapi.yaml` must match implementation exactly after every change.
- Run Prism to verify: `cd server && prism mock ./docs/openapi.yaml --port 4010`
- New endpoint → add to OpenAPI first (design-first), then implement.
- Changed response shape → update OpenAPI in same commit as code change.

---

## TESTING

### Unit tests (`tests/unit/`)

- Test every util function and middleware in isolation.
- Mock `pool.query` with `jest.fn()` — never hit real DB in unit tests.
- Cover: happy path, error path, edge cases (empty input, nulls, boundary values).

### Integration tests (`tests/integration/`)

- Use real PostgreSQL test DB (separate from dev DB).
- Each test suite: setup tenant + seed minimal data in `beforeAll`, cleanup in `afterAll`.
- Test every endpoint: 200/201, 400, 401, 403, 404, 409 where applicable.
- Test tenant isolation explicitly: request with tenant A's token must not return tenant B's data.
- Do not share state between tests — each test is independent.

### Test file naming

- `tests/unit/<module>.test.ts`
- `tests/integration/<module>.test.ts`

---

## LOGGING

```typescript
import { logger } from "../utils/logger";

logger.info({ tenantId, action: "student.created", studentId });
logger.warn({ tenantId, action: "auth.failed", reason: "bad_password" });
logger.error({ err, action: "db.query_failed", query: "list_students" });
```

Never log: passwords, JWT tokens, full request bodies containing PII, `DATABASE_URL`.

---

## ENVIRONMENT ACCESS

All env vars through `src/config/env.ts` only:

```typescript
// src/config/env.ts — validated at startup, throws if required vars missing
export const config = {
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: requireEnv("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "365d",
  port: parseInt(process.env.PORT ?? "3000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? "10", 10),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "").split(","),
  logLevel: process.env.LOG_LEVEL ?? "info",
};
```

Never use `process.env.X` directly in controllers, middleware, or utils.
