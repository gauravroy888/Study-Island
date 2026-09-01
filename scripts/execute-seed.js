const projectRef = 'qmyrxvtbzlbnvzxypnus';
require('dotenv').config();
const accessToken = process.env.SUPABASE_TOKEN;

const sqlQuery = `
INSERT INTO public.courses (id, title, class_name, subject, description, thumbnail_url)
VALUES 
('c6000000-0000-0000-0000-000000000001', 'Class 6th Physics & Optics', 'Class 6th', 'Science', 'Explore optics, light propagation, and shadow formation through 3D simulations.', 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev/placeholders/optics.webp'),
('c7000000-0000-0000-0000-000000000002', 'Class 7th Thermal Dynamics', 'Class 7th', 'Science', 'Understand heat transfer, radiation, and kinetic molecular energy.', 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev/placeholders/thermal.webp'),
('c8000000-0000-0000-0000-000000000003', 'Class 8th Space & Astronomy', 'Class 8th', 'Science', 'Journey through planetary orbits and gravitational field dynamics.', 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev/placeholders/space.webp');

INSERT INTO public.course_chapters (id, course_id, chapter_order, title, description, icon_class, scene_3d_model_url)
VALUES 
('b6000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 1, 'LIGHT AND SHADOWS', 'Interactive exploration of fundamental optical principles.', 'ph ph-lightbulb', 'Chapter_experience_L_S.html'),
('b6000000-0000-0000-0000-000000000002', 'c6000000-0000-0000-0000-000000000001', 2, 'REFLECTION & MIRRORS', 'Study ray diagrams, plane mirrors, and image inversion.', 'ph ph-sparkles', 'Chapter_experience_L_S.html');

INSERT INTO public.chapter_modalities (chapter_id, modality_type, title, resource_url, content_status, author_name, plays_count)
VALUES 
('b6000000-0000-0000-0000-000000000001', 'simulation', 'Chapter Experience', 'Chapter_experience_L_S.html', 'ready', 'Core Team', 1520),
('b6000000-0000-0000-0000-000000000001', 'experiment', 'Shadow Lab', 'Shadow_Lab.html', 'ready', 'Platform Lab', 3420),
('b6000000-0000-0000-0000-000000000001', 'quiz', 'Optics Concept Test', 'quiz.html', 'ready', 'Physics Dept', 890),

('b6000000-0000-0000-0000-000000000002', 'simulation', '3D Mirror Ray Simulator', 'Chapter_experience_L_S.html', 'placeholder', '3D Team', 0),
('b6000000-0000-0000-0000-000000000002', 'experiment', 'Laser Bounce Virtual Lab', 'Shadow_Lab.html', 'placeholder', 'Lab Team', 0),
('b6000000-0000-0000-0000-000000000002', 'quiz', 'Reflection Quiz', 'quiz.html', 'placeholder', 'Physics Dept', 0);
`;

async function executeSql() {
  console.log("🚀 Inserting course seeds via Supabase Management API...");
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
