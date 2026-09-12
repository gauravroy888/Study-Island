/**
 * Shared Theme Presets and Branding Defaults
 * Canonical source for all EdTech Platform Portals
 */

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

export const DEFAULT_BRANDING = {
  school_name: 'Delhi Public School (DPS)',
  school_tagline: 'Excellence in 3D Interactive STEM Learning',
  logo_url: 'https://api.dicebear.com/7.x/shapes/svg?seed=DPS&backgroundColor=00F0FF',
  primary_color: 'var(--brand-primary, #00F0FF)',
  secondary_color: 'var(--brand-secondary, #3B82F6)',
  accent_glow: 'var(--brand-glow, rgba(0, 240, 255, 0.4))',
  theme_preset: 'cyber_stem'
};

export function applyCssVariablesToDom(brandData) {
  if (!brandData || typeof document === 'undefined') return;
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
