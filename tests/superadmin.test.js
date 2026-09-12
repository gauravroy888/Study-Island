import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { handleSuperAdminRequest } = require('../server/superadmin.js');

describe('P0.2: SuperAdmin Server-Side Privileges & Client Bypass Removal', () => {

  function createMockReqRes({ method = 'GET', pathname = '/api/superadmin/users', headers = {}, body = null }) {
    const req = {
      method,
      headers,
      async *[Symbol.asyncIterator]() {
        if (body) {
          yield Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
        }
      }
    };

    let statusCode = 200;
    let headersSent = {};
    let responseBody = '';

    const res = {
      writeHead(code, hdrs) {
        statusCode = code;
        headersSent = hdrs;
      },
      end(chunk) {
        if (chunk) responseBody += chunk;
      },
      getStatus: () => statusCode,
      getBody: () => {
        try {
          return JSON.parse(responseBody);
        } catch {
          return responseBody;
        }
      }
    };

    return { req, res, pathname };
  }

  test('P0.2-01: Rejects unauthenticated request with 401', async () => {
    const { req, res, pathname } = createMockReqRes({
      method: 'GET',
      pathname: '/api/superadmin/users',
      headers: {}
    });

    await handleSuperAdminRequest(req, res, pathname);
    assert.strictEqual(res.getStatus(), 401);
    assert.strictEqual(res.getBody().ok, false);
  });

  test('P0.2-02: Rejects student role with 403 Forbidden', async () => {
    const mockFetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/user')) {
        return {
          ok: true,
          json: async () => ({ id: 'student-1', email: 'student@school.edu' })
        };
      }
      if (urlStr.includes('/rest/v1/profiles')) {
        return {
          ok: true,
          json: async () => ([{ id: 'p-1', role: 'student', department: 'inst-dps-001', name: 'Student' }])
        };
      }
      return { ok: false, status: 404 };
    };

    const { req, res, pathname } = createMockReqRes({
      method: 'GET',
      pathname: '/api/superadmin/users',
      headers: { authorization: 'Bearer valid-student-token' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 403);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /SuperAdmin privileges required/i);
  });

  test('P0.2-03: Rejects teacher role with 403 Forbidden', async () => {
    const mockFetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/user')) {
        return {
          ok: true,
          json: async () => ({ id: 'teacher-1', email: 'teacher@school.edu' })
        };
      }
      if (urlStr.includes('/rest/v1/profiles')) {
        return {
          ok: true,
          json: async () => ([{ id: 'p-2', role: 'teacher', department: 'inst-dps-001', name: 'Teacher' }])
        };
      }
      return { ok: false, status: 404 };
    };

    const { req, res, pathname } = createMockReqRes({
      method: 'GET',
      pathname: '/api/superadmin/users',
      headers: { authorization: 'Bearer valid-teacher-token' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 403);
    assert.strictEqual(res.getBody().ok, false);
  });

  test('P0.2-04: Rejects school admin role with 403 Forbidden', async () => {
    const mockFetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/user')) {
        return {
          ok: true,
          json: async () => ({ id: 'admin-1', email: 'admin@school.edu' })
        };
      }
      if (urlStr.includes('/rest/v1/profiles')) {
        return {
          ok: true,
          json: async () => ([{ id: 'p-3', role: 'admin', department: 'inst-dps-001', name: 'School Admin' }])
        };
      }
      return { ok: false, status: 404 };
    };

    const { req, res, pathname } = createMockReqRes({
      method: 'GET',
      pathname: '/api/superadmin/users',
      headers: { authorization: 'Bearer valid-admin-token' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 403);
    assert.strictEqual(res.getBody().ok, false);
  });

  test('P0.2-05: Authorizes super_admin role for /api/superadmin/users', async () => {
    const mockFetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/user')) {
        return {
          ok: true,
          json: async () => ({ id: 'sa-1', email: 'superadmin@platform.edu' })
        };
      }
      if (urlStr.includes('/rest/v1/profiles?auth_id=eq.')) {
        return {
          ok: true,
          json: async () => ([{ id: 'p-sa', role: 'super_admin', department: 'platform', name: 'Super Admin' }])
        };
      }
      if (urlStr.includes('/rest/v1/profiles?select=')) {
        return {
          ok: true,
          json: async () => ([
            { id: 'p-1', name: 'Student One', role: 'student' },
            { id: 'p-2', name: 'Teacher One', role: 'teacher' }
          ])
        };
      }
      return { ok: false, status: 404 };
    };

    const { req, res, pathname } = createMockReqRes({
      method: 'GET',
      pathname: '/api/superadmin/users',
      headers: { authorization: 'Bearer valid-sa-token-string-12345' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(res.getBody().ok, true);
    assert.strictEqual(res.getBody().users.length, 2);
  });

  test('P0.2-06: Validates inputs on role update', async () => {
    const mockFetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: 'sa-1', email: 'sa@platform.edu' }) };
      }
      if (urlStr.includes('/rest/v1/profiles?auth_id=eq.')) {
        return { ok: true, json: async () => ([{ id: 'p-sa', role: 'super_admin', department: 'platform' }]) };
      }
      return { ok: false, status: 404 };
    };

    // Missing role
    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/role',
      headers: { authorization: 'Bearer valid-sa-token-string-12345' },
      body: { email: 'student@school.edu' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 400);
    assert.strictEqual(res.getBody().ok, false);
  });

  test('P0.2-07: Static audit confirms no demo user accounts in constants.js', () => {
    const constantsPath = resolve(process.cwd(), 'portals/superadmin/src/constants.js');
    const content = readFileSync(constantsPath, 'utf8');
    assert.match(content, /INITIAL_USERS\s*=\s*\[\s*\]/, 'INITIAL_USERS must be an empty array');
    assert.doesNotMatch(content, /urvashi\.nath@edtechisland\.internal/, 'No internal mock superadmin email');
    assert.doesNotMatch(content, /rajesh\.sharma@school\.internal/, 'No mock admin email');
  });

  test('P0.2-08: Static audit confirms root email bypass removed from App.jsx', () => {
    const appPath = resolve(process.cwd(), 'portals/superadmin/src/App.jsx');
    const content = readFileSync(appPath, 'utf8');
    assert.doesNotMatch(content, /urvashinath0409@gmail\.com/, 'Root personal email bypass must not exist');
    assert.doesNotMatch(content, /handleDirectSuperAdminLogin/, 'Direct superadmin login button handler must not exist');
  });
});

