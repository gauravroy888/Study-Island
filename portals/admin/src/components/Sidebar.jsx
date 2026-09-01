import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, Clock, Users, BookOpen, MessageSquare, BarChart2, Settings as SettingsIcon, Bell, Camera, Edit2 } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import ProfilePhotoModal from './ProfilePhotoModal';
import './Sidebar.css';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'events', label: 'Events', icon: Calendar, path: '/events' },
  { id: 'timetable', label: 'Time Table', icon: Clock, path: '/timetable' },
  { id: 'teachers', label: 'Teachers', icon: Users, path: '/teachers' },
  { id: 'classes', label: 'Classes', icon: BookOpen, path: '/classes' },
  { id: 'communications', label: 'Communications', icon: MessageSquare, path: '/communications' },
  { id: 'analytics', label: 'Analytics', icon: BarChart2, path: '/analytics' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, path: '/settings' }
];

export default function Sidebar() {
  const { profileImage, profileName, profileDesignation, schoolLogo, schoolName, primaryColor } = useTheme();
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profileName || 'Admin')}&backgroundColor=b6e3f4`;

  return (
    <aside className="portal-sidebar">
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
            <span style={{ fontSize: '1.3rem' }}>🏛️</span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, justifyContent: 'center' }}>
          <span 
            className="brand-title" 
            title={schoolName || 'Admin Portal'}
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
            {schoolName || 'Admin Portal'}
          </span>
          <span style={{ fontSize: '0.68rem', color: primaryColor || 'var(--brand-primary, #00F0FF)', fontWeight: '700', letterSpacing: '0.5px', marginTop: '2px' }}>
            OPERATIONAL DECK
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
            alt={profileName || 'Admin Profile'} 
            className="avatar"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = fallbackAvatar;
            }}
          />
          <span className="status-dot"></span>
        </div>
        <h3 className="profile-name" style={{ cursor: 'pointer' }} onClick={() => setShowPhotoModal(true)}>{profileName || 'Administrator'}</h3>
        <p className="profile-role">{profileDesignation || 'Immersion Labs Admin'}</p>
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
      
      <nav className="nav-menu">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink 
              key={item.id} 
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} className="nav-icon" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      
      <div className="sidebar-footer">
        <NavLink 
          to="/notifications" 
          className={({ isActive }) => `nav-link notification-btn ${isActive ? 'active' : ''}`}
        >
          <Bell size={20} className="nav-icon" />
          <span>Notifications</span>
        </NavLink>
      </div>
    </aside>
  );
}

