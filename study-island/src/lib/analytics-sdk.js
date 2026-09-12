import { supabase } from '../supabase.js';

/**
 * EdTech Island - Telemetry & Analytics SDK (EduSDK)
 * Canonical Implementation of INDEPENDENCE_V1, MASTERY_V1, and FLUENCY_V1
 * 
 * Features:
 * - Write-Ahead Log (WAL) to localStorage ('edtech_telemetry_wal') to prevent data loss.
 * - Granular Learning Objective (LO) and Bloom Taxonomy mastery weighting.
 * - Reactive CustomEvent and iframe postMessage notification on session completion.
 * - Dual-write cloud ingestion into Supabase (analytics_events & test_submissions).
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

export function resolveTestUuid(actId) {
  if (isValidUuid(actId)) return actId;
  const str = String(actId || '').toLowerCase();
  if (str.includes('ch10') || str.includes('light') || str.includes('shadow') || str.includes('optics') || str.includes('chapter_10') || str.includes('sci6')) {
    return 'b6000000-0000-0000-0000-000000000001';
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0').repeat(4).slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// --- CANONICAL HEURISTIC WEIGHTS ---
export const INDEPENDENCE_WEIGHTS = {
  independent: 1.00,    // First try, zero hints
  self_corrected: 0.75, // Corrected on retry without hint
  assisted: 0.60,       // Correct with hint
  failed: 0.00          // Incorrect after retries
};

export const DIFFICULTY_WEIGHTS = {
  easy: 0.6,
  medium: 1.0,
  hard: 1.4
};

export const BLOOM_WEIGHTS = {
  remember: 0.5,
  understand: 0.7,
  apply: 1.0,
  analyze: 1.2,
  evaluate: 1.4,
  create: 1.5
};

const WAL_KEY = 'edtech_telemetry_wal';
const EVIDENCE_KEY = 'edtech_analytics_evidence';
const TEST_RESULTS_KEY = 'student_test_results';

/**
 * INDEPENDENCE_V1: Calculates independence factor based on hint and retry state
 * @param {Object} checkpoint 
 * @returns {number} Multiplier (1.00, 0.75, 0.60, or 0.00)
 */
export function calculateIndependence(checkpoint = {}) {
  const { correct, hint_used, retry_count } = checkpoint;
  if (!correct) return INDEPENDENCE_WEIGHTS.failed;
  if (hint_used) return INDEPENDENCE_WEIGHTS.assisted;
  if (retry_count && retry_count > 0) return INDEPENDENCE_WEIGHTS.self_corrected;
  return INDEPENDENCE_WEIGHTS.independent;
}

/**
 * MASTERY_V1: Difficulty and Bloom weighted mastery percentage
 * @param {Array<Object>} checkpoints 
 * @returns {number} Score from 0 to 100
 */
export function calculateMastery(checkpoints = []) {
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) return 0;

  let totalEarnedWeight = 0;
  let totalMaxWeight = 0;

  for (const cp of checkpoints) {
    const diffKey = (cp.difficulty || 'medium').toLowerCase();
    const bloomKey = (cp.bloom_level || 'apply').toLowerCase();

    const diffWeight = DIFFICULTY_WEIGHTS[diffKey] ?? 1.0;
    const bloomWeight = BLOOM_WEIGHTS[bloomKey] ?? 1.0;
    const itemMaxWeight = diffWeight * bloomWeight;

    const indMultiplier = calculateIndependence(cp);
    totalEarnedWeight += itemMaxWeight * indMultiplier;
    totalMaxWeight += itemMaxWeight;
  }

  return totalMaxWeight === 0 ? 0.0 : parseFloat((totalEarnedWeight / totalMaxWeight).toFixed(4));
}

/**
 * FLUENCY_V1: Speed ratio (35%) + Independence (40%) + Pressure Accuracy (25%)
 * @param {Object} params
 * @param {Array<Object>} params.checkpoints
 * @param {boolean} params.is_challenge_mode
 * @param {number} params.total_time_ms
 * @param {number} [params.time_limit_ms]
 * @returns {number} Score from 0 to 100
 */
export function calculateFluency({
  checkpoints = [],
  is_challenge_mode = false,
  total_time_ms = 0,
  time_limit_ms = 15 * 60 * 1000 // 15 mins default
}) {
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) return 0;

  let sumIndependence = 0;
  let sumResponseTimeMs = 0;
  let timingCount = 0;
  let correctCount = 0;

  for (const cp of checkpoints) {
    sumIndependence += calculateIndependence(cp);
    if (typeof cp.response_time_ms === 'number' && cp.response_time_ms > 0) {
      sumResponseTimeMs += cp.response_time_ms;
      timingCount++;
    }
    if (cp.correct) correctCount++;
  }

  // 1. Independence Component (40% weight)
  const sIndependence = sumIndependence / checkpoints.length;

  // 2. Speed Ratio Component (35% weight)
  // Target response latency per question is 30,000 ms (30s)
  const avgResponseTimeMs = timingCount > 0
    ? (sumResponseTimeMs / timingCount)
    : (total_time_ms > 0 ? (total_time_ms / checkpoints.length) : 30000);

  const targetLatencyMs = 30000;
  let sSpeed = 1.0;
  if (avgResponseTimeMs > targetLatencyMs) {
    // Graceful falloff from 30s to 90s (1.0 down to 0.1)
    sSpeed = Math.max(0.1, 1.0 - ((avgResponseTimeMs - targetLatencyMs) / 60000) * 0.9);
  } else {
    sSpeed = 1.0;
  }

  // 3. Pressure Accuracy Component (25% weight)
  let sPressure = correctCount / checkpoints.length;
  if (is_challenge_mode && time_limit_ms > 0 && total_time_ms > time_limit_ms) {
    sPressure *= 0.8; // Time expired penalty under pressure
  }

  const fluency = 0.35 * sSpeed + 0.40 * sIndependence + 0.25 * sPressure;
  return parseFloat(Math.max(0, Math.min(1, fluency)).toFixed(4));
}

/**
 * Calculates LO and Bloom breakdown metrics for dashboards & review screens
 * @param {Array<Object>} checkpoints 
 */
