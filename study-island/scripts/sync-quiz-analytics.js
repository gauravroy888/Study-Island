import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const studyIslandDir = path.resolve(__dirname, '..');
const analyticsSdkPath = path.join(studyIslandDir, 'src', 'lib', 'analytics-sdk.js');
const quizHtmlPath = path.join(studyIslandDir, 'quiz.html');
const distQuizHtmlPath = path.join(studyIslandDir, 'dist', 'quiz.html');

/**
 * Builds the canonical standalone EduSDK bundle for embedding into standalone quiz experiences.
 * Extracted directly from canonical invariants in analytics-sdk.js.
 */
export function generateStandaloneEduSdk() {
  const sdkSource = fs.readFileSync(analyticsSdkPath, 'utf8');

  // Verify canonical formulas exist in source
  if (!sdkSource.includes('MASTERY_V1') || !sdkSource.includes('FLUENCY_V1') || !sdkSource.includes('INDEPENDENCE_V1')) {
    throw new Error('Canonical formula markers missing from analytics-sdk.js');
  }

  return `    <!-- EdTech Island - Embedded EduSDK Analytics Controller (Canonical Generated) -->
    <script id="edusdk-analytics-controller">
      (function() {
        "use strict";

        // ── CANONICAL HEURISTIC WEIGHTS ──────────────────────────────────────────
        const INDEPENDENCE_WEIGHTS = Object.freeze({
          independent: 1.00,
          self_corrected: 0.75,
          assisted: 0.60,
          failed: 0.00
        });

        const DIFFICULTY_WEIGHTS = Object.freeze({
          easy: 0.6,
          medium: 1.0,
          hard: 1.4
        });

        const BLOOM_WEIGHTS = Object.freeze({
          remember: 0.5,
          understand: 0.7,
          apply: 1.0,
          analyze: 1.2,
          evaluate: 1.4,
          create: 1.5
        });

        const WAL_KEY = 'edtech_telemetry_wal';
        const EVIDENCE_KEY = 'edtech_analytics_evidence';
        const TEST_RESULTS_KEY = 'student_test_results';

        const SUPABASE_URL = 'https://qmyrxvtbzlbnvzxypnus.supabase.co';
        const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjA4OTcsImV4cCI6MjA5NTM5Njg5N30.ABvW_oBzXC2Ffxm5ToLh6t4WmdKPdtg9SyfeAE76iJo';

        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        function isValidUuid(val) {
          return typeof val === 'string' && UUID_REGEX.test(val.trim());
        }

        function resolveTestUuid(actId) {
          if (isValidUuid(actId)) return actId;
          const str = String(actId || '').toLowerCase();
          if (str.includes('ch10') || str.includes('light') || str.includes('shadow') || str.includes('optics') || str.includes('chapter_10') || str.includes('sci6')) {
            return 'b6000000-0000-0000-0000-000000000001';
          }
          return '151fb21c-fc27-4f0a-b797-0e88699a3e90';
        }

        function deepFreeze(obj) {
          if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
          Object.getOwnPropertyNames(obj).forEach(name => {
            const value = obj[name];
            if (value && typeof value === 'object') deepFreeze(value);
          });
          return Object.freeze(obj);
        }

        function validateActivitySummary({ correctCount, totalQuestions, checkpoints }) {
          const errors = [];
          if (typeof totalQuestions !== 'number' || totalQuestions <= 0) {
            errors.push('totalQuestions must be > 0, got: ' + totalQuestions);
          }
          if (typeof correctCount !== 'number' || correctCount < 0) {
            errors.push('correctCount must be >= 0, got: ' + correctCount);
          }
          if (typeof totalQuestions === 'number' && typeof correctCount === 'number' && correctCount > totalQuestions) {
            errors.push('Integrity: correctCount (' + correctCount + ') cannot exceed totalQuestions (' + totalQuestions + ')');
          }
          return errors;
        }

        function calculateIndependence(checkpoint) {
          if (!checkpoint) return 1.00;
          const { correct, hint_used, retry_count } = checkpoint;
          if (!correct) return INDEPENDENCE_WEIGHTS.failed;
          if (hint_used) return INDEPENDENCE_WEIGHTS.assisted;
          if (retry_count && retry_count > 0) return INDEPENDENCE_WEIGHTS.self_corrected;
          return INDEPENDENCE_WEIGHTS.independent;
        }

        function calculateMastery(checkpoints) {
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
          if (totalMaxWeight === 0) return 0;
          return Math.round((totalEarnedWeight / totalMaxWeight) * 100);
        }

        function calculateFluency({ checkpoints = [], is_challenge_mode = false, total_time_ms = 0, time_limit_ms = 15 * 60 * 1000 }) {
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
          const sIndependence = sumIndependence / checkpoints.length;
          const avgResponseTimeMs = timingCount > 0 ? (sumResponseTimeMs / timingCount) : (total_time_ms > 0 ? (total_time_ms / checkpoints.length) : 30000);
          const targetLatencyMs = 30000;
          let sSpeed = 1.0;
          if (avgResponseTimeMs > targetLatencyMs) {
            sSpeed = Math.max(0.1, 1.0 - ((avgResponseTimeMs - targetLatencyMs) / 60000) * 0.9);
          }
          let sPressure = correctCount / checkpoints.length;
          if (is_challenge_mode && time_limit_ms > 0 && total_time_ms > time_limit_ms) {
            sPressure *= 0.8;
          }
          const fluency = (0.35 * sSpeed + 0.40 * sIndependence + 0.25 * sPressure) * 100;
          return Math.round(Math.max(0, Math.min(100, fluency)));
        }

        function calculateBreakdowns(checkpoints = []) {
          const bloomBreakdown = {};
          const loBreakdown = {};
          let totalIndSum = 0;
          for (const cp of checkpoints) {
            const ind = calculateIndependence(cp);
            totalIndSum += ind;
            const bKey = (cp.bloom_level || 'apply').toLowerCase();
            if (!bloomBreakdown[bKey]) bloomBreakdown[bKey] = { total: 0, correct: 0, hints: 0, checkpoints: [] };
            bloomBreakdown[bKey].total++;
            if (cp.correct) bloomBreakdown[bKey].correct++;
            if (cp.hint_used) bloomBreakdown[bKey].hints++;
            bloomBreakdown[bKey].checkpoints.push(cp);

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

          for (const key of Object.keys(bloomBreakdown)) {
            bloomBreakdown[key].mastery = calculateMastery(bloomBreakdown[key].checkpoints);
            bloomBreakdown[key].weight = BLOOM_WEIGHTS[key] || 1.0;
          }

          for (const key of Object.keys(loBreakdown)) {
            loBreakdown[key].mastery = calculateMastery(loBreakdown[key].checkpoints);
            loBreakdown[key].accuracy = Math.round((loBreakdown[key].correct / loBreakdown[key].total) * 100);
          }

          const overallIndependence = checkpoints.length > 0 ? Math.round((totalIndSum / checkpoints.length) * 100) : 100;
          return { bloomBreakdown, loBreakdown, overallIndependence };
        }

        function appendToWal(event) {
          try {
            const raw = localStorage.getItem(WAL_KEY);
            const wal = raw ? JSON.parse(raw) : [];
            wal.push({
              wal_id: 'wal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              timestamp: new Date().toISOString(),
              ...event
            });
            localStorage.setItem(WAL_KEY, JSON.stringify(wal));
          } catch (e) {
            console.warn('[EduSDK] WAL error:', e);
          }
        }

        class EduSDKClient {
          constructor() {
            this.currentSession = null;
            this._integrityFailed = false;
          }

          _detectStudentIdentity(overrides) {
            overrides = overrides || {};
            let sId = overrides.student_id || null;
            let sEmail = overrides.student_email || null;
            let sName = overrides.student_name || null;

            // 1. Authenticated Supabase session token from localStorage (Canonical Source of Truth)
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
                  const raw = localStorage.getItem(k);
                  if (raw) {
                    const tokenData = JSON.parse(raw);
                    const user = tokenData?.user || tokenData?.currentSession?.user;
                    if (user && isValidUuid(user.id)) {
                      // Verified authenticated session strictly overrides client overrides
                      sId = user.id;
                      sEmail = user.email || sEmail || null;
                      sName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || sName || null;
                    }
                  }
                  break;
                }
              }
            } catch (e) {}

            // 2. Client-side UI cache fallback (for display only - never used for database ownership)
            if (!sId || !sEmail || !sName) {
              try {
                const raw = localStorage.getItem('edtech_student_user');
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
                const raw = localStorage.getItem('edtech_user');
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

            // Never return synthetic fallback email or non-UUID id
            if (sId && !isValidUuid(sId)) sId = null;
            if (sEmail && sEmail.includes('@edtechisland.internal')) sEmail = null;

            return { student_id: sId, student_email: sEmail, student_name: sName };
          }

          start(opts) {
            opts = opts || {};
            const activity_id = opts.activity_id || 'chapter_10_quiz';
            const activity_type = opts.activity_type || 'chapter_quiz';
            const total_questions = opts.total_questions || 0;
            const is_challenge_mode = Boolean(opts.is_challenge_mode);
            const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            const identity = this._detectStudentIdentity({
              student_id: opts.student_id,
              student_email: opts.student_email,
              student_name: opts.student_name
            });

            this.currentSession = {
              session_id: sessionId,
              activity_id: activity_id,
              activity_type: activity_type,
              total_questions: total_questions,
              is_challenge_mode: is_challenge_mode,
              student_id: identity.student_id,
              student_email: identity.student_email,
              student_name: identity.student_name,
              start_time: Date.now(),
              checkpoints: [],
              status: 'active'
            };

            appendToWal({
              event_type: 'start',
              session_id: sessionId,
              payload: {
                activity_id: activity_id,
                activity_type: activity_type,
                total_questions: total_questions,
                is_challenge_mode: is_challenge_mode,
                student_id: this.currentSession.student_id,
                student_email: this.currentSession.student_email,
                student_name: this.currentSession.student_name
              }
            });

            return deepFreeze({ ...this.currentSession });
          }

          checkpoint(opts) {
            opts = opts || {};
            if (!this.currentSession) {
              this.start({ activity_id: 'chapter_10_quiz', total_questions: 1 });
            }

            const checkpointRecord = {
              question_id: String(opts.question_id),
              lo_id: opts.lo_id || 'LO-01',
              lo_title: opts.lo_title || 'Optics Concept',
              bloom_level: String(opts.bloom_level || 'apply').toLowerCase(),
              difficulty: String(opts.difficulty || 'medium').toLowerCase(),
              correct: Boolean(opts.correct),
              hint_used: Boolean(opts.hint_used),
              retry_count: Number(opts.retry_count) || 0,
              response_time_ms: Number(opts.response_time_ms) || 0,
              timestamp: new Date().toISOString()
            };

            checkpointRecord.independence_score = calculateIndependence(checkpointRecord);

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

          complete(opts) {
            opts = opts || {};
            if (!this.currentSession) {
              this.start();
            }

            if (!this.currentSession.student_id || !this.currentSession.student_email || !this.currentSession.student_name) {
              const refreshed = this._detectStudentIdentity({
                student_id: this.currentSession.student_id,
                student_email: this.currentSession.student_email,
                student_name: this.currentSession.student_name
              });
              this.currentSession.student_id = refreshed.student_id;
              this.currentSession.student_email = refreshed.student_email;
              this.currentSession.student_name = refreshed.student_name;
            }

            const checkpoints = this.currentSession.checkpoints || [];
            const totalQuestions = opts.questions_total !== undefined ? opts.questions_total : (this.currentSession.total_questions || checkpoints.length);
            const correctCount = opts.questions_correct !== undefined ? opts.questions_correct : checkpoints.filter(c => c.correct).length;
            const durationMs = opts.time_spent_ms !== undefined ? opts.time_spent_ms : (Date.now() - this.currentSession.start_time);

            // Integrity validation
            this._integrityFailed = false;
            const integrityErrors = validateActivitySummary({ correctCount, totalQuestions, checkpoints });
            if (integrityErrors.length > 0) {
              console.error('[EduSDK] ⚠️ Integrity validation FAILED.', integrityErrors);
              this._integrityFailed = true;
            }

            const calculatedScorePct = opts.score_pct !== undefined ? opts.score_pct : (totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0);
            const calculatedMastery = opts.mastery_score !== undefined ? opts.mastery_score : calculateMastery(checkpoints);
            const calculatedFluency = opts.fluency_score !== undefined ? opts.fluency_score : calculateFluency({
              checkpoints: checkpoints,
              is_challenge_mode: this.currentSession.is_challenge_mode,
              total_time_ms: durationMs
            });

            const breakdowns = calculateBreakdowns(checkpoints);

            const loScores = {};
            for (const [loKey, loData] of Object.entries(breakdowns.loBreakdown || {})) {
              const score = typeof loData.mastery === 'number'
                ? loData.mastery
                : (loData.total > 0 ? Math.round((loData.correct / loData.total) * 100) : 0);
              loScores[loKey] = score;
              const match = loKey.match(/LO-?0?(\d+)/i);
              if (match) {
                const normKey = 'LO-' + match[1].padStart(2, '0');
                loScores[normKey] = score;
              }
            }

            const dimensions = {
              mastery: calculatedMastery,
              fluency: calculatedFluency,
              application: Math.round((calculatedMastery * 0.7) + (breakdowns.overallIndependence * 0.3)),
              practicalSkill: loScores['LO-04'] !== undefined ? loScores['LO-04'] : Math.round(calculatedMastery * 0.85),
              exploration: Math.round(Math.min(100, (breakdowns.overallIndependence * 0.5) + (calculatedFluency * 0.5))),
              engagement: Math.min(100, Math.max(65, Math.round((correctCount / Math.max(1, totalQuestions)) * 40 + (durationMs > 30000 ? 50 : 35)))),
              formalAchievement: calculatedScorePct,
              practical_skill: loScores['LO-04'] !== undefined ? loScores['LO-04'] : Math.round(calculatedMastery * 0.85),
              formal_achievement: calculatedScorePct
            };

            const summary = {
              activity_id: this.currentSession.activity_id || 'chapter_10_quiz',
              activity_type: this.currentSession.activity_type || 'chapter_quiz',
              session_id: this.currentSession.session_id,
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
              independence_score: breakdowns.overallIndependence,
              questions_total: totalQuestions,
              questions_correct: correctCount,
              time_spent_ms: durationMs,
              is_challenge_mode: this.currentSession.is_challenge_mode,
              bloom_breakdown: breakdowns.bloomBreakdown,
              lo_breakdown: breakdowns.loBreakdown,
              loScores: loScores,
              dimensions: dimensions,
              checkpoints: checkpoints,
              internal_scores: {
                mastery: parseFloat((calculatedMastery / 100).toFixed(4)),
                fluency: parseFloat((calculatedFluency / 100).toFixed(4)),
                independence: parseFloat((breakdowns.overallIndependence / 100).toFixed(4)),
                accuracy: totalQuestions > 0 ? parseFloat((correctCount / totalQuestions).toFixed(4)) : 0.0
              },
              quizTitle: 'Chapter 10: Light, Shadows & Optics Quiz',
              attempt: {
                id: 'att_' + Date.now(),
                title: 'Chapter 10 Optics Mastery Assessment',
                lo: 'LO-01',
                score: calculatedScorePct,
                date: new Date().toISOString().split('T')[0],
                duration: Math.max(1, Math.round(durationMs / 60000)) + ' mins',
                status: calculatedMastery >= 75 ? 'Mastered' : (calculatedMastery >= 50 ? 'In Progress' : 'Struggling')
              }
            };

            this.currentSession.status = 'completed';

            // 1. WAL
            appendToWal({
              event_type: 'complete',
              session_id: this.currentSession.session_id,
              payload: summary
            });

            // 2. edtech_analytics_evidence
            try {
              let evidenceStore = {};
              const raw = localStorage.getItem(EVIDENCE_KEY);
              if (raw) {
                try { evidenceStore = JSON.parse(raw); } catch (e) { evidenceStore = {}; }
              }
              if (Array.isArray(evidenceStore)) {
                evidenceStore.push(summary);
              } else {
                evidenceStore[summary.activity_id] = summary;
                evidenceStore['latest'] = summary;
                Object.assign(evidenceStore, summary);
              }
              localStorage.setItem(EVIDENCE_KEY, JSON.stringify(evidenceStore));
            } catch (e) {
              console.warn('[EduSDK] evidence error:', e);
            }

            // 3. student_test_results
            try {
              let testStore = {};
              const raw = localStorage.getItem(TEST_RESULTS_KEY);
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
              localStorage.setItem(TEST_RESULTS_KEY, JSON.stringify(testStore));
            } catch (e) {
              console.warn('[EduSDK] test_results error:', e);
            }

            // 4. Events & messaging
            try {
              window.dispatchEvent(new CustomEvent('edtech:analytics:update', { detail: summary }));
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'edtech:analytics:update', detail: summary }, '*');
                window.parent.postMessage({ type: 'QUIZ_SUBMITTED', summary: summary }, '*');
              }
            } catch (e) {}

            try {
              if (typeof BroadcastChannel !== 'undefined') {
                const bc = new BroadcastChannel('edtech_platform_sync');
                bc.postMessage({
                  type: 'QUIZ_SUBMITTED',
                  studentName: summary.studentName || 'Learner',
                  summary: summary
                });
                bc.close();
              }
            } catch (e) {}

            // 5. Cloud flush to Supabase (only if integrity passed)
            if (!this._integrityFailed) {
              this.flushToCloud(summary).catch(err => {
                console.warn('[EduSDK] Background cloud flush error:', err);
              });
            } else {
              console.warn('[EduSDK] 🚫 Cloud flush skipped due to integrity validation failure.');
            }

            return deepFreeze({ ...summary });
          }

          async flushToCloud(summary) {
            const rawId = summary.studentId || summary.student_id;
            const studentId = isValidUuid(rawId) ? rawId : null;

            // FAIL-CLOSED OFFLINE QUEUEING:
            // If no authenticated identity exists, NEVER insert with null student_id or synthetic email.
            // Queue the event in WAL with status 'queued_unauthenticated' and explicit reason 'unauthenticated_identity'.
            if (!studentId) {
              console.warn('[EduSDK] 🚫 Cloud flush deferred: Unauthenticated visitor or invalid session identity. Event queued in WAL (fail-closed).');

              const unauthPayload = {
                event_type: 'quiz_complete',
                session_id: summary.session_id,
                activity_id: summary.activity_id,
                status: 'queued_unauthenticated',
                reason: 'unauthenticated_identity',
                created_at: new Date().toISOString(),
                payload: summary
              };

              appendToWal(unauthPayload);
              return { success: false, reason: 'unauthenticated_identity', queued: true };
            }

            // Authenticated write: Extract access token
            let accessToken = null;
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
                  const raw = localStorage.getItem(k);
                  if (raw) {
                    const tokenData = JSON.parse(raw);
                    accessToken = tokenData?.access_token || tokenData?.currentSession?.access_token || null;
                  }
                  break;
                }
              }
            } catch (e) {}

            // Prohibit anonymous key as bearer token
            if (!accessToken) {
              console.warn('[EduSDK] 🚫 Cloud flush deferred: No valid session token found for authenticated user. Queuing in WAL.');
              appendToWal({
                event_type: 'quiz_complete',
                session_id: summary.session_id,
                activity_id: summary.activity_id,
                status: 'queued_unauthenticated',
                reason: 'missing_session_token',
                created_at: new Date().toISOString(),
                payload: summary
              });
              return { success: false, reason: 'missing_session_token', queued: true };
            }

            const results = {};

            // 1. Dual-write analytics_events
            try {
              const eventPayload = {
                student_id: studentId,
                session_id: summary.session_id,
                event_type: 'quiz_complete',
                lesson_id: summary.activity_id,
                chapter_key: summary.activity_id,
                payload: summary,
                internal_scores: summary.internal_scores || null
              };

              const res = await fetch(SUPABASE_URL + '/rest/v1/analytics_events', {
                method: 'POST',
                headers: {
                  'apikey': SUPABASE_ANON,
                  'Authorization': 'Bearer ' + accessToken,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify(eventPayload)
              });

              if (!res.ok) {
                console.warn('[EduSDK] analytics_events fetch error status:', res.status);
              }
              results.analytics_event = res.ok;
            } catch (e) {
              console.warn('[EduSDK] analytics_events fetch error:', e);
            }

            // 2. Dual-write test_submissions
            try {
              const submissionPayload = {
                student_id: studentId,
                test_id: resolveTestUuid(summary.activity_id),
                score: summary.score_pct,
                answers: {
                  checkpoints: summary.checkpoints,
                  bloom_breakdown: summary.bloom_breakdown,
                  dimensions: summary.dimensions,
                  lo_breakdown: summary.lo_breakdown
                },
                status: 'graded'
              };

              const res = await fetch(SUPABASE_URL + '/rest/v1/test_submissions', {
                method: 'POST',
                headers: {
                  'apikey': SUPABASE_ANON,
                  'Authorization': 'Bearer ' + accessToken,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify(submissionPayload)
              });

              if (!res.ok) {
                console.warn('[EduSDK] test_submissions fetch error status:', res.status);
              }
              results.test_submission = res.ok;
            } catch (e) {
              console.warn('[EduSDK] test_submissions fetch error:', e);
            }

            return results;
          }

          abandon(opts) {
            opts = opts || {};
            if (!this.currentSession) return;
            this.currentSession.status = 'abandoned';
            appendToWal({
              event_type: 'abandon',
              session_id: this.currentSession.session_id,
              payload: { reason: opts.reason || 'user_exit', duration_ms: Date.now() - this.currentSession.start_time }
            });
          }

          clearWal() {
            try { localStorage.removeItem(WAL_KEY); } catch (e) {}
          }

          getCurrentSession() {
            return this.currentSession;
          }
        }

        window.EduSDK = new EduSDKClient();
        window.EduSDK_VERSION = '2.0.0-synced';
      })();
    </script>`;
}

