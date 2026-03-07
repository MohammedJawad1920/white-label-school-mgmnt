---
name: "Backend Freeze Rules"
description: "Hard rules for server/** to stay OpenAPI+Freeze compliant"
applyTo: "server/**"
---

Must match Backend Freeze v4.2 + OpenAPI v4.2.0 exactly.

- Multi-tenancy: every tenant-scoped query MUST filter by tenantId. [file:1]
- Soft delete: deletes set deletedAt; reads filter deletedAt IS NULL (for specified tables). [file:1]
- SuperAdmin routes MUST NOT use tenantContextMiddleware; tenant routes MUST reject SuperAdmin JWT. [file:1][file:3]
- Error response shape MUST be `{ error: { code, message, details?, timestamp } }`. [file:1][file:3]
- Timetable v3.3: POST /api/timetable must reject startTime/endTime in body; GET derives label/startTime/endTime via JOIN with schoolperiods. [file:1][file:3]
- Use automated checks/tests to validate changes. [web:4]
