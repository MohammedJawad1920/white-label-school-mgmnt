-- =====================================================
-- MIGRATION: 002_add_student_user_id
-- FREEZE VERSION: v3.4
-- DATE: 2026-03-02
-- CR-08: Link student enrollment rows to user accounts
--
-- Adds user_id nullable FK on students → users.
-- Unique partial index enforces one student per user (WHERE user_id IS NOT NULL).
-- ON DELETE SET NULL: soft-deleting a user unlocks their student slot.
-- =====================================================

BEGIN;

ALTER TABLE students
  ADD COLUMN user_id VARCHAR(50) DEFAULT NULL
    REFERENCES users(id) ON DELETE SET NULL;

-- Unique per non-null value: a user can be linked to at most one student record
CREATE UNIQUE INDEX idx_students_user_id
  ON students(user_id)
  WHERE user_id IS NOT NULL;

COMMIT;
