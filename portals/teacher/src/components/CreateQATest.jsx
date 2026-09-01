import React, { useState } from 'react';
import { supabase } from '../supabase';
import Card from './Card';
import { PlusCircle, Trash2, Save, X, Database } from 'lucide-react';

const classesList = ['Class 1st', 'Class 2nd', 'Class 3rd', 'Class 4th', 'Class 5th', 'Class 6th', 'Class 7th', 'Class 8th', 'Class 9th', 'Class 10th', 'Class 11th', 'Class 12th'];

export default function CreateQATest({ onCancel }) {
  const [testInfo, setTestInfo] = useState({ title: '', assignedClass: 'Class 1st', duration: '' });
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [endDate, setEndDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [endTime, setEndTime] = useState('18:00');
  
  const [questions, setQuestions] = useState([
    { id: 1, text: '', points: 5 }
  ]);

  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState([]);
  
  const fetchBankQuestions = async () => {
    const currentUser = JSON.parse(localStorage.getItem('edtech_user') || '{}');
    const { data, error } = await supabase
      .from('question_bank')
      .select('*')
      .eq('type', 'qa')
      .eq('created_by', currentUser.email || '');
      
    if (!error && data) {
      setBankQuestions(data);
    }
  };
  
  const openBankModal = () => {
    setIsBankModalOpen(true);
    fetchBankQuestions();
  };
  
  const importQuestion = (bankQ) => {
    setQuestions([
      ...questions,
      { 
        id: Date.now() + Math.random(), 
        text: bankQ.text, 
        points: bankQ.points || 5
      }
    ]);
    setIsBankModalOpen(false);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { id: Date.now(), text: '', points: 5 }
    ]);
  };

  const removeQuestion = (id) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestionFields = (id, field, value) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!testInfo.title.trim()) {
      alert('Please enter a test title before saving.');
      return;
    }
    if (questions.length === 0) {
      alert('Please add at least one question before saving.');
      return;
    }

    setIsSaving(true);
    try {
      const startDateTime = new Date(`${startDate}T${startTime}`);
      const endDateTime = new Date(`${endDate}T${endTime}`);
      
      const currentUser = JSON.parse(localStorage.getItem('edtech_user') || '{}');
      const { error } = await supabase.from('tests').insert({
        title: testInfo.title,
        subject: testInfo.assignedClass,
        duration: testInfo.duration,
        type: 'qa',
        questions: questions,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        created_by: currentUser.email || 'unknown',
        created_at: new Date().toISOString()
      });

      if (error) throw error;

      // Send notification to all students
      await supabase.from('notifications').insert({
        user_email: 'all',
        type: 'assignment',
        title: 'New Test Assigned',
        message: `A new test "${testInfo.title}" has been assigned for ${testInfo.assignedClass}.`,
        is_read: false
      });

      alert('Test saved successfully!');
      onCancel();
    } catch (err) {
      if (err.code === '42P01') {
        alert('Tests table not set up yet. Please contact your administrator.');
      } else {
        alert('Failed to save test: ' + err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px', borderRadius: '8px', 
    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', 
    color: 'white', marginBottom: '15px', colorScheme: 'dark'
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '50px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Create Q/A Test</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost" onClick={onCancel}><X size={16} /> Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}><Save size={16} /> Save Test</button>
        </div>
      </div>

      <Card title="Test Details" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: 'var(--text-secondary)' }}>Test Title</label>
            <input type="text" style={inputStyle} placeholder="e.g., Physics Essay Exam" 
                   value={testInfo.title} onChange={e => setTestInfo({...testInfo, title: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: 'var(--text-secondary)' }}>Assigned Class</label>
            <select style={inputStyle} value={testInfo.assignedClass} onChange={e => setTestInfo({...testInfo, assignedClass: e.target.value})}>
              {classesList.map(cls => (
                <option key={cls} value={cls} style={{ background: '#1a1b2e', color: 'white' }}>{cls}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: 'var(--text-secondary)' }}>Duration (Mins)</label>
            <input type="number" style={inputStyle} placeholder="e.g., 60" 
                   value={testInfo.duration} onChange={e => setTestInfo({...testInfo, duration: e.target.value})} />
          </div>
        </div>
        
        <h4 style={{ margin: '15px 0 10px', color: 'var(--text-primary)' }}>Availability Window</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: 'var(--text-secondary)' }}>Start Date</label>
              <input type="date" style={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: 'var(--text-secondary)' }}>Start Time</label>
              <input type="time" style={inputStyle} value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: 'var(--text-secondary)' }}>End Date</label>
              <input type="date" style={inputStyle} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: 'var(--text-secondary)' }}>End Time</label>
              <input type="time" style={inputStyle} value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      {questions.map((q, qIndex) => (
        <Card key={q.id} style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ margin: 0, color: 'var(--accent-purple)' }}>Question {qIndex + 1}</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Points:</span>
                <input type="number" style={{ ...inputStyle, width: '60px', marginBottom: 0, padding: '5px' }} 
                       value={q.points} onChange={e => updateQuestionFields(q.id, 'points', e.target.value)} />
              </div>
              <button className="btn btn-ghost" style={{ padding: '5px' }} onClick={() => removeQuestion(q.id)}>
                <Trash2 size={16} color="var(--text-secondary)" />
              </button>
            </div>
          </div>
          
          <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} placeholder="Enter your detailed question here..." 
                 value={q.text} onChange={e => updateQuestionFields(q.id, 'text', e.target.value)} />
        </Card>
      ))}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', gap: '15px' }}>
        <button className="btn btn-ghost" onClick={addQuestion} style={{ padding: '10px 20px', border: '1px dashed var(--accent-purple)', flex: 1 }}>
          <PlusCircle size={20} color="var(--accent-purple)" style={{ marginRight: '8px' }} /> Add Another Question
        </button>
        <button className="btn btn-ghost" onClick={openBankModal} style={{ padding: '10px 20px', border: '1px dashed var(--accent-gold)', flex: 1 }}>
          <Database size={20} color="var(--accent-gold)" style={{ marginRight: '8px' }} /> Import from Question Bank
        </button>
      </div>

      {isBankModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass-panel animate-scale-in" style={{ width: '90%', maxWidth: '700px', background: '#0B1120', border: '1px solid var(--panel-border)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'white' }}>Import Q&A from Question Bank</h3>
              <button onClick={() => setIsBankModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {bankQuestions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No Q&A questions found in your bank.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {bankQuestions.map(q => (
                    <div key={q.id} style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontSize: '12px', color: 'var(--accent-cyan)' }}>{q.subject} • {q.points} Points</span>
                          <p style={{ margin: '5px 0', color: 'white' }}>{q.text}</p>
                        </div>
                        <button onClick={() => importQuestion(q)} className="btn btn-primary" style={{ padding: '5px 15px', height: 'fit-content' }}>Import</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
