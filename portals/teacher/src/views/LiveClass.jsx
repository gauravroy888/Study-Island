import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import { Video, Calendar as CalendarIcon, Clock, Link as LinkIcon, Edit2, Play, CheckCircle, ExternalLink, Trash2, X, Plus, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import { useGoogleLogin } from '@react-oauth/google';
import CreateMCQTest from '../components/CreateMCQTest';
import CreateQATest from '../components/CreateQATest';

export default function LiveClass() {
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'upcoming' | 'tests'
  
  // Auth state
  const [accessToken, setAccessToken] = useState(localStorage.getItem('calendar_token') || null);
  
  const [activeLiveClass, setActiveLiveClass] = useState(null);
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [testCreationMode, setTestCreationMode] = useState(null); // 'mcq' | 'qa' | null
  
  // Form State
  const [classTitle, setClassTitle] = useState('General Session');
  const [selectedClass, setSelectedClass] = useState('Class 1st');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [duration, setDuration] = useState('60'); // minutes

  const [classesList, setClassesList] = useState(['Class 1st', 'Class 2nd', 'Class 3rd', 'Class 4th', 'Class 5th', 'Class 6th']);

  useEffect(() => {
    supabase.from('classes').select('name').then(({ data, error }) => {
      if (!error && data && data.length > 0) {
        setClassesList(data.map(c => c.name));
      }
    }).catch(() => {});
  }, []);

  const [testsList, setTestsList] = useState([]);
  const [isLoadingTests, setIsLoadingTests] = useState(false);

  useEffect(() => {
    fetchActiveClasses();
    fetchUpcomingClasses();
    fetchTests();
  }, []);

  const fetchActiveClasses = async () => {
    const { data, error } = await supabase.from('live_classes').select('*').eq('status', 'active');
    if (data && data.length > 0) setActiveLiveClass(data[0]);
    else setActiveLiveClass(null);
  };

  const fetchUpcomingClasses = async () => {
    const { data, error } = await supabase.from('live_classes').select('*').eq('status', 'scheduled').order('start_time', { ascending: true });
    if (data) setUpcomingClasses(data);
  };

  const fetchTests = async () => {
    setIsLoadingTests(true);
    const { data, error } = await supabase.from('tests').select('*').order('created_at', { ascending: false });
    if (data && !error) setTestsList(data);
    setIsLoadingTests(false);
  };

  const login = useGoogleLogin({
    onSuccess: (codeResponse) => {
      setAccessToken(codeResponse.access_token);
      localStorage.setItem('calendar_token', codeResponse.access_token);
    },
    onError: (error) => setErrorMsg('Login Failed: ' + error.message),
    scope: 'https://www.googleapis.com/auth/calendar.events',
  });

  const generateMeetLink = async () => {
    if (!accessToken) return;
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      // Parse dates
      const startDateTime = new Date(`${startDate}T${startTime}`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(duration) * 60000);

      const event = {
        summary: `Online Class: ${classTitle}`,
        description: `Online Class for ${selectedClass}.`,
        start: {
          dateTime: startDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: endDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        conferenceData: {
          createRequest: {
            requestId: Math.random().toString(36).substring(7),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      };

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or is invalid
          setAccessToken(null);
          localStorage.removeItem('calendar_token');
          throw new Error('Your Google Calendar connection expired (Google limits this to 1 hour for security). Please click Connect again.');
        }
        throw new Error(data.error?.message || 'Failed to generate Meet link');
      }

      // Save to Supabase
      const currentUser = JSON.parse(localStorage.getItem('edtech_user') || '{}');
      const { data: dbData, error: dbError } = await supabase.from('live_classes').insert([{
        title: classTitle,
        class_name: selectedClass,
        meet_link: data.hangoutLink,
        status: 'scheduled',
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        created_by: currentUser.email || 'unknown'
      }]).select();

      if (dbError) throw dbError;
      
      // Notify all students
      await supabase.from('notifications').insert({
        user_email: 'all',
        type: 'meeting',
        title: 'New Online Class Scheduled',
        message: `A new online class "${classTitle}" has been scheduled for ${selectedClass} on ${startDateTime.toLocaleDateString()}.`,
        is_read: false
      });

      alert('Class scheduled successfully!');
      
      // Reset form
      fetchUpcomingClasses();
      setAccessToken(null); // Return to default view
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const endLiveClass = async (id) => {
    await supabase.from('live_classes').update({ status: 'ended' }).eq('id', id);
    setActiveLiveClass(null);
  };

  const startScheduledClass = async (id) => {
    await supabase.from('live_classes').update({ status: 'active' }).eq('id', id);
    fetchActiveClasses();
    fetchUpcomingClasses();
  };

  const deleteScheduledClass = async (id) => {
    if(window.confirm("Delete this scheduled class?")) {
       await supabase.from('live_classes').delete().eq('id', id);
       fetchUpcomingClasses();
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px', borderRadius: '8px', 
    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', 
    color: 'white', boxSizing: 'border-box', colorScheme: 'dark'
  };

  return (
    <div className="view-container animate-fade-in" style={{ paddingBottom: '50px' }}>
      <div className="view-header flex-between">
        <div>
          <h1>Online Classes & Tests</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your scheduled sessions, active streams, and student tests.</p>
        </div>
        
        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '30px', padding: '5px' }}>
          <button 
            onClick={() => setActiveTab('active')}
            style={{
              padding: '8px 20px', borderRadius: '25px', border: 'none',
              background: activeTab === 'active' ? 'var(--accent-cyan)' : 'transparent',
              color: activeTab === 'active' ? '#000' : 'var(--text-secondary)',
              cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s'
            }}
          >
            Active Session
          </button>
          <button 
            onClick={() => setActiveTab('upcoming')}
            style={{
              padding: '8px 20px', borderRadius: '25px', border: 'none',
              background: activeTab === 'upcoming' ? 'var(--accent-blue)' : 'transparent',
              color: activeTab === 'upcoming' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s'
            }}
          >
            Upcoming
          </button>
          <button 
            onClick={() => setActiveTab('tests')}
            style={{
              padding: '8px 20px', borderRadius: '25px', border: 'none',
              background: activeTab === 'tests' ? 'var(--accent-purple)' : 'transparent',
              color: activeTab === 'tests' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s'
            }}
          >
            Manage Tests
          </button>
        </div>
      </div>

      {activeTab === 'active' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }} className="animate-fade-in">
          {activeLiveClass ? (
            <Card title="Currently Active Class" style={{ background: 'var(--brand-glow, rgba(0, 240, 255, 0.05))', border: '1px solid var(--brand-border, rgba(0, 240, 255, 0.2))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-cyan)', boxShadow: '0 0 15px var(--accent-cyan)', animation: 'pulse 2s infinite' }}></div>
                    <h2 style={{ margin: 0, color: 'var(--accent-cyan)' }}>{activeLiveClass.title}</h2>
                  </div>
                  <p style={{ margin: '0 0 5px 0', color: 'var(--text-secondary)' }}>Target: {activeLiveClass.class_name}</p>
                </div>
                <button onClick={() => endLiveClass(activeLiveClass.id)} className="btn btn-ghost" style={{ border: '1px solid #ff3b30', color: '#ff3b30' }}>
                  End Class for All
                </button>
              </div>
              <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', textAlign: 'center' }}>
                <a href={activeLiveClass.meet_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '15px 30px', fontSize: '16px', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <ExternalLink size={20} /> Join Google Meet Now
                </a>
              </div>
            </Card>
          ) : (
             <Card>
               <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                 <Video size={48} color="var(--text-secondary)" style={{ marginBottom: '15px', opacity: 0.5 }} />
                 <h2 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}>No Active Session</h2>
                 <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Go to the Upcoming tab to start a scheduled class.</p>
               </div>
             </Card>
          )}
        </div>
      ) : activeTab === 'upcoming' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }} className="animate-fade-in">
          <Card title="Schedule New Class">
             {!accessToken ? (
               <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                 <CalendarIcon size={48} color="var(--accent-blue)" style={{ marginBottom: '15px', opacity: 0.8 }} />
                 <h2 style={{ margin: '0 0 10px 0' }}>Connect Google Calendar</h2>
                 <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Your teacher account is logged in, but we need permission to add events to your Google Calendar.</p>
                 <button onClick={() => login()} className="btn btn-primary" style={{ padding: '12px 25px', display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'var(--accent-blue)', color: 'white', fontWeight: 'bold' }}>
                    <LinkIcon size={20} /> Connect Google Calendar
                 </button>
               </div>
             ) : (
               <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                 <h3 style={{ margin: '0 0 20px 0', color: 'var(--accent-cyan)' }}>Class Details</h3>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: 'var(--text-secondary)' }}>Class Title</label>
                      <input type="text" value={classTitle} onChange={(e) => setClassTitle(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: 'var(--text-secondary)' }}>Target Audience</label>
                      <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} style={inputStyle}>
                        {classesList.map(c => <option key={c} value={c} style={{background: '#1a1f2b'}}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: 'var(--text-secondary)' }}>Date</label>
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: 'var(--text-secondary)' }}>Time</label>
                        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: 'var(--text-secondary)' }}>Duration</label>
                        <select value={duration} onChange={(e) => setDuration(e.target.value)} style={inputStyle}>
                          <option value="30" style={{background: '#1a1f2b'}}>30 mins</option>
                          <option value="45" style={{background: '#1a1f2b'}}>45 mins</option>
                          <option value="60" style={{background: '#1a1f2b'}}>1 hour</option>
                          <option value="90" style={{background: '#1a1f2b'}}>1.5 hours</option>
                          <option value="120" style={{background: '#1a1f2b'}}>2 hours</option>
                        </select>
                      </div>
                    </div>
                 </div>

                 {errorMsg && (
                    <div style={{ padding: '10px 15px', background: 'rgba(255, 59, 48, 0.1)', border: '1px solid #ff3b30', borderRadius: '8px', color: '#ff3b30', marginBottom: '20px', fontSize: '14px' }}>
                      {errorMsg}
                    </div>
                 )}

                 <div style={{ display: 'flex', gap: '15px' }}>
                   <button onClick={() => {
                     setAccessToken(null);
                     localStorage.removeItem('calendar_token');
                   }} className="btn btn-ghost" style={{ flex: 1 }}>Disconnect Calendar</button>
                   <button onClick={generateMeetLink} disabled={isGenerating || !classTitle.trim()} className="btn" style={{ flex: 2, padding: '12px 25px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', background: 'var(--accent-cyan)', color: 'black', fontWeight: 'bold', opacity: isGenerating || !classTitle.trim() ? 0.7 : 1 }}>
                     {isGenerating ? <Loader2 size={20} className="spinner" /> : <CalendarIcon size={20} />} 
                     {isGenerating ? 'Scheduling...' : 'Schedule Class & Generate Meet'}
                   </button>
                 </div>
               </div>
             )}
          </Card>

          <Card title="Upcoming Scheduled Classes">
             {upcomingClasses.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No upcoming classes scheduled.</div>
             ) : (
               <div style={{ display: 'grid', gap: '15px' }}>
                 {upcomingClasses.map(cls => {
                   const startObj = new Date(cls.start_time);
                   const endObj = new Date(cls.end_time);
                   const isToday = startObj.toDateString() === new Date().toDateString();
                   
                   return (
                     <div key={cls.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                       <div>
                         <h3 style={{ margin: '0 0 5px 0', color: 'var(--text-primary)' }}>{cls.title}</h3>
                         <p style={{ margin: '0 0 8px 0', color: 'var(--accent-blue)', fontSize: '14px', fontWeight: 'bold' }}>Target: {cls.class_name}</p>
                         <div style={{ display: 'flex', gap: '15px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                           <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                             <CalendarIcon size={14} /> 
                             {isToday ? 'Today' : startObj.toLocaleDateString()}
                           </span>
                           <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                             <Clock size={14} /> 
                             {startObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {endObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           </span>
                         </div>
                       </div>
                       <div style={{ display: 'flex', gap: '10px' }}>
                          <button onClick={() => deleteScheduledClass(cls.id)} className="btn btn-ghost" style={{ padding: '10px', color: '#ff3b30' }}>
                            <Trash2 size={18} />
                          </button>
                          <button onClick={() => startScheduledClass(cls.id)} className="btn btn-primary" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent-cyan)', color: 'black' }}>
                            <Play size={18} fill="black" /> Start Class Now
                          </button>
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}
          </Card>
        </div>
      ) : activeTab === 'tests' ? (
        testCreationMode === 'mcq' ? (
          <CreateMCQTest onCancel={() => { setTestCreationMode(null); fetchTests(); }} />
        ) : testCreationMode === 'qa' ? (
          <CreateQATest onCancel={() => { setTestCreationMode(null); fetchTests(); }} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }} className="animate-fade-in">
            <Card title="Create a Test">
               <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                  <button onClick={() => setTestCreationMode('mcq')} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '15px', border: '1px dashed var(--accent-cyan)' }}>
                    <CheckCircle size={20} color="var(--accent-cyan)" />
                    <div style={{ textAlign: 'left' }}>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Multiple Choice (MCQ)</h4>
                      <p style={{ margin: '5px 0 0', fontSize: '12px' }}>Auto-graded quiz</p>
                    </div>
                  </button>
                  <button onClick={() => setTestCreationMode('qa')} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '15px', border: '1px dashed var(--accent-purple)' }}>
                    <FileText size={20} color="var(--accent-purple)" />
                    <div style={{ textAlign: 'left' }}>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Question / Answer</h4>
                      <p style={{ margin: '5px 0 0', fontSize: '12px' }}>Long form essay style</p>
                    </div>
                  </button>
               </div>
            </Card>

            <Card title="Assigned Tests">
              {isLoadingTests ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading tests...</div>
              ) : testsList.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>No tests have been created yet. Click a button on the left to create one.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                  {testsList.map(test => (
                    <div key={test.id} style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                          <FileText size={20} color="var(--accent-purple)" />
                          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{test.title}</h3>
                       </div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                          <Clock size={14} /> <span>{test.duration ? `${test.duration} mins` : 'Unlimited time'}</span>
                       </div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                          <CheckCircle size={14} /> <span>{test.questions?.length || 0} Questions ({test.type.toUpperCase()})</span>
                       </div>
                       
                       {test.start_time && test.end_time && (
                         <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)', borderLeft: '2px solid var(--accent-purple)' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                             <CalendarIcon size={12} color="var(--accent-purple)" />
                             <span style={{ fontWeight: 'bold' }}>Opens:</span> {new Date(test.start_time).toLocaleString()}
                           </div>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                             <Clock size={12} color="var(--accent-purple)" />
                             <span style={{ fontWeight: 'bold' }}>Closes:</span> {new Date(test.end_time).toLocaleString()}
                           </div>
                         </div>
                       )}

                       <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                         Created: {new Date(test.created_at).toLocaleDateString()}
                       </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )
      ) : null}
    </div>
  );
}
