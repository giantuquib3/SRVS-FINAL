-- ============================================================================
-- SRVS migration: describe each student <-> subject enrollment
--
-- Adds to public.student_subjects:
--   status        ENROLLED | COMPLETED | DROPPED          (default ENROLLED)
--   academicYear  e.g. '2026-2027'                         (default '2026-2027')
--   semester      1st Semester | 2nd Semester | Summer     (default '1st Semester')
--   enrolledById  FK -> users.id: who created the enrollment (NULL = unknown)
--
-- The many-to-many rules are unchanged: one row per (studentId, subjectId)
-- via uq_student_subjects, and both ids must exist (foreign keys).
--
-- Run with:  node scripts/migrate-student-subjects-columns.js
--            (backs up student_subjects, restores each existing row's term from the
--             class-sections backup, and runs everything in ONE transaction)
-- ============================================================================

BEGIN;

ALTER TABLE public.student_subjects
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'ENROLLED';
ALTER TABLE public.student_subjects
  ADD COLUMN IF NOT EXISTS "academicYear" text NOT NULL DEFAULT '2026-2027';
ALTER TABLE public.student_subjects
  ADD COLUMN IF NOT EXISTS "semester" text NOT NULL DEFAULT '1st Semester';
ALTER TABLE public.student_subjects
  ADD COLUMN IF NOT EXISTS "enrolledById" integer;

ALTER TABLE public.student_subjects DROP CONSTRAINT IF EXISTS "student_subjects_status_check";
ALTER TABLE public.student_subjects ADD CONSTRAINT "student_subjects_status_check"
  CHECK ("status" IN ('ENROLLED', 'COMPLETED', 'DROPPED'));

ALTER TABLE public.student_subjects DROP CONSTRAINT IF EXISTS "student_subjects_semester_check";
ALTER TABLE public.student_subjects ADD CONSTRAINT "student_subjects_semester_check"
  CHECK ("semester" IN ('1st Semester', '2nd Semester', 'Summer'));

ALTER TABLE public.student_subjects DROP CONSTRAINT IF EXISTS "student_subjects_academic_year_check";
ALTER TABLE public.student_subjects ADD CONSTRAINT "student_subjects_academic_year_check"
  CHECK ("academicYear" ~ '^[0-9]{4}-[0-9]{4}$');

ALTER TABLE public.student_subjects DROP CONSTRAINT IF EXISTS "fk_student_subjects_enrolled_by";
ALTER TABLE public.student_subjects ADD CONSTRAINT "fk_student_subjects_enrolled_by"
  FOREIGN KEY ("enrolledById") REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "student_subjects_enrolledById_idx" ON public.student_subjects ("enrolledById");
CREATE INDEX IF NOT EXISTS "student_subjects_status_idx" ON public.student_subjects ("status");

COMMIT;
