# School Management SaaS

Multi-tenant school management system for small institutions (≤500 students).

## Features

- JWT-based authentication with bcrypt password hashing
- Multi-tenant architecture with path-based routing
- Timetable management module
- Attendance tracking module
- Row-level tenant isolation (security tested)

## Tech Stack

- Backend: Node.js, Express
- Database: PostgreSQL with JSONB support
- Auth: JWT + bcrypt (10 rounds)
- Security: Tenant context middleware + isolation tests

## Architecture Highlights

- Immutable timetable versioning (effective_from / effective_to)
- JSONB roles array for flexible authorization
- Feature flags for per-tenant module activation
- Tenant-scoped queries preventing cross-tenant data leaks

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Installation

cd server
npm install

cp .env.example .env
Edit .env with your database credentials

psql -U postgres -c "CREATE DATABASE school_management;"
psql -U postgres school_management < server/database/schema.sql

node server/index.js

## API Endpoints

### Authentication

POST /api/auth/login - Login with email, password, tenantSlug  
POST /api/auth/logout - Logout (client discards token)

### Health Check

GET /health - Server status

## Testing

### Tenant Isolation Test

node server/scripts/test-tenant-isolation.js  
Validates that cross-tenant data access is impossible.

### Create Test User

node server/scripts/create-test-user.js

## Project Status

Foundation Complete (Week 1–2)

Completed:

- Database schema (10 tables)
- Authentication system
- Tenant isolation (tested)
- Login / Logout endpoints

Planned:

- Timetable CRUD (Week 3–6)
- Attendance recording (Week 5–6)
- Frontend (Week 7–8)

## Security Features

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens signed with 256-bit secret
- Tenant context enforced on every protected route
- SQL injection prevention via parameterized queries
- Cross-tenant data leak prevention (tested)

## Learning Goals

- Multi-tenant database design and isolation
- Secure authentication and authorization flows
- Backend architecture patterns (middleware, controllers, routes)
- PostgreSQL advanced features (JSONB, constraints, cascading)
- Production-ready security practices

## License

MIT
