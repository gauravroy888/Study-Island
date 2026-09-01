import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import { supabase } from '../supabase';
import { usePresence } from '../hooks/usePresence';
import { BookOpen, Video, Clock, MapPin, Sparkles } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
  '08:30 - 09:15',
  '09:20 - 10:05',
  '10:10 - 10:55',
  '11:15 - 12:00',
  '12:05 - 12:50',
  '01:30 - 02:15'
];

export default function TimeTable() {
  const { lastMessage } = usePresence();
  const [schedule, setSchedule] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [liveBanner, setLiveBanner] = useState('');

  const fetchTimetable = async () => {
    try {
      const uStr = localStorage.getItem('edtech_teacher_user') || localStorage.getItem('edtech_user');
      const user = uStr ? JSON.parse(uStr) : { email: 'gauravroy476@gmail.com', name: 'Gaurav' };
      const teacherEmail = user?.email?.toLowerCase().trim() || 'gauravroy476@gmail.com';
      const teacherName = user?.name || 'Gaurav';

      // 1. Query Supabase timetables table
      const { data: dbSlots } = await supabase
        .from('timetables')
        .select('*');

      let matchedSlots = [];
      if (dbSlots && dbSlots.length > 0) {
        matchedSlots = dbSlots.filter(s => 
          (s.teacher_email && s.teacher_email.toLowerCase().trim() === teacherEmail) ||
          (s.teacher_name && s.teacher_name.toLowerCase().includes(teacherName.toLowerCase()))
        );
      }

      // Format grid
      const formattedSchedule = TIME_SLOTS.map(time => {
        const row = { time };
        DAYS.forEach(day => {
          const slot = matchedSlots.find(s => s.day === day && s.time_slot === time);
          row[day.toLowerCase()] = slot 
            ? `${slot.subject} (${slot.class_name || ''}) • ${slot.room || ''}`
            : '-';
        });
        return row;
      });


      setSchedule(formattedSchedule);
    } catch (err) {
      console.error('Error fetching teacher timetable:', err);
    }
  };

  const fetchUpdates = async () => {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .in('type', ['assignment', 'meeting'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) setUpdates(data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchTimetable();
    fetchUpdates();
  }, []);

  // Listen to WebSocket broadcasts
  useEffect(() => {
    if (lastMessage?.type === 'timetable_update') {
      fetchTimetable();
      setLiveBanner('⚡ Schedule updated in real time by Admin!');
      setTimeout(() => setLiveBanner(''), 4000);
    }
  }, [lastMessage]);

  return (
    <div className="view-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', color: '#fff' }}>Faculty Teaching Timetable</h1>
          <p style={{ margin: '4px 0 0 0', color: '#94a3b8' }}>Live synchronized with Admin Master Schedule & Database.</p>
        </div>
      </div>

      {liveBanner && (
        <div style={{ padding: '12px 18px', background: 'rgba(0, 240, 255, 0.15)', border: '1px solid #00F0FF', color: '#00F0FF', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} /> {liveBanner}
        </div>
      )}

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '750px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--panel-border, rgba(255,255,255,0.1))', textAlign: 'left' }}>
                <th style={{ padding: '14px', color: '#94a3b8' }}>Time Slot</th>
                <th style={{ padding: '14px', color: '#94a3b8' }}>Monday</th>
                <th style={{ padding: '14px', color: '#94a3b8' }}>Tuesday</th>
                <th style={{ padding: '14px', color: '#94a3b8' }}>Wednesday</th>
                <th style={{ padding: '14px', color: '#94a3b8' }}>Thursday</th>
                <th style={{ padding: '14px', color: '#94a3b8' }}>Friday</th>
                <th style={{ padding: '14px', color: '#94a3b8' }}>Saturday</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row, index) => (
                <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '14px', color: 'var(--brand-primary, #00F0FF)', fontWeight: '700', fontSize: '0.85rem' }}>{row.time}</td>
                  <td style={{ padding: '14px', fontSize: '0.85rem', color: row.monday !== '-' ? '#fff' : '#64748B', fontWeight: row.monday !== '-' ? '600' : '400' }}>{row.monday}</td>
                  <td style={{ padding: '14px', fontSize: '0.85rem', color: row.tuesday !== '-' ? '#fff' : '#64748B', fontWeight: row.tuesday !== '-' ? '600' : '400' }}>{row.tuesday}</td>
                  <td style={{ padding: '14px', fontSize: '0.85rem', color: row.wednesday !== '-' ? '#fff' : '#64748B', fontWeight: row.wednesday !== '-' ? '600' : '400' }}>{row.wednesday}</td>
                  <td style={{ padding: '14px', fontSize: '0.85rem', color: row.thursday !== '-' ? '#fff' : '#64748B', fontWeight: row.thursday !== '-' ? '600' : '400' }}>{row.thursday}</td>
                  <td style={{ padding: '14px', fontSize: '0.85rem', color: row.friday !== '-' ? '#fff' : '#64748B', fontWeight: row.friday !== '-' ? '600' : '400' }}>{row.friday}</td>
                  <td style={{ padding: '14px', fontSize: '0.85rem', color: row.saturday !== '-' ? '#fff' : '#64748B', fontWeight: row.saturday !== '-' ? '600' : '400' }}>{row.saturday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ marginTop: '10px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: '#fff', fontWeight: '700' }}>Online Classes & Test Schedule Updates</h3>
        <Card>
          {updates.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {updates.map(update => (
                <div key={update.id} style={{ display: 'flex', alignItems: 'flex-start', padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ backgroundColor: update.type === 'meeting' ? 'rgba(0, 240, 255, 0.1)' : 'rgba(168, 85, 247, 0.1)', color: update.type === 'meeting' ? '#00F0FF' : '#a855f7', padding: '10px', borderRadius: '10px', marginRight: '14px' }}>
                    {update.type === 'meeting' ? <Video size={18} /> : <BookOpen size={18} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: '#fff' }}>{update.title}</h4>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>{update.message}</p>
                    <span style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '6px', display: 'block' }}>
                      {new Date(update.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0', margin: 0 }}>No recent announcements.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

