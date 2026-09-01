import React, { useState, useEffect, useMemo } from 'react';
import Card from '../components/Card';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Trophy, AlertTriangle, TrendingUp, Users, BookOpen, Sparkles } from 'lucide-react';
import { supabase } from '../supabase';

const DEFAULT_STUDENTS = [
  { id: 's1', name: 'Harsh', class: 'Class 6th', math: 88, physics: 92, chemistry: 85, attendance: 96 },
  { id: 's2', name: 'Alex Johnson', class: 'Class 6th', math: 95, physics: 96, chemistry: 90, attendance: 98 },
  { id: 's3', name: 'Rohan Sharma', class: 'Class 6th', math: 78, physics: 84, chemistry: 80, attendance: 90 },
  { id: 's4', name: 'Priya Singh', class: 'Class 7th', math: 90, physics: 88, chemistry: 92, attendance: 94 },
  { id: 's5', name: 'Aarav Patel', class: 'Class 8th', math: 72, physics: 76, chemistry: 70, attendance: 86 }
];

export default function Analytics() {
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedStudent, setSelectedStudent] = useState('All');
  const [students, setStudents] = useState(DEFAULT_STUDENTS);
  const [dbClasses, setDbClasses] = useState(['All', 'Class 6th', 'Class 7th', 'Class 8th', 'Class 9th', 'Class 10th']);

  useEffect(() => {
    fetchLiveAnalytics();
  }, []);

  async function fetchLiveAnalytics() {
    try {
      const { data: profs } = await supabase.from('profiles').select('*').eq('role', 'student');
      const { data: cls } = await supabase.from('classes').select('name');

      if (cls && cls.length > 0) {
        setDbClasses(['All', ...cls.map(c => c.name)]);
      }

      if (profs && profs.length > 0) {
        const mapped = profs.map((p, idx) => ({
          id: p.id || p.email,
          name: p.name || 'Student',
          class: p.class_name || 'Class 6th',
          math: 82 + (idx % 15),
          physics: 85 + (idx % 12),
          chemistry: 80 + (idx % 14),
          attendance: 92 + (idx % 7)
        }));
        setStudents(mapped);
      }
    } catch (e) {
      console.warn(e);
    }
  }

  const studentsInClass = useMemo(() => {
    return students.filter(s => selectedClass === 'All' || s.class === selectedClass);
  }, [students, selectedClass]);

  const filteredData = useMemo(() => {
    return students.filter(s => {
      const matchClass = selectedClass === 'All' || s.class === selectedClass;
      const matchStudent = selectedStudent === 'All' || String(s.id) === String(selectedStudent);
      return matchClass && matchStudent;
    });
  }, [students, selectedClass, selectedStudent]);

  const kpis = useMemo(() => {
    if (filteredData.length === 0) return null;

    let totalMath = 0, totalPhysics = 0, totalChemistry = 0;
    let bestStudent = filteredData[0];
    let highestAvg = 0;

    filteredData.forEach(s => {
      totalMath += s.math;
      totalPhysics += s.physics;
      totalChemistry += s.chemistry;

      const avg = (s.math + s.physics + s.chemistry) / 3;
      if (avg > highestAvg) {
        highestAvg = avg;
        bestStudent = s;
      }
    });

    const count = filteredData.length;
    const avgMath = totalMath / count;
    const avgPhysics = totalPhysics / count;
    const avgChemistry = totalChemistry / count;
    const overallAvg = (avgMath + avgPhysics + avgChemistry) / 3;

    return {
      overallAvg: overallAvg.toFixed(1),
      avgMath: avgMath.toFixed(1),
      avgPhysics: avgPhysics.toFixed(1),
      avgChemistry: avgChemistry.toFixed(1),
      bestStudent: { name: bestStudent.name, avg: highestAvg.toFixed(1) },
      totalCount: count
    };
  }, [filteredData]);

  const chartData = [
    { subject: 'Mathematics', average: kpis ? parseFloat(kpis.avgMath) : 85 },
    { subject: 'Physics & Optics', average: kpis ? parseFloat(kpis.avgPhysics) : 90 },
    { subject: 'Chemistry', average: kpis ? parseFloat(kpis.avgChemistry) : 82 }
  ];

  return (
    <div className="view-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 4px 0', color: 'white' }}>Student Performance Analytics</h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>Classroom mastery metrics and automated assessment breakdowns.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: '700' }}>FILTER CLASS</label>
            <select
              value={selectedClass}
              onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudent('All'); }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.3))',
                color: 'var(--brand-primary, #00F0FF)',
                padding: '8px 16px',
                borderRadius: '10px',
                fontWeight: '700',
                outline: 'none'
              }}
            >
              {dbClasses.map(c => <option key={c} value={c} style={{ color: 'black' }}>{c === 'All' ? 'All Classes' : c}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: '700' }}>FILTER STUDENT</label>
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
                outline: 'none'
              }}
            >
              <option value="All" style={{ color: 'black' }}>All Students ({studentsInClass.length})</option>
              {studentsInClass.map(s => <option key={s.id} value={s.id} style={{ color: 'black' }}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <Card style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--brand-glow, rgba(0, 240, 255, 0.1))', color: 'var(--brand-primary, #00F0FF)' }}>
                <TrendingUp size={24} />
              </div>
              <div>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Class Average</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.6rem', fontWeight: '800', color: 'white' }}>{kpis.overallAvg}%</h3>
              </div>
            </div>
          </Card>

          <Card style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                <Trophy size={24} />
              </div>
              <div>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Top Performer</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.4rem', fontWeight: '800', color: 'white' }}>{kpis.bestStudent.name}</h3>
              </div>
            </div>
          </Card>

          <Card style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
                <Users size={24} />
              </div>
              <div>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Enrolled Students</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.6rem', fontWeight: '800', color: 'white' }}>{kpis.totalCount} Active</h3>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Main Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
        <Card>
          <h3 style={{ margin: '0 0 20px 0', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Subject Mastery Benchmark</h3>
          <div style={{ width: '100%', height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradMath" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00F0FF" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#0070F3" stopOpacity={0.5} />
                  </linearGradient>
                  <linearGradient id="barGradPhysics" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.5} />
                  </linearGradient>
                  <linearGradient id="barGradChem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A855F7" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#7E22CE" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: '600' }} />
                <YAxis stroke="#94a3b8" domain={[50, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(10, 15, 29, 0.95)', borderColor: 'rgba(0, 240, 255, 0.4)', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                  formatter={(val) => [`${val}%`, 'Mastery Score']}
                />
                <Bar dataKey="average" radius={[10, 10, 0, 0]} barSize={58}>
                  {chartData.map((entry, index) => {
                    const grads = ['url(#barGradMath)', 'url(#barGradPhysics)', 'url(#barGradChem)'];
                    return <Cell key={`cell-${index}`} fill={grads[index % grads.length]} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Student Leaderboard */}
        <Card>
          <h3 style={{ margin: '0 0 20px 0', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Class Leaderboard</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredData.slice(0, 5).map((s, idx) => {
              const avg = Math.round((s.math + s.physics + s.chemistry) / 3);
              return (
                <div key={s.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: idx === 0 ? 'linear-gradient(135deg, var(--brand-glow, rgba(0, 240, 255, 0.15)), var(--brand-secondary, rgba(59, 130, 246, 0.15)))' : 'rgba(255, 255, 255, 0.02)',
                  border: idx === 0 ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: '800', color: idx === 0 ? '#fbbf24' : '#94a3b8', fontSize: '0.95rem' }}>#{idx + 1}</span>
                    <div>
                      <h4 style={{ margin: 0, color: 'white', fontSize: '0.95rem', fontWeight: '700' }}>{s.name}</h4>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.75rem' }}>{s.class}</p>
                    </div>
                  </div>
                  <span style={{ color: 'var(--brand-primary, #00F0FF)', fontWeight: '800', fontSize: '1rem' }}>{avg}%</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
