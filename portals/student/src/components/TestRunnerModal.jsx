import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Send, Check, X, Award, HelpCircle } from 'lucide-react';
import { supabase } from '../supabase';
import './TestRunnerModal.css';

export default function TestRunnerModal({ test, onClose, onComplete }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionIdx]: selectedOptionId or text }
  const [timeLeft, setTimeLeft] = useState(() => {
    const durationMins = parseInt(test.duration) || 15;
    return durationMins * 60;
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  const questions = test.questions || [
    {
      id: 1,
      text: 'What happens when light rays strike an opaque object?',
      options: [
        { id: 'a', text: 'Light passes completely through without deviation', isCorrect: false },
        { id: 'b', text: 'Light is absorbed and blocked, forming a dark shadow behind it', isCorrect: true },
        { id: 'c', text: 'Light speed doubles inside the medium', isCorrect: false },
        { id: 'd', text: 'Light reflects infinitely inside the object', isCorrect: false }
      ]
    },
    {
      id: 2,
      text: 'Which region of a shadow is completely dark where no light from the source reaches?',
      options: [
        { id: 'a', text: 'Penumbra', isCorrect: false },
        { id: 'b', text: 'Antumbra', isCorrect: false },
        { id: 'c', text: 'Umbra', isCorrect: true },
        { id: 'd', text: 'Refraction Zone', isCorrect: false }
      ]
    },
    {
      id: 3,
      text: 'What type of propagation describes light traveling strictly in straight lines?',
      options: [
        { id: 'a', text: 'Curvilinear Propagation', isCorrect: false },
        { id: 'b', text: 'Rectilinear Propagation of Light', isCorrect: true },
        { id: 'c', text: 'Wave Interference', isCorrect: false },
        { id: 'd', text: 'Quantum Teleportation', isCorrect: false }
      ]
    }
  ];

  // Timer countdown
  useEffect(() => {
    if (isSubmitted) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSubmitted]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (qIdx, optId) => {
    setAnswers(prev => ({ ...prev, [qIdx]: optId }));
  };

  const handleTextAnswer = (qIdx, text) => {
    setAnswers(prev => ({ ...prev, [qIdx]: text }));
  };

  const handleSubmitTest = async () => {
    setShowConfirmSubmit(false);
    
    // Calculate Score for MCQs
    let correctCount = 0;
    let totalGraded = 0;

    questions.forEach((q, idx) => {
      if (q.options && q.options.length > 0) {
        totalGraded++;
        const selectedOptId = answers[idx];
        const correctOpt = q.options.find(o => o.isCorrect === true);
        if (correctOpt && String(selectedOptId) === String(correctOpt.id)) {
          correctCount++;
        }
      }
    });

    const percentage = totalGraded > 0 ? Math.round((correctCount / totalGraded) * 100) : 100;
    let grade = 'A+';
    if (percentage < 50) grade = 'D';
    else if (percentage < 70) grade = 'C';
    else if (percentage < 85) grade = 'B';
    else if (percentage < 95) grade = 'A';

    const result = {
      testId: test.id,
      testTitle: test.title,
      correctCount,
      totalGraded,
      percentage,
      grade,
      submittedAt: new Date().toISOString()
    };

    setScoreResult(result);
    setIsSubmitted(true);

    // Save to localStorage for instant local progress updates
    try {
      const stored = JSON.parse(localStorage.getItem('student_test_results') || '{}');
      stored[test.id] = result;
      localStorage.setItem('student_test_results', JSON.stringify(stored));
    } catch (e) {
      console.error(e);
    }

    // Save to Supabase audit logs & notifications
    try {
      const userStr = localStorage.getItem('edtech_user');
      const currentUser = userStr ? JSON.parse(userStr) : { name: 'Student', email: 'student@edtech.org' };

      await supabase.from('system_audit_logs').insert({
        severity: 'INFO',
        category: 'PERFORMANCE',
        code: 200,
        title: `Test Submitted: ${test.title}`,
        details: `Student ${currentUser.name} scored ${percentage}% (${correctCount}/${totalGraded}) on ${test.title}`,
        source: 'Student Test Runner',
        actor_email: currentUser.email,
        school_id: 'inst-dps-001',
        metadata: result
      });
    } catch (err) {
      console.warn('Could not sync test score to audit log:', err);
    }

    if (onComplete) {
      onComplete(result);
    }
  };

  const currentQ = questions[currentIdx];
  const isLastQuestion = currentIdx === questions.length - 1;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="test-runner-backdrop">
      <div className="test-runner-container">
        
        {/* Header */}
        <div className="test-runner-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="test-badge">ASSESSMENT RUNNER</span>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{test.subject || 'Class 6th Science'}</span>
            </div>
            <h2 className="test-title-text">{test.title}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {!isSubmitted && (
              <div className={`timer-badge ${timeLeft < 180 ? 'timer-warning' : ''}`}>
                <Clock size={18} />
                <span>{formatTime(timeLeft)}</span>
              </div>
            )}
            <button className="test-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Test Body */}
        {!isSubmitted ? (
          <div className="test-runner-content">
            {/* Progress indicator */}
            <div className="test-progress-bar-wrap">
              <div
                className="test-progress-bar-fill"
                style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
              ></div>
            </div>

            <div className="test-nav-stepper">
              <span style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: '600' }}>
                Question <strong style={{ color: 'var(--brand-primary, #00F0FF)' }}>{currentIdx + 1}</strong> of {questions.length}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                Answered: <strong style={{ color: '#10B981' }}>{answeredCount}</strong> / {questions.length}
              </span>
            </div>

            {/* Question Card */}
            <div className="question-card">
              <h3 className="question-prompt">{currentQ.text}</h3>

              {currentQ.options && currentQ.options.length > 0 ? (
                <div className="options-grid">
                  {currentQ.options.map((opt, optIdx) => {
                    const isSelected = String(answers[currentIdx]) === String(opt.id);
                    const letter = String.fromCharCode(65 + optIdx);
                    return (
                      <div
                        key={opt.id || optIdx}
                        className={`option-choice ${isSelected ? 'option-selected' : ''}`}
                        onClick={() => handleSelectOption(currentIdx, opt.id)}
                      >
                        <div className="option-letter">{letter}</div>
                        <span className="option-text">{opt.text}</span>
                        {isSelected && <CheckCircle2 className="option-check-icon" size={20} />}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="qa-input-wrapper">
                  <textarea
                    rows={6}
                    placeholder="Type your explanation and detailed answer here..."
                    className="qa-textarea"
                    value={answers[currentIdx] || ''}
                    onChange={(e) => handleTextAnswer(currentIdx, e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Question Navigation Footer */}
            <div className="test-footer-actions">
              <button
                className="test-btn test-btn-secondary"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
              >
                <ArrowLeft size={18} /> Previous
              </button>

              <div className="question-pills">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    className={`q-pill ${i === currentIdx ? 'q-pill-active' : ''} ${answers[i] !== undefined ? 'q-pill-answered' : ''}`}
                    onClick={() => setCurrentIdx(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              {isLastQuestion ? (
                <button
                  className="test-btn test-btn-primary"
                  onClick={() => setShowConfirmSubmit(true)}
                >
                  <Send size={18} /> Submit Assessment
                </button>
              ) : (
                <button
                  className="test-btn test-btn-primary"
                  onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
                >
                  Next Question <ArrowRight size={18} />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Completion & Score Screen */
          <div className="test-results-view animate-fade-in">
            <div className="results-badge-icon">
              <Award size={64} color="var(--brand-primary, #00F0FF)" />
            </div>

            <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: '0 0 8px 0', color: 'white' }}>
              Assessment Completed! 🎉
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '1.05rem', margin: '0 0 28px 0' }}>
              Your responses have been recorded and synced to your academic progress record.
            </p>

            <div className="results-score-card">
              <div className="score-circle">
                <span className="score-pct">{scoreResult?.percentage}%</span>
                <span className="score-grade">Grade {scoreResult?.grade}</span>
              </div>

              <div className="score-breakdown">
                <div className="breakdown-row">
                  <span style={{ color: '#94a3b8' }}>Correct Answers:</span>
                  <strong style={{ color: '#10B981' }}>{scoreResult?.correctCount} / {scoreResult?.totalGraded}</strong>
                </div>
                <div className="breakdown-row">
                  <span style={{ color: '#94a3b8' }}>Time Taken:</span>
                  <strong style={{ color: 'var(--brand-primary, #00F0FF)' }}>{formatTime((parseInt(test.duration) || 15) * 60 - timeLeft)}</strong>
                </div>
                <div className="breakdown-row">
                  <span style={{ color: '#94a3b8' }}>Status:</span>
                  <strong style={{ color: '#34c759' }}>Graded & Synced</strong>
                </div>
              </div>
            </div>

            <button
              className="test-btn test-btn-primary"
              style={{ padding: '16px 36px', fontSize: '1rem' }}
              onClick={onClose}
            >
              Return to Online Classes
            </button>
          </div>
        )}

        {/* Confirmation Modal Overlay */}
        {showConfirmSubmit && (
          <div className="confirm-modal-backdrop">
            <div className="confirm-modal-card">
              <AlertTriangle size={48} color="#fbbf24" style={{ marginBottom: '16px' }} />
              <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.3rem' }}>Submit Test?</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: '0 0 24px 0' }}>
                You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions. Once submitted, your score will be computed immediately.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button className="test-btn test-btn-secondary" onClick={() => setShowConfirmSubmit(false)}>
                  Continue Test
                </button>
                <button className="test-btn test-btn-primary" onClick={handleSubmitTest}>
                  Confirm & Submit
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
