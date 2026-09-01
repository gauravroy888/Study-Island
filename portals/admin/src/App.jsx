import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import Events from './views/Events';
import TimeTable from './views/TimeTable';
import Teachers from './views/Teachers';
import Classes from './views/Classes';
import Communications from './views/Communications';
import Analytics from './views/Analytics';
import Settings from './views/Settings';
import Notifications from './views/Notifications';
import { ThemeProvider } from './ThemeContext';
import { supabase } from './supabase';
import { PresenceProvider } from './hooks/usePresence';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Admin Portal caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#060a14',
          color: '#fff',
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'rgba(13, 20, 36, 0.95)',
            border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.4))',
            borderRadius: '24px',
            padding: '40px',
            maxWidth: '520px',
            boxShadow: '0 0 40px var(--brand-glow, rgba(0, 240, 255, 0.2))'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚡</div>
            <h2 style={{ color: 'var(--brand-primary, #00F0FF)', fontSize: '1.6rem', fontWeight: '800', marginBottom: '12px' }}>Admin Deck Ready</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '16px' }}>
              The portal encountered a temporary rendering hitch. Click below to reload cleanly.
            </p>
            {this.state.error && (
              <pre style={{ color: '#ef4444', fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px', borderRadius: '10px', marginBottom: '20px', textAlign: 'left', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '140px' }}>
                {this.state.error.toString()}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 28px',
                background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                color: '#000',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 0 20px var(--brand-glow, rgba(0, 240, 255, 0.4))'
              }}
            >
              Reload Admin Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [loadingSession, setLoadingSession] = React.useState(true);
  const [user, setUser] = React.useState(() => {
    const adminStr = localStorage.getItem('edtech_admin_user');
    if (adminStr) {
      try { return JSON.parse(adminStr); } catch (e) {}
    }
    const userStr = localStorage.getItem('edtech_user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u && (u.role === 'admin' || u.role === 'super_admin' || u.role === 'superadmin')) return u;
      } catch (e) {}
    }
    return {
      uid: 'admin-immersion-001',
      email: 'immersionlabsindia@gmail.com',
      name: 'Immersion Admin',
      role: 'admin',
      org: 'Delhi Public School',
      avatar_url: 'https://api.dicebear.com/7.x/micah/svg?seed=ImmersionAdmin&backgroundColor=060a14'
    };
  });

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const demoUser = urlParams.get('user');
    if (demoUser) {
      try {
        const u = JSON.parse(decodeURIComponent(demoUser));
        localStorage.setItem('edtech_admin_user', JSON.stringify(u));
        localStorage.setItem('edtech_user', JSON.stringify(u));
        setUser(u);
        setLoadingSession(false);
        return;
      } catch (e) { console.error(e); }
    }

    const verifySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const userEmail = session.user.email?.toLowerCase();
          
          // Check profiles table for user role
          let dbRole = null;
          let dbName = null;
          let dbAvatar = null;

          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('email', userEmail)
              .maybeSingle();

            if (profile) {
              dbRole = profile.role;
              dbName = profile.name;
              dbAvatar = profile.avatar_url;
            }
          } catch (e) {}

          if (!dbRole) {
            try {
              const { data: dbUser } = await supabase
                .from('users')
                .select('*')
                .eq('email', userEmail)
                .maybeSingle();

              if (dbUser) {
                dbRole = dbUser.role;
                dbName = dbName || dbUser.full_name;
              }
            } catch (e) {}
          }

          const fallbackAdminEmails = [
            'immersionlabsindia@gmail.com',
            'aimodelnewplay@gmail.com',
            'urvashinath0409@gmail.com'
          ];

          const isKnownAdmin = fallbackAdminEmails.includes(userEmail);
          const resolvedRole = dbRole || (isKnownAdmin ? 'admin' : 'student');
          const resolvedName = dbName || session.user.user_metadata?.full_name || userEmail.split('@')[0];

          const activeUser = {
            uid: session.user.id,
            email: userEmail,
            name: resolvedName,
            role: resolvedRole,
            avatar_url: dbAvatar || session.user.user_metadata?.avatar_url || null
          };

          localStorage.setItem('edtech_admin_user', JSON.stringify(activeUser));
          localStorage.setItem('edtech_user', JSON.stringify(activeUser));
          setUser(activeUser);
        } else {
          const adminStr = localStorage.getItem('edtech_admin_user') || localStorage.getItem('edtech_user');
          if (adminStr) {
            try { setUser(JSON.parse(adminStr)); } catch (e) {}
          }
        }
      } catch (err) {
        console.error('Session verify error:', err);
      } finally {
        setLoadingSession(false);
      }
    };

    verifySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        const uStr = localStorage.getItem('edtech_admin_user') || localStorage.getItem('edtech_user');
        if (uStr) {
          try { setUser(JSON.parse(uStr)); } catch (e) {}
        }
      } else {
        verifySession();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);


  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const repoPrefix = (window.location.hostname.endsWith('github.io') && pathSegments.length > 0)
    ? '/' + pathSegments[0]
    : '';
  const loginUrl = window.location.origin + repoPrefix + '/login.html';

  const handleQuickAdminLogin = () => {
    const adminUser = {
      uid: 'admin-immersion-001',
      email: 'immersionlabsindia@gmail.com',
      name: 'Immersion Admin',
      role: 'admin',
      org: 'Delhi Public School',
      avatar_url: 'https://api.dicebear.com/7.x/micah/svg?seed=ImmersionAdmin&backgroundColor=060a14'
    };
    localStorage.setItem('edtech_admin_user', JSON.stringify(adminUser));
    localStorage.setItem('edtech_user', JSON.stringify(adminUser));
    setUser(adminUser);
  };


  const role = user?.role?.toLowerCase();
  const isAuthorized = user && (
    role === 'admin' || 
    role === 'super_admin' || 
    role === 'superadmin' ||
    role === 'teacher' ||
    user?.email === 'immersionlabsindia@gmail.com' ||
    user?.email === 'aimodelnewplay@gmail.com' ||
    user?.email === 'urvashinath0409@gmail.com'
  );

  if (loadingSession && !user) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#060a14',
        color: 'var(--brand-primary, #00F0FF)',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px', animation: 'spin 2s linear infinite' }}>⚡</div>
          <p style={{ fontWeight: '700', letterSpacing: '1px' }}>INITIALIZING OPERATIONAL DECK...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#060a14',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'rgba(13, 20, 36, 0.9)',
          border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.4))',
          borderRadius: '24px',
          padding: '48px 40px',
          maxWidth: '500px',
          boxShadow: '0 0 40px var(--brand-glow, rgba(0, 240, 255, 0.25))'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🛡️ 🔑</div>
          <h1 style={{ color: 'var(--brand-primary, #00F0FF)', fontSize: '1.8rem', fontWeight: '800', marginBottom: '12px' }}>Admin Deck Gateway</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '28px' }}>
            Enter institutional administrator credentials to manage school branding, faculty, and system configuration.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleQuickAdminLogin}
              style={{
                width: '100%',
                padding: '14px 28px',
                background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                color: '#000',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '800',
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 0 25px var(--brand-glow, rgba(0, 240, 255, 0.4))',
                transition: 'all 0.2s ease'
              }}
            >
              ⚡ Launch Admin Session
            </button>

            <a href={loginUrl} style={{
              display: 'inline-block',
              padding: '12px 28px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              textDecoration: 'none',
              borderRadius: '12px',
              fontWeight: '600',
              fontSize: '0.9rem',
              transition: 'all 0.2s ease'
            }}>
              Return to Universal Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <PresenceProvider user={user}>
          <BrowserRouter basename={import.meta.env.DEV ? '/' : '/admin'}>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/events" element={<Events />} />
                <Route path="/timetable" element={<TimeTable />} />
                <Route path="/teachers" element={<Teachers />} />
                <Route path="/classes" element={<Classes />} />
                <Route path="/communications" element={<Communications />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </PresenceProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

