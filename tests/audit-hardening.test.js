import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';

const require = createRequire(import.meta.url);
const {
  handleAuditLog,
  ALLOWED_SEVERITIES,
  ALLOWED_CATEGORIES,
  ALLOWED_STATUSES
} = require('../server/audit.js');

function createMockReq({ headers = {}, body = '' }) {
  const buffer = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  const req = Readable.from([buffer]);
  req.headers = {
    'content-length': String(buffer.length),
    ...headers
  };
  req.socket = { remoteAddress: '127.0.0.1' };
  return req;
}

function createMockRes() {
  return {
    statusCode: null,
    headers: {},
    body: '',
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(data) {
      this.body = data;
    }
  };
}

describe('P1.4: Harden Audit Logging & Tenant Isolation Tests', () => {
  const adminUser = {
    id: 'admin-uuid-001',
    email: 'admin@school.edu',
    role: 'admin',
    department: 'inst-school-101',
    institution_id: 'inst-school-101'
  };

  const studentUser = {
    id: 'student-uuid-001',
    email: 'student@school.edu',
    role: 'student',
    department: 'inst-school-101',
    institution_id: 'inst-school-101'
  };

  const superAdminUser = {
    id: 'superadmin-uuid-001',
    email: 'ops@platform.internal',
    role: 'super_admin',
    department: 'platform',
    institution_id: 'platform'
  };

  function mockAuthFetch(user) {
    return async (url) => {
      const u = new URL(url);
      if (u.pathname === '/auth/v1/user') {
        return { ok: true, status: 200, json: async () => ({ id: user.id, email: user.email }) };
      }
      if (u.pathname === '/rest/v1/profiles') {
        return { ok: true, status: 200, json: async () => [user] };
      }
      if (u.pathname === '/rest/v1/rpc/log_system_audit_event') {
        return { ok: true, status: 200, json: async () => ({ id: 'log-12345', success: true }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };
  }

  test('rejects unauthenticated audit logging with 401', async () => {
    const req = createMockReq({ headers: {}, body: { title: 'Test log' } });
    const res = createMockRes();

    await handleAuditLog(req, res, {
      fetchFn: async () => ({ ok: false, status: 401 })
    });

    assert.strictEqual(res.statusCode, 401);
  });

  test('rejects student role with 403', async () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer student_valid_session_jwt_123' },
      body: { title: 'Test attempt' }
    });
    const res = createMockRes();

    await handleAuditLog(req, res, {
      fetchFn: mockAuthFetch(studentUser)
    });

    assert.strictEqual(res.statusCode, 403);
    const parsed = JSON.parse(res.body);
    assert.match(parsed.error, /Insufficient permissions/);
  });

  test('rejects missing or empty title with 400', async () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer admin_valid_session_jwt_12345' },
      body: { title: '   ', severity: 'INFO' }
    });
    const res = createMockRes();

    await handleAuditLog(req, res, {
      fetchFn: mockAuthFetch(adminUser)
    });

    assert.strictEqual(res.statusCode, 400);
    const parsed = JSON.parse(res.body);
    assert.match(parsed.error, /Valid title is required/);
  });

  test('rejects invalid severity with 400', async () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer admin_valid_session_jwt_12345' },
      body: { title: 'Test Event', severity: 'DISASTER' }
    });
    const res = createMockRes();

    await handleAuditLog(req, res, {
      fetchFn: mockAuthFetch(adminUser)
    });

    assert.strictEqual(res.statusCode, 400);
    const parsed = JSON.parse(res.body);
    assert.match(parsed.error, /Invalid severity/);
  });

  test('rejects invalid category with 400', async () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer admin_valid_session_jwt_12345' },
      body: { title: 'Test Event', category: 'RANDOM_CAT' }
    });
    const res = createMockRes();

    await handleAuditLog(req, res, {
      fetchFn: mockAuthFetch(adminUser)
    });

    assert.strictEqual(res.statusCode, 400);
    const parsed = JSON.parse(res.body);
    assert.match(parsed.error, /Invalid category/);
  });

  test('rejects invalid status with 400', async () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer admin_valid_session_jwt_12345' },
      body: { title: 'Test Event', status: 'DELETED' }
    });
    const res = createMockRes();

    await handleAuditLog(req, res, {
      fetchFn: mockAuthFetch(adminUser)
    });

    assert.strictEqual(res.statusCode, 400);
    const parsed = JSON.parse(res.body);
    assert.match(parsed.error, /Invalid status/);
  });

  test('rejects invalid status code outside 100-599 range with 400', async () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer admin_valid_session_jwt_12345' },
      body: { title: 'Test Event', code: 999 }
    });
    const res = createMockRes();

    await handleAuditLog(req, res, {
      fetchFn: mockAuthFetch(adminUser)
    });

    assert.strictEqual(res.statusCode, 400);
    const parsed = JSON.parse(res.body);
    assert.match(parsed.error, /valid HTTP\/system status code/);
  });

  test('rejects cross-tenant audit injection with 403', async () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer admin_valid_session_jwt_12345' },
      body: {
        title: 'Unauthorized Tenant Log',
        school_id: 'inst-DIFFERENT-SCHOOL-999'
      }
    });
    const res = createMockRes();

    await handleAuditLog(req, res, {
      fetchFn: mockAuthFetch(adminUser)
    });

    assert.strictEqual(res.statusCode, 403);
    const parsed = JSON.parse(res.body);
    assert.match(parsed.error, /Cannot create audit events for another school\/tenant/);
  });

  test('derives school_id server-side and logs valid audit event', async () => {
    let capturedRpcPayload = null;
    const mockRpcFetch = async (url, opts) => {
      const u = new URL(url);
      if (u.pathname === '/auth/v1/user') {
        return { ok: true, status: 200, json: async () => ({ id: adminUser.id, email: adminUser.email }) };
      }
      if (u.pathname === '/rest/v1/profiles') {
        return { ok: true, status: 200, json: async () => [adminUser] };
      }
      if (u.pathname === '/rest/v1/rpc/log_system_audit_event') {
        capturedRpcPayload = JSON.parse(opts.body);
        return { ok: true, status: 200, json: async () => ({ id: 'log-uuid-999' }) };
      }
      return { ok: false, status: 404 };
    };

    const req = createMockReq({
      headers: { authorization: 'Bearer admin_valid_session_jwt_12345' },
      body: {
        title: 'Timetable Modified',
        severity: 'INFO',
        category: 'CLASS',
        code: 200,
        details: 'Period 3 room moved to Lab 2'
      }
    });
    const res = createMockRes();

    await handleAuditLog(req, res, { fetchFn: mockRpcFetch });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(capturedRpcPayload.p_school_id, 'inst-school-101');
    assert.strictEqual(capturedRpcPayload.p_title, 'Timetable Modified');
    assert.strictEqual(capturedRpcPayload.p_severity, 'INFO');
    assert.strictEqual(capturedRpcPayload.p_category, 'CLASS');
  });

  test('allows SuperAdmin to record platform-wide or designated tenant audit events', async () => {
    let capturedRpcPayload = null;
    const mockRpcFetch = async (url, opts) => {
      const u = new URL(url);
      if (u.pathname === '/auth/v1/user') {
        return { ok: true, status: 200, json: async () => ({ id: superAdminUser.id, email: superAdminUser.email }) };
      }
      if (u.pathname === '/rest/v1/profiles') {
        return { ok: true, status: 200, json: async () => [superAdminUser] };
      }
      if (u.pathname === '/rest/v1/rpc/log_system_audit_event') {
        capturedRpcPayload = JSON.parse(opts.body);
        return { ok: true, status: 200, json: async () => ({ id: 'log-platform-001' }) };
      }
      return { ok: false, status: 404 };
    };

    const req = createMockReq({
      headers: { authorization: 'Bearer superadmin_valid_jwt_12345' },
      body: {
        title: 'Global Security Sweep',
        severity: 'WARN',
        category: 'SECURITY',
        school_id: 'inst-special-target'
      }
    });
    const res = createMockRes();

    await handleAuditLog(req, res, { fetchFn: mockRpcFetch });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(capturedRpcPayload.p_school_id, 'inst-special-target');
    assert.strictEqual(capturedRpcPayload.p_category, 'SECURITY');
  });
});
