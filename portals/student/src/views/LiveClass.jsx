import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import { Video, Calendar as CalendarIcon, Clock, Play, FileText, CheckCircle, ExternalLink, Loader2, Award } from 'lucide-react';
import { supabase } from '../supabase';
import TestRunnerModal from '../components/TestRunnerModal';
import './LiveClass.css';

export default function LiveClass() {
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'tests'
  const [activeLiveClass, setActiveLiveClass] = useState(null);
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [testsList, setTestsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningTest, setRunningTest] = useState(null);
  const [completedResults, setCompletedResults] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('student_test_results') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    fetchLiveData();
    
    // Subscribe to real-time changes in live_classes and tests tables
    const channel = supabase
      .channel('public:live_classes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_classes' }, () => {
        fetchLiveData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tests' }, () => {
        fetchLiveData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLiveData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch currently active live class
      const { data: activeData } = await supabase
        .from('live_classes')
        .select('*')
        .eq('status', 'active')
        .limit(1);

      if (activeData && activeData.length > 0) {
        setActiveLiveClass(activeData[0]);
      } else {
        setActiveLiveClass(null);
      }

      // 2. Fetch scheduled upcoming classes
      const { data: upcomingData } = await supabase
        .from('live_classes')
        .select('*')
        .eq('status', 'scheduled')
        .order('start_time', { ascending: true });

      if (upcomingData) {
        setUpcomingClasses(upcomingData);
      }

      // 3. Fetch assigned tests
      const { data: testsData } = await supabase
        .from('tests')
        .select('*')
        .order('created_at', { ascending: false });

      if (testsData) {
        setTestsList(testsData);
      }
    } catch (err) {
      console.error('Error fetching live data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="view-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 6px 0', color: 'white' }}>Online Classes & Tests</h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '1rem' }}>Join live Google Meet sessions and take assigned tests from your teachers.</p>
      </div>

      {/* Header Tabs */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => setActiveTab('active')}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            border: activeTab === 'active' ? '1px solid rgba(0,240,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
            background: activeTab === 'active' ? 'linear-gradient(135deg, var(--brand-glow, rgba(0, 240, 255, 0.15)), var(--brand-secondary, rgba(59, 130, 246, 0.15)))' : 'rgba(255,255,255,0.03)',
            color: activeTab === 'active' ? 'var(--brand-primary, #00F0FF)' : '#94a3b8',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Video size={18} /> Live Classes ({upcomingClasses.length + (activeLiveClass ? 1 : 0)})
        </button>

        <button
          onClick={() => setActiveTab('tests')}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            border: activeTab === 'tests' ? '1px solid rgba(0,240,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
            background: activeTab === 'tests' ? 'linear-gradient(135deg, var(--brand-glow, rgba(0, 240, 255, 0.15)), var(--brand-secondary, rgba(59, 130, 246, 0.15)))' : 'rgba(255,255,255,0.03)',
            color: activeTab === 'tests' ? 'var(--brand-primary, #00F0FF)' : '#94a3b8',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileText size={18} /> Tests & Quizzes ({testsList.length})
        </button>
      </div>

      {activeTab === 'active' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Live Session Banner */}
          <Card style={{ border: activeLiveClass ? '1px solid rgba(0,240,255,0.4)' : '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: activeLiveClass ? '#EF4444' : '#94a3b8', display: 'inline-block', boxShadow: activeLiveClass ? '0 0 10px #EF4444' : 'none' }}></span>
                <span style={{ color: activeLiveClass ? '#EF4444' : '#94a3b8', fontWeight: '800', fontSize: '0.85rem', letterSpacing: '1px' }}>
                  {activeLiveClass ? 'LIVE NOW' : 'NO CLASS IN SESSION'}
                </span>
              </div>
              {activeLiveClass && (
                <span style={{ color: 'var(--brand-primary, #00F0FF)', fontWeight: '600', fontSize: '0.85rem' }}>{activeLiveClass.class_name}</span>
              )}
            </div>

            {activeLiveClass ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.4rem', fontWeight: '800' }}>{activeLiveClass.title}</h3>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>
                    Target: {activeLiveClass.class_name} • Started: {new Date(activeLiveClass.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <a
                  href={activeLiveClass.meet_link}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                    color: '#000',
                    fontWeight: '700',
                    padding: '14px 28px',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 0 25px var(--brand-glow, rgba(0, 240, 255, 0.4))'
                  }}
                >
                  <Video size={20} /> Join Live Class
                </a>
              </div>
            ) : (
              <p style={{ color: '#94a3b8', margin: 0 }}>There is no active live session hosted by your teachers right now.</p>
            )}
          </Card>

          {/* Upcoming Live Classes */}
          <Card>
            <h3 style={{ margin: '0 0 16px 0', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Upcoming Scheduled Classes</h3>
            {upcomingClasses.length === 0 ? (
              <p style={{ color: '#94a3b8', margin: 0 }}>No upcoming classes scheduled yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {upcomingClasses.map((c) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', color: 'white' }}>{c.title}</h4>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
                        {c.class_name} • {new Date(c.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    <span style={{ color: 'var(--brand-primary, #00F0FF)', fontSize: '0.85rem', fontWeight: '600' }}>Scheduled</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'tests' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', color: 'white', fontSize: '1.3rem', fontWeight: '800' }}>Assigned Tests & Assessments</h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>Complete quizzes and exams to earn XP and build subject mastery.</p>
            </div>
            <span style={{ padding: '6px 16px', borderRadius: '12px', background: 'var(--brand-glow, rgba(0, 240, 255, 0.1))', color: 'var(--brand-primary, #00F0FF)', fontWeight: '700', fontSize: '0.85rem' }}>
              {testsList.length} Active Tests
            </span>
          </div>

          {testsList.length === 0 ? (
            <p style={{ color: '#94a3b8', margin: 0 }}>No tests or quizzes have been assigned by teachers yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {testsList.map((test) => {
                const isCompleted = completedResults && completedResults[test.id];
                const scoreInfo = isCompleted ? completedResults[test.id] : null;

                return (
                  <div key={test.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 24px',
                    borderRadius: '16px',
                    background: 'rgba(255,255,255,0.03)',
                    border: isCompleted ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'var(--brand-glow, rgba(0, 240, 255, 0.15))', color: 'var(--brand-primary, #00F0FF)', fontSize: '0.75rem', fontWeight: '700' }}>
                          {test.type ? test.type.toUpperCase() : 'QUIZ'}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                          {test.duration ? `${test.duration} mins` : '15 mins'} • {test.questions ? test.questions.length : 3} Questions
                        </span>
                        {isCompleted && (
                          <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontSize: '0.75rem', fontWeight: '700' }}>
                            ✓ Scored {scoreInfo.percentage}% ({scoreInfo.grade})
                          </span>
                        )}
                      </div>
                      <h4 style={{ margin: 0, color: 'white', fontSize: '1.15rem', fontWeight: '700' }}>{test.title}</h4>
                    </div>

                    <div>
                      {isCompleted ? (
                        <button
                          onClick={() => setRunningTest(test)}
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10B981',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            fontWeight: '700',
                            padding: '10px 20px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Award size={16} /> Retake / Review
                        </button>
                      ) : (
                        <button
                          onClick={() => setRunningTest(test)}
                          style={{
                            background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                            color: '#000',
                            fontWeight: '700',
                            border: 'none',
                            padding: '10px 22px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 0 15px var(--brand-glow, rgba(0, 240, 255, 0.3))'
                          }}
                        >
                          <Play size={16} /> Start Test
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Interactive Test Runner Modal */}
      {runningTest && (
        <TestRunnerModal
          test={runningTest}
          onClose={() => setRunningTest(null)}
          onComplete={(res) => {
            setCompletedResults(prev => ({ ...prev, [runningTest.id]: res }));
          }}
        />
      )}
    </div>
  );
}
