# =====================================================
# Dockerfile — White-Label School Management v3.3
# Multi-stage build: build → production
#
# WHY multi-stage:
# The build stage installs devDependencies (TypeScript compiler, type stubs)
# which are large (~200MB). The production stage copies only the compiled
# dist/ folder and production node_modules, keeping the final image ~150MB.
# =====================================================

# ── Stage 1: Build ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first — Docker layer cache: if package.json unchanged,
# this expensive npm ci step is skipped on subsequent builds.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Stage 2: Production ───────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies in the final image
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy OpenAPI spec (needed if prism mock is run from within container)
COPY docs/ ./docs/

# Non-root user for security — never run as root in production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Metadata
LABEL org.opencontainers.image.title="White-Label School Management"
LABEL org.opencontainers.image.version="3.3.0"

EXPOSE 3000

# Use exec form (no shell) so SIGTERM from Docker reaches the Node process
# directly, not a shell wrapper — required for graceful shutdown.
CMD ["node", "dist/server.js"]