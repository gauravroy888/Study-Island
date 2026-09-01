import React, { useState, useEffect } from 'react';
import { BookOpen, Users, UserCheck, Plus, ChevronRight, Activity, Award, X, Loader2, AlertCircle } from 'lucide-react';
import Card from '../components/Card';
import { supabase } from '../supabase';

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [realStudents, setRealStudents] = useState([]);
  const [realTeachers, setRealTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const [newClass, setNewClass] = useState({
    name: '',
    subject: 'Science, Mathematics, Social Studies',
    classTeacher: 'Gaurav',
    students: 30
  });

  const loadDatabaseData = async () => {
    setLoading(true);
    try {
      // 1. Fetch real classes
      const { data: dbClasses, error: clsErr } = await supabase
        .from('classes')
        .select('*')
        .order('display_order', { ascending: true });

      // 2. Fetch real students
      const { data: dbStudents } = await supabase
        .from('users')
        .select('*')
        .or('role.eq.student,role.eq.STUDENT');

      // 3. Fetch real teachers
      const { data: dbTeachers } = await supabase
        .from('users')
        .select('*')
        .or('role.eq.teacher,role.eq.TEACHER');

      const studentList = dbStudents || [];
      setRealStudents(studentList);

      const teacherList = (dbTeachers || []).map(t => t.full_name || t.name || t.email.split('@')[0]);
      setRealTeachers(teacherList.length > 0 ? teacherList : ['Gaurav', 'Harsh']);

      if (dbClasses && dbClasses.length > 0) {
        const colors = ['var(--brand-primary, #00F0FF)', 'var(--brand-secondary, #3B82F6)', '#A855F7', '#10B981', '#F59E0B', '#EC4899', '#6366F1'];
        const mapped = dbClasses.map((c, idx) => ({
          id: c.id,
          name: c.name,
          sections: [`${c.name} A`, `${c.name} B`],
          students: c.students || studentList.length || 0,
          classTeacher: teacherList[idx % teacherList.length] || 'Gaurav',
          activeSubject: c.subject || 'Standard Curriculum',
          progress: parseInt(c.performance) || 80,
          status: c.status || 'Active',
          color: colors[idx % colors.length]
        }));
        setClasses(mapped);
      } else {
        setClasses([]);
      }
    } catch (e) {
      console.error('Error loading classes data:', e);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabaseData();
  }, []);

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!newClass.name) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('classes')
        .insert([
          {
            name: newClass.name.trim(),
            subject: newClass.subject,
            students: parseInt(newClass.students) || 0,
            status: 'Active',
            display_order: classes.length + 1
          }
        ]);

      if (error) throw error;

      setFeedbackMsg({ type: 'success', text: `Class ${newClass.name} created successfully in database!` });
      setTimeout(() => setFeedbackMsg(null), 4000);
      setShowAddModal(false);
      setNewClass({ name: '', subject: 'Science, Mathematics, Social Studies', classTeacher: 'Gaurav', students: 30 });
      await loadDatabaseData();
    } catch (err) {
      console.error('Error adding class:', err);
      setFeedbackMsg({ type: 'error', text: 'Failed to create class in database: ' + (err.message || '') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.4rem', fontWeight: '800' }}>Class &amp; Section Management</h3>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
            Live institutional classes and sections fetched from Supabase ({classes.length} registered classes).
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
            <span>Add Class / Section</span>
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
          {feedbackMsg.type === 'success' ? <UserCheck size={18} /> : <AlertCircle size={18} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <Card>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700' }}>TOTAL DATABASE CLASSES</span>
          <h4 style={{ color: 'var(--brand-primary, #00F0FF)', fontSize: '1.8rem', fontWeight: '800', margin: '6px 0 0 0', fontFamily: 'monospace' }}>
            {classes.length}
          </h4>
          <span style={{ color: '#34d399', fontSize: '0.75rem', fontWeight: '600' }}>Active in Supabase</span>
        </Card>

        <Card>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700' }}>TOTAL REGISTERED STUDENTS</span>
          <h4 style={{ color: 'var(--brand-secondary, #3B82F6)', fontSize: '1.8rem', fontWeight: '800', margin: '6px 0 0 0', fontFamily: 'monospace' }}>
            {realStudents.length}
          </h4>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Verified Supabase Student Accounts</span>
        </Card>

        <Card>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700' }}>ACTIVE FACULTY TEACHERS</span>
          <h4 style={{ color: '#10B981', fontSize: '1.8rem', fontWeight: '800', margin: '6px 0 0 0', fontFamily: 'monospace' }}>
            {realTeachers.length}
          </h4>
          <span style={{ color: '#34d399', fontSize: '0.75rem', fontWeight: '600' }}>Assigned to Sections</span>
        </Card>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px', gap: '12px', color: 'var(--brand-primary, #00F0FF)' }}>
          <Loader2 size={28} className="animate-spin" />
          <span style={{ fontSize: '1rem', fontWeight: '600' }}>Loading classes from Supabase...</span>
        </div>
      )}

      {/* Classes Grid */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {classes.map(cls => (
            <Card key={cls.id}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: `${cls.color}20`,
                        border: `1px solid ${cls.color}50`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: cls.color,
                        fontWeight: '800',
                        fontSize: '0.9rem'
                      }}>
                        {cls.name.replace('Class ', '').slice(0, 4)}
                      </div>
                      <div>
                        <h4 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>{cls.name}</h4>
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{cls.sections.join(' • ')}</span>
                      </div>
                    </div>

                    <span style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '0.75rem', fontWeight: '700' }}>
                      {cls.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#94a3b8' }}>Class Teacher:</span>
                      <span style={{ color: 'var(--brand-primary, #00F0FF)', fontWeight: '700' }}>{cls.classTeacher}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#94a3b8' }}>Curriculum Subjects:</span>
                      <span style={{ color: '#cbd5e1', fontWeight: '600', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {cls.activeSubject}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                  <button
                    onClick={() => setSelectedClass(cls)}
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
                      cursor: 'pointer'
                    }}
                  >
                    <Users size={14} />
                    <span>Student Roster</span>
                  </button>

                  <a
                    href="/study-island/"
                    target="_blank"
                    rel="noreferrer"
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
                      textDecoration: 'none'
                    }}
                  >
                    <span>Open 3D Lab</span>
                    <ChevronRight size={14} />
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Real Student Roster */}
      {selectedClass && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#0a0f1d', border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.4))', borderRadius: '20px', width: '100%', maxWidth: '520px', padding: '28px', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.3rem', fontWeight: '800' }}>{selectedClass.name} — Real Student Cohort</h3>
              <button onClick={() => setSelectedClass(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '16px' }}>
              Class Teacher: <strong style={{ color: 'var(--brand-primary, #00F0FF)' }}>{selectedClass.classTeacher}</strong> • Verified Database Students: <strong style={{ color: '#34d399' }}>{realStudents.length} Students</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', marginBottom: '20px' }}>
              {realStudents.length > 0 ? (
                realStudents.map((s, idx) => {
                  const studentName = s.full_name || s.name || s.email.split('@')[0];
                  return (
                    <div key={s.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={`https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(studentName)}&backgroundColor=060a14`}
                          alt={studentName}
                          style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                        />
                        <div>
                          <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{studentName}</strong>
                          <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: 0, fontFamily: 'monospace' }}>{s.email}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: '700', display: 'block' }}>Verified Student</span>
                        <span style={{ color: 'var(--brand-primary, #00F0FF)', fontSize: '0.75rem', fontWeight: '600' }}>Active Account</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No student accounts registered in Supabase yet.</p>
              )}
            </div>

            <button
              onClick={() => setSelectedClass(null)}
              style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}
            >
              Close Roster
            </button>
          </div>
        </div>
      )}

      {/* Modal: Add Class */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#0a0f1d', border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.4))', borderRadius: '20px', width: '100%', maxWidth: '460px', padding: '28px', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', fontWeight: '800' }}>Add New Class Section to Database</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleAddClass} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>Grade Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 11th"
                  value={newClass.name}
                  onChange={e => setNewClass({ ...newClass, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>Subjects Offered</label>
                <input
                  type="text"
                  placeholder="e.g. Physics, Chemistry, Mathematics"
                  value={newClass.subject}
                  onChange={e => setNewClass({ ...newClass, subject: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>Designated Class Teacher</label>
                <select
                  value={newClass.classTeacher}
                  onChange={e => setNewClass({ ...newClass, classTeacher: e.target.value })}
                  style={{ width: '100%', padding: '10px', background: '#0a0f1d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                >
                  {realTeachers.map(t => (
                    <option key={t} value={t}>{t} (Faculty)</option>
                  ))}
                </select>
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
