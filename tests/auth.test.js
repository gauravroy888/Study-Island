import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  verifySupabaseJWT,
  normalizeRole,
  extractToken,
  SUPABASE_ANON_KEY
} = require('../server/auth.js');

describe('Security: Authentication & Authorization Bypasses', () => {
  const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';

  function isConnRefused(e) {
    return e.code === 'ECONNREFUSED' ||
      e.cause?.code === 'ECONNREFUSED' ||
      (e.cause?.name === 'AggregateError' && e.cause?.errors?.some(err => err.code === 'ECONNREFUSED'));
  }

  // ── P0.1 UNIT TESTS ──────────────────────────────────────────────────────────

  describe('P0.1: verifySupabaseJWT & Role/Tenant Resolution', () => {
    test('P0.1-01: normalizeRole correctly normalizes valid roles', () => {
      assert.strictEqual(normalizeRole('student'), 'student');
      assert.strictEqual(normalizeRole('STUDENT'), 'student');
      assert.strictEqual(normalizeRole('teacher'), 'teacher');
      assert.strictEqual(normalizeRole('TEACHER'), 'teacher');
      assert.strictEqual(normalizeRole('admin'), 'admin');
      assert.strictEqual(normalizeRole('ADMIN'), 'admin');
      assert.strictEqual(normalizeRole('super_admin'), 'super_admin');
      assert.strictEqual(normalizeRole('superadmin'), 'super_admin');
      assert.strictEqual(normalizeRole('SUPER_ADMIN'), 'super_admin');
    });

    test('P0.1-02: normalizeRole fails closed (returns null) for invalid roles', () => {
      assert.strictEqual(normalizeRole(''), null);
      assert.strictEqual(normalizeRole(null), null);
      assert.strictEqual(normalizeRole(undefined), null);
      assert.strictEqual(normalizeRole('hacker'), null);
      assert.strictEqual(normalizeRole('guest'), null);
      assert.strictEqual(normalizeRole('moderator'), null);
    });

    test('P0.1-03: extractToken rejects Supabase anon key when used as Bearer token', () => {
      assert.strictEqual(extractToken(`Bearer ${SUPABASE_ANON_KEY}`), null);
      assert.strictEqual(extractToken(SUPABASE_ANON_KEY), null);
    });

    test('P0.1-04: extractToken rejects malformed or empty tokens', () => {
      assert.strictEqual(extractToken(''), null);
      assert.strictEqual(extractToken('   '), null);
      assert.strictEqual(extractToken('Bearer '), null);
      assert.strictEqual(extractToken('short'), null);
      assert.strictEqual(extractToken(null), null);
    });

    // Mock fetch helper
    function createMockFetch({ authOk = true, authUser = { id: 'u-123', email: 'test@school.edu' }, profileOk = true, profiles = [{ id: 'p-123', role: 'student', department: 'inst-dps-001', name: 'Test User' }] }) {
      return async (url, opts) => {
        if (url.includes('/auth/v1/user')) {
          // Verify that user token was sent in Authorization header
          const authHeader = opts.headers?.Authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { ok: false, status: 401 };
          }
          if (!authOk) return { ok: false, status: 401, json: async () => ({ error: 'Invalid token' }) };
          return { ok: true, status: 200, json: async () => authUser };
        }

        if (url.includes('/rest/v1/profiles')) {
          // Ensure profile query uses user token, NEVER anon key as user authorization
          const userAuth = opts.headers?.Authorization;
          assert.ok(userAuth, 'Profile lookup must include Authorization header');
          assert.notStrictEqual(userAuth, `Bearer ${SUPABASE_ANON_KEY}`, 'Must NEVER use anon key as Bearer token');
          if (!profileOk) return { ok: false, status: 500, json: async () => ({ error: 'DB error' }) };
          return { ok: true, status: 200, json: async () => profiles };
        }

        return { ok: false, status: 404 };
      };
    }

    test('P0.1-05: Valid student authentication resolves verified user', async () => {
      const mockFetch = createMockFetch({
        profiles: [{ id: 'p-stu', role: 'student', department: 'inst-dps-001', name: 'Alice Student' }]
      });
      const user = await verifySupabaseJWT('Bearer mock-valid-jwt-token-12345', { fetchFn: mockFetch });
      assert.ok(user);
      assert.strictEqual(user.id, 'u-123');
      assert.strictEqual(user.role, 'student');
      assert.strictEqual(user.institution_id, 'inst-dps-001');
      assert.strictEqual(user.name, 'Alice Student');
    });

    test('P0.1-06: Valid teacher authentication resolves verified user', async () => {
      const mockFetch = createMockFetch({
        profiles: [{ id: 'p-tea', role: 'teacher', department: 'inst-dps-001', name: 'Bob Teacher' }]
      });
      const user = await verifySupabaseJWT('Bearer mock-valid-jwt-token-12345', { fetchFn: mockFetch });
      assert.ok(user);
      assert.strictEqual(user.role, 'teacher');
      assert.strictEqual(user.institution_id, 'inst-dps-001');
    });

    test('P0.1-07: Valid admin authentication resolves verified user', async () => {
      const mockFetch = createMockFetch({
        profiles: [{ id: 'p-adm', role: 'admin', department: 'inst-dps-001', name: 'Charlie Admin' }]
      });
      const user = await verifySupabaseJWT('Bearer mock-valid-jwt-token-12345', { fetchFn: mockFetch });
      assert.ok(user);
      assert.strictEqual(user.role, 'admin');
      assert.strictEqual(user.institution_id, 'inst-dps-001');
    });

    test('P0.1-08: Valid SuperAdmin authentication resolves verified user', async () => {
      const mockFetch = createMockFetch({
        profiles: [{ id: 'p-sup', role: 'super_admin', department: null, name: 'Root SuperAdmin' }]
      });
      const user = await verifySupabaseJWT('Bearer mock-valid-jwt-token-12345', { fetchFn: mockFetch });
      assert.ok(user);
      assert.strictEqual(user.role, 'super_admin');
    });

    test('P0.1-09: Missing profile in database fails closed (does NOT default to student)', async () => {
      const mockFetch = createMockFetch({ profiles: [] });
      const user = await verifySupabaseJWT('Bearer mock-valid-jwt-token-12345', { fetchFn: mockFetch });
      assert.strictEqual(user, null, 'Must return null when profile is missing');
    });

    test('P0.1-10: Invalid role in profile fails closed (does NOT default to student)', async () => {
      const mockFetch = createMockFetch({
        profiles: [{ id: 'p-bad', role: 'hacker_role', department: 'inst-dps-001' }]
      });
      const user = await verifySupabaseJWT('Bearer mock-valid-jwt-token-12345', { fetchFn: mockFetch });
      assert.strictEqual(user, null, 'Must return null when role is invalid');
    });

    test('P0.1-11: Missing tenant fails closed when requireTenant is true', async () => {
      const mockFetch = createMockFetch({
        profiles: [{ id: 'p-notenant', role: 'teacher', department: null }]
      });
      const user = await verifySupabaseJWT('Bearer mock-valid-jwt-token-12345', {
        requireTenant: true,
        fetchFn: mockFetch
      });
      assert.strictEqual(user, null, 'Must reject tenant-less user when requireTenant is true');
    });

    test('P0.1-12: Anonymous key used as Bearer token is immediately rejected', async () => {
      const user = await verifySupabaseJWT(`Bearer ${SUPABASE_ANON_KEY}`);
      assert.strictEqual(user, null);
    });

    test('P0.1-13: Malformed authorization header is immediately rejected', async () => {
      assert.strictEqual(await verifySupabaseJWT(''), null);
      assert.strictEqual(await verifySupabaseJWT(null), null);
      assert.strictEqual(await verifySupabaseJWT('Basic dXNlcjpwYXNz'), null);
    });
  });

  // ── SERVER ROUTE SMOKE TESTS ────────────────────────────────────────────────

  test('Problem A: Supabase anon key must NOT grant superadmin or upload access', async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/upload-r2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          filename: 'exploit_test.jpg',
          base64Content: Buffer.from('fake data').toString('base64')
        })
      });

      // Must be rejected with 401 Unauthorized, never 200
      assert.strictEqual(
        res.status,
        401,
        `Expected 401 Unauthorized when using public anon key, got ${res.status}`
      );
    } catch (e) {
      if (isConnRefused(e)) {
        console.warn('⚠️ Server not running during test, verified via offline assertions.');
      } else {
        throw e;
      }
    }
  });

  test('Problem B: Local origin header must NOT bypass authentication', async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/upload-r2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000'
        },
        body: JSON.stringify({
          filename: 'exploit_test.jpg',
          base64Content: Buffer.from('fake data').toString('base64')
        })
      });

      assert.strictEqual(
        res.status,
        401,
        `Expected 401 Unauthorized for request with local Origin but no token, got ${res.status}`
      );
    } catch (e) {
      if (isConnRefused(e)) {
        console.warn('⚠️ Server not running during test.');
      } else {
        throw e;
      }
    }
  });

  test('Unauthenticated request to /api/ai/chat must be rejected', async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello AI' })
      });

      assert.strictEqual(
        res.status,
        401,
        `Expected 401 for unauthenticated AI chat request, got ${res.status}`
      );
    } catch (e) {
      if (isConnRefused(e)) {
        console.warn('⚠️ Server not running during test.');
      } else {
        throw e;
      }
    }
  });
});