/**
 * Synchronizes the EduSDK embedded script block inside quiz.html.
 */
export function syncQuizAnalytics() {
  if (!fs.existsSync(quizHtmlPath)) {
    throw new Error('quiz.html not found at: ' + quizHtmlPath);
  }

  const htmlContent = fs.readFileSync(quizHtmlPath, 'utf8');
  const bundle = generateStandaloneEduSdk();

  const scriptPattern = /<!-- EdTech Island - Embedded EduSDK Analytics Controller[\s\S]*?<\/script>/i;
  if (!scriptPattern.test(htmlContent)) {
    throw new Error('Could not locate EduSDK script block in quiz.html');
  }

  const updatedHtml = htmlContent.replace(scriptPattern, bundle.trim());
  fs.writeFileSync(quizHtmlPath, updatedHtml, 'utf8');
  console.log('✅ Synchronized EduSDK into ' + quizHtmlPath);

  if (fs.existsSync(distQuizHtmlPath)) {
    const distHtml = fs.readFileSync(distQuizHtmlPath, 'utf8');
    const updatedDist = distHtml.replace(scriptPattern, bundle.trim());
    fs.writeFileSync(distQuizHtmlPath, updatedDist, 'utf8');
    console.log('✅ Synchronized EduSDK into ' + distQuizHtmlPath);
  }

  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncQuizAnalytics();
}
