# White-Label School Management System — IMMUTABLE SPECS

SOURCE OF TRUTH (must follow exactly):

- Backend Freeze: docs/freeze/white_label_backend_architecture_freeze.md (v4.4) [IMMUTABLE]
- Frontend Freeze: docs/freeze/white_label_frontend_architecture_freeze.md (v1.8) [IMMUTABLE]
- OpenAPI: docs/openapi.yaml (v4.4.0) [CANONICAL CONTRACT]

NON-NEGOTIABLE RULE:

- Do NOT change scope, schema, endpoints, request/response shapes, status codes, error codes, or invariants.
- If any request conflicts with the Freeze/OpenAPI, REFUSE and reply:
  "This conflicts with Freeze [Backend v4.3 / Frontend v1.7] — Section [X]. Raise a Change Request to proceed."

MONOREPO MAP (do not invent new apps):

- server/ = backend (Node.js + TS + Express + PostgreSQL)
- apps/tenant-app/ = tenant web app (React 18 + Vite + TS)
- apps/superadmin-app/ = superadmin portal (React 18 + Vite + TS)

WORKFLOW (always):

1. Plan first: list files to edit + acceptance criteria impacted.
2. Implement minimal diff (small PR-sized).
3. Add/Update tests when behavior changes.
4. Verify with tooling (typecheck/lint/tests); don’t “assume” correctness.

BACKEND CONTRACT RULES:

- OpenAPI must match implementation exactly.
- Prism mock must work from backend root: `cd server && prism mock ./docs/openapi.yaml --port 4010`.

FRONTEND CONTRACT RULES:

- UI must not invent endpoints/fields not present in OpenAPI.
- Tenant app and SuperAdmin portal must stay isolated (separate auth storage keys; never mix tokens).
