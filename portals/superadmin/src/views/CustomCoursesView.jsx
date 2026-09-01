import React from 'react';
import { SUPABASE_URL, SUPABASE_KEY } from '../supabase.js';

export function CustomCoursesView() {
      const SUPABASE_URL = 'https://qmyrxvtbzlbnvzxypnus.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjA4OTcsImV4cCI6MjA5NTM5Njg5N30.ABvW_oBzXC2Ffxm5ToLh6t4WmdKPdtg9SyfeAE76iJo';
      const R2_CDN = 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev';
      const sb = (path, opts={}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...opts.headers }, ...opts });

      const [courses, setCourses] = React.useState([]);
      const [loading, setLoading] = React.useState(false);
      const [toast, setToast] = React.useState(null);
      const [selectedCourse, setSelectedCourse] = React.useState(null);
      const [showAddCourse, setShowAddCourse] = React.useState(false);
      const [newCourse, setNewCourse] = React.useState({
        title: '', tagline: '', emoji: '🌍', color: '#00E5FF', category: 'Language Learning', subscription_tier: 'free', display_order: 1
      });

      const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(()=>setToast(null),3500); };

      React.useEffect(() => { loadCourses(); }, []);

      const loadCourses = async () => {
        setLoading(true);
        try {
          const r = await sb('custom_courses?select=*&order=display_order');
          const d = await r.json();
          const list = Array.isArray(d) ? d : [];
          setCourses(list);
          if (list.length > 0 && !selectedCourse) {
            setSelectedCourse(list[0]);
          } else if (selectedCourse) {
            const updated = list.find(c => c.id === selectedCourse.id);
            if (updated) setSelectedCourse(updated);
          }
        } catch(e) { setCourses([]); }
        setLoading(false);
      };

      const addCourse = async () => {
        if (!newCourse.title.trim()) return showToast('Course title required', 'error');
        const defaultMods = [
          { slug: 'experience', label: 'Experience App', emoji: '💡', color: newCourse.color, isMulti: false, url: '', description: '3D HTML App / WebGL Simulation Folder' },
          { slug: 'stories', label: 'Lessons & Stories', emoji: '🎬', color: '#FBBF24', isMulti: true, items: [], description: 'Video Lessons & Explanations' },
          { slug: 'quiz', label: 'Assessment Quiz', emoji: '📝', color: '#34D399', isMulti: false, url: '', description: 'Interactive Quiz / Test Engine' }
        ];
        const payload = {
          title: newCourse.title.trim(),
          tagline: newCourse.tagline.trim() || 'Platform Exclusive Learning Program',
          emoji: newCourse.emoji || '🌍',
          color: newCourse.color || '#00E5FF',
          cover_gradient: `linear-gradient(135deg, ${newCourse.color}22, #3B82F622)`,
          category: newCourse.category || 'Special Program',
          subscription_tier: newCourse.subscription_tier || 'free',
          display_order: parseInt(newCourse.display_order) || 1,
          is_published: false,
          modalities: defaultMods
        };
        try {
          const r = await sb('custom_courses', { method: 'POST', body: JSON.stringify(payload) });
          const d = await r.json();
          if (r.ok && d && d[0]) {
            showToast(`✅ "${newCourse.title}" created!`);
            setShowAddCourse(false);
            setNewCourse({ title: '', tagline: '', emoji: '🌍', color: '#00E5FF', category: 'Language Learning', subscription_tier: 'free', display_order: 1 });
            loadCourses();
          } else {
            showToast(d.message || 'Error creating course', 'error');
          }
        } catch(e) { showToast('Network error', 'error'); }
      };

      const updateSelectedCourse = async (updatedFields) => {
        if (!selectedCourse) return;
        try {
          const r = await sb(`custom_courses?id=eq.${selectedCourse.id}`, { method: 'PATCH', body: JSON.stringify(updatedFields) });
          if (r.ok) {
            showToast('✅ Course updated!');
            loadCourses();
          } else {
            showToast('Failed to update course', 'error');
          }
        } catch(e) { showToast('Network error', 'error'); }
      };

      const togglePublish = async (course) => {
        const r = await sb(`custom_courses?id=eq.${course.id}`, { method: 'PATCH', body: JSON.stringify({ is_published: !course.is_published }) });
        if (r.ok) {
          showToast(course.is_published ? '📴 Course unpublished' : '🚀 Course live in World & Student Portal!');
          loadCourses();
        } else showToast('Update failed', 'error');
      };

      const deleteCourse = async (course) => {
        if (!window.confirm(`Delete custom course "${course.title}"?`)) return;
        const r = await sb(`custom_courses?id=eq.${course.id}`, { method: 'DELETE' });
        if (r.ok) {
          showToast('🗑️ Course deleted');
          if (selectedCourse?.id === course.id) setSelectedCourse(null);
          loadCourses();
        } else showToast('Delete failed', 'error');
      };

      const saveModalityInCourse = (modSlug, modUrlOrItems) => {
        if (!selectedCourse) return;
        const currentMods = Array.isArray(selectedCourse.modalities) ? [...selectedCourse.modalities] : [];
        const idx = currentMods.findIndex(m => m.slug === modSlug);
        if (idx !== -1) {
          if (currentMods[idx].isMulti) {
            currentMods[idx].items = modUrlOrItems;
            currentMods[idx].url = modUrlOrItems.length > 0 ? (modUrlOrItems[0].url || '') : '';
          } else {
            currentMods[idx].url = modUrlOrItems;
          }
        }
        updateSelectedCourse({ modalities: currentMods });
      };

      return (
        <div className="space-y-6">
          {toast && (
            <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl font-bold text-xs shadow-xl border backdrop-blur-md transition-all ${
              toast.type==='error' ? 'bg-red-950/90 border-red-500/50 text-red-300' : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
            }`}>
              {toast.msg}
            </div>
          )}

          {/* Header */}
          <div className="glass-panel p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌍</span>
                <h2 className="text-xl font-extrabold text-white">Custom Courses &amp; World Hub</h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Platform Exclusive
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-1">
                Manage standalone courses (Language Learning, Scientific Thinking, Mathematical Reasoning) featured in the Student Portal &amp; 3D World.
              </p>
            </div>
            <button
              onClick={() => setShowAddCourse(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-black flex items-center gap-1.5 shadow-lg transition"
              style={{ background: 'linear-gradient(135deg, #00F0FF, #3B82F6)' }}
            >
              <i className="ph ph-plus-circle text-base"></i> Create Custom Course
            </button>
          </div>

          {/* Main Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Course Card List */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">All Programs ({courses.length})</span>
                <button onClick={loadCourses} className="text-cyan-400 hover:underline text-xs flex items-center gap-1">
                  <i className="ph ph-arrows-clockwise text-xs"></i> Refresh
                </button>
              </div>

              {loading ? (
                <div className="p-8 text-center glass-panel rounded-2xl">
                  <i className="ph ph-spinner animate-spin text-2xl text-cyan-400 mb-2"></i>
                  <p className="text-xs text-slate-400">Loading custom courses...</p>
                </div>
              ) : courses.length === 0 ? (
                <div className="p-8 text-center glass-panel rounded-2xl border border-dashed border-slate-700">
                  <div className="text-3xl mb-2">🌍</div>
                  <h4 className="text-sm font-bold text-white mb-1">No Custom Courses Yet</h4>
                  <p className="text-xs text-slate-400 mb-3">Create your first standalone program like Language Learning or Scientific Thinking.</p>
                  <button
                    onClick={() => setShowAddCourse(true)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold"
                  >
                    + Add First Course
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {courses.map(course => {
                    const isSel = selectedCourse?.id === course.id;
                    return (
                      <div
                        key={course.id}
                        onClick={() => setSelectedCourse(course)}
                        className={`glass-panel p-4 rounded-2xl cursor-pointer transition-all border relative overflow-hidden ${
                          isSel ? 'border-cyan-400 shadow-lg shadow-cyan-500/10 bg-slate-900/90' : 'border-slate-800 hover:border-slate-700 bg-slate-900/50'
                        }`}
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-20" style={{ background: course.color }} />
                        <div className="flex items-start justify-between gap-3 relative z-10">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow flex-shrink-0" style={{ background: course.cover_gradient || 'linear-gradient(135deg, #00F0FF22, #3B82F622)', border: `1px solid ${course.color}40` }}>
                              {course.emoji}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white line-clamp-1">{course.title}</h4>
                              <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{course.tagline}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase" style={{ background: `${course.color}20`, color: course.color, border: `1px solid ${course.color}40` }}>
                                  {course.category}
                                </span>
                                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                                  course.subscription_tier==='premium' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                                  course.subscription_tier==='basic' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                                  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                }`}>
                                  {course.subscription_tier || 'free'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); togglePublish(course); }}
                              className={`px-2 py-0.5 rounded text-[9px] font-bold transition ${
                                course.is_published ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {course.is_published ? 'LIVE' : 'DRAFT'}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteCourse(course); }}
                              className="text-red-400/60 hover:text-red-400 text-xs p-1"
                              title="Delete Course"
                            >
                              <i className="ph ph-trash"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Selected Course Modalities & Settings */}
            <div className="lg:col-span-8">
              {selectedCourse ? (
                <div className="glass-panel p-6 rounded-2xl space-y-6">
                  {/* Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{selectedCourse.emoji}</span>
                      <div>
                        <h3 className="text-lg font-bold text-white">{selectedCourse.title}</h3>
                        <p className="text-xs text-slate-400">{selectedCourse.tagline}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePublish(selectedCourse)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                          selectedCourse.is_published
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {selectedCourse.is_published ? '🚀 Live in World' : '📴 Publish to World'}
                      </button>
                    </div>
                  </div>

                  {/* Course Settings Section */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Title</label>
                      <input
                        type="text"
                        value={selectedCourse.title}
                        onChange={e => setSelectedCourse({ ...selectedCourse, title: e.target.value })}
                        onBlur={() => updateSelectedCourse({ title: selectedCourse.title })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Category</label>
                      <input
                        type="text"
                        value={selectedCourse.category}
                        onChange={e => setSelectedCourse({ ...selectedCourse, category: e.target.value })}
                        onBlur={() => updateSelectedCourse({ category: selectedCourse.category })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Access Tier</label>
                      <select
                        value={selectedCourse.subscription_tier || 'free'}
                        onChange={e => {
                          const val = e.target.value;
                          setSelectedCourse({ ...selectedCourse, subscription_tier: val });
                          updateSelectedCourse({ subscription_tier: val });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                      >
                        <option value="free">Free Access (All Students)</option>
                        <option value="basic">Basic Plan &amp; Above</option>
                        <option value="premium">Premium Exclusive</option>
                      </select>
                    </div>
                  </div>

                  {/* Course Modalities Editor */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <i className="ph ph-squares-four text-cyan-400"></i> Course Content Modalities
                    </h4>
                    
                    <div className="space-y-4">
                      {(selectedCourse.modalities || []).map((mod, mIdx) => (
                        <div key={mod.slug || mIdx} className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl">{mod.emoji || '⭐'}</span>
                              <div>
                                <h5 className="text-xs font-bold text-white">{mod.label}</h5>
                                <p className="text-[10px] text-slate-400">{mod.description || 'Custom course content'}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                              {mod.isMulti ? `${(mod.items||[]).length} items` : (mod.url ? '✓ Linked' : 'Empty')}
                            </span>
                          </div>

                          {!mod.isMulti && (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Paste R2 CDN HTML URL or simulation link..."
                                value={mod.url || ''}
                                onChange={e => {
                                  const updatedMods = [...selectedCourse.modalities];
                                  updatedMods[mIdx].url = e.target.value;
                                  setSelectedCourse({ ...selectedCourse, modalities: updatedMods });
                                }}
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder-slate-600"
                              />
                              <button
                                onClick={() => saveModalityInCourse(mod.slug, mod.url)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40"
                              >
                                Save Link
                              </button>
                            </div>
                          )}

                          {mod.isMulti && (
                            <div className="space-y-2 pt-2 border-t border-slate-800">
                              <div className="space-y-1.5">
                                {(mod.items || []).map((item, itemIdx) => (
                                  <div key={itemIdx} className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                                    <div className="flex items-center gap-2">
                                      <span>🎬</span>
                                      <span className="text-white font-semibold">{item.title || 'Lesson Item'}</span>
                                      <span className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]">{item.url}</span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        const newItems = mod.items.filter((_, i) => i !== itemIdx);
                                        saveModalityInCourse(mod.slug, newItems);
                                      }}
                                      className="text-red-400 hover:text-red-300 text-xs"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                ))}
                              </div>

                              <div className="flex gap-2 pt-1">
                                <input
                                  type="text"
                                  id={`add_item_title_${mod.slug}`}
                                  placeholder="Video/Lesson Title"
                                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white"
                                />
                                <input
                                  type="text"
                                  id={`add_item_url_${mod.slug}`}
                                  placeholder="YouTube / MP4 URL"
                                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                                />
                                <button
                                  onClick={() => {
                                    const tEl = document.getElementById(`add_item_title_${mod.slug}`);
                                    const uEl = document.getElementById(`add_item_url_${mod.slug}`);
                                    if (!tEl?.value || !uEl?.value) return showToast('Title and URL required', 'error');
                                    const newItem = { id: 'item_' + Date.now(), title: tEl.value, url: uEl.value, duration: '5:00', tag: 'LESSON' };
                                    const currentItems = mod.items || [];
                                    saveModalityInCourse(mod.slug, [...currentItems, newItem]);
                                    tEl.value = ''; uEl.value = '';
                                  }}
                                  className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold"
                                >
                                  + Add Item
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass-panel p-12 rounded-2xl text-center">
                  <div className="text-4xl mb-3">👈</div>
                  <h3 className="text-base font-bold text-white">Select a Course to Edit</h3>
                  <p className="text-xs text-slate-400">Choose a course from the list on the left to configure its title, tier, and content modalities.</p>
                </div>
              )}
            </div>
          </div>

          {/* Add Course Modal */}
          {showAddCourse && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
              <div className="glass-panel rounded-2xl max-w-md w-full p-6 border border-cyan-500/40 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>🌍</span> Create Standalone Custom Course
                  </h3>
                  <button onClick={() => setShowAddCourse(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Course Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Language Learning / Scientific Thinking"
                      value={newCourse.title}
                      onChange={e => setNewCourse({ ...newCourse, title: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Program Category</label>
                    <select
                      value={newCourse.category}
                      onChange={e => setNewCourse({ ...newCourse, category: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none"
                    >
                      <option value="Language Learning">Language Learning 🌍</option>
                      <option value="Mathematical Reasoning">Mathematical Reasoning 🧮</option>
                      <option value="Critical Thinking">Critical Thinking 🧠</option>
                      <option value="Scientific Thinking">Scientific Thinking 🔬</option>
                      <option value="Gamified Thinking">Gamified Thinking 🎮</option>
                      <option value="Special Program">Special Program ⭐</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Tagline / Brief Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Master linguistic principles through 3D storytelling"
                      value={newCourse.tagline}
                      onChange={e => setNewCourse({ ...newCourse, tagline: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">Emoji Icon</label>
                      <input
                        type="text"
                        value={newCourse.emoji}
                        onChange={e => setNewCourse({ ...newCourse, emoji: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-center text-lg"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">Accent Color</label>
                      <input
                        type="color"
                        value={newCourse.color}
                        onChange={e => setNewCourse({ ...newCourse, color: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl h-10 p-1 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Subscription Access Tier</label>
                    <select
                      value={newCourse.subscription_tier}
                      onChange={e => setNewCourse({ ...newCourse, subscription_tier: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none"
                    >
                      <option value="free">Free Access (All Students)</option>
                      <option value="basic">Basic Plan &amp; Above</option>
                      <option value="premium">Premium Exclusive</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={addCourse}
                    className="flex-1 py-2.5 rounded-xl font-bold text-black text-xs shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #00F0FF, #3B82F6)' }}
                  >
                    🚀 Create Course
                  </button>
                  <button
                    onClick={() => setShowAddCourse(false)}
                    className="px-4 py-2.5 rounded-xl text-slate-400 border border-slate-700 text-xs font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
    // ═══════════════════════════════════════════════════════════════

