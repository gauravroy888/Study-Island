import React, { useState, useEffect, useCallback } from 'react';
import Card from '../components/Card';
import { Bell, BookOpen, MessageSquare, Star, CheckCircle, UserPlus, Info } from 'lucide-react';
import { supabase } from '../supabase';
import './Notifications.css';

const typeIconMap = {
  assignment:  { icon: BookOpen,      color: '#00E5FF' },
  message:     { icon: MessageSquare, color: '#8A2BE2' },
  system:      { icon: Bell,          color: '#0A84FF' },
  achievement: { icon: Star,          color: '#FFD700' },
  grade:       { icon: CheckCircle,   color: '#10B981' },
  user_add:    { icon: UserPlus,      color: '#FF6B6B' },
  info:        { icon: Info,          color: '#a0aebc' },
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const userStr = localStorage.getItem('edtech_user');
    if (userStr) {
      try { setCurrentUser(JSON.parse(userStr)); } catch (e) {}
    }
  }, []);

  const fetchNotifications = useCallback(async (user) => {
    if (!user) return;
    try {
      const email = user.email;

      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      // Exclude broadcast announcements and system broadcasts from direct notifications tab
      const filteredNotifs = (notifData || []).filter(n =>
        !n.is_broadcast && n.user_email !== 'all' && n.user_email !== 'system' && (n.user_email === email || !n.user_email)
      );

      setNotifications(filteredNotifs);
    } catch (e) {
      console.error('Error fetching student notifications:', e);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    fetchNotifications(currentUser);

    const subscription = supabase.channel('student:notifications:v2')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications'
      }, () => fetchNotifications(currentUser))
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [currentUser, fetchNotifications]);

  const markAsRead = async (id) => {
    const notif = notifications.find(n => n.id === id);
    if (!notif) return;

    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!currentUser) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_email', currentUser.email)
      .eq('is_read', false);

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications;

  return (
    <div className="view-container">
      <Card className="full-height-card">
        <div className="notifications-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="tabs" style={{ display: 'flex', gap: '20px' }}>
            <button
              className={`tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
              style={{ background: 'transparent', border: 'none', color: filter === 'all' ? '#00E5FF' : 'var(--text-secondary)', fontWeight: filter === 'all' ? 'bold' : 'normal', cursor: 'pointer', borderBottom: filter === 'all' ? '2px solid #00E5FF' : 'none', paddingBottom: '5px' }}
            >
              All Notifications
            </button>
            <button
              className={`tab ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
              style={{ background: 'transparent', border: 'none', color: filter === 'unread' ? '#00E5FF' : 'var(--text-secondary)', fontWeight: filter === 'unread' ? 'bold' : 'normal', cursor: 'pointer', borderBottom: filter === 'unread' ? '2px solid #00E5FF' : 'none', paddingBottom: '5px' }}
            >
              Unread
            </button>
          </div>
          <button className="btn btn-ghost text-sm" onClick={markAllAsRead} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '5px 15px', borderRadius: '15px', cursor: 'pointer' }}>
            Mark all as read
          </button>
        </div>

        <div className="notifications-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredNotifications.length > 0 ? filteredNotifications.map(notif => {
            const typeKey = notif.type || 'info';
            const { icon: Icon, color } = typeIconMap[typeKey] || typeIconMap.info;
            return (
              <div
                key={notif.id}
                className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                onClick={() => !notif.is_read && markAsRead(notif.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px 20px',
                  background: !notif.is_read ? 'rgba(0, 229, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: '14px',
                  cursor: !notif.is_read ? 'pointer' : 'default',
                  position: 'relative'
                }}
              >
                <div className="notif-icon-wrapper" style={{ backgroundColor: `${color}30`, color: color, width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px', flexShrink: 0 }}>
                  <Icon size={22} />
                </div>
                <div className="notif-content" style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <h4 className="notif-title" style={{ margin: 0, color: '#fff', fontSize: '15px', fontWeight: '800' }}>{notif.title}</h4>
                  </div>
                  <p className="notif-message" style={{ margin: '4px 0 0 0', color: '#f1f5f9', fontSize: '14px', fontWeight: '500', lineHeight: '1.4' }}>{notif.message}</p>
                  <span className="notif-time" style={{ display: 'block', marginTop: '6px', color: 'rgba(255, 255, 255, 0.45)', fontSize: '11px', fontWeight: '600' }}>
                    {notif.author ? `From: ${notif.author} • ` : ''}{new Date(notif.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                {!notif.is_read && <div className="unread-dot" style={{ width: '10px', height: '10px', backgroundColor: '#00E5FF', borderRadius: '50%', position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', boxShadow: '0 0 8px #00E5FF' }}></div>}
              </div>
            );
          }) : (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
              No notifications found.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
