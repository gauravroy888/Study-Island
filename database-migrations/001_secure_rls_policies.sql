-- ============================================================================
-- EdTech Island: Production RLS Hardening Migration
-- Drops all insecure USING (true) / WITH CHECK (true) policies
-- Enforces strict identity, role, tenant, and class ownership boundaries
-- ============================================================================

-- Helper functions (ensure security definer and search_path safety)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid() AND role IN ('admin', 'superadmin', 'super_admin')
  );
$$;

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public update profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

-- Authenticated users can view their own profile, public teacher profiles, or students in assigned classes
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT USING (
  -- Self
  auth_id = auth.uid()
  -- Admins can view all profiles
  OR public.is_admin()
  -- Anyone authenticated can view active teachers for faculty rosters
  OR (role = 'teacher' AND auth.role() = 'authenticated')
  -- Teachers can view students enrolled in their assigned classes
  OR (
    public.get_my_role() = 'teacher'
    AND id IN (
      SELECT cs.student_id
      FROM public.class_students cs
      JOIN public.class_teachers ct ON ct.class_id = cs.class_id
      WHERE ct.teacher_id = public.get_my_profile_id()
    )
  )
);

-- Users can insert their own profile upon auth signup, or admins can create accounts
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT WITH CHECK (
  (auth_id = auth.uid() AND role = 'student')
  OR public.is_admin()
);

-- Users can update only their own profile details (excluding role elevation)
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE USING (
  auth_id = auth.uid() OR public.is_admin()
) WITH CHECK (
  (auth_id = auth.uid() AND role = public.get_my_role()) -- Cannot elevate own role
  OR public.is_admin()
);

-- Only admins can delete profiles
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE USING (
  public.is_admin()
);

-- ----------------------------------------------------------------------------
-- 2. CLASSES TABLE
-- ----------------------------------------------------------------------------
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all to classes" ON public.classes;
DROP POLICY IF EXISTS "Anon delete classes" ON public.classes;
DROP POLICY IF EXISTS "Anon insert classes" ON public.classes;
DROP POLICY IF EXISTS "Anon select classes" ON public.classes;
DROP POLICY IF EXISTS "Anon update classes" ON public.classes;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.classes;
DROP POLICY IF EXISTS "classes_select" ON public.classes;
DROP POLICY IF EXISTS "classes_insert" ON public.classes;
DROP POLICY IF EXISTS "classes_update" ON public.classes;
DROP POLICY IF EXISTS "classes_delete" ON public.classes;
DROP POLICY IF EXISTS "classes_select_policy" ON public.classes;
DROP POLICY IF EXISTS "classes_insert_policy" ON public.classes;
DROP POLICY IF EXISTS "classes_update_policy" ON public.classes;
DROP POLICY IF EXISTS "classes_delete_policy" ON public.classes;

-- Authenticated users read unarchived classes
CREATE POLICY "classes_select_policy" ON public.classes
FOR SELECT USING (
  (auth.role() = 'authenticated' AND (is_archived = false OR is_archived IS NULL))
  OR public.is_admin()
);

-- Only admins can mutate classes
CREATE POLICY "classes_insert_policy" ON public.classes
FOR INSERT WITH CHECK (public.is_admin());

-- Only admins can update classes
CREATE POLICY "classes_update_policy" ON public.classes
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Only admins can delete classes
CREATE POLICY "classes_delete_policy" ON public.classes
FOR DELETE USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. SUBJECTS TABLE
-- ----------------------------------------------------------------------------
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all to subjects" ON public.subjects;
DROP POLICY IF EXISTS "Anon delete subjects" ON public.subjects;
DROP POLICY IF EXISTS "Anon insert subjects" ON public.subjects;
DROP POLICY IF EXISTS "Anon select subjects" ON public.subjects;
DROP POLICY IF EXISTS "Anon update subjects" ON public.subjects;
DROP POLICY IF EXISTS "Public read subjects" ON public.subjects;
DROP POLICY IF EXISTS "subjects_select_policy" ON public.subjects;
DROP POLICY IF EXISTS "subjects_insert_policy" ON public.subjects;
DROP POLICY IF EXISTS "subjects_update_policy" ON public.subjects;
DROP POLICY IF EXISTS "subjects_delete_policy" ON public.subjects;

