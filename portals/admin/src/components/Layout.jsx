import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import GlobalBroadcastBanner from './GlobalBroadcastBanner';
import { useTheme } from '../ThemeContext';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import './Layout.css';

const PAGE_TITLES = {
  '/': 'Admin Dashboard',
  '/events': 'School Events & Calendar',
  '/timetable': 'Master Institutional Timetable',
  '/teachers': 'Faculty & Staff Directory',
  '/classes': 'Class & Section Management',
  '/communications': 'Communications Hub',
  '/analytics': 'Institutional Performance Analytics',
  '/settings': 'System & Institution Settings',
  '/notifications': 'Notification Center'
};

import FullscreenButton from './FullscreenButton';

export default function Layout({ children }) {
  const { backgroundImage, profileName, profileDesignation, schoolName, primaryColor } = useTheme();
  const location = useLocation();
  const currentTitle = PAGE_TITLES[location.pathname] || 'Admin Portal';

  return (
    <div className="app-container">
      <div className="bg-overlay" style={{ backgroundImage: `url(${backgroundImage})` }}></div>
      <div className="bg-gradient"></div>
      
      <Sidebar />
      
      <main className="main-content">
        <header className="top-header">
          <div className="header-brand">
            <h2>{currentTitle}</h2>
            <p className="header-sub">{schoolName || 'Institution'} • {profileDesignation}</p>
          </div>

          <div className="header-right-actions">
            <FullscreenButton />
            
            <a 
              href="/study-island/" 
              target="_blank" 
              rel="noreferrer"
              className="study-island-link"
              title="Launch 3D Study Island Simulator"
            >
              <span>🏝️ Study Island 3D</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </header>
        
        <div className="page-content">
          <GlobalBroadcastBanner />
          {children}
        </div>
      </main>
    </div>
  );
}

