import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

import { validateActivitySummary, calculateMastery, calculateFluency } from '../study-island/src/lib/analytics-sdk.js';
import { getMetrics, increment, resetMetrics } from '../server/metrics.js';

describe('Phase 7: Analytics Pipeline Monitoring & Telemetry Immutability', () => {

  test('PIPE-01: Activity integrity validator rejects negative question counts', () => {
    const errors = validateActivitySummary({
      correctCount: 5,
      totalQuestions: -1,
      checkpoints: []
    });

    assert.ok(errors.length > 0, 'Validator must reject negative totalQuestions');
    assert.match(errors[0], /totalQuestions must be a valid positive number/i);
  });

  test('PIPE-02: Activity integrity validator rejects correctCount exceeding totalQuestions', () => {
    const errors = validateActivitySummary({
      correctCount: 15,
      totalQuestions: 10,
      checkpoints: []
    });

    assert.ok(errors.length > 0, 'Validator must reject correctCount > totalQuestions');
    assert.match(errors[0], /cannot exceed totalQuestions/i);
  });

  test('PIPE-03: Activity integrity validator detects checkpoints diverging from reported correctCount', () => {
    const checkpoints = [
      { question_id: 'q1', correct: true },
      { question_id: 'q2', correct: false },
      { question_id: 'q3', correct: false }
    ];

    // Reported 5 correct, but checkpoints only show 1 correct (divergence > 1)
    const errors = validateActivitySummary({
      correctCount: 5,
      totalQuestions: 5,
      checkpoints
    });

    assert.ok(errors.length > 0, 'Validator must detect checkpoint divergence');
    assert.match(errors[0], /checkpoint correctCount.*diverges/i);
  });

  test('PIPE-04: Activity integrity validator accepts mathematically consistent summaries', () => {
    const checkpoints = [
      { question_id: 'q1', correct: true },
      { question_id: 'q2', correct: true },
      { question_id: 'q3', correct: false }
    ];

    const errors = validateActivitySummary({
      correctCount: 2,
      totalQuestions: 3,
      checkpoints
    });

    assert.strictEqual(errors.length, 0, 'Consistent summary must produce zero validation errors');
  });

  test('PIPE-05: Scoring formulas return bounded 0.0 to 1.0 floats', () => {
    const checkpoints = [
      { question_id: 'q1', difficulty: 'hard', bloom_level: 'analyze', correct: true, hint_used: false, response_time_ms: 5000 },
      { question_id: 'q2', difficulty: 'easy', bloom_level: 'remember', correct: true, hint_used: true, response_time_ms: 12000 },
      { question_id: 'q3', difficulty: 'medium', bloom_level: 'apply', correct: false, hint_used: false, response_time_ms: 25000 }
    ];

    const mastery = calculateMastery(checkpoints);
    assert.ok(typeof mastery === 'number');
    assert.ok(mastery >= 0.0 && mastery <= 1.0, `Mastery must be in [0.0, 1.0], got ${mastery}`);

    const fluency = calculateFluency({
      checkpoints,
      is_challenge_mode: false,
      total_time_ms: 42000
    });
    assert.ok(typeof fluency === 'number');
    assert.ok(fluency >= 0.0 && fluency <= 1.0, `Fluency must be in [0.0, 1.0], got ${fluency}`);
  });

  test('PIPE-06: Server metrics track analytics pipeline telemetry events', () => {
    resetMetrics();

    increment('analytics_events_received_total', 5);
    increment('analytics_events_rejected_total', 1);
    increment('analytics_ingestion_failures_total', 1);

    const m = getMetrics();
    assert.strictEqual(m.analytics_events_received_total, 5);
    assert.strictEqual(m.analytics_events_rejected_total, 1);
    assert.strictEqual(m.analytics_ingestion_failures_total, 1);
  });

  test('PIPE-07: Static audit confirms zero student_id: null fallback retries', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');

    const sdkPath = resolve(process.cwd(), 'study-island/src/lib/analytics-sdk.js');
    const quizPath = resolve(process.cwd(), 'study-island/quiz.html');

    const sdkContent = readFileSync(sdkPath, 'utf8');
    const quizContent = readFileSync(quizPath, 'utf8');

    // Neither file should contain object payload rewriting student_id to null
    assert.doesNotMatch(sdkContent, /\{\s*\.\.\.[^,]+,\s*student_id:\s*null\s*\}/);
    assert.doesNotMatch(quizContent, /\{\s*\.\.\.[^,]+,\s*student_id:\s*null\s*\}/);
  });

  test('PIPE-08: EduSDK retryPendingWalFlushes handles exponential backoff and dead-letter state', async () => {
    const { EduSDK } = await import('../study-island/src/lib/analytics-sdk.js');

    // Create a mock localStorage in memory
    const store = new Map();
    const mockStorage = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    };

    const originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = mockStorage;

    try {
      EduSDK.clearWal();

      // Seed a failed event in WAL with original student_id
      const initialWal = [{
        wal_id: 'wal_test_1',
        event_type: 'flush_failure',
        target: 'analytics_events',
        session_id: 'sess-123',
        student_id: 'a0000000-0000-0000-0000-000000000001',
        error: 'Network timeout',
        retry_count: 0,
        status: 'pending',
        next_retry_at: new Date(Date.now() - 1000).toISOString(),
        payload: {
          student_id: 'a0000000-0000-0000-0000-000000000001',
          session_id: 'sess-123',
          event_type: 'quiz_complete'
        }
      }];

      mockStorage.setItem('edtech_telemetry_wal', JSON.stringify(initialWal));

      // Mock Supabase that fails insertion
      const mockSupabaseFailing = {
        from: () => ({
          insert: async () => ({ error: { message: 'Database connection failed' } })
        })
      };

      // 1. First retry -> retry_count becomes 1
      const res1 = await EduSDK.retryPendingWalFlushes(mockSupabaseFailing);
      assert.strictEqual(res1.retried, 1);
      assert.strictEqual(res1.failed, 1);

      let wal = EduSDK.getWal();
      assert.strictEqual(wal[0].retry_count, 1);
      assert.strictEqual(wal[0].student_id, 'a0000000-0000-0000-0000-000000000001');

      // Set retry count to 4 and past retry time
      wal[0].retry_count = 4;
      wal[0].next_retry_at = new Date(Date.now() - 1000).toISOString();
      mockStorage.setItem('edtech_telemetry_wal', JSON.stringify(wal));

      // 2. 5th retry failure -> transitions to dead_letter state
      const res2 = await EduSDK.retryPendingWalFlushes(mockSupabaseFailing);
      assert.strictEqual(res2.deadLettered, 1);

      wal = EduSDK.getWal();
      assert.strictEqual(wal[0].status, 'dead_letter');
      assert.strictEqual(wal[0].dead_letter_reason, 'max_retries_exceeded');
      assert.strictEqual(wal[0].payload.student_id, 'a0000000-0000-0000-0000-000000000001', 'Attribution must be intact');
    } finally {
      globalThis.localStorage = originalLocalStorage;
    }
  });

  test('PIPE-09: flushToCloud fails closed when unauthenticated, queuing to WAL without writing to Supabase', async () => {
    const { EduSDK } = await import('../study-island/src/lib/analytics-sdk.js');
    const { supabase } = await import('../study-island/src/supabase.js');

    const store = new Map();
    const mockStorage = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    };
    const originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = mockStorage;

    let dbInsertCalled = false;
    const originalFrom = supabase.from;
    supabase.from = () => ({
      insert: async () => {
        dbInsertCalled = true;
        return { data: null, error: null };
      }
    });

    const originalGetSession = supabase.auth.getSession;
    supabase.auth.getSession = async () => ({ data: { session: null } });

    try {
      EduSDK.clearWal();
      const testSummary = {
        activity_id: 'SCI6-CH10',
        session_id: 'sess-unauth-test-99',
        score_pct: 85,
        studentId: null
      };

      const result = await EduSDK.flushToCloud(testSummary);

      assert.strictEqual(dbInsertCalled, false, 'Database insert must NOT be called when unauthenticated');
      assert.strictEqual(result.status, 'queued_offline');
      assert.strictEqual(result.reason, 'unauthenticated_identity');

      const wal = EduSDK.getWal();
      const queuedEvent = wal.find(w => w.session_id === 'sess-unauth-test-99' && w.status === 'queued_unauthenticated');
      assert.ok(queuedEvent, 'Event must be queued in WAL with status queued_unauthenticated');
      assert.strictEqual(queuedEvent.reason, 'unauthenticated_identity');
      assert.strictEqual(queuedEvent.payload.student_id, null, 'Unauthenticated queued event must not invent fake student_id');
    } finally {
      supabase.from = originalFrom;
      supabase.auth.getSession = originalGetSession;
      globalThis.localStorage = originalLocalStorage;
    }
  });

  test('PIPE-10: flushToCloud overrides client-controlled student_id with authenticated Supabase user ID', async () => {
    const { EduSDK } = await import('../study-island/src/lib/analytics-sdk.js');
    const { supabase } = await import('../study-island/src/supabase.js');

    const store = new Map();
    const mockStorage = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    };
    const originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = mockStorage;

    const verifiedAuthUid = 'a1000000-0000-4000-8000-000000000001';
    let insertedStudentId = null;

    const originalFrom = supabase.from;
    supabase.from = (table) => {
      if (table === 'analytics_events') {
        return {
          insert: async (payload) => {
            insertedStudentId = payload.student_id;
            return { data: payload, error: null };
          }
        };
      }
      return {
        insert: async () => ({ data: null, error: null }),
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
        upsert: async () => ({ data: null, error: null })
      };
    };

    const originalGetSession = supabase.auth.getSession;
    supabase.auth.getSession = async () => ({
      data: { session: { user: { id: verifiedAuthUid, email: 'verified@school.edu' } } }
    });

    try {
      EduSDK.clearWal();
      const testSummary = {
        activity_id: 'SCI6-CH10',
        session_id: 'sess-auth-override-01',
        score_pct: 90,
        studentId: 'b2000000-0000-4000-8000-000000000099' // spoofed client ID
      };

      await EduSDK.flushToCloud(testSummary);

      assert.strictEqual(insertedStudentId, verifiedAuthUid, 'Insert must use verified auth UID, ignoring spoofed client ID');
    } finally {
      supabase.from = originalFrom;
      supabase.auth.getSession = originalGetSession;
      globalThis.localStorage = originalLocalStorage;
    }
  });

  test('PIPE-11: retryPendingWalFlushes is strictly idempotent keyed by session_id', async () => {
    const { EduSDK } = await import('../study-island/src/lib/analytics-sdk.js');

    const store = new Map();
    const mockStorage = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    };
    const originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = mockStorage;

    try {
      EduSDK.clearWal();

      const initialWal = [{
        wal_id: 'wal_idempotency_1',
        event_type: 'flush_failure',
        target: 'analytics_events',
        session_id: 'sess-already-in-db-456',
        student_id: 'a0000000-0000-0000-0000-000000000001',
        retry_count: 0,
        status: 'pending',
        next_retry_at: new Date(Date.now() - 1000).toISOString(),
        payload: {
          student_id: 'a0000000-0000-0000-0000-000000000001',
          session_id: 'sess-already-in-db-456',
          event_type: 'quiz_complete'
        }
      }];

      mockStorage.setItem('edtech_telemetry_wal', JSON.stringify(initialWal));

      let insertCalled = false;
      const mockSupabaseWithExistingRecord = {
        from: (table) => ({
          select: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: { id: 'existing-event-uuid-99' }, error: null })
              })
            })
          }),
          insert: async () => {
            insertCalled = true;
            return { error: null };
          }
        })
      };

      const res = await EduSDK.retryPendingWalFlushes(mockSupabaseWithExistingRecord);

      assert.strictEqual(insertCalled, false, 'Idempotency must prevent duplicate INSERT for existing session_id');
      assert.strictEqual(res.succeeded, 1, 'Existing event must be counted as successfully synced');

      const wal = EduSDK.getWal();
      assert.strictEqual(wal[0].status, 'synced');
    } finally {
      globalThis.localStorage = originalLocalStorage;
    }
  });

  test('PIPE-12: Zero synthetic student@edtechisland.internal emails across codebase', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');

    const sdkPath = resolve(process.cwd(), 'study-island/src/lib/analytics-sdk.js');
    const ariaStudyPath = resolve(process.cwd(), 'study-island/src/hooks/useAriaSession.js');
    const ariaStudentPath = resolve(process.cwd(), 'portals/student/src/hooks/useAriaSession.js');
    const quizHtmlPath = resolve(process.cwd(), 'study-island/quiz.html');

    const sdkContent = readFileSync(sdkPath, 'utf8');
    const ariaStudyContent = readFileSync(ariaStudyPath, 'utf8');
    const ariaStudentContent = readFileSync(ariaStudentPath, 'utf8');
    const quizHtmlContent = readFileSync(quizHtmlPath, 'utf8');

    assert.doesNotMatch(sdkContent, /student@edtechisland\.internal/);
    assert.doesNotMatch(ariaStudyContent, /student@edtechisland\.internal/);
    assert.doesNotMatch(ariaStudentContent, /student@edtechisland\.internal/);
    assert.doesNotMatch(quizHtmlContent, /student@edtechisland\.internal/);
  });
});


