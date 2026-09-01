import React, { useState, useEffect } from 'react';
import { Megaphone, MessageSquare, PlusCircle, CheckCircle, Send, Trash2, Calendar, Radio } from 'lucide-react';
import { supabase } from '../supabase';
import ChatInterface from '../components/ChatInterface';
import './Communications.css';

export default function Communications() {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'announcements'
  const [currentUser, setCurrentUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({ chat: 0 });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userParam = params.get('user');
    if (userParam) {
      localStorage.setItem('edtech_user', userParam);
      setCurrentUser(JSON.parse(userParam));
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      const userStr = localStorage.getItem('edtech_user');
      if (userStr) {
        try {
          setCurrentUser(JSON.parse(userStr));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  // Announcement state
  const [announcements, setAnnouncements] = useState([]);
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceText, setAnnounceText] = useState('');
  const [announceCategory, setAnnounceCategory] = useState('Academic');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Fetch Announcements
  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('createdAt', { ascending: false });
    if (data) setAnnouncements(data);
  };

  useEffect(() => {
    fetchAnnouncements();

    const subscription = supabase.channel('announcements_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchAnnouncements)
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!announceTitle.trim() || !announceText.trim()) {
      alert("Please enter a title and message.");
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      // Bug 9 fix: announceCategory is now included in the insert payload
      const { error } = await supabase.from('announcements').insert({
        title: announceTitle.trim(),
        text: announceText.trim(),
        author: currentUser?.name || "School Administration",
        category: announceCategory,
      });
      if (error) throw error;

      setAnnounceTitle('');
      setAnnounceText('');
      setAnnounceCategory('Academic');
      setFeedback("Announcement broadcasted successfully to all students & faculty!");
      fetchAnnouncements();
      setTimeout(() => setFeedback(null), 4000);
    } catch (error) {
      console.error("Error posting announcement:", error);
      alert("Failed to post announcement: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm("Are you sure you want to delete this broadcast notice?")) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert("Could not delete announcement: " + err.message);
    }
  };

  // Bug 12 fix: when switching to 'chat' tab, clear the unread badge
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // If switching away from chat, no action needed.
    // If switching TO chat from somewhere else, the ChatInterface itself will mark messages read.
    // The badge is already driven by onUnreadCountChange from ChatInterface — no artificial reset needed.
  };

  return (
    <div className="comm-container">
      {/* Header with Styled Tab Pills */}
      <div className="comm-header">
        <div>
          <h2 className="comm-title">Communications Hub</h2>
          <p className="comm-subtitle">Direct multi-user messaging, class channels, and global broadcasts.</p>
        </div>

        <div className="comm-tab-pill-group">
          <button
            type="button"
            className={`comm-tab-pill ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => handleTabChange('chat')}
          >
            <MessageSquare size={16} />
            <span>Live Chat</span>
            {/* Bug 12 fix: only show badge when NOT on the chat tab (if on chat, ChatInterface handles reads) */}
            {unreadCounts.chat > 0 && activeTab !== 'chat' && (
              <span className="comm-unread-bubble">
                {unreadCounts.chat}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`comm-tab-pill ${activeTab === 'announcements' ? 'active' : ''}`}
            onClick={() => handleTabChange('announcements')}
          >
            <Megaphone size={16} />
            <span>Broadcasts ({announcements.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="comm-main-panel">
        {activeTab === 'announcements' ? (
          <div className="announcements-grid">
            {/* Left Column: Recent Announcements */}
            <div className="announcements-list-col">
              <div className="announcements-section-title">
                <h3>
                  <Radio size={18} color="var(--brand-primary, #00F0FF)" />
                  Live Announcement Feed
                </h3>
                <span className="announcements-badge">{announcements.length} Published</span>
              </div>

              {announcements.length > 0 ? (
                announcements.map((ann) => (
                  <div key={ann.id} className="announcement-card">
                    <div className="announcement-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 className="announcement-card-title">{ann.title}</h4>
                        {/* Bug 15 link: category now shown as a badge (once category field is populated) */}
                        {ann.category && (
                          <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,229,255,0.15)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>
                            {ann.category}
                          </span>
                        )}
                      </div>
                      <span className="announcement-card-date">
                        {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent'}
                      </span>
                    </div>
                    <p className="announcement-card-body">{ann.text}</p>
                    <div className="announcement-card-footer">
                      <div className="announcement-author-tag">
                        <img
                          src={`https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(ann.author || 'Admin')}&backgroundColor=transparent`}
                          alt="avatar"
                        />
                        <span>Posted by <strong>{ann.author || 'Administration'}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', opacity: 0.7, padding: '4px' }}
                        title="Delete Broadcast"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-secondary)', padding: '40px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                  No institutional announcements posted yet. Broadcast one using the form on the right!
                </div>
              )}
            </div>

            {/* Right Column: Broadcast Form */}
            <div>
              <div className="broadcast-form-card">
                <h3>
                  <PlusCircle size={18} color="var(--brand-primary, #00F0FF)" />
                  Broadcast New Notice
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                  Publish an institutional announcement visible instantly across Student, Teacher, and Admin portals.
                </p>

                {feedback && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34D399', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle size={16} /> {feedback}
                  </div>
                )}

                <form onSubmit={handlePostAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="broadcast-field">
                    <label>Notice Title</label>
                    <input
                      type="text"
                      value={announceTitle}
                      onChange={e => setAnnounceTitle(e.target.value)}
                      placeholder="e.g. Science Fair Registration Open"
                      required
                    />
                  </div>

                  <div className="broadcast-field">
                    <label>Category Tag</label>
                    <select
                      value={announceCategory}
                      onChange={e => setAnnounceCategory(e.target.value)}
                    >
                      <option value="Academic">Academic</option>
                      <option value="Examinations">Examinations</option>
                      <option value="Events">Campus Events</option>
                      <option value="Administrative">Administrative</option>
                      <option value="Urgent">Urgent Notice</option>
                    </select>
                  </div>

                  <div className="broadcast-field">
                    <label>Notice Content</label>
                    <textarea
                      value={announceText}
                      onChange={e => setAnnounceText(e.target.value)}
                      rows={5}
                      placeholder="Enter detailed notice message for all school members..."
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="broadcast-submit-btn"
                    disabled={submitting}
                  >
                    <Send size={16} />
                    <span>{submitting ? 'Broadcasting...' : 'Publish Broadcast Notice'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <ChatInterface
            currentUser={currentUser}
            activeTab={activeTab}
            isManager={true}
            onUnreadCountChange={setUnreadCounts}
          />
        )}
      </div>
    </div>
  );
}
