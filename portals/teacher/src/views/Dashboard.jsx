import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import { Users, Calendar, Video, FileText, ArrowRight, TrendingUp, PlusCircle, Tv, Megaphone, BellRing, ShieldAlert, X } from 'lucide-react';
import { supabase } from '../supabase';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 320,
    classesToday: 4,
    activeTests: 2,
    upcomingClasses: [],
    recentTests: []
  });
  const [loading, setLoading] = useState(true);
  const [latestBroadcast, setLatestBroadcast] = useState(null);

  useEffect(() => {
    loadTeacherStats();
    loadLatestBroadcast();

    // Real-time BroadcastChannel sync
    let bc = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('edtech_platform_sync');
        bc.onmessage = (e) => {
          if (e.data?.type === 'BROADCAST_ALERT') {
            setLatestBroadcast({
              title: e.data.title || 'Platform Announcement',
              text: e.data.message || e.data.text,
              author: e.data.author || 'SuperAdmin',
              createdAt: new Date().toISOString()
            });
          }
        };
      } catch (err) {}
    }

    const sub = supabase.channel('teacher_dashboard_broadcasts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
        if (payload.new) {
          setLatestBroadcast(payload.new);
        }
      })
      .subscribe();

    return () => {
      if (bc) bc.close();
      supabase.removeChannel(sub);
    };
  }, []);

  async function loadLatestBroadcast() {
    try {
      const { data } = await supabase.from('announcements').select('*').order('createdAt', { ascending: false }).limit(1);
      if (data && data.length > 0) {
        const bcast = data[0];
        const dismissedId = localStorage.getItem('edtech_dismissed_dashboard_broadcast');
        if (dismissedId !== (bcast.id?.toString() || bcast.title)) {
          setLatestBroadcast(bcast);
        }
      }
    } catch (e) {}
  }

  const handleDismissDashboardBroadcast = () => {
    if (latestBroadcast) {
      localStorage.setItem('edtech_dismissed_dashboard_broadcast', latestBroadcast.id?.toString() || latestBroadcast.title || 'latest');
      setLatestBroadcast(null);
    }
  };

  async function loadTeacherStats() {
    setLoading(true);
    try {
      const { data: classesData } = await supabase.from('classes').select('*');
      const { data: testsData } = await supabase.from('tests').select('*').order('created_at', { ascending: false });
      const { data: liveData } = await supabase.from('live_classes').select('*').order('start_time', { ascending: true });

      const totalStudentsCount = classesData ? classesData.reduce((acc, c) => acc + (c.student_count || 32), 0) : 320;
      const todayClasses = liveData ? liveData.length : (classesData ? classesData.length : 4);

      setStats({
        totalStudents: totalStudentsCount || 320,
        classesToday: todayClasses || 4,
        activeTests: testsData ? testsData.length : 2,
        upcomingClasses: liveData && liveData.length > 0 ? liveData : [
          { id: 1, title: 'Class 6th Physics & Optics', class_name: 'Class 6th', time: '10:00 AM', room: 'Lab 3 (3D VR)' },
          { id: 2, title: 'Class 7th Thermal Dynamics', class_name: 'Class 7th', time: '01:30 PM', room: 'Sim Lab 2' }
        ],
        recentTests: testsData && testsData.length > 0 ? testsData.slice(0, 3) : [
          { id: 1, title: 'Optics & Light Ray Diagram Quiz', type: 'MCQ', duration: 30, questions: [1, 2, 3, 4] },
          { id: 2, title: 'Thermal Energy & Kinetics Test', type: 'QA', duration: 45, questions: [1, 2] }
        ]
      });
    } catch (err) {
      console.error('Failed to load teacher stats:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="view-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Welcome Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--brand-glow, rgba(0, 240, 255, 0.15)), rgba(168, 85, 247, 0.15), var(--brand-secondary, rgba(59, 130, 246, 0.15)))',
        border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.35))',
        borderRadius: '20px',
        padding: '28px 36px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 8px 0', color: 'white' }}>
            Teacher Command Deck 🚀
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '1.05rem' }}>
            You have <strong>{stats.classesToday} Classes Scheduled</strong> and <strong>{stats.activeTests} Active Tests</strong> running.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a
            href="#/smartboard"
            style={{
              background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
              color: '#000',
              fontWeight: '800',
              padding: '14px 24px',
              borderRadius: '14px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 0 25px var(--brand-glow, rgba(0, 240, 255, 0.4))'
            }}
          >
            <Tv size={20} /> Teach on Smartboard <ArrowRight size={16} />
          </a>

          <a
            href="#/liveclass"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              fontWeight: '700',
              padding: '14px 20px',
              borderRadius: '14px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Video size={20} /> Live Class
          </a>
        </div>
      </div>

      {/* 📢 Bold Live Institutional Broadcast Banner */}
      {latestBroadcast && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(239, 68, 68, 0.2), rgba(13, 20, 36, 0.95))',
          border: '2px solid rgba(168, 85, 247, 0.6)',
          borderRadius: '18px',
          padding: '20px 24px',
          boxShadow: '0 0 35px rgba(168, 85, 247, 0.35)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '18px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1, minWidth: '280px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'rgba(168, 85, 247, 0.35)',
              border: '2px solid rgba(168, 85, 247, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 15px rgba(168, 85, 247, 0.5)',
              flexShrink: 0
            }}>
              <Megaphone size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: '900',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  letterSpacing: '0.8px',
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.6)'
                }}>
                  🔴 OFFICIAL LIVE BROADCAST
                </span>
                <span style={{ color: '#c084fc', fontSize: '13px', fontWeight: '700' }}>
                  {latestBroadcast.author ? `From: ${latestBroadcast.author}` : 'From: SuperAdmin'}
                </span>
              </div>
              <h3 style={{ margin: '8px 0 4px 0', fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>
                {latestBroadcast.title || 'Platform Notice'}
              </h3>
              <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.95rem', fontWeight: '500', lineHeight: '1.5' }}>
                {latestBroadcast.text || latestBroadcast.content || latestBroadcast.message}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <a
              href="#/inbox"
              style={{
                background: 'rgba(168, 85, 247, 0.25)',
                border: '1px solid rgba(168, 85, 247, 0.6)',
                color: '#e9d5ff',
                fontWeight: '700',
                padding: '10px 18px',
                borderRadius: '12px',
                textDecoration: 'none',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              <span>View in Inbox</span> <ArrowRight size={14} />
            </a>

            <button
              onClick={handleDismissDashboardBroadcast}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '10px',
                color: '#cbd5e1',
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              title="Close Broadcast Alert"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--brand-glow, rgba(0, 240, 255, 0.1))', color: 'var(--brand-primary, #00F0FF)' }}>
              <Users size={24} />
            </div>
            <div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Total Students</p>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: '800', color: 'white' }}>{stats.totalStudents}</h3>
            </div>
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
              <Calendar size={24} />
            </div>
            <div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Classes Today</p>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: '800', color: 'white' }}>{stats.classesToday}</h3>
            </div>
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
              <FileText size={24} />
            </div>
            <div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Active Tests</p>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: '800', color: 'white' }}>{stats.activeTests}</h3>
            </div>
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(52,199,89,0.1)', color: '#34c759' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Class Average</p>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: '800', color: 'white' }}>88.4%</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Grid: Upcoming Classes & Active Tests */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px' }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Upcoming Classes & Sessions</h3>
            <a href="#/timetable" style={{ color: 'var(--brand-primary, #00F0FF)', fontSize: '0.85rem', textDecoration: 'none', fontWeight: '600' }}>Full Timetable &rarr;</a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stats.upcomingClasses.map((item, idx) => (
              <div key={idx} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'white', fontSize: '1.05rem', fontWeight: '600' }}>{item.title}</h4>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>{item.class_name} • {item.room || '3D Virtual Lab'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--brand-primary, #00F0FF)', fontWeight: '700', fontSize: '0.95rem' }}>{item.time || '10:00 AM'}</span>
                  <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '0.75rem' }}>Scheduled</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Quick Actions</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <a
              href="#/question-bank"
              style={{
                padding: '16px 20px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.15), rgba(59, 130, 246, 0.15))',
                border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.4))',
                color: '#ffffff',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontWeight: '700',
                fontSize: '0.95rem',
                boxShadow: '0 0 15px rgba(0, 240, 255, 0.15)'
              }}
            >
              <span style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--brand-primary, #00F0FF)' }}>➕</span> Add Questions to Bank
              </span>
              <span style={{ color: 'var(--brand-primary, #00F0FF)' }}>&rarr;</span>
            </a>

            <a
              href="#/classes"
              style={{
                padding: '16px 20px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontWeight: '600',
                fontSize: '0.95rem'
              }}
            >
              <span>👥 View Assigned Classes</span>
              <span>&rarr;</span>
            </a>

            <a
              href="#/inbox"
              style={{
                padding: '16px 20px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontWeight: '600',
                fontSize: '0.95rem'
              }}
            >
              <span>💬 Student Message Inbox</span>
              <span>&rarr;</span>
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
