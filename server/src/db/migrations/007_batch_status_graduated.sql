-- v4.0 CR-23: batch.status enum 'Archived' renamed to 'Graduated' (breaking change)
-- All existing 'Archived' batches become 'Graduated'.

-- 1. Migrate existing data
UPDATE batches SET status = 'Graduated' WHERE status = 'Archived';

-- 2. Replace the CHECK constraint
ALTER TABLE batches DROP CONSTRAINT batches_status_check;
ALTER TABLE batches
  ADD CONSTRAINT batches_status_check CHECK(status IN ('Active', 'Graduated'));
