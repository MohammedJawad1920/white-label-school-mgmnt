-- v4.0 CR-21 + CR-22: student.class_id nullable (graduated students have class_id = NULL)
--                      student.status field added (Active | DroppedOff | Graduated)

-- CR-21: allow class_id to be NULL (graduation sets class_id = NULL)
ALTER TABLE students ALTER COLUMN class_id DROP NOT NULL;

-- CR-22: add status column with DB-level constraint
--        idempotent: only add if not already present
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'Active'
    CHECK(status IN ('Active', 'DroppedOff', 'Graduated'));

-- Index for tenant-scoped status filtering (used by GET /students?status=...)
CREATE INDEX IF NOT EXISTS idx_students_status ON students(tenant_id, status);
