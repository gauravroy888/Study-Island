import React, { useState, useEffect } from 'react';
import { Search, Star, MessageCircle, X, Mail, BookOpen, Clock, MapPin, Award, CheckCircle2, Sparkles, UserCheck } from 'lucide-react';
import Card from '../components/Card';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { usePresence } from '../hooks/usePresence';
import './Mentors.css';

export default function Mentors() {
  const [activeTab, setActiveTab] = useState('all');
  const [teachers, setTeachers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const navigate = useNavigate();

  // Presence comes from PresenceProvider — no own channel needed
  const { isOnline } = usePresence();

  useEffect(() => {
    fetchTeachers();

    const tChannel = supabase
      .channel('public:teachers_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teachers' }, fetchTeachers)
      .subscribe();

    const uChannel = supabase
      .channel('public:users_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchTeachers)
      .subscribe();

    return () => {
      supabase.removeChannel(tChannel);
      supabase.removeChannel(uChannel);
    };
  }, []);


  const fetchTeachers = async () => {
    setIsLoading(true);
    try {
      // 1. Query 'teachers' table
      const { data: dbTeachers } = await supabase.from('teachers').select('*');
      
      // 2. Query 'users' table where role is teacher
      const { data: dbUsers } = await supabase.from('users').select('*').eq('role', 'teacher');

      const teacherMap = new Map();

      // Add records from 'teachers' table
      if (dbTeachers && dbTeachers.length > 0) {
        dbTeachers.forEach(t => {
          if (!t) return;
          const teacherName = t.name || t.full_name || 'Faculty Member';
          const emailKey = (t.email || teacherName || t.id || String(Math.random())).toLowerCase();
          teacherMap.set(emailKey, {
            id: t.id || emailKey,
            name: teacherName,
            degree: t.degree || t.role || 'Faculty Instructor',
            subject: t.subject || 'General Sciences',
            rating: t.rating || 5.0,
            status: t.status || 'Offline',
            email: t.email || '',
            avatar_url: t.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(teacherName)}`,
            bio: t.bio || `${teacherName} is a dedicated educator assigned to Class 6th interactive coursework and laboratory sessions.`,
            classes: typeof t.classes === 'string' ? t.classes : (Array.isArray(t.classes) ? t.classes.join(', ') : 'Class 6th'),
            office_hours: t.office_hours || 'Mon - Fri: 09:00 AM - 04:00 PM',
            location: t.location || 'Science Lab 3 (3D VR Room)'
          });
        });
      }

      // Add records from 'users' table where role = 'teacher'
      if (dbUsers && dbUsers.length > 0) {
        dbUsers.forEach(u => {
          if (!u) return;
          const uName = u.full_name || u.name || 'Teacher';
          const uEmail = u.email || '';
          const emailKey = (uEmail || uName || u.id || String(Math.random())).toLowerCase();
          if (!teacherMap.has(emailKey)) {
            const isHarsh = uName.toLowerCase().includes('harsh') || uEmail.toLowerCase().includes('rathore');
            teacherMap.set(emailKey, {
              id: u.id || emailKey,
              name: uName,
              degree: isHarsh ? 'Faculty of Mathematics & Computing' : 'Faculty Instructor',
              subject: isHarsh ? 'Mathematics' : 'Science',
              rating: 5.0,
              status: 'Offline',
              email: uEmail,
              avatar_url: u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(uName)}&clothing=blazerAndShirt&backgroundColor=b6e3f4`,
              bio: `${uName} is a verified Class 6th faculty instructor in the Edtech Island platform.`,
              classes: 'Class 6th',
              office_hours: 'Mon - Fri: 09:00 AM - 04:00 PM',
              location: isHarsh ? 'Mathematics Wing Room 204' : 'Lab 3 (3D VR Room)'
            });
          }
        });
      }

      const list = Array.from(teacherMap.values());
      setTeachers(list);
    } catch (err) {
      console.error('Error fetching database teachers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openDirectChat = (teacher) => {
    const targetEmail = teacher.email || 'gauravroy476@gmail.com';
    navigate(`/chats?name=${encodeURIComponent(teacher.name)}&email=${encodeURIComponent(targetEmail)}`);
  };

  const filteredTeachers = teachers.filter(t => {
    if (!t) return false;
    const nameStr = (t.name || '').toLowerCase();
    const subjectStr = (t.subject || '').toLowerCase();
    const emailStr = (t.email || '').toLowerCase();
    const q = (searchQuery || '').toLowerCase();
    return nameStr.includes(q) || subjectStr.includes(q) || emailStr.includes(q);
  });

  return (
    <div className="view-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 6px 0', color: 'white' }}>Teachers & Mentors</h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '1rem' }}>Active faculty members registered and assigned to Class 6th.</p>
      </div>

      <Card className="full-height-card">
        <div className="mentors-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div className="tabs" style={{ display: 'flex', gap: '12px' }}>
            <button 
              className={`tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: activeTab === 'all' ? '1px solid var(--brand-primary, #00F0FF)' : '1px solid rgba(255,255,255,0.1)',
                background: activeTab === 'all' ? 'var(--brand-glow, rgba(0, 240, 255, 0.15))' : 'transparent',
                color: activeTab === 'all' ? 'var(--brand-primary, #00F0FF)' : '#94a3b8',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Assigned Faculty ({filteredTeachers.length})
            </button>
          </div>
          
          <div className="search-box" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 16px', width: '280px' }}>
            <Search size={16} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Search faculty..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%' }}
            />
          </div>
        </div>
        
        <div className="mentors-list">
          {isLoading ? (
            <p style={{ color: '#94a3b8', padding: '20px' }}>Querying database teachers...</p>
          ) : filteredTeachers.length === 0 ? (
            <p style={{ color: '#94a3b8', padding: '20px' }}>No teachers found in database.</p>
          ) : (
            filteredTeachers.map(mentor => {
              const isUserOnline = isOnline(mentor.email);
              const displayStatus = isUserOnline ? 'Online' : 'Offline';
              const statusColor = isUserOnline ? '#10B981' : '#64748B';

              return (
                <div key={mentor.id} className="mentor-row">
                  <div className="mentor-info-block">
                    <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                      <img 
                        src={mentor.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(mentor.name)}&clothing=blazerAndShirt&backgroundColor=b6e3f4`} 
                        alt={mentor.name} 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(mentor.name)}&clothing=blazerAndShirt&backgroundColor=b6e3f4`;
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          border: '2px solid var(--brand-primary, #00F0FF)',
                          boxShadow: '0 0 12px var(--brand-glow, rgba(0, 240, 255, 0.3))',
                          objectFit: 'cover'
                        }}
                      />
                      <span style={{
                        position: 'absolute',
                        bottom: '0',
                        right: '0',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: statusColor,
                        border: '2px solid #0D1424'
                      }}></span>
                    </div>
                    <div>
                      <h4 className="mentor-name" style={{ color: 'white', fontWeight: '700', margin: '0 0 2px 0' }}>{mentor.name}</h4>
                      <p className="mentor-title" style={{ color: '#94a3b8', margin: '0 0 2px 0', fontSize: '0.85rem' }}>{mentor.degree}</p>
                      <span className="status-text" style={{ color: statusColor, fontSize: '0.8rem', fontWeight: '600' }}>● {displayStatus}</span>
                    </div>
                  </div>
                
                <div className="mentor-subject">
                  <span className="subject-badge" style={{ background: 'var(--brand-glow, rgba(0, 240, 255, 0.1))', color: 'var(--brand-primary, #00F0FF)', border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.3))', padding: '6px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '0.85rem' }}>
                    {mentor.subject}
                  </span>
                </div>
                
                <div className="mentor-rating">
                  <span className="rating-val" style={{ color: 'white', fontWeight: '800', fontSize: '1.1rem' }}>{mentor.rating}</span>
                  <Star size={16} fill="#EAB308" color="#EAB308" />
                </div>
                
                <div className="mentor-row-actions">
                  <button 
                    onClick={() => setSelectedTeacher(mentor)}
                    className="btn btn-ghost" 
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                  >
                    View Profile
                  </button>
                  <button 
                    onClick={() => openDirectChat(mentor)}
                    style={{
                      background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                      color: '#000',
                      fontWeight: '700',
                      border: 'none',
                      padding: '8px 18px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 0 15px var(--brand-glow, rgba(0, 240, 255, 0.4))'
                    }}
                  >
                    <MessageCircle size={16} /> Chat
                  </button>
                </div>
              </div>
            );
          })
          )}
        </div>
      </Card>

      {/* Teacher Profile Modal */}
      {selectedTeacher && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(4, 7, 18, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '560px',
            background: 'rgba(13, 20, 36, 0.98)',
            border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.35))',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(0, 240, 255, 0.15)',
            borderRadius: '24px',
            padding: '32px',
            position: 'relative'
          }}>
            
            {/* Close button */}
            <button
              onClick={() => setSelectedTeacher(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8',
                borderRadius: '10px',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>

            {/* Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
              <div style={{ position: 'relative', width: '72px', height: '72px', flexShrink: 0 }}>
                <img
                  src={selectedTeacher.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(selectedTeacher.name)}&clothing=blazerAndShirt&backgroundColor=b6e3f4`}
                  alt={selectedTeacher.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(selectedTeacher.name)}&clothing=blazerAndShirt&backgroundColor=b6e3f4`;
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: '2px solid var(--brand-primary, #00F0FF)',
                    boxShadow: '0 0 20px var(--brand-glow, rgba(0, 240, 255, 0.3))',
                    objectFit: 'cover'
                  }}
                />
                <span style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: isOnline(selectedTeacher.email) ? '#10B981' : '#64748B',
                  border: '2px solid #0D1424'
                }}></span>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: 'white' }}>{selectedTeacher.name}</h3>
                  <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'var(--brand-glow, rgba(0, 240, 255, 0.15))', color: 'var(--brand-primary, #00F0FF)', fontSize: '0.75rem', fontWeight: '800' }}>
                    REGISTERED FACULTY
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.92rem' }}>
                  {selectedTeacher.degree}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                  <Star size={14} fill="#EAB308" color="#EAB308" />
                  <span style={{ color: 'white', fontWeight: '700', fontSize: '0.88rem' }}>{selectedTeacher.rating} / 5.0</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>• Verified Instructor</span>
                </div>
              </div>
            </div>

            {/* Bio Card */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px', marginBottom: '20px' }}>
              <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.92rem', lineHeight: '1.6' }}>
                {selectedTeacher.bio}
              </p>
            </div>

            {/* Quick Details List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cbd5e1', fontSize: '0.9rem' }}>
                <Mail size={16} color="var(--brand-primary, #00F0FF)" />
                <span>Email: <strong style={{ color: 'white' }}>{selectedTeacher.email}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cbd5e1', fontSize: '0.9rem' }}>
                <BookOpen size={16} color="var(--brand-primary, #00F0FF)" />
                <span>Assigned Classes: <strong style={{ color: 'white' }}>{selectedTeacher.classes}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cbd5e1', fontSize: '0.9rem' }}>
                <Clock size={16} color="var(--brand-primary, #00F0FF)" />
                <span>Office Hours: <strong style={{ color: 'white' }}>{selectedTeacher.office_hours}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cbd5e1', fontSize: '0.9rem' }}>
                <MapPin size={16} color="var(--brand-primary, #00F0FF)" />
                <span>Room / Lab: <strong style={{ color: 'white' }}>{selectedTeacher.location}</strong></span>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setSelectedTeacher(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'white',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedTeacher(null);
                  openDirectChat(selectedTeacher);
                }}
                style={{
                  flex: 1.5,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                  color: '#000',
                  fontWeight: '800',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 0 20px var(--brand-glow, rgba(0, 240, 255, 0.4))'
                }}
              >
                <MessageCircle size={18} /> Send Direct Message
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
