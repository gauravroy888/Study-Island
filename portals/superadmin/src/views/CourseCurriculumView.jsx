import React from 'react';
import { SUPABASE_URL, SUPABASE_KEY } from '../supabase.js';

    const DEFAULT_MODALITIES = [
      { slug: 'front_visuals',  label: 'Front Visuals', emoji: '🖼️', icon: 'ph-image',        color: '#EC4899', isMulti: false, renderer: 'iframe_full',  description: 'Hero 3D Scene / Front Animation + Text Description' },
      { slug: 'experience',    label: 'Experience',   emoji: '💡', icon: 'ph-lightbulb',    color: '#00E5FF', isMulti: false, renderer: 'iframe_full',  description: '3D Chapter App / WebGL Simulation / Interactive HTML' },
      { slug: 'experiments',   label: 'Experiments',  emoji: '🧪', icon: 'ph-flask',        color: '#A78BFA', isMulti: true,  renderer: 'multi_cards',  description: 'Interactive Virtual Labs & Experiments (Add Multiple)' },
      { slug: 'quiz',          label: 'Quiz',         emoji: '📝', icon: 'ph-exam',         color: '#34D399', isMulti: false, renderer: 'quiz_engine', description: 'Assessment / HTML5 Quiz Game / Linked Test' },
      { slug: 'mixed_reality', label: 'Mixed Reality',emoji: '👓', icon: 'ph-vr-headset',   color: '#F472B6', isMulti: false, renderer: 'qr_vr',       description: 'WebXR App / Mobile VR QR Code / Immersive 3D Scene' },
      { slug: 'stories',       label: 'Stories',      emoji: '📖', icon: 'ph-book-open',    color: '#FBBF24', isMulti: true,  renderer: 'multi_stories',description: 'Video Lessons, Explanations & Documentaries (Add Multiple)' },
    ];

    const RENDERER_OPTIONS = [
      { value: 'iframe_full',  label: 'Full-Screen HTML5 App (iframe)' },
      { value: 'multi_cards',  label: 'Multi-Card Experiment Carousel' },
      { value: 'multi_stories',label: 'Multi-Item Video & Story Lesson List' },
      { value: 'video_embed',  label: 'Video Embed (YouTube / MP4 / Vimeo)' },
      { value: 'qr_vr',        label: 'VR QR Code + WebXR Launch' },
      { value: 'quiz_engine',  label: 'Built-in Quiz Engine' },
      { value: 'audio_player', label: 'Audio / Podcast Player' },
      { value: 'pdf_reader',   label: 'PDF / Document Reader' },
    ];

