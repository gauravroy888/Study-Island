import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Card from '../components/Card';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie
} from 'recharts';
import {
  Trophy, AlertTriangle, TrendingUp, Users, BookOpen,
  AlertCircle, X, Activity,
  Layers, Zap, Compass, Award, Radio, Check
} from 'lucide-react';
import { supabase } from '../supabase';

// Chapter 10: Light and Shadows - Granular Learning Objectives
const CHAPTER_10_LOS = [
  {
    id: 'LO-01',
    code: 'LO-01',
    title: 'Rectilinear Propagation & Reflection',
    short: 'Rectilinear & Reflection',
    desc: 'Light travels in straight lines; law of reflection on plane mirrors'
  },
  {
    id: 'LO-02',
    code: 'LO-02',
    title: 'Transparent, Translucent & Opaque',
    short: 'Material Transmission',
    desc: 'Categorization and transmission properties of various media'
  },
  {
    id: 'LO-03',
    code: 'LO-03',
    title: 'Shadow Formation & Ray Geometry (Angle prediction)',
    short: 'Shadow & Ray Geometry',
    desc: 'Geometry of shadows, umbra/penumbra, angle prediction relative to light source'
  },
  {
    id: 'LO-04',
    code: 'LO-04',
    title: 'Virtual Lab Practical Adherence',
    short: 'Virtual Lab Practical',
    desc: 'Adherence to experiment protocol, beam alignment, and instrument precision in 3D lab'
  }
];

// CBSE Grade 6 Regional Benchmarks
const CBSE_BENCHMARKS = {
  physics: 72,
  chemistry: 70,
  math: 75
};

// Initial student cohort matching the EXACT 5 registered students in Supabase DB
const INITIAL_STUDENTS = [
  {
    id: 'adf15e97-1617-4111-a434-deda5c81f614',
    name: 'GAURAV Roy',
    email: 'thorroy888@gmail.com',
    class: 'Class 6th',
    math: 94,
    physics: 96,
    chemistry: 92,
    attendance: 98,
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex%20K.&top=straight02&hairColor=2c1b18&skinColor=edb98a&clothing=blazerAndShirt&clothingColor=black&facialHairProbability=0&accessoriesProbability=0&mouth=smile,default&eyes=happy,default&backgroundColor=b6e3f4',
    loScores: {
      'LO-01': 94,
      'LO-02': 92,
      'LO-03': 88,
      'LO-04': 92
    },
    alert: null,
    dimensions: {
      mastery: 94,
      fluency: 92,
      application: 90,
      practicalSkill: 92,
      exploration: 95,
      engagement: 96,
      formalAchievement: 93
    },
    recentAttempts: [
      { id: 'att-g1', title: 'Chapter 10 Mastery Formative', lo: 'LO-01', score: 94, date: '2026-09-06', duration: '14 mins', status: 'Mastered' },
      { id: 'att-g2', title: 'Virtual Pinhole Camera Lab', lo: 'LO-04', score: 92, date: '2026-09-04', duration: '20 mins', status: 'Mastered' },
      { id: 'att-g3', title: 'Ray Angle Calculation Check', lo: 'LO-03', score: 88, date: '2026-09-02', duration: '16 mins', status: 'Mastered' }
    ]
  },
  {
    id: '8729e042-9ccd-4e5e-b4f9-41bf6f6466a6',
    name: 'Harsh',
    email: 'hps.sunghrathore@gmail.com',
    class: 'Class 6th',
    math: 88,
    physics: 92,
    chemistry: 85,
    attendance: 96,
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=HarshStudent&top=shortFlat&hairColor=2c1b18&skinColor=ffdbb4&backgroundColor=b6e3f4',
    loScores: {
      'LO-01': 88,
      'LO-02': 92,
      'LO-03': 82,
      'LO-04': 85
    },
    alert: null,
    dimensions: {
      mastery: 88,
      fluency: 84,
      application: 86,
      practicalSkill: 85,
      exploration: 90,
      engagement: 92,
      formalAchievement: 89
    },
    recentAttempts: [
      { id: 'att-h1', title: 'Optics Deep Dive Challenge', lo: 'LO-01', score: 90, date: '2026-09-07', duration: '12 mins', status: 'Mastered' },
      { id: 'att-h2', title: 'Ray Box Virtual Calibration', lo: 'LO-04', score: 85, date: '2026-09-05', duration: '19 mins', status: 'Mastered' },
      { id: 'att-h3', title: 'Shadow Formation & Umbra', lo: 'LO-03', score: 82, date: '2026-09-03', duration: '15 mins', status: 'Mastered' }
    ]
  },
  {
    id: '66fdfdcd-d922-48fa-bdc5-a47e01e6a6bf',
    name: 'Saurav Roy',
    email: 'sauravroy469@gmail.com',
    class: 'Class 6th',
    math: 76,
    physics: 80,
    chemistry: 78,
    attendance: 90,
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex%20K.&top=shortFlat&hairColor=724133&skinColor=edb98a&clothing=blazerAndShirt&clothingColor=black&facialHair=beardMedium&facialHairColor=724133&facialHairProbability=100&accessoriesProbability=100&accessories=wayfarers&mouth=default&eyes=default&backgroundColor=c0aede',
    loScores: {
      'LO-01': 74,
      'LO-02': 70,
      'LO-03': 38, // Struggling (< 50%)
      'LO-04': 72
    },
    alert: {
      type: 'PERSISTENT_DIFFICULTY',
      severity: 'critical',
      icon: '🚨',
      title: 'Persistent Difficulty',
      summary: '3 attempts on LO-03 below 40%.',
      recommendation: 'Assign 1-on-1 shadow geometry review.',
      tagColor: '#ef4444'
    },
    dimensions: {
      mastery: 62,
      fluency: 52,
      application: 48,
      practicalSkill: 65,
      exploration: 58,
      engagement: 75,
      formalAchievement: 62
    },
    recentAttempts: [
      { id: 'att-s1', title: 'Ray Geometry Angle Prediction #3', lo: 'LO-03', score: 38, date: '2026-09-06', duration: '28 mins', status: 'Struggling' },
      { id: 'att-s2', title: 'Ray Geometry Angle Prediction #2', lo: 'LO-03', score: 35, date: '2026-09-04', duration: '25 mins', status: 'Struggling' },
      { id: 'att-s3', title: 'Material Opacity Benchmark', lo: 'LO-02', score: 70, date: '2026-08-30', duration: '17 mins', status: 'In Progress' }
    ]
  },
  {
    id: '15daf08b-d95f-4bd5-adf2-8653785f9bf8',
    name: 'Casey Smith',
    email: 'apsrathore47@gmail.com',
    class: 'Class 6th',
    math: 86,
    physics: 84,
    chemistry: 88,
    attendance: 94,
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Casey',
    loScores: {
      'LO-01': 85,
      'LO-02': 86,
      'LO-03': 78,
      'LO-04': 36 // Struggling (< 50% Virtual Lab)
    },
    alert: {
      type: 'APPLICATION_GAP',
      severity: 'warning',
      icon: '⚠️',
      title: 'Application Gap',
      summary: 'Theory Mastery is 85%, but Practical 3D Lab is 36%.',
      recommendation: 'Demonstrate angled light rays on smartboard.',
      tagColor: '#f59e0b'
    },
    dimensions: {
      mastery: 84,
      fluency: 80,
      application: 45,
      practicalSkill: 36,
      exploration: 70,
      engagement: 82,
      formalAchievement: 85
    },
    recentAttempts: [
      { id: 'att-c1', title: 'Virtual 3D Optics Lab Adherence', lo: 'LO-04', score: 36, date: '2026-09-06', duration: '12 mins', status: 'Struggling' },
      { id: 'att-c2', title: 'Light & Shadow Theory Formative', lo: 'LO-01', score: 85, date: '2026-09-05', duration: '14 mins', status: 'Mastered' },
      { id: 'att-c3', title: 'Refraction & Reflection Quiz', lo: 'LO-02', score: 86, date: '2026-09-03', duration: '16 mins', status: 'Mastered' }
    ]
  },
  {
    id: '986c71d3-b15f-4048-9ac4-b27cc397bb36',
    name: '李建勋',
    email: 'medusa.leee@gmail.com',
    class: 'Class 6th',
    math: 92,
    physics: 90,
    chemistry: 94,
    attendance: 96,
    avatar_url: 'https://lh3.googleusercontent.com/a/ACg8ocIloEvjI1fBXxilN264jZcLJsfGdP_E_zXU_FE41c_tIwCyzgN4=s96-c',
    loScores: {
      'LO-01': 90,
      'LO-02': 88,
      'LO-03': 85,
      'LO-04': 88
    },
    alert: null,
    dimensions: {
      mastery: 90,
      fluency: 88,
      application: 87,
      practicalSkill: 88,
      exploration: 91,
      engagement: 94,
      formalAchievement: 90
    },
    recentAttempts: [
      { id: 'att-l1', title: 'Adaptive Digital Assessment', lo: 'LO-03', score: 88, date: '2026-09-05', duration: '18 mins', status: 'Mastered' },
      { id: 'att-l2', title: 'Simulated Shadow Casting', lo: 'LO-04', score: 88, date: '2026-09-01', duration: '20 mins', status: 'Mastered' }
    ]
  }
];

