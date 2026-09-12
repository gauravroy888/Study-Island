import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as Icons from 'lucide-react';
import quizData from '../data/sample_chapter_quiz.json';
import { fetchQuizFromGoogleSheet, validateQuizSheetRow } from '../lib/sheets-quiz-sync.js';
import { supabase } from '../supabase';
import QuizAnalyticsAdapter from '../lib/quizAnalyticsAdapter';

/**
 * Resolve current student identity from localStorage or Supabase token
 */
const getStoredStudentUser = () => {
  try {
    const rawStudent = localStorage.getItem('edtech_student_user');
    if (rawStudent) {
      const u = JSON.parse(rawStudent);
      if (u) return {
        id: u.id || u.uid || null,
        email: u.email || null,
        name: u.name || u.full_name || null
      };
    }
    const rawUser = localStorage.getItem('edtech_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u) return {
        id: u.id || u.uid || null,
        email: u.email || null,
        name: u.name || u.full_name || null
      };
    }
    const rawToken = localStorage.getItem('sb-qmyrxvtbzlbnvzxypnus-auth-token');
    if (rawToken) {
      const token = JSON.parse(rawToken);
      const user = token?.user || token?.currentSession?.user;
      if (user) return {
        id: user.id || null,
        email: user.email || null,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || null
      };
    }
  } catch (e) {}
  return null;
};

/**
 * Custom dynamic Lucide icon resolver with safety alias mapping
 */
const ICON_ALIASES = {
  telescope: 'View',
  'split-square-horizontal': 'Split',
  'corner-up-right': 'CornerUpRight'
};

// Local label maps (replaces direct BLOOM_WEIGHTS/DIFFICULTY_WEIGHTS import)
const BLOOM_BADGE_LABELS = {
  remember: '0.5×',
  understand: '0.7×',
  apply: '1.0×',
  analyze: '1.2×',
  evaluate: '1.4×',
  create: '1.5×'
};
const DIFFICULTY_BADGE_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard'
};

const LucideIcon = ({ name, className }) => {
  const normalized = name ? String(name).toLowerCase() : '';
  const alias = ICON_ALIASES[normalized] || null;
  const pascalName = alias || (name ? name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('') : '');
  const IconComp = Icons[pascalName] || Icons[name] || Icons.HelpCircle || (() => null);
  return <IconComp className={className} />;
};

// UI Translations
const LANGUAGES = {
  en: { name: 'English' },
  hi: { name: 'हिन्दी (Hindi)' }
};

const T = {
  en: {
    title: "Optics Mastery Quiz",
    subtitle: "Chapter 10: Light, Shadows and Optics",
    zenMode: "Zen Mode",
    zenDesc: "Self-paced inquiry. Deep conceptual understanding.",
    challengeMode: "Challenge Mode",
    challengeDesc: "15-Minute Countdown. Tests fluency & pressure accuracy.",
    back: "Back",
    quizProgress: "Quiz Progress",
    questionsDone: "Questions Done",
    timeMode: "Time Mode",
    sections: "Curriculum Sections",
    complete: "Quiz Completed!",
    percentage: "Raw Accuracy",
    retake: "Retake Quiz",
    nextQuestion: "Next Question",
    submitSection: "Next Section",
    reviewBtn: "Review Answers",
    finalSubmit: "Submit & Complete",
    reviewTitle: "Review Quiz Answers",
    exitConfirm: "Exit Quiz Session?",
    exitWarning: "Your ongoing telemetry session will be marked as abandoned.",
    yesExit: "Yes, Exit",
    cancel: "Cancel",
    submitConfirm: "Submit Quiz for Evaluation?",
    submitWarning: "Answers will be locked and compiled into permanent learning evidence.",
    yesSubmit: "Yes, Submit",
    backToQuiz: "Return to Questions",
    analyseBtn: "Detailed Analysis",
    analysisTitle: "Question-by-Question Diagnostics",
    backToResults: "Back to Scorecard",
    explanationLabel: "Scientific Explanation",
    hintBtn: "Hint",
    hintWarning: "⚠️ Hint Used (Credit reduced to 60% under INDEPENDENCE_V1)",
    masteryLabel: "Overall Mastery",
    fluencyLabel: "Fluency Score",
    independenceLabel: "Independence",
    loTitle: "Learning Objectives Performance",
    bloomTitle: "Cognitive Depth (Bloom's Taxonomy)",
    backToChapter: "Back to Chapter"
  },
  hi: {
    title: "प्रकाश एवं छाया महारत प्रश्नोत्तरी",
    subtitle: "अध्याय 10: प्रकाश, छाया एवं प्रकाशिकी",
    zenMode: "ज़ेन मोड",
    zenDesc: "स्व-गति से अध्ययन। गहन वैचारिक समझ।",
    challengeMode: "चैलेंज मोड",
    challengeDesc: "15 मिनट का समय। प्रवाह और दबाव में सटीकता की परीक्षा।",
    back: "वापस",
    quizProgress: "प्रश्नोत्तरी प्रगति",
    questionsDone: "प्रश्न पूर्ण",
    timeMode: "समय मोड",
    sections: "पाठ्यक्रम अनुभाग",
    complete: "प्रश्नोत्तरी संपन्न!",
    percentage: "शुद्ध सटीकता",
    retake: "पुनः प्रयास करें",
    nextQuestion: "अगला प्रश्न",
    submitSection: "अगला अनुभाग",
    reviewBtn: "उत्तर समीक्षा",
    finalSubmit: "अंतिम सबमिट",
    reviewTitle: "अपने उत्तरों की समीक्षा करें",
    exitConfirm: "सत्र से बाहर निकलें?",
    exitWarning: "आपकी वर्तमान प्रगति रद्द के रूप में दर्ज की जाएगी।",
    yesExit: "हाँ, बाहर निकलें",
    cancel: "रद्द करें",
    submitConfirm: "क्विज़ सबमिट करें?",
    submitWarning: "सबमिट करने के बाद उत्तर स्थायी अधिगम प्रमाण में दर्ज हो जाएंगे।",
    yesSubmit: "हाँ, सबमिट करें",
    backToQuiz: "प्रश्नों पर वापस जाएं",
    analyseBtn: "विस्तृत विश्लेषण",
    analysisTitle: "प्रश्नवार विस्तृत व्याख्या",
    backToResults: "परिणाम पर वापस",
    explanationLabel: "वैज्ञानिक व्याख्या",
    hintBtn: "संकेत",
    hintWarning: "⚠️ संकेत का उपयोग (INDEPENDENCE_V1 के तहत क्रेडिट 60% किया गया)",
    masteryLabel: "समग्र महारत (Mastery)",
    fluencyLabel: "प्रवाह स्कोर (Fluency)",
    independenceLabel: "आत्मनिर्भरता (Independence)",
    loTitle: "अधिगम उद्देश्य महारत (LO Performance)",
    bloomTitle: "संज्ञानात्मक गहराई (Bloom's Taxonomy)",
    backToChapter: "अध्याय पर वापस"
  }
};

// Audio Synthesizer
const playSound = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);
      osc.start(); osc.stop(ctx.currentTime + 0.03);
    } else if (type === 'select') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle'; osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(540, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start(); osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'hint') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'complete') {
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.4);
        osc.start(ctx.currentTime + i * 0.08); osc.stop(ctx.currentTime + i * 0.08 + 0.4);
      });
    }
  } catch (e) {}
};

// Shuffler utility
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Glow background orb component
const GlowOrb = ({ color, top, left, delay }) => (
  <div
    className={`absolute rounded-full mix-blend-screen filter blur-[100px] opacity-30 pointer-events-none ${color}`}
    style={{ top, left, width: '40vw', height: '40vw', animationDelay: delay }}
  />
);

