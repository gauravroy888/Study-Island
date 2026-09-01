import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/Card';
import { 
  Tv, 
  Maximize2, 
  Sparkles, 
  BookOpen, 
  Play, 
  Layers, 
  Atom, 
  Globe, 
  Compass, 
  Search, 
  ExternalLink, 
  Presentation, 
  Users, 
  CheckCircle2, 
  Zap, 
  Volume2,
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';
import { supabase } from '../supabase';

const R2_PUBLIC_CDN_URL = 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev';

export default function SmartboardTeaching() {
  const [searchParams] = useSearchParams();
  const initialClass = searchParams.get('class') || 'Class 6th';
  const initialSubject = searchParams.get('subject') || 'All';

  const [assignedClasses, setAssignedClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const [selectedSubject, setSelectedSubject] = useState(initialSubject);
  const [searchQuery, setSearchQuery] = useState('');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePresentation, setActivePresentation] = useState(null); // Embedded Smartboard player

  // Load teacher assigned classes
  useEffect(() => {
    async function loadAssignedClasses() {
      try {
        const { data } = await supabase.from('classes').select('*').order('created_at', { ascending: true });
        if (data && data.length > 0) {
          setAssignedClasses(data);
        } else {
          setAssignedClasses([
            { id: '1', name: 'Class 6th Science', section: 'Standard Curriculum', subject: 'Science & Physics', students: 0 },
            { id: '2', name: 'Class 7th Astronomy', section: 'Standard Curriculum', subject: 'Space & Solar System', students: 0 },
            { id: '3', name: 'Class 8th Earth Science', section: 'Standard Curriculum', subject: 'Geography & Geology', students: 0 },
            { id: '4', name: 'Class 9th Physics', section: 'Standard Curriculum', subject: 'Optics & Mechanics', students: 0 }
          ]);
        }
      } catch (e) {
        console.error('Failed to load classes:', e);
      }
    }
    loadAssignedClasses();
  }, []);

  // Fetch courses matching selected assigned class
  useEffect(() => {
    async function fetchCurriculum() {
      setLoading(true);
      try {
        const normalizedClassName = selectedClass.includes('Class') ? selectedClass.split(' ')[0] + ' ' + selectedClass.split(' ')[1] : selectedClass;
        
        const { data, error } = await supabase
          .from('courses')
          .select(`
            id, title, class_name, subject, description, thumbnail_url, is_published,
            course_chapters (
              id, title, chapter_order, icon_class,
              chapter_modalities (id, modality_type, title, resource_url, content_status)
            )
          `)
          .ilike('class_name', `%${normalizedClassName}%`)
          .eq('is_published', true);

        if (error || !data || data.length === 0) {
          setCourses(getCurriculumData(selectedClass));
        } else {
          setCourses(data);
        }
      } catch (err) {
        console.error('Error loading course curriculum:', err);
        setCourses(getCurriculumData(selectedClass));
      } finally {
        setLoading(false);
      }
    }

    fetchCurriculum();
  }, [selectedClass]);

  function getCurriculumData(className) {
    return [
      {
        id: 'cur-1',
        title: `${className} Science: Optics, Light & 3D Simulations`,
        subject: 'Science',
        category: 'Science',
        icon: '💡',
        level: 'Interactive 3D / IFP Ready',
        smartboardFeatured: true,
        description: 'Ray propagation, convex/concave mirror reflections, shadow formation, and interactive laboratory simulations.',
        thumbnail: `${R2_PUBLIC_CDN_URL}/placeholders/optics.webp`,
        chapters: [
          { id: 'ch-1', chapterId: 'light-shadows', title: 'Chapter 1: Light Sources, Propagation & Shadows', type: '3D Simulation', duration: '45 mins' },
          { id: 'ch-2', chapterId: 'light-shadows', title: 'Chapter 2: Reflection, Lenses & Focal Points', type: 'Smartboard Lab', duration: '50 mins' },
          { id: 'ch-3', chapterId: 'space-solar', title: 'Chapter 3: The Solar System & Planetary Orbits', type: 'VR / 3D Space', duration: '40 mins' }
        ]
      },
      {
        id: 'cur-2',
        title: `${className} Ancient & World Civilizations`,
        subject: 'History',
        category: 'History',
        icon: '🏛️',
        level: 'Smartboard Visual Era',
        smartboardFeatured: true,
        description: 'Interactive timeline explorations, 3D architectural ruins, Harappan cities, and ancient trade routes.',
        thumbnail: `${R2_PUBLIC_CDN_URL}/placeholders/history.webp`,
        chapters: [
          { id: 'ch-4', chapterId: null, title: 'Chapter 1: Indus Valley Architecture & Drainage 3D', type: '3D Walkthrough', duration: '35 mins' },
          { id: 'ch-5', chapterId: null, title: 'Chapter 2: Mesopotamian & Egyptian Empires', type: 'Interactive Map', duration: '40 mins' }
        ]
      },
      {
        id: 'cur-3',
        title: `${className} World Physical Geography & Tectonics`,
        subject: 'Geography',
        category: 'Geography',
        icon: '🌍',
        level: '3D Earth Engine',
        smartboardFeatured: true,
        description: 'Interactive globe rendering, continental plate tectonics, volcano cross-sections, and climate zones.',
        thumbnail: `${R2_PUBLIC_CDN_URL}/placeholders/geography.webp`,
        chapters: [
          { id: 'ch-6', chapterId: null, title: 'Chapter 1: Continental Drift & Plate Boundaries', type: '3D Simulation', duration: '45 mins' },
          { id: 'ch-7', chapterId: null, title: 'Chapter 2: Atmospheric Pressure & Weather Systems', type: 'Live Simulator', duration: '40 mins' }
        ]
      },
      {
        id: 'cur-4',
        title: `${className} Mathematics, Geometry & Spatial Proofs`,
        subject: 'Mathematics',
        category: 'Mathematics',
        icon: '📐',
        level: 'Smartboard Canvas',
        smartboardFeatured: false,
        description: 'Visual geometric proofs, coordinate Cartesian planes, dynamic angle manipulation, and algebraic formulas.',
        thumbnail: `${R2_PUBLIC_CDN_URL}/placeholders/math.webp`,
        chapters: [
          { id: 'ch-8', chapterId: null, title: 'Chapter 1: Triangles, Angles & Congruence Theorems', type: 'Interactive Canvas', duration: '45 mins' },
          { id: 'ch-9', chapterId: null, title: 'Chapter 2: 3D Mensuration: Cones, Cylinders & Spheres', type: '3D Geometry', duration: '50 mins' }
        ]
      },
      {
        id: 'cur-5',
        title: `${className} English Literature, Grammar & Interactive Drama`,
        subject: 'English',
        category: 'English',
        icon: '📝',
        level: 'Narrative Presentation',
        smartboardFeatured: false,
        description: 'Interactive Shakespearean & classic prose stage visualizer, vocabulary flashboards, and syntax analyzers.',
        thumbnail: `${R2_PUBLIC_CDN_URL}/placeholders/english.webp`,
        chapters: [
          { id: 'ch-10', chapterId: null, title: 'Chapter 1: Narrative Story Arc & Character Perspectives', type: 'Visual Storyboard', duration: '35 mins' },
          { id: 'ch-11', chapterId: null, title: 'Chapter 2: Active vs Passive Voice Live Smartboard Drill', type: 'Class Quiz', duration: '30 mins' }
        ]
      }
    ];
  }

  // Get base URL for Study Island
  function getStudyIslandUrl(options = {}) {
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const repoPrefix = (window.location.hostname.endsWith('github.io') && pathSegments.length > 0)
      ? '/' + pathSegments[0]
      : '';
    let url = window.location.origin + repoPrefix + '/study-island/index.html?teacher=true&mode=smartboard&source=teacher_portal&role=teacher&theme=teacher';
    
    const params = new URLSearchParams();
    params.set('mode', 'smartboard');
    params.set('teacher', 'true');
    params.set('class', selectedClass);
    if (options.subject) params.set('subject', options.subject);
    if (options.chapter) params.set('chapter', options.chapter);

    try {
      const userStr = localStorage.getItem('edtech_teacher_user') || localStorage.getItem('edtech_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.name || u.full_name) params.set('teacher_name', u.name || u.full_name);
        if (u.email) params.set('teacher_email', u.email);
        if (u.avatar_url || u.avatar) params.set('teacher_avatar', u.avatar_url || u.avatar);
        if (u.id || u.teacher_id) params.set('teacher_id', u.id || u.teacher_id);
        if (u.department || u.degree) params.set('teacher_dept', u.department || u.degree);
      }
    } catch(e) {}

    return `${url}?${params.toString()}`;
  }

  // Launch Fullscreen Smartboard Experience in a new window/tab
  function handleLaunchSmartboard(subject = null, chapter = null) {
    const targetUrl = getStudyIslandUrl({ subject, chapter });
    const win = window.open(targetUrl, '_blank');
    if (win) {
      win.focus();
    }
  }

  const subjects = ['All', 'Science', 'History', 'Geography', 'Mathematics', 'English'];

  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSubject = selectedSubject === 'All' || c.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="view-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Smartboard Hero Presentation Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--brand-glow, rgba(0, 240, 255, 0.15)), rgba(168, 85, 247, 0.15), var(--brand-secondary, rgba(59, 130, 246, 0.15)))',
        border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.35))',
        borderRadius: '24px',
        padding: '32px 36px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 0 35px var(--brand-glow, rgba(0, 240, 255, 0.15))'
      }}>
        {/* Background glow orb */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '220px',
          height: '220px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,240,255,0.25) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{
                background: 'var(--brand-glow, rgba(0, 240, 255, 0.2))',
                border: '1px solid var(--brand-primary, #00F0FF)',
                color: 'var(--brand-primary, #00F0FF)',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: '800',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Tv size={14} /> SMARTBOARD TEACHING DECK
              </span>
              <span style={{
                background: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid #a855f7',
                color: '#c084fc',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: '700'
              }}>
                ✦ Edtech Island 3D Universe
              </span>
            </div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: '900', margin: '0 0 8px 0', color: '#fff', letterSpacing: '-0.5px' }}>
              Teach on Smartboard: <span style={{ color: 'var(--brand-primary, #00F0FF)' }}>{selectedClass}</span>
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '1.05rem', maxWidth: '700px', lineHeight: '1.5' }}>
              Access 3D interactive simulations, optics labs, interactive world history, and planetary engines designed for school interactive smartboards and flat panels.
            </p>
          </div>

          {/* Quick Launch Button */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleLaunchSmartboard()}
              style={{
                background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                color: '#000',
                border: 'none',
                fontWeight: '900',
                fontSize: '1rem',
                padding: '16px 32px',
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 0 30px var(--brand-glow, rgba(0, 240, 255, 0.5))',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Maximize2 size={20} />
              Launch Fullscreen Smartboard <ArrowUpRight size={18} />
            </button>
          </div>
        </div>

        {/* Assigned Class Quick Switcher Bar */}
        <div style={{
          marginTop: '28px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Switch Assigned Class:
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {assignedClasses.map(cls => {
              const isActive = selectedClass.includes(cls.name);
              return (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls.name)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '12px',
                    border: isActive ? '2px solid var(--brand-primary, #00F0FF)' : '1px solid rgba(255, 255, 255, 0.12)',
                    background: isActive ? 'var(--brand-glow, rgba(0, 240, 255, 0.2))' : 'rgba(255, 255, 255, 0.04)',
                    color: isActive ? 'var(--brand-primary, #00F0FF)' : '#cbd5e1',
                    cursor: 'pointer',
                    fontWeight: '800',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <BookOpen size={15} />
                  {cls.name} {cls.section ? `(${cls.section})` : ''}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter & Subject Selection Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        {/* Subject pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {subjects.map(subj => {
            const isSubjActive = selectedSubject === subj;
            return (
              <button
                key={subj}
                onClick={() => setSelectedSubject(subj)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '12px',
                  border: isSubjActive ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
                  background: isSubjActive ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                  color: isSubjActive ? '#e9d5ff' : '#94a3b8',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {subj}
              </button>
            );
          })}
        </div>

        {/* Search bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(13, 20, 36, 0.7)',
          border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.2))',
          borderRadius: '12px',
          padding: '8px 16px',
          minWidth: '260px'
        }}>
          <Search size={16} color="var(--brand-primary, #00F0FF)" />
          <input
            type="text"
            placeholder="Search topic, chapter or simulation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              outline: 'none',
              fontSize: '0.9rem',
              width: '100%'
            }}
          />
        </div>
      </div>

      {/* Embedded Live Presentation Player (If selected) */}
      {activePresentation && (
        <Card style={{
          padding: '24px',
          border: '2px solid var(--brand-primary, #00F0FF)',
          boxShadow: '0 0 40px var(--brand-glow, rgba(0, 240, 255, 0.25))',
          background: '#040714',
          borderRadius: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ padding: '8px', borderRadius: '10px', background: 'var(--brand-glow, rgba(0, 240, 255, 0.15))', color: 'var(--brand-primary, #00F0FF)' }}>
                <Presentation size={22} />
              </span>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', fontWeight: '800' }}>
                  Smartboard Canvas: {activePresentation.title}
                </h3>
                <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Live 3D Study Island Session for {selectedClass}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleLaunchSmartboard(activePresentation.subject)}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#000',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Maximize2 size={16} /> Open Fullscreen Window
              </button>
              <button
                onClick={() => setActivePresentation(null)}
                style={{
                  padding: '8px 14px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                Close Player
              </button>
            </div>
          </div>

          {/* Iframe Viewport */}
          <div style={{
            width: '100%',
            height: '560px',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.3))',
            background: '#000'
          }}>
            <iframe
              src={getStudyIslandUrl({ 
                subject: activePresentation.subject, 
                chapter: (activePresentation.subject?.toLowerCase().includes('science') || activePresentation.subject?.toLowerCase().includes('physic')) ? 'light-shadows' : null 
              })}
              title="Study Island Presentation"
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="fullscreen; accelerometer; gyroscope"
            />
          </div>
        </Card>
      )}

      {/* Curriculum & 3D Smartboard Lesson Modules Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {filteredCourses.map(course => (
          <Card 
            key={course.id} 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              padding: '24px',
              border: course.smartboardFeatured ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(13, 20, 36, 0.85)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {course.smartboardFeatured && (
              <div style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                background: 'var(--brand-glow, rgba(0, 240, 255, 0.15))',
                border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.4))',
                borderRadius: '8px',
                padding: '3px 8px',
                color: 'var(--brand-primary, #00F0FF)',
                fontSize: '0.75rem',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Sparkles size={12} /> 3D LAB READY
              </div>
            )}

            <div>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div style={{
                  fontSize: '2rem',
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {course.icon || '📚'}
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--brand-primary, #00F0FF)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {course.subject} • {selectedClass}
                  </span>
                  <h3 style={{ margin: '4px 0 0 0', color: '#fff', fontSize: '1.25rem', fontWeight: '800', lineHeight: '1.3' }}>
                    {course.title}
                  </h3>
                </div>
              </div>

              {/* Description */}
              <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                {course.description}
              </p>

              {/* Chapters & Simulation Modules */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={14} color="var(--brand-primary, #00F0FF)" /> Smartboard Curriculum Modules ({course.chapters?.length || 3})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(course.chapters || []).map((ch, idx) => (
                    <div 
                      key={ch.id || idx}
                      onClick={() => handleLaunchSmartboard(course.subject, ch.chapterId || ch.title)}
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease, border-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--brand-glow, rgba(0, 240, 255, 0.08))';
                        e.currentTarget.style.borderColor = 'var(--brand-glow, rgba(0, 240, 255, 0.3))';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Play size={14} color="var(--brand-primary, #00F0FF)" />
                        <span style={{ fontSize: '0.88rem', color: '#f1f5f9', fontWeight: '600' }}>
                          {ch.title}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        {ch.type || '3D Lab'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Smartboard Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                onClick={() => setActivePresentation(course)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'var(--brand-glow, rgba(0, 240, 255, 0.1))',
                  border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.3))',
                  color: 'var(--brand-primary, #00F0FF)',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Presentation size={16} /> Preview Deck
              </button>

              <button
                onClick={() => handleLaunchSmartboard(course.subject)}
                style={{
                  flex: 1.2,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                  border: 'none',
                  color: '#000',
                  fontWeight: '900',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 0 20px var(--brand-glow, rgba(0, 240, 255, 0.35))'
                }}
              >
                <Tv size={16} /> Teach on Smartboard
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
