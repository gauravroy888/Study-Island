-- ============================================================================
-- EdTech Island: Migration 011
-- Enable Chat Roster, Staff & Admin Directory, and Classmate Visibility
-- Enroll Current Students and Teachers into Class 6th
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HELPER FUNCTION: get_my_class_ids()
-- Returns the list of class IDs the current student belongs to
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_class_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT class_id FROM public.class_students WHERE student_id = public.get_my_profile_id();
$$;

-- ----------------------------------------------------------------------------
-- 2. CLASS_STUDENTS: Allow students to view peer roster in their own classes
-- ----------------------------------------------------------------------------
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_students_select" ON public.class_students;
CREATE POLICY "class_students_select" ON public.class_students
  FOR SELECT TO authenticated
  USING (
    (public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text]))
    OR (class_id IN (SELECT public.get_my_class_ids()))
    OR (student_id = public.get_my_profile_id())
  );

-- ----------------------------------------------------------------------------
-- 3. PROFILES: Allow viewing faculty/staff and classmates sharing a class
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    -- 1. Self profile
    auth_id = auth.uid()
    -- 2. Administrators can view all profiles
    OR public.is_admin()
    -- 3. Faculty & Staff (teachers, admins, superadmins) are visible to all authenticated users
    OR (role = ANY (ARRAY['teacher'::text, 'admin'::text, 'super_admin'::text]))
    -- 4. Teachers can view students enrolled in their assigned classes
    OR (
      public.get_my_role() = 'teacher'::text
      AND id IN (
        SELECT cs.student_id
        FROM public.class_students cs
        JOIN public.class_teachers ct ON ct.class_id = cs.class_id
        WHERE ct.teacher_id = public.get_my_profile_id()
      )
    )
    -- 5. Students can view classmates who are enrolled in their shared classes
    OR (
      public.get_my_role() = 'student'::text
      AND id IN (
        SELECT cs.student_id
        FROM public.class_students cs
        WHERE cs.class_id IN (SELECT public.get_my_class_ids())
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 4. DATA SEEDING: Assign Teacher Harsh to Class 6th alongside Teacher Gaurav
-- ----------------------------------------------------------------------------
INSERT INTO public.class_teachers (class_id, teacher_id, subjects)
VALUES ('7aa68b4d-a78f-4e32-bb10-63af15fe6c5c', 'a6683006-36a2-4179-b544-a4d6e0fdf3d4', 'Mathematics & Computing')
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. DATA SEEDING: Enroll all current students into Class 6th
-- ----------------------------------------------------------------------------
INSERT INTO public.class_students (class_id, student_id)
VALUES
  ('7aa68b4d-a78f-4e32-bb10-63af15fe6c5c', 'adf15e97-1617-4111-a434-deda5c81f614'), -- GAURAV Roy
  ('7aa68b4d-a78f-4e32-bb10-63af15fe6c5c', '8729e042-9ccd-4e5e-b4f9-41bf6f6466a6'), -- Harsh
  ('7aa68b4d-a78f-4e32-bb10-63af15fe6c5c', '66fdfdcd-d922-48fa-bdc5-a47e01e6a6bf'), -- Saurav Roy
  ('7aa68b4d-a78f-4e32-bb10-63af15fe6c5c', '15daf08b-d95f-4bd5-adf2-8653785f9bf8'), -- Casey Smith
  ('7aa68b4d-a78f-4e32-bb10-63af15fe6c5c', '986c71d3-b15f-4048-9ac4-b27cc397bb36')  -- 李建勋
ON CONFLICT (class_id, student_id) DO NOTHING;