// Helper to determine status styling for LO scores
function getScoreStatus(score) {
  if (score >= 75) {
    return {
      label: 'Mastered',
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.15)',
      border: 'rgba(16, 185, 129, 0.45)',
      icon: '🟢'
    };
  }
  if (score >= 50) {
    return {
      label: 'In Progress',
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.15)',
      border: 'rgba(245, 158, 11, 0.45)',
      icon: '🟡'
    };
  }
  return {
    label: 'Struggling',
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.18)',
    border: 'rgba(239, 68, 68, 0.5)',
    icon: '🔴'
  };
}

export default function Analytics() {
  const [selectedClass] = useState('Class 6th');
  const [selectedStudent, setSelectedStudent] = useState('All');
  const [students, setStudents] = useState(INITIAL_STUDENTS);

  // Heatmap Filter state: "all", "needsSupport", "mastered"
  const [heatmapFilter, setHeatmapFilter] = useState('all');

  // Selected student for Drill-Down modal
  const [drillDownStudent, setDrillDownStudent] = useState(null);

  // Live telemetry notification toast
  const [liveToast, setLiveToast] = useState(null);
  const toastTimerRef = useRef(null);

  // Action feedback message
  const [remediationSent, setRemediationSent] = useState(false);

  // Synchronize with live evidence in localStorage and listen to updates
  const syncWithLocalStorageEvidence = useCallback(() => {
    try {
      const rawEvidence = localStorage.getItem('edtech_analytics_evidence');
      if (!rawEvidence) return;

      const parsed = JSON.parse(rawEvidence);
      if (!parsed) return;

      const evidenceList = Array.isArray(parsed) ? parsed : [parsed];

      setStudents(prevStudents => {
        const updated = [...prevStudents];
        evidenceList.forEach(ev => {
          const sIdx = updated.findIndex(s => s.id === ev.studentId || s.name.toLowerCase() === (ev.studentName || '').toLowerCase());
          if (sIdx !== -1) {
            const student = { ...updated[sIdx] };
            if (ev.loScores) {
              student.loScores = { ...student.loScores, ...ev.loScores };
            }
            if (ev.loId && ev.score !== undefined) {
              student.loScores = { ...student.loScores, [ev.loId]: ev.score };
            }
            if (ev.attempt) {
              student.recentAttempts = [ev.attempt, ...(student.recentAttempts || [])];
            }
            if (ev.dimensions) {
              student.dimensions = { ...student.dimensions, ...ev.dimensions };
            }
            // Auto resolve alert if condition cleared
            if (student.alert?.type === 'PERSISTENT_DIFFICULTY' && student.loScores['LO-03'] >= 75) {
              student.alert = null;
            }
            updated[sIdx] = student;
          }
        });
        return updated;
      });
    } catch (err) {
      console.warn('Error reading edtech_analytics_evidence from localStorage:', err);
    }
  }, []);

  const showLiveToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setLiveToast(msg);
    toastTimerRef.current = setTimeout(() => {
      setLiveToast(null);
    }, 4500);
  }, []);

  const fetchLiveAnalytics = useCallback(async () => {
    try {
      // 1. Query real database profiles (`role = 'student'`) from public.profiles (safe fields only)
      const { data: profs } = await supabase.from('profiles').select('id, auth_id, email, name, role, avatar_url, department, age').eq('role', 'student');

      // 2. Query real test submissions from public.test_submissions (ordered by submitted_at DESC)
      const { data: submissions } = await supabase
        .from('test_submissions')
        .select('*')
        .order('submitted_at', { ascending: false });

      // 3. Query real events from public.analytics_events (where event_type = 'quiz_complete' or payload->>'score_pct' IS NOT NULL)
      let events = [];
      try {
        const { data: evData, error: evErr } = await supabase
          .from('analytics_events')
          .select('*')
          .or('event_type.eq.quiz_complete,payload->>score_pct.not.is.null')
          .order('created_at', { ascending: false });

        if (!evErr && evData) {
          events = evData;
        } else {
          // Fallback query if PostgREST JSON filter needs relaxed syntax
          const { data: allEvs } = await supabase
            .from('analytics_events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);
          if (allEvs) {
            events = allEvs.filter(ev =>
              ev.event_type === 'quiz_complete' ||
              ev.event_type === 'complete' ||
              (ev.payload && (ev.payload.score_pct !== undefined || ev.payload.score !== undefined))
            );
          }
        }
      } catch (err) {
        console.warn('analytics_events query notice:', err);
      }

      // 4. Merge real database telemetry into the student roster
      setStudents(() => {
        // Base list: database profiles if available, otherwise INITIAL_STUDENTS
        const profilesList = (profs && profs.length > 0) ? profs : INITIAL_STUDENTS;

        return profilesList.map(p => {
          // Match against INITIAL_STUDENTS to preserve default cohort baselines
          const defaultStudent = INITIAL_STUDENTS.find(init =>
            init.id === p.id ||
            (init.email && p.email && init.email.toLowerCase() === p.email.toLowerCase()) ||
            (init.name && p.name && init.name.toLowerCase() === p.name.toLowerCase())
          ) || {
            id: p.id,
            name: p.name || 'Student',
            email: p.email || '',
            class: p.class_name || 'Class 6th',
            math: 82,
            physics: 85,
            chemistry: 80,
            attendance: 95,
            avatar_url: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name || 'Student')}`,
            loScores: { 'LO-01': 80, 'LO-02': 80, 'LO-03': 75, 'LO-04': 75 },
            alert: null,
            dimensions: { mastery: 80, fluency: 78, application: 74, practicalSkill: 75, exploration: 82, engagement: 88, formalAchievement: 80 },
            recentAttempts: []
          };

          const sId = p.id || defaultStudent.id;
          const sEmail = (p.email || defaultStudent.email || '').toLowerCase();
          const sName = (p.name || defaultStudent.name || '').toLowerCase();

          // Match each submission to student by student_id, student_email, or student name
          const studentSubs = (submissions || []).filter(sub => {
            if (sub.student_id && String(sub.student_id) === String(sId)) return true;
            if (sub.student_email && sEmail && sub.student_email.toLowerCase() === sEmail) return true;
            if (sub.student_name && sName && sub.student_name.toLowerCase() === sName) return true;
            return false;
          });

          // Match each event to student by student_id, student_email, or student name
          const studentEvs = (events || []).filter(ev => {
            if (ev.student_id && String(ev.student_id) === String(sId)) return true;
            const payload = ev.payload || {};
            if (payload.student_id && String(payload.student_id) === String(sId)) return true;
            if (payload.studentId && String(payload.studentId) === String(sId)) return true;
            if (payload.student_email && sEmail && payload.student_email.toLowerCase() === sEmail) return true;
            if (payload.email && sEmail && payload.email.toLowerCase() === sEmail) return true;
            if (payload.student_name && sName && payload.student_name.toLowerCase() === sName) return true;
            if (payload.name && sName && payload.name.toLowerCase() === sName) return true;
            return false;
          });

          // Only fall back to defaults if no real submissions exist for that student
          const hasRealData = studentSubs.length > 0 || studentEvs.length > 0;
          if (!hasRealData) {
            return {
              ...defaultStudent,
              id: sId,
              name: p.name || defaultStudent.name,
              email: p.email || defaultStudent.email,
              class: p.class_name || defaultStudent.class,
              avatar_url: p.avatar_url || defaultStudent.avatar_url
            };
          }

          // Build recentAttempts from actual submission & event telemetry
          const subAttempts = studentSubs.map((sub, idx) => {
            const score = Math.round(Number(sub.score) || 0);
            return {
              id: sub.id || `db-sub-${idx}`,
              title: sub.test_title || sub.title || 'Chapter 10 Mastery Formative',
              lo: sub.lo || sub.lo_id || 'LO-01',
              score: score,
              date: sub.submitted_at ? sub.submitted_at.split('T')[0] : new Date().toISOString().split('T')[0],
              duration: sub.duration || '15 mins',
              status: score >= 75 ? 'Mastered' : score >= 50 ? 'In Progress' : 'Struggling'
            };
          });

          const evAttempts = studentEvs.map((ev, idx) => {
            const payload = ev.payload || {};
            const score = Math.round(Number(payload.score_pct ?? payload.score ?? payload.mastery_score) || 0);
            const lo = payload.loId || (payload.lo_breakdown ? Object.keys(payload.lo_breakdown)[0] : 'LO-01');
            return {
              id: ev.id || ev.session_id || `db-ev-${idx}`,
              title: payload.activity_title || payload.title || payload.quizTitle || (payload.activity_type ? `${payload.activity_type} Session` : 'Adaptive Digital Assessment'),
              lo: lo,
              score: score,
              date: (payload.completed_at || ev.created_at || new Date().toISOString()).split('T')[0],
              duration: payload.time_spent_ms ? `${Math.max(1, Math.round(payload.time_spent_ms / 60000))} mins` : '14 mins',
              status: score >= 75 ? 'Mastered' : score >= 50 ? 'In Progress' : 'Struggling'
            };
          });

          const recentAttempts = [...subAttempts, ...evAttempts].sort((a, b) => new Date(b.date) - new Date(a.date));

          // Compute loScores from real submissions and events
          const loScores = { ...defaultStudent.loScores };
          const loBuckets = { 'LO-01': [], 'LO-02': [], 'LO-03': [], 'LO-04': [] };

          studentSubs.forEach(sub => {
            if (sub.answers && typeof sub.answers === 'object') {
              if (sub.answers.loScores) {
                Object.entries(sub.answers.loScores).forEach(([k, v]) => {
                  if (loBuckets[k]) loBuckets[k].push(Number(v));
                });
              }
              if (sub.answers.lo_breakdown) {
                Object.entries(sub.answers.lo_breakdown).forEach(([k, v]) => {
                  const sc = typeof v === 'object' ? (v.score ?? v.percentage) : v;
                  if (loBuckets[k] && sc !== undefined) loBuckets[k].push(Number(sc));
                });
              }
            }
            if (sub.lo && loBuckets[sub.lo] && sub.score !== undefined) {
              loBuckets[sub.lo].push(Number(sub.score));
            }
          });

          studentEvs.forEach(ev => {
            const payload = ev.payload || {};
            if (payload.loScores) {
              Object.entries(payload.loScores).forEach(([k, v]) => {
                if (loBuckets[k]) loBuckets[k].push(Number(v));
              });
            }
            if (payload.lo_breakdown) {
              Object.entries(payload.lo_breakdown).forEach(([k, v]) => {
                const sc = typeof v === 'object' ? (v.score ?? v.percentage) : v;
                if (loBuckets[k] && sc !== undefined) loBuckets[k].push(Number(sc));
              });
            }
            if (payload.loId && loBuckets[payload.loId]) {
              const sc = payload.score_pct ?? payload.score;
              if (sc !== undefined) loBuckets[payload.loId].push(Number(sc));
            }
          });

          Object.keys(loBuckets).forEach(loKey => {
            if (loBuckets[loKey].length > 0) {
              loScores[loKey] = Math.round(loBuckets[loKey].reduce((a, b) => a + b, 0) / loBuckets[loKey].length);
            }
          });

          // Course averages updated from actual submission data
          const allScores = [
            ...studentSubs.map(s => Number(s.score)),
            ...studentEvs.map(e => Number(e.payload?.score_pct ?? e.payload?.score ?? e.payload?.mastery_score))
          ].filter(s => !isNaN(s) && s !== null);

          const avgScore = allScores.length > 0
            ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
            : defaultStudent.physics;

          const physics = avgScore;
          const math = Math.min(100, Math.max(50, Math.round(avgScore * 0.98)));
          const chemistry = Math.min(100, Math.max(50, Math.round(avgScore * 0.96)));

          // Dimensions updated from actual submission data
          const latestEv = studentEvs[0]?.payload || {};
          const d = latestEv.dimensions || {};
          const calcMastery = Number(d.mastery ?? d.conceptual_mastery ?? latestEv.mastery_score ?? avgScore);
          const calcFluency = Number(d.fluency ?? d.retrieval_fluency ?? latestEv.fluency_score ?? Math.round(avgScore * 0.95));
          const calcApp = Number(d.application ?? d.problem_application ?? (loScores['LO-03'] !== undefined ? loScores['LO-03'] : Math.round(avgScore * 0.9)));
          const calcPractical = Number(d.practicalSkill ?? d.practical_skill ?? d.practical_lab_skill ?? latestEv.lab_score ?? (loScores['LO-04'] !== undefined ? loScores['LO-04'] : Math.round(avgScore * 0.88)));
          const calcExploration = Number(d.exploration ?? d.scene_exploration ?? defaultStudent.dimensions.exploration);
          const calcEngagement = Number(d.engagement ?? d.session_engagement ?? defaultStudent.dimensions.engagement);
          const calcFormal = Number(d.formalAchievement ?? d.formal_achievement ?? avgScore);

          const dimensions = {
            mastery: Math.min(100, Math.max(0, Math.round(calcMastery))),
            fluency: Math.min(100, Math.max(0, Math.round(calcFluency))),
            application: Math.min(100, Math.max(0, Math.round(calcApp))),
            practicalSkill: Math.min(100, Math.max(0, Math.round(calcPractical))),
            exploration: Math.min(100, Math.max(0, Math.round(calcExploration))),
            engagement: Math.min(100, Math.max(0, Math.round(calcEngagement))),
            formalAchievement: Math.min(100, Math.max(0, Math.round(calcFormal)))
          };

          // Diagnostic alert determination
          let alert = defaultStudent.alert;
          if (loScores['LO-03'] < 50) {
            alert = {
              type: 'PERSISTENT_DIFFICULTY',
              severity: 'critical',
              icon: '🚨',
              title: 'Persistent Difficulty',
              summary: `Attempts on LO-03 at ${loScores['LO-03']}%.`,
              recommendation: 'Assign 1-on-1 shadow geometry review.',
              tagColor: '#ef4444'
            };
          } else if (dimensions.mastery >= 75 && dimensions.practicalSkill < 55) {
            alert = {
              type: 'APPLICATION_GAP',
              severity: 'warning',
              icon: '⚠️',
              title: 'Application Gap',
              summary: `High mastery (${dimensions.mastery}%) but low lab practical adherence (${dimensions.practicalSkill}%).`,
              recommendation: 'Assign 3D optics simulation calibration step.',
              tagColor: '#f59e0b'
            };
          } else if (loScores['LO-03'] >= 75 && dimensions.practicalSkill >= 60) {
            alert = null;
          }

          return {
            ...defaultStudent,
            id: sId,
            name: p.name || defaultStudent.name,
            email: p.email || defaultStudent.email,
            class: p.class_name || defaultStudent.class,
            avatar_url: p.avatar_url || defaultStudent.avatar_url,
            math,
            physics,
            chemistry,
            loScores,
            dimensions,
            recentAttempts,
            alert
          };
        });
      });
    } catch (e) {
      console.warn('Supabase fetch notice:', e);
    }
  }, []);

  // Initial mount: load live analytics from Supabase & localStorage evidence
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (isMounted) {
        await fetchLiveAnalytics();
        syncWithLocalStorageEvidence();
      }
    };
    void init();

    // Event listener for live analytics update
    const handleLiveUpdate = (e) => {
      const detail = e.detail;
      if (detail && isMounted) {
        syncWithLocalStorageEvidence();
        void fetchLiveAnalytics();

        const name = detail.studentName || 'Student';
        const title = detail.quizTitle || detail.title || 'Interactive Quiz';
        const score = detail.score !== undefined ? `${detail.score}%` : 'New Evidence';

        showLiveToast(`Live Telemetry Received: ${name} completed "${title}" with score ${score}!`);
      }
    };

    window.addEventListener('edtech:analytics:update', handleLiveUpdate);

    // Cross-tab storage listener
    const handleStorage = (e) => {
      if (e.key === 'edtech_analytics_evidence' && isMounted) {
        syncWithLocalStorageEvidence();
        void fetchLiveAnalytics();
        showLiveToast('Live Telemetry Update: New analytics evidence synced across tabs.');
      }
    };
    window.addEventListener('storage', handleStorage);

    // BroadcastChannel sync
    let bc = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('edtech_platform_sync');
        bc.onmessage = (e) => {
          if ((e.data?.type === 'QUIZ_SUBMITTED' || e.data?.type === 'ANALYTICS_UPDATE') && isMounted) {
            syncWithLocalStorageEvidence();
            void fetchLiveAnalytics();
            showLiveToast(`Live Telemetry Received: ${e.data.studentName || 'Learner'} submitted quiz!`);
          }
        };
      } catch {
        /* ignore error */
      }
    }

    // Setup Supabase Realtime channel on public.analytics_events (INSERT)
    const realtimeChannel = supabase
      .channel('realtime-teacher-analytics')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'analytics_events'
        },
        (payload) => {
          if (!isMounted) return;
          void fetchLiveAnalytics();
          const newRecord = payload.new || {};
          const evPayload = newRecord.payload || {};
          const studentName = evPayload.studentName || evPayload.name || evPayload.student_name || 'Student';
          const title = evPayload.quizTitle || evPayload.title || evPayload.activity_type || newRecord.event_type || 'Interactive Assessment';
          const score = evPayload.score_pct ?? evPayload.score ?? evPayload.mastery_score;
          const scoreText = score !== undefined ? ` with score ${score}%` : '';
          showLiveToast(`Live Telemetry Received: ${studentName} completed "${title}"${scoreText}!`);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'test_submissions'
        },
        (payload) => {
          if (!isMounted) return;
          void fetchLiveAnalytics();
          const sub = payload.new || {};
          const studentName = sub.student_email || 'Student';
          const score = sub.score !== undefined ? ` with score ${sub.score}%` : '';
          showLiveToast(`Live Telemetry Received: ${studentName} submitted test${score}!`);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      window.removeEventListener('edtech:analytics:update', handleLiveUpdate);
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
      supabase.removeChannel(realtimeChannel);
    };
  }, [fetchLiveAnalytics, showLiveToast, syncWithLocalStorageEvidence]);

  // Filter students based on selected class
  const studentsInClass = useMemo(() => {
    return (students || []).filter(s => {
      if (!s) return false;
      if (selectedClass === 'All') return true;
      return s.class === selectedClass || s.secondaryClass === selectedClass;
    });
  }, [students, selectedClass]);

  // Filtered dataset for student dropdown & KPIs
  const filteredData = useMemo(() => {
    return studentsInClass.filter(s => {
      if (!s) return false;
      return selectedStudent === 'All' || String(s.id) === String(selectedStudent);
    });
  }, [studentsInClass, selectedStudent]);

  // Heatmap rows based on heatmapFilter
  const heatmapRows = useMemo(() => {
    return filteredData.filter(s => {
      if (!s) return false;
      const loValues = Object.values(s.loScores || {});
      const avgLo = loValues.length > 0 ? loValues.reduce((a, b) => a + (Number(b) || 0), 0) / loValues.length : 0;
      const hasStrugglingLo = loValues.some(val => (Number(val) || 0) < 50);

      if (heatmapFilter === 'needsSupport') {
        return Boolean(s.alert) || hasStrugglingLo;
      }
      if (heatmapFilter === 'mastered') {
        return avgLo >= 75 && !s.alert && !hasStrugglingLo;
      }
      return true;
    });
  }, [filteredData, heatmapFilter]);

  // Students requiring diagnostic intervention alerts
  const alertStudents = useMemo(() => {
    return studentsInClass.filter(s => s && s.alert != null && typeof s.alert === 'object');
  }, [studentsInClass]);

  // Overall KPIs
  const kpis = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return null;

    let totalMath = 0, totalPhysics = 0, totalChemistry = 0;
    let bestStudent = filteredData[0] || {};
    let highestAvg = 0;

    filteredData.forEach(s => {
      if (!s) return;
      const sMath = Number(s.math) || 0;
      const sPhys = Number(s.physics) || 0;
      const sChem = Number(s.chemistry) || 0;
      totalMath += sMath;
      totalPhysics += sPhys;
      totalChemistry += sChem;

      const avg = (sMath + sPhys + sChem) / 3;
      if (avg >= highestAvg) {
        highestAvg = avg;
        bestStudent = s;
      }
    });

    const count = filteredData.length;
    const avgMath = count > 0 ? totalMath / count : 0;
    const avgPhysics = count > 0 ? totalPhysics / count : 0;
    const avgChemistry = count > 0 ? totalChemistry / count : 0;
    const overallAvg = count > 0 ? (avgMath + avgPhysics + avgChemistry) / 3 : 0;
    const regionalAvg = (CBSE_BENCHMARKS.physics + CBSE_BENCHMARKS.chemistry + CBSE_BENCHMARKS.math) / 3;
    const diff = overallAvg - regionalAvg;
    const baselineDelta = diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);

    return {
      overallAvg: overallAvg.toFixed(1),
      avgMath: avgMath.toFixed(1),
      avgPhysics: avgPhysics.toFixed(1),
      avgChemistry: avgChemistry.toFixed(1),
      bestStudent: { name: bestStudent.name || 'Student', avg: highestAvg.toFixed(1) },
      totalCount: count,
      baselineDelta,
      isOutperforming: diff >= 0
    };
  }, [filteredData]);

  // Class Benchmark Comparison Data vs CBSE Regional Benchmark
  const benchmarkChartData = useMemo(() => {
    const classPhysics = kpis ? (parseFloat(kpis.avgPhysics) || 88.0) : 88.0;
    const classChemistry = kpis ? (parseFloat(kpis.avgChemistry) || 83.0) : 83.0;
    const classMath = kpis ? (parseFloat(kpis.avgMath) || 84.5) : 84.5;

    return [
      {
        subject: 'Physics & Optics',
        classAverage: classPhysics,
        cbseBenchmark: CBSE_BENCHMARKS.physics,
        delta: (classPhysics - CBSE_BENCHMARKS.physics).toFixed(1)
      },
      {
        subject: 'Chemistry',
        classAverage: classChemistry,
        cbseBenchmark: CBSE_BENCHMARKS.chemistry,
        delta: (classChemistry - CBSE_BENCHMARKS.chemistry).toFixed(1)
      },
      {
        subject: 'Mathematics',
        classAverage: classMath,
        cbseBenchmark: CBSE_BENCHMARKS.math,
        delta: (classMath - CBSE_BENCHMARKS.math).toFixed(1)
      }
    ];
  }, [kpis]);

  // Class 7-Dimension Competency Radar Data (Spider Diagram)
  const radarData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];
    const total = filteredData.length;
    const sum = {
      mastery: 0,
      fluency: 0,
      application: 0,
      practicalSkill: 0,
      exploration: 0,
      engagement: 0,
      formalAchievement: 0
    };
    filteredData.forEach(s => {
      const d = s?.dimensions || {};
      sum.mastery += Number(d.mastery) || 80;
      sum.fluency += Number(d.fluency) || 75;
      sum.application += Number(d.application) || 70;
      sum.practicalSkill += Number(d.practicalSkill) || 65;
      sum.exploration += Number(d.exploration) || 80;
      sum.engagement += Number(d.engagement) || 0;
      sum.formalAchievement += Number(d.formalAchievement) || 78;
    });

    return [
      { dimension: 'Mastery', score: Math.round(sum.mastery / total), benchmark: 76 },
      { dimension: 'Fluency', score: Math.round(sum.fluency / total), benchmark: 72 },
      { dimension: 'Application', score: Math.round(sum.application / total), benchmark: 68 },
      { dimension: 'Practical Lab', score: Math.round(sum.practicalSkill / total), benchmark: 70 },
      { dimension: 'Exploration', score: Math.round(sum.exploration / total), benchmark: 65 },
      { dimension: 'Engagement', score: Math.round(sum.engagement / total), benchmark: 80 },
      { dimension: 'Exam Score', score: Math.round(sum.formalAchievement / total), benchmark: 74 },
    ];
  }, [filteredData]);

  // Cohort Competency Distribution Donut Data
  const cohortDistributionData = useMemo(() => {
    let mastered = 0;
    let inProgress = 0;
    let needsSupport = 0;
    (filteredData || []).forEach(s => {
      const vals = CHAPTER_10_LOS.map(lo => s?.loScores?.[lo.id] || 0);
      const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
      if (avg >= 75) mastered++;
      else if (avg >= 50) inProgress++;
      else needsSupport++;
    });

    return [
      { name: 'Mastered (≥ 75%)', value: mastered, color: '#10B981', label: 'Mastered' },
      { name: 'In Progress (50-74%)', value: inProgress, color: '#F59E0B', label: 'In Progress' },
      { name: 'Needs Support (< 50%)', value: needsSupport, color: '#EF4444', label: 'Needs Support' }
    ];
  }, [filteredData]);

  // 4 Learning Objective Radial Progress Ring Metrics
  const loProgressMetrics = useMemo(() => {
    return CHAPTER_10_LOS.map(lo => {
      const scores = (filteredData || []).map(s => s?.loScores?.[lo.id] || 0);
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const masteredCount = scores.filter(sc => sc >= 75).length;
      const status = getScoreStatus(avg);
      return {
        ...lo,
        avgScore: avg,
        masteredCount,
        totalCount: scores.length,
        status
      };
    });
  }, [filteredData]);

  // Handler to simulate student quiz update for live demonstration
  const handleSimulateQuizEvent = () => {
    const simulationEvent = {
      studentId: '66fdfdcd-d922-48fa-bdc5-a47e01e6a6bf',
      studentName: 'Saurav Roy',
      quizTitle: 'Shadow Geometry & Ray Angle Remediation Lab',
      score: 82,
      loId: 'LO-03',
      loScores: {
        'LO-03': 82
      },
      attempt: {
        id: 'sim-' + Date.now(),
        title: 'Shadow Geometry & Ray Angle Remediation Lab (Live)',
        lo: 'LO-03',
        score: 82,
        date: 'Just now',
        duration: '16 mins',
        status: 'Mastered'
      },
      dimensions: {
        mastery: 78,
        application: 74,
        practicalSkill: 80
      }
    };

    // Store in localStorage for persistence
    try {
      const existing = JSON.parse(localStorage.getItem('edtech_analytics_evidence') || '[]');
      const updated = [simulationEvent, ...(Array.isArray(existing) ? existing : [])];
      localStorage.setItem('edtech_analytics_evidence', JSON.stringify(updated));
    } catch {
      /* ignore error */
    }

    // Dispatch custom event to window
    window.dispatchEvent(new CustomEvent('edtech:analytics:update', {
      detail: simulationEvent
    }));

    // Broadcast to Supabase analytics_events for real-time multi-device subscription
    supabase.from('analytics_events').insert([{
      student_id: simulationEvent.studentId,
      event_type: 'quiz_complete',
      payload: simulationEvent
    }]).then(({ error }) => {
      if (error) console.warn('Supabase realtime broadcast notice:', error.message);
    }).catch(e => console.warn('Supabase simulation broadcast:', e));
  };

  // Handler for assigning remediation in drill-down card
  const handleAssignRemediation = (student) => {
    setRemediationSent(true);
    setTimeout(() => setRemediationSent(false), 3000);
    showLiveToast(`Remediation assigned for ${student?.name || 'Student'}: 3D Interactive Lab module scheduled.`);
  };

  return (
    <div className="view-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Live Toast Notification */}
      {liveToast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, rgba(10, 25, 47, 0.95), rgba(13, 19, 41, 0.95))',
          border: '1px solid var(--brand-primary, #00F0FF)',
          boxShadow: '0 8px 32px rgba(0, 240, 255, 0.35)',
          color: 'white',
          padding: '14px 22px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backdropFilter: 'blur(12px)',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <Radio size={20} className="text-cyan-400" style={{ color: '#00F0FF', animation: 'pulse 1.5s infinite' }} />
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#00F0FF', fontWeight: '800' }}>
              Real-time Telemetry
            </div>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>{liveToast}</div>
          </div>
          <button
            onClick={() => setLiveToast(null)}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', marginLeft: '8px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 4px 0', color: 'white' }}>
              Classroom Intelligence & Analytics
            </h2>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '700',
              background: 'rgba(0, 240, 255, 0.12)',
              border: '1px solid rgba(0, 240, 255, 0.35)',
              color: '#00F0FF'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00F0FF', boxShadow: '0 0 8px #00F0FF' }} />
              LIVE TELEMETRY
            </span>
          </div>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>
            Chapter 10 (Light and Shadows — Class 6th Science) Learning Objective Heatmap, diagnostic intervention alerts, and CBSE benchmarks.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Quick Simulation Button for Demo Testing */}
          <button
            onClick={handleSimulateQuizEvent}
            className="btn btn-ghost"
            title="Simulates a student submitting a live quiz and updates analytics via window events"
            style={{
              padding: '7px 14px',
              fontSize: '12px',
              borderRadius: '10px',
              color: '#00F0FF',
              borderColor: 'rgba(0, 240, 255, 0.4)',
              background: 'rgba(0, 240, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Zap size={14} />
            Simulate Quiz Event
          </button>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: '700' }}>
              ALLOTTED CLASS
            </label>
            <div
              style={{
                background: 'rgba(0, 240, 255, 0.08)',
                border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.35))',
                color: 'var(--brand-primary, #00F0FF)',
                padding: '8px 16px',
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>🏫 Class 6th</span>
              <span style={{ fontSize: '10px', background: 'rgba(0, 240, 255, 0.2)', padding: '2px 8px', borderRadius: '6px', color: '#fff', letterSpacing: '0.5px' }}>
                ACTIVE COHORT
              </span>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: '700' }}>
              FILTER STUDENT
            </label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.3))',
                color: 'var(--brand-primary, #00F0FF)',
                padding: '8px 16px',
                borderRadius: '10px',
                fontWeight: '700',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="All" style={{ color: 'black' }}>All Students ({studentsInClass.length})</option>
              {studentsInClass.map(s => (
                <option key={s.id} value={s.id} style={{ color: 'black' }}>
                  {s.name} {s.alert ? `(${s.alert.icon})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <Card style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--brand-glow, rgba(0, 240, 255, 0.1))', color: 'var(--brand-primary, #00F0FF)' }}>
                <TrendingUp size={24} />
              </div>
              <div>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Class 6th Composite Average</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.6rem', fontWeight: '800', color: 'white' }}>{kpis.overallAvg}%</h3>
                <span style={{ fontSize: '11px', color: kpis.isOutperforming ? '#10B981' : '#ef4444', fontWeight: '600' }}>
                  {kpis.baselineDelta}% vs regional baseline
                </span>
              </div>
            </div>
          </Card>

          <Card style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                <Trophy size={24} />
              </div>
              <div>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Top Performer</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.4rem', fontWeight: '800', color: 'white' }}>{kpis.bestStudent.name}</h3>
                <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: '600' }}>{kpis.bestStudent.avg}% Mastered</span>
              </div>
            </div>
          </Card>

          <Card style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                <AlertCircle size={24} />
              </div>
              <div>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Needs Support Alerts</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.6rem', fontWeight: '800', color: '#ef4444' }}>
                  {alertStudents.length} Active
                </h3>
                <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '600' }}>Requires teacher action</span>
              </div>
            </div>
          </Card>

          <Card style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
                <Users size={24} />
              </div>
              <div>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Class 6th Active Learners</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.6rem', fontWeight: '800', color: 'white' }}>{kpis.totalCount} Cohort</h3>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>94.2% Attendance</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Diagram Row 1: 7-Dimension Competency Radar & Cohort Distribution Donut ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>

        {/* Class 7-Dimension Competency Radar (Spider Diagram) */}
        <Card style={{ padding: '22px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass size={20} style={{ color: '#00F0FF' }} />
                <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: '800' }}>
                  Class 6th 7-Dimension Competency Radar
                </h3>
              </div>
              <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>
                Cognitive & practical learning profile of Class 6th students vs. CBSE regional standard.
              </p>
            </div>
            <span style={{ fontSize: '11px', color: '#00F0FF', fontWeight: '700', background: 'rgba(0, 240, 255, 0.1)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(0, 240, 255, 0.3)' }}>
              Spider Diagram
            </span>
          </div>

          <div style={{ width: '100%', height: '300px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarData}>
                <PolarGrid stroke="rgba(255, 255, 255, 0.1)" />
                <PolarAngleAxis dataKey="dimension" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: '600' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="rgba(255, 255, 255, 0.15)" tick={{ fill: '#64748b', fontSize: 10 }} />
                <Radar name="Class Cohort" dataKey="score" stroke="#00F0FF" fill="#00F0FF" fillOpacity={0.35} strokeWidth={2} />
                <Radar name="CBSE Baseline" dataKey="benchmark" stroke="#A855F7" fill="#A855F7" fillOpacity={0.12} strokeWidth={1.5} strokeDasharray="4 4" />
                <Legend
                  wrapperStyle={{ paddingTop: '8px' }}
                  formatter={(value) => <span style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: '600' }}>{value}</span>}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(10, 15, 29, 0.95)', borderColor: 'rgba(0, 240, 255, 0.4)', borderRadius: '12px', color: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}
                  formatter={(val, name) => [`${val}%`, name]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Cohort Mastery Distribution Donut */}
        <Card style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={20} style={{ color: '#10B981' }} />
                  <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: '800' }}>
                    Class 6th Cohort Mastery Distribution
                  </h3>
                </div>
                <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>
                  Class 6th competency tiers based on active Chapter 10 assessment scores.
                </p>
              </div>
              <span style={{ fontSize: '11px', color: '#10B981', fontWeight: '700', background: 'rgba(16, 185, 129, 0.12)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                {kpis?.totalCount || 5} Class 6th Students
              </span>
            </div>

            <div style={{ width: '100%', height: '210px', position: 'relative', minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cohortDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {cohortDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(10, 15, 29, 0.8)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(10, 15, 29, 0.95)', borderColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '10px', color: '#fff' }}
                    formatter={(val, name) => [`${val} Students`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Donut Label */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white' }}>{kpis?.totalCount || 5}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cohort</div>
              </div>
            </div>
          </div>

          {/* Distribution Pills */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' }}>
            {cohortDistributionData.map(item => (
              <div
                key={item.name}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${item.color}44`,
                  borderRadius: '10px',
                  padding: '8px 10px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: item.color, margin: '2px 0' }}>{item.value}</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>
                  {Math.round((item.value / Math.max(kpis?.totalCount || 5, 1)) * 100)}%
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Diagram Row 2: 4 Learning Objective Radial Progress Rings ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {loProgressMetrics.map(lo => {
          const circumference = 2 * Math.PI * 34;
          const strokeDashoffset = circumference - (circumference * lo.avgScore) / 100;
          return (
            <Card key={lo.id} style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '16px', border: `1px solid ${lo.status.border}`, background: 'rgba(13, 20, 36, 0.6)' }}>
              {/* SVG Radial Progress Ring */}
              <div style={{ position: 'relative', width: '74px', height: '74px', flexShrink: 0 }}>
                <svg width="74" height="74" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="37"
                    cy="37"
                    r="34"
                    fill="transparent"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="37"
                    cy="37"
                    r="34"
                    fill="transparent"
                    stroke={lo.status.color}
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                </svg>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800',
                  fontSize: '14px',
                  color: lo.status.color
                }}>
                  {lo.avgScore}%
                </div>
              </div>

              {/* Text Meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--brand-primary, #00F0FF)' }}>
                    {lo.code}
                  </span>
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '6px', background: lo.status.bg, color: lo.status.color, fontWeight: '700' }}>
                    {lo.status.label}
                  </span>
                </div>
                <h4 style={{ margin: '3px 0', fontSize: '0.88rem', fontWeight: '700', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={lo.title}>
                  {lo.short}
                </h4>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {lo.masteredCount} of {lo.totalCount} Mastered
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Compact Diagnostic Alerts Strip (Clean, Non-Cluttered) ── */}
      {alertStudents.length > 0 && (
        <Card style={{ padding: '16px 20px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.08) 0%, rgba(13, 19, 41, 0.7) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
              <h3 style={{ margin: 0, color: 'white', fontSize: '1.05rem', fontWeight: '800' }}>
                Needs Support Alerts ({alertStudents.length})
              </h3>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>— Diagnostic telemetry signals requiring action</span>
            </div>
            <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '600' }}>Click student to inspect 7-dimension diagnostic</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {alertStudents.map(student => {
              const alert = student?.alert || {};
              const tagColor = alert.tagColor || '#ef4444';
              return (
                <div
                  key={student.id}
                  onClick={() => setDrillDownStudent(student)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${tagColor}44`,
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.borderColor = tagColor; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.borderColor = `${tagColor}44`; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.1)',
                      border: `1px solid ${tagColor}66`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      color: 'white',
                      fontSize: '13px'
                    }}>
                      {(student?.name || 'S').charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', color: 'white', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {student?.name}
                        <span style={{ fontSize: '11px', color: tagColor, fontWeight: '700' }}>
                          {alert.icon || '⚠️'} {alert.type || 'Alert'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {alert.summary || 'Telemetry indicates reinforcement needed.'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAssignRemediation(student);
                    }}
                    className="btn btn-ghost"
                    style={{
                      padding: '5px 10px',
                      fontSize: '11px',
                      borderRadius: '8px',
                      color: '#00F0FF',
                      borderColor: 'rgba(0, 240, 255, 0.4)',
                      flexShrink: 0
                    }}
                  >
                    Assign Lab
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Interactive Learning Objective (LO) Heatmap Card */}
      <Card style={{ padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} className="text-cyan-400" style={{ color: '#00F0FF' }} />
              <h3 style={{ margin: 0, color: 'white', fontSize: '1.25rem', fontWeight: '800' }}>
                Chapter 10: Light and Shadows (Class 6th Science) — Interactive Learning Objective (LO) Heatmap
              </h3>
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
              Competency distribution across Class 6th registered learners. Click any student row to drill down.
            </p>
          </div>

          {/* Heatmap Filters */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', gap: '4px' }}>
            <button
              onClick={() => setHeatmapFilter('all')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: heatmapFilter === 'all' ? 'var(--brand-primary, #00F0FF)' : 'transparent',
                color: heatmapFilter === 'all' ? '#000' : '#94a3b8',
                transition: 'all 0.2s ease'
              }}
            >
              All Students ({filteredData.length})
            </button>
            <button
              onClick={() => setHeatmapFilter('needsSupport')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: heatmapFilter === 'needsSupport' ? '#ef4444' : 'transparent',
                color: heatmapFilter === 'needsSupport' ? '#fff' : '#94a3b8',
                transition: 'all 0.2s ease'
              }}
            >
              Needs Support (Alerts) ({alertStudents.length})
            </button>
            <button
              onClick={() => setHeatmapFilter('mastered')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: heatmapFilter === 'mastered' ? '#10b981' : 'transparent',
                color: heatmapFilter === 'mastered' ? '#000' : '#94a3b8',
                transition: 'all 0.2s ease'
              }}
            >
              Mastered (≥ 75%)
            </button>
          </div>
        </div>

        {/* Heatmap Table */}
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '780px' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '12px', fontWeight: '700', width: '220px' }}>
                  STUDENT NAME
                </th>
                {CHAPTER_10_LOS.map(lo => (
                  <th key={lo.id} style={{ padding: '14px 16px', color: '#cbd5e1', fontSize: '12px', fontWeight: '700', textAlign: 'center' }}>
                    <div style={{ color: 'var(--brand-primary, #00F0FF)', fontWeight: '800' }}>{lo.code}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500', maxWidth: '160px', margin: '0 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={lo.title}>
                      {lo.short}
                    </div>
                  </th>
                ))}
                <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '12px', fontWeight: '700', textAlign: 'center', width: '130px' }}>
                  OVERALL LO AVG
                </th>
                <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '12px', fontWeight: '700', textAlign: 'center', width: '100px' }}>
                  ACTION
                </th>
              </tr>
            </thead>
            <tbody>
              {heatmapRows.map((student, sIdx) => {
                const loScores = student.loScores || {};
                const values = CHAPTER_10_LOS.map(lo => loScores[lo.id] || 0);
                const avgLo = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
                const overallStatus = getScoreStatus(avgLo);

                return (
                  <tr
                    key={student.id}
                    onClick={() => setDrillDownStudent(student)}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      background: sIdx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 240, 255, 0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = sIdx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent'; }}
                  >
                    {/* Student Info */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, rgba(0,240,255,0.2), rgba(59,130,246,0.2))',
                          border: '1px solid rgba(0,240,255,0.4)',
                          color: 'white',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px'
                        }}>
                          {(student?.name || 'S').charAt(0)}
                        </div>
                        <div>
                          <div style={{ color: 'white', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {student?.name || 'Student'}
                            {student?.alert && (
                              <span title={`${student.alert.type || 'Alert'}: ${student.alert.summary || ''}`} style={{ fontSize: '12px' }}>
                                {student.alert.icon || '⚠️'}
                              </span>
                            )}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '11px' }}>{student?.class || 'N/A'}</div>
                        </div>
                      </div>
                    </td>

                    {/* LO Heatmap Cells */}
                    {CHAPTER_10_LOS.map(lo => {
                      const score = loScores[lo.id] || 0;
                      const status = getScoreStatus(score);

                      return (
                        <td key={lo.id} style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <div
                            title={`${lo.code} (${lo.title}): ${score}% - ${status.label}`}
                            style={{
                              background: status.bg,
                              border: `1px solid ${status.border}`,
                              color: status.color,
                              padding: '8px 12px',
                              borderRadius: '10px',
                              fontWeight: '800',
                              fontSize: '13px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              minWidth: '78px',
                              transition: 'transform 0.15s ease'
                            }}
                          >
                            <span style={{ fontSize: '10px' }}>{status.icon}</span>
                            <span>{score}%</span>
                          </div>
                        </td>
                      );
                    })}

                    {/* Overall LO Average */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontWeight: '800',
                        fontSize: '13px',
                        color: overallStatus.color,
                        background: overallStatus.bg,
                        border: `1px solid ${overallStatus.border}`
                      }}>
                        {avgLo}%
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrillDownStudent(student);
                        }}
                        className="btn btn-ghost"
                        style={{
                          padding: '5px 10px',
                          fontSize: '11px',
                          color: '#00F0FF',
                          borderColor: 'rgba(0, 240, 255, 0.3)',
                          borderRadius: '8px'
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Heatmap Legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginTop: '16px', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '12px', color: '#cbd5e1' }}>
            <span style={{ fontWeight: '700', color: '#94a3b8' }}>LEGEND:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: '#10B981' }} />
              <span>🟢 Mastered (≥ 75%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: '#F59E0B' }} />
              <span>🟡 In Progress (50% - 74%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: '#EF4444' }} />
              <span>🔴 Struggling (&lt; 50%)</span>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            💡 Tip: Click on any row to open the full 7-dimension diagnostic profile.
          </div>
        </div>
      </Card>

      {/* Class Benchmark Comparison Bar Chart Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px' }}>
        <Card style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={20} style={{ color: '#00F0FF' }} />
                <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: '800' }}>
                  Class 6th Mastery vs. CBSE Grade 6 Regional Benchmarks
                </h3>
              </div>
              <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                Standardized curriculum comparison for Class 6th across Physics/Optics, Chemistry, and Mathematics.
              </p>
            </div>

            <span style={{ fontSize: '12px', color: '#10B981', fontWeight: '700', background: 'rgba(16, 185, 129, 0.12)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              Outperforming Baseline
            </span>
          </div>

          <div style={{ width: '100%', height: '300px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minHeight={250}>
              <BarChart data={benchmarkChartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="classBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00F0FF" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#0070F3" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="cbseBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A855F7" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#6B21A8" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: '600' }} />
                <YAxis stroke="#94a3b8" domain={[40, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(10, 15, 29, 0.95)', borderColor: 'rgba(0, 240, 255, 0.4)', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                  formatter={(val, name) => [`${val}%`, name]}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '10px' }}
                  formatter={(value) => <span style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: '600' }}>{value}</span>}
                />
                <Bar name="Class Average" dataKey="classAverage" fill="url(#classBarGrad)" radius={[8, 8, 0, 0]} barSize={34} />
                <Bar name="CBSE Regional Benchmark" dataKey="cbseBenchmark" fill="url(#cbseBarGrad)" radius={[8, 8, 0, 0]} barSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Regional Delta Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px' }}>
            {benchmarkChartData.map(item => (
              <div key={item.subject} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.subject}</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#00F0FF', margin: '2px 0' }}>
                  +{item.delta}%
                </div>
                <div style={{ fontSize: '10px', color: '#10B981', fontWeight: '600' }}>vs CBSE Benchmark ({item.cbseBenchmark}%)</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Student Leaderboard & Fast Insights */}
        <Card style={{ padding: '22px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>
            Class Leaderboard
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredData.slice(0, 5).map((s, idx) => {
              const avg = Math.round(((Number(s?.math) || 0) + (Number(s?.physics) || 0) + (Number(s?.chemistry) || 0)) / 3);
              const sName = s?.name || `Student ${idx + 1}`;
              return (
                <div
                  key={s?.id || idx}
                  onClick={() => setDrillDownStudent(s)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: idx === 0
                      ? 'linear-gradient(135deg, var(--brand-glow, rgba(0, 240, 255, 0.15)), var(--brand-secondary, rgba(59, 130, 246, 0.15)))'
                      : 'rgba(255, 255, 255, 0.02)',
                    border: idx === 0 ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(4px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: '800', color: idx === 0 ? '#fbbf24' : '#94a3b8', fontSize: '0.95rem', width: '20px' }}>
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 style={{ margin: 0, color: 'white', fontSize: '0.95rem', fontWeight: '700' }}>
                        {sName} {s?.alert && <span>{s.alert.icon || '⚠️'}</span>}
                      </h4>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.75rem' }}>{s?.class || 'N/A'}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--brand-primary, #00F0FF)', fontWeight: '800', fontSize: '1rem' }}>{avg}%</span>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>Overall Avg</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '20px', padding: '12px', borderRadius: '10px', background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.2)', fontSize: '12px', color: '#cbd5e1' }}>
            <strong style={{ color: '#00F0FF' }}>Curriculum Recommendation:</strong>
            <p style={{ margin: '4px 0 0 0', lineHeight: 1.4, color: '#94a3b8' }}>
              Conduct a quick smartboard review of <strong>LO-03 (Angle Prediction)</strong> before beginning Chapter 11.
            </p>
          </div>
        </Card>
      </div>

      {/* Student Drill-Down Modal / Card */}
      {drillDownStudent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(5, 8, 17, 0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #0d1329 0%, #080c1d 100%)',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 240, 255, 0.2)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '860px',
            maxHeight: '90vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            padding: '26px'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: '800',
                  color: '#000',
                  boxShadow: '0 0 20px rgba(0, 240, 255, 0.4)'
                }}>
                  {(drillDownStudent.name || 'S').charAt(0)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: '800' }}>
                      {drillDownStudent.name || 'Student'}
                    </h3>
                    <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: '6px', color: '#cbd5e1' }}>
                      {drillDownStudent.class || 'N/A'}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                    Student ID: {drillDownStudent.id || 'N/A'} • Attendance: {drillDownStudent.attendance ?? 95}%
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {drillDownStudent.alert && (
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '800',
                    background: (drillDownStudent.alert.tagColor || '#ef4444') + '22',
                    color: drillDownStudent.alert.tagColor || '#ef4444',
                    border: `1px solid ${(drillDownStudent.alert.tagColor || '#ef4444')}55`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {drillDownStudent.alert.icon || '⚠️'} {drillDownStudent.alert.type || 'Intervention'}
                  </span>
                )}
                <button
                  onClick={() => setDrillDownStudent(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Alert Banner inside Modal if Student has active warning */}
            {drillDownStudent.alert && (
              <div style={{
                background: (drillDownStudent.alert.tagColor || '#ef4444') + '18',
                border: `1px solid ${(drillDownStudent.alert.tagColor || '#ef4444')}55`,
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: drillDownStudent.alert.tagColor || '#ef4444', fontWeight: '800', fontSize: '13px' }}>
                  <AlertTriangle size={18} />
                  <span>DIAGNOSTIC SIGNAL: {(drillDownStudent.alert.title || drillDownStudent.alert.type || 'SUPPORT REQUIRED').toUpperCase()}</span>
                </div>
                <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>
                  {drillDownStudent.alert.summary || 'Telemetry indicates targeted intervention is recommended.'}
                </div>
                <div style={{ color: '#cbd5e1', fontSize: '12px', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px' }}>
                  <strong style={{ color: '#fbbf24' }}>Action Recommendation:</strong> {drillDownStudent.alert.recommendation || 'Assign targeted remediation practice.'}
                </div>
              </div>
            )}

            {/* Section 1: Full 7-Dimension Profile */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Compass size={18} style={{ color: '#00F0FF' }} />
                <h4 style={{ margin: 0, color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>
                  7-Dimension Competency Profile
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {[
                  { key: 'mastery', name: '1. Mastery', desc: 'Concept retention & accuracy', val: drillDownStudent.dimensions?.mastery || 85 },
                  { key: 'fluency', name: '2. Fluency', desc: 'Speed & response consistency', val: drillDownStudent.dimensions?.fluency || 80 },
                  { key: 'application', name: '3. Application', desc: 'Problem solving transfer', val: drillDownStudent.dimensions?.application || 75 },
                  { key: 'practicalSkill', name: '4. Practical Skill', desc: 'Virtual lab adherence & handling', val: drillDownStudent.dimensions?.practicalSkill || 70 },
                  { key: 'exploration', name: '5. Exploration', desc: 'Sandbox trials & curiosity', val: drillDownStudent.dimensions?.exploration || 85 },
                  { key: 'engagement', name: '6. Engagement', desc: 'Time-on-task & regularity', val: drillDownStudent.dimensions?.engagement || 90 },
                  { key: 'formalAchievement', name: '7. Formal Achievement', desc: 'Classroom & pen-paper exams', val: drillDownStudent.dimensions?.formalAchievement || 78 }
                ].map(dim => {
                  const status = getScoreStatus(dim.val);
                  return (
                    <div key={dim.key} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '700' }}>{dim.name}</span>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: status.color }}>{dim.val}%</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${dim.val}%`, height: '100%', background: status.color, borderRadius: '4px' }} />
                      </div>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>{dim.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Chapter 10 LO Breakdown */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <BookOpen size={18} style={{ color: '#00F0FF' }} />
                <h4 style={{ margin: 0, color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>
                  Chapter 10 Learning Objective Breakdown
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '10px' }}>
                {CHAPTER_10_LOS.map(lo => {
                  const score = drillDownStudent.loScores?.[lo.id] || 0;
                  const status = getScoreStatus(score);
                  return (
                    <div key={lo.id} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${status.border}`,
                      borderRadius: '10px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#00F0FF', fontWeight: '800', fontSize: '12px' }}>{lo.code}</span>
                          <span style={{ color: 'white', fontWeight: '600', fontSize: '12px' }}>{lo.short}</span>
                        </div>
                        <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '11px' }}>{lo.desc}</p>
                      </div>
                      <div style={{
                        background: status.bg,
                        color: status.color,
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontWeight: '800',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {status.icon} {score}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Recent Assessment Attempts */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Activity size={18} style={{ color: '#00F0FF' }} />
                <h4 style={{ margin: 0, color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>
                  Recent Attempts & Telemetry History
                </h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(drillDownStudent.recentAttempts || []).map(att => {
                  const status = getScoreStatus(att.score);
                  return (
                    <div key={att.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 16px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      fontSize: '13px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(0, 240, 255, 0.1)',
                          color: '#00F0FF',
                          fontWeight: '700',
                          fontSize: '11px'
                        }}>
                          {att.lo}
                        </span>
                        <div>
                          <div style={{ color: 'white', fontWeight: '600' }}>{att.title}</div>
                          <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                            {att.date} • Duration: {att.duration}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontWeight: '800',
                          color: status.color,
                          background: status.bg,
                          padding: '4px 10px',
                          borderRadius: '6px'
                        }}>
                          {att.score}% ({status.label})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
              <button
                onClick={() => setDrillDownStudent(null)}
                className="btn btn-ghost"
                style={{ padding: '8px 18px', borderRadius: '10px' }}
              >
                Close Profile
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => handleAssignRemediation(drillDownStudent)}
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {remediationSent ? <Check size={16} /> : <Zap size={16} />}
                  {remediationSent ? 'Remediation Assigned!' : 'Assign Targeted 3D Lab'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
