import React, { useState, useEffect } from 'react';
import { Megaphone, X, BellRing, Sparkles } from 'lucide-react';
import { supabase } from '../supabase';

export default function GlobalBroadcastBanner() {
  const [broadcast, setBroadcast] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 1. Check local storage for active broadcast
    const checkLocalBroadcast = () => {
      try {
        const stored = localStorage.getItem('edtech_active_broadcast');
        if (stored) {
          const parsed = JSON.parse(stored);
          const dismissedId = localStorage.getItem('edtech_dismissed_broadcast');
          const isFresh = parsed.timestamp && (Date.now() - parsed.timestamp < 48 * 60 * 60 * 1000);
          if (isFresh && dismissedId !== (parsed.id || parsed.timestamp?.toString())) {
            setBroadcast(parsed);
            setVisible(true);
            return true;
          }
        }
      } catch (e) {}
      return false;
    };

    const hasLocal = checkLocalBroadcast();

    // 2. Fetch latest announcement from Supabase
    const fetchLatestAnnouncement = async () => {
      try {
        const { data } = await supabase
          .from('announcements')
          .select('*')
          .order('createdAt', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          const latest = data[0];
          const latestTime = new Date(latest.createdAt || latest.created_at || Date.now()).getTime();
          const dismissedId = localStorage.getItem('edtech_dismissed_broadcast');
          const broadcastId = latest.id?.toString() || latestTime.toString();

          if (dismissedId !== broadcastId) {
            setBroadcast({
              id: broadcastId,
              title: latest.title || 'Platform Announcement',
              message: latest.text || latest.content || latest.message || 'Important platform broadcast from administration.',
              author: latest.author || latest.author_name || 'SuperAdmin'
            });
            setVisible(true);
          }
        }
      } catch (err) {
        console.warn('Could not fetch latest announcement:', err);
      }
    };

    if (!hasLocal) {
      fetchLatestAnnouncement();
    }

    // 3. Listen on native BroadcastChannel for instant 0ms cross-tab notification
    let bc = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('edtech_platform_sync');
        bc.onmessage = (event) => {
          if (event.data?.type === 'BROADCAST_ALERT') {
            const newBcast = {
              id: `bcast_${event.data.timestamp || Date.now()}`,
              title: event.data.title || 'Platform Announcement',
              message: event.data.message || event.data.text || '',
              author: event.data.author || 'SuperAdmin'
            };
            setBroadcast(newBcast);
            setVisible(true);
          }
        };
      } catch (e) {}
    }

    // 4. Supabase Realtime subscription on announcements
    const subscription = supabase.channel('teacher_global_broadcast_listener')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
        if (payload.new) {
          setBroadcast({
            id: payload.new.id?.toString() || Date.now().toString(),
            title: payload.new.title || 'Platform Announcement',
            message: payload.new.text || payload.new.content || payload.new.message || '',
            author: payload.new.author || payload.new.author_name || 'SuperAdmin'
          });
          setVisible(true);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.new && (payload.new.user_email === 'all' || payload.new.type === 'system')) {
          setBroadcast({
            id: payload.new.id?.toString() || Date.now().toString(),
            title: payload.new.title || 'Platform Announcement',
            message: payload.new.message || '',
            author: 'SuperAdmin'
          });
          setVisible(true);
        }
      })
      .subscribe();

    const handleStorageChange = () => checkLocalBroadcast();
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (bc) bc.close();
      supabase.removeChannel(subscription);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    if (broadcast?.id) {
      localStorage.setItem('edtech_dismissed_broadcast', broadcast.id);
    }
  };

  if (!visible || !broadcast || !broadcast.message) return null;

  return (
    <div 
      style={{
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.35), rgba(239, 68, 68, 0.25), rgba(13, 20, 36, 0.98))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '2px solid rgba(168, 85, 247, 0.8)',
        boxShadow: '0 0 35px rgba(168, 85, 247, 0.5), inset 0 0 15px rgba(239, 68, 68, 0.2)',
        borderRadius: '16px',
        margin: '0 0 20px 0',
        padding: '14px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        color: '#fff',
        zIndex: 99999,
        animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
        <div 
          style={{ 
            width: '44px', 
            height: '44px', 
            borderRadius: '12px', 
            background: 'linear-gradient(135deg, #a855f7, #ef4444)', 
            border: '2px solid #ffffff',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
            boxShadow: '0 0 18px rgba(239, 68, 68, 0.6)'
          }}
        >
          <Megaphone size={24} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: '900', 
              textTransform: 'uppercase', 
              letterSpacing: '0.8px', 
              background: '#ef4444', 
              color: '#ffffff', 
              padding: '3px 10px', 
              borderRadius: '6px',
              boxShadow: '0 0 12px rgba(239, 68, 68, 0.7)'
            }}>
              🔴 OFFICIAL BROADCAST ALERT
            </span>
            <span style={{ fontSize: '13px', color: '#e9d5ff', fontWeight: '700' }}>
              From: {broadcast.author}
            </span>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: '#ffffff', fontWeight: '600', lineHeight: '1.45', wordBreak: 'break-word' }}>
            {broadcast.message}
          </p>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        style={{
          background: 'rgba(255, 255, 255, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '10px',
          color: '#ffffff',
          cursor: 'pointer',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          flexShrink: 0
        }}
        title="Dismiss Alert"
      >
        <X size={20} />
      </button>
    </div>
  );
}
