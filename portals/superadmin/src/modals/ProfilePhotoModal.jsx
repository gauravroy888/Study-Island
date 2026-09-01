import React from 'react';
import { SUPABASE_CONFIG } from '../constants.js';

export function SuperAdminProfilePhotoModal({ currentUser, setCurrentUser, onClose }) {
      const [activeTab, setActiveTab] = React.useState('avatar');
      const [gender, setGender] = React.useState('female');
      const [expression, setExpression] = React.useState('happy');
      const [hair, setHair] = React.useState('longButNotTooLong');
      const [hairColor, setHairColor] = React.useState('2c1b18');
      const [facialHair, setFacialHair] = React.useState('');
      const [facialHairColor, setFacialHairColor] = React.useState('2c1b18');
      const [skinColor, setSkinColor] = React.useState('ffdbb4');
      const [accessories, setAccessories] = React.useState('');
      const [clothing, setClothing] = React.useState('blazerAndShirt');
      const [clothingColor, setClothingColor] = React.useState('black');
      const [avatarBgColor, setAvatarBgColor] = React.useState('b6e3f4');

      const [imageSrc, setImageSrc] = React.useState(null);
      const [zoom, setZoom] = React.useState(1);
      const [pan, setPan] = React.useState({ x: 0, y: 0 });
      const [isDragging, setIsDragging] = React.useState(false);
      const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
      const [isSaving, setIsSaving] = React.useState(false);
      const [uploadStep, setUploadStep] = React.useState('');
      const canvasRef = React.useRef(null);
      const imgRef = React.useRef(null);

      const adminName = currentUser?.name || CURRENT_SUPER_ADMIN.name || 'SuperAdmin';
      const adminEmail = currentUser?.email || CURRENT_SUPER_ADMIN.email || 'urvashinath0409@gmail.com';

      // Safe DiceBear URL generator adhering strictly to 7.x Avataaars schema
      const expressionParams = expression === 'happy' ? '&mouth=smile,default&eyes=happy,default' : 
                               expression === 'smile' ? '&mouth=smile&eyes=default' :
                               expression === 'serious' ? '&mouth=serious,default&eyes=default' : 
                               expression === 'surprised' ? '&mouth=twinkle&eyes=surprised' : '&mouth=default&eyes=default';
      const genderParams = gender === 'male' ? '&facialHairProbability=100' : '&facialHairProbability=0';
      const accessoriesParams = accessories ? `&accessoriesProbability=100&accessories=${accessories}` : '&accessoriesProbability=0';
      const clothingColorParam = clothingColor ? `&clothingColor=${clothingColor}` : '';

      const previewAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(adminName)}&top=${hair}&hairColor=${hairColor}&skinColor=${skinColor}&clothing=${clothing}${clothingColorParam}${gender === 'male' && facialHair ? `&facialHair=${facialHair}&facialHairColor=${facialHairColor}` : ''}${genderParams}${accessoriesParams}${expressionParams}&backgroundColor=${avatarBgColor}`;

      const drawCanvas = () => {
        if (!canvasRef.current || !imgRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = imgRef.current;
        const size = 300;
        canvas.width = size;
        canvas.height = size;
        ctx.clearRect(0, 0, size, size);

        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

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

        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 3;
        ctx.stroke();
      };

      React.useEffect(() => {
        if (!imageSrc) {
          imgRef.current = null;
          return;
        }
        if (!imgRef.current || imgRef.current.src !== imageSrc) {
          const img = new Image();
          img.onload = () => {
            imgRef.current = img;
            drawCanvas();
          };
          img.src = imageSrc;
        } else {
          drawCanvas();
        }
      }, [imageSrc, zoom, pan]);

      const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          if (file.size > 15 * 1024 * 1024) {
            alert('Please select an image smaller than 15MB.');
            return;
          }
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              imgRef.current = img;
              setImageSrc(event.target.result);
              setZoom(1);
              setPan({ x: 0, y: 0 });
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      };

      // Save handler for Illustrated Avatar
      const handleSaveAvatar = async () => {
        setIsSaving(true);
        setUploadStep('Syncing avatar with database...');
        try {
          // Persist to Supabase profiles
          await fetch(`${SUPABASE_CONFIG.url}/rest/v1/profiles?email=eq.${encodeURIComponent(adminEmail)}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_CONFIG.key,
              'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ avatar_url: previewAvatarUrl })
          });

          // Update local storage across all portal keys
          const updatedUser = { ...(currentUser || {}), avatar_url: previewAvatarUrl, avatar: previewAvatarUrl };
          localStorage.setItem('edtech_user', JSON.stringify(updatedUser));
          localStorage.setItem('portal_avatar', previewAvatarUrl);
          localStorage.setItem('admin_portal_avatar', previewAvatarUrl);
          localStorage.setItem('student_portal_avatar', previewAvatarUrl);
          if (setCurrentUser) setCurrentUser(updatedUser);

          if (typeof BroadcastChannel !== 'undefined') {
            try {
              const bc = new BroadcastChannel('edtech_platform_sync');
              bc.postMessage({ type: 'AVATAR_UPDATE', avatar_url: previewAvatarUrl, name: adminName });
              bc.close();
            } catch (bcErr) {}
          }

          window.dispatchEvent(new Event('storage'));
          onClose();
        } catch(err) {
          console.error('Error updating superadmin avatar:', err);
          alert('Failed to save avatar. Please try again.');
        } finally {
          setIsSaving(false);
          setUploadStep('');
        }
      };

      // 📸 Save handler for Photo Upload: 1000x1000 JPG Compression + Cloudflare R2 Upload + Supabase DB Sync
      const handleSaveCrop = async () => {
        if (!imgRef.current) return;
        setIsSaving(true);
        setUploadStep('⚡ Compressing to 1000x1000 JPG master file...');

        try {
          // 1. Create an exact 1000x1000 high-res offscreen canvas
          const masterCanvas = document.createElement('canvas');
          masterCanvas.width = 1000;
          masterCanvas.height = 1000;
          const ctx = masterCanvas.getContext('2d');

          // High-grade bicubic smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          const img = imgRef.current;
          const size = 1000;
          const scaleRatio = 1000 / 300; // ratio from 300px preview canvas to 1000px master

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

          // Fill clean neutral background then draw image
          ctx.fillStyle = '#060a14';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          // Convert to 1000x1000 JPEG (quality 0.90)
          const dataUrl = masterCanvas.toDataURL('image/jpeg', 0.90);
          const base64Data = dataUrl.split(',')[1];

          setUploadStep('☁️ Uploading 1000x1000 JPG to Cloudflare R2...');

          let finalUrl = null;

          // 2. Upload to Cloudflare R2 via /api/upload-r2
          try {
            const res = await fetch('/api/upload-r2', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                category: 'avatars',
                isAvatar: true,
                userEmail: adminEmail,
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
            console.warn('R2 local endpoint error, falling back to Supabase storage:', r2Err);
          }

          // 3. Fallback to Supabase Storage if R2 direct endpoint is unreachable
          if (!finalUrl) {
            try {
              const resBlob = await fetch(dataUrl);
              const blob = await resBlob.blob();
              const fileName = `avatar-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

              const upRes = await fetch(`${SUPABASE_CONFIG.url}/storage/v1/object/avatars/${fileName}`, {
                method: 'POST',
                headers: {
                  'apikey': SUPABASE_CONFIG.key,
                  'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
                  'Content-Type': 'image/jpeg'
                },
                body: blob
              });

              if (upRes.ok) {
                finalUrl = `${SUPABASE_CONFIG.url}/storage/v1/object/public/avatars/${fileName}`;
              }
            } catch(sbErr) {
              console.warn('Supabase storage fallback error:', sbErr);
            }
          }

          if (!finalUrl) {
            finalUrl = dataUrl;
          }

          setUploadStep('🟢 Syncing Supabase Profile database...');

          // 4. Persist to Supabase profiles table
          await fetch(`${SUPABASE_CONFIG.url}/rest/v1/profiles?email=eq.${encodeURIComponent(adminEmail)}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_CONFIG.key,
              'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ avatar_url: finalUrl })
          });

          // 5. Update local storage across all portals
          const updatedUser = { ...(currentUser || {}), avatar_url: finalUrl, avatar: finalUrl };
          localStorage.setItem('edtech_user', JSON.stringify(updatedUser));
          localStorage.setItem('portal_avatar', finalUrl);
          localStorage.setItem('admin_portal_avatar', finalUrl);
          localStorage.setItem('student_portal_avatar', finalUrl);
          localStorage.setItem('teacher_portal_avatar', finalUrl);
          if (setCurrentUser) setCurrentUser(updatedUser);

          if (typeof BroadcastChannel !== 'undefined') {
            try {
              const bc = new BroadcastChannel('edtech_platform_sync');
              bc.postMessage({ type: 'AVATAR_UPDATE', avatar_url: finalUrl, name: adminName });
              bc.close();
            } catch (bcErr) {}
          }

          window.dispatchEvent(new Event('storage'));
          onClose();
        } catch(err) {
          console.error('Error uploading 1000x1000 photo:', err);
          alert('Failed to upload photo. Please try again.');
        } finally {
          setIsSaving(false);
          setUploadStep('');
        }
      };

      const selectClass = "w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none";

      return (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel rounded-2xl max-w-xl w-full p-6 border border-cyan-500/40 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <i className="ph ph-user-circle text-cyan-400 text-xl"></i> SuperAdmin Profile Photo
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Customize your illustrated avatar or upload a custom 1000x1000 photo to Cloudflare R2.</p>
              </div>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><i className="ph ph-x text-xl"></i></button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => setActiveTab('avatar')} 
                className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${activeTab === 'avatar' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'border-slate-800 text-slate-400'}`}
              >
                <i className="ph ph-magic-wand"></i> Avatar Creator
              </button>
              <button 
                type="button" 
                onClick={() => setActiveTab('upload')} 
                className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${activeTab === 'upload' ? 'bg-purple-500/20 border-purple-400 text-purple-300' : 'border-slate-800 text-slate-400'}`}
              >
                <i className="ph ph-image"></i> Upload Photo (Cloudflare R2)
              </button>
            </div>

            {activeTab === 'avatar' ? (
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div className="flex flex-col items-center gap-3 w-full sm:w-40 flex-shrink-0">
                  <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-cyan-400 shadow-lg shadow-cyan-500/30 bg-white">
                    <img src={previewAvatarUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  
                  {/* Gender switch */}
                  <div className="flex bg-slate-900 p-1 rounded-full border border-slate-800 w-full">
                    <button 
                      type="button" 
                      onClick={() => { setGender('male'); setHair('shortFlat'); setFacialHair(''); }}
                      className={`flex-1 py-1 rounded-full text-[11px] font-bold ${gender === 'male' ? 'bg-cyan-500 text-black' : 'text-slate-400'}`}
                    >
                      Male
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { setGender('female'); setHair('longButNotTooLong'); setFacialHair(''); }}
                      className={`flex-1 py-1 rounded-full text-[11px] font-bold ${gender === 'female' ? 'bg-purple-500 text-white' : 'text-slate-400'}`}
                    >
                      Female
                    </button>
                  </div>

                  <button 
                    type="button" 
                    onClick={handleSaveAvatar} 
                    disabled={isSaving}
                    className="w-full py-2 rounded-xl font-bold text-black text-xs shadow-lg shadow-cyan-500/30"
                    style={{ background: 'linear-gradient(135deg, #00F0FF, #3B82F6)' }}
                  >
                    {isSaving ? 'Saving...' : 'Apply Avatar'}
                  </button>
                </div>

                {/* Grid of selectors */}
                <div className="grid grid-cols-2 gap-3 flex-1 w-full text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">Expression</label>
                    <select value={expression} onChange={(e) => setExpression(e.target.value)} className={selectClass}>
                      <option value="happy">Happy</option>
                      <option value="smile">Soft Smile</option>
                      <option value="serious">Serious</option>
                      <option value="surprised">Surprised</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">Hair Style</label>
                    <select value={hair} onChange={(e) => setHair(e.target.value)} className={selectClass}>
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
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">Hair Color</label>
                    <select value={hairColor} onChange={(e) => setHairColor(e.target.value)} className={selectClass}>
                      <option value="2c1b18">Black</option>
                      <option value="724133">Brown</option>
                      <option value="b58143">Blonde</option>
                      <option value="c93305">Red</option>
                      <option value="e8e1e1">Silver / Gray</option>
                      <option value="f59797">Pink</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">Skin Tone</label>
                    <select value={skinColor} onChange={(e) => setSkinColor(e.target.value)} className={selectClass}>
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
                        <label className="block text-slate-400 mb-1 font-medium text-[11px]">Facial Hair</label>
                        <select value={facialHair} onChange={(e) => setFacialHair(e.target.value)} className={selectClass}>
                          <option value="">None</option>
                          <option value="beardMedium">Medium Beard</option>
                          <option value="beardLight">Light Beard</option>
                          <option value="beardMajestic">Majestic Beard</option>
                          <option value="moustacheMagnum">Mustache</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1 font-medium text-[11px]">Beard Color</label>
                        <select value={facialHairColor} onChange={(e) => setFacialHairColor(e.target.value)} className={selectClass}>
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
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">Accessories</label>
                    <select value={accessories} onChange={(e) => setAccessories(e.target.value)} className={selectClass}>
                      <option value="">None</option>
                      <option value="prescription01">Glasses 1</option>
                      <option value="prescription02">Glasses 2</option>
                      <option value="round">Round Glasses</option>
                      <option value="sunglasses">Sunglasses</option>
                      <option value="wayfarers">Wayfarers</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">Clothing</label>
                    <select value={clothing} onChange={(e) => setClothing(e.target.value)} className={selectClass}>
                      <option value="blazerAndShirt">Blazer &amp; Shirt</option>
                      <option value="blazerAndSweater">Blazer &amp; Sweater</option>
                      <option value="collarAndSweater">Collar &amp; Sweater</option>
                      <option value="graphicShirt">Graphic Shirt</option>
                      <option value="hoodie">Hoodie</option>
                      <option value="overall">Overalls</option>
                      <option value="shirtCrewNeck">Crew Neck</option>
                      <option value="shirtVNeck">V-Neck</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">Clothing Color</label>
                    <select value={clothingColor} onChange={(e) => setClothingColor(e.target.value)} className={selectClass}>
                      <option value="black">Black</option>
                      <option value="blue02">Blue</option>
                      <option value="gray02">Gray</option>
                      <option value="pink">Pink</option>
                      <option value="red">Red</option>
                      <option value="white">White</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">Background</label>
                    <select value={avatarBgColor} onChange={(e) => setAvatarBgColor(e.target.value)} className={selectClass}>
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
              <div className="flex flex-col items-center gap-4 py-2">
                {!imageSrc ? (
                  <div className="w-full p-8 border-2 border-dashed border-cyan-500/30 rounded-2xl text-center bg-slate-900/50">
                    <i className="ph ph-upload-simple text-cyan-400 text-3xl mb-2 inline-block"></i>
                    <h4 className="text-white font-bold text-sm mb-1">Select Custom Photo</h4>
                    <p className="text-xs text-slate-400 mb-2">Converts &amp; compresses to 1000×1000 JPG directly to Cloudflare R2 Edge CDN.</p>
                    <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 mb-4">
                      ☁️ Cloudflare R2 + 🟢 Supabase DB Synced
                    </span>
                    <div>
                      <label className="px-5 py-2.5 rounded-xl text-black font-bold text-xs cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-cyan-500/30 hover:opacity-90 transition" style={{ background: 'linear-gradient(135deg, #00F0FF, #3B82F6)' }}>
                        <i className="ph ph-folder-open text-base"></i> Choose Image File
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <p className="text-xs text-slate-400">Drag to reposition, use slider to zoom. Will be exported at 1000×1000 pixels.</p>
                    <div 
                      onMouseDown={(e) => { setIsDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); }}
                      onMouseMove={(e) => { if (isDragging) setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }}
                      onMouseUp={() => setIsDragging(false)}
                      onMouseLeave={() => setIsDragging(false)}
                      className="w-56 h-56 rounded-full overflow-hidden border-2 border-cyan-400 shadow-xl shadow-cyan-500/30 cursor-grab active:cursor-grabbing bg-black flex items-center justify-center"
                    >
                      <canvas ref={canvasRef} className="w-56 h-56" />
                    </div>

                    <div className="flex items-center gap-3 w-full max-w-xs mt-1">
                      <i className="ph ph-magnifying-glass-plus text-cyan-400 text-sm"></i>
                      <input 
                        type="range" 
                        min="1" 
                        max="3" 
                        step="0.02" 
                        value={zoom} 
                        onChange={(e) => setZoom(parseFloat(e.target.value))} 
                        className="flex-1 accent-cyan-400" 
                      />
                      <button 
                        type="button" 
                        onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} 
                        className="text-slate-400 hover:text-white text-xs"
                      >
                        <i className="ph ph-arrows-counter-clockwise"></i>
                      </button>
                    </div>

                    {uploadStep && (
                      <div className="w-full text-center py-1.5 px-3 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-semibold animate-pulse">
                        {uploadStep}
                      </div>
                    )}

                    <div className="flex gap-3 w-full pt-2">
                      <button type="button" onClick={() => setImageSrc(null)} className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold">Change Photo</button>
                      <button 
                        type="button" 
                        onClick={handleSaveCrop} 
                        disabled={isSaving}
                        className="flex-1 py-2 rounded-xl text-black font-bold text-xs shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-1.5"
                        style={{ background: 'linear-gradient(135deg, #00F0FF, #3B82F6)' }}
                      >
                        {isSaving ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <i className="ph ph-cloud-arrow-up text-sm"></i>
                            <span>Upload 1000x1000 JPG to R2</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      );
    }

    // ── VIEW 1: USER MANAGEMENT ──
