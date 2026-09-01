import React, { useEffect, useState } from 'react';
import { Search, Sparkles, ExternalLink, PlayCircle } from 'lucide-react';
import Card from '../components/Card';
import ProgressBar from '../components/ProgressBar';
import { supabase } from '../supabase';
import './Courses.css';

const R2_PUBLIC_CDN_URL = 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [customCourses, setCustomCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const userStr = localStorage.getItem('edtech_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const userTier = user?.subscription_tier || 'free';

  useEffect(() => {
    fetchAssignedCourses();
    fetchCustomCourses();
  }, []);

  async function fetchCustomCourses() {
    try {
      const { data, error } = await supabase
        .from('custom_courses')
        .select('*')
        .eq('is_published', true)
        .order('display_order');
      if (!error && data) {
        setCustomCourses(data);
      }
    } catch (e) {
      console.error('Failed to load custom courses:', e);
    }
  }

  function isTierAccessible(requiredTier) {
    const tiers = ['free', 'basic', 'premium'];
    const requiredIdx = tiers.indexOf((requiredTier || 'free').toLowerCase());
    const userIdx = tiers.indexOf((userTier || 'free').toLowerCase());
    return userIdx >= requiredIdx;
  }

  async function fetchAssignedCourses() {
    setLoading(true);
    try {
      const userStr = localStorage.getItem('edtech_user');
      const user = userStr ? JSON.parse(userStr) : null;
      const userClass = user?.class_name || 'Class 6th';

      const { data, error } = await supabase
        .from('courses')
        .select(`
          id, title, class_name, subject, description, thumbnail_url, is_published,
          course_chapters (
            id, title, chapter_order, icon_class,
            chapter_modalities (id, modality_type, title, resource_url, content_status)
          )
        `)
        .eq('class_name', userClass)
        .eq('is_published', true);

      if (error) {
        console.error('Error fetching courses:', error);
        setCourses(getFallbackCourses());
      } else if (data && data.length > 0) {
        setCourses(data);
      } else {
        setCourses(getFallbackCourses());
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
      setCourses(getFallbackCourses());
    } finally {
      setLoading(false);
    }
  }

  function getFallbackCourses() {
    return [
      {
        id: 'c6000000-0000-0000-0000-000000000001',
        title: 'Class 6th Science & Physics',
        category: 'Science',
        subject: 'Science',
        progress: 85,
        icon: '💡',
        description: 'Explore optics, light propagation, and shadow formation through 3D simulations.',
        thumbnail_url: `${R2_PUBLIC_CDN_URL}/placeholders/optics.webp`
      },
      {
        id: 'c6000000-0000-0000-0000-000000000002',
        title: 'Class 6th Ancient & World History',
        category: 'History',
        subject: 'History',
        progress: 45,
        icon: '🏛️',
        description: 'Explore ancient empires, archaeological timelines, civilizations, and historical architecture.',
        thumbnail_url: `${R2_PUBLIC_CDN_URL}/placeholders/history.webp`
      },
      {
        id: 'c6000000-0000-0000-0000-000000000003',
        title: 'Class 6th World Geography & Continents',
        category: 'Geography',
        subject: 'Geography',
        progress: 70,
        icon: '🌍',
        description: 'Discover continental tectonics, climate zones, world topography, and interactive 3D map exploration.',
        thumbnail_url: `${R2_PUBLIC_CDN_URL}/placeholders/geography.webp`
      },
      {
        id: 'c6000000-0000-0000-0000-000000000004',
        title: 'Class 6th Physical Education & Sports Science',
        category: 'Physical Education',
        subject: 'Physical Education',
        progress: 60,
        icon: '🏃',
        description: 'Study biomechanics, athletic training regimens, physiology, and sports science fundamentals.',
        thumbnail_url: `${R2_PUBLIC_CDN_URL}/placeholders/pe.webp`
      },
      {
        id: 'c6000000-0000-0000-0000-000000000005',
        title: 'Class 6th Visual Arts & 3D Design',
        category: 'Arts',
        subject: 'Arts',
        progress: 40,
        icon: '🎨',
        description: 'Master color harmony theory, spatial perspective, 3D artistic sculpting, and creative composition.',
        thumbnail_url: `${R2_PUBLIC_CDN_URL}/placeholders/arts.webp`
      },
      {
        id: 'c6000000-0000-0000-0000-000000000006',
        title: 'Class 6th English Literature & Grammar',
        category: 'English',
        subject: 'English',
        progress: 65,
        icon: '📝',
        description: 'Analyze classic literature, narrative character development, poetry syntax, and advanced grammar.',
        thumbnail_url: `${R2_PUBLIC_CDN_URL}/placeholders/english.webp`
      },
      {
        id: 'c6000000-0000-0000-0000-000000000007',
        title: 'Class 6th Mathematics & Geometry',
        category: 'Mathematics',
        subject: 'Mathematics',
        progress: 80,
        icon: 'π',
        description: 'Master algebraic expressions, geometry theorems, number theory, and spatial calculations.',
        thumbnail_url: `${R2_PUBLIC_CDN_URL}/placeholders/math.webp`
      },
      {
        id: 'c6000000-0000-0000-0000-000000000008',
        title: 'Class 6th Music Theory & Acoustics',
        category: 'Music',
        subject: 'Music',
        progress: 30,
        icon: '🎵',
        description: 'Learn harmonic scales, rhythm composition, acoustic waveforms, and orchestral instrumentation.',
        thumbnail_url: `${R2_PUBLIC_CDN_URL}/placeholders/music.webp`
      }
    ];
  }

  function handleLaunchCourse(course, openWorld = false) {
    // Open Study Island 3D Content Viewing Platform
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const repoPrefix = (window.location.hostname.endsWith('github.io') && pathSegments.length > 0)
      ? '/' + pathSegments[0]
      : '';
    const basePath = repoPrefix;
    const origin = window.location.origin;
    const userStr = localStorage.getItem('edtech_student_user') || localStorage.getItem('edtech_user');
    const userObj = userStr ? JSON.parse(userStr) : {};
    const sId = userObj.id || 'student-101';
    const cId = userObj.class_id || '6th';
    const sName = encodeURIComponent(userObj.full_name || 'Student');
    const contentPlatformUrl = origin + basePath + '/study-island/index.html?student_id=' + sId + '&class_id=' + cId + '&role=student&source=student_portal&theme=space&name=' + sName + (openWorld ? '&openWorld=true' : '');
    window.open(contentPlatformUrl, '_blank');
  }

  const allSubjects = ['All', 'Science', 'History', 'Geography', 'Physical Education', 'Arts', 'English', 'Mathematics', 'Music'];

  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (c.subject && c.subject.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || c.subject === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="view-container">
      <Card className="full-height-card">
        <div className="courses-header">
          <div className="tabs" style={{ flexWrap: 'wrap', gap: '6px' }}>
            {allSubjects.map(sub => (
              <button 
                key={sub} 
                className={`tab ${selectedCategory === sub ? 'active' : ''}`} 
                onClick={() => setSelectedCategory(sub)}
              >
                {sub === 'All' ? 'All Subjects' : sub}
              </button>
            ))}
          </div>
          
          <div className="courses-actions">
            <div className="search-box">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search assigned courses..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            <Sparkles className="spin" size={24} style={{ marginBottom: '12px', color: 'var(--brand-primary, #00F0FF)' }} />
            <p>Loading assigned courses from Supabase & Cloudflare R2...</p>
          </div>
        ) : (
          <>
            <div className="courses-grid">
              {filteredCourses.map(course => (
                <div key={course.id} className="course-card" style={{ border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.2))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="course-category" style={{ color: 'var(--brand-primary, #00F0FF)', fontWeight: '700' }}>{course.subject || 'Science'}</span>
                    <span style={{ fontSize: '0.75rem', background: 'var(--brand-glow, rgba(0, 240, 255, 0.1))', color: 'var(--brand-primary, #00F0FF)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.3))' }}>
                      {course.class_name || 'Class 6th'}
                    </span>
                  </div>

                  <h4 className="course-title" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>{course.title}</h4>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '16px', flexGrow: 1 }}>{course.description}</p>
                  
                  <ProgressBar progress={course.progress || 85} />
                  
                  <button 
                    className="btn btn-primary w-100 mt-auto" 
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))', color: '#000', fontWeight: '700' }}
                    onClick={() => handleLaunchCourse(course)}
                  >
                    <PlayCircle size={18} /> Launch 3D Experience <ExternalLink size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* World Programs Section */}
            {customCourses.length > 0 && (
              <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <span>🌍</span> World Programs &amp; Standalone Courses
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px', margin: 0 }}>
                      Platform-exclusive programs featuring Language Learning, Scientific Thinking, and Gamified Labs.
                    </p>
                  </div>
                  <button
                    onClick={() => handleLaunchCourse(null, true)}
                    className="btn"
                    style={{ background: 'rgba(0, 240, 255, 0.15)', border: '1px solid rgba(0, 240, 255, 0.3)', color: '#00F0FF', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    🗺️ Open 3D World Hub
                  </button>
                </div>

                <div className="courses-grid">
                  {customCourses.map(cc => {
                    const accessible = isTierAccessible(cc.subscription_tier);
                    const color = cc.color || '#00E5FF';
                    return (
                      <div key={cc.id} className="course-card" style={{ border: `1px solid ${color}40`, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '90px', height: '90px', borderRadius: '50%', background: color, filter: 'blur(30px)', opacity: 0.2, pointerEvents: 'none' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span className="course-category" style={{ color: color, fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{cc.emoji || '🌍'}</span> {cc.category || 'Special'}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: cc.subscription_tier === 'premium' ? 'rgba(168, 85, 247, 0.2)' : cc.subscription_tier === 'basic' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            color: cc.subscription_tier === 'premium' ? '#c084fc' : cc.subscription_tier === 'basic' ? '#60a5fa' : '#34d399',
                            border: `1px solid ${cc.subscription_tier === 'premium' ? 'rgba(168, 85, 247, 0.4)' : cc.subscription_tier === 'basic' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`
                          }}>
                            {cc.subscription_tier || 'free'}
                          </span>
                        </div>

                        <h4 className="course-title" style={{ fontSize: '1.1rem', marginBottom: '6px', color: '#fff' }}>{cc.title}</h4>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '16px', flexGrow: 1 }}>{cc.tagline}</p>

                        {accessible ? (
                          <button
                            className="btn btn-primary w-100 mt-auto"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: `linear-gradient(135deg, ${color}, #3B82F6)`, color: '#000', fontWeight: '800' }}
                            onClick={() => handleLaunchCourse(null, true)}
                          >
                            <PlayCircle size={18} /> Enter Course Experience <ExternalLink size={14} />
                          </button>
                        ) : (
                          <button
                            disabled
                            className="btn w-100 mt-auto"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', cursor: 'not-allowed' }}
                          >
                            🔒 Upgrade to {cc.subscription_tier} to Unlock
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
