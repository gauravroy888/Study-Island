import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export const THEME_PRESETS = {
  cyber_stem: {
    id: 'cyber_stem',
    name: 'Cyber STEM (Default)',
    icon: '🌐',
    primary: 'var(--brand-primary, #00F0FF)',
    secondary: 'var(--brand-secondary, #3B82F6)',
    glow: 'var(--brand-glow, rgba(0, 240, 255, 0.4))',
    border: 'var(--brand-glow, rgba(0, 240, 255, 0.35))',
    description: 'Electric Cyan & Neon Blue for interactive 3D STEM labs.'
  },
  oxford_royal: {
    id: 'oxford_royal',
    name: 'Oxford Royal Blue',
    icon: '🏛️',
    primary: 'var(--brand-secondary, #3B82F6)',
    secondary: '#F59E0B',
    glow: 'rgba(59, 130, 246, 0.45)',
    border: 'rgba(59, 130, 246, 0.4)',
    description: 'Classic Royal Blue & Gold academic prestige.'
  },
  cambridge_emerald: {
    id: 'cambridge_emerald',
    name: 'Cambridge Emerald',
    icon: '🌿',
    primary: '#10B981',
    secondary: '#14B8A6',
    glow: 'rgba(16, 185, 129, 0.45)',
    border: 'rgba(16, 185, 129, 0.4)',
    description: 'Vivid Emerald Green & Teal for science and nature.'
  },
  imperial_violet: {
    id: 'imperial_violet',
    name: 'Imperial Cyber Violet',
    icon: '🔮',
    primary: '#A855F7',
    secondary: '#EC4899',
    glow: 'rgba(168, 85, 247, 0.45)',
    border: 'rgba(168, 85, 247, 0.4)',
    description: 'Cosmic Purple & Neon Pink for creative innovation.'
  },
  solar_gold: {
    id: 'solar_gold',
    name: 'Solar Flare Gold',
    icon: '☀️',
    primary: '#F59E0B',
    secondary: '#EF4444',
    glow: 'rgba(245, 158, 11, 0.45)',
    border: 'rgba(245, 158, 11, 0.4)',
    description: 'Energetic Amber Gold & Crimson for active learning.'
  },
  midnight_monolith: {
    id: 'midnight_monolith',
    name: 'Midnight Monolith',
    icon: '🌑',
    primary: '#94A3B8',
    secondary: '#E2E8F0',
    glow: 'rgba(148, 163, 184, 0.35)',
    border: 'rgba(148, 163, 184, 0.3)',
    description: 'Ultra-minimalist High-Contrast Slate & White.'
  }
};

const DEFAULT_BRANDING = {
  school_name: 'Delhi Public School (DPS)',
  school_tagline: 'Excellence in 3D Interactive STEM Learning',
  logo_url: 'https://api.dicebear.com/7.x/shapes/svg?seed=DPS&backgroundColor=00F0FF',
  primary_color: 'var(--brand-primary, #00F0FF)',
  secondary_color: 'var(--brand-secondary, #3B82F6)',
  accent_glow: 'var(--brand-glow, rgba(0, 240, 255, 0.4))',
  theme_preset: 'cyber_stem'
};

const ThemeContext = createContext();

function applyCssVariablesToDom(brandData) {
  if (!brandData) return;
  const primary = brandData.primary_color || 'var(--brand-primary, #00F0FF)';
  const secondary = brandData.secondary_color || 'var(--brand-secondary, #3B82F6)';
  const glow = brandData.accent_glow || 'var(--brand-glow, rgba(0, 240, 255, 0.4))';

  const root = document.documentElement;
  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--brand-secondary', secondary);
  root.style.setProperty('--brand-glow', glow);
  root.style.setProperty('--accent-cyan', primary);
  root.style.setProperty('--accent-blue', secondary);
  root.style.setProperty('--primary-color', primary);
  root.style.setProperty('--secondary-color', secondary);
  root.style.setProperty('--glow-primary', `0 0 25px ${glow}`);
}

export function ThemeProvider({ children }) {
  const getInitialUser = () => {
    try {
      const u = localStorage.getItem('edtech_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
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
    } catch (e) {
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
        } catch (bcErr) {}
      }

      return merged;
    });
  }, []);

  // Sync and subscription lifecycle
  useEffect(() => {
    applyCssVariablesToDom(branding);

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
      } catch (err) {}
    }

    // Storage event listener fallback
    const handleStorage = (e) => {
      if (e.key === 'edtech_school_branding' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setBranding(parsed);
          applyCssVariablesToDom(parsed);
        } catch (err) {}
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
      try { supabase.removeChannel(subscription); } catch (e) {}
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
