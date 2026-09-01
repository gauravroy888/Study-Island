import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import Courses from './views/Courses';
import Timetable from './views/Timetable';
import LiveClass from './views/LiveClass';
import Chats from './views/Chats';
import Mentors from './views/Mentors';
import Progress from './views/Progress';
import Notifications from './views/Notifications';
import Settings from './views/Settings';
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
  const [user, setUser] = React.useState(() => {
    const studentStr = localStorage.getItem('edtech_student_user');
    if (studentStr) {
      try { return JSON.parse(studentStr); } catch (e) {}
    }
    const userStr = localStorage.getItem('edtech_user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u && (u.role === 'student' || !u.role)) return u;
      } catch (e) {}
    }
    return {
      uid: 'student-arav-001',
      email: 'arav.sharma@dps.edu.in',
      name: 'Arav Sharma',
      role: 'student',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AravSharma&backgroundColor=b6e3f4'
    };
  });

  // Share Gemini key with other platform pages (Study Island, etc.) via localStorage
  React.useEffect(() => {
    const k = localStorage.getItem('aria_gemini_key') || (typeof window !== 'undefined' ? window.ARIA_GEMINI_KEY : '');
    if (k && !localStorage.getItem('aria_gemini_key')) localStorage.setItem('aria_gemini_key', k);
    loadSupabaseSession();
  }, []);

  React.useEffect(() => {
    const verifySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
          const uStr = localStorage.getItem('edtech_student_user') || localStorage.getItem('edtech_user');
          if (uStr) {
            try {
              const u = JSON.parse(uStr);
              if (u) {
                setUser(u);
                return;
              }
            } catch (e) {}
          }
          return;
        }

        const userEmail = session.user.email?.toLowerCase();
        
        let verifiedRole = null;
        let verifiedName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0];
        let verifiedAvatar = session.user.user_metadata?.avatar_url;

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', userEmail)
            .maybeSingle();

          if (profile) {
            verifiedRole = profile.role;
            if (profile.name) verifiedName = profile.name;
            if (profile.avatar_url) verifiedAvatar = profile.avatar_url;
          }
        } catch (e) {}

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
      }
    };

    verifySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        const uStr = localStorage.getItem('edtech_student_user') || localStorage.getItem('edtech_user');
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

  const handleQuickStudentLogin = () => {
    const studentUser = {
      uid: 'std-arav-001',
      email: 'arav.sharma@dps.edu.in',
      name: 'Arav Sharma',
      role: 'student',
      org: 'Delhi Public School',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AravSharma&backgroundColor=b6e3f4'
    };
    localStorage.setItem('edtech_user', JSON.stringify(studentUser));
    setUser(studentUser);
  };

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
            <button
              onClick={handleQuickStudentLogin}
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
              ⚡ Launch Student Session (Arav Sharma)
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
          <BrowserRouter basename={import.meta.env.DEV ? '/' : '/student'}>
            <Layout>
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
            </Layout>
          </BrowserRouter>
        </PresenceProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
