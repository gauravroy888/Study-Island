import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import TimeTable from './views/TimeTable';
import ToDoList from './views/ToDoList';
import Inbox from './views/Inbox';
import Classes from './views/Classes';
import Analytics from './views/Analytics';
import LiveClass from './views/LiveClass';
import Settings from './views/Settings';
import Notifications from './views/Notifications';
import QuestionBank from './views/QuestionBank';
import SmartboardTeaching from './views/SmartboardTeaching';
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
    console.error('Teacher Portal caught error:', error, errorInfo);
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
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👩‍🏫 ⚡</div>
            <h2 style={{ color: 'var(--brand-primary, #00F0FF)', fontSize: '1.6rem', fontWeight: '800', marginBottom: '12px' }}>Teacher Portal Ready</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '24px' }}>
              Click below to reload the faculty dashboard cleanly.
            </p>
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
              Reload Teacher Portal
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
    const verifySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
          setUser(null);
          localStorage.removeItem('edtech_teacher_user');
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
        } catch { /* ignore profile fetch errors */ }

        if (!verifiedRole) {
          try {
            const { data: teacherRow } = await supabase
              .from('teachers')
              .select('*')
              .eq('email', userEmail)
              .maybeSingle();
            if (teacherRow) verifiedRole = 'teacher';
          } catch { /* ignore teacher row fetch errors */ }
        }

        if (userEmail === 'urvashinath0409@gmail.com') {
          verifiedRole = 'super_admin';
        }

        const verifiedUser = {
          uid: session.user.id,
          email: userEmail,
          name: verifiedName,
          role: verifiedRole || 'teacher',
          avatar_url: verifiedAvatar
        };

        localStorage.setItem('edtech_teacher_user', JSON.stringify(verifiedUser));
        localStorage.setItem('edtech_user', JSON.stringify(verifiedUser));
        setUser(verifiedUser);
      } catch (err) {
        console.error('Teacher session verification error:', err);
        setUser(null);
      }
    };

    verifySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        localStorage.removeItem('edtech_teacher_user');
        localStorage.removeItem('edtech_user');
      } else {
        verifySession();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);




  const userRole = (user?.role || '').toLowerCase();
  const isAuthorized = user && (userRole === 'teacher' || userRole === 'super_admin' || userRole === 'superadmin' || userRole === 'admin');

  if (!isAuthorized) {
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const repoPrefix = (window.location.hostname.endsWith('github.io') && pathSegments.length > 0)
      ? '/' + pathSegments[0]
      : '';
    const loginUrl = window.location.origin + repoPrefix + '/login.html';
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
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👩‍🏫 🔑</div>
          <h1 style={{ color: 'var(--brand-primary, #00F0FF)', fontSize: '1.8rem', fontWeight: '800', marginBottom: '12px' }}>Teacher Portal Gateway</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '28px' }}>
            Enter your faculty credentials to manage curriculum tests, smartboard sessions, and student progress.
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
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/timetable" element={<TimeTable />} />
                <Route path="/todo" element={<ToDoList />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/classes" element={<Classes />} />
                <Route path="/smartboard" element={<SmartboardTeaching />} />
                <Route path="/curriculum" element={<SmartboardTeaching />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/liveclass" element={<LiveClass />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/question-bank" element={<QuestionBank />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </Router>
        </PresenceProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
