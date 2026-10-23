-- ============================================================================
-- SRVS database integrity rules
--   1. Normalizes legacy status spellings to one canonical uppercase set.
--   2. Adds CHECK constraints so only canonical values can be stored.
--   (Student <-> subject rules live in prisma/sql/student-subjects.sql.)
--
-- Idempotent: safe to run more than once. No tables or columns are dropped.
-- Run with:  node scripts/migrate-db-integrity.js   (backs up + pre-checks first)
-- or paste into the Supabase SQL editor.
--
-- `prisma db push` does not manage CHECK constraints and leaves them in place.
-- ============================================================================

BEGIN;

-- 1. Normalize legacy status values --------------------------------------------
UPDATE "syllabi" SET "status" =
  CASE upper(trim("status")) WHEN 'ACTIVE' THEN 'APPROVED' WHEN 'PENDING' THEN 'SUBMITTED'
    WHEN 'PENDING_APPROVAL' THEN 'SUBMITTED' WHEN 'UNDER REVIEW' THEN 'UNDER_REVIEW' ELSE upper(trim("status")) END
WHERE "status" IS DISTINCT FROM
  CASE upper(trim("status")) WHEN 'ACTIVE' THEN 'APPROVED' WHEN 'PENDING' THEN 'SUBMITTED'
    WHEN 'PENDING_APPROVAL' THEN 'SUBMITTED' WHEN 'UNDER REVIEW' THEN 'UNDER_REVIEW' ELSE upper(trim("status")) END;

UPDATE "syllabus_versions" SET "approvalStatus" =
  CASE upper(trim("approvalStatus")) WHEN 'ACTIVE' THEN 'APPROVED' WHEN 'PENDING' THEN 'SUBMITTED'
    WHEN 'PENDING_APPROVAL' THEN 'SUBMITTED' WHEN 'UNDER REVIEW' THEN 'UNDER_REVIEW' ELSE upper(trim("approvalStatus")) END
WHERE "approvalStatus" IS DISTINCT FROM
  CASE upper(trim("approvalStatus")) WHEN 'ACTIVE' THEN 'APPROVED' WHEN 'PENDING' THEN 'SUBMITTED'
    WHEN 'PENDING_APPROVAL' THEN 'SUBMITTED' WHEN 'UNDER REVIEW' THEN 'UNDER_REVIEW' ELSE upper(trim("approvalStatus")) END;

UPDATE "syllabus_versions" SET "statusAtSave" =
  CASE upper(trim("statusAtSave")) WHEN 'ACTIVE' THEN 'APPROVED' WHEN 'PENDING' THEN 'SUBMITTED'
    WHEN 'PENDING_APPROVAL' THEN 'SUBMITTED' WHEN 'UNDER REVIEW' THEN 'UNDER_REVIEW' ELSE upper(trim("statusAtSave")) END
WHERE "statusAtSave" IS DISTINCT FROM
  CASE upper(trim("statusAtSave")) WHEN 'ACTIVE' THEN 'APPROVED' WHEN 'PENDING' THEN 'SUBMITTED'
    WHEN 'PENDING_APPROVAL' THEN 'SUBMITTED' WHEN 'UNDER REVIEW' THEN 'UNDER_REVIEW' ELSE upper(trim("statusAtSave")) END;

-- 2. CHECK constraints ------------------------------------------------------------
ALTER TABLE "syllabi" DROP CONSTRAINT IF EXISTS "syllabi_status_check";
ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_status_check"
  CHECK ("status" IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'));

ALTER TABLE "syllabus_versions" DROP CONSTRAINT IF EXISTS "syllabus_versions_approval_status_check";
ALTER TABLE "syllabus_versions" ADD CONSTRAINT "syllabus_versions_approval_status_check"
  CHECK ("approvalStatus" IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'));

ALTER TABLE "syllabus_versions" DROP CONSTRAINT IF EXISTS "syllabus_versions_status_at_save_check";
ALTER TABLE "syllabus_versions" ADD CONSTRAINT "syllabus_versions_status_at_save_check"
  CHECK ("statusAtSave" IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'));

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_check";
ALTER TABLE "users" ADD CONSTRAINT "users_role_check"
  CHECK ("role" IN ('Admin', 'DepartmentHead', 'Educator', 'Student'));

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_account_status_check";
ALTER TABLE "users" ADD CONSTRAINT "users_account_status_check"
  CHECK ("accountStatus" IN ('Active', 'PendingApproval', 'Rejected', 'Deactivated'));

ALTER TABLE "syllabi" DROP CONSTRAINT IF EXISTS "syllabi_semester_check";
ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_semester_check"
  CHECK ("semester" IN ('1st Semester', '2nd Semester', 'Summer'));

ALTER TABLE "subjects" DROP CONSTRAINT IF EXISTS "subjects_semester_check";
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_semester_check"
  CHECK ("semester" IS NULL OR "semester" IN ('1st Semester', '2nd Semester', 'Summer'));

COMMIT;
