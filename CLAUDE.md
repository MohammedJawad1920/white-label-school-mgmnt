# White-Label School Management System — Claude Agent Instructions

## FIRST: Read these files before every task

Use the Read tool to open ALL of these before writing any code:

- `.github/copilot-instructions.md` — master rules, monorepo structure, security, workflow
- `.github/instructions/backend.instructions.md` — backend patterns (server/\*\*)
- `.github/instructions/frontend.instructions.md` — frontend patterns (apps/\*\*)
- `.github/instructions/environment.instructions.md` — env vars, bootstrap, migrations

Do not proceed until all four are read.

---

## MONOREPO STRUCTURE

```
white-label-school-mgmt-main/
├── apps/
│   ├── tenant-app/        ← React 18 + Vite (port 5173)
│   └── superadmin-app/    ← React 18 + Vite (port 5174)
├── docs/freeze/           ← IMMUTABLE — never edit
├── server/                ← Node.js + Express + PostgreSQL (port 3000)
│   └── docs/openapi.yaml  ← canonical live contract
└── .github/
    ├── copilot-instructions.md
    └── instructions/
```

Port map: backend=3000, tenant-app=5173, superadmin-app=5174

---

## MANDATORY WORKFLOW (every task, no exceptions)

1. **Read first** — open the relevant Freeze doc and `server/docs/openapi.yaml`
2. **Plan** — list every file to create/edit and acceptance criteria for each
3. **Minimal diff** — implement the smallest correct change; no unrelated refactoring
4. **Tests** — add/update tests when any behavior changes
5. **Verify** — run typecheck + lint + tests before marking done
6. **OpenAPI sync** — if any backend route changes, update `server/docs/openapi.yaml` in the same commit

---

## NON-NEGOTIABLE CONSTRAINTS

- Do NOT change scope, schema, endpoints, request/response shapes, status codes, or error codes
- Do NOT invent new apps, packages, or top-level directories
- Do NOT use `any` type anywhere in TypeScript
- Do NOT use `console.log` — use `src/utils/logger.ts`
- Do NOT write raw `res.status().json()` — use `send4xx/send5xx` helpers from `utils/errors.ts`
- Do NOT call `fetch` or `axios` directly in React components — use the typed API client layer
- Do NOT commit secrets, `.env` files, or credentials
- Do NOT derive `tenantId` from request body — only from validated JWT/middleware
- If a request conflicts with the Freeze docs — STOP and reply:
  > "This conflicts with Freeze [Backend / Frontend] — Section [X]. Raise a Change Request to proceed."

---

## MULTI-TENANCY (non-negotiable)

- `tenantContextMiddleware` MUST run on every tenant route — sets `req.tenantId`
- Every SQL query on a tenant-scoped table MUST include `WHERE tenant_id = $N`
- SuperAdmin routes MUST NOT use `tenantContextMiddleware`
- Tenant JWT MUST be rejected on SuperAdmin routes and vice versa
- Two isolated frontend apps — never share code, tokens, or state between `tenant-app` and `superadmin-app`

---

## API ERROR SHAPE (non-negotiable)

Every API error must use this exact shape:

```json
{
  "error": {
    "code": "SNAKE_CASE_CODE",
    "message": "Human readable message",
    "details": {},
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

Standard codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`, `FEATURE_DISABLED`, `INTERNAL_ERROR`

---

## SECURITY RULES

- Every tenant-scoped query MUST filter by `tenantId` — no exceptions
- Parameterized queries only — never interpolate user input into SQL strings
- Passwords hashed with bcrypt (`BCRYPT_ROUNDS` from env)
- JWT signed with `JWT_SECRET` from env — never hardcoded
- CORS restricted to `ALLOWED_ORIGINS` env var
- All env vars through `src/config/env.ts` only — never `process.env.X` in feature code
- Never log: passwords, JWT tokens, full request bodies with PII, `DATABASE_URL`
- Soft delete: set `deleted_at = NOW()`; all reads filter `WHERE deleted_at IS NULL`

---

## NEW FEATURE CHECKLIST

### Backend

- [ ] `server/src/modules/<feature>/controller.ts`
- [ ] `server/src/modules/<feature>/routes.ts`
- [ ] Register in `server/src/app.ts`
- [ ] Migration: `server/src/db/migrations/NNN_<description>.sql` (increment NNN)
- [ ] `featureGuard` middleware if feature-flagged
- [ ] `requireRole` on every protected route
- [ ] Unit + integration tests
- [ ] `server/docs/openapi.yaml` updated

### Frontend (tenant-app)

- [ ] `apps/tenant-app/src/api/<feature>.ts` (typed, uses `apiClient`)
- [ ] `apps/tenant-app/src/features/<feature>/` pages
- [ ] Route in `App.tsx` with `ProtectedRoute` + `FeatureGate` + `RoleGate`
- [ ] Nav entry in `config/nav.ts` if user-visible
- [ ] Query keys in `utils/queryKeys.ts`
- [ ] Component tests: render + loading + error state

---

## SOURCE OF TRUTH

| Artifact           | Path                                                      | Status              |
| ------------------ | --------------------------------------------------------- | ------------------- |
| Backend Freeze     | `docs/freeze/white_label_backend_architecture_freeze.md`  | IMMUTABLE           |
| Frontend Freeze    | `docs/freeze/white_label_frontend_architecture_freeze.md` | IMMUTABLE           |
| OpenAPI (live)     | `server/docs/openapi.yaml`                                | CANONICAL CONTRACT  |
| OpenAPI (snapshot) | `docs/freeze/white_label_openapi.yaml`                    | READ-ONLY REFERENCE |

---

## MEMORY

Use `/memory` to persist project-specific decisions (e.g. migration numbers, feature flag keys, schema decisions) across sessions. Run `/init` to initialize if starting fresh.
