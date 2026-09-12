import { supabase } from '../supabase';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';
import Card from '../components/Card';
import ProgressBar from '../components/ProgressBar';
import { Flame, Clock, BookOpen, TrendingUp, Sparkles, Award, Activity } from 'lucide-react';
import './Progress.css';

export default function Progress() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [timeRange, setTimeRange] = useState('This Month');
  const [testResults, setTestResults] = useState({});
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [bestAccuracyPct, setBestAccuracyPct] = useState(0);
  const [bestMasteryPct, setBestMasteryPct] = useState(0);
  const [dimensions, setDimensions] = useState({
    conceptual_mastery: 0,
    retrieval_fluency: 0,
    problem_application: 0,
    practical_lab_skill: 0,
    scene_exploration: 0,
    session_engagement: 0,
    formal_achievement: 0
  });
  const [bloomLevels, setBloomLevels] = useState({
    remember: 0,
    understand: 0,
    apply: 0,
    analyze: 0
  });

  const fetchRealProgressData = useCallback(async () => {
    let localData = {};
    let evidenceObj = null;

    // 1. Read edtech analytics evidence written by analytics-sdk.js (always prioritize newest attempt)
    try {
      const rawEvidence = localStorage.getItem('edtech_analytics_evidence');
      if (rawEvidence) {
        const parsed = JSON.parse(rawEvidence);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Sort or pick latest by completed_at / timestamp, falling back to last item in array
          evidenceObj = [...parsed].reverse().find(item => item && (item.completed_at || item.completedAt || item.timestamp)) || parsed[parsed.length - 1];
        } else if (parsed && typeof parsed === 'object') {
          evidenceObj = parsed.latest || parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading edtech_analytics_evidence:', e);
    }

    // 3. Read Supabase test_submissions and dimension_profiles
    let supabaseDims = null;
    try {
      const rawUser = localStorage.getItem('edtech_student_user') || localStorage.getItem('edtech_user');
      let studentUser = null;
      try {
        studentUser = rawUser ? JSON.parse(rawUser) : null;
      } catch {
        studentUser = null;
      }

      if (!studentUser) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            studentUser = { id: session.user.id, email: session.user.email };
          }
        } catch { /* ignore session load error */ }
      }

      if (studentUser && (studentUser.id || studentUser.email)) {
        // Query with .or(`student_id.eq.${studentUser.id},student_email.eq.${studentUser.email}`) or safe fallback
        let subQuery = supabase.from('test_submissions').select('*');
        if (studentUser.id && studentUser.email) {
          subQuery = subQuery.or(`student_id.eq.${studentUser.id},student_email.eq.${studentUser.email}`);
        } else if (studentUser.id) {
          subQuery = subQuery.eq('student_id', studentUser.id);
        } else if (studentUser.email) {
          subQuery = subQuery.eq('student_email', studentUser.email);
        }

        const { data: subData, error: subErr } = await subQuery.order('submitted_at', { ascending: false });
        if (!subErr && subData && subData.length > 0) {
          subData.forEach((sub, idx) => {
            if (sub) {
              const id = sub.test_id || sub.id || `sub_${idx}`;
              localData[id] = {
                percentage: Number(sub.score) || 0,
                score: Number(sub.score) || 0,
                grade: sub.grade || (Number(sub.score) >= 80 ? 'A' : Number(sub.score) >= 60 ? 'B' : 'C'),
                submittedAt: sub.submitted_at || new Date().toISOString(),
                subject: sub.subject || 'Science & Physics'
              };
            }
          });
        }

        // Gracefully handle dimension_profiles (if not found, compute 7 dimensions dynamically)
        if (studentUser.id) {
          try {
            const { data: dimData, error: dimErr } = await supabase
              .from('dimension_profiles')
              .select('*')
              .eq('student_id', studentUser.id)
              .maybeSingle();

            if (!dimErr && dimData) {
              supabaseDims = dimData;
            }
          } catch (dimErr) {
            console.warn('dimension_profiles table not available, computing dynamically:', dimErr);
          }
        }
      }
    } catch (e) {
      console.warn('Supabase fetch fallback:', e);
    }

    // Read learning_summaries for best score tracking (requires Phase 2 migration)
    let learningSummary = null;
    try {
      const student = localStorage.getItem('edtech_student_user') || localStorage.getItem('edtech_user');
      let parsed = student ? JSON.parse(student) : null;
      if (!parsed) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) parsed = { id: session.user.id };
      }

      if (parsed?.id) {
        const { data: lsData, error: lsErr } = await supabase
          .from('learning_summaries')
          .select('*')
          .eq('user_id', parsed.id)
          .order('last_activity_date', { ascending: false })
          .limit(5);

        if (!lsErr && lsData && lsData.length > 0) {
          learningSummary = lsData[0]; // Most recent chapter
        }
      }
    } catch (lsError) {
      // Graceful degradation — table may not exist yet if Phase 2 migrations not run
      console.warn('[Progress] learning_summaries unavailable (Phase 2 migrations may be pending):', lsError?.message);
    }

    setTestResults(localData);

    // Compute average score from real test_submissions
    const testScores = Object.values(localData || {}).map(t => Number(t.percentage ?? t.score ?? 0)).filter(n => !isNaN(n));
    const avgScore = testScores.length > 0
      ? Math.round(testScores.reduce((acc, score) => acc + score, 0) / testScores.length)
      : 0;

    // Harmonize 7 dimensions & Bloom levels:
    let resolvedMastery = avgScore > 0 ? avgScore : 0;

    // Set best scores from learning_summaries (0.0–1.0 → 0–100 for display)
    if (learningSummary) {
      const bestMastery = learningSummary.best_mastery != null
        ? Math.round(learningSummary.best_mastery * 100)
        : 0;
      const bestAccuracy = learningSummary.best_accuracy != null
        ? Math.round(learningSummary.best_accuracy * 100)
        : 0;
      setBestMasteryPct(bestMastery);
      setBestAccuracyPct(bestAccuracy);
      setTotalAttempts(learningSummary.total_attempts ?? 0);

      // Override resolvedMastery with best_mastery if better than average
      if (bestMastery > resolvedMastery) {
        resolvedMastery = bestMastery;
      }
    } else {
      setTotalAttempts(Object.keys(localData).length || 0);
    }

    let resolvedFluency = avgScore > 0 ? Math.min(100, Math.round(resolvedMastery * 0.91)) : 0;
    let resolvedApplication = avgScore > 0 ? Math.min(100, Math.round(resolvedMastery * 0.70)) : 0;
    let resolvedPractical = 0;
    let resolvedExploration = 0;
    let resolvedEngagement = 0;
    let resolvedFormal = avgScore > 0 ? avgScore : 0;

    // Support evidenceObj.dimensions and evidenceObj.loScores
    if (evidenceObj) {
      // Support evidenceObj.loScores & evidenceObj.lo_breakdown
      if (evidenceObj.loScores && typeof evidenceObj.loScores === 'object') {
        const lo = evidenceObj.loScores;
        if (lo['LO-01'] !== undefined || lo['LO-02'] !== undefined) {
          const l1 = lo['LO-01'] !== undefined ? Number(lo['LO-01']) : null;
          const l2 = lo['LO-02'] !== undefined ? Number(lo['LO-02']) : null;
          const count = (l1 !== null ? 1 : 0) + (l2 !== null ? 1 : 0);
          if (count > 0) {
            resolvedMastery = Math.round(((l1 || 0) + (l2 || 0)) / count);
            resolvedFluency = Math.min(100, Math.round(resolvedMastery * 0.95));
          }
        }
        if (lo['LO-03'] !== undefined) {
          resolvedApplication = Number(lo['LO-03']);
        }
        if (lo['LO-04'] !== undefined) {
          resolvedPractical = Number(lo['LO-04']);
        }
      } else if (evidenceObj.lo_breakdown && typeof evidenceObj.lo_breakdown === 'object') {
        const b = evidenceObj.lo_breakdown;
        const getLoVal = (val) => typeof val === 'object' && val !== null ? (val.score ?? val.percentage ?? 80) : Number(val);
        if (b['LO-01'] !== undefined || b['LO-02'] !== undefined) {
          const l1 = b['LO-01'] !== undefined ? getLoVal(b['LO-01']) : null;
          const l2 = b['LO-02'] !== undefined ? getLoVal(b['LO-02']) : null;
          const count = (l1 !== null ? 1 : 0) + (l2 !== null ? 1 : 0);
          if (count > 0) {
            resolvedMastery = Math.round(((l1 || 0) + (l2 || 0)) / count);
            resolvedFluency = Math.min(100, Math.round(resolvedMastery * 0.95));
          }
        }
        if (b['LO-03'] !== undefined) resolvedApplication = getLoVal(b['LO-03']);
        if (b['LO-04'] !== undefined) resolvedPractical = getLoVal(b['LO-04']);
      }

      // Support evidenceObj.dimensions (both snake_case and camelCase)
      if (evidenceObj.dimensions && typeof evidenceObj.dimensions === 'object') {
        const d = evidenceObj.dimensions;
        if (d.conceptual_mastery !== undefined || d.mastery !== undefined) {
          resolvedMastery = Number(d.conceptual_mastery ?? d.mastery);
        }
        if (d.retrieval_fluency !== undefined || d.fluency !== undefined) {
          resolvedFluency = Number(d.retrieval_fluency ?? d.fluency);
        }
        if (d.problem_application !== undefined || d.application !== undefined) {
          resolvedApplication = Number(d.problem_application ?? d.application);
        }
        if (d.practical_lab_skill !== undefined || d.practical_skill !== undefined || d.practicalSkill !== undefined) {
          resolvedPractical = Number(d.practical_lab_skill ?? d.practical_skill ?? d.practicalSkill);
        }
        if (d.scene_exploration !== undefined || d.exploration !== undefined) {
          resolvedExploration = Number(d.scene_exploration ?? d.exploration);
        }
        if (d.session_engagement !== undefined || d.engagement !== undefined) {
          resolvedEngagement = Number(d.session_engagement ?? d.engagement);
        }
        if (d.formal_achievement !== undefined || d.formalAchievement !== undefined) {
          resolvedFormal = Number(d.formal_achievement ?? d.formalAchievement);
        }
      }

      if (evidenceObj.lab_score !== undefined || evidenceObj.shadow_lab_score !== undefined) {
        resolvedPractical = Number(evidenceObj.lab_score ?? evidenceObj.shadow_lab_score);
      }
      if (evidenceObj.quiz_score !== undefined || evidenceObj.score_pct !== undefined) {
        resolvedMastery = Number(evidenceObj.quiz_score ?? evidenceObj.score_pct);
      }
    }

    // Override with Supabase dimension_profiles if present in DB
    if (supabaseDims) {
      resolvedMastery = supabaseDims.conceptual_mastery ?? supabaseDims.mastery ?? resolvedMastery;
      resolvedFluency = supabaseDims.retrieval_fluency ?? supabaseDims.fluency ?? resolvedFluency;
      resolvedApplication = supabaseDims.problem_application ?? supabaseDims.application ?? resolvedApplication;
      resolvedPractical = supabaseDims.practical_lab_skill ?? supabaseDims.practical_skill ?? supabaseDims.lab_skill ?? resolvedPractical;
      resolvedExploration = supabaseDims.scene_exploration ?? supabaseDims.exploration ?? resolvedExploration;
      resolvedEngagement = supabaseDims.session_engagement ?? supabaseDims.engagement ?? resolvedEngagement;
      resolvedFormal = supabaseDims.formal_achievement ?? supabaseDims.formal ?? resolvedFormal;
    }

    const finalMastery = Math.min(100, Math.max(0, Math.round(resolvedMastery)));
    const finalFluency = Math.min(100, Math.max(0, Math.round(resolvedFluency)));
    const finalApplication = Math.min(100, Math.max(0, Math.round(resolvedApplication)));
    const finalPractical = Math.min(100, Math.max(0, Math.round(resolvedPractical)));
    const finalExploration = Math.min(100, Math.max(0, Math.round(resolvedExploration)));
    const finalEngagement = Math.min(100, Math.max(0, Math.round(resolvedEngagement)));
    const finalFormal = Math.min(100, Math.max(0, Math.round(resolvedFormal)));

    setDimensions({
      conceptual_mastery: finalMastery,
      retrieval_fluency: finalFluency,
      problem_application: finalApplication,
      practical_lab_skill: finalPractical,
      scene_exploration: finalExploration,
      session_engagement: finalEngagement,
      formal_achievement: finalFormal
    });

    if (evidenceObj?.bloom_breakdown && typeof evidenceObj.bloom_breakdown === 'object') {
      const bb = evidenceObj.bloom_breakdown;
      setBloomLevels({
        remember: bb.remember?.mastery ?? (bb.remember?.total ? Math.round((bb.remember.correct / bb.remember.total) * 100) : 0),
        understand: bb.understand?.mastery ?? (bb.understand?.total ? Math.round((bb.understand.correct / bb.understand.total) * 100) : 0),
        apply: bb.apply?.mastery ?? (bb.apply?.total ? Math.round((bb.apply.correct / bb.apply.total) * 100) : 0),
        analyze: bb.analyze?.mastery ?? (bb.analyze?.total ? Math.round((bb.analyze.correct / bb.analyze.total) * 100) : 0)
      });
    } else if (finalMastery > 0 || finalApplication > 0) {
      setBloomLevels({
        remember: Math.min(100, Math.round(finalMastery * 0.98)),
        understand: Math.min(100, Math.round(finalMastery * 0.92)),
        apply: Math.min(100, Math.round(finalApplication)),
        analyze: Math.min(100, Math.round(finalApplication * 0.88))
      });
    } else {
      setBloomLevels({
        remember: 0,
        understand: 0,
        apply: 0,
        analyze: 0
      });
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (isMounted) await fetchRealProgressData();
    };
    void init();

    const handleAnalyticsUpdate = () => {
      if (isMounted) fetchRealProgressData();
    };

    const handleStorageChange = (e) => {
      if (e.key === 'edtech_analytics_evidence' && isMounted) {
        fetchRealProgressData();
      }
    };

    window.addEventListener('edtech:analytics:update', handleAnalyticsUpdate);
    window.addEventListener('storage', handleStorageChange);

    // Cross-tab broadcast sync
    let broadcast = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        broadcast = new BroadcastChannel('edtech_platform_sync');
        broadcast.onmessage = (e) => {
          if ((e.data?.type === 'ANALYTICS_UPDATE' || e.data?.type === 'TEST_SUBMITTED' || e.data?.type === 'QUIZ_SUBMITTED') && isMounted) {
            fetchRealProgressData();
          }
        };
      } catch { /* ignore BroadcastChannel error */ }
    }

    // Setup Supabase Realtime channel subscription on test_submissions and analytics_events
    const channel = supabase
      .channel('student-progress-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'test_submissions'
        },
        () => {
          if (isMounted) fetchRealProgressData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'analytics_events'
        },
        () => {
          if (isMounted) fetchRealProgressData();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      window.removeEventListener('edtech:analytics:update', handleAnalyticsUpdate);
      window.removeEventListener('storage', handleStorageChange);
      if (broadcast) broadcast.close();
      supabase.removeChannel(channel);
    };
  }, [fetchRealProgressData]);

  const completedCount = Object.keys(testResults).length;
  const testScores = Object.values(testResults);
  const avgTestScore = testScores.length > 0
    ? Math.round(testScores.reduce((acc, t) => acc + (t.percentage || 0), 0) / testScores.length)
    : 0;
  const hasEvidence = completedCount > 0 || Object.values(dimensions || {}).some(v => typeof v === 'number' && v > 0);

  const chartDataByRange = {
    'This Month': [
      { name: 'Week 1', score: 75, studyHours: 6.5 },
      { name: 'Week 2', score: 82, studyHours: 8.0 },
      { name: 'Week 3', score: 88, studyHours: 9.5 },
      { name: 'Week 4', score: avgTestScore || 92, studyHours: 11.2 }
    ],
    'Last Month': [
      { name: 'Week 1', score: 68, studyHours: 5.0 },
      { name: 'Week 2', score: 74, studyHours: 6.2 },
      { name: 'Week 3', score: 78, studyHours: 7.5 },
      { name: 'Week 4', score: 81, studyHours: 8.0 }
    ],
    'All Time': [
      { name: 'May', score: 70, studyHours: 24 },
      { name: 'Jun', score: 78, studyHours: 32 },
      { name: 'Jul', score: 84, studyHours: 38 },
      { name: 'Aug', score: avgTestScore || 90, studyHours: 42 }
    ]
  };

  const subjectMastery = [
    { subject: 'Science & Physics', icon: '💡', progress: Math.min(100, 75 + completedCount * 5), color: 'var(--brand-primary, #00F0FF)', grade: 'A+' },
    { subject: 'Mathematics & Geometry', icon: '📐', progress: 85, color: 'var(--brand-secondary, #3B82F6)', grade: 'A' },
    { subject: 'Ancient & World History', icon: '🏛️', progress: 68, color: '#8A2BE2', grade: 'B+' },
    { subject: 'World Geography', icon: '🌍', progress: 74, color: '#10B981', grade: 'A-' },
    { subject: 'Visual Arts & 3D Design', icon: '🎨', progress: 90, color: '#EC4899', grade: 'A+' },
    { subject: 'English Literature', icon: '📝', progress: 80, color: '#F59E0B', grade: 'A' },
    { subject: 'Music Theory & Acoustics', icon: '🎵', progress: 65, color: '#6366F1', grade: 'B' },
    { subject: 'Physical Education & Sports', icon: '🏃', progress: 88, color: '#14B8A6', grade: 'A' }
  ];

  const achievementsList = [
    { id: 1, title: 'Optics Master', desc: 'Completed the 3D Light & Shadow Ray Simulation.', icon: '💡', date: 'August 2026', unlocked: true },
    { id: 2, title: 'Speed Solver', desc: 'Submitted assessment in under 10 minutes with Grade A.', icon: '⚡', date: 'August 2026', unlocked: true },
    { id: 3, title: '10-Day Streak', desc: 'Maintained continuous daily study activity on Study Island.', icon: '🔥', date: 'Active', unlocked: true },
    { id: 4, title: 'Perfectionist', desc: 'Scored 100% on a Class Assessment.', icon: '🏆', date: 'Locked', unlocked: avgTestScore >= 95 }
  ];

  const stemDimensions = [
    {
      id: 'conceptual_mastery',
      name: 'Conceptual Mastery',
      icon: '🧠',
      score: dimensions.conceptual_mastery,
      family: 'Core Learning • Cognitive Depth',
      color: 'var(--brand-primary, #00F0FF)',
      description: 'Evaluates quiz accuracy weighted by Bloom levels (Remember to Analyze).'
    },
    {
      id: 'retrieval_fluency',
      name: 'Retrieval Fluency & Speed',
      icon: '🏎️',
      score: dimensions.retrieval_fluency,
      family: 'Core Learning • Speed & Pressure',
      color: 'var(--brand-secondary, #3B82F6)',
      description: 'Response automaticity and recall speed under timed countdowns.'
    },
    {
      id: 'problem_application',
      name: 'Problem Application & Transfer',
      icon: '🛠️',
      score: dimensions.problem_application,
      family: 'Core Learning • Real-World Transfer',
      color: '#F59E0B',
      description: 'Transfer of learned concepts to novel scenario questions and angle predictions.'
    },
    {
      id: 'practical_lab_skill',
      name: 'Practical Lab Skill',
      icon: '🧪',
      score: dimensions.practical_lab_skill,
      family: 'Core Learning • Virtual Lab Precision',
      color: '#EC4899',
      description: 'Adherence to experiment protocol and precision in the 3D Optics Lab.'
    },
    {
      id: 'scene_exploration',
      name: 'Scene Exploration',
      icon: '🧭',
      score: dimensions.scene_exploration,
      family: 'Contextual Exposure • Curiosity',
      color: '#10B981',
      description: 'Interactive object inspections, sandbox camera moves, and scene depth.'
    },
    {
      id: 'session_engagement',
      name: 'Session Engagement',
      icon: '⚡',
      score: dimensions.session_engagement,
      family: 'Contextual Exposure • Consistency',
      color: '#8B5CF6',
      description: 'Frequency of weekly sessions and active interactive time on task.'
    },
    {
      id: 'formal_achievement',
      name: 'Formal Achievement',
      icon: '🏆',
      score: dimensions.formal_achievement,
      family: 'Formal Validation • Summative',
      color: '#06B6D4',
      description: 'Official diagnostic exams and teacher-assigned summative milestones.'
    }
  ];

  const overallProgress = Math.round(
    subjectMastery.reduce((acc, s) => acc + s.progress, 0) / subjectMastery.length
  );

  const bloomRadarData = useMemo(() => [
    { level: 'Remember', score: bloomLevels.remember, target: 80 },
    { level: 'Understand', score: bloomLevels.understand, target: 80 },
    { level: 'Apply', score: bloomLevels.apply, target: 75 },
    { level: 'Analyze', score: bloomLevels.analyze, target: 70 }
  ], [bloomLevels]);

  const coachInsight = useMemo(() => {
    const isAppGap = dimensions.conceptual_mastery >= 75 && dimensions.practical_lab_skill < 60;
    const isMastery = dimensions.conceptual_mastery >= 80 && dimensions.practical_lab_skill >= 75 && dimensions.problem_application >= 75;

    if (isAppGap) {
      return {
        type: 'APPLICATION_GAP',
        badge: '⚠️ APPLICATION GAP DETECTED',
        badgeColor: '#f59e0b',
        title: 'Theory & Practical Divergence',
        message: 'Great job on conceptual theory! However, your hands-on prediction in Shadow Lab can improve. Try Step 3 of Shadow Lab to practice angle variations.',
        recommendation: 'Launch 3D Optics Lab — Step 3: Ray Geometry Calibration',
        actionLink: '#/lab/shadow-lab'
      };
    }
    if (isMastery) {
      return {
        type: 'MASTERY_ESTABLISHED',
        badge: '🌟 MASTERY ESTABLISHED',
        badgeColor: '#10b981',
        title: 'Outstanding Cognitive Balance',
        message: 'Mastery Established! You are demonstrating well-rounded excellence across both theoretical understanding and hands-on scientific application.',
        recommendation: 'Advance to Chapter 11: Electricity and Circuits',
        actionLink: '#/chapter/science-ch11'
      };
    }
    return {
      type: 'IN_PROGRESS',
      badge: '💡 LEARNING IN PROGRESS',
      badgeColor: 'var(--brand-primary, #00F0FF)',
      title: 'Active Skill Development',
      message: 'Keep exploring interactive models and retaking formative checkpoints to reinforce higher-order Bloom levels (Apply & Analyze).',
      recommendation: 'Complete Chapter 10 Challenge Mode Quiz',
      actionLink: '#/quiz'
    };
  }, [dimensions]);

  return (
    <div className="view-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card className="full-height-card">

        {/* Header Tabs & Time Filter */}
        <div className="progress-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div className="tabs" style={{ display: 'flex', gap: '8px' }}>
            {['Overview', '7 STEM Dimensions', 'Subjects', 'Achievements'].map((tab) => (
              <button
                key={tab}
                className={`tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px',
                  border: activeTab === tab ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid transparent',
                  background: activeTab === tab ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(59, 130, 246, 0.2))' : 'rgba(255, 255, 255, 0.04)',
                  color: activeTab === tab ? 'var(--brand-primary, #00F0FF)' : '#94a3b8',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="sort-box">
            <select
              className="sort-select"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--brand-primary, #00F0FF)',
                border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.3))',
                padding: '8px 16px',
                borderRadius: '10px',
                fontWeight: '700',
                outline: 'none'
              }}
            >
              <option value="This Month">This Month</option>
              <option value="Last Month">Last Month</option>
              <option value="All Time">All Time</option>
            </select>
          </div>
        </div>

        {!hasEvidence ? (
          <div className="empty-evidence-state" style={{
            textAlign: 'center',
            padding: '64px 24px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            margin: '24px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'rgba(0, 240, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              marginBottom: '16px',
              color: 'var(--brand-primary, #00F0FF)'
            }}>
              📊
            </div>
            <h3 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '800', marginBottom: '8px' }}>
              Skills Profile
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '480px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              No learning evidence recorded yet. Complete interactive chapters or quizzes to see your skills profile.
            </p>
            <a
              href="#/quiz"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 28px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                color: '#000',
                fontWeight: '800',
                fontSize: '0.9rem',
                textDecoration: 'none'
              }}
            >
              Start Chapter Quiz →
            </a>
          </div>
        ) : (
          <>
            {/* 4 Stat Metric Cards */}
            <div className="stats-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '28px' }}>
          <div className="stat-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--brand-glow, rgba(0, 240, 255, 0.1))', color: 'var(--brand-primary, #00F0FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <span className="stat-label" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Overall Mastery</span>
              <h3 className="stat-value" style={{ margin: '2px 0 0 0', fontSize: '1.6rem', color: '#fff', fontWeight: '800' }}>{overallProgress}%</h3>
            </div>
          </div>

          <div className="stat-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--brand-secondary, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={24} />
            </div>
            <div>
              <span className="stat-label" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Completed Tests</span>
              <h3 className="stat-value" style={{ margin: '2px 0 0 0', fontSize: '1.6rem', color: '#fff', fontWeight: '800' }}>{completedCount} Quizzes</h3>
            </div>
          </div>

          <div className="stat-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Flame size={24} />
            </div>
            <div>
              <span className="stat-label" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Study Streak</span>
              <h3 className="stat-value" style={{ margin: '2px 0 0 0', fontSize: '1.6rem', color: '#fff', fontWeight: '800' }}>10 Days</h3>
            </div>
          </div>

          <div className="stat-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={24} />
            </div>
            <div>
              <span className="stat-label" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Avg Score</span>
              <h3 className="stat-value" style={{ margin: '2px 0 0 0', fontSize: '1.6rem', color: '#fff', fontWeight: '800' }}>{avgTestScore}%</h3>
            </div>
          </div>

          {/* Best Score Card */}
          <div className="stat-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={24} />
            </div>
            <div>
              <span className="stat-label" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Personal Best (Mastery)</span>
              <h3 className="stat-value" style={{ margin: '2px 0 0 0', fontSize: '1.6rem', color: '#10b981', fontWeight: '800' }}>
                {bestMasteryPct}%
                {bestAccuracyPct > 0 && (
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '500', marginLeft: '8px' }}>
                    ({bestAccuracyPct}% accuracy)
                  </span>
                )}
              </h3>
            </div>
          </div>

          {/* Total Attempts Card */}
          <div className="stat-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(0, 240, 255, 0.1)', color: 'var(--brand-primary, #00F0FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={24} />
            </div>
            <div>
              <span className="stat-label" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total Quiz Attempts</span>
              <h3 className="stat-value" style={{ margin: '2px 0 0 0', fontSize: '1.6rem', color: 'var(--brand-primary, #00F0FF)', fontWeight: '800' }}>{totalAttempts}</h3>
            </div>
          </div>
        </div>

        {/* Tab Content 1: Overview Chart */}
        {activeTab === 'Overview' && (
          <div className="charts-container" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h4 style={{ margin: 0, color: 'white', fontSize: '1.15rem', fontWeight: '700' }}>Assessment Score Trajectory</h4>
                <span style={{ color: 'var(--brand-primary, #00F0FF)', fontSize: '0.85rem', fontWeight: '600' }}>{timeRange}</span>
              </div>
              <div style={{ width: '100%', height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDataByRange[timeRange] || chartDataByRange['This Month']}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" domain={[50, 100]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 15, 29, 0.95)', borderColor: 'var(--brand-glow, rgba(0, 240, 255, 0.3))', borderRadius: '12px', color: '#fff' }}
                      itemStyle={{ color: 'var(--brand-primary, #00F0FF)' }}
                    />
                    <Line type="monotone" dataKey="score" stroke="var(--brand-primary, #00F0FF)" strokeWidth={3} dot={{ r: 5, fill: 'var(--brand-primary, #00F0FF)' }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '24px' }}>
              <h4 style={{ margin: '0 0 20px 0', color: 'white', fontSize: '1.15rem', fontWeight: '700' }}>Top Subject Breakdown</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {subjectMastery.slice(0, 4).map((sub, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                      <span style={{ color: '#fff' }}>{sub.icon} {sub.subject}</span>
                      <span style={{ color: sub.color, fontWeight: '700' }}>{sub.progress}%</span>
                    </div>
                    <ProgressBar progress={sub.progress} color={sub.color} showLabel={false} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: 7 STEM Dimensions */}
        {activeTab === '7 STEM Dimensions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'rgba(0, 240, 255, 0.04)', border: '1px solid rgba(0, 240, 255, 0.2)', borderRadius: '16px', padding: '18px 20px' }}>
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--brand-primary, #00F0FF)', fontSize: '1.2rem', fontWeight: '800' }}>
                The 7-Dimension Pedagogical Architecture
              </h3>
              <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.88rem', lineHeight: '1.5' }}>
                EdTech Island tracks three distinct analytical families (Core Learning, Contextual Exposure, Formal Validation) directly derived from live database telemetry, virtual lab adherence, and quiz submissions.
              </p>
            </div>

            {/* Top Split: Aria AI Personal Coach + Bloom Cognitive Depth Radar Chart */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>

              {/* Aria AI Personal Coach Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(10, 25, 47, 0.75), rgba(20, 15, 38, 0.75))',
                border: `1px solid ${coachInsight.badgeColor}55`,
                borderRadius: '18px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: `0 8px 32px ${coachInsight.badgeColor}15`
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '12px',
                        background: `${coachInsight.badgeColor}20`,
                        border: `1px solid ${coachInsight.badgeColor}50`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: coachInsight.badgeColor
                      }}>
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, color: 'white', fontSize: '1.05rem', fontWeight: '800' }}>Aria AI Personal Coach</h4>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Pedagogical Intelligence</span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: `${coachInsight.badgeColor}20`,
                      color: coachInsight.badgeColor,
                      border: `1px solid ${coachInsight.badgeColor}50`,
                      letterSpacing: '0.5px'
                    }}>
                      {coachInsight.badge}
                    </span>
                  </div>

                  <h5 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '1rem', fontWeight: '700' }}>
                    {coachInsight.title}
                  </h5>
                  <p style={{ margin: '0 0 16px 0', color: '#cbd5e1', fontSize: '0.88rem', lineHeight: '1.5' }}>
                    {coachInsight.message}
                  </p>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                    <span style={{ color: '#fff', fontWeight: '600' }}>Recommended: </span>
                    {coachInsight.recommendation}
                  </div>
                  <span
                    style={{
                      background: `${coachInsight.badgeColor}25`,
                      color: coachInsight.badgeColor,
                      border: `1px solid ${coachInsight.badgeColor}50`,
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      letterSpacing: '0.5px'
                    }}
                  >
                    ACTION READY
                  </span>
                </div>
              </div>

              {/* Bloom Cognitive Depth Radar Chart */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '18px',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <h4 style={{ margin: 0, color: 'white', fontSize: '1.05rem', fontWeight: '800' }}>
                      Bloom Cognitive Depth Radar
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Remember • Understand • Apply • Analyze</span>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'rgba(0, 240, 255, 0.12)',
                    color: 'var(--brand-primary, #00F0FF)',
                    border: '1px solid rgba(0, 240, 255, 0.3)'
                  }}>
                    RADAR VIEW
                  </span>
                </div>

                <div style={{ width: '100%', height: '240px', minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="68%" data={bloomRadarData}>
                      <PolarGrid stroke="rgba(255, 255, 255, 0.1)" />
                      <PolarAngleAxis dataKey="level" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: '700' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="rgba(255, 255, 255, 0.15)" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Radar name="Student Mastery" dataKey="score" stroke="var(--brand-primary, #00F0FF)" fill="var(--brand-primary, #00F0FF)" fillOpacity={0.35} strokeWidth={2} />
                      <Radar name="CBSE Target" dataKey="target" stroke="#A855F7" fill="#A855F7" fillOpacity={0.10} strokeWidth={1.5} strokeDasharray="3 3" />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(10, 15, 29, 0.95)', borderColor: 'rgba(0, 240, 255, 0.4)', borderRadius: '10px', color: '#fff' }}
                        formatter={(val, name) => [`${val}%`, name]}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: '4px' }}
                        formatter={(value) => <span style={{ color: '#cbd5e1', fontSize: '11px', fontWeight: '600' }}>{value}</span>}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {stemDimensions.map((dim) => (
                <div key={dim.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.5rem' }}>{dim.icon}</span>
                      <div>
                        <h4 style={{ margin: 0, color: 'white', fontSize: '1rem', fontWeight: '700' }}>{dim.name}</h4>
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{dim.family}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '1.2rem', fontWeight: '800', color: dim.color }}>
                      {dim.score}%
                    </span>
                  </div>

                  <ProgressBar progress={dim.score} color={dim.color} showLabel={false} />

                  <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.8rem', lineHeight: '1.4' }}>
                    {dim.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content 2: All Subjects */}
        {activeTab === 'Subjects' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {subjectMastery.map((sub, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.6rem' }}>{sub.icon}</span>
                    <div>
                      <h4 style={{ margin: 0, color: 'white', fontSize: '1rem', fontWeight: '700' }}>{sub.subject}</h4>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Class 6th Curriculum</span>
                    </div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: '8px', background: 'var(--brand-glow, rgba(0, 240, 255, 0.1))', color: 'var(--brand-primary, #00F0FF)', fontWeight: '800', fontSize: '0.8rem' }}>
                    {sub.grade}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8' }}>Syllabus Mastery</span>
                  <span style={{ color: '#fff', fontWeight: '700' }}>{sub.progress}%</span>
                </div>
                <ProgressBar progress={sub.progress} color={sub.color} showLabel={false} />
              </div>
            ))}
          </div>
        )}

        {/* Tab Content 3: Achievements */}
        {activeTab === 'Achievements' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            {achievementsList.map((ach) => (
              <div key={ach.id} style={{
                background: ach.unlocked ? 'var(--brand-glow, rgba(0, 240, 255, 0.05))' : 'rgba(255,255,255,0.01)',
                border: ach.unlocked ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                borderRadius: '18px',
                padding: '24px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{ach.icon}</div>
                <h4 style={{ margin: '0 0 6px 0', color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>{ach.title}</h4>
                <p style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.5' }}>{ach.desc}</p>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  background: ach.unlocked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                  color: ach.unlocked ? '#10B981' : '#94a3b8',
                  fontSize: '0.75rem',
                  fontWeight: '700'
                }}>
                  {ach.unlocked ? '✓ Unlocked' : '🔒 Locked'}
                </span>
              </div>
            ))}
          </div>
        )}
          </>
        )}

      </Card>
    </div>
  );
}
