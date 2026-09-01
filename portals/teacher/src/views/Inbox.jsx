import React, { useState, useEffect, useCallback } from 'react';
import Card from '../components/Card';
import { Search, Users, Shield, Megaphone, BookOpen, Settings } from 'lucide-react';
import { supabase } from '../supabase';
import ChatInterface from '../components/ChatInterface';

export default function Inbox() {
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'classes' | 'staff' | 'announcements' | 'groups'
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const classesList = ['Class 1st', 'Class 2nd', 'Class 3rd', 'Class 4th', 'Class 5th', 'Class 6th'];
  const [currentUser, setCurrentUser] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({ students: 0, staff: 0 });
  // Bug 3 fix: stable callback reference so ChatInterface's effect dep doesn't re-fire on every render
  const handleUnreadCountChange = useCallback((counts) => {
    setUnreadCounts(counts);
  }, []);
  const [lastViewedAnnouncements, setLastViewedAnnouncements] = useState(() => {
    return parseInt(localStorage.getItem('teacher_last_announcements_view') || '0', 10);
  });

  useEffect(() => {
    if (activeTab === 'announcements') {
      const now = Date.now();
      setLastViewedAnnouncements(now);
      localStorage.setItem('teacher_last_announcements_view', now.toString());
    }
  }, [activeTab]);

  useEffect(() => {
    const userStr = localStorage.getItem('edtech_user');
    if (userStr) {
      try { setCurrentUser(JSON.parse(userStr)); } catch (e) {}
    }
  }, []);

  // Fetch announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      const { data, error } = await supabase.from('announcements').select('*').order('createdAt', { ascending: false });
      if (data) setAnnouncements(data);
      if (error) console.warn('Announcements fetch error:', error.message);
    };
    
    fetchAnnouncements();
    
    const subscription = supabase.channel('teacher_announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchAnnouncements)
      .subscribe();
      
    return () => { supabase.removeChannel(subscription); };
  }, []);

  return (
    <div className="view-container animate-fade-in" style={{ height: 'calc(100vh - 145px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="view-header flex-between" style={{ flexWrap: 'wrap', gap: '20px', marginBottom: '16px', flexShrink: 0 }}>
        <div>
          <h1>Inbox & Announcements</h1>
          <p>Manage your communications and stay up to date.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '30px', padding: '5px' }}>
            <button 
              onClick={() => setActiveTab('students')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 20px', borderRadius: '25px', border: 'none',
                background: activeTab === 'students' ? 'var(--accent-cyan)' : 'transparent',
                color: activeTab === 'students' ? '#000' : 'var(--text-secondary)',
                cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s', position: 'relative'
              }}
            >
              <Users size={16} /> Students
              {unreadCounts.students > 0 && (
                <span style={{ background: '#FF6B6B', color: '#fff', position: 'absolute', top: '-5px', right: '-5px', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unreadCounts.students}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('classes')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 20px', borderRadius: '25px', border: 'none',
                background: activeTab === 'classes' ? '#FFB020' : 'transparent',
                color: activeTab === 'classes' ? '#000' : 'var(--text-secondary)',
                cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s'
              }}
            >
              <BookOpen size={16} /> Classes
            </button>
            <button 
              onClick={() => setActiveTab('groups')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 20px', borderRadius: '25px', border: 'none',
                background: activeTab === 'groups' ? '#0EA5E9' : 'transparent',
                color: activeTab === 'groups' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s', position: 'relative'
              }}
            >
              <Users size={16} /> Groups
              {unreadCounts.groups > 0 && (
                <span style={{ background: '#FF6B6B', color: '#fff', position: 'absolute', top: '-5px', right: '-5px', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unreadCounts.groups}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('staff')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 20px', borderRadius: '25px', border: 'none',
                background: activeTab === 'staff' ? 'var(--accent-purple)' : 'transparent',
                color: activeTab === 'staff' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s', position: 'relative'
              }}
            >
              <Shield size={16} /> Staff
              {unreadCounts.staff > 0 && (
                <span style={{ background: '#FF6B6B', color: '#fff', position: 'absolute', top: '-5px', right: '-5px', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unreadCounts.staff}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('announcements')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 20px', borderRadius: '25px', border: 'none',
                background: activeTab === 'announcements' ? 'var(--accent-blue)' : 'transparent',
                color: activeTab === 'announcements' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s', position: 'relative'
              }}
            >
              <Megaphone size={16} /> Updates
              {announcements.filter(a => {
                const time = new Date(a.createdAt).getTime();
                return time > lastViewedAnnouncements && (Date.now() - time < 24 * 60 * 60 * 1000);
              }).length > 0 && (
                <span style={{ background: '#FF6B6B', color: '#fff', position: 'absolute', top: '-5px', right: '-5px', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {announcements.filter(a => {
                    const time = new Date(a.createdAt).getTime();
                    return time > lastViewedAnnouncements && (Date.now() - time < 24 * 60 * 60 * 1000);
                  }).length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <Card style={{ padding: '0', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {activeTab === 'announcements' ? (
          <div style={{ padding: '30px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, marginBottom: '10px' }}>Global Announcements</h3>
            {announcements.length > 0 ? announcements.map(ann => (
              <div key={ann.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', padding: '20px', borderRadius: '12px', borderLeft: '4px solid var(--accent-purple)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h4 style={{ color: '#fff', margin: 0 }}>{ann.title}</h4>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Just now'}
                  </span>
                </div>
                <p style={{ color: '#f1f5f9', margin: 0, fontSize: '14px', lineHeight: '1.5', fontWeight: '500' }}>
                  {ann.text || ann.content || ann.message || 'Platform announcement.'}
                </p>
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#c084fc', fontWeight: '600' }}>
                  Posted by: {ann.author || ann.author_name || 'SuperAdmin'}
                </div>
              </div>
            )) : (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>No announcements yet.</div>
            )}
          </div>
        ) : activeTab === 'classes' ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--panel-border)', display: 'flex', gap: '10px', overflowX: 'auto', background: 'rgba(0,0,0,0.2)' }}>
              {classesList.map(cls => (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(cls)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    background: selectedClass === cls ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)',
                    color: selectedClass === cls ? '#000' : '#fff',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.3s'
                  }}
                >
                  {cls}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {selectedClass ? (
                <ChatInterface 
                  currentUser={currentUser} 
                  activeTab="class_view" 
                  selectedClass={selectedClass}
                  isManager={true}
                  onUnreadCountChange={handleUnreadCountChange}
                />
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={48} style={{ opacity: 0.2, marginBottom: '15px' }} />
                  <h3 style={{ color: '#fff', marginBottom: '10px' }}>Select a class</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>Choose a class from the list above to view its students.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <ChatInterface 
            currentUser={currentUser} 
            activeTab={activeTab}
            selectedClass={selectedClass}
            isManager={true}
            onUnreadCountChange={handleUnreadCountChange} 
          />
        )}
      </Card>
    </div>
  );
}
