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

### `server/.env` (v5.0 additions)

```
R2_BUCKET=              # Cloudflare R2 bucket name (school profile uploads)
R2_ENDPOINT=            # Cloudflare R2 endpoint URL
R2_ACCESS_KEY_ID=       # R2 access key ID
R2_SECRET_ACCESS_KEY=   # R2 secret access key

VAPID_PUBLIC_KEY=       # Web Push VAPID public key  (P2 — push notifications)
VAPID_PRIVATE_KEY=      # Web Push VAPID private key (P2 — push notifications)

SENTRY_DSN=             # Sentry error tracking DSN (optional)
```

### `apps/tenant-app/.env`

```
VITE_APP_ENV=           # development | production
VITE_API_BASE_URL=      # http://localhost:3000/api/v1   ← /v1 prefix required (v5.0)
VITE_APP_BASE_URL=      # http://localhost:5173
VITE_APP_NAME=          # display name shown in UI
VITE_TENANT_ID=         # UUID of the tenant (required; boot fails if absent)
VITE_VAPID_PUBLIC_KEY=  # Web Push VAPID public key (P2 — leave blank for now)
VITE_SENTRY_DSN=        # Sentry DSN (optional)
VITE_BUILD_SHA=         # Git SHA of the build (set in CI; use 'local' for dev)
VITE_THEME_COLOR=       # Hex color for PWA theme-color meta tag (e.g. #1A5276)
```

### `apps/superadmin-app/.env`

```
VITE_APP_ENV=           # development | production
VITE_API_BASE_URL=      # http://localhost:3000/api/v1   ← /v1 prefix required (v5.0)
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
#    IMPORTANT: 018 is destructive (TRUNCATE tenants CASCADE + VARCHAR→UUID).
#    IMPORTANT: 039 converts all remaining entity ids to UUID and MUST run before 019–038.
#    Run them in this exact sequence:

# Phase 0 — initial schema (001–017)
psql -U postgres -d school_management -f src/db/migrations/001_initial_schema.sql
psql -U postgres -d school_management -f src/db/migrations/002_add_student_user_id.sql
psql -U postgres -d school_management -f src/db/migrations/003_add_attendance_corrections.sql
psql -U postgres -d school_management -f src/db/migrations/004_student_admission_dob.sql
psql -U postgres -d school_management -f src/db/migrations/005_tenant_timezone.sql
psql -U postgres -d school_management -f src/db/migrations/006_student_status_classid_nullable.sql
psql -U postgres -d school_management -f src/db/migrations/007_batch_status_graduated.sql
psql -U postgres -d school_management -f src/db/migrations/008_timeslot_remove_effective_dates.sql
psql -U postgres -d school_management -f src/db/migrations/009_academic_calendar_events.sql
psql -U postgres -d school_management -f src/db/migrations/010_users_token_version.sql
psql -U postgres -d school_management -f src/db/migrations/011_users_must_change_password.sql
psql -U postgres -d school_management -f src/db/migrations/012_attendance_records_update.sql
psql -U postgres -d school_management -f src/db/migrations/013_academic_sessions.sql
psql -U postgres -d school_management -f src/db/migrations/014_batches_entry_level.sql
psql -U postgres -d school_management -f src/db/migrations/015_classes_session_level_section.sql
psql -U postgres -d school_management -f src/db/migrations/016_students_enrollment_dates.sql
psql -U postgres -d school_management -f src/db/migrations/017_tenants_school_profile.sql

# v5.0 — tenants.id VARCHAR→UUID (DESTRUCTIVE: truncates all tenant data)
psql -U postgres -d school_management -f src/db/migrations/018_tenants_uuid.sql

# v5.0 prerequisite — convert ALL remaining entity ids to UUID before Phase 1+2 migrations
# (numbered 039 but logically a prerequisite for 019–038; must run here)
psql -U postgres -d school_management -f src/db/migrations/039_entity_ids_to_uuid.sql

# Phase 1+2 — feature modules (019–038)
psql -U postgres -d school_management -f src/db/migrations/019_leave_requests.sql
psql -U postgres -d school_management -f src/db/migrations/020_guardians.sql
psql -U postgres -d school_management -f src/db/migrations/021_student_guardians.sql
psql -U postgres -d school_management -f src/db/migrations/022_push_subscriptions.sql
psql -U postgres -d school_management -f src/db/migrations/023_notifications.sql
psql -U postgres -d school_management -f src/db/migrations/024_events_check_session_id.sql
psql -U postgres -d school_management -f src/db/migrations/025_promotion_logs_v5.sql
psql -U postgres -d school_management -f src/db/migrations/026_promotion_previews_v5.sql
psql -U postgres -d school_management -f src/db/migrations/027_exams.sql
psql -U postgres -d school_management -f src/db/migrations/028_exam_subjects.sql
psql -U postgres -d school_management -f src/db/migrations/029_exam_results.sql
psql -U postgres -d school_management -f src/db/migrations/030_exam_student_summaries.sql
psql -U postgres -d school_management -f src/db/migrations/031_external_results.sql
psql -U postgres -d school_management -f src/db/migrations/032_fee_charges.sql
psql -U postgres -d school_management -f src/db/migrations/033_fee_payments.sql
psql -U postgres -d school_management -f src/db/migrations/034_announcements.sql
psql -U postgres -d school_management -f src/db/migrations/035_import_jobs.sql
psql -U postgres -d school_management -f src/db/migrations/036_tenants_profile_note.sql
psql -U postgres -d school_management -f src/db/migrations/037_assignments.sql
psql -U postgres -d school_management -f src/db/migrations/038_assignment_submissions.sql

# 5. Seed in this order (superadmin must exist before tenants)
#    NOTE: Migration 018 is destructive — tenant data is wiped on a fresh run.
#    After seeding, copy the new tenant UUID from the SuperAdmin app into
#    apps/tenant-app/.env as VITE_TENANT_ID=<uuid>
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