// Spring Slider for ultra-smooth scrollbars
const SpringSlider = ({ scrollTargetRef }) => {
  const trackRef = useRef(null);
  const knobRef = useRef(null);

  useEffect(() => {
    const knob = knobRef.current;
    const track = trackRef.current;
    if (!knob || !track) return;

    let isDragging = false;
    let startY = 0;
    let currentOffset = 0;
    let maxOffset = 0;
    let animationFrameId = null;

    const scrollLoop = () => {
      if (isDragging && currentOffset !== 0 && maxOffset > 0) {
        const target = scrollTargetRef && scrollTargetRef.current;
        const speedFactor = currentOffset / maxOffset;
        const maxSpeed = 22;
        if (target) {
          target.scrollTop += speedFactor * maxSpeed;
        } else {
          window.scrollBy({ top: speedFactor * maxSpeed, left: 0, behavior: 'instant' });
        }
      }
      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    scrollLoop();

    const onStart = (e) => {
      isDragging = true;
      const trackHeight = track.clientHeight;
      const knobHeight = knob.clientHeight;
      maxOffset = (trackHeight - knobHeight) / 2;
      knob.style.transition = 'none';
      knob.classList.add('dragging');
      startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
      let deltaY = clientY - startY;
      if (Math.abs(deltaY) > maxOffset) {
        const excess = Math.abs(deltaY) - maxOffset;
        const resistedExcess = excess * 0.3;
        deltaY = Math.sign(deltaY) * (maxOffset + resistedExcess);
      }
      currentOffset = deltaY;
      knob.style.transform = `translate(-50%, calc(-50% + ${currentOffset}px)) scale(1.1)`;
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      knob.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease';
      knob.classList.remove('dragging');
      currentOffset = 0;
      knob.style.transform = `translate(-50%, -50%) scale(1)`;
    };

    const handleTouchMove = (e) => {
      if (isDragging) e.preventDefault();
      onMove(e);
    };

    knob.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    knob.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    return () => {
      cancelAnimationFrame(animationFrameId);
      knob.removeEventListener('mousedown', onStart);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      knob.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [scrollTargetRef]);

  return (
    <div className="spring-slider-container" style={{ position: 'fixed' }}>
      <div ref={trackRef} className="spring-slider-track">
        <div ref={knobRef} className="spring-slider-knob">
          <div className="knob-inner"></div>
        </div>
      </div>
    </div>
  );
};

// Bloom Badge Helper
const getBloomBadge = (level) => {
  const l = (level || 'apply').toLowerCase();
  const label = BLOOM_BADGE_LABELS[l] || '1.0×';
  let color = 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.2)]';
  if (l === 'remember') color = 'bg-blue-500/15 text-blue-300 border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]';
  if (l === 'understand') color = 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]';
  if (l === 'apply') color = 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.2)]';
  if (l === 'analyze') color = 'bg-purple-500/15 text-purple-300 border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]';

  return {
    label: `${l.toUpperCase()} ${label}`,
    color
  };
};

