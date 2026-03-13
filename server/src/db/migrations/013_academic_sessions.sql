-- =====================================================
-- MIGRATION: 013_academic_sessions
-- FREEZE VERSION: v5.0
-- DATE: 2026-03-12
-- M-013 (Freeze numbering): Academic sessions lifecycle table.
--
-- Status machine: UPCOMING → ACTIVE → COMPLETED
-- Constraint: at most one ACTIVE session per tenant (enforced via partial
-- unique index — simpler than btree_gist EXCLUDE and equally correct).
--
-- Also adds promotion infrastructure:
--   promotion_previews — TTL-10-min snapshot for transition/commit guard
--   promotion_logs     — immutable audit of committed promotions
-- =====================================================

BEGIN;

-- =====================================================
-- TABLE: academic_sessions
-- =====================================================
CREATE TABLE academic_sessions (
  id         VARCHAR(50)  PRIMARY KEY,
  tenant_id  VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  status     VARCHAR(20)  NOT NULL DEFAULT 'UPCOMING'
               CHECK(status IN ('UPCOMING', 'ACTIVE', 'COMPLETED')),
  start_date DATE         NOT NULL,
  end_date   DATE         NOT NULL,
  deleted_at TIMESTAMPTZ  DEFAULT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_academic_sessions_date_range CHECK(end_date > start_date)
);

CREATE INDEX idx_academic_sessions_tenant     ON academic_sessions(tenant_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_academic_sessions_status     ON academic_sessions(tenant_id, status);

-- One ACTIVE session per tenant (application also enforces 409 CONFLICT)
CREATE UNIQUE INDEX idx_academic_sessions_single_active
  ON academic_sessions(tenant_id)
  WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- =====================================================
-- TABLE: promotion_previews (TTL 10 minutes)
-- Stores a snapshot of the proposed batch transition for commit guard.
-- =====================================================
CREATE TABLE promotion_previews (
  id                VARCHAR(50)  PRIMARY KEY,
  tenant_id         VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_session_id VARCHAR(50)  NOT NULL REFERENCES academic_sessions(id),
  preview_data      JSONB        NOT NULL,  -- per-batch student snapshot
  expires_at        TIMESTAMPTZ  NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promotion_previews_tenant    ON promotion_previews(tenant_id);
CREATE INDEX idx_promotion_previews_expires   ON promotion_previews(expires_at);

-- =====================================================
-- TABLE: promotion_logs (immutable audit)
-- Written on a successful transition/commit.
-- =====================================================
CREATE TABLE promotion_logs (
  id                   VARCHAR(50)  PRIMARY KEY,
  tenant_id            VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_session_id    VARCHAR(50)  NOT NULL REFERENCES academic_sessions(id),
  target_session_id    VARCHAR(50)  NOT NULL REFERENCES academic_sessions(id),
  committed_by         VARCHAR(50)  NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  snapshot             JSONB        NOT NULL,  -- full record of what was promoted
  rolled_back          BOOLEAN      NOT NULL DEFAULT false,
  rolled_back_at       TIMESTAMPTZ  DEFAULT NULL,
  rolled_back_by       VARCHAR(50)  DEFAULT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promotion_logs_tenant        ON promotion_logs(tenant_id);
CREATE INDEX idx_promotion_logs_source        ON promotion_logs(source_session_id);

COMMIT;
