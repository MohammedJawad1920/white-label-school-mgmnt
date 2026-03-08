-- Migration 008: CR-31 — Strip effectiveFrom/effectiveTo from timeslots
-- Backend Freeze v4.3.0
--
-- Drops effective_from and effective_to columns.
-- The old partial index idx_timeslots_active_unique (which uses effective_to
-- in its WHERE clause) is automatically dropped by PostgreSQL when
-- effective_to is dropped.
-- A new unique index on (tenant_id, class_id, day_of_week, period_number)
-- WHERE deleted_at IS NULL replaces the old conflict-check logic.

ALTER TABLE timeslots
  DROP COLUMN effective_from,
  DROP COLUMN effective_to;

-- New unique constraint: one non-deleted slot per class/day/period per tenant
CREATE UNIQUE INDEX idx_timeslots_unique_slot
  ON timeslots(tenant_id, class_id, day_of_week, period_number)
  WHERE deleted_at IS NULL;
