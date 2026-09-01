import React, { useState } from 'react';
import { User, Bell, Lock, Palette } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import ProfilePhotoModal from '../components/ProfilePhotoModal';
import { supabase } from '../supabase';

export default function Settings() {
  const { profileName, setProfileName, profileImage } = useTheme();
  
  const getAuthUser = () => {
    try {
      return JSON.parse(localStorage.getItem('edtech_user') || 'null');
    } catch(e) { return null; }
  };
  const authUser = getAuthUser();

  const [name, setName] = useState(authUser?.name || profileName || 'Alex');
  const [email, setEmail] = useState(authUser?.email || 'alex@student.edtech.org');
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveName = async (e) => {
    e.preventDefault();
    setProfileName(name);
    try {
      const user = getAuthUser();
      if (user) {
        user.name = name;
        localStorage.setItem('edtech_user', JSON.stringify(user));
        await supabase.from('profiles').update({ name }).eq('email', user.email);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch(err) {
      console.error(err);
    }
  };

  const fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || 'Student')}&backgroundColor=b6e3f4`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
      <div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 6px 0', color: 'white' }}>Settings</h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '1rem' }}>Manage your profile preferences and account settings.</p>
      </div>

      {/* Profile Photo Card */}
      <div style={{
        background: 'rgba(13, 20, 36, 0.75)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.15))',
        borderRadius: '20px',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
          <User size={20} color="var(--brand-primary, #00F0FF)" />
          <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Profile Photo</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2px solid var(--brand-primary, #00F0FF)',
            boxShadow: '0 0 15px var(--brand-glow, rgba(0, 240, 255, 0.3))',
            background: '#0D1424',
            flexShrink: 0
          }}>
            <img 
              src={profileImage || fallbackAvatar} 
              alt="Your Avatar" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.src = fallbackAvatar; }} 
            />
          </div>

          <div>
            <h4 style={{ margin: '0 0 4px 0', color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>Your Avatar</h4>
            <p style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '0.9rem' }}>Customize your generated avatar or upload a custom photo.</p>
            <button 
              onClick={() => setIsPhotoModalOpen(true)}
              style={{
                background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                color: '#000',
                fontWeight: '700',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '10px',
                cursor: 'pointer',
                boxShadow: '0 0 15px var(--brand-glow, rgba(0, 240, 255, 0.4))'
              }}
            >
              Edit Profile Photo
            </button>
          </div>
        </div>
      </div>

      {/* Account Info Form Card */}
      <div style={{
        background: 'rgba(13, 20, 36, 0.75)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.15))',
        borderRadius: '20px',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
          <Lock size={20} color="#a855f7" />
          <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Account Information</h3>
        </div>

        <form onSubmit={handleSaveName} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '600' }}>Display Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '0.95rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '600' }}>Email Address (Read Only)</label>
            <input 
              type="email" 
              value={email} 
              readOnly
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#94a3b8',
                fontSize: '0.95rem',
                cursor: 'not-allowed'
              }}
            />
          </div>

          <button 
            type="submit"
            style={{
              alignSelf: 'flex-start',
              background: saveSuccess ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              border: saveSuccess ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.2)',
              color: saveSuccess ? '#34d399' : 'white',
              fontWeight: '700',
              padding: '10px 24px',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {saveSuccess ? 'Changes Saved!' : 'Save Changes'}
          </button>
        </form>
      </div>

      <ProfilePhotoModal 
        isOpen={isPhotoModalOpen} 
        onClose={() => setIsPhotoModalOpen(false)} 
      />
    </div>
  );
}
