-- =====================================================
-- MIGRATION: 034_announcements
-- FREEZE VERSION: v5.0 (M-034)
-- DATE: 2026-03-15
--
-- WHY: Announcements module requires a table to store targeted
-- announcements with audience control, scheduled publish, and
-- push notification dispatch tracking.
--
-- WHAT CHANGES:
--   announcements  — new table
-- =====================================================

BEGIN;

CREATE TABLE announcements (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id         UUID         NOT NULL REFERENCES academic_sessions(id),
  title              VARCHAR(255) NOT NULL,
  body               TEXT         NOT NULL,
  link_url           TEXT         DEFAULT NULL,
  link_label         VARCHAR(100) DEFAULT NULL,
  audience_type      VARCHAR(50)  NOT NULL
                       CHECK(audience_type IN ('All', 'Class', 'Batch', 'StudentsOnly', 'TeachersOnly', 'GuardiansOnly')),
  audience_class_id  UUID         REFERENCES classes(id),
  audience_batch_id  UUID         REFERENCES batches(id),
  created_by         UUID         NOT NULL REFERENCES users(id),
  created_by_role    VARCHAR(50)  NOT NULL,
  publish_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMPTZ  DEFAULT NULL,
  push_sent          BOOLEAN      NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcements_tenant
  ON announcements(tenant_id, publish_at DESC);

CREATE INDEX idx_announcements_push_pending
  ON announcements(tenant_id, publish_at)
  WHERE push_sent = false;

COMMIT;
