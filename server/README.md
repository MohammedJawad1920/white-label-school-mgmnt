# White-Label School Management System — Backend v3.3

Multi-tenant school management API. PostgreSQL + Node.js + TypeScript.

---

## Quick Start (Local)

### Prerequisites

- Node.js >= 20
- PostgreSQL 16 running locally **or** Docker

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and JWT_SECRET
```

### 3. Run the migration

```bash
# If psql is on your PATH:
npm run migrate

# Or manually:
psql $DATABASE_URL -f src/db/migrations/001_initial_schema.sql
```

### 4. Seed the SuperAdmin

```bash
npm run seed:superadmin
# Default credentials: admin@platform.com / SuperAdmin@123
# Override: SA_SEED_EMAIL=x SA_SEED_PASSWORD=y npm run seed:superadmin
```

### 5. Start the dev server

```bash
npm run dev
# → Server started on port 3000
# → GET http://localhost:3000/health
```

---

## Quick Start (Docker)

```bash
# Copy and edit env — at minimum set JWT_SECRET
cp .env.example .env

# Start API + PostgreSQL
docker compose up -d

# Wait for healthy, then seed
docker compose exec api node -e "
  require('./dist/db/seeds/superadmin');
"

# Check health
curl http://localhost:3000/health
```

---

## Available Scripts

| Script                    | Description                                   |
| ------------------------- | --------------------------------------------- |
| `npm run dev`             | Dev server with hot-reload (ts-node-dev)      |
| `npm run build`           | Compile TypeScript → `dist/`                  |
| `npm start`               | Run compiled production server                |
| `npm run typecheck`       | Type-check without emitting                   |
| `npm run migrate`         | Apply `001_initial_schema.sql` via psql       |
| `npm run seed:superadmin` | Create the platform SuperAdmin                |
| `npm run mock`            | Run Prism mock server on port 4010            |
| `npm run mock:verbose`    | Prism mock with request/response errors shown |

---

## Mock Server (Contract Testing)

Prism reads `./docs/openapi.yaml` and serves mock responses:

```bash
npm run mock
# → Prism mock server running on http://localhost:4010

# Test a mocked endpoint:
curl -X POST http://localhost:4010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@school.com","password":"password1","tenantSlug":"school1"}'
```

Prism validates:

- Request bodies match OpenAPI schemas
- Response shapes match the spec
- Required parameters are present

---

## Smoke Test Steps

Run these in order against a freshly deployed instance to verify all phases.

### Step 1 — Health

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","version":"3.3.0","timestamp":"..."}
```

### Step 2 — SuperAdmin login

```bash
curl -X POST http://localhost:3000/api/super-admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@platform.com","password":"SuperAdmin@123"}'
# Expected: 200 { token, superAdmin }
# Save: SA_TOKEN=<token>
```

### Step 3 — Create tenant (seeds 8 periods atomically)

```bash
curl -X POST http://localhost:3000/api/super-admin/tenants \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"school-001","name":"Sunrise School","slug":"sunrise"}'
# Expected: 201 { tenant: { id, status:"active", ... } }
```

### Step 4 — Enable timetable feature

```bash
curl -X PUT http://localhost:3000/api/super-admin/tenants/school-001/features/timetable \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'
# Expected: 200 { feature: { key:"timetable", enabled:true } }
```

### Step 5 — Enable attendance (requires timetable)

```bash
curl -X PUT http://localhost:3000/api/super-admin/tenants/school-001/features/attendance \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'
# Expected: 200
# If timetable was not enabled first: 400 FEATURE_DEPENDENCY
```

### Step 6 — Create tenant Admin user (needs direct DB insert for first user)

```bash
# Via psql — insert the first Admin for the tenant
# (subsequent users can be created via API)
psql $DATABASE_URL -c "
  INSERT INTO users (id,tenant_id,name,email,password_hash,roles,created_at,updated_at)
  VALUES (
    'U-001','school-001','School Admin','admin@sunrise.com',
    '\$2b\$10\$Yq8stqTpNOe2xN.5Q6gJmOr2sZ/RzJ5Fzs0KYg7WLFVXy0O9nzwhi',
    '[\"Admin\"]','NOW()','NOW()'
  );
"
# Password above is hash of: AdminPass@123
```

