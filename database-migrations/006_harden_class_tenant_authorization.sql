-- ============================================================================
-- EdTech Island: Migration 006
-- Harden Class Tenant Authorization & Drop Null-Tenant Fallbacks
-- ============================================================================

-- 1. Drop default 'inst-dps-001' fallback on classes.institution_id
-- Every class must be explicitly associated with its actual tenant institution upon creation.
ALTER TABLE public.classes ALTER COLUMN institution_id DROP DEFAULT;

-- 2. Harden classes_select_policy:
-- Drop the insecure "institution_id IS NULL" hole so unassociated or null-tenant
-- classes are never visible to regular authenticated users.
DROP POLICY IF EXISTS "classes_select_policy" ON public.classes;

CREATE POLICY "classes_select_policy" ON public.classes
FOR SELECT TO authenticated
USING (
  public.is_admin() OR 
  (
    ((is_archived = false) OR (is_archived IS NULL)) AND
    institution_id IS NOT NULL AND
    institution_id = public.get_my_department()
  )
);

-- 3. Ensure composite indexes for fast class membership & assignment lookups
CREATE INDEX IF NOT EXISTS idx_class_students_composite ON public.class_students(class_id, student_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_composite ON public.class_teachers(class_id, teacher_id);
