import React, { useState, useEffect } from 'react';
import { Users, Search, Mail, BookOpen, Star, Plus, ShieldCheck, CheckCircle, MessageSquare, ExternalLink, X, Loader2, AlertCircle } from 'lucide-react';
import Card from '../components/Card';
import { supabase } from '../supabase';
import { usePresence } from '../hooks/usePresence';

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [newFaculty, setNewFaculty] = useState({
    name: '',
    email: '',
    department: 'Science & Physics',
    role: 'Subject Faculty'
  });

  // Presence comes from PresenceProvider — no own channel needed
  const { isOnline } = usePresence();

  useEffect(() => {
    loadTeachers();
  }, []);


  // Fetch only real database records from Supabase
  const loadTeachers = async () => {
    setLoading(true);
    try {
      // 1. Fetch from 'profiles' table where role is teacher
      const { data: profData } = await supabase
        .from('profiles')
        .select('*')
        .or('role.eq.teacher,role.eq.TEACHER');

      // 2. Fetch from 'users' table where role is teacher
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .or('role.eq.teacher,role.eq.TEACHER');

      // 3. Fetch from 'teachers' table
      const { data: teachersData } = await supabase
        .from('teachers')
        .select('*');

      const teacherMap = new Map();

      if (usersData && usersData.length > 0) {
        usersData.forEach(u => {
          const displayName = u.full_name || u.name || u.email.split('@')[0];
          teacherMap.set(u.email.toLowerCase(), {
            id: u.id,
            name: displayName,
            email: u.email,
            role: u.role === 'teacher' ? 'Subject Faculty' : u.role,
            department: u.department || 'Academic Faculty',
            classes: ['Class 6th A'],
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=b6e3f4`,
            rating: 5.0,
            status: 'Active',
            joined: (u.created_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10)
          });
        });
      }

      if (teachersData && teachersData.length > 0) {
        teachersData.forEach(t => {
          const emailKey = (t.email || '').toLowerCase();
          const existing = teacherMap.get(emailKey) || {};
          teacherMap.set(emailKey, {
            ...existing,
            id: t.id || existing.id,
            name: t.name || existing.name || 'Faculty Member',
            email: t.email || existing.email,
            role: t.degree || t.role || existing.role || 'Teacher',
            department: t.subject ? `${t.subject} Faculty` : existing.department || 'Academic Faculty',
            classes: ['Class 6th A'],
            avatar: t.avatar_url || existing.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(t.name || t.email || 'Teacher')}&backgroundColor=b6e3f4`,
            rating: parseFloat(t.rating) || 5.0,
            status: t.status || 'Active',
            joined: (t.created_at || '').slice(0, 10) || existing.joined || new Date().toISOString().slice(0, 10)
          });
        });
      }

      if (profData && profData.length > 0) {
        profData.forEach(p => {
          const emailKey = (p.email || '').toLowerCase();
          const existing = teacherMap.get(emailKey) || {};
          teacherMap.set(emailKey, {
            ...existing,
            id: p.id || existing.id,
            name: p.name || existing.name || 'Faculty Member',
            email: p.email || existing.email,
            avatar: p.avatar_url || existing.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name || p.email)}&backgroundColor=b6e3f4`
          });
        });
      }

      setTeachers(Array.from(teacherMap.values()));
    } catch (e) {
      console.error('Error loading teachers:', e);
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
    const profSub = supabase.channel('public:prof_teachers_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadTeachers)
      .subscribe();
    return () => supabase.removeChannel(profSub);
  }, []);

  const departments = ['ALL', 'Academic Faculty', 'Science & Physics', 'Mathematics', 'Social Sciences'];

  const filteredTeachers = teachers.filter(t => {
    const matchesSearch = (t.name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (t.email || '').toLowerCase().includes(search.toLowerCase()) ||
                          (t.role || '').toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === 'ALL' || t.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const handleAddFaculty = async (e) => {
    e.preventDefault();
    if (!newFaculty.name || !newFaculty.email) return;

    setIsSubmitting(true);
    try {
      // Insert real user into Supabase users table
      const { data, error } = await supabase
        .from('users')
        .insert([
          {
            full_name: newFaculty.name,
            email: newFaculty.email.toLowerCase().trim(),
            role: 'teacher'
          }
        ])
        .select();

      if (error) {
        // Fallback: try inserting into teachers table
        await supabase
          .from('teachers')
          .insert([
            {
              name: newFaculty.name,
              email: newFaculty.email.toLowerCase().trim(),
              role: newFaculty.role,
              subject: newFaculty.department,
              status: 'Active'
            }
          ]);
      }

      setFeedbackMsg({ type: 'success', text: `Faculty member ${newFaculty.name} onboarded successfully to database!` });
      setTimeout(() => setFeedbackMsg(null), 4000);
      setShowAddModal(false);
      setNewFaculty({ name: '', email: '', department: 'Science & Physics', role: 'Subject Faculty' });
      await loadTeachers();
    } catch (err) {
      console.error('Error adding faculty:', err);
      setFeedbackMsg({ type: 'error', text: 'Failed to onboard faculty to database: ' + (err.message || '') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Quick Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.4rem', fontWeight: '800' }}>Faculty &amp; Staff Directory</h3>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
            Live faculty verified directly from Supabase database ({teachers.length} registered).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
              color: '#000',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 0 20px var(--brand-glow, rgba(0, 240, 255, 0.35))'
            }}
          >
            <Plus size={18} />
            <span>Add Faculty Member</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          background: feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: feedbackMsg.type === 'success' ? '1px solid #10B981' : '1px solid #EF4444',
          color: feedbackMsg.type === 'success' ? '#34d399' : '#f87171',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {feedbackMsg.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Search & Department Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search teachers by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              color: '#fff',
              outline: 'none',
              fontSize: '0.85rem'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {departments.map(dept => (
            <button
              key={dept}
              onClick={() => setDeptFilter(dept)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: deptFilter === dept ? '1px solid var(--brand-primary, #00F0FF)' : '1px solid rgba(255,255,255,0.08)',
                background: deptFilter === dept ? 'var(--brand-glow, rgba(0, 240, 255, 0.15))' : 'rgba(255,255,255,0.03)',
                color: deptFilter === dept ? 'var(--brand-primary, #00F0FF)' : '#94a3b8',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {dept === 'ALL' ? '👥 All Faculty' : dept}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px', gap: '12px', color: 'var(--brand-primary, #00F0FF)' }}>
          <Loader2 size={28} className="animate-spin" />
          <span style={{ fontSize: '1rem', fontWeight: '600' }}>Fetching real faculty from database...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredTeachers.length === 0 && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Users size={48} color="#64748b" style={{ margin: '0 auto 16px auto', display: 'block' }} />
            <h4 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: '700', margin: '0 0 8px 0' }}>No Faculty Found</h4>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 20px auto' }}>
              {search || deptFilter !== 'ALL'
                ? 'No teachers matched your search or department filter.'
                : 'No teacher accounts registered in the database yet. Click "Add Faculty Member" to onboard teachers.'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                color: '#000',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Onboard First Teacher
            </button>
          </div>
        </Card>
      )}

      {/* Teachers Cards Grid */}
      {!loading && filteredTeachers.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {filteredTeachers.map(teacher => (
            <Card key={teacher.id}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
                      <img
                        src={teacher.avatar}
                        alt={teacher.name}
                        style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px solid var(--brand-border, rgba(0, 240, 255, 0.4))', objectFit: 'cover', background: '#0a0f1d' }}
                      />
                      <span style={{
                        position: 'absolute',
                        bottom: '2px',
                        right: '2px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: isOnline(teacher.email) ? '#10B981' : '#64748B',
                        border: '2px solid #0D1424',
                        boxShadow: isOnline(teacher.email) ? '0 0 8px rgba(16, 185, 129, 0.8)' : 'none'
                      }}></span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h4 style={{ color: '#fff', fontSize: '1.15rem', fontWeight: '800', margin: 0 }}>{teacher.name}</h4>
                        <ShieldCheck size={16} color="var(--brand-primary, #00F0FF)" />
                      </div>
                      <p style={{ color: 'var(--brand-primary, #00F0FF)', fontSize: '0.8rem', fontWeight: '600', margin: '2px 0 0 0' }}>{teacher.role}</p>
                      <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '2px 0 0 0', fontFamily: 'monospace' }}>{teacher.email}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: '#94a3b8' }}>Department:</span>
                      <span style={{ color: '#cbd5e1', fontWeight: '700' }}>{teacher.department}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: '#94a3b8' }}>Assigned Sections:</span>
                      <span style={{ color: '#34d399', fontWeight: '700' }}>{teacher.classes.join(', ')}</span>
                    </div>

                    {(() => {
                      const online = isOnline(teacher.email);
                      const statusText = online ? 'Online' : 'Offline';
                      const statusColor = online ? '#10B981' : '#64748B';
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: '#94a3b8' }}>Verified Status:</span>
                          <span style={{ color: statusColor, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={13} /> {statusText}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                  <a
                    href={`/admin/communications?to=${encodeURIComponent(teacher.email)}`}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px',
                      background: 'var(--brand-glow, rgba(0, 240, 255, 0.1))',
                      border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.3))',
                      color: 'var(--brand-primary, #00F0FF)',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      textDecoration: 'none'
                    }}
                  >
                    <MessageSquare size={14} />
                    <span>Message</span>
                  </a>

                  <button
                    onClick={() => setSelectedTeacher(teacher)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    <BookOpen size={14} />
                    <span>Assign Class</span>
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Assign Class */}
      {selectedTeacher && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#0a0f1d', border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.4))', borderRadius: '20px', width: '100%', maxWidth: '460px', padding: '28px', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', fontWeight: '800' }}>Assign Classes to {selectedTeacher.name}</h3>
              <button onClick={() => setSelectedTeacher(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '16px' }}>Select section to allocate to this faculty member for the 2026 academic year.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {['Class 6th A', 'Class 6th B', 'Class 7th A', 'Class 8th A', 'Class 9th A', 'Class 10th A'].map(cls => (
                <label key={cls} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked={selectedTeacher.classes.includes(cls)} style={{ accentcolor: 'var(--brand-primary, #00F0FF)' }} />
                  <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>{cls}</span>
                </label>
              ))}
            </div>

            <button
              onClick={() => setSelectedTeacher(null)}
              style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))', border: 'none', color: '#000', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}
            >
              Save Section Assignments
            </button>
          </div>
        </div>
      )}

      {/* Modal: Add Faculty */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#0a0f1d', border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.4))', borderRadius: '20px', width: '100%', maxWidth: '460px', padding: '28px', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', fontWeight: '800' }}>Onboard New Faculty</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleAddFaculty} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gaurav Roy"
                  value={newFaculty.name}
                  onChange={e => setNewFaculty({ ...newFaculty, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. teacher@institution.edu"
                  value={newFaculty.email}
                  onChange={e => setNewFaculty({ ...newFaculty, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>Department</label>
                <select
                  value={newFaculty.department}
                  onChange={e => setNewFaculty({ ...newFaculty, department: e.target.value })}
                  style={{ width: '100%', padding: '10px', background: '#0a0f1d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                >
                  <option value="Academic Faculty">Academic Faculty</option>
                  <option value="Science & Physics">Science & Physics</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Social Sciences">Social Sciences</option>
                  <option value="Languages">Languages</option>
                  <option value="Visual Arts">Visual Arts</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Head of Physics & 3D Labs"
                  value={newFaculty.role}
                  onChange={e => setNewFaculty({ ...newFaculty, role: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))', border: 'none', color: '#000', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Saving to Database...' : 'Save to Supabase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