### Step 7 — Tenant login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sunrise.com","password":"AdminPass@123","tenantSlug":"sunrise"}'
# Expected: 200 { token, user: { roles:["Admin"], activeRole:"Admin" } }
# Save: TENANT_TOKEN=<token>
```

### Step 8 — Verify school periods were seeded

```bash
curl http://localhost:3000/api/school-periods \
  -H "Authorization: Bearer $TENANT_TOKEN"
# Expected: 200 { periods: [ 8 entries with periodNumber 1-8 ] }
```

### Step 9 — Create resources

```bash
# Batch
curl -X POST http://localhost:3000/api/batches \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"2025-26","startYear":2025,"endYear":2026}'

# Subject
curl -X POST http://localhost:3000/api/subjects \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Mathematics","code":"MATH"}'

# Class (use batchId from step above)
curl -X POST http://localhost:3000/api/classes \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Grade 10A","batchId":"<BATCH_ID>"}'
```

### Step 10 — Create timetable entry

```bash
curl -X POST http://localhost:3000/api/timetable \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "classId":"<CLASS_ID>",
    "subjectId":"<SUBJECT_ID>",
    "teacherId":"<TEACHER_ID>",
    "dayOfWeek":"Monday",
    "periodNumber":3,
    "effectiveFrom":"2026-03-01"
  }'
# Expected: 201 { timeSlot: { startTime:"09:40", endTime:"10:25", label:"Period 3", ... } }
```

### Step 11 — Record attendance

```bash
curl -X POST http://localhost:3000/api/attendance/record-class \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "timeSlotId":"<TIMESLOT_ID>",
    "date":"2026-03-03",
    "defaultStatus":"Present",
    "exceptions":[{"studentId":"<STU_ID>","status":"Absent"}]
  }'
# Expected: 201 { recorded:N, present:N-1, absent:1, late:0, ... }
```

### Step 12 — Verify PERIOD_NOT_CONFIGURED guard

```bash
curl -X POST http://localhost:3000/api/timetable \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"classId":"<CLASS_ID>","subjectId":"<SUBJECT_ID>","teacherId":"<TEACHER_ID>","dayOfWeek":"Monday","periodNumber":99,"effectiveFrom":"2026-03-01"}'
# Expected: 400 { error: { code:"PERIOD_NOT_CONFIGURED", ... } }
```

---

## Project Structure

```
/
├── .env.example
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── README.md
├── docs/
│   └── openapi.yaml          ← Prism mock source, v3.3.0
└── src/
    ├── server.ts              ← TCP entry point (listen)
    ├── app.ts                 ← Express factory (testable)
    ├── config/env.ts          ← Validated env config
    ├── db/
    │   ├── pool.ts
    │   ├── migrations/001_initial_schema.sql
    │   └── seeds/superadmin.ts
    ├── middleware/
    │   ├── tenantContext.ts
    │   ├── superAdminAuth.ts
    │   ├── requireRole.ts
    │   └── featureGuard.ts
    ├── modules/
    │   ├── auth/
    │   ├── super-admin/
    │   ├── users/
    │   ├── batches/
    │   ├── subjects/
    │   ├── classes/
    │   ├── students/
    │   ├── school-periods/
    │   ├── timetable/
    │   └── attendance/
    ├── types/index.ts
    └── utils/
        ├── asyncHandler.ts
        ├── bulkDelete.ts
        ├── errors.ts
        └── logger.ts
```

---

## Environment Variables Reference

| Variable            | Required | Rule                                     |
| ------------------- | -------- | ---------------------------------------- |
| `PORT`              | No       | Default: 3000                            |
| `NODE_ENV`          | Yes      | `development` \| `production` \| `test`  |
| `DATABASE_URL`      | Yes      | Must start with `postgresql://`          |
| `DATABASE_POOL_MIN` | No       | Default: 2                               |
| `DATABASE_POOL_MAX` | No       | Default: 10                              |
| `JWT_SECRET`        | Yes      | Minimum 32 characters                    |
| `JWT_EXPIRES_IN`    | Yes      | Format: `Nd` (e.g. `365d`), minimum `7d` |
| `BCRYPT_ROUNDS`     | Yes      | Must be `10`, `11`, or `12`              |
| `ALLOWED_ORIGINS`   | No       | Comma-separated origins, default: `*`    |
| `LOG_LEVEL`         | No       | Default: `info`                          |