-- Authenticated users can view curriculum subjects
CREATE POLICY "subjects_select_policy" ON public.subjects
FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can mutate subjects
CREATE POLICY "subjects_insert_policy" ON public.subjects
FOR INSERT WITH CHECK (public.is_admin());

-- Only admins can update subjects
CREATE POLICY "subjects_update_policy" ON public.subjects
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Only admins can delete subjects
CREATE POLICY "subjects_delete_policy" ON public.subjects
FOR DELETE USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. COURSE CHAPTERS & MODALITIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.course_chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public delete to course_chapters" ON public.course_chapters;
DROP POLICY IF EXISTS "Allow public insert to course_chapters" ON public.course_chapters;
DROP POLICY IF EXISTS "Allow public read access to course_chapters" ON public.course_chapters;
DROP POLICY IF EXISTS "Allow public update to course_chapters" ON public.course_chapters;
DROP POLICY IF EXISTS "course_chapters_select_policy" ON public.course_chapters;
DROP POLICY IF EXISTS "course_chapters_write_policy" ON public.course_chapters;

CREATE POLICY "course_chapters_select_policy" ON public.course_chapters
FOR SELECT USING (
  is_published = true
  OR public.get_my_role() IN ('admin', 'teacher', 'superadmin', 'super_admin')
);

CREATE POLICY "course_chapters_write_policy" ON public.course_chapters
FOR ALL USING (
  public.get_my_role() IN ('admin', 'teacher', 'superadmin', 'super_admin')
) WITH CHECK (
  public.get_my_role() IN ('admin', 'teacher', 'superadmin', 'super_admin')
);

-- ----------------------------------------------------------------------------
-- 5. ANALYTICS EVENTS (IMMUTABLE TELEMETRY)
-- ----------------------------------------------------------------------------
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert access to analytics_events" ON public.analytics_events;
DROP POLICY IF EXISTS "Allow public read access to analytics_events" ON public.analytics_events;
DROP POLICY IF EXISTS "Service role can insert events" ON public.analytics_events;
DROP POLICY IF EXISTS "Students see own events" ON public.analytics_events;
DROP POLICY IF EXISTS "Teachers and admins view analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_events_insert_policy" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_events_select_policy" ON public.analytics_events;

-- Students insert only their own raw events
CREATE POLICY "analytics_events_insert_policy" ON public.analytics_events
FOR INSERT WITH CHECK (
  student_id = public.get_my_profile_id()
  OR public.is_admin()
);

-- Students read their own events; teachers/admins read their assigned students
CREATE POLICY "analytics_events_select_policy" ON public.analytics_events
FOR SELECT USING (
  student_id = public.get_my_profile_id()
  OR public.is_admin()
  OR (
    public.get_my_role() = 'teacher'
    AND student_id IN (
      SELECT cs.student_id
      FROM public.class_students cs
      JOIN public.class_teachers ct ON ct.class_id = cs.class_id
      WHERE ct.teacher_id = public.get_my_profile_id()
    )
  )
);

-- Historical raw events are strictly immutable: no client UPDATE or DELETE

-- ----------------------------------------------------------------------------
-- 6. SYSTEM AUDIT LOGS (IMMUTABLE AUDIT TRAIL)
-- ----------------------------------------------------------------------------
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public delete on system_audit_logs" ON public.system_audit_logs;
DROP POLICY IF EXISTS "Allow public insert on system_audit_logs" ON public.system_audit_logs;
DROP POLICY IF EXISTS "Allow public select on system_audit_logs" ON public.system_audit_logs;
DROP POLICY IF EXISTS "Allow public update on system_audit_logs" ON public.system_audit_logs;
DROP POLICY IF EXISTS "system_audit_logs_select_policy" ON public.system_audit_logs;
DROP POLICY IF EXISTS "system_audit_logs_insert_policy" ON public.system_audit_logs;