export function calculateBreakdowns(checkpoints = []) {
  const bloomBreakdown = {};
  const loBreakdown = {};

  let totalIndSum = 0;

  for (const cp of checkpoints) {
    const ind = calculateIndependence(cp);
    totalIndSum += ind;

    // Bloom group
    const bKey = (cp.bloom_level || 'apply').toLowerCase();
    if (!bloomBreakdown[bKey]) {
      bloomBreakdown[bKey] = { total: 0, correct: 0, hints: 0, checkpoints: [] };
    }
    bloomBreakdown[bKey].total++;
    if (cp.correct) bloomBreakdown[bKey].correct++;
    if (cp.hint_used) bloomBreakdown[bKey].hints++;
    bloomBreakdown[bKey].checkpoints.push(cp);

    // LO group
    const lKey = cp.lo_id || 'GENERAL';
    if (!loBreakdown[lKey]) {
      loBreakdown[lKey] = {
        lo_id: lKey,
        lo_title: cp.lo_title || 'General Science',
        total: 0,
        correct: 0,
        hints: 0,
        checkpoints: []
      };
    }
    loBreakdown[lKey].total++;
    if (cp.correct) loBreakdown[lKey].correct++;
    if (cp.hint_used) loBreakdown[lKey].hints++;
    loBreakdown[lKey].checkpoints.push(cp);
  }

  // Compute mastery per Bloom level
  for (const key of Object.keys(bloomBreakdown)) {
    bloomBreakdown[key].mastery = calculateMastery(bloomBreakdown[key].checkpoints);
    bloomBreakdown[key].weight = BLOOM_WEIGHTS[key] || 1.0;
  }

  // Compute mastery per LO
  for (const key of Object.keys(loBreakdown)) {
    loBreakdown[key].mastery = calculateMastery(loBreakdown[key].checkpoints);
    loBreakdown[key].accuracy = Math.round((loBreakdown[key].correct / loBreakdown[key].total) * 100);
  }

  const overallIndependence = checkpoints.length > 0
    ? parseFloat((totalIndSum / checkpoints.length).toFixed(4))
    : 1.0;

  return {
    bloomBreakdown,
    loBreakdown,
    overallIndependence
  };
}

/**
 * calculateMasteryImproved: Improvement Mode scoring
 * Awards partial credit when a student corrects a previously wrong answer.
 * Modelled on Gaurav-Handover prototype is_improve_combined logic.
 * @param {Array<Object>} checkpoints - Current attempt checkpoints
 * @param {Array<Object>} originalCheckpoints - Previous attempt checkpoints
 * @returns {number} Score from 0.0 to 1.0
 */
export function calculateMasteryImproved(checkpoints = [], originalCheckpoints = []) {
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) return 0.0;

  const origMap = {};
  for (const ocp of originalCheckpoints) {
    if (ocp && ocp.question_id != null) {
      origMap[String(ocp.question_id)] = ocp;
    }
  }

  let totalEarnedWeight = 0;
  let totalMaxWeight = 0;

  for (const cp of checkpoints) {
    const diffKey = (cp.difficulty || 'medium').toLowerCase();
    const bloomKey = (cp.bloom_level || 'apply').toLowerCase();
    const diffW = DIFFICULTY_WEIGHTS[diffKey] ?? 1.0;
    const bloomW = BLOOM_WEIGHTS[bloomKey] ?? 1.0;
    const itemBaseWeight = diffW * bloomW;

    const qId = String(cp.question_id);
    const isReattempted = qId in origMap;
    const origCorrect = isReattempted ? Boolean(origMap[qId].correct) : null;

    if (isReattempted) {
      // Improvement Mode: 1.5x maximum possible weight for reattempted questions
      const maxImproveWeight = 1.5 * itemBaseWeight;
      totalMaxWeight += maxImproveWeight;
      if (origCorrect && cp.correct) {
        totalEarnedWeight += 1.5 * itemBaseWeight; // Correct both times → consistency bonus (100% of max)
      } else if (!origCorrect && cp.correct) {
        totalEarnedWeight += 1.0 * itemBaseWeight; // Improved from wrong to right → solid growth credit (66.7% of max)
      } else if (origCorrect && !cp.correct) {
        totalEarnedWeight += 0.5 * itemBaseWeight; // Regression → partial preservation (33.3% of max)
      }
      // Both wrong → 0 earned (totalEarnedWeight unchanged)
    } else {
      totalMaxWeight += itemBaseWeight;
      const indMultiplier = calculateIndependence(cp);
      totalEarnedWeight += itemBaseWeight * indMultiplier;
    }
  }

  return totalMaxWeight === 0 ? 0.0 : parseFloat((totalEarnedWeight / totalMaxWeight).toFixed(4));
}

// ── DEEP FREEZE HELPER (with Circular Reference Protection) ─────────────
function deepFreeze(obj, seen = new WeakSet()) {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
  if (seen.has(obj)) return obj;
  seen.add(obj);

  Object.getOwnPropertyNames(obj).forEach(name => {
    const value = obj[name];
    if (value && typeof value === 'object') deepFreeze(value, seen);
  });
  return Object.freeze(obj);
}

// ── ACTIVITY INTEGRITY VALIDATOR ─────────────────────────────────────────
export function validateActivitySummary({ correctCount, totalQuestions, checkpoints }) {
  const errors = [];
  if (!Number.isFinite(totalQuestions) || totalQuestions <= 0) {
    errors.push(`totalQuestions must be a valid positive number, got: ${totalQuestions}`);
  }
  if (!Number.isFinite(correctCount) || correctCount < 0) {
    errors.push(`correctCount must be a valid non-negative number, got: ${correctCount}`);
  }
  if (Number.isFinite(totalQuestions) && Number.isFinite(correctCount) && correctCount > totalQuestions) {
    errors.push(`Integrity: correctCount (${correctCount}) cannot exceed totalQuestions (${totalQuestions})`);
  }
  if (Array.isArray(checkpoints) && checkpoints.length > 0) {
    const cpCorrect = checkpoints.filter(c => c.correct).length;
    if (Number.isFinite(correctCount) && Math.abs(cpCorrect - correctCount) > 1) {
      errors.push(`Integrity: checkpoint correctCount (${cpCorrect}) diverges from reported correctCount (${correctCount}) by more than 1`);
    }
    if (Number.isFinite(totalQuestions) && checkpoints.length > totalQuestions + 2) {
      errors.push(`Integrity: checkpoint count (${checkpoints.length}) greatly exceeds totalQuestions (${totalQuestions})`);
    }
  }
  return errors;
}

// --- SAFE STORAGE GETTER ---
function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (e) {}
  return null;
}

