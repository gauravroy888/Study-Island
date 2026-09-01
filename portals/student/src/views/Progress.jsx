import { supabase } from '../supabase';
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../components/Card';
import ProgressBar from '../components/ProgressBar';
import { Calendar, Flame, Clock, Award, BookOpen, CheckCircle, TrendingUp, Sparkles } from 'lucide-react';
import './Progress.css';

export default function Progress() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [timeRange, setTimeRange] = useState('This Month');
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    fetchRealProgressData();
  }, []);

  const fetchRealProgressData = async () => {
    let localData = {};
    try {
      localData = JSON.parse(localStorage.getItem('student_test_results') || '{}');
    } catch (e) {}

    try {
      const studentUser = JSON.parse(localStorage.getItem('edtech_student_user') || '{}');
      if (studentUser.id) {
        const { data, error } = await supabase
          .from('test_submissions')
          .select('*')
          .eq('student_id', studentUser.id);
        if (!error && data && data.length > 0) {
          data.forEach(sub => {
            localData[sub.test_id] = {
              percentage: sub.score,
              grade: sub.grade,
              submittedAt: sub.submitted_at
            };
          });
        }
      }
    } catch (e) {}

    setTestResults(localData);
  };

  const completedCount = Object.keys(testResults).length;
  const testScores = Object.values(testResults);
  const avgTestScore = testScores.length > 0
    ? Math.round(testScores.reduce((acc, t) => acc + (t.percentage || 80), 0) / testScores.length)
    : 84;

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

  const overallProgress = Math.round(
    subjectMastery.reduce((acc, s) => acc + s.progress, 0) / subjectMastery.length
  );

  return (
    <div className="view-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card className="full-height-card">
        
        {/* Header Tabs & Time Filter */}
        <div className="progress-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div className="tabs" style={{ display: 'flex', gap: '8px' }}>
            {['Overview', 'Subjects', 'Achievements'].map((tab) => (
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

      </Card>
    </div>
  );
}
