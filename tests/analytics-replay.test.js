import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMastery, calculateFluency } from '../study-island/src/lib/analytics-sdk.js';

describe('Phase 10: Disaster Recovery — Deterministic Analytics Replayability', () => {

  // Mock sequence of raw, immutable events stored in analytics_events table
  const rawEvents = [
    {
      student_id: 'student_replay_01',
      session_id: 'sess_01',
      chapter_key: 'SCI6-CH10',
      event_type: 'quiz_complete',
      created_at: '2026-09-10T10:00:00Z',
      payload: {
        score_pct: 60,
        questions_total: 5,
        questions_correct: 3,
        time_spent_ms: 120000,
        checkpoints: [
          { question_id: 'q1', lo_id: 'LO01', difficulty: 'easy', bloom_level: 'remember', correct: true, hint_used: false, response_time_ms: 15000 },
          { question_id: 'q2', lo_id: 'LO01', difficulty: 'medium', bloom_level: 'understand', correct: true, hint_used: false, response_time_ms: 20000 },
          { question_id: 'q3', lo_id: 'LO02', difficulty: 'medium', bloom_level: 'apply', correct: false, hint_used: true, response_time_ms: 30000 },
          { question_id: 'q4', lo_id: 'LO03', difficulty: 'hard', bloom_level: 'analyze', correct: false, hint_used: false, response_time_ms: 35000 },
          { question_id: 'q5', lo_id: 'LO03', difficulty: 'hard', bloom_level: 'analyze', correct: true, hint_used: false, response_time_ms: 20000 }
        ]
      }
    },
    {
      student_id: 'student_replay_01',
      session_id: 'sess_02',
      chapter_key: 'SCI6-CH10',
      event_type: 'quiz_complete',
      created_at: '2026-09-11T14:30:00Z',
      payload: {
        score_pct: 100,
        questions_total: 5,
        questions_correct: 5,
        time_spent_ms: 80000,
        checkpoints: [
          { question_id: 'q1', lo_id: 'LO01', difficulty: 'easy', bloom_level: 'remember', correct: true, hint_used: false, response_time_ms: 10000 },
          { question_id: 'q2', lo_id: 'LO01', difficulty: 'medium', bloom_level: 'understand', correct: true, hint_used: false, response_time_ms: 12000 },
          { question_id: 'q3', lo_id: 'LO02', difficulty: 'medium', bloom_level: 'apply', correct: true, hint_used: false, response_time_ms: 18000 },
          { question_id: 'q4', lo_id: 'LO03', difficulty: 'hard', bloom_level: 'analyze', correct: true, hint_used: false, response_time_ms: 20000 },
          { question_id: 'q5', lo_id: 'LO03', difficulty: 'hard', bloom_level: 'analyze', correct: true, hint_used: false, response_time_ms: 20000 }
        ]
      }
    }
  ];

  function replayLearningSummary(events) {
    let totalAttempts = 0;
    let bestAccuracy = 0;
    let sumAccuracy = 0;
    let bestMastery = 0;
    let sumMastery = 0;
    let bestFluency = 0;
    const bestLoScores = {};

    for (const evt of events) {
      if (evt.event_type !== 'quiz_complete') continue;
      totalAttempts++;

      const p = evt.payload;
      const acc = p.questions_total > 0 ? p.questions_correct / p.questions_total : 0;
      const mast = calculateMastery(p.checkpoints);
      const flu = calculateFluency({
        checkpoints: p.checkpoints,
        is_challenge_mode: false,
        total_time_ms: p.time_spent_ms
      });

      bestAccuracy = Math.max(bestAccuracy, acc);
      sumAccuracy += acc;

      bestMastery = Math.max(bestMastery, mast);
      sumMastery += mast;

      bestFluency = Math.max(bestFluency, flu);

      // Aggregate LO scores
      for (const cp of p.checkpoints) {
        if (!cp.lo_id) continue;
        const currentScore = cp.correct ? 1.0 : 0.0;
        bestLoScores[cp.lo_id] = Math.max(bestLoScores[cp.lo_id] || 0, currentScore);
      }
    }

    return {
      total_attempts: totalAttempts,
      best_accuracy: parseFloat(bestAccuracy.toFixed(4)),
      average_accuracy: parseFloat((sumAccuracy / totalAttempts).toFixed(4)),
      best_mastery: parseFloat(bestMastery.toFixed(4)),
      average_mastery: parseFloat((sumMastery / totalAttempts).toFixed(4)),
      best_fluency: parseFloat(bestFluency.toFixed(4)),
      best_lo_scores: bestLoScores
    };
  }

  test('REPLAY-01: Replay algorithm deterministically calculates total attempts', () => {
    const summary = replayLearningSummary(rawEvents);
    assert.strictEqual(summary.total_attempts, 2);
  });

  test('REPLAY-02: Replay algorithm accurately derives best and average mastery from raw checkpoints', () => {
    const summary = replayLearningSummary(rawEvents);
    assert.ok(summary.best_mastery > summary.average_mastery, 'Best mastery must be >= average mastery');
    assert.ok(summary.best_mastery <= 1.0 && summary.best_mastery > 0.0);
    assert.strictEqual(summary.best_accuracy, 1.0);
    assert.strictEqual(summary.average_accuracy, 0.8); // (0.6 + 1.0) / 2 = 0.8
  });

  test('REPLAY-03: Replay algorithm achieves idempotent recomputation (multiple runs produce identical summaries)', () => {
    const runA = replayLearningSummary(rawEvents);
    const runB = replayLearningSummary(rawEvents);

    assert.deepStrictEqual(runA, runB, 'Successive replay runs must be bitwise identical');
  });

  test('REPLAY-04: Replay aggregates granular learning objective best scores', () => {
    const summary = replayLearningSummary(rawEvents);
    assert.strictEqual(summary.best_lo_scores['LO01'], 1.0);
    assert.strictEqual(summary.best_lo_scores['LO02'], 1.0);
    assert.strictEqual(summary.best_lo_scores['LO03'], 1.0);
  });
});
