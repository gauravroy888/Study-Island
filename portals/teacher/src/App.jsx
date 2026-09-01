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
  const [user, setUser] = React.useState(() => {
    const teacherStr = localStorage.getItem('edtech_teacher_user');
    if (teacherStr) {
      try { return JSON.parse(teacherStr); } catch (e) {}
    }
    const userStr = localStorage.getItem('edtech_user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u && (u.role === 'teacher' || u.role === 'super_admin' || u.role === 'superadmin')) return u;
      } catch (e) {}
    }
    return {
      uid: 'teacher-gaurav-001',
      email: 'gauravroy476@gmail.com',
      name: 'Gaurav (Head of Science)',
      role: 'teacher',
      avatar_url: 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev/avatars/gauravroy476_gmail_com_1786785035807_profile_1000x1000.jpg'
    };
  });

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const demoParam = urlParams.get('role') || urlParams.get('demo');
    if (demoParam === 'teacher') {
      const demoTeacher = {
        uid: 'teacher-gaurav-001',
        email: 'gauravroy476@gmail.com',
        name: 'Gaurav (Head of Science)',
        role: 'teacher',
        avatar_url: 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev/avatars/gauravroy476_gmail_com_1786785035807_profile_1000x1000.jpg'
      };
      localStorage.setItem('edtech_teacher_user', JSON.stringify(demoTeacher));
      localStorage.setItem('edtech_user', JSON.stringify(demoTeacher));
      setUser(demoTeacher);
      return;
    }

    const verifySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
          const uStr = localStorage.getItem('edtech_teacher_user') || localStorage.getItem('edtech_user');
          if (uStr) {
            try {
              const u = JSON.parse(uStr);
              const r = (u?.role || '').toLowerCase();
              if (u && (r === 'teacher' || r === 'super_admin' || r === 'superadmin' || r === 'admin')) {
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

        if (!verifiedRole) {
          try {
            const { data: teacherRow } = await supabase
              .from('teachers')
              .select('*')
              .eq('email', userEmail)
              .maybeSingle();
            if (teacherRow) verifiedRole = 'teacher';
          } catch (e) {}
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
      }
    };

    verifySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        const uStr = localStorage.getItem('edtech_teacher_user') || localStorage.getItem('edtech_user');
        if (!uStr) setUser(null);
      } else {
        verifySession();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);


  const handleQuickTeacherLogin = (teacherType = 'gaurav') => {
    let faculty = {
      uid: 'teacher-gaurav-001',
      email: 'gauravroy476@gmail.com',
      name: 'Gaurav (Head of Science)',
      role: 'teacher',
      avatar_url: 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev/avatars/gauravroy476_gmail_com_1786785035807_profile_1000x1000.jpg'
    };
    if (teacherType === 'harsh') {
      faculty = {
        uid: 'teacher-harsh-001',
        email: 'rathorehps@gmail.com',
        name: 'Harsh Pratap Singh',
        role: 'teacher',
        avatar_url: 'https://lh3.googleusercontent.com/a/ACg8ocLkbfErfb9aIDo_Q1-TOe9hTRVYUP_ofx2Im9gJq4cidb2waw=s96-c'
      };
    }
    localStorage.setItem('edtech_teacher_user', JSON.stringify(faculty));
    localStorage.setItem('edtech_user', JSON.stringify(faculty));
    setUser(faculty);
  };


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
            <button
              onClick={() => handleQuickTeacherLogin('gaurav')}
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
              ⚡ Launch Session as Gaurav (Science Faculty)
            </button>

            <button
              onClick={() => handleQuickTeacherLogin('harsh')}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                color: '#93c5fd',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              ⚡ Launch Session as Harsh Pratap Singh
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