// --- WRITE-AHEAD LOG (WAL) HELPERS ---
function appendToWal(event) {
  try {
    const storage = getStorage();
    if (!storage) return;
    const raw = storage.getItem(WAL_KEY);
    const wal = raw ? JSON.parse(raw) : [];
    wal.push({
      wal_id: `wal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...event
    });
    storage.setItem(WAL_KEY, JSON.stringify(wal));
  } catch (e) {
    console.warn('[EduSDK] WAL append failed:', e);
  }
}

// --- EDUSDK CORE SINGLETON ---
class EduSDKClient {
  constructor() {
    this.currentSession = null;
  }

  /**
   * Auto-detect student identity from localStorage credentials or auth token.
   * Client-side UI display helper only — NEVER trusted for database writes or cloud ownership.
   */
  _detectStudentIdentity({ student_id, student_email, student_name } = {}) {
    let sId = isValidUuid(student_id) ? student_id : null;
    let sEmail = student_email || null;
    let sName = student_name || null;

    if (sId && sEmail && sName) {
      return { student_id: sId, student_email: sEmail, student_name: sName };
    }

    const storage = getStorage();
    if (storage) {
      // 1. Inspect Supabase auth token first (cryptographic session)
      try {
        const sbKey = 'sb-qmyrxvtbzlbnvzxypnus-auth-token';
        let raw = storage.getItem(sbKey);
        if (!raw) {
          for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i);
            if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
              raw = storage.getItem(k);
              break;
            }
          }
        }
        if (raw) {
          const tokenData = JSON.parse(raw);
          const user = tokenData?.user || tokenData?.currentSession?.user;
          if (user && isValidUuid(user.id)) {
            sId = sId || user.id;
            sEmail = sEmail || user.email || null;
            sName = sName || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || null;
          }
        }
      } catch (e) {}

      // 2. Client-side UI cache fallback (for display only - never used for cloud writes)
      if (!sId || !sEmail || !sName) {
        try {
          const raw = storage.getItem('edtech_student_user');
          if (raw) {
            const u = JSON.parse(raw);
            if (u && u.id !== 'guest_student') {
              if (isValidUuid(u.id)) sId = sId || u.id;
              sEmail = sEmail || u.email || null;
              sName = sName || u.name || u.full_name || null;
            }
          }
        } catch (e) {}
      }

      if (!sId || !sEmail || !sName) {
        try {
          const raw = storage.getItem('edtech_user');
          if (raw) {
            const u = JSON.parse(raw);
            if (u && u.id !== 'guest_student') {
              if (isValidUuid(u.id)) sId = sId || u.id;
              sEmail = sEmail || u.email || null;
              sName = sName || u.name || u.full_name || null;
            }
          }
        } catch (e) {}
      }
    }

    // Never return synthetic fallback email or non-UUID id
    if (sId && !isValidUuid(sId)) sId = null;
    if (sEmail && sEmail.includes('@edtechisland.internal')) sEmail = null;

    return {
      student_id: sId,
      student_email: sEmail,
      student_name: sName
    };
  }

  /**
   * Resolves verified authenticated identity directly from Supabase session.
   * Single source of truth for cloud database ownership and ingestion.
   */
  async resolveAuthenticatedIdentity() {
    if (!supabase?.auth?.getSession) return null;
    try {
      const { data: { session } = {} } = await supabase.auth.getSession();
      const user = session?.user;
      if (user?.id && isValidUuid(user.id)) {
        return {
          student_id: user.id,
          student_email: user.email || null,
          student_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Learner',
          is_authenticated: true
        };
      }
    } catch (e) {
      console.warn('[EduSDK] resolveAuthenticatedIdentity error:', e);
    }
    return null;
  }

  /**
   * Asynchronous background helper to detect user from active Supabase session
   */
  _asyncDetectSupabaseUser() {
    if (!supabase?.auth?.getSession) return;
    try {
      supabase.auth.getSession().then(({ data: { session } = {} } = {}) => {
        const user = session?.user;
        if (user && this.currentSession) {
          if (isValidUuid(user.id)) {
            this.currentSession.student_id = user.id;
            this.currentSession.student_email = user.email || null;
            this.currentSession.student_name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Learner';
            this.currentSession.is_authenticated = true;
          }
        }
      }).catch(() => {});
    } catch (e) {}
  }

  /**
   * Start a new learning activity session
   */
  start({
    activity_id = 'chapter_10_quiz',
    activity_type = 'chapter_quiz',
    total_questions = 0,
    is_challenge_mode = false,
    student_id = null,
    student_email = null,
    student_name = null,
    is_improvement_mode = false,
    original_attempt_data = null
  } = {}) {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const identity = this._detectStudentIdentity({ student_id, student_email, student_name });

    this.currentSession = {
      session_id: sessionId,
      activity_id,
      activity_type,
      total_questions,
      is_challenge_mode,
      student_id: identity.student_id,
      student_email: identity.student_email,
      student_name: identity.student_name,
      is_improvement_mode,
      original_attempt_data,
      start_time: Date.now(),
      checkpoints: [],
      status: 'active'
    };

    // If identity lacks credentials, resolve via Supabase auth in background
    if (!this.currentSession.student_id || !this.currentSession.student_email) {
      this._asyncDetectSupabaseUser();
    }

    appendToWal({
      event_type: 'start',
      session_id: sessionId,
      payload: {
        activity_id,
        activity_type,
        total_questions,
        is_challenge_mode,
        student_id: this.currentSession.student_id,
        student_email: this.currentSession.student_email,
        student_name: this.currentSession.student_name
      }
    });

    return { ...this.currentSession };
  }

  /**
   * Record question or step checkpoint
   */
  checkpoint({
    question_id,
    lo_id,
    lo_title,
    bloom_level = 'apply',
    difficulty = 'medium',
    correct = false,
    hint_used = false,
    retry_count = 0,
    response_time_ms = 0
  } = {}) {
    if (!this.currentSession) {
      this.start({ activity_id: 'auto_session', total_questions: 1 });
    }

    const checkpointRecord = {
      question_id: String(question_id),
      lo_id: lo_id || 'SCI6-CH10-GENERAL',
      lo_title: lo_title || 'General Optics',
      bloom_level: String(bloom_level).toLowerCase(),
      difficulty: String(difficulty).toLowerCase(),
      correct: Boolean(correct),
      hint_used: Boolean(hint_used),
      retry_count: Number(retry_count) || 0,
      response_time_ms: Number(response_time_ms) || 0,
      timestamp: new Date().toISOString()
    };

    // Calculate independence score for this checkpoint
    checkpointRecord.independence_score = calculateIndependence(checkpointRecord);

    // Update existing checkpoint if already answered or append
    const existingIdx = this.currentSession.checkpoints.findIndex(c => c.question_id === checkpointRecord.question_id);
    if (existingIdx >= 0) {
      this.currentSession.checkpoints[existingIdx] = checkpointRecord;
    } else {
      this.currentSession.checkpoints.push(checkpointRecord);
    }

    appendToWal({
      event_type: 'checkpoint',
      session_id: this.currentSession.session_id,
      payload: checkpointRecord
    });

    return Object.freeze({ ...checkpointRecord });
  }

  /**
   * Alias for checkpoint() to support alternate recordCheckpoint signature
   */
  recordCheckpoint(opts = {}) {
    return this.checkpoint({
      question_id: opts.question_id || opts.item_id || `q_${Date.now()}`,
      lo_id: opts.lo_id || opts.lo_code,
      lo_title: opts.lo_title,
      bloom_level: opts.bloom_level || 'apply',
      difficulty: opts.difficulty || 'medium',
      correct: opts.correct ?? false,
      hint_used: opts.hint_used ?? false,
      retry_count: opts.retry_count ?? 0,
      response_time_ms: opts.response_time_ms ?? 0
    });
  }

  /**
   * Builds a full calculation audit trail showing how every score was derived.
   * Modelled on Gaurav-Handover prototype's calculation_trace pattern.
   */
  _buildCalculationTrace({ checkpoints, calculatedMasteryRaw, calculatedFluencyRaw, overallIndependenceRaw, correctCount, totalQuestions, durationMs }) {
    const bloomTrace = {};
    const loTrace = {};

    for (const cp of checkpoints) {
      const bKey = (cp.bloom_level || 'apply').toLowerCase();
      const lKey = cp.lo_id || 'GENERAL';
      const diffW = DIFFICULTY_WEIGHTS[(cp.difficulty || 'medium').toLowerCase()] ?? 1.0;
      const bloomW = BLOOM_WEIGHTS[bKey] ?? 1.0;
      const indM = calculateIndependence(cp);

      if (!bloomTrace[bKey]) {
        bloomTrace[bKey] = { questions: 0, earnedWeight: 0, maxWeight: 0, bloomMultiplier: bloomW };
      }
      bloomTrace[bKey].questions++;
      bloomTrace[bKey].maxWeight = parseFloat((bloomTrace[bKey].maxWeight + diffW * bloomW).toFixed(4));
      bloomTrace[bKey].earnedWeight = parseFloat((bloomTrace[bKey].earnedWeight + diffW * bloomW * indM).toFixed(4));

      if (!loTrace[lKey]) {
        loTrace[lKey] = { lo_title: cp.lo_title || lKey, questions: 0, earnedWeight: 0, maxWeight: 0 };
      }
      loTrace[lKey].questions++;
      loTrace[lKey].maxWeight = parseFloat((loTrace[lKey].maxWeight + diffW * bloomW).toFixed(4));
      loTrace[lKey].earnedWeight = parseFloat((loTrace[lKey].earnedWeight + diffW * bloomW * indM).toFixed(4));
    }

    // Compute per-LO evidence values (0.0–1.0 weighted score, not raw accuracy)
    const loEvidenceScores = {};
    for (const [loId, loData] of Object.entries(loTrace)) {
      loEvidenceScores[loId] = loData.maxWeight > 0
        ? parseFloat((loData.earnedWeight / loData.maxWeight).toFixed(4))
        : 0.0;
    }

    return {
      formula_versions: { mastery: 'MASTERY_V1', fluency: 'FLUENCY_V1', independence: 'INDEPENDENCE_V1' },
      mastery: {
        formula: 'Σ(difficultyWeight × bloomWeight × independenceMultiplier) / Σ(difficultyWeight × bloomWeight)',
        result_raw: calculatedMasteryRaw,
        result_pct: Math.round(calculatedMasteryRaw * 100),
        bloom_trace: bloomTrace
      },
      fluency: {
        formula: '0.35 × speedRatio + 0.40 × independenceAvg + 0.25 × pressureAccuracy',
        result_raw: calculatedFluencyRaw,
        result_pct: Math.round(calculatedFluencyRaw * 100),
        avg_response_time_ms: checkpoints.length > 0 ? Math.round(durationMs / checkpoints.length) : 0
      },
      independence: {
        formula: 'Σ(independenceMultiplier) / questionCount',
        weights: { independent: 1.00, self_corrected: 0.75, assisted: 0.60, failed: 0.00 },
        result_raw: overallIndependenceRaw,
        result_pct: Math.round(overallIndependenceRaw * 100)
      },
      accuracy: {
        formula: 'correctCount / totalQuestions',
        correct: correctCount,
        total: totalQuestions,
        result_pct: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
      },
      lo_evidence_scores: loEvidenceScores
    };
  }

  /**
   * Complete session, persist evidence, and notify platform views
   */
  complete({
    score_pct,
    mastery_score,
    fluency_score,
    questions_total,
    questions_correct,
    time_spent_ms
  } = {}) {
    if (!this.currentSession) {
      console.warn('[EduSDK] complete() called without an active session.');
      this.start();
    }

    // Refresh student identity if still unassigned
    if (!this.currentSession.student_id || !this.currentSession.student_email || !this.currentSession.student_name) {
      const refreshedIdentity = this._detectStudentIdentity({
        student_id: this.currentSession.student_id,
        student_email: this.currentSession.student_email,
        student_name: this.currentSession.student_name
      });
      this.currentSession.student_id = refreshedIdentity.student_id;
      this.currentSession.student_email = refreshedIdentity.student_email;
      this.currentSession.student_name = refreshedIdentity.student_name;
    }

    const checkpoints = this.currentSession.checkpoints || [];
    const totalQuestions = questions_total ?? this.currentSession.total_questions ?? checkpoints.length;
    const correctCount = questions_correct ?? checkpoints.filter(c => c.correct).length;
    const durationMs = time_spent_ms ?? (Date.now() - this.currentSession.start_time);

    // Integrity validation
    this._integrityFailed = false;
    const integrityErrors = validateActivitySummary({
      correctCount,
      totalQuestions,
      checkpoints: this.currentSession.checkpoints
    });
    if (integrityErrors.length > 0) {
      console.error('[EduSDK] ⚠️ Integrity validation FAILED. Cloud flush will be skipped.', integrityErrors);
      this._integrityFailed = true;
    }

    // Compute metrics if not explicitly passed
    const calculatedScorePct = score_pct ?? (totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0);
    const originalCheckpoints = this.currentSession.is_improvement_mode
      ? (this.currentSession.original_attempt_data?.checkpoints ?? [])
      : [];

    const calculatedMasteryRaw = mastery_score != null
      ? (mastery_score > 1 ? mastery_score / 100 : mastery_score)
      : (this.currentSession.is_improvement_mode && originalCheckpoints.length > 0
          ? calculateMasteryImproved(checkpoints, originalCheckpoints)
          : calculateMastery(checkpoints));
    const calculatedMastery = Math.round(calculatedMasteryRaw * 100);

    const calculatedFluencyRaw = fluency_score != null
      ? (fluency_score > 1 ? fluency_score / 100 : fluency_score)
      : calculateFluency({
          checkpoints,
          is_challenge_mode: this.currentSession.is_challenge_mode,
          total_time_ms: durationMs
        });
    const calculatedFluency = Math.round(calculatedFluencyRaw * 100);

    const breakdowns = calculateBreakdowns(checkpoints);
    const overallIndependenceRaw = breakdowns.overallIndependence; // 0.0–1.0
    const overallIndependencePct = Math.round(overallIndependenceRaw * 100); // 0–100 for UI

    // Build calculation audit trail
    const calculationTrace = this._buildCalculationTrace({
      checkpoints,
      calculatedMasteryRaw,
      calculatedFluencyRaw,
      overallIndependenceRaw,
      correctCount,
      totalQuestions,
      durationMs
    });

    // Compute granular dictionary mapping LO codes (e.g. 'LO-01': scorePct)
    // loData.mastery is 0.0–1.0 (calculateMastery now returns canonical scale)
    // loScores is UI-facing (0–100), so convert at output boundary
    const loScores = {};
    for (const [loKey, loData] of Object.entries(breakdowns.loBreakdown || {})) {
      const score = typeof loData.mastery === 'number'
        ? Math.round(loData.mastery * 100)  // 0.0–1.0 → 0–100 for UI
        : (loData.total > 0 ? Math.round((loData.correct / loData.total) * 100) : 0);
      loScores[loKey] = score;

      const match = loKey.match(/LO-?0?(\d+)/i);
      if (match) {
        const normKey = `LO-${match[1].padStart(2, '0')}`;
        loScores[normKey] = score;
      }
    }

    // Harmonized 7-dimension object { mastery, fluency, application, practicalSkill, exploration, engagement, formalAchievement }
    const hasPracticalSkill = typeof this.currentSession.practical_skill === 'number' || (loScores['LO-04'] !== undefined && loScores['LO-04'] !== null);
    const practicalSkillValue = typeof this.currentSession.practical_skill === 'number'
      ? this.currentSession.practical_skill
      : (hasPracticalSkill ? (loScores['LO-04'] ?? 0) : null);
    const practicalSkillStatus = hasPracticalSkill ? 'recorded' : 'insufficient_evidence';

    const calculatedEngagement = (totalQuestions === 0 || checkpoints.length === 0)
      ? 0
      : Math.min(100, Math.round((correctCount / Math.max(1, totalQuestions)) * 40 + (durationMs > 30000 ? 50 : 35)));

    const dimensions = {
      mastery: calculatedMastery,
      fluency: calculatedFluency,
      application: Math.round((calculatedMastery * 0.7) + (overallIndependencePct * 0.3)),
      practicalSkill: practicalSkillValue,
      practicalSkillStatus,
      exploration: Math.round(Math.min(100, (overallIndependencePct * 0.5) + (calculatedFluency * 0.5))),
      engagement: calculatedEngagement,
      formalAchievement: calculatedScorePct,
      // Snake_case aliases for direct Progress.jsx compatibility
      practical_skill: practicalSkillValue,
      practical_skill_status: practicalSkillStatus,
      formal_achievement: calculatedScorePct
    };

    const sessionState = checkpoints.length === 0 ? 'insufficient_evidence' : 'completed';

    const summary = {
      activity_id: this.currentSession.activity_id,
      activity_type: this.currentSession.activity_type,
      session_id: this.currentSession.session_id,
      state: sessionState,
      status: sessionState,
      formula_version: '2.0.0',
      metric_version: '2.0.0',
      studentId: this.currentSession.student_id,
      studentEmail: this.currentSession.student_email,
      studentName: this.currentSession.student_name,
      student_id: this.currentSession.student_id,
      student_email: this.currentSession.student_email,
      student_name: this.currentSession.student_name,
      completed_at: new Date().toISOString(),
      score_pct: calculatedScorePct,
      score: calculatedScorePct,
      mastery_score: calculatedMastery,
      fluency_score: calculatedFluency,
      independence_score: overallIndependencePct,
      questions_total: totalQuestions,
      questions_correct: correctCount,
      time_spent_ms: durationMs,
      is_challenge_mode: this.currentSession.is_challenge_mode,
      bloom_breakdown: breakdowns.bloomBreakdown,
      lo_breakdown: breakdowns.loBreakdown,
      loScores,
      dimensions,
      checkpoints,
      quizTitle: 'Chapter 10: Light, Shadows & Optics Quiz',
      calculation_trace: calculationTrace,
      lo_evidence_scores: calculationTrace.lo_evidence_scores,
      internal_scores: {
        mastery: calculatedMasteryRaw,
        fluency: calculatedFluencyRaw,
        independence: overallIndependenceRaw,
        accuracy: totalQuestions > 0 ? parseFloat((correctCount / totalQuestions).toFixed(4)) : 0.0
      },
      attempt: {
        id: `att_${Date.now()}`,
        title: 'Chapter 10 Optics Mastery Assessment',
        lo: 'LO-01',
        score: calculatedScorePct,
        date: new Date().toISOString().split('T')[0],
        duration: `${Math.max(1, Math.round(durationMs / 60000))} mins`,
        status: checkpoints.length === 0 ? 'insufficient_evidence' : (calculatedMastery >= 75 ? 'Mastered' : (calculatedMastery >= 50 ? 'In Progress' : 'Struggling'))
      }
    };

    this.currentSession.status = sessionState;
    this.currentSession.state = sessionState;

    // 1. Write to WAL
    appendToWal({
      event_type: 'complete',
      session_id: this.currentSession.session_id,
      payload: summary
    });

    // 2. Persist to edtech_analytics_evidence
    try {
      const storage = getStorage();
      if (storage) {
        let evidenceStore = {};
        const raw = storage.getItem(EVIDENCE_KEY);
        if (raw) {
          try { evidenceStore = JSON.parse(raw); } catch (e) { evidenceStore = {}; }
        }
        if (Array.isArray(evidenceStore)) {
          evidenceStore.push(summary);
        } else {
          evidenceStore[summary.activity_id] = summary;
          evidenceStore['latest'] = summary;
          // Harmonize root properties so single-object consumers find dimensions/scores directly
          Object.assign(evidenceStore, summary);
        }
        storage.setItem(EVIDENCE_KEY, JSON.stringify(evidenceStore));
      }
    } catch (e) {
      console.warn('[EduSDK] Failed to save edtech_analytics_evidence:', e);
    }

    // 3. Persist to student_test_results for Student Portal / Progress View
    try {
      const storage = getStorage();
      if (storage) {
        let testStore = {};
        const raw = storage.getItem(TEST_RESULTS_KEY);
        if (raw) {
          try { testStore = JSON.parse(raw); } catch (e) { testStore = {}; }
        }

        const testEntry = {
          testId: summary.activity_id,
          testTitle: 'Chapter 10: Light, Shadows & Optics Quiz',
          score: summary.score_pct,
          percentage: summary.score_pct,
          grade: summary.score_pct >= 90 ? 'A+' : summary.score_pct >= 80 ? 'A' : summary.score_pct >= 60 ? 'B' : 'C',
          mastery: summary.mastery_score,
          fluency: summary.fluency_score,
          independence: summary.independence_score,
          correctCount: summary.questions_correct,
          totalGraded: summary.questions_total,
          submittedAt: summary.completed_at
        };

        if (Array.isArray(testStore)) {
          testStore.push(testEntry);
        } else {
          testStore[summary.activity_id] = testEntry;
        }
        storage.setItem(TEST_RESULTS_KEY, JSON.stringify(testStore));
      }
    } catch (e) {
      console.warn('[EduSDK] Failed to save student_test_results:', e);
    }

    // 4. Dispatch CustomEvent and postMessage
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('edtech:analytics:update', {
        detail: summary
      });
      window.dispatchEvent(event);

      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'edtech:analytics:update',
          detail: summary
        }, '*');
      }

      // BroadcastChannel notification for live multi-portal synchrony
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('edtech_platform_sync');
          bc.postMessage({
            type: 'QUIZ_SUBMITTED',
            studentName: summary.studentName || 'Learner',
            summary
          });
          bc.close();
        }
      } catch (e) {}
    }

    // 5. Asynchronous cloud flush function into Supabase
    if (!this._integrityFailed) {
      this.flushToCloud(summary).catch(err => {
        console.warn('[EduSDK] Background cloud flush error:', err);
      });
    } else {
      console.warn('[EduSDK] 🚫 Cloud flush skipped due to integrity validation failure.');
    }

    // Return a frozen copy for UI consumers — internal session state remains mutable
    return deepFreeze({ ...summary });
  }

  /**
   * Asynchronous cloud flush function:
   * Dual-writes session summary into Supabase analytics_events and test_submissions.
   * STRICT IDENTITY INTEGRITY:
   * 1. Resolves identity from authenticated Supabase session (auth.uid()).
   * 2. Overrides client-controlled or spoofed studentId.
   * 3. Never writes with student_id: null.
   * 4. Never uses synthetic fallback emails.
   * 5. Fails closed when unauthenticated, queuing in WAL with reason: 'unauthenticated_identity'.
   */
  async flushToCloud(summary) {
    if (!supabase) {
      console.warn('[EduSDK] Supabase client unavailable for cloud flush.');
      return null;
    }

    // Resolve verified student identity from authenticated Supabase session
    const verified = await this.resolveAuthenticatedIdentity();

    // FAIL-CLOSED OFFLINE QUEUEING:
    // If no authenticated identity exists, NEVER insert with null student_id or synthetic email.
    // Queue the event in WAL with status 'queued_unauthenticated' and explicit reason 'unauthenticated_identity'.
    if (!verified || !isValidUuid(verified.student_id)) {
      console.warn('[EduSDK] 🚫 Cloud flush deferred: Unauthenticated visitor or invalid session identity. Event queued in WAL (fail-closed).');

      const unauthPayload = {
        student_id: null,
        session_id: summary.session_id,
        event_type: 'quiz_complete',
        lesson_id: summary.activity_id,
        chapter_key: summary.activity_id,
        payload: summary,
        calculation_trace: summary.calculation_trace ?? null,
        lo_evidence_scores: summary.lo_evidence_scores ?? null,
        internal_scores: summary.internal_scores ?? null
      };

      appendToWal({
        event_type: 'flush_failure',
        target: 'analytics_events',
        session_id: summary.session_id,
        student_id: summary.studentId || summary.student_id || null, // preserve original attempted client ID for audit
        error: 'Unauthenticated session identity: cloud ingestion requires an authenticated Supabase session',
        reason: 'unauthenticated_identity',
        retry_count: 0,
        status: 'queued_unauthenticated',
        next_retry_at: new Date(Date.now() + 5000).toISOString(),
        payload: unauthPayload
      });

      return {
        analyticsEvent: null,
        testSubmission: null,
        status: 'queued_offline',
        reason: 'unauthenticated_identity'
      };
    }

    const studentId = verified.student_id;
    const studentEmail = verified.student_email; // Verified email only — zero synthetic emails
    const testId = resolveTestUuid(summary.activity_id);

    const results = { analyticsEvent: null, testSubmission: null };

    // 1. Dual-write to analytics_events
    try {
      const eventPayload = {
        student_id: studentId,
        session_id: summary.session_id,
        event_type: 'quiz_complete',
        lesson_id: summary.activity_id,
        chapter_key: summary.activity_id,
        payload: summary,
        // New Phase 2 columns (gracefully ignored if columns don't exist yet):
        calculation_trace: summary.calculation_trace ?? null,
        lo_evidence_scores: summary.lo_evidence_scores ?? null,
        internal_scores: summary.internal_scores ?? null
      };

      let { data: eventData, error: eventErr } = await supabase
        .from('analytics_events')
        .insert(eventPayload);

      // CRITICAL P0.4: Never retry with student_id: null (violates attribution integrity).
      // Queue failed event in WAL with verified student ID and error details for bounded backoff.
      if (eventErr) {
        console.warn('[EduSDK] analytics_events insert warning:', eventErr.message);
        appendToWal({
          event_type: 'flush_failure',
          target: 'analytics_events',
          session_id: summary.session_id,
          student_id: studentId,
          error: eventErr.message || String(eventErr),
          code: eventErr.code || null,
          retry_count: 0,
          status: 'pending',
          next_retry_at: new Date(Date.now() + 1000).toISOString(),
          payload: eventPayload
        });
      } else {
        results.analyticsEvent = eventData;
      }
    } catch (err) {
      console.warn('[EduSDK] analytics_events insert exception:', err);
    }

    // 2. Dual-write to test_submissions
    try {
      const subPayload = {
        student_id: studentId,
        test_id: testId,
        student_email: studentEmail,
        score: Number(summary.score_pct) || 0,
        answers: summary.checkpoints,
        submitted_at: summary.completed_at
      };

      let { data: subData, error: subErr } = await supabase
        .from('test_submissions')
        .insert(subPayload);

      // CRITICAL P0.4: Never retry with student_id: null (violates attribution integrity).
      // Queue failed event in WAL with verified student ID and error details for bounded backoff.
      if (subErr) {
        console.warn('[EduSDK] test_submissions insert warning:', subErr.message);
        appendToWal({
          event_type: 'flush_failure',
          target: 'test_submissions',
          session_id: summary.session_id,
          student_id: studentId,
          error: subErr.message || String(subErr),
          code: subErr.code || null,
          retry_count: 0,
          status: 'pending',
          next_retry_at: new Date(Date.now() + 1000).toISOString(),
          payload: subPayload
        });
      } else {
        results.testSubmission = subData;
      }
    } catch (err) {
      console.warn('[EduSDK] test_submissions insert exception:', err);
    }

    // Upsert learning_summaries (best score tracking per chapter)
    if (studentId) {
      try {
        results.learningSummary = await this._upsertLearningSummary(summary, studentId);
      } catch (lsErr) {
        console.warn('[EduSDK] Learning summary upsert failed (non-critical):', lsErr);
      }
    }

    return results;
  }

  /**
   * Upserts learning_summaries table — tracks best_accuracy, best_mastery,
   * average_accuracy, total_attempts per student per chapter.
   * Modelled on Gaurav-Handover LearningSummaryService.aggregate()
   */
  async _upsertLearningSummary(summary, studentId) {
    if (!supabase || !studentId) return null;

    const chapterId = summary.activity_id || 'UNKNOWN';
    const currentAccuracy = summary.internal_scores?.accuracy
      ?? (summary.score_pct != null ? summary.score_pct / 100 : 0);
    const currentMastery = summary.internal_scores?.mastery
      ?? (summary.mastery_score != null ? summary.mastery_score / 100 : 0);
    const currentFluency = summary.internal_scores?.fluency
      ?? (summary.fluency_score != null ? summary.fluency_score / 100 : 0);
    const currentTimeMs = summary.time_spent_ms ?? 0;
    const currentLoScores = summary.lo_evidence_scores ?? {};

    try {
      // 1. Read existing summary for this student + chapter
      const { data: existing, error: fetchErr } = await supabase
        .from('learning_summaries')
        .select('user_id, chapter_id, total_attempts, best_accuracy, average_accuracy, best_mastery, average_mastery, best_fluency, best_lo_scores, average_time_taken_ms')
        .eq('user_id', studentId)
        .eq('chapter_id', chapterId)
        .maybeSingle();

      if (fetchErr && fetchErr.code !== 'PGRST116') {
        console.warn('[EduSDK] learning_summaries fetch error:', fetchErr.message);
        return null;
      }

      // 2. Aggregate (deterministic — same formula as prototype LearningSummaryService)
      const prevAttempts = existing?.total_attempts ?? 0;
      const totalAttempts = prevAttempts + 1;

      const bestAccuracy = existing
        ? Math.max(existing.best_accuracy ?? 0, currentAccuracy)
        : currentAccuracy;

      const avgAccuracy = existing && prevAttempts > 0
        ? ((existing.average_accuracy * prevAttempts) + currentAccuracy) / totalAttempts
        : currentAccuracy;

      const bestMastery = existing
        ? Math.max(existing.best_mastery ?? 0, currentMastery)
        : currentMastery;

      const avgMastery = existing && prevAttempts > 0
        ? ((existing.average_mastery * prevAttempts) + currentMastery) / totalAttempts
        : currentMastery;

      const bestFluency = existing
        ? Math.max(existing.best_fluency ?? 0, currentFluency)
        : currentFluency;

      const existingBestLo = existing?.best_lo_scores ?? {};
      const bestLoScores = { ...existingBestLo };
      for (const [loId, score] of Object.entries(currentLoScores)) {
        bestLoScores[loId] = Math.max(Number(existingBestLo[loId] ?? 0), Number(score));
      }

      const avgTimeMs = existing && prevAttempts > 0
        ? Math.round(((existing.average_time_taken_ms ?? currentTimeMs) * prevAttempts + currentTimeMs) / totalAttempts)
        : currentTimeMs;

      const upsertPayload = {
        user_id: studentId,
        chapter_id: chapterId,
        activity_type: 'chapter_quiz',
        total_attempts: totalAttempts,
        latest_accuracy: parseFloat(currentAccuracy.toFixed(4)),
        best_accuracy: parseFloat(bestAccuracy.toFixed(4)),
        average_accuracy: parseFloat(avgAccuracy.toFixed(4)),
        latest_mastery: parseFloat(currentMastery.toFixed(4)),
        best_mastery: parseFloat(bestMastery.toFixed(4)),
        average_mastery: parseFloat(avgMastery.toFixed(4)),
        latest_fluency: parseFloat(currentFluency.toFixed(4)),
        best_fluency: parseFloat(bestFluency.toFixed(4)),
        best_lo_scores: bestLoScores,
        latest_lo_scores: currentLoScores,
        latest_time_taken_ms: currentTimeMs,
        average_time_taken_ms: avgTimeMs,
        last_activity_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('learning_summaries')
        .upsert(upsertPayload, { onConflict: 'user_id,chapter_id', ignoreDuplicates: false });

      if (error) {
        // Table may not exist yet (Phase 2 migrations pending) — degrade gracefully
        if (error.code === '42P01') {
          console.warn('[EduSDK] learning_summaries table not found — run Phase 2 migrations first.');
        } else {
          console.warn('[EduSDK] learning_summaries upsert error:', error.message);
        }
        return null;
      }
      return data;
    } catch (err) {
      console.warn('[EduSDK] _upsertLearningSummary exception (non-critical):', err);
      return null;
    }
  }

  /**
   * Record abandoned activity
   */
  abandon({ reason = 'user_exit' } = {}) {
    if (this.currentSession) {
      this.currentSession.status = 'abandoned';
      appendToWal({
        event_type: 'abandon',
        session_id: this.currentSession.session_id,
        payload: {
          reason,
          abandoned_at: new Date().toISOString(),
          checkpoints_count: (this.currentSession.checkpoints || []).length
        }
      });
    }
  }

  /**
   * WAL Inspector
   */
  getWal() {
    try {
      const storage = getStorage();
      if (!storage) return [];
      const raw = storage.getItem(WAL_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Clear WAL
   */
  clearWal() {
    try {
      const storage = getStorage();
      if (storage) {
        storage.removeItem(WAL_KEY);
      }
    } catch (e) {}
  }

  /**
   * Retries pending WAL flush failures with bounded exponential backoff.
   * Marks events as 'dead_letter' if retries exceed MAX_RETRIES (5).
   * Guarantees zero null-attribution rewrites and idempotent insertion keyed by session_id.
   */
  async retryPendingWalFlushes(injectedSupabase = supabase) {
    const storage = getStorage();
    if (!storage || !injectedSupabase) return { retried: 0, succeeded: 0, failed: 0, deadLettered: 0 };

    let wal = [];
    try {
      const raw = storage.getItem(WAL_KEY);
      wal = raw ? JSON.parse(raw) : [];
    } catch (_) {
      return { retried: 0, succeeded: 0, failed: 0, deadLettered: 0 };
    }

    const now = Date.now();
    const MAX_RETRIES = 5;
    let modified = false;
    let stats = { retried: 0, succeeded: 0, failed: 0, deadLettered: 0 };

    // Resolve current authenticated session from injected Supabase client if supported
    let currentAuthUser = null;
    if (injectedSupabase?.auth?.getSession) {
      try {
        const { data: { session } = {} } = await injectedSupabase.auth.getSession();
        if (session?.user?.id && isValidUuid(session.user.id)) {
          currentAuthUser = session.user;
        }
      } catch (_) {}
    }

    for (const item of wal) {
      if (item.event_type !== 'flush_failure' || item.status === 'dead_letter' || item.status === 'synced') {
        continue;
      }

      // If queued due to unauthenticated identity:
      if (item.status === 'queued_unauthenticated') {
        if (!currentAuthUser) {
          // Still unauthenticated — keep queued in WAL, do not attempt unauthorized insert
          continue;
        }
        // User has authenticated! Re-bind verified identity to payload and transition to pending
        item.student_id = currentAuthUser.id;
        if (item.payload) {
          item.payload.student_id = currentAuthUser.id;
          if (item.target === 'test_submissions' && currentAuthUser.email) {
            item.payload.student_email = currentAuthUser.email;
          }
        }
        item.status = 'pending';
        modified = true;
      }

      const nextRetry = item.next_retry_at ? new Date(item.next_retry_at).getTime() : 0;
      if (now < nextRetry) continue;

      // Fail-closed attribution check: Never insert if student_id is null or invalid
      if (!isValidUuid(item.payload?.student_id)) {
        if (currentAuthUser) {
          item.student_id = currentAuthUser.id;
          if (item.payload) item.payload.student_id = currentAuthUser.id;
          modified = true;
        } else {
          // Defer until authenticated session is available
          item.status = 'queued_unauthenticated';
          item.reason = 'unauthenticated_identity';
          modified = true;
          continue;
        }
      }

      stats.retried++;
      const table = item.target || 'analytics_events';

      try {
        // IDEMPOTENCY CHECK: Ensure retry keyed by session_id is strictly idempotent
        const tableQuery = injectedSupabase.from(table);
        let alreadySynced = false;

        if (table === 'analytics_events' && item.session_id && typeof tableQuery?.select === 'function') {
          try {
            const { data: existing } = await injectedSupabase
              .from('analytics_events')
              .select('id')
              .eq('session_id', item.session_id)
              .limit(1)
              .maybeSingle();
            if (existing) {
              alreadySynced = true;
            }
          } catch (_) {}
        } else if (table === 'test_submissions' && item.payload?.test_id && item.payload?.student_id && typeof tableQuery?.select === 'function') {
          try {
            const { data: existing } = await injectedSupabase
              .from('test_submissions')
              .select('id')
              .eq('test_id', item.payload.test_id)
              .eq('student_id', item.payload.student_id)
              .eq('submitted_at', item.payload.submitted_at)
              .limit(1)
              .maybeSingle();
            if (existing) {
              alreadySynced = true;
            }
          } catch (_) {}
        }

        if (alreadySynced) {
          item.status = 'synced';
          item.synced_at = new Date().toISOString();
          stats.succeeded++;
          modified = true;
          continue;
        }

        const { error } = await injectedSupabase.from(table).insert(item.payload);
        if (!error) {
          item.status = 'synced';
          item.synced_at = new Date().toISOString();
          stats.succeeded++;
          modified = true;
        } else {
          item.retry_count = (item.retry_count || 0) + 1;
          item.last_error = error.message;
          stats.failed++;
          if (item.retry_count >= MAX_RETRIES) {
            item.status = 'dead_letter';
            item.dead_letter_reason = 'max_retries_exceeded';
            item.dead_lettered_at = new Date().toISOString();
            stats.deadLettered++;
          } else {
            const backoffMs = Math.min(30000, 1000 * Math.pow(2, item.retry_count));
            item.next_retry_at = new Date(Date.now() + backoffMs).toISOString();
          }
          modified = true;
        }
      } catch (err) {
        item.retry_count = (item.retry_count || 0) + 1;
        item.last_error = err.message;
        stats.failed++;
        if (item.retry_count >= MAX_RETRIES) {
          item.status = 'dead_letter';
          item.dead_letter_reason = 'max_retries_exceeded';
          item.dead_lettered_at = new Date().toISOString();
          stats.deadLettered++;
        } else {
          const backoffMs = Math.min(30000, 1000 * Math.pow(2, item.retry_count));
          item.next_retry_at = new Date(Date.now() + backoffMs).toISOString();
        }
        modified = true;
      }
    }

    if (modified) {
      try {
        storage.setItem(WAL_KEY, JSON.stringify(wal));
      } catch (_) {}
    }

    return stats;
  }

  getCurrentSession() {
    return this.currentSession;
  }
}

export const EduSDK = new EduSDKClient();
export const flushToCloud = (summary) => EduSDK.flushToCloud(summary);
export { EduSDKClient as EduAnalyticsSDK, EduSDKClient };

// Attach to window for global runtime availability
if (typeof window !== 'undefined') {
  window.EduSDK = EduSDK;
}

export default EduSDK;
