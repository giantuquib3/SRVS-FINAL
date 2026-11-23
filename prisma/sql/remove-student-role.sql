-- ============================================================================
-- Remove the Student role's database objects.
--
-- The app no longer has a Student role or an Enrollments feature. This drops the
-- objects that only existed for students. Run it when you're ready; the app does
-- not depend on these objects any more, so it works with or without this migration.
--
--   * student_subjects            (student <-> subject enrollments; must be empty)
--   * enforce_student_subject_rules()   (trigger function used only by that table)
--   * users."yearLevel", users."program"   (student-only profile fields)
--   * users.role default 'Student' -> 'Educator'
--
-- The users_role_check constraint (prisma/sql/db-integrity.sql) already excludes
-- 'Student', so no student accounts can exist.
--
-- Safe to run more than once. Aborts without changing anything if student_subjects
-- still has rows. Paste into the Supabase SQL editor, or run `npx prisma db push`
-- (the Prisma schema already matches this end state).
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.student_subjects') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.student_subjects) THEN
    RAISE EXCEPTION 'student_subjects is not empty; back it up and clear it before running this migration.';
  END IF;
END $$;

-- Dropping the table also drops its trigger, indexes, constraints and RLS policies.
DROP TABLE IF EXISTS public.student_subjects;
DROP FUNCTION IF EXISTS enforce_student_subject_rules();

ALTER TABLE public.users DROP COLUMN IF EXISTS "yearLevel";
ALTER TABLE public.users DROP COLUMN IF EXISTS "program";
ALTER TABLE public.users ALTER COLUMN "role" SET DEFAULT 'Educator';

COMMIT;
