/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

import { THEME_PRESETS, DEFAULT_BRANDING, applyCssVariablesToDom } from '../../../shared/src/theme/presets.js';
export { THEME_PRESETS, DEFAULT_BRANDING, applyCssVariablesToDom };

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const getInitialUser = () => {
    try {
      const u = localStorage.getItem('edtech_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  };

  const initialUser = getInitialUser();

  // ── Institutional Brand Layer ──
  const [branding, setBranding] = useState(() => {
    try {
      const stored = localStorage.getItem('edtech_school_branding');
      const parsed = stored ? JSON.parse(stored) : DEFAULT_BRANDING;
      applyCssVariablesToDom(parsed);
      return parsed;
    } catch {
      applyCssVariablesToDom(DEFAULT_BRANDING);
      return DEFAULT_BRANDING;
    }
  });

  // ── Personal Layer ──
  const [backgroundImage, setBackgroundImage] = useState('/assets/Future%20verion%20lowres.jpg');
  const [profileName, setProfileName] = useState(initialUser?.name || 'Administrator');
  const [profileDesignation, setProfileDesignation] = useState(
    initialUser?.org ? `${initialUser.org} Admin` : 'Immersion Labs Admin'
  );
  const [profileImage, setProfileImage] = useState(
    initialUser?.avatar_url || initialUser?.avatar || localStorage.getItem('admin_portal_avatar') || localStorage.getItem('portal_avatar') || 'https://api.dicebear.com/7.x/micah/svg?seed=ImmersionAdmin&backgroundColor=060a14'
  );

  const updateBranding = useCallback((newBrandData) => {
    setBranding(prev => {
      const merged = { ...prev, ...newBrandData };
      localStorage.setItem('edtech_school_branding', JSON.stringify(merged));
      applyCssVariablesToDom(merged);

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel('edtech_platform_sync');
          bc.postMessage({
            type: 'BRANDING_UPDATE',
            branding: merged,
            timestamp: Date.now()
          });
          bc.close();
        } catch { /* ignore broadcast error */ }
      }

      return merged;
    });
  }, []);

  // Sync and subscription lifecycle
  useEffect(() => {
    async function fetchLiveBranding() {
      try {
        const { data, error } = await supabase
          .from('school_branding')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (data && !error) {
          setBranding(prev => {
            const updated = { ...prev, ...data };
            localStorage.setItem('edtech_school_branding', JSON.stringify(updated));
            applyCssVariablesToDom(updated);
            return updated;
          });
        }
      } catch (err) {
        console.warn('Live branding fetch error:', err);
      }
    }

    fetchLiveBranding();

    // Native BroadcastChannel for instant 0ms cross-tab updates
    let channel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('edtech_platform_sync');
        channel.onmessage = (e) => {
          if (e.data) {
            if (e.data.type === 'BRANDING_UPDATE' && e.data.branding) {
              setBranding(e.data.branding);
              localStorage.setItem('edtech_school_branding', JSON.stringify(e.data.branding));
              applyCssVariablesToDom(e.data.branding);
            } else if (e.data.type === 'AVATAR_UPDATE' || e.data.type === 'PROFILE_UPDATE') {
              if (e.data.avatar_url) setProfileImage(e.data.avatar_url);
              if (e.data.name) setProfileName(e.data.name);
            }
          }
        };
      } catch { /* ignore channel error */ }
    }

    // Storage event listener fallback
    const handleStorage = (e) => {
      if (e.key === 'edtech_school_branding' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setBranding(parsed);
          applyCssVariablesToDom(parsed);
        } catch { /* ignore storage parse error */ }
      }
    };
    window.addEventListener('storage', handleStorage);

    // Unique Supabase Realtime channel instance
    const channelId = `admin_branding_${Math.random().toString(36).substring(2, 8)}`;
    const subscription = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_branding' }, (payload) => {
        if (payload.new) {
          setBranding(prev => {
            const updated = { ...prev, ...payload.new };
            localStorage.setItem('edtech_school_branding', JSON.stringify(updated));
            applyCssVariablesToDom(updated);
            return updated;
          });
        }
      })
      .subscribe();

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
      try { supabase.removeChannel(subscription); } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    const handleUserStorage = () => {
      const u = getInitialUser();
      const storedAvatar = localStorage.getItem('admin_portal_avatar') || localStorage.getItem('portal_avatar');
      if (u) {
        if (u.name) setProfileName(u.name);
        if (u.org) setProfileDesignation(`${u.org} Admin`);
        if (u.avatar_url || u.avatar) setProfileImage(u.avatar_url || u.avatar);
      } else if (storedAvatar) {
        setProfileImage(storedAvatar);
      }
    };
    window.addEventListener('storage', handleUserStorage);
    return () => window.removeEventListener('storage', handleUserStorage);
  }, []);

  return (
    <ThemeContext.Provider value={{
      branding,
      schoolName: branding.school_name || DEFAULT_BRANDING.school_name,
      schoolTagline: branding.school_tagline || DEFAULT_BRANDING.school_tagline,
      schoolLogo: branding.logo_url || DEFAULT_BRANDING.logo_url,
      primaryColor: branding.primary_color || DEFAULT_BRANDING.primary_color,
      secondaryColor: branding.secondary_color || DEFAULT_BRANDING.secondary_color,
      accentGlow: branding.accent_glow || DEFAULT_BRANDING.accent_glow,
      themePreset: branding.theme_preset || DEFAULT_BRANDING.theme_preset,
      updateBranding,
      backgroundImage, setBackgroundImage,
      profileName, setProfileName,
      profileDesignation, setProfileDesignation,
      profileImage, setProfileImage
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
