const projectRef = 'qmyrxvtbzlbnvzxypnus';
require('dotenv').config();
const accessToken = process.env.SUPABASE_TOKEN;

const sqlQuery = `
-- Enable Row Level Security and allow public read access for student portal
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to courses" ON public.courses;
CREATE POLICY "Allow public read access to courses" ON public.courses FOR SELECT USING (true);

ALTER TABLE public.course_chapters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to course_chapters" ON public.course_chapters;
CREATE POLICY "Allow public read access to course_chapters" ON public.course_chapters FOR SELECT USING (true);

ALTER TABLE public.chapter_modalities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to chapter_modalities" ON public.chapter_modalities;
CREATE POLICY "Allow public read access to chapter_modalities" ON public.chapter_modalities FOR SELECT USING (true);
`;

async function executeSql() {
  console.log("🚀 Enabling RLS Public Read Policies via Supabase Management API...");
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sqlQuery })
    });

    const text = await res.text();
    console.log("STATUS:", res.status);
    console.log("RESPONSE:", text);
  } catch (err) {
    console.error("Execution error:", err);
  }
}

executeSql();
