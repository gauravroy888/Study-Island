import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import Card from '../components/Card';
import { PlusCircle, Search, Trash2, Edit2, Database, X, Save } from 'lucide-react';

export default function QuestionBank() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newQuestionType, setNewQuestionType] = useState('mcq');
  
  // MCQ state
  const [mcqText, setMcqText] = useState('');
  const [mcqSubject, setMcqSubject] = useState('Physics');
  const [mcqOptions, setMcqOptions] = useState([{ id: 1, text: '', isCorrect: true }, { id: 2, text: '', isCorrect: false }]);
  
  // QA state
  const [qaText, setQaText] = useState('');
  const [qaSubject, setQaSubject] = useState('Physics');
  const [qaPoints, setQaPoints] = useState(5);

  const fetchQuestions = async () => {
    setLoading(true);
    const currentUser = JSON.parse(localStorage.getItem('edtech_user') || '{}');
    const { data, error } = await supabase
      .from('question_bank')
      .select('*')
      .eq('created_by', currentUser.email || '')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching question bank:', error);
    } else {
      setQuestions(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleSaveQuestion = async () => {
    const currentUser = JSON.parse(localStorage.getItem('edtech_user') || '{}');
    
    let qData = {
      type: newQuestionType,
      created_by: currentUser.email || 'unknown',
      created_at: new Date().toISOString()
    };
    
    if (newQuestionType === 'mcq') {
      if (!mcqText) return alert("Question text required");
      qData.subject = mcqSubject;
      qData.text = mcqText;
      qData.options = mcqOptions;
    } else {
      if (!qaText) return alert("Question text required");
      qData.subject = qaSubject;
      qData.text = qaText;
      qData.points = qaPoints;
    }
    
    const { error } = await supabase.from('question_bank').insert(qData);
    if (error) {
      alert("Failed to add question: " + error.message);
    } else {
      setIsAddModalOpen(false);
      fetchQuestions();
      // Reset forms
      setMcqText('');
      setQaText('');
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Are you sure you want to delete this question?")) return;
    const { error } = await supabase.from('question_bank').delete().eq('id', id);
    if (error) alert("Failed to delete: " + error.message);
    else fetchQuestions();
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.text.toLowerCase().includes(searchQuery.toLowerCase()) || q.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || q.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="view-container animate-fade-in" style={{ paddingBottom: '50px' }}>
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Question Bank</h1>
          <p>Create and manage your reusable questions.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <PlusCircle size={18} /> Add New Question
        </button>
      </div>

      <Card>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '15px', top: '12px', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Search questions by text or subject..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 12px 12px 45px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', color: 'white' }}
            />
          </div>
          
          <div style={{ position: 'relative', width: '200px' }}>
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', color: 'white' }}
            >
              <option value="all" style={{ color: 'black' }}>All Types</option>
              <option value="mcq" style={{ color: 'black' }}>Multiple Choice</option>
              <option value="qa" style={{ color: 'black' }}>Q&A / Essay</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading question bank...</div>
        ) : filteredQuestions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Database size={48} style={{ opacity: 0.2, margin: '0 auto 15px auto', display: 'block' }} />
            <p>No questions found in your bank.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {filteredQuestions.map(q => (
              <div key={q.id} style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '12px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ padding: '4px 10px', background: 'var(--panel-border)', borderRadius: '15px', fontSize: '12px', textTransform: 'uppercase' }}>
                      {q.type === 'mcq' ? 'Multiple Choice' : 'Q&A'}
                    </span>
                    <span style={{ padding: '4px 10px', background: 'rgba(0, 229, 255, 0.1)', color: 'var(--accent-cyan)', borderRadius: '15px', fontSize: '12px' }}>
                      {q.subject}
                    </span>
                    {q.type === 'qa' && (
                      <span style={{ padding: '4px 10px', background: 'rgba(255, 215, 0, 0.1)', color: 'var(--accent-gold)', borderRadius: '15px', fontSize: '12px' }}>
                        {q.points} Points
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleDelete(q.id)} style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer', padding: '5px' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '15px', lineHeight: '1.4' }}>{q.text}</h3>
                
                {q.type === 'mcq' && q.options && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {q.options.map((opt, i) => (
                      <div key={i} style={{ padding: '10px 15px', background: opt.isCorrect ? 'rgba(52, 199, 89, 0.1)' : 'rgba(0,0,0,0.3)', border: `1px solid ${opt.isCorrect ? '#34c759' : 'var(--panel-border)'}`, borderRadius: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${opt.isCorrect ? '#34c759' : 'var(--text-secondary)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {opt.isCorrect && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#34c759' }}></div>}
                        </div>
                        {opt.text || `Option ${i+1}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Question Modal */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass-panel animate-scale-in" style={{ width: '90%', maxWidth: '700px', background: '#0B1120', border: '1px solid var(--panel-border)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Add to Question Bank</h2>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ padding: '25px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px', display: 'block' }}>Question Type</label>
                  <select 
                    value={newQuestionType} 
                    onChange={e => setNewQuestionType(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', color: 'white' }}
                  >
                    <option value="mcq" style={{ color: 'black' }}>Multiple Choice</option>
                    <option value="qa" style={{ color: 'black' }}>Q&A / Essay</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px', display: 'block' }}>Subject</label>
                  <input 
                    type="text" 
                    value={newQuestionType === 'mcq' ? mcqSubject : qaSubject}
                    onChange={e => newQuestionType === 'mcq' ? setMcqSubject(e.target.value) : setQaSubject(e.target.value)}
                    placeholder="e.g. Physics, Grade 10 Math"
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', color: 'white' }}
                  />
                </div>
              </div>

              {newQuestionType === 'mcq' ? (
                <div>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px', display: 'block' }}>Question Text</label>
                  <textarea 
                    value={mcqText}
                    onChange={e => setMcqText(e.target.value)}
                    placeholder="Enter the multiple choice question here..."
                    style={{ width: '100%', padding: '15px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', color: 'white', minHeight: '100px', resize: 'vertical', marginBottom: '20px' }}
                  ></textarea>

                  <label style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px', display: 'block' }}>Options (Select the correct one)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    {mcqOptions.map((opt, i) => (
                      <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                          type="radio" 
                          name="correct_option" 
                          checked={opt.isCorrect} 
                          onChange={() => setMcqOptions(mcqOptions.map(o => ({ ...o, isCorrect: o.id === opt.id })))}
                          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                        <input 
                          type="text" 
                          value={opt.text}
                          onChange={e => setMcqOptions(mcqOptions.map(o => o.id === opt.id ? { ...o, text: e.target.value } : o))}
                          placeholder={`Option ${i+1}`}
                          style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${opt.isCorrect ? '#34c759' : 'var(--panel-border)'}`, color: 'white' }}
                        />
                        <button onClick={() => setMcqOptions(mcqOptions.filter(o => o.id !== opt.id))} style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer', padding: '10px' }}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setMcqOptions([...mcqOptions, { id: Date.now(), text: '', isCorrect: false }])}
                    style={{ background: 'transparent', border: '1px dashed var(--panel-border)', color: 'var(--accent-cyan)', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                  >
                    <PlusCircle size={16} /> Add Option
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                     <div style={{ flex: 1 }}>
                        <label style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px', display: 'block' }}>Points</label>
                        <input 
                          type="number" 
                          value={qaPoints}
                          onChange={e => setQaPoints(parseInt(e.target.value))}
                          style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', color: 'white' }}
                        />
                     </div>
                  </div>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px', display: 'block' }}>Question Text</label>
                  <textarea 
                    value={qaText}
                    onChange={e => setQaText(e.target.value)}
                    placeholder="Enter the question here..."
                    style={{ width: '100%', padding: '15px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', color: 'white', minHeight: '150px', resize: 'vertical' }}
                  ></textarea>
                </div>
              )}
            </div>
            
            <div style={{ padding: '20px 25px', borderTop: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(0,0,0,0.2)' }}>
              <button className="btn btn-ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveQuestion}><Save size={18} /> Save to Bank</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
