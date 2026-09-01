import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Video, BookOpen, Sparkles, ExternalLink } from 'lucide-react';
import Card from '../components/Card';
import { supabase } from '../supabase';
import { usePresence } from '../hooks/usePresence';
import './Timetable.css';

export default function Timetable() {
  const { lastMessage } = usePresence();
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [liveSessions, setLiveSessions] = useState([]);
  const [dbTimetable, setDbTimetable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveSyncBanner, setLiveSyncBanner] = useState('');

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const fetchActiveClasses = async () => {
    setLoading(true);
    try {
      // 1. Fetch live video sessions
      const { data: liveData } = await supabase.from('live_classes').select('*').eq('status', 'active');
      if (liveData) setLiveSessions(liveData);

      // 2. Fetch timetables for Class 6th
      const { data: ttData } = await supabase
        .from('timetables')
        .select('*')
        .eq('class_name', 'Class 6th');

      if (ttData) {
        setDbTimetable(ttData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveClasses();
  }, []);

  // Listen to WebSocket broadcasts
  useEffect(() => {
    if (lastMessage?.type === 'timetable_update') {
      fetchActiveClasses();
      setLiveSyncBanner('⚡ Timetable updated in real time by Admin!');
      setTimeout(() => setLiveSyncBanner(''), 4000);
    }
  }, [lastMessage]);

  // Compute active schedule for selected day
  const getScheduleForSelectedDay = () => {
    const dayDbItems = dbTimetable.filter(t => t.day === selectedDay);
    if (dayDbItems.length > 0) {
      return dayDbItems.map(item => ({
        time: item.time_slot,
        subject: item.subject,
        room: item.room || '-',
        status: item.type || 'Scheduled',
        icon: item.type === '3D Simulation' ? '💡' : '📚',
        teacher: item.teacher_name || 'Faculty Member',
        hasSim: item.type === '3D Simulation'
      }));
    }
    return [];
  };

  const currentSchedule = getScheduleForSelectedDay();


  return (
    <div className="view-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {liveSyncBanner && (
        <div style={{ padding: '12px 18px', background: 'rgba(0, 240, 255, 0.15)', border: '1px solid #00F0FF', color: '#00F0FF', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} /> {liveSyncBanner}
        </div>
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'white', fontSize: '1.4rem', fontWeight: '800' }}>Academic Class Timetable</h3>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.95rem' }}>Class 6th • Delhi Public School Academic Schedule</p>
          </div>


          {/* Weekday Switcher Tabs */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '14px', padding: '4px', gap: '4px' }}>
            {daysOfWeek.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: selectedDay === d ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid transparent',
                  background: selectedDay === d ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(59, 130, 246, 0.2))' : 'transparent',
                  color: selectedDay === d ? 'var(--brand-primary, #00F0FF)' : '#94a3b8',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {currentSchedule.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <BookOpen size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontWeight: '600' }}>No classes scheduled for {selectedDay} yet.</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748B' }}>Assigned schedules will appear live when published by Admin.</p>
            </div>
          ) : (
            currentSchedule.map((item, idx) => (

            <div key={idx} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px',
              borderRadius: '16px',
              background: item.status === 'Live Now' ? 'linear-gradient(135deg, var(--brand-glow, rgba(0, 240, 255, 0.15)), var(--brand-secondary, rgba(59, 130, 246, 0.15)))' : 'rgba(255, 255, 255, 0.03)',
              border: item.status === 'Live Now' ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: item.status === 'Live Now' ? '0 0 25px rgba(0, 240, 255, 0.2)' : 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ fontSize: '2rem' }}>{item.icon}</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>{item.subject}</h4>
                  <div style={{ display: 'flex', gap: '16px', color: '#94a3b8', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> {item.time}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={14} /> {item.room}</span>
                    <span style={{ color: 'var(--brand-primary, #00F0FF)' }}>• {item.teacher}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                {item.hasSim && (
                  <button 
                    onClick={() => {
                      const pathSegments = window.location.pathname.split('/').filter(Boolean);
                      const repoPrefix = (window.location.hostname.endsWith('github.io') && pathSegments.length > 0)
                        ? '/' + pathSegments[0]
                        : '';
                      const origin = window.location.origin;
                      window.open(origin + repoPrefix + '/study-island/index.html', '_blank');
                    }}
                    style={{
                      background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                      color: '#000',
                      fontWeight: '700',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 0 15px var(--brand-glow, rgba(0, 240, 255, 0.3))'
                    }}
                  >
                    <Video size={16} /> Launch 3D Lab
                  </button>
                )}
                {!item.hasSim && (
                  <span style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.05)',
                    color: item.status === 'Upcoming' ? '#fbbf24' : '#94a3b8',
                    fontSize: '0.85rem',
                    fontWeight: '700'
                  }}>
                    {item.status}
                  </span>
                )}
              </div>
            </div>
          )))}
        </div>




      </Card>
    </div>
  );
}
