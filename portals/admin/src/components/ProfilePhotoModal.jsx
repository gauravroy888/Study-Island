import React, { useState, useRef, useEffect } from 'react';
import { X, User, Image as ImageIcon, Upload, ZoomIn, Check, RotateCcw } from 'lucide-react';
import { supabase } from '../supabase';
import { useTheme } from '../ThemeContext';

export default function ProfilePhotoModal({ isOpen, onClose }) {
  const { profileName, setProfileImage } = useTheme();
  
  const [activeTab, setActiveTab] = useState('avatar'); // 'avatar' | 'upload'
  
  // Avatar Customization States
  const [gender, setGender] = useState('male');
  const [expression, setExpression] = useState('happy');
  const [hair, setHair] = useState('shortFlat');
  const [hairColor, setHairColor] = useState('2c1b18');
  const [facialHair, setFacialHair] = useState('');
  const [facialHairColor, setFacialHairColor] = useState('2c1b18');
  const [skinColor, setSkinColor] = useState('ffdbb4');
  const [accessories, setAccessories] = useState('');
  const [clothing, setClothing] = useState('blazerAndShirt');
  const [clothingColor, setClothingColor] = useState('black');
  const [avatarBgColor, setAvatarBgColor] = useState('b6e3f4');

  // Photo Upload & Canvas Cropper States
  const [imageSrc, setImageSrc] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const imageObjRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);

  // Real-time dicebear URL generator
  const expressionParams = expression === 'happy' ? '&mouth=smile,default&eyes=happy,default' : 
                           expression === 'smile' ? '&mouth=smile&eyes=default' :
                           expression === 'serious' ? '&mouth=serious,default&eyes=default' : 
                           expression === 'surprised' ? '&mouth=twinkle&eyes=surprised' : '&mouth=default&eyes=default';
                           
  const genderParams = gender === 'male' ? '&facialHairProbability=100' : '&facialHairProbability=0';
  const accessoriesParams = accessories ? `&accessoriesProbability=100&accessories=${accessories}` : '&accessoriesProbability=0';

  const previewAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profileName || 'Admin')}&top=${hair}&hairColor=${hairColor}&skinColor=${skinColor}&clothing=${clothing}&clothingColor=${clothingColor}${gender === 'male' && facialHair ? `&facialHair=${facialHair}&facialHairColor=${facialHairColor}` : ''}${genderParams}${accessoriesParams}${expressionParams}&backgroundColor=${avatarBgColor}`;

  // Reset upload state whenever modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setImageSrc(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      imageObjRef.current = null;
    } else {
      setImageSrc(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      imageObjRef.current = null;
    }
  }, [isOpen]);

  const drawCanvas = () => {
    if (!canvasRef.current || !imageObjRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageObjRef.current;

    const size = 300;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    // Draw circular clip path
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Calculate aspect fill
    const aspect = img.width / img.height;
    let drawW, drawH;
    if (aspect > 1) {
      drawH = size * zoom;
      drawW = size * aspect * zoom;
    } else {
      drawW = size * zoom;
      drawH = (size / aspect) * zoom;
    }

    const drawX = (size - drawW) / 2 + pan.x;
    const drawY = (size - drawH) / 2 + pan.y;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();

    // Draw border
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'var(--brand-primary, #00F0FF)';
    ctx.lineWidth = 3;
    ctx.stroke();
  };

  // Draw image on canvas when image, zoom, or pan changes
  useEffect(() => {
    if (!imageSrc) {
      imageObjRef.current = null;
      return;
    }
    if (!imageObjRef.current || imageObjRef.current.src !== imageSrc) {
      const img = new Image();
      img.onload = () => {
        imageObjRef.current = img;
        drawCanvas();
      };
      img.src = imageSrc;
    } else {
      drawCanvas();
    }
  }, [imageSrc, zoom, pan]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 8 * 1024 * 1024) {
        alert('Please select an image smaller than 8MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          imageObjRef.current = img;
          setImageSrc(event.target.result);
          setZoom(1);
          setPan({ x: 0, y: 0 });
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Global save handler - uploads to Cloudflare R2 + Supabase profiles + localStorage + Context
  const handleSaveToGlobal = async (imageUrl) => {
    setIsSaving(true);
    let finalUrl = imageUrl;

    try {
      if (imageUrl.startsWith('data:image')) {
        const base64Data = imageUrl.split(',')[1];
        const userEmail = (localStorage.getItem('edtech_user') ? JSON.parse(localStorage.getItem('edtech_user')).email : 'admin@cognitiveisland.edu');
        
        // 1. Upload to Cloudflare R2 via /api/upload-r2
        try {
          const res = await fetch('/api/upload-r2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: 'avatars',
              isAvatar: true,
              userEmail: userEmail,
              filename: `profile_1000x1000.jpg`,
              base64Content: base64Data,
              contentType: 'image/jpeg'
            })
          });

          const r2Result = await res.json();
          if (r2Result.ok && r2Result.cdnUrl) {
            finalUrl = r2Result.cdnUrl;
          }
        } catch (r2Err) {
          console.warn('R2 upload endpoint fallback:', r2Err);
        }

        // 2. Fallback to Supabase Storage if R2 local endpoint was unreachable
        if (!finalUrl || finalUrl.startsWith('data:image')) {
          try {
            const res = await fetch(imageUrl);
            const blob = await res.blob();
            const fileName = `avatar-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
            
            const { error } = await supabase.storage.from('avatars').upload(fileName, blob, {
              contentType: 'image/jpeg',
              upsert: true
            });

            if (!error) {
              const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
              if (publicUrl) finalUrl = publicUrl;
            }
          } catch (uploadErr) {
            console.warn('Storage upload fallback to data URL:', uploadErr);
          }
        }
      }

      setProfileImage(finalUrl);

      // Persist across localStorage keys for all portals
      localStorage.setItem('portal_avatar', finalUrl);
      localStorage.setItem('admin_portal_avatar', finalUrl);
      localStorage.setItem('student_portal_avatar', finalUrl);
      localStorage.setItem('teacher_portal_avatar', finalUrl);

      const userStr = localStorage.getItem('edtech_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.avatar_url = finalUrl;
        user.avatar = finalUrl;
        localStorage.setItem('edtech_user', JSON.stringify(user));

        // Persist to Supabase profiles table
        await supabase.from('profiles').upsert({
          email: user.email,
          name: user.name || profileName || 'Admin',
          role: user.role || 'admin',
          avatar_url: finalUrl
        }, { onConflict: 'email' });
      }

      // Notify other tabs and components via Native BroadcastChannel
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel('edtech_platform_sync');
          bc.postMessage({ type: 'AVATAR_UPDATE', avatar_url: finalUrl });
          bc.close();
        } catch (bcErr) {}
      }

      window.dispatchEvent(new Event('storage'));
      onClose();
    } catch (err) {
      console.error('Failed to save avatar:', err);
      alert('Error updating profile photo. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAvatar = () => {
    handleSaveToGlobal(previewAvatarUrl);
  };

  const handleSaveCrop = () => {
    if (imageObjRef.current) {
      const img = imageObjRef.current;
      const masterCanvas = document.createElement('canvas');
      masterCanvas.width = 1000;
      masterCanvas.height = 1000;
      const ctx = masterCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const size = 1000;
      const scaleRatio = 1000 / 300;
      const aspect = img.width / img.height;
      let drawW, drawH;
      if (aspect > 1) {
        drawH = size * zoom;
        drawW = size * aspect * zoom;
      } else {
        drawW = size * zoom;
        drawH = (size / aspect) * zoom;
      }

      const drawX = (size - drawW) / 2 + (pan.x * scaleRatio);
      const drawY = (size - drawH) / 2 + (pan.y * scaleRatio);

      ctx.fillStyle = '#060a14';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      const dataUrl = masterCanvas.toDataURL('image/jpeg', 0.90);
      handleSaveToGlobal(dataUrl);
    } else if (canvasRef.current) {
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = 1000;
      croppedCanvas.height = 1000;
      const ctx = croppedCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvasRef.current, 0, 0, 1000, 1000);
      const dataUrl = croppedCanvas.toDataURL('image/jpeg', 0.90);
      handleSaveToGlobal(dataUrl);
    }
  };

  const selectStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.2))',
    color: 'white',
    outline: 'none',
    cursor: 'pointer',
    fontSize: '13px'
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(4, 7, 15, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        background: '#0a0f1d',
        border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.25))',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '620px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 240, 255, 0.15)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: '800' }}>
              Edit Profile Photo
            </h3>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '13px' }}>
              Create an illustrated avatar or upload a custom picture.
            </p>
          </div>
          <button 
            onClick={onClose} 
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              color: '#94a3b8',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('avatar')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '10px',
              border: activeTab === 'avatar' ? '1px solid var(--brand-primary, #00F0FF)' : '1px solid rgba(255,255,255,0.08)',
              background: activeTab === 'avatar' ? 'var(--brand-glow, rgba(0, 240, 255, 0.15))' : 'transparent',
              color: activeTab === 'avatar' ? 'var(--brand-primary, #00F0FF)' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <User size={16} /> Avatar Creator
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '10px',
              border: activeTab === 'upload' ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
              background: activeTab === 'upload' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
              color: activeTab === 'upload' ? '#c084fc' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <ImageIcon size={16} /> Upload Photo
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {activeTab === 'avatar' ? (
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              
              {/* Left Column: Preview + Gender */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '150px' }}>
                <div style={{
                  width: '130px',
                  height: '130px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '3px solid var(--brand-primary, #00F0FF)',
                  boxShadow: '0 0 25px var(--brand-glow, rgba(0, 240, 255, 0.35))',
                  background: '#fff'
                }}>
                  <img src={previewAvatarUrl} alt="Avatar Preview" style={{ width: '100%', height: '100%' }} />
                </div>
                
                {/* Gender Toggle */}
                <div style={{
                  display: 'flex',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '20px',
                  padding: '3px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  width: '100%'
                }}>
                  <button 
                    onClick={() => { setGender('male'); setHair('shortFlat'); setFacialHair(''); }}
                    style={{
                      flex: 1,
                      padding: '5px 0',
                      borderRadius: '16px',
                      border: 'none',
                      background: gender === 'male' ? 'var(--brand-primary, #00F0FF)' : 'transparent',
                      color: gender === 'male' ? '#000' : '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}
                  >
                    Male
                  </button>
                  <button 
                    onClick={() => { setGender('female'); setHair('longButNotTooLong'); setFacialHair(''); }}
                    style={{
                      flex: 1,
                      padding: '5px 0',
                      borderRadius: '16px',
                      border: 'none',
                      background: gender === 'female' ? '#a855f7' : 'transparent',
                      color: gender === 'female' ? '#fff' : '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}
                  >
                    Female
                  </button>
                </div>

                <button 
                  onClick={handleSaveAvatar} 
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                    color: '#000',
                    fontWeight: '800',
                    border: 'none',
                    cursor: isSaving ? 'wait' : 'pointer',
                    fontSize: '13px',
                    boxShadow: '0 0 20px var(--brand-glow, rgba(0, 240, 255, 0.4))'
                  }}
                >
                  {isSaving ? 'Saving...' : 'Apply Avatar'}
                </button>
              </div>

              {/* Right Column: Style Selectors */}
              <div style={{ flex: 1, minWidth: '240px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Expression</label>
                  <select value={expression} onChange={(e) => setExpression(e.target.value)} style={selectStyle}>
                    <option value="happy">Happy</option>
                    <option value="smile">Soft Smile</option>
                    <option value="serious">Serious</option>
                    <option value="surprised">Surprised</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Hair Style</label>
                  <select value={hair} onChange={(e) => setHair(e.target.value)} style={selectStyle}>
                    {gender === 'male' ? (
                      <>
                        <option value="shortFlat">Short Flat</option>
                        <option value="shortWaved">Short Waved</option>
                        <option value="shortFrizzle">Short Frizzle</option>
                        <option value="shortDreads01">Short Dreads</option>
                        <option value="frizzle">Frizzle</option>
                        <option value="noHair">Bald</option>
                        <option value="turban">Turban</option>
                      </>
                    ) : (
                      <>
                        <option value="longButNotTooLong">Long</option>
                        <option value="curly">Curly</option>
                        <option value="straight02">Straight</option>
                        <option value="miaWallace">Bob Cut</option>
                        <option value="hijab">Hijab</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Hair Color</label>
                  <select value={hairColor} onChange={(e) => setHairColor(e.target.value)} style={selectStyle}>
                    <option value="2c1b18">Black</option>
                    <option value="724133">Brown</option>
                    <option value="b58143">Blonde</option>
                    <option value="c93305">Red</option>
                    <option value="e8e1e1">Silver / Gray</option>
                    <option value="f59797">Pink</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Skin Tone</label>
                  <select value={skinColor} onChange={(e) => setSkinColor(e.target.value)} style={selectStyle}>
                    <option value="ffdbb4">Light</option>
                    <option value="f8d25c">Yellow</option>
                    <option value="edb98a">Tanned</option>
                    <option value="d08b5b">Brown</option>
                    <option value="ae5d29">Dark Brown</option>
                    <option value="614335">Black</option>
                  </select>
                </div>

                {gender === 'male' && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Facial Hair</label>
                      <select value={facialHair} onChange={(e) => setFacialHair(e.target.value)} style={selectStyle}>
                        <option value="">None</option>
                        <option value="beardMedium">Medium Beard</option>
                        <option value="beardLight">Light Beard</option>
                        <option value="beardMajestic">Majestic Beard</option>
                        <option value="moustacheMagnum">Mustache</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Facial Hair Color</label>
                      <select value={facialHairColor} onChange={(e) => setFacialHairColor(e.target.value)} style={selectStyle}>
                        <option value="2c1b18">Black</option>
                        <option value="724133">Brown</option>
                        <option value="b58143">Blonde</option>
                        <option value="c93305">Red</option>
                        <option value="e8e1e1">Silver / Gray</option>
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Accessories</label>
                  <select value={accessories} onChange={(e) => setAccessories(e.target.value)} style={selectStyle}>
                    <option value="">None</option>
                    <option value="prescription01">Glasses 1</option>
                    <option value="prescription02">Glasses 2</option>
                    <option value="round">Round Glasses</option>
                    <option value="sunglasses">Sunglasses</option>
                    <option value="wayfarers">Wayfarers</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Clothing</label>
                  <select value={clothing} onChange={(e) => setClothing(e.target.value)} style={selectStyle}>
                    <option value="blazerAndShirt">Blazer &amp; Shirt</option>
                    <option value="blazerAndSweater">Blazer &amp; Sweater</option>
                    <option value="collarAndSweater">Collar &amp; Sweater</option>
                    <option value="graphicShirt">Graphic Shirt</option>
                    <option value="hoodie">Hoodie</option>
                    <option value="overall">Overalls</option>
                    <option value="shirtCrewNeck">Crew Neck Shirt</option>
                    <option value="shirtVNeck">V-Neck Shirt</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Clothing Color</label>
                  <select value={clothingColor} onChange={(e) => setClothingColor(e.target.value)} style={selectStyle}>
                    <option value="black">Black</option>
                    <option value="blue02">Blue</option>
                    <option value="gray02">Gray</option>
                    <option value="pink">Pink</option>
                    <option value="red">Red</option>
                    <option value="white">White</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Background</label>
                  <select value={avatarBgColor} onChange={(e) => setAvatarBgColor(e.target.value)} style={selectStyle}>
                    <option value="b6e3f4">Light Blue</option>
                    <option value="c0aede">Purple</option>
                    <option value="d1d4f9">Lavender</option>
                    <option value="ffdfbf">Peach</option>
                    <option value="ffd5dc">Pink</option>
                    <option value="c1f4c5">Mint Green</option>
                    <option value="f4d150">Yellow</option>
                  </select>
                </div>

              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              {!imageSrc ? (
                <div style={{
                  width: '100%',
                  padding: '40px 20px',
                  border: '2px dashed rgba(0, 240, 255, 0.25)',
                  borderRadius: '16px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)'
                }}>
                  <Upload size={40} color="var(--brand-primary, #00F0FF)" style={{ marginBottom: '12px' }} />
                  <h4 style={{ margin: '0 0 6px 0', color: '#fff', fontSize: '1rem' }}>Select Profile Photo</h4>
                  <p style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '13px' }}>Supports JPG, PNG, WebP up to 8MB.</p>
                  <label style={{
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 24px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                    color: '#000',
                    fontWeight: '700',
                    fontSize: '13px'
                  }}>
                    <Upload size={16} /> Choose File
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                  </label>
                </div>
              ) : (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>
                    Drag to reposition, use slider to zoom in/out.
                  </p>
                  
                  <div 
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{
                      cursor: isDragging ? 'grabbing' : 'grab',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      width: '280px',
                      height: '280px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 30px var(--brand-glow, rgba(0, 240, 255, 0.3))',
                      background: '#000'
                    }}
                  >
                    <canvas ref={canvasRef} style={{ width: '280px', height: '280px' }} />
                  </div>

                  {/* Zoom Slider */}
                  <div style={{ width: '100%', maxWidth: '300px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ZoomIn size={16} color="var(--brand-primary, #00F0FF)" />
                    <input 
                      type="range" 
                      min="1" 
                      max="3" 
                      step="0.02" 
                      value={zoom} 
                      onChange={(e) => setZoom(parseFloat(e.target.value))} 
                      style={{ flex: 1, accentcolor: 'var(--brand-primary, #00F0FF)' }} 
                    />
                    <button 
                      onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                      title="Reset Position"
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
                    >
                      <RotateCcw size={15} />
                    </button>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
                    <button 
                      onClick={() => setImageSrc(null)} 
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Change Photo
                    </button>
                    <button 
                      onClick={handleSaveCrop} 
                      disabled={isSaving}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                        border: 'none',
                        color: '#000',
                        fontWeight: '800',
                        cursor: isSaving ? 'wait' : 'pointer',
                        boxShadow: '0 0 20px var(--brand-glow, rgba(0, 240, 255, 0.4))'
                      }}
                    >
                      {isSaving ? 'Saving...' : 'Apply Photo'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
