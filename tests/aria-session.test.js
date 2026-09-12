import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Setup browser globals for Node test environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) ?? null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

// Import hook functions
const {
  getStudentId,
  getSession,
  patchSession,
  trackTopic,
  incrementMessages,
  buildSessionContext,
  refreshSessionSummary
} = await import('../portals/student/src/hooks/useAriaSession.js');

describe('P1.3: Aria Session Authentication & Identity Tests', () => {

  beforeEach(() => {
    mockStorage.clear();
  });

  test('getStudentId returns null when no authenticated student is stored', () => {
    const id = getStudentId();
    assert.strictEqual(id, null, 'Unauthenticated visitor must not be given a "guest_student" cloud identity');
  });

  test('getStudentId returns verified ID from edtech_student_user', () => {
    mockStorage.set('edtech_student_user', JSON.stringify({
      id: 'student-valid-uuid-001',
      name: 'Alex Johnson',
      email: 'alex@school.edu'
    }));

    const id = getStudentId();
    assert.strictEqual(id, 'student-valid-uuid-001');
  });

  test('getStudentId returns verified ID from edtech_user fallback', () => {
    mockStorage.set('edtech_user', JSON.stringify({
      id: 'student-valid-uuid-002',
      email: 'student2@school.edu'
    }));

    const id = getStudentId();
    assert.strictEqual(id, 'student-valid-uuid-002');
  });

  test('getSession creates and persists a valid session schema', () => {
    const s = getSession();
    assert.ok(s.date);
    assert.deepStrictEqual(s.topics, []);
    assert.strictEqual(s.summary, '');
    assert.strictEqual(s.messageCount, 0);

    const stored = JSON.parse(mockStorage.get('aria_session'));
    assert.strictEqual(stored.date, s.date);
  });

  test('trackTopic and incrementMessages update local session state correctly', () => {
    trackTopic('Rectilinear Propagation');
    trackTopic('Ray Geometry');
    incrementMessages();
    incrementMessages();

    const s = getSession();
    assert.deepStrictEqual(s.topics, ['Rectilinear Propagation', 'Ray Geometry']);
    assert.strictEqual(s.messageCount, 2);
  });

  test('buildSessionContext includes summary and topics', () => {
    patchSession({
      summary: 'Student mastered rectilinear propagation.',
      topics: ['Optics', 'Reflection']
    });

    const ctx = buildSessionContext();
    assert.match(ctx, /Student mastered rectilinear propagation/);
  });

  test('refreshSessionSummary handles unauthenticated state gracefully without network failure', async () => {
    let networkCallMade = false;
    globalThis.fetch = async () => {
      networkCallMade = true;
      return { ok: false, status: 401 };
    };

    const messages = [
      { role: 'user', text: 'Why is the sky blue?' },
      { role: 'assistant', text: 'Because of Rayleigh scattering.' },
      { role: 'user', text: 'Can light bounce off mirrors?' },
      { role: 'assistant', text: 'Yes, that is rectilinear reflection.' }
    ];

    await refreshSessionSummary(messages);

    // Should NOT make an unauthorized network call when unauthenticated
    assert.strictEqual(networkCallMade, false);

    // Should set heuristic summary
    const s = getSession();
    assert.match(s.summary, /Explored:/);
  });

  test('refreshSessionSummary attaches Authorization header when token is present', async () => {
    let capturedAuthHeader = null;
    globalThis.fetch = async (url, opts) => {
      capturedAuthHeader = opts.headers?.Authorization;
      return {
        ok: true,
        status: 200,
        json: async () => ({ text: 'Summary: Learned about optical reflection.' })
      };
    };

    // Mock supabase session on window
    const { supabase } = await import('../portals/student/src/supabase.js');
    const originalGetSession = supabase.auth.getSession;
    supabase.auth.getSession = async () => ({
      data: { session: { access_token: 'valid_test_access_token_12345' } }
    });

    try {
      const messages = [
        { role: 'user', text: 'How do mirrors work?' },
        { role: 'assistant', text: 'They reflect parallel light rays.' },
        { role: 'user', text: 'What is lateral inversion?' },
        { role: 'assistant', text: 'Left and right appear flipped.' }
      ];

      await refreshSessionSummary(messages);

      assert.strictEqual(capturedAuthHeader, 'Bearer valid_test_access_token_12345');
      const s = getSession();
      assert.strictEqual(s.summary, 'Summary: Learned about optical reflection.');
    } finally {
      supabase.auth.getSession = originalGetSession;
    }
  });

  test('getVerifiedStudentId resolves verified identity from Supabase session', async () => {
    const { getVerifiedStudentId } = await import('../portals/student/src/hooks/useAriaSession.js');
    const { supabase } = await import('../portals/student/src/supabase.js');

    const originalGetSession = supabase.auth.getSession;
    supabase.auth.getSession = async () => ({
      data: { session: { user: { id: 'a1000000-0000-4000-8000-000000000001', email: 'verified@school.edu' } } }
    });

    try {
      const id = await getVerifiedStudentId();
      assert.strictEqual(id, 'a1000000-0000-4000-8000-000000000001');
    } finally {
      supabase.auth.getSession = originalGetSession;
    }
  });

  test('getVerifiedStudentId fails closed and rejects spoofed localStorage identity', async () => {
    const { getVerifiedStudentId } = await import('../portals/student/src/hooks/useAriaSession.js');
    const { supabase } = await import('../portals/student/src/supabase.js');

    // Attacker modifies localStorage to impersonate a victim student
    mockStorage.set('edtech_student_user', JSON.stringify({
      id: 'victim-student-id-999',
      name: 'Victim Student'
    }));

    // But Supabase session is unauthenticated (or null)
    const originalGetSession = supabase.auth.getSession;
    supabase.auth.getSession = async () => ({ data: { session: null } });

    try {
      const id = await getVerifiedStudentId();
      assert.strictEqual(id, null, 'Unauthenticated visitor must NOT be able to claim victim ID via localStorage');
    } finally {
      supabase.auth.getSession = originalGetSession;
    }
  });

  test('Local session keys are namespaced per user to prevent cross-account leakage', async () => {
    const { getSession, getSessionKey } = await import('../portals/student/src/hooks/useAriaSession.js');

    const keyUser1 = getSessionKey('user-uuid-111');
    const keyUser2 = getSessionKey('user-uuid-222');
    assert.strictEqual(keyUser1, 'aria_session_user-uuid-111');
    assert.strictEqual(keyUser2, 'aria_session_user-uuid-222');

    // User 1 session
    const s1 = getSession('user-uuid-111');
    s1.topics.push('Optics');
    mockStorage.set(keyUser1, JSON.stringify(s1));

    // User 2 session must be clean and independent
    const s2 = getSession('user-uuid-222');
    assert.deepStrictEqual(s2.topics, [], 'User 2 must not see User 1 topics');
  });

  test('Cloud sync fails closed: never writes to aria_ai_sessions when unauthenticated', async () => {
    const { patchSession } = await import('../portals/student/src/hooks/useAriaSession.js');
    const { supabase } = await import('../portals/student/src/supabase.js');

    let upsertCalled = false;
    const originalFrom = supabase.from;
    supabase.from = (table) => {
      if (table === 'aria_ai_sessions') {
        return {
          upsert: async () => {
            upsertCalled = true;
            return { data: null, error: null };
          }
        };
      }
      return originalFrom.call(supabase, table);
    };

    const originalGetSession = supabase.auth.getSession;
    supabase.auth.getSession = async () => ({ data: { session: null } });

    try {
      patchSession({ summary: 'Attempted unauthenticated session sync' });
      // Wait for any async microtasks
      await new Promise(r => setTimeout(r, 20));
      assert.strictEqual(upsertCalled, false, 'Unauthenticated session must never trigger cloud upsert');
    } finally {
      supabase.from = originalFrom;
      supabase.auth.getSession = originalGetSession;
    }
  });

  test('Cloud sync uses authenticated Supabase identity, ignoring spoofed student ID in localStorage', async () => {
    const { patchSession } = await import('../portals/student/src/hooks/useAriaSession.js');
    const { supabase } = await import('../portals/student/src/supabase.js');

    // Attacker tries to inject spoofed student ID
    mockStorage.set('edtech_student_user', JSON.stringify({
      id: 'b2000000-0000-4000-8000-000000000099'
    }));

    let upsertPayload = null;
    const originalFrom = supabase.from;
    supabase.from = (table) => {
      if (table === 'aria_ai_sessions') {
        return {
          upsert: async (payload) => {
            upsertPayload = payload;
            return { data: null, error: null };
          }
        };
      }
      return originalFrom.call(supabase, table);
    };

    // Real authenticated session has authentic ID
    const authenticUid = 'a1000000-0000-4000-8000-000000000001';
    const originalGetSession = supabase.auth.getSession;
    supabase.auth.getSession = async () => ({
      data: { session: { user: { id: authenticUid } } }
    });

    try {
      patchSession({ summary: 'Verified session sync test' });
      await new Promise(r => setTimeout(r, 20));
      assert.ok(upsertPayload, 'Upsert must be called for authenticated user');
      assert.strictEqual(upsertPayload.student_id, authenticUid, 'Cloud sync must write only to authenticated UID');
      assert.notStrictEqual(upsertPayload.student_id, 'b2000000-0000-4000-8000-000000000099', 'Spoofed ID must be ignored');
    } finally {
      supabase.from = originalFrom;
      supabase.auth.getSession = originalGetSession;
    }
  });
});

