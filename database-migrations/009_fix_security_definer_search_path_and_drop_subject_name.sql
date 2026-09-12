-- 009: Fix SECURITY DEFINER search_path bindings + drop orphaned subject_name column
-- Applied: 2026-09-12
-- Addresses audit findings:
--   P0-A: handle_new_profile() and handle_new_message() lacked search_path binding,
--         exposing the functions to search-path hijacking privilege escalation.
--   P0-B: course_chapters.subject_name is a legacy drift column; canonical subject
--         resolution uses subjects.name via the subject_id FK.

-- ── 1. Bind search_path on the two unprotected SECURITY DEFINER functions ──────────────
ALTER FUNCTION public.handle_new_profile() SET search_path = public;
ALTER FUNCTION public.handle_new_message()  SET search_path = public;

-- ── 2. Drop the deprecated subject_name column from course_chapters ──────────────────
--    All frontend references have been updated to use subjects?.name || title fallback.
ALTER TABLE public.course_chapters DROP COLUMN IF EXISTS subject_name;
