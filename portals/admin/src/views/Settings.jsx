import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Shield, Bell, Palette, School, Save, Check, Key, Lock, Image as ImageIcon, User, Upload, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import Card from '../components/Card';
import { useTheme, THEME_PRESETS } from '../ThemeContext';
import ProfilePhotoModal from '../components/ProfilePhotoModal';
import { supabase } from '../supabase';

import futureBg from '../assets/Future verion lowres.jpg';
import milkyWayBg from '../assets/milky-way-starry-sky2k.jpg';
import chapterBg from '../assets/chapter background lowres.jpg';

export default function Settings() {
  const { 
    branding, 
    updateBranding, 
    backgroundImage, setBackgroundImage, 
    profileName, setProfileName, 
    profileDesignation, setProfileDesignation, 
    profileImage 
  } = useTheme();

  const [schoolName, setSchoolName] = useState(branding.school_name || 'Delhi Public School (DPS)');
  const [schoolTagline, setSchoolTagline] = useState(branding.school_tagline || 'Excellence in 3D Interactive STEM Learning');
  const [schoolDomain, setSchoolDomain] = useState('dps-delhi.immersionlabs.in');
  const [adminEmail, setAdminEmail] = useState('immersionlabsindia@gmail.com');
  const [logoUrl, setLogoUrl] = useState(branding.logo_url || 'https://api.dicebear.com/7.x/shapes/svg?seed=DPS&backgroundColor=00F0FF');
  const [primaryColor, setPrimaryColor] = useState(branding.primary_color || 'var(--brand-primary, #00F0FF)');
  const [secondaryColor, setSecondaryColor] = useState(branding.secondary_color || 'var(--brand-secondary, #3B82F6)');
  const [accentGlow, setAccentGlow] = useState(branding.accent_glow || 'var(--brand-glow, rgba(0, 240, 255, 0.4))');
  const [themePreset, setThemePreset] = useState(branding.theme_preset || 'cyber_stem');

  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  
  const logoInputRef = useRef(null);

  // Sync internal state when external branding updates
  useEffect(() => {
    if (branding) {
      if (branding.school_name) setSchoolName(branding.school_name);
      if (branding.school_tagline) setSchoolTagline(branding.school_tagline);
      if (branding.logo_url) setLogoUrl(branding.logo_url);
      if (branding.primary_color) setPrimaryColor(branding.primary_color);
      if (branding.secondary_color) setSecondaryColor(branding.secondary_color);
      if (branding.accent_glow) setAccentGlow(branding.accent_glow);
      if (branding.theme_preset) setThemePreset(branding.theme_preset);
    }
  }, [branding]);

  const WALLPAPERS = [
    { id: 'future', name: 'Future Version Cyber Glass', path: futureBg, label: 'Future Cyber Glass' },
    { id: 'milkyway', name: 'Milky Way Deep Cosmos', path: milkyWayBg, label: 'Milky Way Cosmos' },
    { id: 'chapter', name: 'Chapter Horizon', path: chapterBg, label: 'Chapter Horizon' }
  ];

  // Handle selecting a curated theme preset
  const handleSelectPreset = (presetKey) => {
    const preset = THEME_PRESETS[presetKey];
    if (!preset) return;
    setThemePreset(presetKey);
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
    setAccentGlow(preset.glow);

    // Live preview immediately
    updateBranding({
      theme_preset: presetKey,
      primary_color: preset.primary,
      secondary_color: preset.secondary,
      accent_glow: preset.glow
    });
  };

  // Immediate, bulletproof logo file upload
  const handleLogoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target.result;
      if (!rawDataUrl) {
        setIsUploadingLogo(false);
        return;
      }

      // 1. Immediately update state & live theme
      setLogoUrl(rawDataUrl);
      updateBranding({ logo_url: rawDataUrl });

      // 2. High-grade canvas smoothing & compression
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 500;
          canvas.height = 500;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.fillStyle = '#060a14';
          ctx.fillRect(0, 0, 500, 500);

          const minDim = Math.min(img.width, img.height);
          const srcX = (img.width - minDim) / 2;
          const srcY = (img.height - minDim) / 2;
          ctx.drawImage(img, srcX, srcY, minDim, minDim, 0, 0, 500, 500);

          const compressed = canvas.toDataURL('image/png', 0.92);
          setLogoUrl(compressed);
          updateBranding({ logo_url: compressed });
        } catch (err) {}
        setIsUploadingLogo(false);
      };
      img.onerror = () => {
        setIsUploadingLogo(false);
      };
      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input so same file can be re-selected if needed
  };

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();

    const brandPayload = {
      institution_id: 'inst-dps-001',
      school_name: schoolName.trim(),
      school_tagline: schoolTagline.trim(),
      logo_url: logoUrl,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_glow: accentGlow,
      theme_preset: themePreset,
      updated_at: new Date().toISOString()
    };

    // 1. Update React Theme Context & Local Storage
    updateBranding(brandPayload);

    // 2. Persist to Supabase Database
    try {
      const { error } = await supabase
        .from('school_branding')
        .upsert(brandPayload, { onConflict: 'institution_id' });

      if (error) {
        console.warn('Supabase school_branding upsert warning:', error);
      }
    } catch (dbErr) {
      console.error('Failed to write branding to database:', dbErr);
    }

    // 3. Dispatch native 0ms BroadcastChannel event across all open portals
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('edtech_platform_sync');
        bc.postMessage({
          type: 'BRANDING_UPDATE',
          branding: brandPayload,
          timestamp: Date.now()
        });
        bc.close();
      } catch (bcErr) {}
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profileName || 'Admin')}&backgroundColor=b6e3f4`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1080px' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.4rem', fontWeight: '800' }}>
            Institution Branding &amp; Theme Studio 🏫
          </h3>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
            Configure institutional identity, official school logo, real-time color themes, 2FA policies, and administrator profile.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 28px',
            background: savedSuccess ? 'rgba(16, 185, 129, 0.25)' : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
            color: savedSuccess ? '#34d399' : '#000',
            border: savedSuccess ? '1px solid #10B981' : 'none',
            borderRadius: '12px',
            fontWeight: '800',
            fontSize: '0.92rem',
            cursor: 'pointer',
            boxShadow: savedSuccess ? '0 0 20px rgba(16, 185, 129, 0.4)' : `0 0 25px ${accentGlow}`,
            transition: 'all 0.2s ease'
          }}
        >
          {savedSuccess ? <Check size={18} /> : <Save size={18} />}
          <span>{savedSuccess ? 'Branding Broadcasted Live!' : 'Save & Broadcast Branding'}</span>
        </button>
      </div>

      {/* Grid Settings Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px' }}>
        
        {/* ── CARD 1: INSTITUTIONAL BRAND IDENTITY & LOGO ── */}
        <Card style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <School size={22} color={primaryColor} />
            <h4 style={{ color: '#fff', fontSize: '1.15rem', fontWeight: '700', margin: 0 }}>Institution Profile &amp; Official Logo</h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* Logo Preview & Uploader */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '20px', 
              padding: '16px', 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '14px', 
              border: '1px solid rgba(255,255,255,0.08)' 
            }}>
              <div style={{
                width: '84px',
                height: '84px',
                borderRadius: '16px',
                overflow: 'hidden',
                border: `2px solid ${primaryColor}`,
                boxShadow: `0 0 20px ${accentGlow}`,
                background: '#060a14',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <img 
                  src={logoUrl} 
                  alt="School Logo" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                  onError={(err) => {
                    err.currentTarget.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(schoolName)}&backgroundColor=060a14`;
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <h5 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1rem', fontWeight: '700' }}>Official School Crest / Logo</h5>
                <p style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '0.8rem', lineHeight: '1.4' }}>
                  Displayed in Sidebars, Headers, and Report cards across Teacher and Student portals.
                </p>
                
                <input 
                  type="file" 
                  ref={logoInputRef} 
                  onChange={handleLogoFileChange} 
                  accept="image/png, image/jpeg, image/svg+xml, image/webp, image/gif" 
                  style={{ display: 'none' }} 
                />

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                      color: '#000',
                      fontWeight: '700',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: `0 0 15px ${accentGlow}`
                    }}
                  >
                    <Upload size={15} /> {isUploadingLogo ? 'Processing...' : 'Upload Custom Logo'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const diceUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(schoolName || 'DPS')}&backgroundColor=060a14`;
                      setLogoUrl(diceUrl);
                      updateBranding({ logo_url: diceUrl });
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255,255,255,0.12)',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <RefreshCw size={14} /> Generate Crest
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>Institution Official Name</label>
              <input
                type="text"
                value={schoolName}
                onChange={e => setSchoolName(e.target.value)}
                placeholder="e.g. Delhi Public School (DPS)"
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', outline: 'none', fontSize: '0.9rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>School Motto / Tagline</label>
              <input
                type="text"
                value={schoolTagline}
                onChange={e => setSchoolTagline(e.target.value)}
                placeholder="e.g. Excellence in 3D Interactive STEM Learning"
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#cbd5e1', outline: 'none', fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>Custom Domain</label>
                <input
                  type="text"
                  value={schoolDomain}
                  onChange={e => setSchoolDomain(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: primaryColor, fontFamily: 'monospace', outline: 'none', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>Admin Email</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontFamily: 'monospace', outline: 'none', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* In-Card Save Action */}
            <div style={{ marginTop: '10px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleSaveSettings}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 22px',
                  background: savedSuccess ? 'rgba(16, 185, 129, 0.25)' : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  color: savedSuccess ? '#34d399' : '#000',
                  border: savedSuccess ? '1px solid #10B981' : 'none',
                  borderRadius: '10px',
                  fontWeight: '800',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: savedSuccess ? '0 0 15px rgba(16, 185, 129, 0.4)' : `0 0 20px ${accentGlow}`,
                  transition: 'all 0.2s ease'
                }}
              >
                {savedSuccess ? <Check size={16} /> : <Save size={16} />}
                <span>{savedSuccess ? 'Saved Live!' : 'Save Institution Profile'}</span>
              </button>
            </div>
          </div>
        </Card>

        {/* ── CARD 2: THEME PRESETS & ACCENT COLORS ── */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Palette size={22} color="#F59E0B" />
              <h4 style={{ color: '#fff', fontSize: '1.15rem', fontWeight: '700', margin: 0 }}>Institutional Theme Presets</h4>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: primaryColor, background: `${primaryColor}15`, padding: '4px 10px', borderRadius: '8px', border: `1px solid ${primaryColor}40` }}>
              Live CSS Engine Active
            </span>
          </div>

          <p style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
            Choose a curated academic color theme. Changes immediately sync across all student and faculty portal views in real time.
          </p>

          {/* Preset Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {Object.values(THEME_PRESETS).map(p => {
              const isSelected = themePreset === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPreset(p.id)}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                    border: isSelected ? `2px solid ${p.primary}` : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: isSelected ? `0 0 20px ${p.glow}` : 'none',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '1.1rem' }}>{p.icon}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: p.primary, boxShadow: `0 0 8px ${p.primary}` }} />
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: p.secondary }} />
                    </div>
                  </div>
                  <h5 style={{ margin: '0 0 4px 0', color: isSelected ? '#fff' : '#cbd5e1', fontSize: '0.9rem', fontWeight: '700' }}>
                    {p.name}
                  </h5>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.72rem', lineHeight: '1.3' }}>
                    {p.description}
                  </p>
                  {isSelected && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px', color: p.primary }}>
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Custom Color Overrides */}
          <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '0.9rem', fontWeight: '700' }}>Fine-Tune Brand Colors</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>Primary Accent</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="color" 
                    value={primaryColor} 
                    onChange={e => {
                      setPrimaryColor(e.target.value);
                      setThemePreset('custom');
                      updateBranding({ primary_color: e.target.value, theme_preset: 'custom' });
                    }} 
                    style={{ width: '36px', height: '36px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                  />
                  <input 
                    type="text" 
                    value={primaryColor} 
                    onChange={e => {
                      setPrimaryColor(e.target.value);
                      setThemePreset('custom');
                      updateBranding({ primary_color: e.target.value, theme_preset: 'custom' });
                    }} 
                    style={{ flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontFamily: 'monospace', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>Secondary Accent</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="color" 
                    value={secondaryColor} 
                    onChange={e => {
                      setSecondaryColor(e.target.value);
                      setThemePreset('custom');
                      updateBranding({ secondary_color: e.target.value, theme_preset: 'custom' });
                    }} 
                    style={{ width: '36px', height: '36px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                  />
                  <input 
                    type="text" 
                    value={secondaryColor} 
                    onChange={e => {
                      setSecondaryColor(e.target.value);
                      setThemePreset('custom');
                      updateBranding({ secondary_color: e.target.value, theme_preset: 'custom' });
                    }} 
                    style={{ flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontFamily: 'monospace', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ── CARD 3: ADMIN PROFILE & AVATAR ── */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <User size={20} color={primaryColor} />
            <h4 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>Administrator Profile &amp; Avatar</h4>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '85px',
              height: '85px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: `2px solid ${primaryColor}`,
              boxShadow: `0 0 20px ${accentGlow}`,
              background: '#060a14',
              flexShrink: 0
            }}>
              <img 
                src={profileImage || fallbackAvatar} 
                alt="Admin Avatar" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.src = fallbackAvatar; }}
              />
            </div>

            <div>
              <h5 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1rem', fontWeight: '700' }}>Your Avatar</h5>
              <p style={{ margin: '0 0 12px 0', color: '#94a3b8', fontSize: '0.85rem' }}>Customize your generated avatar or upload a custom photo.</p>
              <button 
                type="button"
                onClick={() => setShowPhotoModal(true)}
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  color: '#000',
                  fontWeight: '700',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  boxShadow: `0 0 15px ${accentGlow}`
                }}
              >
                Edit Profile Photo
              </button>
            </div>
          </div>
        </Card>

        {/* ── CARD 4: PERSONAL WALLPAPER & BACKDROP ── */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <ImageIcon size={20} color={secondaryColor} />
            <h4 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>Personal Backdrop Wallpaper</h4>
          </div>

          <p style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
            Select your personal portal backdrop wallpaper while maintaining the official institutional theme colors.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            {WALLPAPERS.map(wp => {
              const isSelected = backgroundImage === wp.path;
              return (
                <div
                  key={wp.id}
                  onClick={() => setBackgroundImage(wp.path)}
                  style={{
                    cursor: 'pointer',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: isSelected ? `2px solid ${primaryColor}` : '1px solid rgba(255,255,255,0.12)',
                    boxShadow: isSelected ? `0 0 16px ${accentGlow}` : 'none',
                    position: 'relative',
                    background: 'rgba(10, 15, 28, 0.9)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div style={{ height: '85px', width: '100%', overflow: 'hidden', position: 'relative', background: '#090d16' }}>
                    <img 
                      src={wp.path} 
                      alt={wp.name} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
                    />
                    {isSelected && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '8px', 
                        right: '8px', 
                        background: primaryColor, 
                        borderRadius: '50%', 
                        width: '22px',
                        height: '22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#000',
                        fontWeight: 'bold',
                        boxShadow: `0 0 10px ${accentGlow}`
                      }}>
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <div style={{ 
                    padding: '8px 10px', 
                    background: 'rgba(5, 8, 17, 0.95)', 
                    fontSize: '0.8rem', 
                    color: '#ffffff', 
                    fontWeight: '600', 
                    lineHeight: '1.3',
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                  }}>
                    {wp.label || wp.name}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

      </div>

      {/* ── CARD 5: BOTTOM PAGE SAVE & BROADCAST BAR ── */}
      <Card style={{ background: 'linear-gradient(135deg, rgba(13, 20, 36, 0.95), rgba(6, 10, 20, 0.98))', border: `1px solid ${primaryColor}50` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.1rem', fontWeight: '800' }}>
              Publish Institutional Theme &amp; Branding
            </h4>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
              Clicking save immediately persists your school name, crest logo, and color theme to Supabase and broadcasts live across all open portals.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveSettings}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 32px',
              background: savedSuccess ? 'rgba(16, 185, 129, 0.3)' : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              color: savedSuccess ? '#34d399' : '#000',
              border: savedSuccess ? '1px solid #10B981' : 'none',
              borderRadius: '12px',
              fontWeight: '900',
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: savedSuccess ? '0 0 25px rgba(16, 185, 129, 0.5)' : `0 0 30px ${accentGlow}`,
              transition: 'all 0.2s ease'
            }}
          >
            {savedSuccess ? <Check size={20} /> : <Save size={20} />}
            <span>{savedSuccess ? 'Branding Saved & Broadcasted Live!' : 'Save & Broadcast Branding'}</span>
          </button>
        </div>
      </Card>

      {showPhotoModal && (
        <ProfilePhotoModal 
          isOpen={showPhotoModal} 
          onClose={() => setShowPhotoModal(false)} 
        />
      )}
    </div>
  );
}
