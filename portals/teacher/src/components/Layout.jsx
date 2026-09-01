import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import './Layout.css';
import Sidebar from './Sidebar';
import GlobalBroadcastBanner from './GlobalBroadcastBanner';
import { useTheme } from '../ThemeContext';

import FullscreenButton from './FullscreenButton';

export default function Layout({ children }) {
  const { backgroundImage, profileName, schoolName, primaryColor } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="app-container">
      <div className="bg-overlay" style={{ backgroundImage: `url(${backgroundImage})` }}></div>
      <div className="bg-gradient"></div>
      
      {/* Mobile overlay backdrop */}
      {isMobileMenuOpen && (
        <div className="mobile-backdrop" onClick={toggleMobileMenu}></div>
      )}

      <Sidebar isOpen={isMobileMenuOpen} closeMenu={() => setIsMobileMenuOpen(false)} />
      
      <main className="main-content">
        <header className="top-header">
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button className="mobile-menu-btn icon-btn" onClick={toggleMobileMenu}>
              <Menu size={24} />
            </button>
            <div className="header-brand">
              <h2 style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>{schoolName || 'TEACHER PORTAL'}</h2>
              <p>Faculty Deck • Welcome back, {(profileName || 'Teacher').split(' ')[0]}!</p>
            </div>
          </div>
          <div className="header-actions">
            <FullscreenButton />
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