// Difficulty Badge Helper
const getDifficultyBadge = (difficulty) => {
  const d = (difficulty || 'medium').toLowerCase();
  if (d === 'easy') {
    return { label: 'Easy', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' };
  }
  if (d === 'hard') {
    return { label: 'Hard', color: 'bg-rose-500/15 text-rose-300 border-rose-500/40' };
  }
  return { label: 'Medium', color: 'bg-amber-500/15 text-amber-300 border-amber-500/40' };
};

// --- MAIN QUIZ APP COMPONENT ---
function App() {
  const [appState, setAppState] = useState('start'); // start, playing, review, results, analysis
  const [lang, setLang] = useState('en');
  const [mode, setMode] = useState('untimed'); // untimed (Zen) or timed (Challenge)
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [hintUsed, setHintUsed] = useState({});
  const [showHintModal, setShowHintModal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeStr, setTimeStr] = useState("10:00 AM");
  const [activeQuizData, setActiveQuizData] = useState(null);
  const [loadedQuiz, setLoadedQuiz] = useState(quizData);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [sheetSyncStatus, setSheetSyncStatus] = useState(null);
  const [resultsSummary, setResultsSummary] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [customSourceInput, setCustomSourceInput] = useState('');
  const [currentUser, setCurrentUser] = useState(getStoredStudentUser);
  const [previousAttemptData, setPreviousAttemptData] = useState(null);
  const [isImprovementMode, setIsImprovementMode] = useState(false);

  // Sync session on mount if storage was empty
  useEffect(() => {
    if (!currentUser?.id || !currentUser?.email) {
      supabase.auth.getSession().then(({ data: { session } = {} }) => {
        if (session?.user) {
          setCurrentUser({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0]
          });
        }
      }).catch(() => {});
    }
  }, []);

  // Load previous attempt data from Supabase for Improvement Mode scoring
  useEffect(() => {
    const loadPreviousAttempt = async () => {
      try {
        const student = getStoredStudentUser();
        if (!student?.id) return;
        const { data, error } = await supabase
          .from('analytics_events')
          .select('payload, created_at')
          .eq('student_id', student.id)
          .eq('event_type', 'quiz_complete')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error && data?.payload) {
          setPreviousAttemptData(data.payload);
          setIsImprovementMode(true);
        }
      } catch (e) {
        // Graceful degradation — previous attempt unavailable
      }
    };
    loadPreviousAttempt();
  }, []);

  // Timing refs
  const questionStartTime = useRef(Date.now());
  const quizStartTime = useRef(Date.now());

  // Scroll refs
  const reviewScrollRef = useRef(null);
  const analysisScrollRef = useRef(null);
  const resultsScrollRef = useRef(null);

  const ui = T[lang] || T.en;
  const sections = loadedQuiz?.sections || quizData.sections;
  const currentSection = sections[currentSectionIdx] || sections[0] || { id: 'general', questions: [] };
  const questionsList = activeQuizData ? (activeQuizData[currentSection.id] || []) : (currentSection?.questions || []);
  const currentQuestion = questionsList[currentQuestionIdx] || questionsList[0] || null;
  const totalQuestions = activeQuizData
    ? Object.values(activeQuizData).reduce((acc, qList) => acc + qList.length, 0)
    : (loadedQuiz?.total_questions || 40);
  const answeredCount = Object.keys(answers).length;

  // Query parameter extraction for Universal Quiz integration (?quiz_url=..., ?sheet_url=..., ?csv_url=...)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;

      const getParam = (name) => {
        const searchVal = new URLSearchParams(window.location.search).get(name);
        if (searchVal) return searchVal;
        if (window.location.hash) {
          const hashQIdx = window.location.hash.indexOf('?');
          if (hashQIdx !== -1) {
            return new URLSearchParams(window.location.hash.substring(hashQIdx)).get(name);
          }
        }
        return null;
      };

      const targetUrl = getParam('quiz_url') || getParam('quizUrl') || getParam('sheet_url') || getParam('sheetUrl') || getParam('csv_url') || getParam('csvUrl') || getParam('url');
      const chapterId = getParam('chapter_id') || getParam('chapterId') || getParam('chapter_slug');
      const chapterTitle = getParam('chapter_title') || getParam('chapterTitle') || getParam('chapter');

      const meta = {};
      if (chapterId) meta.chapter_id = chapterId;
      if (chapterTitle) meta.chapter_title = chapterTitle;

      if (targetUrl) {
        setIsLoadingQuiz(true);
        setSheetSyncStatus('syncing');
        fetchQuizFromGoogleSheet(targetUrl, quizData, meta)
          .then(result => {
            if (result && result.sections && result.sections.length > 0) {
              setLoadedQuiz(result);
              setSheetSyncStatus(result.source === 'google_sheets' ? 'synced' : (result.source === 'csv' ? 'csv_synced' : 'fallback'));
            }
          })
          .catch(err => {
            console.warn('[QuizView] Quiz URL sync notice:', err);
            setSheetSyncStatus('fallback');
          })
          .finally(() => {
            setIsLoadingQuiz(false);
          });
      }
    } catch (e) {
      console.warn('[QuizView] Error checking quiz URL param:', e);
    }
  }, []);

  const handleLoadCustomSource = (urlToLoad) => {
    if (!urlToLoad || !urlToLoad.trim()) return;
    setIsLoadingQuiz(true);
    setSheetSyncStatus('syncing');
    fetchQuizFromGoogleSheet(urlToLoad.trim(), quizData)
      .then(result => {
        if (result && result.sections && result.sections.length > 0) {
          setLoadedQuiz(result);
          setSheetSyncStatus(result.source === 'google_sheets' ? 'synced' : (result.source === 'csv' ? 'csv_synced' : 'fallback'));
          setShowSourceModal(false);
        }
      })
      .catch(err => {
        console.warn('[QuizView] Custom quiz load error:', err);
        setSheetSyncStatus('fallback');
      })
      .finally(() => {
        setIsLoadingQuiz(false);
      });
  };

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 60000);
    const d = new Date();
    setTimeStr(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    return () => clearInterval(timer);
  }, []);

  // Challenge mode countdown timer
  useEffect(() => {
    let interval = null;
    if (appState === 'playing' && mode === 'timed' && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (appState === 'playing' && mode === 'timed' && timeRemaining === 0) {
      confirmSubmit();
    }
    return () => clearInterval(interval);
  }, [appState, mode, timeRemaining]);

  // Reset per-question timing when navigating
  useEffect(() => {
    questionStartTime.current = Date.now();
  }, [currentSectionIdx, currentQuestionIdx, appState]);

  // Start activity
  const startGame = (selectedMode) => {
    playSound('click');
    setMode(selectedMode);
    if (selectedMode === 'timed') setTimeRemaining(15 * 60);

    const newQuizData = {};
    sections.forEach(sec => {
      newQuizData[sec.id] = sec.questions.map(q => ({
        ...q,
        shuffledIndices: shuffleArray([0, 1, 2, 3])
      }));
    });

    setActiveQuizData(newQuizData);
    setAnswers({});
    setHintUsed({});
    setShowHintModal(false);
    setCurrentSectionIdx(0);
    setCurrentQuestionIdx(0);
    setResultsSummary(null);

    quizStartTime.current = Date.now();
    questionStartTime.current = Date.now();

    // Resolve freshest student credentials from storage or state
    const student = getStoredStudentUser() || currentUser;

    // Initialize EduSDK session with current student details
    QuizAnalyticsAdapter.startSession({
      chapterId: loadedQuiz?.chapter_id || quizData.chapter_id || 'SCI6-CH10',
      totalQuestions: sections.reduce((acc, s) => acc + s.questions.length, 0),
      isChallengeMode: selectedMode === 'timed',
      student,
      isImprovementMode,
      originalAttemptData: previousAttemptData
    });

    setAppState('playing');
  };

  // Option selection
  const handleSelectOption = (originalIndex) => {
    playSound('select');
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: originalIndex }));

    const elapsedMs = Math.max(800, Date.now() - questionStartTime.current);
    const isCorrect = originalIndex === currentQuestion.correct;
    const isHint = Boolean(hintUsed[currentQuestion.id]);

    QuizAnalyticsAdapter.recordAnswer({
      question: currentQuestion,
      isCorrect,
      hintUsed: isHint,
      responseTimeMs: elapsedMs
    });
  };

  // Trigger hint
  const handleTriggerHint = () => {
    playSound('hint');
    if (!hintUsed[currentQuestion.id]) {
      setHintUsed(prev => ({ ...prev, [currentQuestion.id]: true }));

      // If student already selected an answer before seeing hint, re-record checkpoint with hint_used flag
      if (answers[currentQuestion.id] !== undefined) {
        const isCorrect = answers[currentQuestion.id] === currentQuestion.correct;
        QuizAnalyticsAdapter.updateAnswerWithHint({
          question: currentQuestion,
          isCorrect,
          responseTimeMs: Math.max(800, Date.now() - questionStartTime.current)
        });
      }
    }
    setShowHintModal(true);
  };

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return "--:--";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Navigation handlers
  const handleNextArrow = () => {
    playSound('click');
    if (currentQuestionIdx < questionsList.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else if (currentSectionIdx < sections.length - 1) {
      setCurrentSectionIdx(prev => prev + 1);
      setCurrentQuestionIdx(0);
    } else {
      setAppState('review');
    }
  };

  const handlePrev = () => {
    playSound('click');
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(prev => prev - 1);
    } else if (currentSectionIdx > 0) {
      setCurrentSectionIdx(prev => prev - 1);
      setCurrentQuestionIdx(sections[currentSectionIdx - 1].questions.length - 1);
    }
  };

  const handleMainAction = () => {
    playSound('click');
    const isLastQuestionInSection = currentQuestionIdx === questionsList.length - 1;
    const isLastSection = currentSectionIdx === sections.length - 1;

    if (!isLastQuestionInSection) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else if (isLastQuestionInSection && !isLastSection) {
      setCurrentSectionIdx(prev => prev + 1);
      setCurrentQuestionIdx(0);
    } else {
      setAppState('review');
    }
  };

  // Exit handlers
  const handleBackClick = () => {
    playSound('click');
    setShowExitModal(true);
  };

  const confirmExit = () => {
    playSound('click');
    QuizAnalyticsAdapter.abandonSession({ reason: 'user_exit_modal' });
    setShowExitModal(false);
    setAppState('start');
  };

  const cancelExit = () => {
    playSound('click');
    setShowExitModal(false);
  };

  // Submit handlers
  const handleFinalSubmitClick = () => {
    playSound('click');
    setShowSubmitModal(true);
  };

  const confirmSubmit = () => {
    playSound('complete');
    setShowSubmitModal(false);

    // Fill fallback checkpoints for skipped/unanswered questions
    QuizAnalyticsAdapter.fillSkippedCheckpoints({ sections, answers, hintUsed });

    // Compute score
    let correctCount = 0;
    sections.forEach(sec => sec.questions.forEach(q => {
      if (answers[q.id] === q.correct) correctCount++;
    }));
    const totalTimeSpentMs = Math.max(1000, Date.now() - quizStartTime.current);
    const scorePct = Math.round((correctCount / totalQuestions) * 100);

    // Complete session via adapter (returns frozen analytics summary)
    const summary = QuizAnalyticsAdapter.completeSession({
      scorePct,
      totalQuestions,
      correctCount,
      timeSpentMs: totalTimeSpentMs
    });

    setResultsSummary(summary);
    setAppState('results');
  };

  const cancelSubmit = () => {
    playSound('click');
    setShowSubmitModal(false);
  };

  const returnToPlatform = () => {
    playSound('click');
    if (window.parent && window.parent !== window) {
      window.parent.postMessage('closeOverlay', '*');
    } else {
      window.location.hash = '#/chapter/science-ch10';
    }
  };

  // Background Component
  const DefaultAppBackground = () => (
    <>
      <div
        className="fixed inset-0 pointer-events-none z-[-3]"
        style={{
          backgroundColor: '#060913',
          backgroundImage: `radial-gradient(circle at 50% 0%, rgba(0, 240, 255, 0.08) 0%, transparent 65%), radial-gradient(circle at 100% 100%, rgba(168, 85, 247, 0.06) 0%, transparent 50%)`,
          backgroundAttachment: 'fixed'
        }}
      />
      <div className="fixed inset-0 pointer-events-none z-[-2] bg-black/40 backdrop-blur-[2px]"></div>
    </>
  );

  // Top Navigation Bar
  const renderTopNav = (showTime = true, backAction = handleBackClick, backText = ui.back) => (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center p-3 sm:p-6 gap-3 pointer-events-none">
      <button
        onClick={backAction}
        className="pointer-events-auto flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-900/80 hover:bg-slate-800/90 backdrop-blur-md border border-white/10 rounded-full transition-all text-white font-medium shadow-lg shrink-0 hover:border-cyan-400/50 group"
      >
        <LucideIcon name="arrow-left" className="w-5 h-5 shrink-0 text-white/80 group-hover:text-cyan-400 transition-colors" />
        <span className="hidden sm:block whitespace-nowrap">{backText}</span>
      </button>

      {showTime && (
        <div className="pointer-events-auto flex items-center gap-2 sm:gap-4 px-4 sm:px-6 py-2 sm:py-2.5 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full shadow-lg text-white shrink-0 max-w-[60%] overflow-hidden">
          <div className="text-sm sm:text-base font-light tracking-wide shrink-0 hidden md:block text-white/70">{timeStr}</div>
          <div className="w-px h-4 sm:h-5 bg-white/20 shrink-0 hidden md:block"></div>
          {mode === 'timed' ? (
            <div className="flex items-center gap-1.5 sm:gap-2 text-cyan-400">
              <LucideIcon name="timer" className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 animate-pulse" />
              <span className="text-sm sm:text-lg font-mono font-bold">{formatTime(timeRemaining)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 text-white/80">
              <LucideIcon name="infinity" className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-cyan-400" />
              <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold whitespace-nowrap">{ui.zenMode}</span>
            </div>
          )}
        </div>
      )}
    </header>
  );

  // Modals
  const exitModalJSX = showExitModal ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={cancelExit}></div>
      <div className="relative bg-slate-900 border border-white/20 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center animate-[pulse_0.2s_ease-out]">
        <LucideIcon name="alert-triangle" className="w-16 h-16 text-rose-400 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-white mb-2">{ui.exitConfirm}</h3>
        <p className="text-white/60 mb-8 text-sm">{ui.exitWarning}</p>
        <div className="flex gap-4">
          <button onClick={cancelExit} className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors">
            {ui.cancel}
          </button>
          <button onClick={confirmExit} className="flex-1 px-4 py-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-medium transition-colors">
            {ui.yesExit}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const submitModalJSX = showSubmitModal ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={cancelSubmit}></div>
      <div className="relative bg-slate-900 border border-cyan-500/40 p-8 rounded-3xl shadow-[0_0_50px_rgba(0,240,255,0.2)] max-w-md w-full text-center">
        <LucideIcon name="check-circle-2" className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-bounce" />
        <h3 className="text-2xl font-bold text-white mb-2">{ui.submitConfirm}</h3>
        <p className="text-white/60 mb-6 text-sm">{ui.submitWarning}</p>
        <div className="p-4 bg-slate-800/80 border border-white/10 rounded-2xl mb-6 text-left">
          <div className="flex justify-between text-sm py-1 border-b border-white/5">
            <span className="text-white/60">Questions Answered:</span>
            <span className="font-mono font-bold text-cyan-400">{answeredCount} / {totalQuestions}</span>
          </div>
          <div className="flex justify-between text-sm py-1 pt-2">
            <span className="text-white/60">Mode:</span>
            <span className="font-semibold text-white/90">{mode === 'timed' ? 'Challenge (15m)' : 'Zen Mode'}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={cancelSubmit} className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors">
            {ui.cancel}
          </button>
          <button onClick={confirmSubmit} className="flex-1 px-4 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)]">
            {ui.yesSubmit}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // Hint Drawer/Modal
  const hintModalJSX = showHintModal && currentQuestion ? (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setShowHintModal(false)}></div>
      <div className="relative bg-slate-900/95 border border-amber-500/40 p-6 sm:p-8 rounded-3xl shadow-[0_0_40px_rgba(245,158,11,0.25)] max-w-lg w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300">
              <LucideIcon name="lightbulb" className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-wide">Optical Concept Hint</h3>
          </div>
          <button
            onClick={() => setShowHintModal(false)}
            className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
          >
            <LucideIcon name="x" className="w-5 h-5" />
          </button>
        </div>

        {/* Clear Penalty Warning Pill */}
        <div className="mb-5 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-2.5 text-amber-200 text-xs sm:text-sm font-semibold shadow-inner">
          <LucideIcon name="alert-triangle" className="w-5 h-5 text-amber-400 shrink-0" />
          <span>{ui.hintWarning}</span>
        </div>

        <div className="bg-black/30 border border-white/5 rounded-2xl p-4 sm:p-5 mb-6 text-white/90 text-sm sm:text-base leading-relaxed">
          {currentQuestion.hint}
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setShowHintModal(false)}
            className="px-6 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)]"
          >
            Got It, Back to Question
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // --- 0. LOADING SCREEN (When fetching Google Sheet) ---
  if (isLoadingQuiz) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-white flex items-center justify-center relative overflow-hidden font-sans">
        <DefaultAppBackground />
        <div className="z-10 bg-slate-900/80 border border-cyan-500/30 backdrop-blur-xl p-8 rounded-3xl text-center max-w-sm mx-4 shadow-2xl animate-fade-in">
          <LucideIcon name="refresh-cw" className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Syncing Quiz Sheet</h3>
          <p className="text-xs text-white/60 leading-relaxed">
            Parsing questions, validating Bloom levels, and compiling curriculum sections...
          </p>
        </div>
      </div>
    );
  }

  // --- 1. START SCREEN ---
  if (appState === 'start') {
    return (
      <div className="min-h-screen w-full text-white font-sans flex items-center justify-center relative overflow-hidden">
        <DefaultAppBackground />
        <GlowOrb color="bg-cyan-500" top="-10%" left="-10%" delay="0s" />
        <GlowOrb color="bg-purple-600" top="60%" left="60%" delay="3s" />

        <div className="absolute top-4 sm:top-6 left-4 sm:left-6 z-30">
          <button
            onClick={returnToPlatform}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-900/80 hover:bg-slate-800/90 backdrop-blur-md border border-white/10 rounded-full transition-all text-white font-medium shadow-lg shrink-0 hover:border-cyan-400/40"
          >
            <LucideIcon name="arrow-left" className="w-5 h-5 shrink-0" />
            <span className="hidden sm:block whitespace-nowrap">Chapter Overview</span>
          </button>
        </div>

        <div className="absolute top-4 sm:top-6 right-4 sm:right-6 z-30 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full flex items-center px-4 py-2 shadow-lg">
          <LucideIcon name="globe" className="w-4 h-4 text-cyan-400 mr-2" />
          <select
            className="bg-transparent text-white text-sm outline-none cursor-pointer appearance-none pr-3"
            value={lang}
            onChange={(e) => { playSound('click'); setLang(e.target.value); }}
          >
            {Object.entries(LANGUAGES).map(([key, val]) => (
              <option key={key} value={key} className="bg-slate-900 text-white">{val.name}</option>
            ))}
          </select>
        </div>

        <div className="z-10 bg-slate-900/80 border border-white/15 backdrop-blur-2xl p-8 sm:p-12 rounded-[2.5rem] max-w-2xl text-center mx-4 w-[calc(100%-2rem)] shadow-[0_0_60px_rgba(0,0,0,0.8)]">
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 rounded-3xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center shadow-[0_0_30px_rgba(0,240,255,0.25)]">
            <LucideIcon name="sparkles" className="w-10 h-10 sm:w-12 sm:h-12 text-cyan-400 animate-pulse" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-3 tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
            {loadedQuiz?.chapter_title || ui.title}
          </h1>
          <p className="text-base sm:text-xl font-medium text-white/70 mb-8 tracking-wide">
            {ui.subtitle}
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-10 text-xs text-white/60 items-center">
            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full">{sections.length} Sections</span>
            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full">{totalQuestions} Questions</span>
            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full">INDEPENDENCE_V1 &amp; MASTERY_V1 Telemetry</span>
            {sheetSyncStatus === 'synced' && (
              <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-semibold rounded-full flex items-center gap-1.5">
                <LucideIcon name="check-circle-2" className="w-3.5 h-3.5" />
                <span>Google Sheets Live Sync ({totalQuestions} Qs)</span>
              </span>
            )}
            {sheetSyncStatus === 'csv_synced' && (
              <span className="px-3 py-1 bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-semibold rounded-full flex items-center gap-1.5">
                <LucideIcon name="file-text" className="w-3.5 h-3.5" />
                <span>Curriculum CSV Live ({totalQuestions} Qs)</span>
              </span>
            )}
            {sheetSyncStatus === 'syncing' && (
              <span className="px-3 py-1 bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-semibold rounded-full flex items-center gap-1.5 animate-pulse">
                <LucideIcon name="loader-2" className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing Quiz...</span>
              </span>
            )}
            {(!sheetSyncStatus || sheetSyncStatus === 'fallback') && (
              <span className="px-3 py-1 bg-amber-500/20 border border-amber-400/40 text-amber-300 font-semibold rounded-full flex items-center gap-1.5">
                <LucideIcon name="alert-triangle" className="w-3.5 h-3.5" />
                <span>Curriculum Quiz Bank</span>
              </span>
            )}
            <button
              onClick={() => { playSound('click'); setShowSourceModal(true); }}
              className="px-3 py-1 bg-slate-800/90 hover:bg-slate-700/90 border border-cyan-500/30 hover:border-cyan-400/50 text-cyan-300 rounded-full flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              title="Change Quiz CSV or Google Sheet URL"
            >
              <LucideIcon name="link-2" className="w-3.5 h-3.5 text-cyan-400" />
              <span>Link CSV / Sheet</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => startGame('untimed')}
              className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/50 p-6 sm:p-8 rounded-2xl transition-all duration-300 hover:scale-[1.02] text-left"
            >
              <LucideIcon name="infinity" className="w-10 h-10 text-blue-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{ui.zenMode}</h3>
              <p className="text-xs sm:text-sm text-white/50 leading-relaxed">{ui.zenDesc}</p>
            </button>

            <button
              onClick={() => startGame('timed')}
              className="group relative bg-cyan-950/30 hover:bg-cyan-900/40 border border-cyan-500/30 hover:border-cyan-400 p-6 sm:p-8 rounded-2xl transition-all duration-300 hover:scale-[1.02] text-left shadow-[0_0_30px_rgba(0,240,255,0.1)]"
            >
              <LucideIcon name="timer" className="w-10 h-10 text-cyan-400 mb-4 group-hover:rotate-12 transition-transform" />
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{ui.challengeMode}</h3>
              <p className="text-xs sm:text-sm text-cyan-200/60 leading-relaxed">{ui.challengeDesc}</p>
            </button>
          </div>
        </div>

        {/* Dynamic Quiz Source Modal */}
        {showSourceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative text-left">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                    <LucideIcon name="link-2" className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white">Universal Quiz Source</h3>
                </div>
                <button
                  onClick={() => setShowSourceModal(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition"
                >
                  <LucideIcon name="x" className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Connect any <strong>RFC-4180 CSV file</strong> or published <strong>Google Sheets CSV link</strong> to dynamically render assessment questions and sections.
              </p>

              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-wider font-bold text-slate-400">CSV or Google Sheet URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="/data/light_and_shadows_quiz.csv or https://docs.google.com/spreadsheets/..."
                    value={customSourceInput}
                    onChange={(e) => setCustomSourceInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-600 outline-none focus:border-cyan-400"
                  />
                  <button
                    onClick={() => handleLoadCustomSource(customSourceInput)}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shrink-0"
                  >
                    Load &amp; Sync
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5 pt-2 border-t border-white/5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Quick Presets</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomSourceInput('/data/light_and_shadows_quiz.csv');
                      handleLoadCustomSource('/data/light_and_shadows_quiz.csv');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/40 text-[11px] text-cyan-300 transition"
                  >
                    📄 Light &amp; Shadows CSV (/data/light_and_shadows_quiz.csv)
                  </button>
                  <a
                    href="/data/light_and_shadows_quiz.csv"
                    download="light_and_shadows_quiz.csv"
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] text-slate-300 hover:text-white transition flex items-center gap-1"
                  >
                    <LucideIcon name="download" className="w-3 h-3" />
                    Download CSV Template
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 2. DETAILED ANALYSIS SCREEN ---
  if (appState === 'analysis') {
    return (
      <div className="h-screen w-full text-white font-sans flex flex-col relative overflow-hidden">
        <DefaultAppBackground />
        {renderTopNav(false, () => { playSound('click'); setAppState('results'); }, ui.backToResults)}
        <SpringSlider scrollTargetRef={analysisScrollRef} />

        <div ref={analysisScrollRef} className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden slider-scroll-container pt-20 pb-16 px-4 sm:px-6">
          <div className="w-full max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-center mb-8 text-white">
              {ui.analysisTitle}
            </h2>

            <div className="space-y-8">
              {sections.map((section, sIdx) => {
                const qList = activeQuizData ? (activeQuizData[section.id] || []) : section.questions;
                return (
                  <div key={section.id} className="bg-slate-900/80 border border-white/10 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-xl">
                    <h3 className="text-lg sm:text-xl font-bold text-cyan-400 mb-6 border-b border-white/10 pb-4 flex items-center gap-3">
                      <LucideIcon name={section.icon} className="w-6 h-6 text-cyan-400 shrink-0" />
                      <span>Section {sIdx + 1}: {section.title}</span>
                      <span className="ml-auto text-xs font-mono font-normal text-white/50">{section.lo_id}</span>
                    </h3>

                    <div className="space-y-6">
                      {qList.map((q, qIdx) => {
                        const userAnsIdx = answers[q.id];
                        const isCorrect = userAnsIdx === q.correct;
                        const wasHintUsed = Boolean(hintUsed[q.id]);
                        const bloom = getBloomBadge(q.bloom_level);
                        const diff = getDifficultyBadge(q.difficulty);

                        return (
                          <div key={q.id} className="bg-black/30 rounded-2xl p-5 sm:p-6 border border-white/5 relative">
                            {/* Correct / Incorrect status icon */}
                            <div className={`absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900 ${userAnsIdx === undefined ? 'bg-slate-600' : (isCorrect ? 'bg-emerald-500' : 'bg-rose-500')}`}>
                              <LucideIcon name={userAnsIdx === undefined ? "minus" : (isCorrect ? "check" : "x")} className="w-4 h-4 text-slate-950 font-bold" />
                            </div>

                            {/* Badges row */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <span className={`px-2.5 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold border ${bloom.color}`}>
                                {bloom.label}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold border ${diff.color}`}>
                                {diff.label}
                              </span>
                              {wasHintUsed && (
                                <span className="px-2.5 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  Hint Used (0.60x Credit)
                                </span>
                              )}
                            </div>

                            <p className="text-base sm:text-lg leading-relaxed text-white font-medium mb-4 pr-4">
                              <span className="font-bold text-cyan-400 mr-2">Q{qIdx + 1}.</span>{q.text}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                              {q.options.map((optText, origIdx) => {
                                let btnClass = "bg-white/5 border-white/10 text-white/60";
                                let iconName = null;
                                let iconColor = "";

                                if (origIdx === q.correct) {
                                  btnClass = "bg-emerald-500/20 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.2)] text-emerald-200 font-semibold";
                                  iconName = "check-circle-2";
                                  iconColor = "text-emerald-400";
                                } else if (origIdx === userAnsIdx && origIdx !== q.correct) {
                                  btnClass = "bg-rose-500/20 border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.2)] text-rose-200";
                                  iconName = "x-circle";
                                  iconColor = "text-rose-400";
                                }

                                return (
                                  <div key={origIdx} className={`relative overflow-hidden flex items-center p-3 rounded-xl border ${btnClass} text-sm`}>
                                    <span className="w-6 h-6 rounded-full flex items-center justify-center mr-2.5 bg-black/30 shrink-0 text-xs font-bold">{origIdx + 1}</span>
                                    <span className="leading-snug">{optText}</span>
                                    {iconName && <LucideIcon name={iconName} className={`w-4 h-4 ml-auto shrink-0 ${iconColor}`} />}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="bg-cyan-950/40 border border-cyan-500/20 p-4 rounded-xl flex flex-col gap-1.5 text-cyan-100 text-xs sm:text-sm">
                              <div className="flex items-center gap-2 font-bold text-cyan-300">
                                <LucideIcon name="lightbulb" className="w-4 h-4" />
                                <span>{ui.explanationLabel}</span>
                              </div>
                              <p className="leading-relaxed text-cyan-100/90">{q.explanation || q.hint}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 3. REVIEW SCREEN ---
  if (appState === 'review') {
    return (
      <div className="h-screen w-full text-white font-sans flex flex-col relative overflow-hidden">
        <DefaultAppBackground />
        {renderTopNav(true, handleBackClick, ui.back)}
        <SpringSlider scrollTargetRef={reviewScrollRef} />

        <div ref={reviewScrollRef} className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden slider-scroll-container pt-20 pb-16 px-4 sm:px-6 flex justify-center">
          <div className="w-full max-w-4xl bg-slate-900/80 border border-white/10 backdrop-blur-2xl p-6 sm:p-10 rounded-3xl h-fit mt-4 shadow-2xl">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-center mb-8 text-white">
              {ui.reviewTitle}
            </h2>

            <div className="space-y-6 mb-10">
              {sections.map((section, sIdx) => {
                const qList = activeQuizData ? (activeQuizData[section.id] || []) : section.questions;
                return (
                  <div key={section.id} className="bg-black/30 rounded-2xl p-5 sm:p-6 border border-white/5">
                    <h3 className="text-base sm:text-lg font-bold mb-4 text-white/90 flex items-center gap-3">
                      <LucideIcon name={section.icon} className="w-5 h-5 text-cyan-400" />
                      <span>{section.title}</span>
                      <span className="ml-auto text-xs font-mono text-cyan-400/70">{section.lo_id}</span>
                    </h3>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      {qList.map((q, qIdx) => {
                        const isAns = answers[q.id] !== undefined;
                        const wasHint = Boolean(hintUsed[q.id]);
                        return (
                          <button
                            key={q.id}
                            onClick={() => {
                              playSound('click');
                              setCurrentSectionIdx(sIdx);
                              setCurrentQuestionIdx(qIdx);
                              setAppState('playing');
                            }}
                            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl font-bold text-sm sm:text-base flex flex-col items-center justify-center transition-all hover:scale-105 border ${isAns ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(0,240,255,0.25)]' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
                          >
                            <span>{qIdx + 1}</span>
                            {wasHint && <span className="text-[8px] leading-none text-amber-400">💡</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => { playSound('click'); setAppState('playing'); }}
                className="px-6 sm:px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-base rounded-2xl transition-all border border-white/10 flex items-center justify-center gap-2"
              >
                <LucideIcon name="arrow-left" className="w-5 h-5" />
                {ui.backToQuiz}
              </button>
              <button
                onClick={handleFinalSubmitClick}
                className="px-8 sm:px-12 py-3.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-base rounded-2xl shadow-[0_0_30px_rgba(0,240,255,0.4)] transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <LucideIcon name="check-circle" className="w-5 h-5" />
                {ui.finalSubmit}
              </button>
            </div>
          </div>
        </div>
        {exitModalJSX}
        {submitModalJSX}
      </div>
    );
  }

  // --- 4. RICH RESULTS & ANALYTICS SCREEN ---
  if (appState === 'results') {
    const summary = resultsSummary || EduSDK.getCurrentSession() || {};
    const scorePct = summary.score_pct ?? 0;
    const masteryScore = summary.mastery_score ?? 0;
    const fluencyScore = summary.fluency_score ?? 0;
    const indScore = summary.independence_score ?? 100;
    const bloomBreakdown = summary.bloom_breakdown || {};
    const loBreakdown = summary.lo_breakdown || {};

    let gradeTitle = 'Mastered';
    let gradeBadgeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40';
    if (masteryScore < 60) {
      gradeTitle = 'Needs Focus';
      gradeBadgeClass = 'bg-rose-500/20 text-rose-300 border-rose-400/40';
    } else if (masteryScore < 80) {
      gradeTitle = 'Proficient';
      gradeBadgeClass = 'bg-amber-500/20 text-amber-300 border-amber-400/40';
    }

    return (
      <div className="h-screen w-full text-white font-sans flex flex-col relative overflow-hidden">
        <DefaultAppBackground />
        <GlowOrb color="bg-cyan-500" top="-10%" left="-10%" delay="0s" />
        <GlowOrb color="bg-purple-600" top="70%" left="70%" delay="2s" />

        {renderTopNav(false, returnToPlatform, ui.backToChapter)}
        <SpringSlider scrollTargetRef={resultsScrollRef} />

        <div ref={resultsScrollRef} className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden slider-scroll-container pt-20 pb-16 px-4 sm:px-6 flex justify-center">
          <div className="w-full max-w-4xl space-y-6 mt-4">

            {/* Main Scorecard Header */}
            <div className="bg-slate-900/80 border border-cyan-500/30 backdrop-blur-2xl p-8 sm:p-10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.6)] text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <LucideIcon name="award" className="w-48 h-48 text-cyan-400" />
              </div>

              <div className="inline-block mb-3 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest border border-cyan-400/40 bg-cyan-400/10 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.25)]">
                {ui.complete}
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold text-white mb-2">
                {ui.subtitle}
              </h1>
              <p className="text-sm sm:text-base text-white/60 mb-8">
                Autonomous Evidence Compiled • Mode: <span className="text-cyan-400 font-semibold">{mode === 'timed' ? 'Challenge Mode' : 'Zen Mode'}</span>
              </p>

              {/* 3 Core Metric KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {/* 1. Mastery Card */}
                <div className="bg-cyan-950/40 border border-cyan-400/40 rounded-2xl p-5 text-center shadow-[0_0_20px_rgba(0,240,255,0.15)] relative overflow-hidden">
                  <div className="text-xs uppercase tracking-wider text-cyan-300 font-bold mb-1 flex items-center justify-center gap-1.5">
                    <span>🧠</span> {ui.masteryLabel}
                  </div>
                  <div className="text-4xl sm:text-5xl font-black text-cyan-400 my-2 font-mono">
                    {masteryScore}%
                  </div>
                  <div className="text-[11px] text-white/50">MASTERY_V1 (Bloom & Diff Weighted)</div>
                </div>

                {/* 2. Fluency Card */}
                <div className="bg-amber-950/40 border border-amber-400/40 rounded-2xl p-5 text-center shadow-[0_0_20px_rgba(245,158,11,0.15)] relative overflow-hidden">
                  <div className="text-xs uppercase tracking-wider text-amber-300 font-bold mb-1 flex items-center justify-center gap-1.5">
                    <span>🏎️</span> {ui.fluencyLabel}
                  </div>
                  <div className="text-4xl sm:text-5xl font-black text-amber-400 my-2 font-mono">
                    {fluencyScore}%
                  </div>
                  <div className="text-[11px] text-white/50">FLUENCY_V1 (Speed + Pressure Recall)</div>
                </div>

                {/* 3. Independence Card */}
                <div className="bg-emerald-950/40 border border-emerald-400/40 rounded-2xl p-5 text-center shadow-[0_0_20px_rgba(16,185,129,0.15)] relative overflow-hidden">
                  <div className="text-xs uppercase tracking-wider text-emerald-300 font-bold mb-1 flex items-center justify-center gap-1.5">
                    <span>🎯</span> {ui.independenceLabel}
                  </div>
                  <div className="text-4xl sm:text-5xl font-black text-emerald-400 my-2 font-mono">
                    {indScore}%
                  </div>
                  <div className="text-[11px] text-white/50">INDEPENDENCE_V1 (First-Try Ratio)</div>
                </div>
              </div>

              {/* Raw Accuracy & Summary Sub-bar */}
              <div className="flex flex-wrap items-center justify-around gap-4 p-4 bg-black/40 border border-white/5 rounded-2xl text-xs sm:text-sm">
                <div>
                  <span className="text-white/50 mr-2">{ui.percentage}:</span>
                  <span className="font-bold text-white font-mono text-base">{scorePct}%</span>
                </div>
                <div>
                  <span className="text-white/50 mr-2">Correct Answers:</span>
                  <span className="font-bold text-white font-mono text-base">{summary.questions_correct ?? 0} / {totalQuestions}</span>
                </div>
                <div>
                  <span className="text-white/50 mr-2">Evaluation:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs border ${gradeBadgeClass}`}>
                    {gradeTitle}
                  </span>
                </div>
              </div>
            </div>

            {/* Cognitive Depth (Bloom Taxonomy Breakdown) */}
            <div className="bg-slate-900/80 border border-white/10 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl shadow-xl">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-6 flex items-center gap-2.5">
                <LucideIcon name="brain" className="w-5 h-5 text-cyan-400" />
                <span>{ui.bloomTitle}</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['remember', 'understand', 'apply', 'analyze'].map(bKey => {
                  const data = bloomBreakdown[bKey] || { total: 0, correct: 0, mastery: 0, weight: BLOOM_WEIGHTS[bKey] || 1.0 };
                  const badge = getBloomBadge(bKey);
                  return (
                    <div key={bKey} className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                      <div className="flex justify-between items-center mb-2">
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="font-mono text-sm font-bold text-cyan-400">{data.mastery || 0}% Mastery</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden my-2">
                        <div
                          className="bg-cyan-400 h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, data.mastery || 0)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-white/50">
                        <span>Accuracy: {data.correct}/{data.total} correct</span>
                        <span>{data.hints > 0 ? `${data.hints} hint used` : 'No hints'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Learning Objective (LO) Breakdown */}
            <div className="bg-slate-900/80 border border-white/10 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl shadow-xl">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-6 flex items-center gap-2.5">
                <LucideIcon name="target" className="w-5 h-5 text-cyan-400" />
                <span>{ui.loTitle}</span>
              </h3>

              <div className="space-y-4">
                {sections.map(sec => {
                  const loData = loBreakdown[sec.lo_id] || { total: 10, correct: 0, mastery: 0, accuracy: 0 };
                  const mScore = loData.mastery || 0;
                  let status = 'Mastered';
                  let statusClass = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
                  if (mScore < 60) {
                    status = 'Review Needed';
                    statusClass = 'text-rose-400 border-rose-500/30 bg-rose-500/10';
                  } else if (mScore < 80) {
                    status = 'Proficient';
                    statusClass = 'text-amber-400 border-amber-500/30 bg-amber-500/10';
                  }

                  return (
                    <div key={sec.id} className="bg-black/30 border border-white/5 rounded-2xl p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div>
                          <div className="text-xs font-mono text-cyan-400 font-semibold">{sec.lo_id}</div>
                          <div className="text-sm sm:text-base font-bold text-white">{sec.lo_title}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusClass}`}>
                            {status}
                          </span>
                          <span className="font-mono text-base font-black text-cyan-400">{mScore}%</span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-cyan-300 h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, mScore)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                onClick={() => { playSound('click'); setAppState('analysis'); }}
                className="flex-1 py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-[0_0_25px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2.5 text-sm sm:text-base"
              >
                <LucideIcon name="bar-chart-2" className="w-5 h-5" />
                <span>{ui.analyseBtn}</span>
              </button>

              <button
                onClick={() => { playSound('click'); setAppState('start'); }}
                className="flex-1 py-4 px-6 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2.5 text-sm sm:text-base"
              >
                <LucideIcon name="refresh-cw" className="w-5 h-5" />
                <span>{ui.retake}</span>
              </button>

              <button
                onClick={returnToPlatform}
                className="flex-1 py-4 px-6 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white/90 font-bold rounded-2xl transition-all flex items-center justify-center gap-2.5 text-sm sm:text-base"
              >
                <LucideIcon name="arrow-left" className="w-5 h-5" />
                <span>{ui.backToChapter}</span>
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // --- 5. PLAYING STATE ---
  if (!currentQuestion) return null;

  const selectedIdx = answers[currentQuestion.id];
  const wasHintUsed = Boolean(hintUsed[currentQuestion.id]);
  const bloomBadge = getBloomBadge(currentQuestion.bloom_level);
  const diffBadge = getDifficultyBadge(currentQuestion.difficulty);
  const qIconName = currentQuestion.icon || 'help-circle';

  const isLastQuestionInSection = currentQuestionIdx === questionsList.length - 1;
  const isLastSection = currentSectionIdx === sections.length - 1;

  let mainActionText = ui.nextQuestion;
  if (isLastQuestionInSection && !isLastSection) mainActionText = ui.submitSection;
  if (isLastQuestionInSection && isLastSection) mainActionText = ui.reviewBtn;

  return (
    <div className="min-h-screen w-full text-white font-sans flex justify-center p-4 sm:p-6 pt-24 pb-12 relative overflow-x-hidden">
      <DefaultAppBackground />
      <GlowOrb color="bg-cyan-500" top="10%" left="10%" delay="0s" />
      <GlowOrb color="bg-purple-600" top="60%" left="60%" delay="3s" />

      {renderTopNav(true, handleBackClick, ui.back)}
      <SpringSlider />

      <div className="relative z-10 w-full max-w-[1400px] h-auto flex flex-col lg:flex-row gap-6 mt-4">

        {/* Main Question Panel */}
        <div className="flex-1 flex flex-col bg-slate-900/80 border border-white/10 backdrop-blur-2xl p-6 sm:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none rounded-[2.5rem]"></div>

          {/* Top Bar: Section Selector & Question Navigator */}
          <div className="flex flex-col xl:flex-row justify-between items-center xl:items-start gap-4 mb-6 relative z-10">
            {/* Section Stepper */}
            <div className="flex items-center gap-1 bg-black/40 p-1.5 rounded-2xl border border-white/10 w-full sm:w-fit shrink-0 overflow-hidden">
              <button
                onClick={() => { playSound('click'); setCurrentSectionIdx(Math.max(0, currentSectionIdx - 1)); setCurrentQuestionIdx(0); }}
                disabled={currentSectionIdx === 0}
                className={`p-2 rounded-xl transition-colors shrink-0 ${currentSectionIdx === 0 ? 'text-white/20 cursor-not-allowed' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
              >
                <LucideIcon name="chevron-left" className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <div className="flex flex-col items-center px-2 sm:px-4 flex-1 sm:min-w-[220px] overflow-hidden">
                <span className="text-[10px] sm:text-xs text-cyan-400 font-bold tracking-widest uppercase mb-0.5">
                  Section {currentSectionIdx + 1} of {sections.length}
                </span>
                <h2 className="text-xs sm:text-base font-bold text-white text-center truncate w-full">
                  {currentSection.title}
                </h2>
              </div>
              <button
                onClick={() => { playSound('click'); setCurrentSectionIdx(Math.min(sections.length - 1, currentSectionIdx + 1)); setCurrentQuestionIdx(0); }}
                disabled={currentSectionIdx === sections.length - 1}
                className={`p-2 rounded-xl transition-colors shrink-0 ${currentSectionIdx === sections.length - 1 ? 'text-white/20 cursor-not-allowed' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
              >
                <LucideIcon name="chevron-right" className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Question Badges Navigator */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center p-1.5 shadow-lg w-full xl:w-fit max-w-full overflow-hidden">
              <button onClick={handlePrev} className="p-1.5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors shrink-0 hidden sm:block">
                <LucideIcon name="chevron-left" className="w-4 h-4" />
              </button>
              <div className="flex flex-wrap justify-center gap-1 px-2 flex-1">
                {questionsList.map((qItem, i) => {
                  const isCur = i === currentQuestionIdx;
                  const isAns = answers[qItem.id] !== undefined;
                  return (
                    <button
                      key={i}
                      onClick={() => { playSound('click'); setCurrentQuestionIdx(i); }}
                      className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-xs font-semibold transition-all ${isCur ? 'bg-cyan-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)]' : (isAns ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-white/40 hover:text-white hover:bg-white/5')}`}
                    >
                      Q{i + 1}
                    </button>
                  );
                })}
              </div>
              <button onClick={handleNextArrow} className="p-1.5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors shrink-0 hidden sm:block">
                <LucideIcon name="chevron-right" className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Question Metadata Header: Bloom, Difficulty, LO & Hint Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/5 relative z-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${bloomBadge.color}`}>
                🧠 {bloomBadge.label}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${diffBadge.color}`}>
                {diffBadge.label}
              </span>
              <span className="hidden sm:inline-block px-3 py-1 rounded-full text-xs font-mono bg-white/5 text-white/70 border border-white/10">
                {currentQuestion.lo_id}
              </span>
            </div>

            <button
              onClick={handleTriggerHint}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border transition-all ${wasHintUsed ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-white/5 hover:bg-amber-500/20 text-amber-200 border-amber-500/30 hover:border-amber-400 shadow-sm'}`}
            >
              <LucideIcon name="lightbulb" className="w-4 h-4 text-amber-400" />
              <span>{ui.hintBtn}</span>
              {wasHintUsed && <span className="text-[10px] bg-amber-500/30 px-1.5 py-0.2 rounded ml-1">Used</span>}
            </button>
          </div>

          {/* Question Body */}
          <div className="relative z-10 bg-black/30 border border-white/5 rounded-2xl sm:rounded-3xl p-5 sm:p-8 mb-6 flex-1 shadow-inner">
            <div className="flex flex-col-reverse md:flex-row justify-between items-center md:items-start gap-6">
              <div className="flex-1 w-full text-left">
                <p className="text-lg sm:text-2xl leading-relaxed text-white font-medium">
                  <span className="font-bold text-cyan-400 mr-2">Q{currentQuestionIdx + 1}.</span>
                  {currentQuestion.text}
                </p>

                {/* Persistent Hint Used Penalty Warning Pill */}
                {wasHintUsed && (
                  <div className="mt-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 inline-flex items-center gap-2 text-amber-300 text-xs font-semibold">
                    <LucideIcon name="alert-triangle" className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{ui.hintWarning}</span>
                  </div>
                )}
              </div>

              <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 bg-black/40 rounded-2xl flex items-center justify-center shrink-0 border border-white/5 relative overflow-hidden group shadow-lg">
                <LucideIcon name={qIconName} className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 text-cyan-300 opacity-80 group-hover:scale-110 group-hover:text-cyan-200 transition-all duration-500" />
              </div>
            </div>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 relative z-10 mb-8">
            {currentQuestion.shuffledIndices.map((originalIdx, renderIdx) => {
              const optText = currentQuestion.options[originalIdx];
              const isSelected = selectedIdx === originalIdx;
              return (
                <button
                  key={originalIdx}
                  onClick={() => handleSelectOption(originalIdx)}
                  className={`relative overflow-hidden group flex items-center p-4 sm:p-5 rounded-2xl text-left transition-all duration-200 border ${isSelected ? 'bg-cyan-950/50 border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.25)] ring-1 ring-cyan-400' : 'bg-black/30 border-white/10 hover:bg-white/5 hover:border-white/20'}`}
                >
                  <span className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mr-3.5 text-sm sm:text-base font-bold shrink-0 transition-colors ${isSelected ? 'bg-cyan-400 text-slate-950 shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'bg-white/10 text-white/60 group-hover:text-white'}`}>
                    {renderIdx + 1}
                  </span>
                  <span className={`text-sm sm:text-base leading-snug ${isSelected ? 'text-white font-semibold' : 'text-white/80'}`}>
                    {optText}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Main Action Footer */}
          <div className="flex justify-between items-center relative z-10 mt-auto pt-4 border-t border-white/5">
            <button
              onClick={handlePrev}
              disabled={currentSectionIdx === 0 && currentQuestionIdx === 0}
              className={`px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 border transition-colors ${currentSectionIdx === 0 && currentQuestionIdx === 0 ? 'text-white/20 border-white/5 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/10'}`}
            >
              <LucideIcon name="arrow-left" className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            <button
              onClick={handleMainAction}
              className="px-8 sm:px-10 py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 transition-all duration-300 bg-cyan-400 text-slate-950 shadow-[0_0_25px_rgba(0,240,255,0.35)] hover:bg-cyan-300 hover:shadow-[0_0_35px_rgba(0,240,255,0.55)] hover:-translate-y-0.5"
            >
              <span>{mainActionText}</span>
              <LucideIcon name={mainActionText === ui.reviewBtn ? "clipboard-check" : "arrow-right"} className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-[360px] flex flex-col gap-6 sticky top-24 self-start">
          {/* Sections List Card */}
          <div className="bg-slate-900/80 border border-white/10 backdrop-blur-2xl p-6 rounded-3xl shadow-xl">
            <h3 className="text-xs uppercase tracking-widest mb-4 font-bold text-white/50">{ui.sections}</h3>
            <div className="flex flex-col gap-2.5">
              {sections.map((section, idx) => {
                const isActive = currentSectionIdx === idx;
                const secQuestions = activeQuizData ? (activeQuizData[section.id] || []) : section.questions;
                const secAnswered = secQuestions.filter(q => answers[q.id] !== undefined).length;
                return (
                  <button
                    key={section.id}
                    onClick={() => { playSound('click'); setCurrentSectionIdx(idx); setCurrentQuestionIdx(0); }}
                    className={`flex items-center gap-3 p-3 rounded-2xl transition-all text-left border ${isActive ? 'bg-cyan-950/40 border-cyan-400/50 shadow-[0_0_15px_rgba(0,240,255,0.15)]' : 'bg-black/20 hover:bg-white/5 border-transparent'}`}
                  >
                    <div className={`p-2.5 rounded-xl ${isActive ? 'bg-cyan-400 text-slate-950 font-bold' : 'bg-black/30 text-white/60'}`}>
                      <LucideIcon name={section.icon} className="w-4 h-4" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-white/70'}`}>
                        {section.title}
                      </div>
                      <div className="text-[10px] text-white/40 flex items-center justify-between mt-0.5">
                        <span>{secAnswered} / {secQuestions.length} done</span>
                        <span>{section.lo_id}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progress Card */}
          <div className="bg-slate-900/80 border border-white/10 backdrop-blur-2xl p-6 rounded-3xl shadow-xl">
            <h3 className="text-base font-bold mb-4 text-white flex items-center gap-2">
              <LucideIcon name="activity" className="w-4 h-4 text-cyan-400" />
              <span>{ui.quizProgress}</span>
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-white/60">{ui.questionsDone}:</span>
                <span className="font-mono font-bold text-cyan-400 text-sm">{answeredCount} / {totalQuestions}</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(0,240,255,0.5)]"
                  style={{ width: `${Math.round((answeredCount / totalQuestions) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs sm:text-sm pt-2">
                <span className="text-white/60">{ui.timeMode}:</span>
                <span className="font-mono font-bold text-white text-xs">
                  {mode === 'timed' ? formatTime(timeRemaining) : ui.zenMode}
                </span>
              </div>
              <button
                onClick={() => { playSound('click'); setAppState('review'); }}
                className="w-full mt-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-xs font-bold flex items-center justify-center gap-2 text-white/90"
              >
                <LucideIcon name="clipboard-list" className="w-4 h-4 text-cyan-400" />
                <span>{ui.reviewBtn}</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {exitModalJSX}
      {submitModalJSX}
      {hintModalJSX}
    </div>
  );
}

export default function QuizView() {
  return (
    <div className="relative min-h-screen bg-[#060913] text-white">
      <App />
    </div>
  );
}
