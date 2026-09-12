-- ============================================================================
-- EdTech Island: Migration 008
-- Cleanup Legacy Unsafe Policies, Eliminate USING (true), and Fix Schema Drift
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COURSES TABLE
-- ----------------------------------------------------------------------------
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Drop legacy open read policy
DROP POLICY IF EXISTS "Allow public read access to courses" ON public.courses;
DROP POLICY IF EXISTS "courses_select_policy" ON public.courses;
DROP POLICY IF EXISTS "courses_write_policy" ON public.courses;

-- Published courses can be read by students and catalogue browsers; admins/teachers read all
CREATE POLICY "courses_select_policy" ON public.courses
FOR SELECT USING (
  is_published = true
  OR public.is_admin()
  OR public.get_my_role() = 'teacher'
);

-- Only admins can create, update, or delete courses
CREATE POLICY "courses_write_policy" ON public.courses
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. CHAPTER MODALITIES TABLE
-- ----------------------------------------------------------------------------
ALTER TABLE public.chapter_modalities ENABLE ROW LEVEL SECURITY;

-- Drop legacy open read policy
DROP POLICY IF EXISTS "Allow public read access to chapter_modalities" ON public.chapter_modalities;
DROP POLICY IF EXISTS "chapter_modalities_select_policy" ON public.chapter_modalities;
DROP POLICY IF EXISTS "chapter_modalities_write_policy" ON public.chapter_modalities;

-- Ready content can be read by learners; teachers and admins can view placeholders/drafts
CREATE POLICY "chapter_modalities_select_policy" ON public.chapter_modalities
FOR SELECT USING (
  content_status = 'ready'
  OR public.is_admin()
  OR public.get_my_role() = 'teacher'
);

-- Only teachers and admins can mutate chapter modalities
CREATE POLICY "chapter_modalities_write_policy" ON public.chapter_modalities
FOR ALL USING (
  public.is_admin() OR public.get_my_role() = 'teacher'
) WITH CHECK (
  public.is_admin() OR public.get_my_role() = 'teacher'
);

-- ----------------------------------------------------------------------------
-- 3. COURSE CHAPTERS TABLE (Clean any lingering legacy open policy)
-- ----------------------------------------------------------------------------
ALTER TABLE public.course_chapters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to course_chapters" ON public.course_chapters;
DROP POLICY IF EXISTS "Allow public delete to course_chapters" ON public.course_chapters;
DROP POLICY IF EXISTS "Allow public insert to course_chapters" ON public.course_chapters;
DROP POLICY IF EXISTS "Allow public update to course_chapters" ON public.course_chapters;

-- ----------------------------------------------------------------------------
-- 4. ANNOUNCEMENTS TABLE
-- ----------------------------------------------------------------------------
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Drop high-severity wildcard and open read policies
DROP POLICY IF EXISTS "Public full access to announcements" ON public.announcements;
DROP POLICY IF EXISTS "Allow public read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Authenticated users read announcements" ON public.announcements;
DROP POLICY IF EXISTS "announcements_select_policy" ON public.announcements;