describe('P0.3: SuperAdmin Transactional Reliability & Authorization Correctness', () => {
  const SA_TOKEN = 'valid-sa-token-string-12345';

  function createMockReqRes({ method = 'GET', pathname = '/api/superadmin/users', headers = {}, body = null }) {
    const req = {
      method,
      headers: { authorization: `Bearer ${SA_TOKEN}`, ...headers },
      async *[Symbol.asyncIterator]() {
        if (body) {
          yield Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
        }
      }
    };

    let statusCode = 200;
    let headersSent = {};
    let responseBody = '';

    const res = {
      writeHead(code, hdrs) {
        statusCode = code;
        headersSent = hdrs;
      },
      end(chunk) {
        if (chunk) responseBody += chunk;
      },
      getStatus: () => statusCode,
      getBody: () => {
        try {
          return JSON.parse(responseBody);
        } catch {
          return responseBody;
        }
      }
    };

    return { req, res, pathname };
  }

  function createSuperAdminMockFetch(customHandlers = {}) {
    const recordedCalls = [];
    const mockFetch = async (url, options = {}) => {
      const urlStr = String(url);
      const method = (options.method || 'GET').toUpperCase();
      recordedCalls.push({ url: urlStr, method, options });

      for (const [key, handler] of Object.entries(customHandlers)) {
        if (urlStr.includes(key)) {
          return handler(urlStr, options);
        }
      }

      // Default Auth & Caller Profile resolution
      if (urlStr.includes('/auth/v1/user')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'sa-auth-id', email: 'superadmin@platform.edu' })
        };
      }
      if (urlStr.includes('/rest/v1/profiles?auth_id=eq.sa-auth-id')) {
        return {
          ok: true,
          status: 200,
          json: async () => ([{
            id: 'p-sa',
            auth_id: 'sa-auth-id',
            role: 'super_admin',
            department: 'platform',
            name: 'Super Admin',
            status: 'Active',
            is_archived: false
          }])
        };
      }

      return { ok: false, status: 404, text: async () => 'Not found' };
    };

    return { mockFetch, recordedCalls };
  }

  // ── 1. TARGET RESOLUTION & VALIDATION INVARIANTS ───────────────────────────

  test('P0.3-01: Target lookup uses immutable profile ID when supplied', async () => {
    const { mockFetch, recordedCalls } = createSuperAdminMockFetch({
      '/rest/v1/profiles?id=eq.p-target-123': async () => ({
        ok: true,
        status: 200,
        json: async () => ([{ id: 'p-target-123', email: 'student@school.edu', role: 'student', status: 'Active' }])
      }),
      '/rest/v1/profiles?id=eq.p-target-123&select=': async () => ({
        ok: true,
        status: 200,
        json: async () => ([{ id: 'p-target-123', email: 'student@school.edu', role: 'student', status: 'Active' }])
      }),
      'profiles?id=eq.p-target-123': async (url, opts) => {
        if (opts.method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ([{ id: 'p-target-123', role: 'teacher' }]) };
        }
        return { ok: true, status: 200, json: async () => ([{ id: 'p-target-123', email: 'student@school.edu', role: 'student', status: 'Active' }]) };
      },
      'rpc/log_system_audit_event': async () => ({ ok: true, status: 200, json: async () => ({}) })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/role',
      body: { id: 'p-target-123', email: 'other@school.edu', role: 'teacher' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(res.getBody().ok, true);
    // Verified that target ID was queried, not the email
    const idLookup = recordedCalls.find(c => c.url.includes('profiles?id=eq.p-target-123'));
    assert.ok(idLookup, 'Lookup must query by immutable profile ID');
  });

  test('P0.3-02: Returns 404 when target profile does not exist in database', async () => {
    const { mockFetch } = createSuperAdminMockFetch({
      'profiles?id=eq.non-existent': async () => ({
        ok: true,
        status: 200,
        json: async () => ([])
      })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/role',
      body: { id: 'non-existent', role: 'teacher' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 404);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /Target user profile not found/i);
  });

  test('P0.3-03: Returns 400 when neither target ID nor email is provided', async () => {
    const { mockFetch } = createSuperAdminMockFetch();

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/role',
      body: { role: 'teacher' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 400);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /Target user profile ID or email is required/i);
  });

  test('P0.3-04: Returns 409 when multiple target records match identifier (ambiguous target)', async () => {
    const { mockFetch } = createSuperAdminMockFetch({
      'profiles?email=eq.duplicate%40school.edu': async () => ({
        ok: true,
        status: 200,
        json: async () => ([{ id: 'p-1' }, { id: 'p-2' }])
      })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/role',
      body: { email: 'duplicate@school.edu', role: 'teacher' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 409);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /Ambiguous target/i);
  });

  test('P0.3-05: Rejects invalid tenant/department identifier with 400', async () => {
    const { mockFetch } = createSuperAdminMockFetch();

    for (const invalidDept of ['', '   ', 'null', 'undefined']) {
      const { req, res, pathname } = createMockReqRes({
        method: 'POST',
        pathname: '/api/superadmin/users/role',
        body: { id: 'p-1', role: 'teacher', department: invalidDept }
      });

      await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
      assert.strictEqual(res.getStatus(), 400, `Expected 400 for department: "${invalidDept}"`);
      assert.strictEqual(res.getBody().ok, false);
      assert.match(res.getBody().error, /Invalid department\/tenant/i);
    }
  });

  // ── 2. SELF-ACTION & LAST-SUPERADMIN GUARD INVARIANTS ──────────────────────

  test('P0.3-06: Forbids self-demotion from super_admin with 403', async () => {
    const { mockFetch, recordedCalls } = createSuperAdminMockFetch({
      'profiles?id=eq.p-sa': async () => ({
        ok: true,
        status: 200,
        json: async () => ([{
          id: 'p-sa',
          auth_id: 'sa-auth-id',
          email: 'superadmin@platform.edu',
          role: 'super_admin'
        }])
      })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/role',
      body: { id: 'p-sa', role: 'teacher' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 403);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /Self-demotion is forbidden/i);
    // Verified no PATCH was executed
    assert.ok(!recordedCalls.some(c => c.method === 'PATCH'), 'No database mutation must occur');
  });

  test('P0.3-07: Forbids self-suspension of active super_admin with 403', async () => {
    const { mockFetch, recordedCalls } = createSuperAdminMockFetch({
      'profiles?id=eq.p-sa': async () => ({
        ok: true,
        status: 200,
        json: async () => ([{
          id: 'p-sa',
          auth_id: 'sa-auth-id',
          email: 'superadmin@platform.edu',
          role: 'super_admin',
          status: 'Active'
        }])
      })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/status',
      body: { id: 'p-sa', status: 'Suspended' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 403);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /Self-suspension is forbidden/i);
    assert.ok(!recordedCalls.some(c => c.method === 'PATCH'), 'No database mutation must occur');
  });

  test('P0.3-08: Blocks demotion of final active SuperAdmin with 400', async () => {
    const { mockFetch } = createSuperAdminMockFetch({
      'profiles?id=eq.p-other-sa': async () => ({
        ok: true,
        status: 200,
        json: async () => ([{
          id: 'p-other-sa',
          auth_id: 'other-auth-id',
          email: 'other.sa@platform.edu',
          role: 'super_admin',
          status: 'Active'
        }])
      }),
      'role=in.(super_admin,superadmin)': async () => ({
        ok: true,
        status: 200,
        json: async () => ([{
          id: 'p-other-sa',
          role: 'super_admin',
          status: 'Active',
          is_archived: false
        }])
      })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/role',
      body: { id: 'p-other-sa', role: 'admin' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 400);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /Cannot demote the final SuperAdmin/i);
  });

  test('P0.3-09: Blocks suspension of final active SuperAdmin with 400', async () => {
    const { mockFetch } = createSuperAdminMockFetch({
      'profiles?id=eq.p-other-sa': async () => ({
        ok: true,
        status: 200,
        json: async () => ([{
          id: 'p-other-sa',
          auth_id: 'other-auth-id',
          email: 'other.sa@platform.edu',
          role: 'super_admin',
          status: 'Active'
        }])
      }),
      'role=in.(super_admin,superadmin)': async () => ({
        ok: true,
        status: 200,
        json: async () => ([{
          id: 'p-other-sa',
          role: 'super_admin',
          status: 'Active',
          is_archived: false
        }])
      })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/status',
      body: { id: 'p-other-sa', status: 'Suspended' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 400);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /Cannot suspend the final SuperAdmin/i);
  });

  test('P0.3-10: Allows demotion of a SuperAdmin when multiple active SuperAdmins exist', async () => {
    const { mockFetch } = createSuperAdminMockFetch({
      'profiles?id=eq.p-other-sa': async (url, opts) => {
        if (opts.method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ([{ id: 'p-other-sa', role: 'admin' }]) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ([{
            id: 'p-other-sa',
            auth_id: 'other-auth-id',
            email: 'other.sa@platform.edu',
            role: 'super_admin',
            status: 'Active'
          }])
        };
      },
      'role=in.(super_admin,superadmin)': async () => ({
        ok: true,
        status: 200,
        json: async () => ([
          { id: 'p-sa', role: 'super_admin', status: 'Active' },
          { id: 'p-other-sa', role: 'super_admin', status: 'Active' }
        ])
      }),
      'rpc/log_system_audit_event': async () => ({ ok: true, status: 200, json: async () => ({}) })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/role',
      body: { id: 'p-other-sa', role: 'admin' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(res.getBody().ok, true);
    assert.strictEqual(res.getBody().user.role, 'admin');
  });

  // ── 3. TRANSACTIONAL MODIFICATION GUARANTEES (EXACTLY-ONE-ROW) ─────────────

  test('P0.3-11: Returns 404 when role update affects zero records', async () => {
    const { mockFetch, recordedCalls } = createSuperAdminMockFetch({
      'profiles?id=eq.p-target': async (url, opts) => {
        if (opts.method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ([]) }; // Zero records updated
        }
        return {
          ok: true,
          status: 200,
          json: async () => ([{ id: 'p-target', email: 'user@school.edu', role: 'student' }])
        };
      }
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/role',
      body: { id: 'p-target', role: 'teacher' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 404);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /zero records were modified/i);
    // Audit must NOT be called
    assert.ok(!recordedCalls.some(c => c.url.includes('audit')), 'Audit log must not be written on failed update');
  });

  test('P0.3-12: Returns 409 when role update affects multiple records (integrity breach)', async () => {
    const { mockFetch, recordedCalls } = createSuperAdminMockFetch({
      'profiles?id=eq.p-target': async (url, opts) => {
        if (opts.method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ([{ id: 'p-1' }, { id: 'p-2' }]) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ([{ id: 'p-target', email: 'user@school.edu', role: 'student' }])
        };
      }
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/role',
      body: { id: 'p-target', role: 'teacher' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 409);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /multiple records were modified/i);
    assert.ok(!recordedCalls.some(c => c.url.includes('audit')), 'Audit log must not be written on failed update');
  });

  test('P0.3-13: Returns 404 when status update affects zero records', async () => {
    const { mockFetch, recordedCalls } = createSuperAdminMockFetch({
      'profiles?id=eq.p-target': async (url, opts) => {
        if (opts.method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ([]) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ([{ id: 'p-target', email: 'user@school.edu', role: 'student', status: 'Active' }])
        };
      }
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/status',
      body: { id: 'p-target', status: 'Suspended' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 404);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /zero records were modified/i);
    assert.ok(!recordedCalls.some(c => c.url.includes('audit')), 'Audit log must not be written on failed update');
  });

  test('P0.3-14: Returns 409 when status update affects multiple records', async () => {
    const { mockFetch, recordedCalls } = createSuperAdminMockFetch({
      'profiles?id=eq.p-target': async (url, opts) => {
        if (opts.method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ([{ id: 'p-1' }, { id: 'p-2' }]) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ([{ id: 'p-target', email: 'user@school.edu', role: 'student', status: 'Active' }])
        };
      }
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/status',
      body: { id: 'p-target', status: 'Suspended' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 409);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /multiple records were modified/i);
    assert.ok(!recordedCalls.some(c => c.url.includes('audit')), 'Audit log must not be written on failed update');
  });

  test('P0.3-15: Returns downstream error code (500) when Supabase role PATCH fails', async () => {
    const { mockFetch, recordedCalls } = createSuperAdminMockFetch({
      'profiles?id=eq.p-target': async (url, opts) => {
        if (opts.method === 'PATCH') {
          return { ok: false, status: 500, text: async () => 'Internal DB Error' };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ([{ id: 'p-target', email: 'user@school.edu', role: 'student' }])
        };
      }
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/role',
      body: { id: 'p-target', role: 'teacher' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 500);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /Role update failed: Internal DB Error/i);
    assert.ok(!recordedCalls.some(c => c.url.includes('audit')), 'Audit log must not be written on failed update');
  });

  test('P0.3-16: Returns downstream error code (500) when Supabase status PATCH fails', async () => {
    const { mockFetch, recordedCalls } = createSuperAdminMockFetch({
      'profiles?id=eq.p-target': async (url, opts) => {
        if (opts.method === 'PATCH') {
          return { ok: false, status: 500, text: async () => 'Lock timeout' };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ([{ id: 'p-target', email: 'user@school.edu', role: 'student', status: 'Active' }])
        };
      }
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/status',
      body: { id: 'p-target', status: 'Suspended' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 500);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /Status update failed: Lock timeout/i);
    assert.ok(!recordedCalls.some(c => c.url.includes('audit')), 'Audit log must not be written on failed update');
  });

  // ── 4. AUDIT LOG ATOMICITY & POST-SUCCESS GUARANTEES ───────────────────────

  test('P0.3-17: Records audit event strictly after successful role update', async () => {
    const { mockFetch, recordedCalls } = createSuperAdminMockFetch({
      'profiles?id=eq.p-target': async (url, opts) => {
        if (opts.method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ([{ id: 'p-target', role: 'teacher' }]) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ([{ id: 'p-target', email: 'user@school.edu', role: 'student' }])
        };
      },
      'rpc/log_system_audit_event': async () => ({ ok: true, status: 200, json: async () => ({}) })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/role',
      body: { id: 'p-target', role: 'teacher' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(res.getBody().ok, true);

    const auditCall = recordedCalls.find(c => c.url.includes('log_system_audit_event'));
    assert.ok(auditCall, 'Audit log event must be logged upon successful mutation');
    const auditBody = JSON.parse(auditCall.options.body);
    assert.strictEqual(auditBody.p_category, 'SECURITY');
    assert.match(auditBody.p_title, /Role Modified: user@school\.edu → teacher/);
  });

  test('P0.3-18: Records audit event strictly after successful status update', async () => {
    const { mockFetch, recordedCalls } = createSuperAdminMockFetch({
      'profiles?id=eq.p-target': async (url, opts) => {
        if (opts.method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ([{ id: 'p-target', status: 'Suspended' }]) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ([{ id: 'p-target', email: 'user@school.edu', role: 'student', status: 'Active' }])
        };
      },
      'rpc/log_system_audit_event': async () => ({ ok: true, status: 200, json: async () => ({}) })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/status',
      body: { id: 'p-target', status: 'Suspended' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(res.getBody().ok, true);

    const auditCall = recordedCalls.find(c => c.url.includes('log_system_audit_event'));
    assert.ok(auditCall, 'Audit log event must be logged upon successful mutation');
    const auditBody = JSON.parse(auditCall.options.body);
    assert.strictEqual(auditBody.p_severity, 'WARN');
    assert.match(auditBody.p_title, /Account Status Changed: user@school\.edu → Suspended/);
  });

  // ── 5. BROADCAST ENDPOINT TRANSACTIONAL RELIABILITY ────────────────────────

  test('P0.3-19: Broadcast rejects empty message with 400', async () => {
    const { mockFetch } = createSuperAdminMockFetch();

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/broadcast',
      body: { message: '   ' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 400);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /Broadcast message is required/i);
  });

  test('P0.3-20: Broadcast fails closed (500) if downstream insert returns 500 error', async () => {
    const { mockFetch, recordedCalls } = createSuperAdminMockFetch({
      '/rest/v1/announcements': async () => ({
        ok: false,
        status: 500,
        text: async () => 'Announcements table unavailable'
      })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/broadcast',
      body: { message: 'Important maintenance' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 500);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /Broadcast announcement failed/i);
    assert.ok(!recordedCalls.some(c => c.url.includes('audit')), 'Audit must not be written if broadcast insert failed');
  });

  test('P0.3-21: Broadcast fails closed (500) if downstream insert creates zero records', async () => {
    const { mockFetch, recordedCalls } = createSuperAdminMockFetch({
      '/rest/v1/announcements': async () => ({
        ok: true,
        status: 200,
        json: async () => ([]) // Zero records returned
      })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/broadcast',
      body: { message: 'Important maintenance' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 500);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /zero announcement records were created/i);
    assert.ok(!recordedCalls.some(c => c.url.includes('audit')), 'Audit must not be written if broadcast insert created zero rows');
  });

  test('P0.3-22: Broadcast succeeds and writes audit log on confirmed insert', async () => {
    const { mockFetch, recordedCalls } = createSuperAdminMockFetch({
      '/rest/v1/announcements': async (url, opts) => {
        const payload = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ([{ id: 'ann-1', ...payload }])
        };
      },
      'rpc/log_system_audit_event': async () => ({ ok: true, status: 200, json: async () => ({}) })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/broadcast',
      body: { message: 'System updated successfully' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(res.getBody().ok, true);
    assert.strictEqual(res.getBody().announcement.text, 'System updated successfully');

    const auditCall = recordedCalls.find(c => c.url.includes('log_system_audit_event'));
    assert.ok(auditCall, 'Broadcast publication audit must be written');
  });

  // ── 6. INCIDENT RESOLUTION TRANSACTIONAL RELIABILITY ───────────────────────

  test('P0.3-23: Incident resolution rejects missing ID with 400', async () => {
    const { mockFetch } = createSuperAdminMockFetch();

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/incidents/resolve',
      body: {}
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 400);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /Incident ID is required/i);
  });

  test('P0.3-24: Incident resolution succeeds via RPC resolve_system_audit_incident', async () => {
    const { mockFetch } = createSuperAdminMockFetch({
      'rpc/resolve_system_audit_incident': async () => ({
        ok: true,
        status: 200,
        json: async () => ({ resolved: true, incident_id: 'inc-100' })
      })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/incidents/resolve',
      body: { id: 'inc-100' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(res.getBody().ok, true);
    assert.strictEqual(res.getBody().data.resolved, true);
  });

  test('P0.3-25: Incident resolution fallback fails with 404 when zero records are modified', async () => {
    const { mockFetch } = createSuperAdminMockFetch({
      'rpc/resolve_system_audit_incident': async () => ({ ok: false, status: 404 }),
      'system_audit_logs?id=eq.inc-missing': async () => ({
        ok: true,
        status: 200,
        json: async () => ([]) // Zero records modified
      })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/incidents/resolve',
      body: { id: 'inc-missing' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 404);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /zero records were modified/i);
  });

  test('P0.3-26: Incident resolution fallback succeeds when exactly 1 record is modified', async () => {
    const { mockFetch } = createSuperAdminMockFetch({
      'rpc/resolve_system_audit_incident': async () => ({ ok: false, status: 404 }),
      'system_audit_logs?id=eq.inc-101': async (url, opts) => {
        const body = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ([{ id: 'inc-101', status: body.status }])
        };
      }
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/incidents/resolve',
      body: { id: 'inc-101' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(res.getBody().ok, true);
    assert.strictEqual(res.getBody().data.status, 'RESOLVED');
  });

  // ── 7. AVATAR UPDATE ENDPOINT TRANSACTIONAL RELIABILITY ─────────────────────

  test('P0.3-27: Avatar update rejects missing or empty avatar_url with 400', async () => {
    const { mockFetch } = createSuperAdminMockFetch();

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/avatar',
      body: { id: 'p-1', avatar_url: '   ' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 400);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /avatar_url is required/i);
  });

  test('P0.3-28: Avatar update rejects oversized avatar_url (>8192 chars) with 400', async () => {
    const { mockFetch } = createSuperAdminMockFetch();

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/avatar',
      body: { id: 'p-1', avatar_url: 'https://example.com/' + 'a'.repeat(8200) }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 400);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /avatar_url exceeds maximum/i);
  });

  test('P0.3-29: Avatar update returns 404 when target user is not found', async () => {
    const { mockFetch } = createSuperAdminMockFetch({
      'profiles?id=eq.p-missing': async () => ({
        ok: true,
        status: 200,
        json: async () => ([])
      })
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/avatar',
      body: { id: 'p-missing', avatar_url: 'https://cdn.example.com/avatar.jpg' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 404);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /Target user profile not found/i);
  });

  test('P0.3-30: Avatar update returns 404 if patch modifies zero rows', async () => {
    const { mockFetch } = createSuperAdminMockFetch({
      'profiles?id=eq.p-target': async (url, opts) => {
        if (opts.method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ([]) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ([{ id: 'p-target', email: 'user@school.edu' }])
        };
      }
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/avatar',
      body: { id: 'p-target', avatar_url: 'https://cdn.example.com/avatar.jpg' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 404);
    assert.strictEqual(res.getBody().ok, false);
    assert.match(res.getBody().error, /zero records were modified/i);
  });

  test('P0.3-31: Avatar update succeeds when 1 row is modified and returns updated user', async () => {
    const { mockFetch } = createSuperAdminMockFetch({
      'profiles?id=eq.p-target': async (url, opts) => {
        if (opts.method === 'PATCH') {
          const body = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            json: async () => ([{ id: 'p-target', avatar_url: body.avatar_url }])
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ([{ id: 'p-target', email: 'user@school.edu' }])
        };
      }
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/avatar',
      body: { id: 'p-target', avatar_url: 'https://cdn.example.com/avatar.jpg' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(res.getBody().ok, true);
    assert.strictEqual(res.getBody().avatar_url, 'https://cdn.example.com/avatar.jpg');
    assert.strictEqual(res.getBody().user.avatar_url, 'https://cdn.example.com/avatar.jpg');
  });

  test('P0.3-32: Avatar update defaults to calling SuperAdmin own profile when no target provided', async () => {
    const { mockFetch } = createSuperAdminMockFetch({
      'profiles?id=eq.p-sa': async (url, opts) => {
        if (opts.method === 'PATCH') {
          const body = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            json: async () => ([{ id: 'p-sa', avatar_url: body.avatar_url }])
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ([{ id: 'p-sa', email: 'superadmin@platform.edu' }])
        };
      }
    });

    const { req, res, pathname } = createMockReqRes({
      method: 'POST',
      pathname: '/api/superadmin/users/avatar',
      body: { avatar_url: 'https://cdn.example.com/sa-avatar.jpg' }
    });

    await handleSuperAdminRequest(req, res, pathname, { fetchFn: mockFetch });
    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(res.getBody().ok, true);
    assert.strictEqual(res.getBody().avatar_url, 'https://cdn.example.com/sa-avatar.jpg');
    assert.strictEqual(res.getBody().user.id, 'p-sa');
  });
});
