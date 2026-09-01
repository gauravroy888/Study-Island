import React, { useState, useEffect } from 'react';
import { BookOpen, Trophy, Clock, PlayCircle, ArrowRight, Megaphone, X } from 'lucide-react';
import Card from '../components/Card';
import ProgressBar from '../components/ProgressBar';
import { supabase } from '../supabase';
import './Dashboard.css';

export default function Dashboard() {
  const userStr = localStorage.getItem('edtech_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const userName = user?.name || 'Student';
  const [latestBroadcast, setLatestBroadcast] = useState(null);

  useEffect(() => {
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

    const sub = supabase.channel('student_dashboard_broadcasts')
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

  return (
    <div className="view-container">
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--brand-glow, rgba(0, 240, 255, 0.15)), var(--brand-secondary, rgba(59, 130, 246, 0.15)))',
        border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.3))',
        borderRadius: '20px',
        padding: '28px 36px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 8px 0', color: 'white' }}>
            Welcome to Study Island, {userName.split(' ')[0]}! 👋
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '1.05rem' }}>
            You have <strong>3 3D Interactive Chapters</strong> assigned in <strong>Class 6th Science</strong>.
          </p>
        </div>
        <button 
          onClick={() => {
            const pathSegments = window.location.pathname.split('/').filter(Boolean);
            const repoPrefix = (window.location.hostname.endsWith('github.io') && pathSegments.length > 0)
              ? '/' + pathSegments[0]
              : '';
            const basePath = repoPrefix;
            const userStr = localStorage.getItem('edtech_student_user') || localStorage.getItem('edtech_user');
            const userObj = userStr ? JSON.parse(userStr) : {};
            const sId = userObj.id || 'student-101';
            const cId = userObj.class_id || '6th';
            const sName = encodeURIComponent(userObj.full_name || 'Student');
            const targetUrl = window.location.origin + basePath + '/study-island/index.html?student_id=' + sId + '&class_id=' + cId + '&role=student&name=' + sName;
            window.open(targetUrl, '_blank');
          }}
          style={{
            background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
            color: '#000',
            fontWeight: '700',
            border: 'none',
            padding: '14px 28px',
            borderRadius: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 0 25px var(--brand-glow, rgba(0, 240, 255, 0.4))'
          }}
        >
          <PlayCircle size={20} /> Launch Study Island <ArrowRight size={16} />
        </button>
      </div>

      {/* 📢 Bold Live Institutional Broadcast Banner */}
      {latestBroadcast && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(239, 68, 68, 0.2), rgba(13, 20, 36, 0.95))',
          border: '2px solid rgba(168, 85, 247, 0.6)',
          borderRadius: '18px',
          padding: '20px 24px',
          marginBottom: '24px',
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
              href="#/notifications"
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
              <span>View Alerts</span> <ArrowRight size={14} />
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--brand-glow, rgba(0, 240, 255, 0.1))', color: 'var(--brand-primary, #00F0FF)' }}>
              <BookOpen size={24} />
            </div>
            <div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Assigned Courses</p>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: '800', color: 'white' }}>3 Courses</h3>
            </div>
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
              <Trophy size={24} />
            </div>
            <div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Total XP Earned</p>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: '800', color: 'white' }}>+450 XP</h3>
            </div>
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
              <Clock size={24} />
            </div>
            <div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>3D Exploration Time</p>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: '800', color: 'white' }}>4.2 Hours</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Featured Active Course */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Active Learning Module</h3>
          <span style={{ color: 'var(--brand-primary, #00F0FF)', fontSize: '0.85rem', fontWeight: '600' }}>In Progress</span>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '16px', background: 'var(--brand-glow, rgba(0, 240, 255, 0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.3))', fontSize: '2rem' }}>
            💡
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 6px 0', color: 'white', fontSize: '1.2rem' }}>Class 6th Physics & Optics: Light & Shadows</h4>
            <p style={{ margin: '0 0 12px 0', color: '#94a3b8', fontSize: '0.9rem' }}>Interactive 3D exploration of umbra, penumbra, and ray diagrams.</p>
            <ProgressBar progress={85} />
          </div>
        </div>
      </Card>
    </div>
  );
}
