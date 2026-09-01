import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, CheckSquare, MessageSquare, Users, BarChart2, Video, Database, Settings as SettingsIcon, Bell, Camera, Tv, Sparkles } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import ProfilePhotoModal from './ProfilePhotoModal';
import './Sidebar.css';

export default function Sidebar({ isOpen = false, closeMenu = () => {} }) {
  const { profileImage, profileName, profileDesignation, schoolLogo, schoolName, primaryColor } = useTheme();
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const unreadCount = useUnreadMessages();
  const unreadNotifs = useUnreadNotifications();

  const fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profileName || 'Teacher')}&backgroundColor=b6e3f4`;

  return (
    <aside className={`portal-sidebar ${isOpen ? 'mobile-open' : ''}`}>
      <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: `1.5px solid ${primaryColor || 'var(--brand-primary, #00F0FF)'}`,
          boxShadow: `0 0 12px var(--brand-glow, rgba(0, 240, 255, 0.3))`,
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          padding: '4px'
        }}>
          {schoolLogo ? (
            <img src={schoolLogo} alt="School Logo" style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
          ) : (
            <span style={{ fontSize: '1.3rem' }}>👨‍🏫</span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, justifyContent: 'center' }}>
          <span 
            className="brand-title" 
            title={schoolName || 'Teacher Portal'}
            style={{ 
              fontSize: '0.78rem', 
              fontWeight: '800', 
              color: '#fff', 
              lineHeight: '1.25',
              whiteSpace: 'normal',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
              letterSpacing: '-0.2px'
            }}
          >
            {schoolName || 'Teacher Portal'}
          </span>
          <span style={{ fontSize: '0.68rem', color: primaryColor || 'var(--brand-primary, #00F0FF)', fontWeight: '700', letterSpacing: '0.5px', marginTop: '2px' }}>
            FACULTY PORTAL
          </span>
        </div>
      </div>

      <div className="profile-section">
        <div 
          className="avatar-wrapper"
          onClick={() => setShowPhotoModal(true)}
          style={{ cursor: 'pointer', position: 'relative' }}
          title="Click to customize avatar or upload photo"
        >
          <img 
            src={profileImage || fallbackAvatar} 
            alt={profileName || 'Teacher'} 
            className="avatar"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallbackAvatar; }} 
          />
          <span className="status-dot" style={{ backgroundColor: '#10B981' }}></span>
        </div>
        <h3 className="profile-name" style={{ cursor: 'pointer' }} onClick={() => setShowPhotoModal(true)}>{profileName || 'Teacher'}</h3>
        <p className="profile-role">{profileDesignation || 'Faculty / Teacher'}</p>
        <button
          onClick={() => setShowPhotoModal(true)}
          style={{
            marginTop: '8px',
            background: 'var(--brand-glow, rgba(0, 240, 255, 0.1))',
            border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.3))',
            color: 'var(--brand-primary, #00F0FF)',
            borderRadius: '8px',
            padding: '4px 10px',
            fontSize: '0.75rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <Camera size={12} />
          <span>Edit Avatar</span>
        </button>
      </div>

      <ProfilePhotoModal isOpen={showPhotoModal} onClose={() => setShowPhotoModal(false)} />

      <nav className="sidebar-nav">
        <NavLink to="/" onClick={closeMenu} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} end>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/smartboard" onClick={closeMenu} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Tv size={20} />
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-6px',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--brand-primary, #00F0FF)',
              boxShadow: '0 0 8px #00F0FF'
            }} />
          </div>
          <span>Smartboard / Study Island</span>
        </NavLink>
        <NavLink to="/timetable" onClick={closeMenu} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <Calendar size={20} />
          <span>Time Table</span>
        </NavLink>
        <NavLink to="/todo" onClick={closeMenu} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <CheckSquare size={20} />
          <span>To Do List</span>
        </NavLink>
        <NavLink to="/inbox" onClick={closeMenu} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <MessageSquare size={20} />
            {unreadCount > 0 && (
              <span className="badge" style={{ background: '#FF6B6B', color: '#fff', position: 'absolute', top: '-6px', right: '-8px', fontSize: '10px', padding: '1px 5px', borderRadius: '10px' }}>
                {unreadCount}
              </span>
            )}
          </div>
          <span>Inbox</span>
        </NavLink>
        <NavLink to="/classes" onClick={closeMenu} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <Users size={20} />
          <span>Assigned Classes</span>
        </NavLink>
        <NavLink to="/analytics" onClick={closeMenu} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <BarChart2 size={20} />
          <span>Analytics</span>
        </NavLink>
        <NavLink to="/liveclass" onClick={closeMenu} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <Video size={20} />
          <span>Online Class/Tests</span>
        </NavLink>
        <NavLink to="/question-bank" onClick={closeMenu} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <Database size={20} />
          <span>Question Bank</span>
        </NavLink>
        <NavLink to="/settings" onClick={closeMenu} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <SettingsIcon size={20} />
          <span>Settings</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer" style={{ marginTop: 'auto', paddingTop: '16px' }}>
        <NavLink to="/notifications" onClick={closeMenu} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Bell size={20} />
            {unreadNotifs > 0 && (
              <span className="badge" style={{ background: '#FF6B6B', color: '#fff', position: 'absolute', top: '-6px', right: '-8px', fontSize: '10px', padding: '1px 5px', borderRadius: '10px' }}>
                {unreadNotifs}
              </span>
            )}
          </div>
          <span>Notifications</span>
        </NavLink>
      </div>
    </aside>
  );
}
