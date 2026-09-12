import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

const Dashboard = lazy(() => import('./views/Dashboard'));
const Events = lazy(() => import('./views/Events'));
const TimeTable = lazy(() => import('./views/TimeTable'));
const Teachers = lazy(() => import('./views/Teachers'));
const Classes = lazy(() => import('./views/Classes'));
const Communications = lazy(() => import('./views/Communications'));
const Analytics = lazy(() => import('./views/Analytics'));
const Settings = lazy(() => import('./views/Settings'));
const Notifications = lazy(() => import('./views/Notifications'));
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
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    const verifySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
          setUser(null);
          localStorage.removeItem('edtech_admin_user');
          localStorage.removeItem('edtech_user');
          setLoadingSession(false);
          return;
        }

        const userEmail = session.user.email?.toLowerCase();

        // Check profiles table for user role
        let dbRole = null;
        let dbName = null;
        let dbAvatar = null;

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, auth_id, email, name, role, avatar_url, department, age, timetable, is_archived')
            .eq('email', userEmail)
            .maybeSingle();

          if (profile) {
            dbRole = profile.role;
            dbName = profile.name;
            dbAvatar = profile.avatar_url;
          }
        } catch {
          /* ignore error */
        }

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
          } catch {
            /* ignore error */
          }
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
      } catch (err) {
        console.error('Session verify error:', err);
        setUser(null);
      } finally {
        setLoadingSession(false);
      }
    };

    verifySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        localStorage.removeItem('edtech_admin_user');
        localStorage.removeItem('edtech_user');
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
            <a
              href={loginUrl}
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px 28px',
                background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                color: '#000',
                textDecoration: 'none',
                borderRadius: '12px',
                fontWeight: '800',
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 0 25px var(--brand-glow, rgba(0, 240, 255, 0.4))',
                transition: 'all 0.2s ease'
              }}
            >
              ⚡ Return to Universal Login
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
              <Suspense fallback={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--brand-primary, #00F0FF)', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '1.1rem', fontWeight: 600 }}>
                  <span style={{ display: 'inline-block', marginRight: '10px' }}>⚡</span> Loading administration console...
                </div>
              }>
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
              </Suspense>
            </Layout>
          </BrowserRouter>
        </PresenceProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