-- Authenticated users can read announcements
CREATE POLICY "announcements_select_policy" ON public.announcements
FOR SELECT TO authenticated
USING (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 5. ARIA AI SESSIONS TABLE (Protect student AI session transcripts)
-- ----------------------------------------------------------------------------
ALTER TABLE public.aria_ai_sessions ENABLE ROW LEVEL SECURITY;

-- Drop insecure open policy
DROP POLICY IF EXISTS "Allow all operations for aria_ai_sessions" ON public.aria_ai_sessions;
DROP POLICY IF EXISTS "aria_ai_sessions_select_policy" ON public.aria_ai_sessions;
DROP POLICY IF EXISTS "aria_ai_sessions_insert_policy" ON public.aria_ai_sessions;
DROP POLICY IF EXISTS "aria_ai_sessions_update_policy" ON public.aria_ai_sessions;
DROP POLICY IF EXISTS "aria_ai_sessions_delete_policy" ON public.aria_ai_sessions;

-- Students view own sessions; teachers view assigned students; admins view all
CREATE POLICY "aria_ai_sessions_select_policy" ON public.aria_ai_sessions
FOR SELECT TO authenticated
USING (
  student_id = auth.uid()::text
  OR student_id = public.get_my_profile_id()::text
  OR public.is_admin()
  OR (
    public.get_my_role() = 'teacher'
    AND student_id IN (
      SELECT cs.student_id::text
      FROM public.class_students cs
      JOIN public.class_teachers ct ON ct.class_id = cs.class_id
      WHERE ct.teacher_id = public.get_my_profile_id()
    )
  )
);

-- Students insert own sessions; admins can insert
CREATE POLICY "aria_ai_sessions_insert_policy" ON public.aria_ai_sessions
FOR INSERT TO authenticated
WITH CHECK (
  student_id = auth.uid()::text
  OR student_id = public.get_my_profile_id()::text
  OR public.is_admin()
);

-- Students update own sessions; admins can update
CREATE POLICY "aria_ai_sessions_update_policy" ON public.aria_ai_sessions
FOR UPDATE TO authenticated
USING (
  student_id = auth.uid()::text
  OR student_id = public.get_my_profile_id()::text
  OR public.is_admin()
) WITH CHECK (
  student_id = auth.uid()::text
  OR student_id = public.get_my_profile_id()::text
  OR public.is_admin()
);

-- Only admins can delete AI sessions
CREATE POLICY "aria_ai_sessions_delete_policy" ON public.aria_ai_sessions
FOR DELETE TO authenticated
USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. QUESTION BANK TABLE (Prevent student tampering with exam questions)
-- ----------------------------------------------------------------------------
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow delete access to authenticated users" ON public.question_bank;
DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.question_bank;
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON public.question_bank;
DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.question_bank;
DROP POLICY IF EXISTS "question_bank_select_policy" ON public.question_bank;
DROP POLICY IF EXISTS "question_bank_insert_policy" ON public.question_bank;
DROP POLICY IF EXISTS "question_bank_update_policy" ON public.question_bank;
DROP POLICY IF EXISTS "question_bank_delete_policy" ON public.question_bank;

-- Teachers and admins can read question bank
CREATE POLICY "question_bank_select_policy" ON public.question_bank
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.get_my_role() = 'teacher'
);

-- Teachers and admins can create questions
CREATE POLICY "question_bank_insert_policy" ON public.question_bank
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR (public.get_my_role() = 'teacher' AND created_by = (auth.jwt() ->> 'email'))
);

-- Authoring teacher or admin can update questions
CREATE POLICY "question_bank_update_policy" ON public.question_bank
FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR (public.get_my_role() = 'teacher' AND created_by = (auth.jwt() ->> 'email'))
) WITH CHECK (
  public.is_admin()
  OR (public.get_my_role() = 'teacher' AND created_by = (auth.jwt() ->> 'email'))
);

-- Authoring teacher or admin can delete questions
CREATE POLICY "question_bank_delete_policy" ON public.question_bank
FOR DELETE TO authenticated
USING (
  public.is_admin()
  OR (public.get_my_role() = 'teacher' AND created_by = (auth.jwt() ->> 'email'))
);

-- ----------------------------------------------------------------------------
-- 7. NOTIFICATIONS TABLE (Drop open read and open insert)
-- ----------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can read own and global notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;

CREATE POLICY "notifications_select_policy" ON public.notifications
FOR SELECT TO authenticated
USING (
  user_email = (auth.jwt() ->> 'email')
  OR user_email IS NULL
  OR public.is_admin()
);

-- ----------------------------------------------------------------------------
-- 8. LEGACY USERS & TEACHERS TABLES (Harden legacy tables against snooping)
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "users_all" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR email = (auth.jwt() ->> 'email')
);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Teachers" ON public.teachers;
DROP POLICY IF EXISTS "teachers_select_policy" ON public.teachers;

CREATE POLICY "teachers_select_policy" ON public.teachers
FOR SELECT TO authenticated
USING (auth.role() = 'authenticated');
