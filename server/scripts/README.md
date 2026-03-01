# API Endpoint CRUD Test Scripts

Shell scripts that test **every** endpoint defined in `docs/openapi.yaml`.

## Prerequisites

1. Server running at `http://localhost:3000`
2. Database migrated and SuperAdmin seeded (`npm run seed:superadmin`)
3. `curl` and `jq` installed

## Usage

```bash
# Run ALL tests in order
./scripts/run-all-tests.sh

# Run a single module
./scripts/test-superadmin-auth.sh
./scripts/test-superadmin-tenants.sh
./scripts/test-superadmin-features.sh
./scripts/test-tenant-auth.sh
./scripts/test-users.sh
./scripts/test-batches.sh
./scripts/test-subjects.sh
./scripts/test-classes.sh
./scripts/test-students.sh
./scripts/test-features.sh
./scripts/test-school-periods.sh
./scripts/test-timetable.sh
./scripts/test-attendance.sh
```

## Environment Variables

| Variable      | Default                     | Description         |
| ------------- | --------------------------- | ------------------- |
| `BASE_URL`    | `http://localhost:3000/api` | API base URL        |
| `SA_EMAIL`    | `admin@platform.com`        | SuperAdmin email    |
| `SA_PASSWORD` | `SuperAdmin@123`            | SuperAdmin password |

## Notes

- Scripts run sequentially and depend on data created by earlier steps.
- `run-all-tests.sh` orchestrates everything and prints a summary.
- Each script prints `[PASS]` or `[FAIL]` per operation.
