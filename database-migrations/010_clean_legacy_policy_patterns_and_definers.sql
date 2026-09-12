-- ============================================================================
-- EdTech Island: Migration 010
-- Clean Legacy Policy Patterns, Eliminate Null-Student Fallbacks,
-- Enforce Explicit TO authenticated, and Add Symmetric WITH CHECK on Updates
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ANALYTICS_EVENTS: Drop legacy null student fallback policy
-- ----------------------------------------------------------------------------
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "edtech_ae_insert_own" ON public.analytics_events;

-- ----------------------------------------------------------------------------
-- 2. TEST_SUBMISSIONS: Drop legacy null student fallback policy
-- ----------------------------------------------------------------------------
ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "edtech_ts_insert_own" ON public.test_submissions;

-- ----------------------------------------------------------------------------
-- 3. ANNOUNCEMENTS: Clean duplicate policies and standardize authenticated access
-- ----------------------------------------------------------------------------
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
DROP POLICY IF EXISTS "Admins create announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins delete announcements" ON public.announcements;

DROP POLICY IF EXISTS "announcements_select_policy" ON public.announcements;
CREATE POLICY "announcements_select_policy" ON public.announcements
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "announcements_insert" ON public.announcements;
CREATE POLICY "announcements_insert" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text]));

DROP POLICY IF EXISTS "announcements_update" ON public.announcements;
CREATE POLICY "announcements_update" ON public.announcements
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text]))
  WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text]));

DROP POLICY IF EXISTS "announcements_delete" ON public.announcements;
CREATE POLICY "announcements_delete" ON public.announcements
  FOR DELETE TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text]));

-- ----------------------------------------------------------------------------
-- 4. TEACHERS: Enforce explicit authenticated role check
-- ----------------------------------------------------------------------------
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teachers_select_policy" ON public.teachers;
CREATE POLICY "teachers_select_policy" ON public.teachers
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 5. CLASS_TEACHERS: Standardize authenticated access
-- ----------------------------------------------------------------------------
ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_teachers_select" ON public.class_teachers;
CREATE POLICY "class_teachers_select" ON public.class_teachers
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "class_teachers_insert" ON public.class_teachers;
CREATE POLICY "class_teachers_insert" ON public.class_teachers
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text]));

DROP POLICY IF EXISTS "class_teachers_delete" ON public.class_teachers;
CREATE POLICY "class_teachers_delete" ON public.class_teachers
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'admin'::text);

-- ----------------------------------------------------------------------------
-- 6. LIVE_CLASSES: Standardize authenticated access & symmetric UPDATE policy
-- ----------------------------------------------------------------------------
ALTER TABLE public.live_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_classes_select" ON public.live_classes;
CREATE POLICY "live_classes_select" ON public.live_classes
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "live_classes_insert" ON public.live_classes;
CREATE POLICY "live_classes_insert" ON public.live_classes
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text]));

DROP POLICY IF EXISTS "live_classes_update" ON public.live_classes;
CREATE POLICY "live_classes_update" ON public.live_classes
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text]))
  WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text]));

DROP POLICY IF EXISTS "live_classes_delete" ON public.live_classes;
CREATE POLICY "live_classes_delete" ON public.live_classes
  FOR DELETE TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text]));

-- ----------------------------------------------------------------------------
-- 7. TESTS: Clean duplicate policies and add symmetric WITH CHECK on updates
-- ----------------------------------------------------------------------------
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read tests" ON public.tests;
DROP POLICY IF EXISTS "Teachers insert tests" ON public.tests;

DROP POLICY IF EXISTS "tests_select" ON public.tests;
CREATE POLICY "tests_select" ON public.tests
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND (is_archived = false OR is_archived IS NULL));

DROP POLICY IF EXISTS "tests_insert" ON public.tests;
CREATE POLICY "tests_insert" ON public.tests
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text]));

DROP POLICY IF EXISTS "tests_update" ON public.tests;
CREATE POLICY "tests_update" ON public.tests
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text]))
  WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text]));

DROP POLICY IF EXISTS "tests_delete" ON public.tests;
CREATE POLICY "tests_delete" ON public.tests
  FOR DELETE TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text]));

-- ----------------------------------------------------------------------------
-- 8. HELPER FUNCTIONS: Idempotently ensure search_path is explicitly set
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace) THEN
    ALTER FUNCTION public.is_admin() SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_role' AND pronamespace = 'public'::regnamespace) THEN
    ALTER FUNCTION public.get_my_role() SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_profile_id' AND pronamespace = 'public'::regnamespace) THEN
    ALTER FUNCTION public.get_my_profile_id() SET search_path = public;
  END IF;
END $$;
