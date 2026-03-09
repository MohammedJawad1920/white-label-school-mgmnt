# White-Label School Management System — COPILOT MASTER INSTRUCTIONS

---

## SOURCE OF TRUTH (read these before every task)

| Artifact                  | Path                                                      | Status              |
| ------------------------- | --------------------------------------------------------- | ------------------- |
| Backend Freeze            | `docs/freeze/white_label_backend_architecture_freeze.md`  | IMMUTABLE           |
| Frontend Freeze           | `docs/freeze/white_label_frontend_architecture_freeze.md` | IMMUTABLE           |
| OpenAPI (editable)        | `server/docs/openapi.yaml`                                | CANONICAL CONTRACT  |
| OpenAPI (freeze snapshot) | `docs/freeze/white_label_openapi.yaml`                    | READ-ONLY REFERENCE |

**Rule:** `server/docs/openapi.yaml` is the live contract. It must stay identical to the freeze snapshot unless a formal Change Request is raised. Never edit the freeze snapshot directly.

---

## NON-NEGOTIABLE CONSTRAINTS

- Do NOT change scope, schema, endpoints, request/response shapes, status codes, or error codes.
- Do NOT invent new apps, packages, or top-level directories.
- Do NOT use `any` type anywhere in TypeScript.
- Do NOT commit secrets, `.env` files, or credentials.
- Do NOT use `console.log` in production code — use the logger utility.
- If a request conflicts with the Freeze or OpenAPI, REFUSE and reply:
  > "This conflicts with Freeze [Backend / Frontend] — Section [X]. Raise a Change Request to proceed."

---

## MONOREPO STRUCTURE

```
white-label-school-mgmt-main/
├── .github/
│   ├── copilot-instructions.md        ← this file
│   └── instructions/
│       ├── backend.instructions.md    ← applyTo: server/**
│       ├── frontend.instructions.md   ← applyTo: apps/**
│       └── environment.instructions.md
├── apps/
│   ├── tenant-app/                    ← React 18 + Vite (port 5173)
│   └── superadmin-app/                ← React 18 + Vite (port 5174)
├── docs/freeze/                       ← IMMUTABLE snapshots
└── server/                            ← Node.js + Express + PostgreSQL
    └── docs/openapi.yaml              ← editable canonical contract
```

**Port map:** backend=3000, tenant-app=5173, superadmin-app=5174

---

## MANDATORY WORKFLOW (every task, no exceptions)

1. **Read first** — open the relevant Freeze doc and OpenAPI before writing any code.
2. **Plan** — list every file to create/edit and the acceptance criteria for each.
3. **Minimal diff** — implement the smallest correct change. No refactoring unrelated code.
4. **Tests** — add/update tests when any behavior changes (see per-layer rules below).
5. **Verify** — run typecheck + lint + tests before marking done. Never assume correctness.
6. **OpenAPI sync** — if a backend route changes, update `server/docs/openapi.yaml` in the same PR.

---

## NEW FEATURE CHECKLIST

For every new domain feature (e.g. "grades", "fees"):

### Backend

- [ ] `server/src/modules/<feature>/controller.ts`
- [ ] `server/src/modules/<feature>/routes.ts`
- [ ] Register routes in `server/src/app.ts`
- [ ] New migration: `server/src/db/migrations/NNN_<description>.sql` (increment NNN)
- [ ] `featureGuard` middleware added if feature-flagged
- [ ] `requireRole` middleware on every protected route
- [ ] Unit tests for any new utils/middleware
- [ ] Integration tests covering happy path + all error cases
- [ ] `server/docs/openapi.yaml` updated

### Frontend (tenant-app)

- [ ] `apps/tenant-app/src/api/<feature>.ts` (typed, uses `apiClient`)
- [ ] `apps/tenant-app/src/features/<feature>/` pages and components
- [ ] Route registered in `App.tsx` with `ProtectedRoute` + `FeatureGate` + `RoleGate`
- [ ] Navigation entry added to `config/nav.ts` if user-visible
- [ ] Query keys added to `utils/queryKeys.ts`
- [ ] Tests: component renders + error state + loading state

---

## SECURITY RULES (production non-negotiable)

- Every tenant-scoped query MUST filter by `tenantId` — no exceptions.
- SuperAdmin JWT and Tenant JWT are different tokens — never sent to the same endpoints.
- All user input MUST be validated with Zod (frontend) and Joi/Zod (backend) before processing.
- Parameterized queries only — no string interpolation in SQL.
- Passwords hashed with bcrypt (rounds from `BCRYPT_ROUNDS` env var).
- JWT signed with `JWT_SECRET` from env — never hardcoded.
- CORS restricted to `ALLOWED_ORIGINS` env var.
- No sensitive data in logs (no passwords, tokens, PII).
- `deletedAt` soft-delete: all reads filter `WHERE deleted_at IS NULL`.

---

## ERROR HANDLING CONTRACT

All API errors MUST use this shape — no exceptions:

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

## TESTING STANDARDS

| Layer                    | Tool                           | What to test                                         |
| ------------------------ | ------------------------------ | ---------------------------------------------------- |
| Backend utils/middleware | Jest (unit)                    | Every branch, including edge cases                   |
| Backend routes           | Jest + Supertest (integration) | Happy path + all HTTP error codes                    |
| Frontend components      | Vitest + Testing Library       | Render, user interaction, error state, loading state |
| Frontend hooks           | Vitest                         | State transitions                                    |
| Frontend API mocking     | MSW                            | Never mock axios directly                            |

Coverage requirement: all new code must have tests. No untested happy paths shipped.

---

## CODE STYLE

- TypeScript strict mode — no `any`, no `@ts-ignore` without explanation comment.
- No `console.log` — use `src/utils/logger.ts`.
- No hardcoded strings for roles, feature keys — use constants/enums.
- No inline styles in React — Tailwind classes only.
- No direct `fetch` in React — use the typed API client layer.
- Async errors caught with `asyncHandler` wrapper (backend) or React Query (frontend).
- All env vars accessed through `src/config/env.ts` (backend) or `import.meta.env` (frontend) — never `process.env` directly in feature code.