export function CourseCurriculumView() {
      const SUPABASE_URL = 'https://qmyrxvtbzlbnvzxypnus.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjA4OTcsImV4cCI6MjA5NTM5Njg5N30.ABvW_oBzXC2Ffxm5ToLh6t4WmdKPdtg9SyfeAE76iJo';
      const R2_CDN = 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev';
      const sb = (path, opts={}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...opts.headers }, ...opts });

      const [step, setStep] = React.useState('classes'); // 'classes' | 'subjects' | 'chapters' | 'modalities'
      const [classes, setClasses] = React.useState([]);
      const [subjects, setSubjects] = React.useState([]);
      const [chapters, setChapters] = React.useState([]);
      const [selectedClass, setSelectedClass] = React.useState(null);
      const [selectedSubject, setSelectedSubject] = React.useState(null);
      const [selectedChapter, setSelectedChapter] = React.useState(null);
      const [loading, setLoading] = React.useState(false);
      const [toast, setToast] = React.useState(null);
      const [showAddClass, setShowAddClass] = React.useState(false);
      const [showAddSubject, setShowAddSubject] = React.useState(false);
      const [showAddChapter, setShowAddChapter] = React.useState(false);
      const [showAddCustomModal, setShowAddCustomModal] = React.useState(false);
      const [customModalities, setCustomModalities] = React.useState([]);
      const [chapterModalities, setChapterModalities] = React.useState({});
      const [uploadingSlot, setUploadingSlot] = React.useState(null);

      // Improvements state
      const [stats, setStats] = React.useState({ total: 0, published: 0, missingExperience: 0, missingQuiz: 0, empty: 0 });
      const [searchQuery, setSearchQuery] = React.useState('');
      const [searchResults, setSearchResults] = React.useState([]);
      const [isSearching, setIsSearching] = React.useState(false);
      const [selectedChapterIds, setSelectedChapterIds] = React.useState([]);

      const [newClass, setNewClass] = React.useState({ name: '', display_order: 1 });
      const [newSubject, setNewSubject] = React.useState({ name: '', icon: '📚', description: '' });
      const [newChapter, setNewChapter] = React.useState({ title: '', description: '', chapter_order: 1, difficulty: 'Intermediate', tags: '' });
      const [newCustomMod, setNewCustomMod] = React.useState({ label: '', emoji: '⭐', renderer: 'iframe_full', description: '', isMulti: false });

      const ICON_PICKER = ['📚', '🔬', '🧪', '📐', '🌍', '📜', '🎨', '🎵', '🏃', '💻', '🏛️', '⚗️', '🌿', '🔭'];

      // Multi-Item Modal State (for Experiments / Stories)
      const [activeMultiModal, setActiveMultiModal] = React.useState(null); // { chapter, mod, itemIndex, itemData }

      // Bulk Folder Importer State
      const [showBulkFolderModal, setShowBulkFolderModal] = React.useState(false);
      const [parsedSubjectFolder, setParsedSubjectFolder] = React.useState(null);
      const [isBulkUploading, setIsBulkUploading] = React.useState(false);
      const [bulkUploadLogs, setBulkUploadLogs] = React.useState([]);

      const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(()=>setToast(null),3500); };

      React.useEffect(() => {
        loadClasses();
        loadStats();
      }, []);

      const loadStats = async () => {
        try {
          const r = await sb('course_chapters?select=id,title,is_published,experience_ready,quiz_ready,stories_ready,experiments_ready');
          const d = await r.json();
          if (Array.isArray(d)) {
            const total = d.length;
            const published = d.filter(c => c.is_published).length;
            const missingExp = d.filter(c => !c.experience_ready).length;
            const missingQuiz = d.filter(c => !c.quiz_ready).length;
            const empty = d.filter(c => !c.experience_ready && !c.quiz_ready && !c.stories_ready && !c.experiments_ready).length;
            setStats({ total, published, missingExperience: missingExp, missingQuiz, empty });
          }
        } catch(e) {}
      };

      const handleGlobalSearch = async (query) => {
        setSearchQuery(query);
        if (!query.trim()) { setSearchResults([]); setIsSearching(false); return; }
        setIsSearching(true);
        try {
          const r = await sb(`course_chapters?title=ilike.*${encodeURIComponent(query.trim())}*&select=id,title,class_name,subject_name,is_published,chapter_order`);
          const d = await r.json();
          setSearchResults(Array.isArray(d) ? d : []);
        } catch(e) { setSearchResults([]); }
        setIsSearching(false);
      };

      const exportCurriculumJSON = async () => {
        try {
          const r = await sb('course_chapters?select=*&order=class_name,subject_name,chapter_order');
          const d = await r.json();
          const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `curriculum_backup_${new Date().toISOString().slice(0,10)}.json`;
          a.click();
          showToast('✅ Curriculum backup downloaded!');
        } catch(e) { showToast('Export failed', 'error'); }
      };

      const bulkAction = async (actionType) => {
        if (selectedChapterIds.length === 0) return;
        try {
          const ids = selectedChapterIds.join(',');
          if (actionType === 'publish') {
            await sb(`course_chapters?id=in.(${ids})`, { method: 'PATCH', body: JSON.stringify({ is_published: true }) });
            showToast(`🚀 Published ${selectedChapterIds.length} chapters!`);
          } else if (actionType === 'unpublish') {
            await sb(`course_chapters?id=in.(${ids})`, { method: 'PATCH', body: JSON.stringify({ is_published: false }) });
            showToast(`📴 Unpublished ${selectedChapterIds.length} chapters!`);
          } else if (actionType === 'delete') {
            if (!window.confirm(`Delete ${selectedChapterIds.length} selected chapters?`)) return;
            await sb(`course_chapters?id=in.(${ids})`, { method: 'DELETE' });
            showToast(`🗑️ Deleted ${selectedChapterIds.length} chapters!`);
          }
          setSelectedChapterIds([]);
          if (selectedSubject) loadChapters(selectedSubject);
          loadStats();
        } catch(e) { showToast('Bulk action failed', 'error'); }
      };

      const calcChapterProgressScore = (ch) => {
        let earned = 0;
        if (ch.experience_url && typeof ch.experience_url === 'string' && ch.experience_url.trim() !== '') earned += 1;

        const expList = Array.isArray(ch.experiments_list) && ch.experiments_list.length > 0 ? ch.experiments_list : (ch.experiments_url ? [1] : []);
        earned += Math.min(expList.length, 4);

        if (ch.quiz_url && typeof ch.quiz_url === 'string' && ch.quiz_url.trim() !== '') earned += 1;

        const storiesList = Array.isArray(ch.stories_list) && ch.stories_list.length > 0 ? ch.stories_list : (ch.stories_url ? [1] : []);
        earned += Math.min(storiesList.length, 4);

        return Math.min(100, Math.round((earned / 10) * 100));
      };

      const loadClasses = async () => {
        setLoading(true);
        try {
          const rClass = await sb('classes?select=*&order=display_order');
          const dClass = await rClass.json();
          const loadedClasses = Array.isArray(dClass) ? dClass : [];

          // Fetch all subjects & chapters to compute dynamic class upload progress
          const rSubj = await sb('subjects?select=id,class_id');
          const dSubj = await rSubj.json();
          const loadedSubjects = Array.isArray(dSubj) ? dSubj : [];

          const rChap = await sb('course_chapters?select=id,subject_id,experience_url,quiz_url,experiments_list,experiments_url,stories_list,stories_url');
          const dChap = await rChap.json();
          const loadedChaps = Array.isArray(dChap) ? dChap : [];

          // Compute progress for each subject
          const subjectPercents = {};
          loadedSubjects.forEach(s => {
            const chaps = loadedChaps.filter(c => c.subject_id === s.id);
            if (chaps.length === 0) {
              subjectPercents[s.id] = 0;
            } else {
              const sum = chaps.reduce((acc, c) => acc + calcChapterProgressScore(c), 0);
              subjectPercents[s.id] = Math.round(sum / chaps.length);
            }
          });

          // Compute progress for each class
          const computedClasses = loadedClasses.map(c => {
            const subs = loadedSubjects.filter(s => s.class_id === c.id);
            if (subs.length === 0) {
              return { ...c, progress: 0, subject_count: 0 };
            }
            const sumSubj = subs.reduce((acc, s) => acc + (subjectPercents[s.id] || 0), 0);
            const avgProgress = Math.round(sumSubj / subs.length);
            return { ...c, progress: avgProgress, subject_count: subs.length };
          });

          setClasses(computedClasses);
        } catch(e) { setClasses([]); }
        setLoading(false);
      };

      const loadSubjects = async (cls) => {
        setLoading(true);
        try {
          const r = await sb(`subjects?select=*&class_id=eq.${cls.id}&order=name`);
          const d = await r.json();
          const loadedSubjects = Array.isArray(d) ? d : [];

          // Fetch chapters for all subjects in this class to compute dynamic subject progress
          const subjectIds = loadedSubjects.map(s => s.id);
          let loadedChaps = [];
          if (subjectIds.length > 0) {
            const rChap = await sb(`course_chapters?select=id,subject_id,experience_url,quiz_url,experiments_list,experiments_url,stories_list,stories_url&subject_id=in.(${subjectIds.join(',')})`);
            const dChap = await rChap.json();
            if (Array.isArray(dChap)) loadedChaps = dChap;
          }

          const computedSubjects = loadedSubjects.map(s => {
            const chaps = loadedChaps.filter(c => c.subject_id === s.id);
            if (chaps.length === 0) {
              return { ...s, progress: 0, chapter_count: 0 };
            }
            const sum = chaps.reduce((acc, c) => acc + calcChapterProgressScore(c), 0);
            const avgProgress = Math.round(sum / chaps.length);
            return { ...s, progress: avgProgress, chapter_count: chaps.length };
          });

          setSubjects(computedSubjects);
        } catch(e) { setSubjects([]); }
        setLoading(false);
      };

      const loadChapters = async (subj) => {
        setLoading(true);
        try {
          const r = await sb(`course_chapters?select=*&subject_id=eq.${subj.id}&order=chapter_order`);
          const d = await r.json();
          const loadedChapters = Array.isArray(d) ? d : [];
          setChapters(loadedChapters);
          // Load saved modality content for all chapters
          const mods = {};
          for (const ch of loadedChapters) {
            const allMods = [...DEFAULT_MODALITIES, ...(ch.custom_modalities||[])];
            mods[ch.id] = {};
            allMods.forEach(m => {
              if (m.slug === 'experiments') {
                mods[ch.id][m.slug] = Array.isArray(ch.experiments_list) && ch.experiments_list.length > 0 ? ch.experiments_list : (ch.experiments_url ? [{ id: 'exp_1', title: 'Default Lab', author: 'by Platform', badge: 'Ready', likes: '10k', icon: '🧪', gradient: 'linear-gradient(135deg, #00F0FF, #0070F3)', color: '#00F0FF', url: ch.experiments_url }] : []);
              } else if (m.slug === 'stories') {
                mods[ch.id][m.slug] = Array.isArray(ch.stories_list) && ch.stories_list.length > 0 ? ch.stories_list : (ch.stories_url ? [{ id: 'story_1', title: 'Chapter Story Video', tag: 'LESSON', duration: '5:00', description: 'Interactive video lesson', thumbnail_url: '', url: ch.stories_url }] : []);
              } else if (m.slug === 'front_visuals') {
                mods[ch.id][m.slug] = ch.front_visuals_url || ch.scene_3d_model_url || ch.modality_urls?.front_visuals || '';
              } else {
                mods[ch.id][m.slug] = ch[`${m.slug}_url`] || ch.modality_urls?.[m.slug] || '';
              }
            });
          }
          setChapterModalities(mods);
        } catch(e) { setChapters([]); }
        setLoading(false);
      };

      const addClass = async () => {
        if (!newClass.name.trim()) return showToast('Class name required', 'error');
        try {
          const r = await sb('classes', { method: 'POST', body: JSON.stringify({ name: newClass.name.trim(), display_order: parseInt(newClass.display_order)||1, status: 'Active' }) });
          const d = await r.json();
          if (r.ok) { showToast(`✅ ${newClass.name} created!`); setNewClass({ name:'', display_order:1 }); setShowAddClass(false); loadClasses(); }
          else showToast(d.message||'Error creating class', 'error');
        } catch(e) { showToast('Network error', 'error'); }
      };

      const addSubject = async () => {
        if (!newSubject.name.trim()) return showToast('Subject name required', 'error');
        try {
          const r = await sb('subjects', { method: 'POST', body: JSON.stringify({ class_id: selectedClass.id, name: newSubject.name.trim(), icon: newSubject.icon||'📚', description: newSubject.description }) });
          const d = await r.json();
          if (r.ok) { showToast(`✅ ${newSubject.name} created!`); setNewSubject({ name:'', icon:'📚', description:'' }); setShowAddSubject(false); loadSubjects(selectedClass); }
          else showToast(d.message||'Error creating subject', 'error');
        } catch(e) { showToast('Network error', 'error'); }
      };

      const addChapter = async () => {
        if (!newChapter.title.trim()) return showToast('Chapter title required', 'error');
        const slug = newChapter.title.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-');
        try {
          const payload = {
            subject_id: selectedSubject.id, class_name: selectedClass.name, subject_name: selectedSubject.name,
            chapter_order: parseInt(newChapter.chapter_order)||1, chapter_slug: slug,
            title: newChapter.title.trim().toUpperCase(), description: newChapter.description,
            experience_ready: false, experiments_ready: false, quiz_ready: false, mixed_reality_ready: false, stories_ready: false,
            is_published: false, custom_modalities: [], experiments_list: [], stories_list: []
          };
          const r = await sb('course_chapters', { method: 'POST', body: JSON.stringify(payload) });
          const d = await r.json();
          if (r.ok) { showToast(`✅ Chapter "${newChapter.title.toUpperCase()}" created!`); setNewChapter({ title:'', description:'', chapter_order:1 }); setShowAddChapter(false); loadChapters(selectedSubject); }
          else showToast(d.message||'Error creating chapter', 'error');
        } catch(e) { showToast('Network error', 'error'); }
      };

      const addCustomModality = () => {
        if (!newCustomMod.label.trim()) return showToast('Modality name required', 'error');
        const slug = 'custom_' + newCustomMod.label.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_');
        setCustomModalities(prev => [...prev, { ...newCustomMod, slug, color: '#94A3B8', isCustom: true }]);
        setNewCustomMod({ label:'', emoji:'⭐', renderer:'iframe_full', description:'', isMulti: false });
        setShowAddCustomModal(false);
        showToast(`✅ Custom modality "${newCustomMod.label}" added!`);
      };

      const saveModalityUrl = async (chapter, slug, url) => {
        const isDefault = DEFAULT_MODALITIES.some(m => m.slug === slug);
        try {
          let updatePayload;
          if (slug === 'front_visuals') {
            updatePayload = {
              front_visuals_url: url,
              scene_3d_model_url: url,
              front_visuals_ready: !!url,
              modality_urls: { ...(chapter.modality_urls || {}), front_visuals: url }
            };
          } else if (isDefault) {
            updatePayload = {
              [`${slug}_url`]: url,
              [`${slug}_ready`]: !!url,
              modality_urls: { ...(chapter.modality_urls || {}), [slug]: url }
            };
          } else {
            const current = chapter.modality_urls || {};
            updatePayload = { modality_urls: { ...current, [slug]: url } };
          }
          const r = await sb(`course_chapters?id=eq.${chapter.id}`, { method: 'PATCH', body: JSON.stringify(updatePayload) });
          if (r.ok) {
            showToast('✅ Content link saved!');
            setChapterModalities(prev => ({ ...prev, [chapter.id]: { ...prev[chapter.id], [slug]: url } }));
          } else {
            const err = await r.json();
            showToast(err.message || 'Save failed', 'error');
          }
        } catch(e) { showToast('Network error', 'error'); }
      };

      const saveMultiItemList = async (chapter, slug, newList) => {
        try {
          const colName = `${slug}_list`;
          const firstUrl = newList.length > 0 ? (newList[0].url || '') : '';
          const updatePayload = {
            [colName]: newList,
            [`${slug}_url`]: firstUrl,
            [`${slug}_ready`]: newList.length > 0
          };
          const r = await sb(`course_chapters?id=eq.${chapter.id}`, { method: 'PATCH', body: JSON.stringify(updatePayload) });
          if (r.ok) {
            showToast(`✅ Updated ${newList.length} items in ${slug}!`);
            setChapterModalities(prev => ({
              ...prev,
              [chapter.id]: { ...prev[chapter.id], [slug]: newList }
            }));
          } else {
            showToast('Failed to save items', 'error');
          }
        } catch(e) { showToast('Network error', 'error'); }
      };

      const publishChapter = async (chapter) => {
        const r = await sb(`course_chapters?id=eq.${chapter.id}`, { method: 'PATCH', body: JSON.stringify({ is_published: !chapter.is_published }) });
        if (r.ok) { showToast(chapter.is_published ? '📴 Chapter unpublished' : '🚀 Chapter published LIVE!'); loadChapters(selectedSubject); }
        else showToast('Update failed', 'error');
      };

      const deleteChapter = async (chapter) => {
        if (!window.confirm(`Delete chapter "${chapter.title}"? This cannot be undone.`)) return;
        try {
          const r = await sb(`course_chapters?id=eq.${chapter.id}`, { method: 'DELETE' });
          const d = await r.json();
          if (r.ok && Array.isArray(d) && d.length > 0) {
            showToast(`🗑️ Deleted chapter "${chapter.title}"`);
            if (selectedSubject) loadChapters(selectedSubject);
            loadClasses();
          } else {
            showToast(d.message || 'Delete failed', 'error');
          }
        } catch(e) {
          showToast('Network error on delete', 'error');
        }
      };

      const helperUploadFileOrReadUrl = async (file) => {
        if (!file) return '';
        if (file.name.endsWith('.url') || file.name.endsWith('.txt')) {
          try {
            const text = await file.text();
            const match = text.match(/https?:\/\/[^\s]+/);
            if (match) return match[0];
          } catch(e) {}
        }
        return URL.createObjectURL(file);
      };

      const handleFolderSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setBulkUploadLogs([]);
        const chaptersMap = {};
        let rootSubjectName = '';

        for (const file of files) {
          const path = file.webkitRelativePath || file.name;
          const parts = path.split(/[/\\]/);
          if (parts.length < 2) continue;

          if (!rootSubjectName && parts.length >= 3) {
            rootSubjectName = parts[0];
          }

          let chapterFolder = '';
          let modFolder = '';

          if (parts.length >= 4) {
            chapterFolder = parts[1];
            modFolder = parts[2].toLowerCase();
          } else if (parts.length === 3) {
            chapterFolder = parts[0];
            modFolder = parts[1].toLowerCase();
          } else continue;

          if (!chapterFolder || !modFolder) continue;

          let slug = '';
          if (modFolder.includes('front') || modFolder.includes('visual') || modFolder.includes('hero') || modFolder.includes('scene')) slug = 'front_visuals';
          else if (modFolder.includes('experience') || modFolder.includes('simulation') || modFolder.includes('3d')) slug = 'experience';
          else if (modFolder.includes('experiment') || modFolder.includes('lab')) slug = 'experiments';
          else if (modFolder.includes('quiz') || modFolder.includes('test') || modFolder.includes('exam')) slug = 'quiz';
          else if (modFolder.includes('mixed') || modFolder.includes('mr') || modFolder.includes('vr') || modFolder.includes('ar')) slug = 'mixed_reality';
          else if (modFolder.includes('stori') || modFolder.includes('video') || modFolder.includes('lesson')) slug = 'stories';

          if (!slug) continue;

          if (!chaptersMap[chapterFolder]) {
            const cleanTitle = chapterFolder.replace(/_/g, ' ').replace(/^ch(apter)?\s*/i, '').trim().toUpperCase();
            chaptersMap[chapterFolder] = {
              folderName: chapterFolder,
              title: cleanTitle || chapterFolder.toUpperCase(),
              front_visuals: null,
              front_description: '',
              experience: null,
              experiments: [],
              quiz: null,
              mixed_reality: null,
              stories: []
            };
          }

          const chObj = chaptersMap[chapterFolder];

          if (slug === 'front_visuals') {
            if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
              try {
                const txt = await file.text();
                chObj.front_description = txt.trim();
              } catch(e) {}
            } else {
              chObj.front_visuals = file;
            }
          } else if (slug === 'experience' || slug === 'quiz' || slug === 'mixed_reality') {
            if (!chObj[slug]) chObj[slug] = file;
          } else if (slug === 'experiments') {
            chObj.experiments.push(file);
          } else if (slug === 'stories') {
            chObj.stories.push(file);
          }
        }

        const chaptersList = Object.values(chaptersMap);
        setParsedSubjectFolder({
          subjectName: rootSubjectName || selectedSubject?.name || 'Uploaded Subject',
          chapters: chaptersList
        });
      };

      const processBulkSubjectUpload = async () => {
        if (!parsedSubjectFolder || parsedSubjectFolder.chapters.length === 0) {
          return showToast('No chapters found in selected folder', 'error');
        }

        setIsBulkUploading(true);
        setBulkUploadLogs([`🚀 Starting Bulk Batch Import for "${parsedSubjectFolder.subjectName}"...`]);

        try {
          let targetSubject = selectedSubject;

          if (!targetSubject && selectedClass) {
            const subjName = parsedSubjectFolder.subjectName.replace(/_/g, ' ');
            setBulkUploadLogs(prev => [...prev, `🔍 Looking up subject "${subjName}"...`]);

            const r = await sb(`subjects?select=*&class_id=eq.${selectedClass.id}&name=ilike.${encodeURIComponent(subjName)}`);
            const existing = await r.json();
            if (Array.isArray(existing) && existing.length > 0) {
              targetSubject = existing[0];
              setBulkUploadLogs(prev => [...prev, `✓ Found subject "${targetSubject.name}"`]);
            } else {
              setBulkUploadLogs(prev => [...prev, `✚ Creating new subject "${subjName}"...`]);
              const rNew = await sb('subjects', { method: 'POST', body: JSON.stringify({ class_id: selectedClass.id, name: subjName, icon: '📚', description: 'Bulk Uploaded Subject' }) });
              const dNew = await rNew.json();
              if (Array.isArray(dNew) && dNew.length > 0) {
                targetSubject = dNew[0];
                setBulkUploadLogs(prev => [...prev, `✓ Created subject "${targetSubject.name}"`]);
              }
            }
          }

          if (!targetSubject) {
            setBulkUploadLogs(prev => [...prev, `❌ Error: Please select a Class & Subject first!`]);
            setIsBulkUploading(false);
            return;
          }

          const rChap = await sb(`course_chapters?select=*&subject_id=eq.${targetSubject.id}`);
          const existingChapters = await rChap.json();
          const existingMap = Array.isArray(existingChapters) ? existingChapters : [];

          let count = 0;
          for (const ch of parsedSubjectFolder.chapters) {
            count++;
            setBulkUploadLogs(prev => [...prev, `\n[${count}/${parsedSubjectFolder.chapters.length}] Processing Chapter: "${ch.title}"...`]);

            let chapterRecord = existingMap.find(ex => ex.title.toUpperCase() === ch.title.toUpperCase() || ex.chapter_slug === ch.folderName.toLowerCase());

            if (!chapterRecord) {
              setBulkUploadLogs(prev => [...prev, `  ✚ Creating chapter "${ch.title}" in Supabase...`]);
              const slug = ch.folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              const payload = {
                subject_id: targetSubject.id,
                chapter_order: count,
                chapter_slug: slug,
                title: ch.title,
                description: `Auto-created chapter for ${ch.title}`,
                is_published: true,
                experiments_list: [],
                stories_list: []
              };
              const rPost = await sb('course_chapters', { method: 'POST', body: JSON.stringify(payload) });
              const dPost = await rPost.json();
              if (Array.isArray(dPost) && dPost.length > 0) {
                chapterRecord = dPost[0];
                setBulkUploadLogs(prev => [...prev, `  ✓ Chapter created successfully`]);
              }
            } else {
              setBulkUploadLogs(prev => [...prev, `  ✓ Chapter found in database`]);
            }

            if (!chapterRecord) continue;

            const updates = {};

            // 0. Front Visuals & Description
            if (ch.front_visuals || ch.front_description) {
              if (ch.front_visuals) {
                const fUrl = await helperUploadFileOrReadUrl(ch.front_visuals);
                updates.front_visuals_url = fUrl;
                updates.scene_3d_model_url = fUrl;
                updates.front_visuals_ready = true;
              }
              if (ch.front_description) {
                updates.description = ch.front_description;
              }
              setBulkUploadLogs(prev => [...prev, `  ✓ Linked Front Visuals 3D Scene & Description`]);
            }

            // 1. Experience
            if (ch.experience) {
              const expUrl = await helperUploadFileOrReadUrl(ch.experience);
              updates.experience_url = expUrl;
              updates.experience_ready = true;
              setBulkUploadLogs(prev => [...prev, `  ✓ Linked Experience App`]);
            }

            // 2. Experiments (Multi-item)
            if (ch.experiments && ch.experiments.length > 0) {
              const expList = [];
              let expIdx = 1;
              for (const fileItem of ch.experiments) {
                const itemUrl = await helperUploadFileOrReadUrl(fileItem);
                const labTitle = fileItem.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').toUpperCase();
                expList.push({
                  id: `exp_${Date.now()}_${expIdx}`,
                  title: labTitle || `Virtual Lab ${expIdx}`,
                  author: 'by Platform',
                  badge: 'Virtual Lab',
                  likes: '10k',
                  icon: '🧪',
                  gradient: 'linear-gradient(135deg, #00F0FF, #0070F3)',
                  color: '#00F0FF',
                  url: itemUrl
                });
                expIdx++;
              }
              updates.experiments_list = expList;
              updates.experiments_url = expList[0]?.url || '';
              updates.experiments_ready = expList.length > 0;
              setBulkUploadLogs(prev => [...prev, `  ✓ Linked ${expList.length} Lab Experiments`]);
            }

            // 3. Quiz
            if (ch.quiz) {
              const quizUrl = await helperUploadFileOrReadUrl(ch.quiz);
              updates.quiz_url = quizUrl;
              updates.quiz_ready = true;
              setBulkUploadLogs(prev => [...prev, `  ✓ Linked Assessment Quiz`]);
            }

            // 4. Mixed Reality
            if (ch.mixed_reality) {
              const mrUrl = await helperUploadFileOrReadUrl(ch.mixed_reality);
              updates.mixed_reality_url = mrUrl;
              updates.mixed_reality_ready = true;
              setBulkUploadLogs(prev => [...prev, `  ✓ Linked Mixed Reality Scene`]);
            }

            // 5. Stories (Multi-item)
            if (ch.stories && ch.stories.length > 0) {
              const storiesList = [];
              let stIdx = 1;
              for (const fileItem of ch.stories) {
                const itemUrl = await helperUploadFileOrReadUrl(fileItem);
                const storyTitle = fileItem.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').toUpperCase();
                storiesList.push({
                  id: `story_${Date.now()}_${stIdx}`,
                  title: storyTitle || `Video Lesson ${stIdx}`,
                  tag: 'LESSON',
                  duration: '5:00',
                  description: 'Chapter video lesson',
                  thumbnail_url: '',
                  url: itemUrl
                });
                stIdx++;
              }
              updates.stories_list = storiesList;
              updates.stories_url = storiesList[0]?.url || '';
              updates.stories_ready = storiesList.length > 0;
              setBulkUploadLogs(prev => [...prev, `  ✓ Linked ${storiesList.length} Story Videos`]);
            }

            await sb(`course_chapters?id=eq.${chapterRecord.id}`, { method: 'PATCH', body: JSON.stringify(updates) });
            setBulkUploadLogs(prev => [...prev, `  🎉 Chapter "${ch.title}" synced & updated!`]);
          }

          setBulkUploadLogs(prev => [...prev, `\n✅ ALL CHAPTERS & CONTENT SUCCESSFULLY IMPORTED!`]);
          showToast('🎉 Bulk Folder Upload & Sync Complete!');
          if (targetSubject) {
            setSelectedSubject(targetSubject);
            loadChapters(targetSubject);
          }
          loadClasses();
        } catch (err) {
          setBulkUploadLogs(prev => [...prev, `❌ Error: ${err.message}`]);
        }
        setIsBulkUploading(false);
      };

      const resolvePreviewUrl = (rawUrl) => {
        if (!rawUrl) return '';
        let clean = rawUrl.trim();
        if (clean.includes('youtube.com/watch')) {
          const v = clean.split('v=')[1]?.split('&')[0];
          if (v) return `https://www.youtube.com/embed/${v}?autoplay=1`;
        } else if (clean.includes('youtu.be/')) {
          const v = clean.split('youtu.be/')[1]?.split('?')[0];
          if (v) return `https://www.youtube.com/embed/${v}?autoplay=1`;
        }
        if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('/')) {
          return `/study-island/${clean}`;
        }
        return clean;
      };

      // ── MULTI-ITEM MODALITY SLOT (Experiments & Stories) ──
      const MultiItemModalitySlot = ({ chapter, mod }) => {
        const items = Array.isArray(chapterModalities[chapter.id]?.[mod.slug]) ? chapterModalities[chapter.id][mod.slug] : [];
        const isExperiments = mod.slug === 'experiments';
        const [isExpanded, setIsExpanded] = React.useState(true);

        const deleteItem = (idx) => {
          if (!window.confirm(`Remove "${items[idx]?.title || 'item'}"?`)) return;
          const updated = items.filter((_, i) => i !== idx);
          saveMultiItemList(chapter, mod.slug, updated);
        };

        return (
          <div className="rounded-xl p-3.5 space-y-3 transition-all" style={{ border: `1px solid ${mod.color}40`, background: `${mod.color}0a` }}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{mod.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{mod.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold" style={{background: `${mod.color}25`, color: mod.color, border: `1px solid ${mod.color}50`}}>
                      {items.length} {isExperiments ? (items.length===1?'Experiment':'Experiments') : (items.length===1?'Story / Video':'Stories / Videos')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{mod.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveMultiModal({ chapter, mod, isNew: true, itemData: isExperiments ? { title:'', author:'by Platform', badge:'Latest!', likes:'10k', icon:'🧪', color:'#00E5FF', url:'' } : { title:'', tag:'DOCUMENTARY', duration:'5:00', description:'', thumbnail_url:'', url:'' } })}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow transition"
                  style={{background: `${mod.color}25`, border: `1px solid ${mod.color}60`, color: mod.color}}>
                  <i className="ph ph-plus-circle text-sm"></i> Add {isExperiments ? 'Experiment' : 'Story'}
                </button>
                <button onClick={() => setIsExpanded(!isExpanded)} className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs">
                  {isExpanded ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {/* List of Items */}
            {isExpanded && (
              <div className="space-y-2 pt-1 border-t border-slate-700/40">
                {items.length === 0 ? (
                  <div className="p-4 text-center rounded-lg border border-dashed border-slate-700 bg-slate-900/40">
                    <p className="text-xs text-slate-400">No {isExperiments ? 'experiments' : 'stories'} added yet.</p>
                    <button
                      onClick={() => setActiveMultiModal({ chapter, mod, isNew: true, itemData: isExperiments ? { title:'New Lab', author:'by Platform', badge:'Ready', likes:'5k', icon:'🧪', color:'#00E5FF', url:'' } : { title:'New Story', tag:'DOCUMENTARY', duration:'4:00', description:'', thumbnail_url:'', url:'' } })}
                      className="mt-2 text-[11px] font-bold text-cyan-400 hover:underline">
                      + Click to Add First {isExperiments ? 'Experiment' : 'Story'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {items.map((item, idx) => {
                      const finalUrl = resolvePreviewUrl(item.url);
                      return (
                        <div key={item.id || idx} className="glass-panel p-3 rounded-xl border border-slate-700/70 bg-slate-900/80 flex flex-col justify-between space-y-2 hover:border-cyan-500/40 transition">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              {isExperiments ? (
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow flex-shrink-0" style={{background: item.gradient || `linear-gradient(135deg, ${item.color||'#00E5FF'}, #3B82F6)`}}>
                                  {item.icon || '🧪'}
                                </div>
                              ) : (
                                <div className="w-14 h-10 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                                  {item.thumbnail_url ? (
                                    <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-lg">🎬</span>
                                  )}
                                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                    <i className="ph ph-play-fill text-xs text-white"></i>
                                  </div>
                                </div>
                              )}
                              <div className="overflow-hidden">
                                <div className="flex items-center gap-1.5">
                                  <h5 className="text-xs font-bold text-white truncate">{item.title || 'Untitled'}</h5>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded font-bold" style={{background: '#38BDF825', color: '#38BDF8', border: '1px solid #38BDF850'}}>
                                    {isExperiments ? (item.badge || 'Ready') : (item.tag || 'LESSON')}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {isExperiments ? `${item.author || 'by Platform'} • ♥ ${item.likes || '10k'}` : `⏱ ${item.duration || '5:00'} • ${item.description || 'Video Lesson'}`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => setActiveMultiModal({ chapter, mod, isNew: false, itemIndex: idx, itemData: { ...item } })}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700">
                                ✏️ Edit
                              </button>
                              <button onClick={() => deleteItem(idx)}
                                className="px-1.5 py-1 rounded bg-red-900/30 hover:bg-red-900/50 text-red-300 text-[10px] border border-red-700/40">
                                🗑️
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px]">
                            <span className="font-mono text-slate-400 truncate max-w-[220px]">{item.url || 'No URL attached'}</span>
                            {item.url && (
                              <a href={finalUrl} target="_blank" rel="noreferrer" className="px-2 py-0.5 rounded font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 transition">
                                <i className="ph ph-arrow-square-out text-xs"></i> Preview ↗
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      };

      // ── SINGLE-ITEM MODALITY SLOT (Front Visuals, Experience, Quiz, Mixed Reality) ──
      const SingleModalitySlot = ({ chapter, mod, isCustom=false }) => {
        const saved = chapterModalities[chapter.id]?.[mod.slug] || (mod.slug === 'front_visuals' ? (chapter.front_visuals_url || chapter.scene_3d_model_url || chapter.modality_urls?.front_visuals) : (chapter[`${mod.slug}_url`] || chapter.modality_urls?.[mod.slug])) || '';
        const [url, setUrl] = React.useState(saved);
        const [editing, setEditing] = React.useState(false);
        const [uploading, setUploading] = React.useState(false);
        const [uploadProgress, setUploadProgress] = React.useState('');
        const [dragOver, setDragOver] = React.useState(false);
        const [desc, setDesc] = React.useState(chapter.description || '');
        const [editingDesc, setEditingDesc] = React.useState(false);
        const [savingDesc, setSavingDesc] = React.useState(false);
        const fileInputRef = React.useRef(null);
        const folderInputRef = React.useRef(null);

        React.useEffect(() => {
          setUrl(saved);
        }, [saved]);

        React.useEffect(() => {
          setDesc(chapter.description || '');
        }, [chapter.description]);

        const saveChapterDescription = async () => {
          setSavingDesc(true);
          try {
            const r = await sb(`course_chapters?id=eq.${chapter.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ description: desc })
            });
            if (r.ok) {
              showToast('✅ Chapter description saved!');
              setEditingDesc(false);
              chapter.description = desc;
              setChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, description: desc } : c));
            } else {
              const err = await r.json();
              showToast(err.message || 'Save failed', 'error');
            }
          } catch(e) {
            showToast('Network error saving description', 'error');
          } finally {
            setSavingDesc(false);
          }
        };

        const uploadFileToR2 = async (file) => {
          if (!file) return;
          setUploading(true);
          setUploadProgress(`Reading ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`);

          try {
            const reader = new FileReader();
            reader.onload = async (e) => {
              const base64Data = e.target.result.split(',')[1];
              setUploadProgress(`Uploading ${file.name} to Cloudflare R2...`);

              let authHeader = `Bearer ${SUPABASE_CONFIG.key}`;
              try {
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key && (key.startsWith('sb-') || key.includes('supabase')) && (key.endsWith('-auth-token') || key.endsWith('token'))) {
                    try {
                      const tokenData = JSON.parse(localStorage.getItem(key));
                      if (tokenData && tokenData.access_token) {
                        authHeader = `Bearer ${tokenData.access_token}`;
                        break;
                      }
                    } catch(err){}
                  }
                }
              } catch(e) {}

              try {
                const response = await fetch('/api/upload-r2', {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': authHeader
                  },
                  body: JSON.stringify({
                    className: selectedClass.name,
                    subjectName: selectedSubject.name,
                    chapterSlug: chapter.chapter_slug || chapter.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    modalitySlug: mod.slug,
                    filename: file.name,
                    base64Content: base64Data,
                    contentType: file.type || 'text/html'
                  })
                });

                const result = await response.json();
                if (result.ok && result.cdnUrl) {
                  setUrl(result.cdnUrl);
                  await saveModalityUrl(chapter, mod.slug, result.cdnUrl);
                  showToast(`✅ Uploaded & Linked "${file.name}" in Cloudflare R2!`);
                } else {
                  console.error('R2 upload failed:', result);
                  showToast(`❌ Upload failed: ${result.error || 'Server error'}`, 'error');
                }
              } catch (networkErr) {
                console.error('Network error during R2 upload:', networkErr);
                showToast(`❌ Upload error: ${networkErr.message}`, 'error');
              }
              setUploading(false);
              setUploadProgress('');
            };
            reader.readAsDataURL(file);
          } catch (err) {
            console.error('File read error:', err);
            showToast(`❌ File read error: ${err.message}`, 'error');
            setUploading(false);
            setUploadProgress('');
          }
        };

        const handleDrop = (e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            uploadFileToR2(e.dataTransfer.files[0]);
          }
        };

        const previewFinalUrl = resolvePreviewUrl(saved);

        return (
          <div 
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`transition-all relative rounded-xl p-3.5 ${dragOver ? 'border-2 border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-500/20' : ''}`}
            style={{ border: dragOver ? '2px solid #00F0FF' : `1px solid ${mod.color}33`, background: `${mod.color}08` }}>
            
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadFileToR2(e.target.files[0]); }} />
            <input type="file" ref={folderInputRef} webkitdirectory="true" directory="true" multiple className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadFileToR2(e.target.files[0]); }} />

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{mod.emoji}</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{mod.label}</span>
                    {isCustom && <span className="text-[9px] px-1.5 py-0.2 rounded" style={{background:'#94A3B822', color:'#94A3B8', border:'1px solid #94A3B840'}}>CUSTOM</span>}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{mod.description}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                {saved ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1" style={{background:'#34D39920', color:'#34D399', border:'1px solid #34D39940'}}>
                    <i className="ph ph-check-circle"></i> ✓ LINKED
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{background:'#F4722820', color:'#F47228', border:'1px solid #F4722840'}}>
                    EMPTY
                  </span>
                )}
              </div>
            </div>

            {uploading && (
              <div className="p-2.5 my-2 rounded-lg bg-cyan-950/70 border border-cyan-500/40 text-xs text-cyan-300 font-mono flex items-center gap-2 animate-pulse">
                <i className="ph ph-spinner animate-spin text-base"></i>
                <span>{uploadProgress}</span>
              </div>
            )}

            {editing ? (
              <div className="space-y-2 mt-2 pt-2 border-t border-slate-700/40">
                <div className="flex gap-2">
                  <input
                    type="text" 
                    placeholder="Paste Cloudflare R2 CDN URL, video link, or simulation link..."
                    value={url} 
                    onChange={e => setUrl(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none font-mono"
                  />
                  <button 
                    onClick={() => { saveModalityUrl(chapter, mod.slug, url); setEditing(false); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow" 
                    style={{background: mod.color + '44', border: `1px solid ${mod.color}88`}}>
                    Save Link
                  </button>
                  <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 bg-slate-800 border border-slate-700">✕</button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 px-3 rounded-lg border border-dashed border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 transition">
                    <i className="ph ph-file-arrow-up text-sm"></i> Upload File to R2
                  </button>
                  <button 
                    onClick={() => folderInputRef.current?.click()}
                    className="py-2 px-3 rounded-lg border border-dashed border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-bold flex items-center justify-center gap-1.5 transition">
                    <i className="ph ph-folder-arrow-up text-sm"></i> Upload Folder / Bundle
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-700/20">
                {saved ? (
                  <div className="flex-1 flex items-center gap-2 overflow-hidden">
                    <span className="text-[11px] text-cyan-300 font-mono truncate bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800">{saved}</span>
                    <a 
                      href={previewFinalUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 transition shadow">
                      <i className="ph ph-arrow-square-out text-xs"></i> Preview ↗
                    </a>
                  </div>
                ) : (
                  <span className="flex-1 text-[10px] text-slate-500 italic flex items-center gap-1">
                    <i className="ph ph-cloud-arrow-up"></i> Drop files here or click "Upload / Edit" to add content
                  </span>
                )}
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 flex items-center gap-1 transition">
                  <i className="ph ph-upload-simple"></i> Upload File
                </button>

                <button 
                  onClick={() => setEditing(true)} 
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center gap-1 transition">
                  <i className="ph ph-pencil-simple"></i> Edit Link
                </button>
              </div>
            )}

            {/* Chapter Text Description Area for Front Visuals */}
            {mod.slug === 'front_visuals' && (
              <div className="mt-3 pt-3 border-t border-slate-700/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <i className="ph ph-text-align-left text-cyan-400"></i> Chapter Text Description (Shown on Front Screen)
                  </span>
                  {!editingDesc && (
                    <button
                      onClick={() => setEditingDesc(true)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 flex items-center gap-1 transition"
                    >
                      <i className="ph ph-pencil-simple"></i> {desc ? 'Edit Description' : 'Add Description'}
                    </button>
                  )}
                </div>

                {editingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      placeholder="Enter the chapter description to display on Study Island..."
                      className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 outline-none leading-relaxed resize-none transition font-sans"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => { setDesc(chapter.description || ''); setEditingDesc(false); }}
                        className="px-3 py-1.5 rounded-lg text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveChapterDescription}
                        disabled={savingDesc}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow flex items-center gap-1.5 transition"
                        style={{ background: 'linear-gradient(135deg, #06B6D4, #3B82F6)', border: '1px solid #38BDF8' }}
                      >
                        {savingDesc ? <i className="ph ph-spinner animate-spin"></i> : <i className="ph ph-floppy-disk"></i>}
                        Save Description
                      </button>
                    </div>
                  </div>
                ) : (
                  desc ? (
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                      {desc}
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditingDesc(true)}
                      className="p-3 rounded-xl border border-dashed border-slate-700/70 hover:border-cyan-500/40 bg-slate-900/30 text-center cursor-pointer transition"
                    >
                      <span className="text-[11px] text-slate-500 italic flex items-center justify-center gap-1 hover:text-cyan-400">
                        <i className="ph ph-plus-circle"></i> Click to add a text description for this chapter
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        );
      };

      const ChapterCard = ({ chapter }) => {
        const [open, setOpen] = React.useState(false);
        const chapterCustomMods = chapter.custom_modalities || [];
        const allMods = [...DEFAULT_MODALITIES, ...chapterCustomMods, ...customModalities];
        
        const loadedMods = chapterModalities[chapter.id] || {};
        
        const expVal = loadedMods['experience'];
        const hasExp = expVal && typeof expVal === 'string' && expVal.trim() !== '';
        const expEarned = hasExp ? 1 : 0;

        const experimentsVal = loadedMods['experiments'];
        const expCount = Array.isArray(experimentsVal) ? experimentsVal.length : 0;
        const experimentsEarned = Math.min(expCount, 4);

        const quizVal = loadedMods['quiz'];
        const hasQuiz = quizVal && typeof quizVal === 'string' && quizVal.trim() !== '';
        const quizEarned = hasQuiz ? 1 : 0;

        const storiesVal = loadedMods['stories'];
        const storiesCount = Array.isArray(storiesVal) ? storiesVal.length : 0;
        const storiesEarned = Math.min(storiesCount, 4);

        const earnedPoints = expEarned + experimentsEarned + quizEarned + storiesEarned;
        const totalPointsRequired = 10;
        const uploadPercent = Math.min(100, Math.round((earnedPoints / totalPointsRequired) * 100));
        const isComplete = earnedPoints >= totalPointsRequired;

        return (
          <div className="rounded-2xl p-5 space-y-4 transition-all duration-300 shadow-2xl" 
               style={{
                 background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(7, 13, 24, 0.98) 100%)',
                 border: '1px solid rgba(0, 240, 255, 0.28)',
                 boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
               }}>
            
            {/* Main Header row */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800/90">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-black text-cyan-300 shadow-lg flex-shrink-0"
                     style={{ background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.25), rgba(59, 130, 246, 0.25))', border: '1px solid rgba(0, 240, 255, 0.5)' }}>
                  {chapter.chapter_order || '#'}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h4 className="text-base font-extrabold text-white tracking-wide">{chapter.title}</h4>
                    {chapter.difficulty && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-slate-800 text-cyan-300 border border-cyan-500/30">
                        {chapter.difficulty}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-1 mt-0.5 max-w-xl">{chapter.description || 'Interactive 3D curriculum chapter model.'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Complete Upload Check Status Badge */}
                <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 shadow-md ${
                  isComplete
                    ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-emerald-500/20'
                    : earnedPoints > 0
                    ? 'bg-amber-500/25 text-amber-300 border-amber-500/50'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700'
                }`}>
                  {isComplete ? '✅ 100% Uploaded' : earnedPoints > 0 ? `⌛ ${earnedPoints}/10 Completed` : '⚠️ 0/10 Uploaded'}
                </span>

                <button onClick={() => publishChapter(chapter)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition shadow flex items-center gap-1 ${
                    chapter.is_published 
                      ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/35' 
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}>
                  {chapter.is_published ? '🟢 LIVE' : '📴 DRAFT'}
                </button>

                <button onClick={() => setOpen(!open)} 
                  className="text-xs px-3.5 py-1.5 rounded-xl font-extrabold flex items-center gap-1.5 transition shadow"
                  style={{ background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.25), rgba(59, 130, 246, 0.25))', border: '1px solid rgba(0, 240, 255, 0.5)', color: '#00F0FF' }}>
                  {open ? '▲ Close Content' : '▼ Manage Content'}
                </button>

                <button onClick={() => deleteChapter(chapter)} className="text-xs p-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition" title="Delete Chapter">
                  🗑️
                </button>
              </div>
            </div>

            {/* Upload Progress Bar & Requirement Checklist */}
            <div className="rounded-xl p-3.5 space-y-2.5" style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="ph ph-cloud-arrow-up text-cyan-400 text-sm"></i> Upload Completion Check (Min Requirements)
                </span>
                <span className={`font-mono font-extrabold text-xs ${isComplete ? 'text-emerald-400' : 'text-cyan-300'}`}>
                  {earnedPoints} / {totalPointsRequired} Required Items Uploaded ({uploadPercent}%)
                </span>
              </div>

              {/* Progress track */}
              <div className="w-full h-3 bg-slate-900/90 rounded-full overflow-hidden border border-slate-700/80 relative">
                <div
                  className="h-full rounded-full transition-all duration-500 shadow-lg"
                  style={{
                    width: `${uploadPercent}%`,
                    background: isComplete
                      ? 'linear-gradient(90deg, #10B981, #34D399)'
                      : uploadPercent > 0
                      ? 'linear-gradient(90deg, #00F0FF, #3B82F6)'
                      : 'transparent'
                  }}
                />
              </div>

              {/* High-Contrast Requirement Checklist Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                {/* 1. Experience */}
                <div className={`px-3 py-1.5 rounded-lg border flex items-center justify-between font-mono font-bold transition ${
                  hasExp 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                    : 'bg-slate-800/80 border-slate-700/80 text-slate-300'
                }`}>
                  <span className="flex items-center gap-1">💡 1 Experience</span>
                  <span className={hasExp ? 'text-emerald-400 font-extrabold' : 'text-slate-400'}>{hasExp ? '✓ 1/1' : '0/1'}</span>
                </div>

                {/* 2. Experiments */}
                <div className={`px-3 py-1.5 rounded-lg border flex items-center justify-between font-mono font-bold transition ${
                  expCount >= 4 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                    : expCount > 0 
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                    : 'bg-slate-800/80 border-slate-700/80 text-slate-300'
                }`}>
                  <span className="flex items-center gap-1">🧪 4 Experiments</span>
                  <span className={expCount >= 4 ? 'text-emerald-400 font-extrabold' : expCount > 0 ? 'text-amber-300 font-extrabold' : 'text-slate-400'}>
                    {expCount >= 4 ? '✓ 4/4' : `${expCount}/4`}
                  </span>
                </div>

                {/* 3. Quiz */}
                <div className={`px-3 py-1.5 rounded-lg border flex items-center justify-between font-mono font-bold transition ${
                  hasQuiz 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                    : 'bg-slate-800/80 border-slate-700/80 text-slate-300'
                }`}>
                  <span className="flex items-center gap-1">📝 1 Quiz</span>
                  <span className={hasQuiz ? 'text-emerald-400 font-extrabold' : 'text-slate-400'}>{hasQuiz ? '✓ 1/1' : '0/1'}</span>
                </div>

                {/* 4. Stories Videos */}
                <div className={`px-3 py-1.5 rounded-lg border flex items-center justify-between font-mono font-bold transition ${
                  storiesCount >= 4 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                    : storiesCount > 0 
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                    : 'bg-slate-800/80 border-slate-700/80 text-slate-300'
                }`}>
                  <span className="flex items-center gap-1">📖 4 Stories</span>
                  <span className={storiesCount >= 4 ? 'text-emerald-400 font-extrabold' : storiesCount > 0 ? 'text-amber-300 font-extrabold' : 'text-slate-400'}>
                    {storiesCount >= 4 ? '✓ 4/4' : `${storiesCount}/4`}
                  </span>
                </div>
              </div>
            </div>

            {/* Expandable Management Accordion */}
            {open && (
              <div className="mt-4 space-y-4 pt-3 border-t border-slate-800/90">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <i className="ph ph-folder-open text-base"></i> Content Modality Slots for "{chapter.title}"
                  </p>
                  <button onClick={() => setShowAddCustomModal(true)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-bold transition shadow" style={{background:'#A78BFA20', border:'1px solid #A78BFA50', color:'#C4B5FD'}}>
                    <i className="ph ph-plus-circle text-sm"></i> Add Custom Modality
                  </button>
                </div>
                {/* Default Modalities — always shown */}
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                    <i className="ph ph-stack text-cyan-400"></i> Standard Modalities (5 Slots)
                  </p>
                  {DEFAULT_MODALITIES.map(mod => (
                    mod.isMulti ? (
                      <MultiItemModalitySlot key={mod.slug} chapter={chapter} mod={mod} />
                    ) : (
                      <SingleModalitySlot key={mod.slug} chapter={chapter} mod={mod} isCustom={false} />
                    )
                  ))}
                </div>
                {/* Custom Modalities — added by admin */}
                {[...chapterCustomMods, ...customModalities].length > 0 && (
                  <div className="space-y-3 mt-3">
                    <p className="text-xs text-purple-300 font-bold uppercase tracking-widest flex items-center gap-1">
                      <i className="ph ph-sparkle text-purple-400"></i> Custom Modalities
                    </p>
                    {[...chapterCustomMods, ...customModalities].map(mod => (
                      mod.isMulti ? (
                        <MultiItemModalitySlot key={mod.slug} chapter={chapter} mod={mod} />
                      ) : (
                        <SingleModalitySlot key={mod.slug} chapter={chapter} mod={mod} isCustom={true} />
                      )
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      

      };

      const breadcrumb = [
        { label: 'All Classes', action: () => { setStep('classes'); setSelectedClass(null); setSelectedSubject(null); } },
        selectedClass && { label: selectedClass.name, action: () => { setStep('subjects'); setSelectedSubject(null); } },
        selectedSubject && { label: selectedSubject.icon + ' ' + selectedSubject.name, action: () => setStep('chapters') },
        selectedChapter && { label: selectedChapter.title },
      ].filter(Boolean);

      return (
        <div className="space-y-5 relative">
          {/* Toast */}
          {toast && (
            <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold ${
              toast.type==='error' ? 'bg-red-900/90 text-red-300 border border-red-600' : 'bg-emerald-900/90 text-emerald-300 border border-emerald-600'
            }`}>{toast.msg}</div>
          )}

          {/* Header & Controls */}
          <div className="glass-panel p-5 border border-cyan-500/25 bg-cyan-950/10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-2xl">📚</div>
                <div>
                  <h2 className="font-extrabold text-white text-lg">Course Curriculum Hub</h2>
                  <p className="text-xs text-slate-400">Create Classes, Subjects &amp; Chapters — Upload the 5 Default Modality Slots + Custom Modalities. Auto-syncs to Study Island &amp; Student Portal.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportCurriculumJSON}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center gap-1.5"
                >
                  <i className="ph ph-download-simple"></i> Backup JSON
                </button>
                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-2">
                  {breadcrumb.map((b,i) => (
                    <React.Fragment key={i}>
                      {i>0 && <span className="text-slate-600">/</span>}
                      <button onClick={b.action} className={`hover:text-cyan-400 transition ${i===breadcrumb.length-1?'text-white font-bold':'text-slate-400'}`}>{b.label}</button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            {/* 1. Completion Dashboard Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-800 text-xs">
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total Chapters</span>
                <p className="text-lg font-extrabold text-white mt-0.5">{stats.total}</p>
              </div>
              <div className="bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-500/30">
                <span className="text-emerald-400 text-[10px] uppercase font-bold">Published Live</span>
                <p className="text-lg font-extrabold text-emerald-300 mt-0.5">{stats.published} <span className="text-xs font-normal text-slate-400">({stats.total?Math.round(stats.published/stats.total*100):0}%)</span></p>
              </div>
              <div className="bg-amber-950/30 p-2.5 rounded-xl border border-amber-500/30">
                <span className="text-amber-400 text-[10px] uppercase font-bold">Missing Experience</span>
                <p className="text-lg font-extrabold text-amber-300 mt-0.5">{stats.missingExperience}</p>
              </div>
              <div className="bg-purple-950/30 p-2.5 rounded-xl border border-purple-500/30">
                <span className="text-purple-400 text-[10px] uppercase font-bold">Missing Quiz</span>
                <p className="text-lg font-extrabold text-purple-300 mt-0.5">{stats.missingQuiz}</p>
              </div>
              <div className="bg-red-950/30 p-2.5 rounded-xl border border-red-500/30">
                <span className="text-red-400 text-[10px] uppercase font-bold">Empty Chapters</span>
                <p className="text-lg font-extrabold text-red-300 mt-0.5">{stats.empty}</p>
              </div>
            </div>

            {/* 2. Global Chapter Search Bar */}
            <div className="relative">
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs">
                <i className="ph ph-magnifying-glass text-slate-400 mr-2 text-sm"></i>
                <input
                  type="text"
                  placeholder="Global Search: Type chapter title (e.g. LIGHT, SPACE, FRACTIONS)..."
                  value={searchQuery}
                  onChange={e => handleGlobalSearch(e.target.value)}
                  className="bg-transparent flex-1 text-white outline-none placeholder-slate-500"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="text-slate-400 hover:text-white text-xs">✕</button>
                )}
              </div>

              {/* Search Results Overlay Dropdown */}
              {searchQuery && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-cyan-500/40 rounded-xl shadow-2xl p-3 z-50 space-y-2 max-h-60 overflow-y-auto">
                  {isSearching ? (
                    <p className="text-xs text-slate-400 p-2">Searching across curriculum...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs text-slate-400 p-2">No chapters matching "{searchQuery}"</p>
                  ) : (
                    searchResults.map(res => (
                      <div
                        key={res.id}
                        onClick={() => {
                          setSearchQuery('');
                          setSearchResults([]);
                          setStep('chapters');
                          setSelectedClass({ name: res.class_name });
                          setSelectedSubject({ name: res.subject_name, icon: '📚' });
                          loadChapters({ id: res.subject_id, name: res.subject_name });
                        }}
                        className="p-2 rounded-lg hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs transition"
                      >
                        <div>
                          <p className="font-bold text-white">{res.title}</p>
                          <p className="text-[10px] text-slate-400">{res.class_name} → {res.subject_name}</p>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${res.is_published ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                          {res.is_published ? 'LIVE' : 'DRAFT'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Default Modality Legend */}
          <div className="glass-panel p-4 border border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-3">🏷️ Default Modality Slots (Applied to Every Chapter)</p>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_MODALITIES.map(m => (
                <div key={m.slug} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{background:`${m.color}15`, border:`1px solid ${m.color}40`, color: m.color}}>
                  <span>{m.emoji}</span> {m.label}
                </div>
              ))}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{background:'#A78BFA15', border:'1px solid #A78BFA40', color:'#A78BFA'}}>
                <span>✨</span> + Custom Modalities
              </div>
            </div>
          </div>

          {/* Step: All Classes */}
          {step === 'classes' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">📋 All Classes</h3>
                <button onClick={() => setShowAddClass(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{background:'#00E5FF20', border:'1px solid #00E5FF40', color:'#00E5FF'}}>
                  <i className="ph ph-plus"></i> Add New Class
                </button>
              </div>
              {loading ? (
                <div className="loading-dots-container py-12">
                  <div className="loading-dots">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                  <p className="loading-dots-label">Loading Classes...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {classes.length === 0 && <p className="text-slate-500 text-sm col-span-4 py-4">No classes yet. Click "Add New Class" to get started.</p>}
                  {classes.map(cls => {
                    const statusText = cls.status || 'Active';
                    const isExcellent = statusText.toLowerCase() === 'excellent';
                    const isNeedsAttention = statusText.toLowerCase().includes('need') || statusText.toLowerCase().includes('attention');
                    const isOnTrack = statusText.toLowerCase().includes('track');
                    
                    // Default to 0% progress unless actual content progress exists
                    const progressPercent = cls.progress !== undefined ? cls.progress : 0;
                    const isComplete = progressPercent === 100;
                    const hasContent = progressPercent > 0;

                    return (
                      <button key={cls.id} onClick={() => { setSelectedClass(cls); setStep('subjects'); loadSubjects(cls); }}
                        className="glass-panel p-5 border border-slate-700/60 rounded-xl text-left hover:border-cyan-500/50 hover:bg-cyan-500/5 transition group space-y-3 relative overflow-hidden">
                        
                        {/* Header & Status Badge */}
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-xl">🏫</div>
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                            isExcellent ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                            isNeedsAttention ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                            isOnTrack ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' :
                            'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {statusText}
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-cyan-300 transition">{cls.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Click to manage subjects &amp; chapters</p>
                        </div>

                        {/* Visible Upload Progress Bar & Complete Check */}
                        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-semibold text-slate-400 flex items-center gap-1">
                              <i className="ph ph-cloud-arrow-up text-cyan-400"></i> Content Upload
                            </span>
                            <span className={`font-mono font-bold ${isComplete ? 'text-emerald-400' : hasContent ? 'text-cyan-300' : 'text-slate-500'}`}>
                              {isComplete ? 'Complete ✅ (100%)' : hasContent ? `${progressPercent}% Uploaded` : '0% Uploaded (No Content)'}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${progressPercent}%`,
                                background: isComplete
                                  ? 'linear-gradient(90deg, #10B981, #34D399)'
                                  : hasContent
                                  ? 'linear-gradient(90deg, #00F0FF, #3B82F6)'
                                  : 'transparent'
                              }}
                            />
                          </div>
                        </div>

                      </button>
                    );
                  })}
                </div>
              )}
              {showAddClass && (
                <div className="glass-panel p-5 border border-cyan-500/30 space-y-3">
                  <p className="text-sm font-bold text-cyan-300">✚ Create New Class</p>
                  <div className="flex gap-3">
                    <input type="text" placeholder="e.g. Class 11th" value={newClass.name} onChange={e=>setNewClass({...newClass,name:e.target.value})}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                    <input type="number" placeholder="Order" value={newClass.display_order} onChange={e=>setNewClass({...newClass,display_order:e.target.value})}
                      className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                    <button onClick={addClass} className="px-4 py-2 rounded-xl text-sm font-bold" style={{background:'#00E5FF20', border:'1px solid #00E5FF50', color:'#00E5FF'}}>Create</button>
                    <button onClick={() => setShowAddClass(false)} className="px-3 py-2 rounded-xl text-sm bg-slate-800 border border-slate-700 text-slate-400">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Subjects */}
          {step === 'subjects' && selectedClass && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">📖 Subjects in <span className="text-cyan-400">{selectedClass.name}</span></h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowBulkFolderModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition shadow">
                    <i className="ph ph-folder-open text-purple-400"></i> 📁 Bulk Upload Subject Folder
                  </button>
                  <button onClick={() => setShowAddSubject(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{background:'#00E5FF20', border:'1px solid #00E5FF40', color:'#00E5FF'}}>
                    <i className="ph ph-plus"></i> Add Subject
                  </button>
                </div>
              </div>
              {loading ? (
                <div className="loading-dots-container py-12">
                  <div className="loading-dots">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                  <p className="loading-dots-label">Loading Subjects...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {subjects.length === 0 && <p className="text-slate-500 text-sm col-span-3 py-4">No subjects yet. Click "Add Subject" or "Bulk Upload Subject Folder" to begin.</p>}
                  {subjects.map(subj => {
                    const progressPercent = subj.progress !== undefined ? subj.progress : 0;
                    const isComplete = progressPercent === 100;
                    const hasContent = progressPercent > 0;
                    return (
                      <button key={subj.id} onClick={() => { setSelectedSubject(subj); setStep('chapters'); loadChapters(subj); }}
                        className="glass-panel p-5 border border-slate-700/60 rounded-xl text-left hover:border-cyan-500/50 hover:bg-cyan-500/5 transition group space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-2xl">{subj.icon}</div>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border font-bold ${
                            isComplete ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                            hasContent ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' :
                            'bg-slate-800 text-slate-500 border-slate-700'
                          }`}>
                            {isComplete ? '100% Complete' : hasContent ? `${progressPercent}% Uploaded` : '0% Uploaded'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-cyan-300 transition">{subj.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{subj.description}</p>
                        </div>
                        
                        {/* Visible Upload Progress Bar */}
                        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-semibold text-slate-400 flex items-center gap-1">
                              <i className="ph ph-cloud-arrow-up text-cyan-400"></i> Upload Progress
                            </span>
                            <span className={`font-mono font-bold ${hasContent ? 'text-cyan-300' : 'text-slate-500'}`}>
                              {progressPercent}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${progressPercent}%`,
                                background: isComplete
                                  ? 'linear-gradient(90deg, #10B981, #34D399)'
                                  : hasContent
                                  ? 'linear-gradient(90deg, #00F0FF, #3B82F6)'
                                  : 'transparent'
                              }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {showAddSubject && (
                <div className="glass-panel p-5 border border-cyan-500/30 space-y-3">
                  <p className="text-sm font-bold text-cyan-300">✚ Create Subject in {selectedClass.name}</p>
                  
                  {/* Icon Quick Picker */}
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Pick Icon</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {ICON_PICKER.map(ic => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setNewSubject({ ...newSubject, icon: ic })}
                          className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition border ${
                            newSubject.icon === ic ? 'bg-cyan-500/20 border-cyan-400 scale-110' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 flex-wrap">
                    <input type="text" placeholder="Subject name (e.g. Physics)" value={newSubject.name} onChange={e=>setNewSubject({...newSubject,name:e.target.value})}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                    <input type="text" placeholder="Emoji icon" value={newSubject.icon} onChange={e=>setNewSubject({...newSubject,icon:e.target.value})}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-center text-white outline-none" />
                    <input type="text" placeholder="Short description" value={newSubject.description} onChange={e=>setNewSubject({...newSubject,description:e.target.value})}
                      className="w-60 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                    <button onClick={addSubject} className="px-4 py-2 rounded-xl text-sm font-bold" style={{background:'#00E5FF20', border:'1px solid #00E5FF50', color:'#00E5FF'}}>Create</button>
                    <button onClick={() => setShowAddSubject(false)} className="px-3 py-2 rounded-xl text-sm bg-slate-800 border border-slate-700 text-slate-400">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Chapters */}
          {step === 'chapters' && selectedSubject && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">📑 Chapters — <span className="text-cyan-400">{selectedClass.name} / {selectedSubject.icon} {selectedSubject.name}</span></h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowBulkFolderModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition shadow">
                    <i className="ph ph-folder-open text-purple-400"></i> 📁 Bulk Upload Subject Folder
                  </button>
                  <button onClick={() => setShowAddChapter(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{background:'#00E5FF20', border:'1px solid #00E5FF40', color:'#00E5FF'}}>
                    <i className="ph ph-plus"></i> Add Chapter
                  </button>
                </div>
              </div>

              {/* 3. Bulk Operations Bar */}
              {selectedChapterIds.length > 0 && (
                <div className="glass-panel p-3 border border-cyan-500/40 bg-cyan-950/40 rounded-xl flex items-center justify-between gap-2 text-xs">
                  <span className="text-cyan-300 font-bold">{selectedChapterIds.length} chapters selected</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => bulkAction('publish')} className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                      ✅ Publish Selected
                    </button>
                    <button onClick={() => bulkAction('unpublish')} className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                      📴 Unpublish Selected
                    </button>
                    <button onClick={() => bulkAction('delete')} className="px-2.5 py-1 rounded bg-red-500/20 text-red-300 border border-red-500/40 font-bold">
                      🗑️ Delete Selected
                    </button>
                    <button onClick={() => setSelectedChapterIds([])} className="text-slate-400 hover:text-white px-2">Clear</button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="loading-dots-container py-12">
                  <div className="loading-dots">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                  <p className="loading-dots-label">Loading Chapters &amp; Modality Content...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chapters.length === 0 && <p className="text-slate-500 text-sm py-4">No chapters yet. Click "Add Chapter" to begin building content.</p>}
                  {chapters.map(ch => (
                    <div key={ch.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedChapterIds.includes(ch.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedChapterIds(prev => [...prev, ch.id]);
                          else setSelectedChapterIds(prev => prev.filter(id => id !== ch.id));
                        }}
                        className="mt-4 accent-cyan-400 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1">
                        <ChapterCard chapter={ch} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showAddChapter && (
                <div className="glass-panel p-5 border border-cyan-500/30 space-y-3">
                  <p className="text-sm font-bold text-cyan-300">✚ Create Chapter in {selectedSubject.icon} {selectedSubject.name}</p>
                  <div className="flex gap-3 flex-wrap">
                    <input type="text" placeholder="Chapter title (e.g. Rotational Dynamics)" value={newChapter.title} onChange={e=>setNewChapter({...newChapter,title:e.target.value})}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                    <input type="number" placeholder="Order" value={newChapter.chapter_order} onChange={e=>setNewChapter({...newChapter,chapter_order:e.target.value})}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                    <select
                      value={newChapter.difficulty || 'Intermediate'}
                      onChange={e=>setNewChapter({...newChapter, difficulty: e.target.value})}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                  <textarea placeholder="Short chapter description..." value={newChapter.description} onChange={e=>setNewChapter({...newChapter,description:e.target.value})}
                    rows={2} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none" />
                  <input
                    type="text"
                    placeholder="Tags (comma separated, e.g. NCERT, Board Exam, Lab Activity)"
                    value={newChapter.tags || ''}
                    onChange={e=>setNewChapter({...newChapter, tags: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={addChapter} className="px-4 py-2 rounded-xl text-sm font-bold" style={{background:'#00E5FF20', border:'1px solid #00E5FF50', color:'#00E5FF'}}>Create Chapter</button>
                    <button onClick={() => setShowAddChapter(false)} className="px-3 py-2 rounded-xl text-sm bg-slate-800 border border-slate-700 text-slate-400">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom Modality Modal */}
          {showAddCustomModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
              <div className="glass-panel p-6 border border-purple-500/40 rounded-2xl w-full max-w-md space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-base font-bold text-white">✨ Add Custom Modality</p>
                  <button onClick={() => setShowAddCustomModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>
                <p className="text-xs text-slate-400">Custom modalities appear after the 5 default slots for the selected chapter. Great for Language Courses, Critical Thinking tracks, Games, etc.</p>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input type="text" placeholder="Modality name (e.g. Speaking Lab)" value={newCustomMod.label} onChange={e=>setNewCustomMod({...newCustomMod,label:e.target.value})}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                    <input type="text" placeholder="🎤" value={newCustomMod.emoji} onChange={e=>setNewCustomMod({...newCustomMod,emoji:e.target.value})}
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-center text-white outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Content Renderer Type</label>
                    <select value={newCustomMod.renderer} onChange={e=>setNewCustomMod({...newCustomMod,renderer:e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none">
                      {RENDERER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <input type="text" placeholder="Short description for your team..." value={newCustomMod.description} onChange={e=>setNewCustomMod({...newCustomMod,description:e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={addCustomModality} className="px-4 py-2 rounded-xl text-sm font-bold bg-purple-500/20 border border-purple-500/50 text-purple-300 hover:bg-purple-500/30">
                    Add Modality Slot
                  </button>
                  <button onClick={() => setShowAddCustomModal(false)} className="px-3 py-2 rounded-xl text-sm bg-slate-800 border border-slate-700 text-slate-400">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Multi-Item Add / Edit Modal (for Experiments & Stories) */}
          {activeMultiModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
              <div className="glass-panel p-6 border border-cyan-500/40 rounded-2xl w-full max-w-lg space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{activeMultiModal.mod.emoji}</span>
                    <div>
                      <h4 className="text-base font-bold text-white">
                        {activeMultiModal.isNew ? `✚ Add ${activeMultiModal.mod.label}` : `✏️ Edit ${activeMultiModal.mod.label}`}
                      </h4>
                      <p className="text-[11px] text-slate-400">Chapter: {activeMultiModal.chapter.title}</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveMultiModal(null)} className="text-slate-400 hover:text-white text-base">✕</button>
                </div>

                {/* Experiments Form */}
                {activeMultiModal.mod.slug === 'experiments' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-300 font-semibold mb-1 block">Experiment Title *</label>
                      <input type="text" placeholder="e.g. Laser Bounce or Shadow Lab"
                        value={activeMultiModal.itemData.title || ''}
                        onChange={e => setActiveMultiModal({ ...activeMultiModal, itemData: { ...activeMultiModal.itemData, title: e.target.value } })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-400 mb-1 block">Author / Team</label>
                        <input type="text" placeholder="by Platform"
                          value={activeMultiModal.itemData.author || ''}
                          onChange={e => setActiveMultiModal({ ...activeMultiModal, itemData: { ...activeMultiModal.itemData, author: e.target.value } })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none" />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 mb-1 block">Badge Tag</label>
                        <input type="text" placeholder="Latest! or Ready"
                          value={activeMultiModal.itemData.badge || ''}
                          onChange={e => setActiveMultiModal({ ...activeMultiModal, itemData: { ...activeMultiModal.itemData, badge: e.target.value } })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none" />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 mb-1 block">Likes / Stat</label>
                        <input type="text" placeholder="50k"
                          value={activeMultiModal.itemData.likes || ''}
                          onChange={e => setActiveMultiModal({ ...activeMultiModal, itemData: { ...activeMultiModal.itemData, likes: e.target.value } })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="col-span-1">
                        <label className="text-[11px] text-slate-400 mb-1 block">Icon Emoji</label>
                        <input type="text" placeholder="🌕"
                          value={activeMultiModal.itemData.icon || '🧪'}
                          onChange={e => setActiveMultiModal({ ...activeMultiModal, itemData: { ...activeMultiModal.itemData, icon: e.target.value } })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-center text-white outline-none" />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[11px] text-slate-400 mb-1 block">Color Theme</label>
                        <div className="flex gap-1.5 pt-1">
                          {[
                            { name: 'Cyan', bg: 'linear-gradient(135deg, #00F0FF, #0070F3)', color: '#00F0FF' },
                            { name: 'Purple', bg: 'linear-gradient(135deg, #A855F7, #6366F1)', color: '#A855F7' },
                            { name: 'Pink', bg: 'linear-gradient(135deg, #EC4899, #BE185D)', color: '#EC4899' },
                            { name: 'Orange', bg: 'linear-gradient(135deg, #F97316, #D97706)', color: '#F97316' },
                            { name: 'Green', bg: 'linear-gradient(135deg, #10B981, #0D9488)', color: '#10B981' }
                          ].map(g => (
                            <button key={g.name} type="button"
                              onClick={() => setActiveMultiModal({ ...activeMultiModal, itemData: { ...activeMultiModal.itemData, gradient: g.bg, color: g.color } })}
                              className={`h-7 flex-1 rounded-lg transition border ${activeMultiModal.itemData.gradient===g.bg ? 'border-white scale-105 shadow-md' : 'border-transparent opacity-75'}`}
                              style={{ background: g.bg }} />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Custom PNG Icon Option */}
                    <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
                          <span>🖼️ Custom PNG Icon</span>
                          <span className="text-[10px] text-cyan-400 font-normal">(Overrides emoji if set)</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="text" placeholder="Paste PNG Image URL or R2 CDN Link"
                          value={activeMultiModal.itemData.icon_png || ''}
                          onChange={e => setActiveMultiModal({ ...activeMultiModal, itemData: { ...activeMultiModal.itemData, icon_png: e.target.value } })}
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-cyan-500" />
                        
                        <label className="py-1.5 px-3 rounded-lg border border-dashed border-cyan-500/60 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap">
                          <i className="ph ph-image-square text-sm"></i> Upload PNG
                          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = async (ev) => {
                              const base64Data = ev.target.result.split(',')[1];
                              const res = await fetch('/api/upload-r2', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  className: selectedClass?.name || 'General',
                                  subjectName: selectedSubject?.name || 'General',
                                  chapterSlug: activeMultiModal.chapter?.chapter_slug || activeMultiModal.chapter?.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'general',
                                  modalitySlug: 'experiments-icons',
                                  filename: file.name,
                                  base64Content: base64Data,
                                  contentType: file.type
                                })
                              });
                              const r = await res.json();
                              if (r.ok && r.cdnUrl) {
                                setActiveMultiModal(prev => ({ ...prev, itemData: { ...prev.itemData, icon_png: r.cdnUrl } }));
                                showToast(`✅ Custom PNG icon uploaded to R2!`);
                              } else {
                                showToast('Upload failed: ' + (r.error || 'Unknown error'), 'error');
                              }
                            };
                            reader.readAsDataURL(file);
                          }} />
                        </label>
                      </div>
                      
                      {activeMultiModal.itemData.icon_png && (
                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-950 border border-cyan-500/30 mt-1">
                          <div className="w-7 h-7 rounded bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                            <img src={activeMultiModal.itemData.icon_png} alt="Preview" className="w-full h-full object-contain" />
                          </div>
                          <span className="text-[10px] text-cyan-300 font-mono truncate flex-1">{activeMultiModal.itemData.icon_png}</span>
                          <button type="button" onClick={() => setActiveMultiModal(prev => ({ ...prev, itemData: { ...prev.itemData, icon_png: '' } }))}
                            className="text-slate-400 hover:text-red-400 text-xs px-1">✕</button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 font-semibold mb-1 block">Simulation URL or File Link *</label>
                      <div className="space-y-2">
                        <input type="text" placeholder="e.g. Shadow_Lab.html or R2 CDN Link"
                          value={activeMultiModal.itemData.url || ''}
                          onChange={e => setActiveMultiModal({ ...activeMultiModal, itemData: { ...activeMultiModal.itemData, url: e.target.value } })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none" />
                        
                        <div className="flex items-center gap-2">
                          <label className="flex-1 py-2 px-3 rounded-lg border border-dashed border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition">
                            <i className="ph ph-file-arrow-up text-sm"></i> Direct Upload HTML to R2
                            <input type="file" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = async (ev) => {
                                const base64Data = ev.target.result.split(',')[1];
                                const res = await fetch('/api/upload-r2', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    className: selectedClass.name,
                                    subjectName: selectedSubject.name,
                                    chapterSlug: activeMultiModal.chapter.chapter_slug || activeMultiModal.chapter.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                                    modalitySlug: 'experiments',
                                    filename: file.name,
                                    base64Content: base64Data,
                                    contentType: file.type
                                  })
                                });
                                const r = await res.json();
                                if (r.ok && r.cdnUrl) {
                                  setActiveMultiModal(prev => ({ ...prev, itemData: { ...prev.itemData, url: r.cdnUrl } }));
                                  showToast(`✅ Uploaded "${file.name}" to Cloudflare R2!`);
                                }
                              };
                              reader.readAsDataURL(file);
                            }} />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stories Form */}
                {activeMultiModal.mod.slug === 'stories' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-300 font-semibold mb-1 block">Story Video Title *</label>
                      <input type="text" placeholder="e.g. Shadows and Light Explained"
                        value={activeMultiModal.itemData.title || ''}
                        onChange={e => setActiveMultiModal({ ...activeMultiModal, itemData: { ...activeMultiModal.itemData, title: e.target.value } })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-400 mb-1 block">Tag Category</label>
                        <select
                          value={activeMultiModal.itemData.tag || 'DOCUMENTARY'}
                          onChange={e => setActiveMultiModal({ ...activeMultiModal, itemData: { ...activeMultiModal.itemData, tag: e.target.value } })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
                          <option value="DOCUMENTARY">DOCUMENTARY</option>
                          <option value="EXPLORE">EXPLORE</option>
                          <option value="LESSON">LESSON</option>
                          <option value="CASE STUDY">CASE STUDY</option>
                          <option value="EXPERIMENT GUIDE">EXPERIMENT GUIDE</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 mb-1 block">Duration</label>
                        <input type="text" placeholder="e.g. 5:21"
                          value={activeMultiModal.itemData.duration || ''}
                          onChange={e => setActiveMultiModal({ ...activeMultiModal, itemData: { ...activeMultiModal.itemData, duration: e.target.value } })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 font-semibold mb-1 block">Description</label>
                      <textarea placeholder="Short synopsis of this video lesson..."
                        value={activeMultiModal.itemData.description || ''}
                        onChange={e => setActiveMultiModal({ ...activeMultiModal, itemData: { ...activeMultiModal.itemData, description: e.target.value } })}
                        rows={2} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none resize-none" />
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 font-semibold mb-1 block">Thumbnail Image URL</label>
                      <input type="text" placeholder="https://pub-.../thumbnails/preview.webp"
                        value={activeMultiModal.itemData.thumbnail_url || ''}
                        onChange={e => setActiveMultiModal({ ...activeMultiModal, itemData: { ...activeMultiModal.itemData, thumbnail_url: e.target.value } })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none" />
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 font-semibold mb-1 block">Video Stream / YouTube Embed URL *</label>
                      <input type="text" placeholder="https://www.youtube.com/watch?v=... or R2 MP4 URL"
                        value={activeMultiModal.itemData.url || ''}
                        onChange={e => setActiveMultiModal({ ...activeMultiModal, itemData: { ...activeMultiModal.itemData, url: e.target.value } })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none" />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => {
                      if (!activeMultiModal.itemData.title?.trim()) return showToast('Title is required', 'error');
                      const currentList = Array.isArray(chapterModalities[activeMultiModal.chapter.id]?.[activeMultiModal.mod.slug]) ? [...chapterModalities[activeMultiModal.chapter.id][activeMultiModal.mod.slug]] : [];
                      let updated;
                      if (activeMultiModal.isNew) {
                        const newItem = { ...activeMultiModal.itemData, id: `${activeMultiModal.mod.slug}_${Date.now()}` };
                        updated = [...currentList, newItem];
                      } else {
                        updated = currentList.map((item, idx) => idx === activeMultiModal.itemIndex ? { ...item, ...activeMultiModal.itemData } : item);
                      }
                      saveMultiItemList(activeMultiModal.chapter, activeMultiModal.mod.slug, updated);
                      setActiveMultiModal(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white shadow"
                    style={{ background: `${activeMultiModal.mod.color}35`, border: `1px solid ${activeMultiModal.mod.color}70` }}>
                    💾 Save {activeMultiModal.mod.label} Item
                  </button>
                  <button onClick={() => setActiveMultiModal(null)} className="px-4 py-2.5 rounded-xl text-sm bg-slate-800 border border-slate-700 text-slate-400">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. Bulk Subject Folder Importer Modal */}
          {showBulkFolderModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
              <div className="glass-panel p-6 border border-purple-500/40 rounded-2xl max-w-3xl w-full space-y-4 shadow-2xl relative">
                <button
                  onClick={() => setShowBulkFolderModal(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>

                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-xl">
                    📁
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Bulk Subject Folder Importer</h3>
                    <p className="text-xs text-slate-400">
                      Upload a Subject folder containing chapter subfolders to auto-create chapters &amp; link content!
                    </p>
                  </div>
                </div>

                {/* Standard Folder Pattern Instructions */}
                <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                  <p className="font-bold text-purple-300 flex items-center gap-1.5">
                    <i className="ph ph-tree-structure"></i> Supported Folder Structure Pattern:
                  </p>
                  <pre className="bg-slate-950 p-3 rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto border border-slate-800">
{`[Subject_Name_Folder]/
  ├── Chapter_01_Title/
  │     ├── front_visuals/ (3D Animation/Simulation html + description.txt)
  │     ├── experience/    (3D App / Simulation html or link)
  │     ├── experiments/   (lab files or subfolders: exp1, exp2, exp3, exp4)
  │     ├── quiz/          (Quiz link or Assessment file)
  │     ├── mixed_reality/ (VR QR / WebXR app file or link)
  │     └── stories/       (Video lessons: story1.mp4, story2.mp4, story3.mp4, story4.mp4)
  └── Chapter_02_Title/`}
                  </pre>
                </div>

                {/* Upload Action / Input */}
                <div className="border-2 border-dashed border-purple-500/40 hover:border-purple-400 bg-purple-950/10 p-6 rounded-2xl text-center space-y-3 transition cursor-pointer relative">
                  <input
                    type="file"
                    webkitdirectory="true"
                    directory="true"
                    multiple
                    onChange={handleFolderSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-2xl mx-auto text-purple-300">
                    📂
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Click or Drag &amp; Drop Subject / Chapter Folder Here</p>
                    <p className="text-xs text-slate-400 mt-1">Select a top-level Subject folder from your computer</p>
                  </div>
                </div>

                {/* Parsed Inspection Preview */}
                {parsedSubjectFolder && (
                  <div className="glass-panel p-4 border border-cyan-500/30 bg-cyan-950/10 rounded-xl space-y-3">
                    <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                      <span className="font-bold text-cyan-300">
                        Subject: <span className="text-white">{parsedSubjectFolder.subjectName}</span>
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {parsedSubjectFolder.chapters.length} Chapters Detected
                      </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {parsedSubjectFolder.chapters.map((ch, idx) => (
                        <div key={idx} className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-white">{ch.title}</p>
                            <div className="flex gap-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                              <span>🖼️ Front: {ch.front_visuals || ch.front_description ? '✓' : '✗'}</span>
                              <span>💡 Exp: {ch.experience ? '✓' : '✗'}</span>
                              <span>🧪 Exp: {ch.experiments.length}/4</span>
                              <span>📝 Quiz: {ch.quiz ? '✓' : '✗'}</span>
                              <span>📖 Stories: {ch.stories.length}/4</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            Ready to Sync
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={processBulkSubjectUpload}
                      disabled={isBulkUploading}
                      className="w-full py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                      style={{
                        background: isBulkUploading ? '#475569' : 'linear-gradient(90deg, #8B5CF6, #3B82F6)',
                        color: '#FFF'
                      }}
                    >
                      {isBulkUploading ? (
                        <>
                          <span className="animate-spin text-lg">⏳</span> Syncing Chapters to Database...
                        </>
                      ) : (
                        <>
                          <i className="ph ph-cloud-arrow-up text-lg"></i> ⚡ Start Batch Import &amp; Sync ({parsedSubjectFolder.chapters.length} Chapters)
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Upload Terminal Logs */}
                {bulkUploadLogs.length > 0 && (
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 font-mono text-[11px] text-cyan-300 max-h-40 overflow-y-auto">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Terminal Upload Logs:</p>
                    {bulkUploadLogs.map((log, i) => (
                      <div key={i} className="leading-relaxed whitespace-pre-wrap">{log}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    // ═══════════════════════════════════════════════════════════════
    // 🌍 CUSTOM COURSES & WORLD HUB — Platform Exclusive Special Courses
    // ═══════════════════════════════════════════════════════════════