CREATE POLICY "system_audit_logs_select_policy" ON public.system_audit_logs
FOR SELECT USING (public.is_admin());

CREATE POLICY "system_audit_logs_insert_policy" ON public.system_audit_logs
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
  AND (actor_email = (auth.jwt() ->> 'email') OR actor_email IS NULL)
);

-- ----------------------------------------------------------------------------
-- 7. TEST SUBMISSIONS
-- ----------------------------------------------------------------------------
ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert access to test_submissions" ON public.test_submissions;
DROP POLICY IF EXISTS "Allow public read access to test_submissions" ON public.test_submissions;
DROP POLICY IF EXISTS "submissions_insert" ON public.test_submissions;
DROP POLICY IF EXISTS "submissions_select" ON public.test_submissions;
DROP POLICY IF EXISTS "test_submissions_select_policy" ON public.test_submissions;
DROP POLICY IF EXISTS "test_submissions_insert_policy" ON public.test_submissions;

CREATE POLICY "test_submissions_select_policy" ON public.test_submissions
FOR SELECT USING (
  student_id = public.get_my_profile_id()
  OR student_email = (auth.jwt() ->> 'email')
  OR public.is_admin()
  OR (
    public.get_my_role() = 'teacher'
    AND student_id IN (
      SELECT cs.student_id
      FROM public.class_students cs
      JOIN public.class_teachers ct ON ct.class_id = cs.class_id
      WHERE ct.teacher_id = public.get_my_profile_id()
    )
  )
);

CREATE POLICY "test_submissions_insert_policy" ON public.test_submissions
FOR INSERT WITH CHECK (
  (student_id = public.get_my_profile_id() OR student_email = (auth.jwt() ->> 'email'))
  OR public.is_admin()
);

-- ----------------------------------------------------------------------------
-- 8. CONVERSATIONS & MESSAGES
-- ----------------------------------------------------------------------------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access to conversations" ON public.conversations;
DROP POLICY IF EXISTS "Public full access to messages" ON public.messages;
DROP POLICY IF EXISTS "conversations_delete" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
DROP POLICY IF EXISTS "conversations_participant_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_participant_insert" ON public.conversations;
DROP POLICY IF EXISTS "messages_delete" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;
DROP POLICY IF EXISTS "messages_participant_select" ON public.messages;
DROP POLICY IF EXISTS "messages_sender_insert" ON public.messages;

CREATE POLICY "conversations_participant_select" ON public.conversations
FOR SELECT USING (
  (auth.jwt() ->> 'email') = participant1_email
  OR (auth.jwt() ->> 'email') = participant2_email
  OR participants ? (auth.jwt() ->> 'email')
  OR public.is_admin()
);

CREATE POLICY "conversations_participant_insert" ON public.conversations
FOR INSERT WITH CHECK (
  (auth.jwt() ->> 'email') = participant1_email
  OR (auth.jwt() ->> 'email') = participant2_email
  OR participants ? (auth.jwt() ->> 'email')
  OR public.is_admin()
);

CREATE POLICY "messages_participant_select" ON public.messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages."conversationId"
    AND (
      c.participant1_email = (auth.jwt() ->> 'email')
      OR c.participant2_email = (auth.jwt() ->> 'email')
      OR c.participants ? (auth.jwt() ->> 'email')
      OR public.is_admin()
    )
  )
);

CREATE POLICY "messages_sender_insert" ON public.messages
FOR INSERT WITH CHECK (
  (
    "senderEmail" = (auth.jwt() ->> 'email')
    OR "senderId" = auth.uid()::text
  )
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages."conversationId"
    AND (
      c.participant1_email = (auth.jwt() ->> 'email')
      OR c.participant2_email = (auth.jwt() ->> 'email')
      OR c.participants ? (auth.jwt() ->> 'email')
      OR public.is_admin()
    )
  )
);
