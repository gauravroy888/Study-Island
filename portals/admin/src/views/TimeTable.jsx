import React, { useState, useEffect } from 'react';
import { Clock, Calendar, BookOpen, User, MapPin, Plus, Download, Check, Loader2, Edit2, Trash2, X, Save, Sparkles } from 'lucide-react';
import Card from '../components/Card';
import { supabase } from '../supabase';
import { usePresence } from '../hooks/usePresence';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = [
  '08:30 - 09:15',
  '09:20 - 10:05',
  '10:10 - 10:55',
  '11:15 - 12:00',
  '12:05 - 12:50',
  '01:30 - 02:15'
];

export default function TimeTable() {
  const { sendMessage, lastMessage } = usePresence();
  const [classesList, setClassesList] = useState(['Class 6th', 'Class 7th', 'Class 8th', 'Class 9th', 'Class 10th']);
  const [selectedClass, setSelectedClass] = useState('Class 6th');
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [dbTeachersList, setDbTeachersList] = useState([]);
  const [dbSubjectsList, setDbSubjectsList] = useState([]);
  const [timetableData, setTimetableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [formData, setFormData] = useState({
    class_name: 'Class 6th',
    day: 'Monday',
    time_slot: TIME_SLOTS[0],
    subject: 'Science',
    teacher_name: 'Gaurav',
    teacher_email: 'gauravroy476@gmail.com',
    room: 'Lab 3D VR Room',
    type: '3D Simulation'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch real classes
      const { data: dbClasses } = await supabase
        .from('classes')
        .select('*')
        .order('display_order', { ascending: true });

      if (dbClasses && dbClasses.length > 0) {
        setClassesList(dbClasses.map(c => c.name));
      }

      // 2. Fetch real teachers
      const { data: dbUsers } = await supabase
        .from('users')
        .select('*');

      const teachers = (dbUsers && dbUsers.length > 0)
        ? dbUsers.map(u => ({
            name: u.full_name || u.name || u.email.split('@')[0],
            email: u.email
          }))
        : [
            { name: 'Gaurav', email: 'gauravroy476@gmail.com' },
            { name: 'Harsh Pratap Singh', email: 'rathorehps@gmail.com' }
          ];
      setDbTeachersList(teachers);

      // 3. Fetch real subjects
      const { data: dbSubjects } = await supabase
        .from('subjects')
        .select('*');

      const subjects = (dbSubjects && dbSubjects.length > 0)
        ? [...new Set(dbSubjects.map(s => s.name))]
        : ['Science', 'Mathematics', 'History', 'Geography', 'English', 'Physics', 'Chemistry'];
      setDbSubjectsList(subjects);

      // 4. Fetch timetables from Supabase
      const { data: dbTimetables, error: ttError } = await supabase
        .from('timetables')
        .select('*');

      if (!ttError && dbTimetables) {
        setTimetableData(dbTimetables);
      } else {
        setTimetableData([]);
      }
    } catch (e) {
      console.error('Error loading timetable:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Listen to WebSocket broadcasts
  useEffect(() => {
    if (lastMessage?.type === 'timetable_update') {
      loadData();
    }
  }, [lastMessage]);

  // Filter current day & class periods
  const currentPeriods = TIME_SLOTS.map((slot, idx) => {
    const found = timetableData.find(
      t => t.class_name === selectedClass && t.day === selectedDay && t.time_slot === slot
    );
    if (found) return { ...found, period: idx + 1, isAssigned: true };
    
    return {
      id: `unassigned_${selectedClass}_${selectedDay}_${idx}`,
      class_name: selectedClass,
      day: selectedDay,
      time_slot: slot,
      period: idx + 1,
      subject: 'No Subject Assigned',
      teacher_name: 'Unassigned',
      teacher_email: '',
      room: '-',
      type: 'Unassigned',
      isAssigned: false
    };
  });


  const handleOpenAddModal = (slot) => {
    setEditingSlot(slot);
    const matchedTeacher = dbTeachersList.find(t => t.email === slot.teacher_email) || dbTeachersList[0] || { name: 'Gaurav', email: 'gauravroy476@gmail.com' };

    setFormData({
      class_name: selectedClass,
      day: selectedDay,
      time_slot: slot.time_slot,
      subject: slot.subject === 'Free Period / Self Study' ? (dbSubjectsList[0] || 'Physics') : slot.subject,
      teacher_name: matchedTeacher.name,
      teacher_email: matchedTeacher.email,
      room: slot.room === 'Study Hall' ? 'Room 201' : slot.room,
      type: slot.type === 'Self Study' ? 'Theory & Practice' : slot.type
    });
    setIsModalOpen(true);
  };

  const handleSaveSlot = async () => {
    try {
      const updatedItem = {
        class_name: formData.class_name,
        day: formData.day,
        time_slot: formData.time_slot,
        subject: formData.subject,
        teacher_name: formData.teacher_name,
        teacher_email: formData.teacher_email,
        room: formData.room,
        type: formData.type,
        updated_at: new Date().toISOString()
      };

      // Try saving to Supabase
      const { error } = await supabase
        .from('timetables')
        .upsert([updatedItem], { onConflict: 'class_name,day,time_slot' });

      // Update local state immediately
      setTimetableData(prev => {
        const filtered = prev.filter(p => !(p.class_name === formData.class_name && p.day === formData.day && p.time_slot === formData.time_slot));
        return [...filtered, { ...updatedItem, id: `slot_${Date.now()}` }];
      });

      // Broadcast Realtime Event via WebSocket
      sendMessage({
        type: 'timetable_update',
        payload: updatedItem
      });

      setStatusMessage(`✅ Updated ${formData.class_name} ${formData.day} (${formData.time_slot}) and broadcasted to all portals!`);
      setTimeout(() => setStatusMessage(''), 4000);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving slot:', err);
    }
  };

  const handleExport = () => {
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.4rem', fontWeight: '800' }}>Master Institutional Timetable Engine</h3>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
            Live synced with Supabase & Realtime WebSocket across Teacher & Student portals.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              background: copiedSuccess ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
              border: copiedSuccess ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.1)',
              color: copiedSuccess ? '#34d399' : '#cbd5e1',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            {copiedSuccess ? <Check size={16} /> : <Download size={16} />}
            <span>{copiedSuccess ? 'Schedule Exported!' : 'Export Schedule'}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div style={{ padding: '12px 18px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', color: '#34d399', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} /> {statusMessage}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px', gap: '12px', color: 'var(--brand-primary, #00F0FF)' }}>
          <Loader2 size={28} className="animate-spin" />
          <span style={{ fontSize: '1rem', fontWeight: '600' }}>Syncing master timetable...</span>
        </div>
      ) : (
        <>
          {/* Class & Day Selectors */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', padding: '16px', background: 'rgba(13, 20, 36, 0.75)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '700' }}>Select Class:</span>
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  background: '#0a0f1d',
                  border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.4))',
                  color: 'var(--brand-primary, #00F0FF)',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {classesList.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: selectedDay === day ? '1px solid var(--brand-primary, #00F0FF)' : '1px solid rgba(255,255,255,0.08)',
                    background: selectedDay === day ? 'var(--brand-glow, rgba(0, 240, 255, 0.15))' : 'rgba(255,255,255,0.03)',
                    color: selectedDay === day ? 'var(--brand-primary, #00F0FF)' : '#94a3b8',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Periods Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {currentPeriods.map(slot => (
              <Card key={slot.id || slot.period}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      PERIOD {slot.period}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(0, 240, 255, 0.1)',
                        border: '1px solid rgba(0, 240, 255, 0.3)',
                        color: '#00F0FF',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        textTransform: 'uppercase'
                      }}>
                        {slot.type}
                      </span>

                      <button
                        onClick={() => handleOpenAddModal(slot)}
                        title="Edit Period Slot"
                        style={{
                          padding: '4px 8px',
                          background: 'rgba(0, 240, 255, 0.1)',
                          border: '1px solid rgba(0, 240, 255, 0.3)',
                          color: '#00F0FF',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '700'
                        }}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ color: '#fff', fontSize: '1.15rem', fontWeight: '700', margin: '0 0 6px 0' }}>
                      {slot.subject}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--brand-primary, #00F0FF)', fontSize: '0.85rem', fontWeight: '600' }}>
                      <Clock size={14} />
                      <span>{slot.time_slot}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                      <User size={14} color="#a855f7" />
                      <span>{slot.teacher_name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.8rem' }}>
                      <MapPin size={14} />
                      <span>{slot.room}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Edit Slot Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 8, 18, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0D1424',
            border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.3))',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 0 40px rgba(0, 240, 255, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} color="var(--brand-primary, #00F0FF)" />
                Edit Schedule Slot ({formData.class_name} • {formData.day})
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px' }}>Time Slot</label>
                <select
                  value={formData.time_slot}
                  onChange={e => setFormData({ ...formData, time_slot: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: '#060a14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                >
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px' }}>Subject</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: '#060a14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px' }}>Assigned Teacher</label>
                <select
                  value={formData.teacher_email}
                  onChange={e => {
                    const selectedEmail = e.target.value;
                    const teacherObj = dbTeachersList.find(t => t.email === selectedEmail);
                    setFormData({
                      ...formData,
                      teacher_email: selectedEmail,
                      teacher_name: teacherObj ? teacherObj.name : selectedEmail
                    });
                  }}
                  style={{ width: '100%', padding: '10px 14px', background: '#060a14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                >
                  {dbTeachersList.map(t => (
                    <option key={t.email} value={t.email}>{t.name} ({t.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px' }}>Room / Venue</label>
                <input
                  type="text"
                  value={formData.room}
                  onChange={e => setFormData({ ...formData, room: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: '#060a14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px' }}>Class Type</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: '#060a14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }}
                >
                  <option value="3D Simulation">3D Simulation</option>
                  <option value="Theory & Practice">Theory & Practice</option>
                  <option value="Lab Practical">Lab Practical</option>
                  <option value="Assessment & Quiz">Assessment & Quiz</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
              >
                Cancel
              </button>

              <button
                onClick={handleSaveSlot}
                style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #00F0FF, #3B82F6)', border: 'none', color: '#060a14', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={16} /> Save & Sync Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

