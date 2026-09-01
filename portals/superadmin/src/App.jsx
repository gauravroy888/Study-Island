import React, { useState, useEffect } from 'react';
import { SUPABASE_CONFIG, INITIAL_USERS, INITIAL_ORGS, DPS_INSTITUTION, DEFAULT_CLASSES } from './constants.js';

import { SidebarButton } from './components/SidebarButton.jsx';
import { FullscreenToggle } from './components/FullscreenToggle.jsx';

import { UserManagementView }     from './views/UserManagementView.jsx';
import { TenantManagementView }   from './views/TenantManagementView.jsx';
import { SystemHealthView }       from './views/SystemHealthView.jsx';
import { FinancialsView }         from './views/FinancialsView.jsx';
import { ContentControlView }     from './views/ContentControlView.jsx';
import { SecurityAuditView }      from './views/SecurityAuditView.jsx';
import { FeatureFlagsView }       from './views/FeatureFlagsView.jsx';
import { CourseCurriculumView }   from './views/CourseCurriculumView.jsx';
import { CustomCoursesView }      from './views/CustomCoursesView.jsx';
import { SuperAdminProfilePhotoModal } from './modals/ProfilePhotoModal.jsx';

// ── Resolve Super Admin identity from authenticated edtech_user ──
const _authUser = (() => { try { return JSON.parse(localStorage.getItem('edtech_user') || 'null'); } catch(e) { return null; } })();
const CURRENT_SUPER_ADMIN = {
  name:   _authUser?.name   || "Urvashi Nath",
  email:  _authUser?.email  || "urvashinath0409@gmail.com",
  role:   "Super Admin",
  avatar: _authUser?.avatar_url || `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(_authUser?.name || 'UrvashiNath')}`,
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('edtech_user') || 'null'); } catch (e) { return null; }
  });
  const [authChecking, setAuthChecking]     = useState(true);
  const [activeTab, setActiveTab]           = useState("users");
  const [users, setUsers]                   = useState(INITIAL_USERS);
  const [orgs, setOrgs]                     = useState(INITIAL_ORGS);
  const [classes, setClasses]               = useState(DEFAULT_CLASSES);
  const [auditLogs, setAuditLogs]           = useState([]);
  const [searchTerm, setSearchTerm]         = useState("");
  const [impersonatedUser, setImpersonatedUser]   = useState(null);
  const [showOrgModal, setShowOrgModal]             = useState(false);
  const [showAnnounceModal, setShowAnnounceModal]   = useState(false);
  const [showPhotoModal, setShowPhotoModal]         = useState(false);
  const [announcementText, setAnnouncementText]     = useState("");
  const [announcementSent, setAnnouncementSent]     = useState(false);
  const [isLogsLoading, setIsLogsLoading]           = useState(false);
  const [featureFlags, setFeatureFlags] = useState({
    webglPhysicsV2: true,
    aiTutorChatbot: true,
    r2StreamingOptimized: true,
    maintenanceSplash: false,
  });

  // ── Session resolution ──
  useEffect(() => {
    const resolveSession = async () => {
      try {
        let user = currentUser;
        if (!user || !user.email) {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
              try {
                const td = JSON.parse(localStorage.getItem(key));
                if (td && td.user) {
                  user = { uid: td.user.id, email: td.user.email, name: td.user.user_metadata?.full_name || td.user.email?.split('@')[0], avatar_url: td.user.user_metadata?.avatar_url };
                  break;
                }
              } catch (e) {}
            }
          }
        }
        if (user && user.email) {
          try {
            const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/profiles?email=eq.${encodeURIComponent(user.email.toLowerCase())}`, {
              headers: { apikey: SUPABASE_CONFIG.key, Authorization: `Bearer ${SUPABASE_CONFIG.key}` },
            });
            const profList = await res.json();
            if (Array.isArray(profList) && profList.length > 0) {
              const p = profList[0];
              user = { uid: p.auth_id || user.uid, email: p.email, name: p.name || user.name || 'Super Admin', role: p.role, avatar_url: p.avatar_url || user.avatar_url };
            }
          } catch (e) {}
        }
        const userEmail = (user?.email || '').toLowerCase();
        const isRootEmail = userEmail === 'urvashinath0409@gmail.com';
        if (isRootEmail) {
          user = { uid: user?.uid || 'super-admin-root', email: 'urvashinath0409@gmail.com', name: user?.name || CURRENT_SUPER_ADMIN.name, role: 'super_admin', avatar_url: user?.avatar_url || CURRENT_SUPER_ADMIN.avatar };
        }
        if (user && (user.role === 'super_admin' || user.role === 'superadmin' || isRootEmail)) {
          setCurrentUser(user);
          localStorage.setItem('edtech_user', JSON.stringify(user));
          if (user.avatar_url) localStorage.setItem('portal_avatar', user.avatar_url);
          if (user.name) localStorage.setItem('portal_name', user.name);
        } else if (user) {
          setCurrentUser(user);
        }
      } catch (err) {
        console.error('Session resolution error:', err);
      } finally {
        setAuthChecking(false);
      }
    };
    resolveSession();
  }, []);

  // ── Audit log fetchers ──
  const fetchLiveAuditLogs = async () => {
    try {
      setIsLogsLoading(true);
      const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/system_audit_logs?select=*&order=created_at.desc`, {
        headers: { apikey: SUPABASE_CONFIG.key, Authorization: `Bearer ${SUPABASE_CONFIG.key}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setAuditLogs(data);
    } catch (e) { console.warn("Failed to fetch audit logs:", e); }
    finally { setIsLogsLoading(false); }
  };

  const logPlatformIncident = async (logData) => {
    try {
      const payload = {
        severity: logData.severity || 'INFO', category: logData.category || 'SYSTEM',
        code: logData.code || 200, title: logData.title, details: logData.details || '',
        source: logData.source || 'SuperAdmin Portal', actor_email: logData.actor_email || CURRENT_SUPER_ADMIN.email,
        school_id: logData.school_id || 'inst-dps-001', status: logData.status || 'ACTIVE', metadata: logData.metadata || {},
      };
      const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/system_audit_logs`, {
        method: 'POST',
        headers: { apikey: SUPABASE_CONFIG.key, Authorization: `Bearer ${SUPABASE_CONFIG.key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      const inserted = await res.json();
      if (Array.isArray(inserted) && inserted.length > 0) setAuditLogs(prev => [inserted[0], ...prev]);
      else fetchLiveAuditLogs();
    } catch (e) { console.error("Failed to insert incident:", e); }
  };

  const handleResolveIncident = async (id) => {
    try {
      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/system_audit_logs?id=eq.${id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_CONFIG.key, Authorization: `Bearer ${SUPABASE_CONFIG.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED' }),
      });
      setAuditLogs(prev => prev.map(l => l.id === id ? { ...l, status: 'RESOLVED' } : l));
    } catch (e) { console.error("Failed to resolve incident:", e); }
  };

  const handleClearAllIncidents = async () => {
    try {
      const activeIds = auditLogs.filter(l => l.status === 'ACTIVE').map(l => l.id);
      for (const id of activeIds) {
        await fetch(`${SUPABASE_CONFIG.url}/rest/v1/system_audit_logs?id=eq.${id}`, {
          method: 'PATCH',
          headers: { apikey: SUPABASE_CONFIG.key, Authorization: `Bearer ${SUPABASE_CONFIG.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'RESOLVED' }),
        });
      }
      setAuditLogs(prev => prev.map(l => ({ ...l, status: 'RESOLVED' })));
    } catch (e) { console.error("Failed to clear all:", e); }
  };

  // ── Load users + org from Supabase ──
  useEffect(() => {
    async function loadSupabaseUsers() {
      try {
        const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/users?select=*`, {
          headers: { apikey: SUPABASE_CONFIG.key, Authorization: `Bearer ${SUPABASE_CONFIG.key}` },
        });
        const dbUsers = await res.json();
        if (Array.isArray(dbUsers) && dbUsers.length > 0) {
          const mapped = dbUsers
            .filter(u => u.email !== 'gauravroy76@gmail.com')
            .map(u => ({ id: u.id, name: u.full_name || u.email.split('@')[0], email: u.email, role: (u.role || 'STUDENT').toUpperCase(), status: u.status || 'Active', institution_id: 'inst-dps-001', org: 'Delhi Public School', joined: (u.created_at || '').slice(0, 10) || '2026-05-27' }));
          if (!mapped.some(u => u.email === 'immersionlabsindia@gmail.com')) mapped.push({ id: 'usr-immersion', name: 'Immersion Labs', email: 'immersionlabsindia@gmail.com', role: 'ADMIN', status: 'Active', institution_id: 'inst-dps-001', org: 'Delhi Public School', joined: '2026-05-20' });
          if (!mapped.some(u => u.email === 'thorroy888@gmail.com')) mapped.push({ id: 'usr-thorroy', name: 'GAURAV Roy', email: 'thorroy888@gmail.com', role: 'STUDENT', status: 'Active', institution_id: 'inst-dps-001', org: 'Delhi Public School', joined: '2026-05-27' });
          if (!mapped.some(u => u.email === 'sauravroy469@gmail.com')) mapped.push({ id: 'usr-saurav', name: 'Saurav Roy', email: 'sauravroy469@gmail.com', role: 'STUDENT', status: 'Active', institution_id: 'inst-dps-001', org: 'Delhi Public School', joined: '2026-06-15' });
          const superAdmin = { id: 'usr-super', name: 'Urvashi Nath', email: 'urvashinath0409@gmail.com', role: 'SUPER_ADMIN', status: 'Active', institution_id: null, org: '—', joined: '2026-08-01' };
          setUsers([superAdmin, ...mapped]);
          const realStudents = mapped.filter(u => u.role === 'STUDENT').length;
          const realTeachers = mapped.filter(u => u.role === 'TEACHER').length;
          try {
            const brandRes = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/school_branding?institution_id=eq.inst-dps-001&limit=1`, { headers: { apikey: SUPABASE_CONFIG.key, Authorization: `Bearer ${SUPABASE_CONFIG.key}` } });
            const brandData = await brandRes.json();
            if (brandData && brandData[0]) {
              const b = brandData[0];
              setOrgs([{ ...DPS_INSTITUTION, name: b.school_name || DPS_INSTITUTION.name, logo_url: b.logo_url, primary_color: b.primary_color, theme_preset: b.theme_preset, students: realStudents, teachers: realTeachers }]);
            } else { setOrgs([{ ...DPS_INSTITUTION, students: realStudents, teachers: realTeachers }]); }
          } catch { setOrgs([{ ...DPS_INSTITUTION, students: realStudents, teachers: realTeachers }]); }
        }
      } catch (e) { console.warn("Live Supabase fetch error, using fallback:", e); }
    }
    loadSupabaseUsers();
    fetchLiveAuditLogs();
  }, []);

  // ── Role & status handlers ──
  const handleRoleChange = async (userId, newRole) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    try {
      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/profiles?email=eq.${encodeURIComponent(targetUser.email)}`, {
        method: 'PATCH', headers: { apikey: SUPABASE_CONFIG.key, Authorization: `Bearer ${SUPABASE_CONFIG.key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ role: newRole.toLowerCase() }),
      });
    } catch (e) { console.error('Role persist failed:', e); }
    logPlatformIncident({ severity: newRole === 'SUPER_ADMIN' ? 'SECURITY' : 'INFO', category: 'SECURITY', code: 200, title: `Role Modification: ${targetUser.email} → ${newRole}`, details: `SuperAdmin updated role for ${targetUser.name} to ${newRole}.`, source: 'User Management Console', actor_email: CURRENT_SUPER_ADMIN.email, status: 'RESOLVED' });
  };

  const handleStatusToggle = async (userId) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    const nextStatus = targetUser.status === 'Active' ? 'Suspended' : 'Active';
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: nextStatus } : u));
    try {
      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/profiles?email=eq.${encodeURIComponent(targetUser.email)}`, {
        method: 'PATCH', headers: { apikey: SUPABASE_CONFIG.key, Authorization: `Bearer ${SUPABASE_CONFIG.key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch (e) { setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: targetUser.status } : u)); }
    logPlatformIncident({ severity: nextStatus === 'Suspended' ? 'WARNING' : 'INFO', category: 'SECURITY', code: nextStatus === 'Suspended' ? 403 : 200, title: `Account Status Changed: ${targetUser.email} → ${nextStatus}`, details: `Account ${nextStatus.toLowerCase()} by SuperAdmin.`, source: 'User Management Console', actor_email: CURRENT_SUPER_ADMIN.email, status: 'RESOLVED' });
  };

  const handleAddOrg = (e) => {
    e.preventDefault();
    const form = e.target;
    setOrgs(prev => [...prev, { id: `org-${Date.now()}`, name: form.name.value, domain: form.domain.value, students: parseInt(form.students.value) || 100, teachers: parseInt(form.teachers.value) || 10, plan: form.plan.value, storageUsed: "0 GB", storageLimit: `${form.storage.value} GB`, twoFactor: form.twoFactor.checked }]);
    setShowOrgModal(false);
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    const trimmedMsg = announcementText.trim();
    if (!trimmedMsg) return;
    const payload = { title: 'Platform Announcement', text: trimmedMsg, content: trimmedMsg, message: trimmedMsg, author: CURRENT_SUPER_ADMIN.name, author_name: CURRENT_SUPER_ADMIN.name, author_email: CURRENT_SUPER_ADMIN.email, category: 'Urgent', createdAt: new Date().toISOString() };
    try {
      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/notifications`, { method: 'POST', headers: { apikey: SUPABASE_CONFIG.key, Authorization: `Bearer ${SUPABASE_CONFIG.key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ user_email: 'all', type: 'system', title: 'Platform Announcement', message: trimmedMsg, is_read: false }) });
      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/announcements`, { method: 'POST', headers: { apikey: SUPABASE_CONFIG.key, Authorization: `Bearer ${SUPABASE_CONFIG.key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(payload) });
      if (typeof BroadcastChannel !== 'undefined') { try { const bc = new BroadcastChannel('edtech_platform_sync'); bc.postMessage({ type: 'BROADCAST_ALERT', title: 'Platform Announcement', message: trimmedMsg, author: CURRENT_SUPER_ADMIN.name, timestamp: Date.now() }); bc.close(); } catch {} }
      localStorage.setItem('edtech_active_broadcast', JSON.stringify({ id: `bcast_${Date.now()}`, title: 'Platform Announcement', message: trimmedMsg, author: CURRENT_SUPER_ADMIN.name, timestamp: Date.now() }));
      window.dispatchEvent(new Event('storage'));
      logPlatformIncident({ severity: 'INFO', category: 'COMMUNICATION', code: 200, title: 'Platform Broadcast Sent', details: `"${trimmedMsg.slice(0, 80)}${trimmedMsg.length > 80 ? '...' : ''}"`, source: 'Broadcast Console', actor_email: CURRENT_SUPER_ADMIN.email, status: 'RESOLVED' });
    } catch (err) { console.error('Broadcast failed:', err); }
    setAnnouncementSent(true);
    setTimeout(() => { setAnnouncementSent(false); setShowAnnounceModal(false); setAnnouncementText(""); }, 1500);
  };

  // ── Auth checks ──
  const isSuperAdmin = currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'superadmin' || (currentUser.email || '').toLowerCase() === 'urvashinath0409@gmail.com');

  const handleDirectSuperAdminLogin = (email = 'urvashinath0409@gmail.com') => {
    const rootUser = { uid: 'root-admin', email, name: 'Urvashi Nath', role: 'super_admin', avatar_url: 'https://lh3.googleusercontent.com/a/ACg8ocL37IpwEpp5zGOBFXLS5covk849qdLdXYaPqh46sQDrC59ESX-opA=s96-c' };
    localStorage.setItem('edtech_user', JSON.stringify(rootUser));
    localStorage.setItem('portal_name', rootUser.name);
    localStorage.setItem('portal_avatar', rootUser.avatar_url);
    localStorage.setItem('portal_designation', 'Super Administrator');
    setCurrentUser(rootUser);
  };

  const handleGoogleAuth = () => {
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const repoPrefix = (window.location.hostname.endsWith('github.io') && pathSegments.length > 0)
      ? '/' + pathSegments[0]
      : '';
    const redirectUrl = window.location.origin + repoPrefix + '/login.html';
    window.location.href = `${SUPABASE_CONFIG.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
  };

  // ── Loading / Access Denied screens ──
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#060a14', fontFamily: 'Inter, sans-serif' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-semibold tracking-wide">Verifying SuperAdmin Credentials...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const repoPrefix = (window.location.hostname.endsWith('github.io') && pathSegments.length > 0)
      ? '/' + pathSegments[0]
      : '';
    const loginUrl = window.location.origin + repoPrefix + '/login.html';
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#060a14', fontFamily: 'Inter, sans-serif' }}>
        <div className="max-w-md w-full p-8 rounded-2xl text-center" style={{ background: 'rgba(13, 20, 36, 0.9)', border: '1px solid rgba(0, 240, 255, 0.3)', boxShadow: '0 0 50px rgba(0, 240, 255, 0.15)' }}>
          <div className="text-5xl mb-4">👑 🛡️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Root SuperAdmin Deck</h1>
          <p className="text-slate-400 text-xs leading-relaxed mb-6">Restricted to Root Administrators. Current role: <strong className="text-cyan-400 font-mono">{currentUser?.role || 'Guest / Unauthenticated'}</strong></p>
          <div className="flex flex-col gap-3">
            <button onClick={() => handleDirectSuperAdminLogin('urvashinath0409@gmail.com')} className="w-full py-3 rounded-xl font-bold text-black text-sm flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #00F0FF, #3B82F6)', boxShadow: '0 0 20px rgba(0, 240, 255, 0.4)' }}>
              <i className="ph ph-shield-check text-lg"></i> Authenticate as Root
            </button>
            <button onClick={handleGoogleAuth} className="w-full py-2.5 rounded-xl font-semibold text-white text-xs border border-slate-700 bg-slate-800/80 hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
              <i className="ph ph-google-logo text-base text-cyan-400"></i> Sign in via Google OAuth
            </button>
            <a href={loginUrl} className="w-full py-2 text-slate-400 hover:text-white text-xs font-semibold transition-colors mt-1 inline-block">Return to Portal Login</a>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Portal Shell ──
  return (
    <div className="superadmin-app">
      <div className="bg-overlay"></div>
      <div className="bg-gradient"></div>

      {/* SIDEBAR */}
      <aside className="portal-sidebar">
        <div className="brand-logo">
          <span className="text-2xl">🎓</span>
          <span className="brand-title">Study Island</span>
        </div>

        <div className="profile-section">
          <div className="avatar-wrapper cursor-pointer relative group" onClick={() => setShowPhotoModal(true)} title="Click to customize avatar">
            <img src={currentUser?.avatar_url || CURRENT_SUPER_ADMIN.avatar} alt="Admin Profile" className="avatar transition-transform duration-300 group-hover:scale-105" onError={(e) => { e.target.src = CURRENT_SUPER_ADMIN.avatar; }} />
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <i className="ph ph-camera text-white text-base"></i>
            </div>
            <span className="status-dot"></span>
          </div>
          <h3 className="profile-name cursor-pointer hover:text-cyan-400 transition-colors" onClick={() => setShowPhotoModal(true)}>{currentUser?.name || CURRENT_SUPER_ADMIN.name}</h3>
          <span className="profile-role">SUPER ADMIN</span>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">{currentUser?.email || CURRENT_SUPER_ADMIN.email}</p>
          <button type="button" onClick={() => setShowPhotoModal(true)} className="mt-2.5 px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold hover:bg-cyan-500/25 transition-all flex items-center gap-1.5">
            <i className="ph ph-pencil-simple text-xs"></i> Edit Avatar
          </button>
        </div>

        <nav className="space-y-1.5 flex-1">
          <SidebarButton icon="ph-users-three"           label="Users & Roles"           id="users"          active={activeTab} onClick={setActiveTab} />
          <SidebarButton icon="ph-buildings"             label="Tenants & Schools"        id="tenants"        active={activeTab} onClick={setActiveTab} />
          <SidebarButton icon="ph-activity"              label="System & Latency"          id="system"         active={activeTab} onClick={setActiveTab} />
          <SidebarButton icon="ph-currency-dollar"       label="Financials & Revenue"     id="financials"     active={activeTab} onClick={setActiveTab} />
          <SidebarButton icon="ph-folder-open"           label="Content & Cloud R2"       id="content"        active={activeTab} onClick={setActiveTab} />
          <SidebarButton icon="ph-lock-keyhole"          label="Audit & Security"          id="audit"          active={activeTab} onClick={setActiveTab} />
          <SidebarButton icon="ph-sliders"               label="Feature Flags & UI"        id="flags"          active={activeTab} onClick={setActiveTab} />
          <SidebarButton icon="ph-books"                 label="Course Curriculum Hub"    id="curriculum"     active={activeTab} onClick={setActiveTab} />
          <SidebarButton icon="ph-globe-hemisphere-west" label="Custom Courses · World"   id="custom_courses" active={activeTab} onClick={setActiveTab} />
        </nav>

        <div className="pt-4 border-t border-cyan-500/20 text-xs space-y-1.5 text-slate-400">
          <div className="flex justify-between items-center"><span>Database</span><span className="text-emerald-400 font-semibold font-mono">🟢 Supabase</span></div>
          <div className="flex justify-between items-center"><span>Cloud CDN</span><span className="text-cyan-400 font-semibold font-mono">☁️ Cloudflare R2</span></div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="h-20 glass-panel border-b border-cyan-500/20 px-8 flex items-center justify-between shrink-0 m-4 mb-0 rounded-2xl">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wide">SUPERADMIN PORTAL</h2>
            <p className="text-xs text-cyan-400 font-medium">Welcome back, {CURRENT_SUPER_ADMIN.name}! Full Platform Command Enabled.</p>
          </div>
          <div className="flex items-center gap-3">
            <FullscreenToggle />
            <div className="relative w-72">
              <i className="ph ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base"></i>
              <input type="text" placeholder="Search users, schools, audit..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400" />
            </div>
            <button onClick={() => setShowAnnounceModal(true)} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-500/25 transition">
              <i className="ph ph-megaphone text-base"></i> Broadcast Alert
            </button>
            <button onClick={() => setShowOrgModal(true)} className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-400/25 transition">
              <i className="ph ph-plus-circle text-base"></i> Onboard School
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'users'         && <UserManagementView users={users} searchTerm={searchTerm} onRoleChange={handleRoleChange} onStatusToggle={handleStatusToggle} onImpersonate={setImpersonatedUser} />}
          {activeTab === 'tenants'       && <TenantManagementView orgs={orgs} users={users} searchTerm={searchTerm} onOpenModal={() => setShowOrgModal(true)} onRoleChange={handleRoleChange} onStatusToggle={handleStatusToggle} />}
          {activeTab === 'system'        && <SystemHealthView auditLogs={auditLogs} classes={classes} users={users} orgs={orgs} isLogsLoading={isLogsLoading} onResolveIncident={handleResolveIncident} onClearAllIncidents={handleClearAllIncidents} onLogIncident={logPlatformIncident} onRefreshLogs={fetchLiveAuditLogs} />}
          {activeTab === 'financials'    && <FinancialsView />}
          {activeTab === 'content'       && <ContentControlView onBroadcast={() => setShowAnnounceModal(true)} />}
          {activeTab === 'audit'         && <SecurityAuditView logs={auditLogs} isLogsLoading={isLogsLoading} onLogIncident={logPlatformIncident} onResolveIncident={handleResolveIncident} onRefreshLogs={fetchLiveAuditLogs} />}
          {activeTab === 'flags'         && <FeatureFlagsView flags={featureFlags} setFlags={setFeatureFlags} />}
          {activeTab === 'curriculum'    && <CourseCurriculumView />}
          {activeTab === 'custom_courses'&& <CustomCoursesView />}
        </div>
      </main>

      {/* IMPERSONATION MODAL */}
      {impersonatedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel rounded-2xl max-w-md w-full p-6 border border-cyan-400/40 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><i className="ph ph-eye text-cyan-400"></i> Impersonate Session</h3>
            <p className="text-xs text-slate-300 mb-4">Diagnostic read-only mode for <span className="text-cyan-300 font-mono font-bold">{impersonatedUser.email}</span>.</p>
            <div className="bg-slate-900/80 p-3 rounded-xl mb-4 text-xs space-y-1.5 border border-slate-800">
              <div className="flex justify-between"><span className="text-slate-400">User:</span><span className="text-white font-bold">{impersonatedUser.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Institution:</span><span className="text-cyan-400 font-bold">{impersonatedUser.org}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setImpersonatedUser(null)} className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold">Cancel</button>
              <button onClick={() => { alert(`Launching diagnostic mode for ${impersonatedUser.email}`); setImpersonatedUser(null); }} className="flex-1 py-2 rounded-xl bg-cyan-400 text-slate-950 font-bold hover:bg-cyan-300 text-xs">Launch Session</button>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARD SCHOOL MODAL */}
      {showOrgModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddOrg} className="glass-panel rounded-2xl max-w-lg w-full p-6 border border-cyan-400/40 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><i className="ph ph-buildings text-cyan-400"></i> Onboard School Instance</h3>
              <button type="button" onClick={() => setShowOrgModal(false)} className="text-slate-400 hover:text-white"><i className="ph ph-x text-xl"></i></button>
            </div>
            <div className="space-y-3 text-xs">
              <div><label className="block text-slate-300 font-semibold mb-1">School Name</label><input required name="name" type="text" placeholder="e.g. Oxford Public School" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white" /></div>
              <div><label className="block text-slate-300 font-semibold mb-1">Email Domain</label><input required name="domain" type="text" placeholder="e.g. oxford.edu.in" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-300 font-semibold mb-1">Estimated Students</label><input name="students" type="number" defaultValue="500" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white" /></div>
                <div><label className="block text-slate-300 font-semibold mb-1">Estimated Teachers</label><input name="teachers" type="number" defaultValue="35" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-300 font-semibold mb-1">Plan</label><select name="plan" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"><option value="Enterprise">Enterprise</option><option value="Pro">Pro</option></select></div>
                <div><label className="block text-slate-300 font-semibold mb-1">R2 Storage Cap (GB)</label><input name="storage" type="number" defaultValue="250" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white" /></div>
              </div>
              <div className="flex items-center gap-2 pt-2"><input type="checkbox" id="twoFactor" name="twoFactor" defaultChecked className="rounded border-slate-700 bg-slate-900 text-cyan-400" /><label htmlFor="twoFactor" className="text-slate-300 font-semibold cursor-pointer">Enforce Mandatory 2FA</label></div>
            </div>
            <div className="flex gap-3 pt-3">
              <button type="button" onClick={() => setShowOrgModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold">Cancel</button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-cyan-400 text-slate-950 font-bold hover:bg-cyan-300 text-xs">Create Workspace</button>
            </div>
          </form>
        </div>
      )}

      {/* BROADCAST ALERT MODAL */}
      {showAnnounceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleBroadcast} className="glass-panel rounded-2xl max-w-lg w-full p-6 border border-purple-500/40 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><i className="ph ph-megaphone text-purple-400"></i> Platform Global Broadcast</h3>
              <button type="button" onClick={() => setShowAnnounceModal(false)} className="text-slate-400 hover:text-white"><i className="ph ph-x text-xl"></i></button>
            </div>
            {announcementSent ? (
              <div className="p-6 text-center text-emerald-400 font-bold text-sm">✅ Broadcast Banner Pushed Live across Platform!</div>
            ) : (
              <>
                <div className="space-y-3 text-xs">
                  <div><label className="block text-slate-300 font-semibold mb-1">Target Audience</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"><option value="all">Every Single User</option><option value="teachers">Teachers Only</option><option value="students">Students Only</option></select></div>
                  <div><label className="block text-slate-300 font-semibold mb-1">Broadcast Message</label><textarea rows="4" required placeholder="e.g. Scheduled platform maintenance in 1 hour." value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500"></textarea></div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAnnounceModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold">Cancel</button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500 text-xs">Broadcast Alert Now</button>
                </div>
              </>
            )}
          </form>
        </div>
      )}

      {/* PROFILE PHOTO MODAL */}
      {showPhotoModal && (
        <SuperAdminProfilePhotoModal currentUser={currentUser} setCurrentUser={setCurrentUser} onClose={() => setShowPhotoModal(false)} />
      )}
    </div>
  );
}
