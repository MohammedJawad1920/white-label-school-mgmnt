---
name: "Environment & Bootstrap"
description: "Local dev setup, env vars, DB bootstrap, and run order"
applyTo: "**"
---

# Environment & Bootstrap Instructions

---

## REQUIRED ENV FILES (never commit values)

### `server/.env`

```
DATABASE_URL=           # PostgreSQL connection string
JWT_SECRET=             # 256-bit hex (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_EXPIRES_IN=         # e.g. 365d
PORT=                   # default 3000
NODE_ENV=               # development | production | test

DATABASE_POOL_MIN=      # default 2
DATABASE_POOL_MAX=      # default 10

BCRYPT_ROUNDS=          # default 10 (never below 10 in production)

ALLOWED_ORIGINS=        # comma-separated: http://localhost:5173,http://localhost:5174

LOG_LEVEL=              # info | debug | error
```

### `apps/tenant-app/.env`

```
VITE_APP_ENV=           # development | production
VITE_API_BASE_URL=      # http://localhost:3000/api
VITE_APP_BASE_URL=      # http://localhost:5173
VITE_APP_NAME=          # display name shown in UI
```

### `apps/superadmin-app/.env`

```
VITE_APP_ENV=           # development | production
VITE_API_BASE_URL=      # http://localhost:3000/api
VITE_APP_BASE_URL=      # http://localhost:5174
VITE_APP_NAME=          # display name shown in UI
```

---

## GITIGNORE — REQUIRED ENTRIES

```
server/.env
apps/tenant-app/.env
apps/superadmin-app/.env
apps/**/.env.local
```

The root `.gitignore` `.env` entry does NOT cover subdirectory env files. Add the above explicitly.

---

## LOCAL BOOTSTRAP ORDER

Run these steps exactly once on a fresh clone:

```bash
# 1. Install all dependencies
npm install                            # root (installs workspaces)

# 2. Start the database
cd server && docker-compose up -d      # starts PostgreSQL on port 5432

# 3. Create the database
psql -U postgres -c "CREATE DATABASE school_management;"

# 4. Run migrations in order (001 → latest)
psql -U postgres -d school_management -f src/db/migrations/001_initial_schema.sql
psql -U postgres -d school_management -f src/db/migrations/002_add_student_user_id.sql
psql -U postgres -d school_management -f src/db/migrations/003_add_attendance_corrections.sql
psql -U postgres -d school_management -f src/db/migrations/004_student_admission_dob.sql
psql -U postgres -d school_management -f src/db/migrations/005_tenant_timezone.sql
psql -U postgres -d school_management -f src/db/migrations/006_student_status_classid_nullable.sql
psql -U postgres -d school_management -f src/db/migrations/007_batch_status_graduated.sql
psql -U postgres -d school_management -f src/db/migrations/008_timeslot_remove_effective_dates.sql
psql -U postgres -d school_management -f src/db/migrations/009_academic_calendar_events.sql

# 5. Seed in this order (superadmin must exist before tenants)
npx ts-node src/db/seeds/superadmin.ts
npx ts-node src/db/seeds/reset-tenants.ts

# 6. Start backend
npm run dev                            # from server/

# 7. Start frontend apps (separate terminals)
cd apps/tenant-app && npm run dev      # port 5173
cd apps/superadmin-app && npm run dev  # port 5174
```

---

## ADDING A NEW MIGRATION

1. Find the highest numbered migration in `server/src/db/migrations/`.
2. Create `NNN_description.sql` where NNN = last number + 1 (zero-padded to 3 digits).
3. Write only additive SQL (new tables, new columns with defaults, new indexes).
4. Never modify or delete existing migration files.
5. Update the bootstrap order above when adding a new migration.
6. Run it locally: `psql -U postgres -d school_management -f src/db/migrations/NNN_description.sql`

---

## TEST DATABASE SETUP

Integration tests use a separate database to avoid contaminating dev data.

```bash
psql -U postgres -c "CREATE DATABASE school_management_test;"
# run all migrations against _test DB
# set DATABASE_URL=postgresql://postgres:<password>@localhost:5432/school_management_test in server/.env.test
```

Run integration tests:

```bash
cd server && npm run test:integration
```

Run unit tests:

```bash
cd server && npm test
```

---

## VERIFY OPENAPI CONTRACT

After any backend change, verify Prism can serve the mock without errors:

```bash
cd server && npx prism mock ./docs/openapi.yaml --port 4010
```

If Prism errors, the implementation diverges from the contract — fix before merging.

---

## ENVIRONMENT VALIDATION AT STARTUP

`server/src/config/env.ts` validates all required vars at process start.
If a required var is missing, the server exits with a clear error message.
Never silence startup env errors — a missing `JWT_SECRET` in production is a critical failure.

---

## SECRETS ROTATION

When rotating `JWT_SECRET`:

- All existing JWTs are immediately invalidated (all users logged out).
- Coordinate with a deployment — do not rotate mid-session in production without a plan.
- Update the secret in your secrets manager / deployment env, not in `.env` files committed to repo.
