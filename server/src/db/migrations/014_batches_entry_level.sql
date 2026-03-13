-- =====================================================
-- MIGRATION: 014_batches_entry_level
-- FREEZE VERSION: v5.0
-- DATE: 2026-03-12
-- M-014 (Freeze numbering): Batch entry-level and founding session.
--
-- entry_level  — the student level at which new students enter this batch
--                (e.g. Std8, PlusOne, DegreeY1, PGY1)
-- entry_session_id — the academic session in which this batch was first enrolled
--                    (nullable: existing batches will have no founding session)
-- =====================================================

BEGIN;

ALTER TABLE batches
  ADD COLUMN entry_level      VARCHAR(50)  DEFAULT NULL,
  ADD COLUMN entry_session_id VARCHAR(50)  DEFAULT NULL
    REFERENCES academic_sessions(id) ON DELETE SET NULL;

CREATE INDEX idx_batches_entry_session ON batches(entry_session_id) WHERE entry_session_id IS NOT NULL;

COMMIT;
