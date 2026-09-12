import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

const Dashboard = lazy(() => import('./views/Dashboard'));
const Courses = lazy(() => import('./views/Courses'));
const Timetable = lazy(() => import('./views/Timetable'));
const LiveClass = lazy(() => import('./views/LiveClass'));
const Chats = lazy(() => import('./views/Chats'));
const Mentors = lazy(() => import('./views/Mentors'));
const Progress = lazy(() => import('./views/Progress'));
const Notifications = lazy(() => import('./views/Notifications'));
const Settings = lazy(() => import('./views/Settings'));
import { ThemeProvider } from './ThemeContext';
import { supabase } from './supabase';
import { PresenceProvider } from './hooks/usePresence';
import { loadSupabaseSession } from './hooks/useAriaSession';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Student Portal caught error:', error, errorInfo);
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
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚀</div>
            <h2 style={{ color: 'var(--brand-primary, #00F0FF)', fontSize: '1.6rem', fontWeight: '800', marginBottom: '12px' }}>Student Hub Ready</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '16px' }}>
              The portal encountered a temporary rendering hitch. Click below to reload cleanly.
            </p>
            {this.state.error && (
              <pre style={{ color: '#ef4444', fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px', borderRadius: '10px', marginBottom: '20px', textAlign: 'left', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '200px' }}>
                {this.state.error?.stack || this.state.error.toString()}
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
              Reload Student Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    loadSupabaseSession();
  }, []);

  React.useEffect(() => {
    const verifySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
          setUser(null);
          localStorage.removeItem('edtech_student_user');
          localStorage.removeItem('edtech_user');
          return;
        }

        const userEmail = session.user.email?.toLowerCase();
        
        let verifiedRole = null;
        let verifiedName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0];
        let verifiedAvatar = session.user.user_metadata?.avatar_url;

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, auth_id, email, name, role, avatar_url, department, age, timetable, is_archived')
            .eq('email', userEmail)
            .maybeSingle();

          if (profile) {
            verifiedRole = profile.role;
            if (profile.name) verifiedName = profile.name;
            if (profile.avatar_url) verifiedAvatar = profile.avatar_url;
          }
        } catch { /* ignore profile load error */ }

        if (userEmail === 'urvashinath0409@gmail.com') {
          verifiedRole = 'super_admin';
        }

        const verifiedUser = {
          uid: session.user.id,
          email: userEmail,
          name: verifiedName,
          role: verifiedRole || 'student',
          avatar_url: verifiedAvatar
        };

        localStorage.setItem('edtech_student_user', JSON.stringify(verifiedUser));
        localStorage.setItem('edtech_user', JSON.stringify(verifiedUser));
        setUser(verifiedUser);
      } catch (err) {
        console.error('Student session verification error:', err);
        setUser(null);
      }
    };

    verifySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        localStorage.removeItem('edtech_student_user');
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
    role === 'student' || 
    role === 'admin' || 
    role === 'super_admin' || 
    role === 'superadmin' ||
    role === 'teacher'
  );

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
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎓 🚀</div>
          <h1 style={{ color: 'var(--brand-primary, #00F0FF)', fontSize: '1.8rem', fontWeight: '800', marginBottom: '12px' }}>Student Portal Gateway</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '28px' }}>
            Access 3D STEM courses, interactive simulations, assignments, and real-time faculty messaging.
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
                textAlign: 'center',
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
          <BrowserRouter basename={import.meta.env.DEV ? '/' : '/student'}>
            <Layout>
              <Suspense fallback={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--brand-primary, #00F0FF)', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '1.1rem', fontWeight: 600 }}>
                  <span style={{ display: 'inline-block', marginRight: '10px' }}>⚡</span> Loading workspace...
                </div>
              }>
                <Routes>
                  <Route path="/" element={<Navigate to="/courses" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/courses" element={<Courses />} />
                  <Route path="/timetable" element={<Timetable />} />
                  <Route path="/liveclass" element={<LiveClass />} />
                  <Route path="/chats" element={<Chats />} />
                  <Route path="/mentors" element={<Mentors />} />
                  <Route path="/progress" element={<Progress />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/courses" replace />} />
                </Routes>
              </Suspense>
            </Layout>
          </BrowserRouter>
        </PresenceProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
