-- ============================================================
-- EdTech Island: Curriculum Hub Schema Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Fix classes table (add missing columns if they don't exist)
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';

-- 2. Create subjects table
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    icon VARCHAR(20) DEFAULT '📚',
    description TEXT DEFAULT '',
    thumbnail_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Extend course_chapters with all modality columns
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS subject_name VARCHAR(120) DEFAULT '';
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS chapter_slug VARCHAR(200) DEFAULT '';
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS custom_modalities JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS modality_urls JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS experience_url TEXT DEFAULT '';
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS experiments_url TEXT DEFAULT '';
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS quiz_url TEXT DEFAULT '';
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS mixed_reality_url TEXT DEFAULT '';
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS stories_url TEXT DEFAULT '';
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS experience_ready BOOLEAN DEFAULT false;
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS experiments_ready BOOLEAN DEFAULT false;
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS quiz_ready BOOLEAN DEFAULT false;
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS mixed_reality_ready BOOLEAN DEFAULT false;
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS stories_ready BOOLEAN DEFAULT false;
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- 4. RLS Policies for subjects (so SuperAdmin anon key can read/write)
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read subjects" ON public.subjects;
DROP POLICY IF EXISTS "Anon insert subjects" ON public.subjects;
DROP POLICY IF EXISTS "Anon update subjects" ON public.subjects;
DROP POLICY IF EXISTS "Anon delete subjects" ON public.subjects;
CREATE POLICY "Public read subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Anon insert subjects" ON public.subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update subjects" ON public.subjects FOR UPDATE USING (true);
CREATE POLICY "Anon delete subjects" ON public.subjects FOR DELETE USING (true);

-- 5. RLS Policies for classes (ensure anon insert/update works)
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon insert classes" ON public.classes;
DROP POLICY IF EXISTS "Anon update classes" ON public.classes;
DROP POLICY IF EXISTS "Anon delete classes" ON public.classes;
DROP POLICY IF EXISTS "Public read classes" ON public.classes;
CREATE POLICY "Public read classes" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Anon insert classes" ON public.classes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update classes" ON public.classes FOR UPDATE USING (true);
CREATE POLICY "Anon delete classes" ON public.classes FOR DELETE USING (true);

-- 6. Seed classes (existing ones will be skipped via ON CONFLICT)
INSERT INTO public.classes (name, display_order, status) VALUES
  ('Class 6th', 6, 'Active'),
  ('Class 7th', 7, 'Active'),
  ('Class 8th', 8, 'Active'),
  ('Class 9th', 9, 'Active'),
  ('Class 10th', 10, 'Active'),
  ('Class 11th', 11, 'Active'),
  ('Class 12th', 12, 'Active'),
  ('Language & Communication', 20, 'Active'),
  ('Critical Thinking & Logic', 21, 'Active'),
  ('Mathematical Thinking', 22, 'Active')
ON CONFLICT (name) DO UPDATE SET
  display_order = EXCLUDED.display_order,
  status = EXCLUDED.status;

-- 7. Verify results
SELECT 'classes' as table_name, count(*) as rows FROM public.classes
UNION ALL
SELECT 'subjects', count(*) FROM public.subjects
UNION ALL
SELECT 'course_chapters', count(*) FROM public.course_chapters;
