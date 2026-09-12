import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://qmyrxvtbzlbnvzxypnus.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjA4OTcsImV4cCI6MjA5NTM5Njg5N30.ABvW_oBzXC2Ffxm5ToLh6t4WmdKPdtg9SyfeAE76iJo';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Listen for auth state changes (e.g. after OAuth redirect)
supabase.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        const user = session.user;
        const userEmail = user.email?.toLowerCase() || '';

        // Query the users table to get the REAL role and existing profile from the database
        let role = 'student'; // Default
        let existingProfile = null;
        try {
            // Check profiles table for user role, name, and avatar
            const { data: profile, error: profileErr } = await supabase
                .from('profiles')
                .select('id, auth_id, email, name, role, avatar_url, department, age, timetable, is_archived')
                .eq('email', userEmail)
                .single();
            if (profile) {
                const VALID_ROLES = ['student', 'teacher', 'admin', 'super_admin', 'superadmin'];
                role = (profile.role && VALID_ROLES.includes(profile.role)) ? profile.role : 'student';
                existingProfile = profile;
            } else if (profileErr) {
                console.warn('[Auth Profile Fetch]', profileErr.message);
            }
        } catch (err) {
            console.warn('[Auth Profile Catch]', err.message);
        }

        // Role is determined solely from the DB profiles table above.
        // Do NOT override role client-side based on email — this is a security risk.
        // To grant super_admin: set role = 'super_admin' directly in Supabase profiles table.

        const profileName = existingProfile?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        const profileAvatar = existingProfile?.avatar_url || user.user_metadata?.avatar_url || null;

        // Auto-sync profile on first login (upsert so no duplicates)
        try {
            const { error: upsertErr } = await supabase.from('profiles').upsert({
                email: userEmail,
                name: profileName,
                role: role,
                auth_id: user.id,
                avatar_url: profileAvatar
            }, { onConflict: 'email', ignoreDuplicates: false });
            if (upsertErr) {
                console.warn('[Auth Profile Upsert]', upsertErr.message);
            }
        } catch (err) {
            console.warn('[Auth Profile Upsert Catch]', err.message);
        }

        const edtechUser = {
            uid: user.id,
            email: userEmail,
            name: profileName,
            role: role,
            avatar_url: profileAvatar
        };
        localStorage.setItem('edtech_user', JSON.stringify(edtechUser));

        // Save to global portal variables so ThemeContext picks them up!
        localStorage.setItem('portal_name', profileName);
        if (profileAvatar) localStorage.setItem('portal_avatar', profileAvatar);
        let designation = 'Student';
        if (role === 'admin') designation = 'Administrator';
        else if (role === 'teacher') designation = 'Teacher';
        else if (role === 'super_admin' || role === 'superadmin') designation = 'Super Admin';
        localStorage.setItem('portal_designation', designation);

        // Determine target portal based on DB role
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        const repoPrefix = (window.location.hostname.endsWith('github.io') && pathSegments.length > 0)
            ? '/' + pathSegments[0]
            : '';

        let targetPortal = '/student/';
        if (role === 'admin') targetPortal = '/admin/';
        else if (role === 'teacher') targetPortal = '/teacher/';
        else if (role === 'super_admin' || role === 'superadmin') targetPortal = '/superadmin/';

        const isOnLoginPage = window.location.pathname.includes('login.html') ||
            window.location.pathname === '/' ||
            window.location.pathname.endsWith('/index.html') ||
            (repoPrefix && window.location.pathname === repoPrefix + '/');

        if (isOnLoginPage) {
            window.location.href = window.location.origin + repoPrefix + targetPortal;
        }
    }
});

export const signInWithGoogle = async () => {
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const repoPrefix = (window.location.hostname.endsWith('github.io') && pathSegments.length > 0)
        ? '/' + pathSegments[0]
        : '';
    const redirectUrl = window.location.origin + repoPrefix + '/login.html';

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUrl
        }
    });

    if (error) {
        console.error('Error signing in with Google:', error.message);
        alert('Login failed: ' + error.message);
    }
};
