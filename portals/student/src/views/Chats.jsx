import React, { useState, useEffect, useCallback } from 'react';
import Card from '../components/Card';
import { Users, MessageSquare } from 'lucide-react';
import { supabase } from '../supabase';
import ChatInterface from '../components/ChatInterface';
import { useLocation } from 'react-router-dom';

export default function Chats() {
  const [activeTab, setActiveTab] = useState('direct');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const userStr = localStorage.getItem('edtech_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  });
  const [announcements, setAnnouncements] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({ direct: 0, teachers: 0 });
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userParam = params.get('user');
    if (userParam) {
      localStorage.setItem('edtech_user', userParam);
      setCurrentUser(JSON.parse(userParam));
    } else {
      const userStr = localStorage.getItem('edtech_user');
      if (userStr) {
        try { setCurrentUser(JSON.parse(userStr)); } catch (e) {}
      }
      // Bug 7 fix: removed the fake identity fallback. If no user is found in localStorage,
      // simply stay null — ChatInterface will render a graceful "not logged in" state
      // instead of silently saving messages under a fake identity in the DB.
    }
  }, [location.search]);

  // Fetch announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      const { data } = await supabase.from('announcements').select('*').order('createdAt', { ascending: false });
      if (data) setAnnouncements(data);
    };

    fetchAnnouncements();

    const subscription = supabase.channel('student_announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchAnnouncements)
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  // Bug 3 fix: stable callback reference prevents re-render cascade when passed to ChatInterface
  const handleUnreadCountChange = useCallback((counts) => {
    setUnreadCounts(counts);
  }, []);

  return (
    <div className="view-container animate-fade-in" style={{ height: 'calc(100vh - 145px)', display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
      <div className="view-header flex-between" style={{ flexWrap: 'wrap', gap: '20px', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 6px 0', color: 'white' }}>Inbox & Direct Messages</h1>
          <p style={{ margin: 0, color: '#94a3b8' }}>Chat directly with teacher Gaurav and your course mentors.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '30px', padding: '5px', flexWrap: 'wrap', gap: '5px' }}>
            <button
              onClick={() => setActiveTab('direct')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 20px', borderRadius: '25px', border: 'none',
                background: activeTab === 'direct' ? 'var(--accent-cyan)' : 'transparent',
                color: activeTab === 'direct' ? '#000' : 'var(--text-secondary)',
                cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s'
              }}
            >
              <MessageSquare size={16} /> Direct
              {/* Bug 12-student: only show badge when not on this tab */}
              {unreadCounts.direct > 0 && activeTab !== 'direct' && (
                <span style={{ background: '#EF4444', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px', marginLeft: '2px' }}>
                  {unreadCounts.direct}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('teachers')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 20px', borderRadius: '25px', border: 'none',
                background: activeTab === 'teachers' ? '#FF6B6B' : 'transparent',
                color: activeTab === 'teachers' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s'
              }}
            >
              <Users size={16} /> Teachers
              {unreadCounts.teachers > 0 && activeTab !== 'teachers' && (
                <span style={{ background: '#EF4444', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px', marginLeft: '2px' }}>
                  {unreadCounts.teachers}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bug 7 fix: if user is not logged in, show a gate instead of loading ChatInterface with null user */}
      {!currentUser ? (
        <Card style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <MessageSquare size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <h3 style={{ color: '#fff', marginBottom: '8px' }}>Not logged in</h3>
          <p style={{ margin: 0 }}>Please log in to access your messages.</p>
        </Card>
      ) : (
        <Card style={{ padding: '0', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ChatInterface
            currentUser={currentUser}
            activeTab={activeTab}
            isManager={false}
            onUnreadCountChange={handleUnreadCountChange}  // Bug 3 fix: stable callback
          />
        </Card>
      )}
    </div>
  );
}
