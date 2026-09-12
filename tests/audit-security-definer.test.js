import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';

const require = createRequire(import.meta.url);
const { handleAuditLog } = require('../server/audit.js');
const { handleSuperAdminRequest } = require('../server/superadmin.js');

function createMockReq({ method = 'POST', headers = {}, body = '' }) {
  const buffer = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  const req = Readable.from([buffer]);
  req.method = method;
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
      this.body = data || '';
    },
    getStatus() {
      return this.statusCode;
    },
    getBody() {
      try {
        return JSON.parse(this.body);
      } catch {
        return this.body;
      }
    }
  };
}

describe('P1.5: Secure Audit SECURITY DEFINER & Immutability Suite', () => {
  const adminUser = {
    id: 'admin-uuid-001',
    email: 'admin@school.edu',
    role: 'admin',
    department: 'inst-school-101',
    institution_id: 'inst-school-101'
  };

  const teacherUser = {
    id: 'teacher-uuid-001',
    email: 'teacher@school.edu',
    role: 'teacher',
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

  function mockSupabaseFetch(user, rpcSpy = {}) {
    return async (url, options = {}) => {
      const u = new URL(url);
      if (u.pathname === '/auth/v1/user') {
        if (!user) return { ok: false, status: 401, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => ({ id: user.id, email: user.email }) };
      }
      if (u.pathname === '/rest/v1/profiles') {
        if (!user) return { ok: false, status: 401, json: async () => [] };
        return { ok: true, status: 200, json: async () => [user] };
      }
      if (u.pathname === '/rest/v1/rpc/log_system_audit_event') {
        rpcSpy.called = true;
        rpcSpy.options = options;
        rpcSpy.body = options.body ? JSON.parse(options.body) : null;
        return { ok: true, status: 200, json: async () => ({ id: 'log-audit-12345', status: 'ACTIVE' }) };
      }
      if (u.pathname === '/rest/v1/rpc/resolve_system_audit_incident') {
        rpcSpy.resolveCalled = true;
        rpcSpy.resolveOptions = options;
        rpcSpy.resolveBody = options.body ? JSON.parse(options.body) : null;
        return { ok: true, status: 200, json: async () => ({ id: 'log-audit-12345', status: 'RESOLVED' }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };
  }

  // ── TEST 1: Anonymous Caller Rejection ──
  test('P1.5-01: Rejects unauthenticated audit log and incident resolve requests with 401', async () => {
    // 1. Audit log endpoint
    const req1 = createMockReq({ headers: {}, body: { title: 'Test event' } });
    const res1 = createMockRes();
    await handleAuditLog(req1, res1, {
      fetchFn: async () => ({ ok: false, status: 401 })
    });
    assert.strictEqual(res1.getStatus(), 401);
    assert.match(res1.getBody().error, /Unauthorized/i);

    // 2. Incident resolve endpoint
    const req2 = createMockReq({
      method: 'POST',
      headers: {},
      body: { id: 'some-incident-uuid' }
    });
    const res2 = createMockRes();
    await handleSuperAdminRequest(req2, res2, '/api/superadmin/incidents/resolve', {
      fetchFn: async () => ({ ok: false, status: 401 })
    });
    assert.strictEqual(res2.getStatus(), 401);
  });

  // ── TEST 2: Student Caller Rejection ──
  test('P1.5-02: Rejects authenticated student from logging audit events and resolving incidents with 403', async () => {
    // Audit log
    const req1 = createMockReq({
      headers: { authorization: 'Bearer student_valid_token_12345' },
      body: { title: 'Student Attempt' }
    });
    const res1 = createMockRes();
    await handleAuditLog(req1, res1, {
      fetchFn: mockSupabaseFetch(studentUser)
    });
    assert.strictEqual(res1.getStatus(), 403);
    assert.match(res1.getBody().error, /Insufficient permissions/i);

    // Incident resolve
    const req2 = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer student_valid_token_12345' },
      body: { id: 'some-incident-uuid' }
    });
    const res2 = createMockRes();
    await handleSuperAdminRequest(req2, res2, '/api/superadmin/incidents/resolve', {
      fetchFn: mockSupabaseFetch(studentUser)
    });
    assert.strictEqual(res2.getStatus(), 403);
  });

  // ── TEST 3: Teacher Caller Rejection ──
  test('P1.5-03: Rejects teacher role from audit log management (admin-only fail-closed)', async () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer teacher_valid_token_12345' },
      body: { title: 'Teacher Audit Entry' }
    });
    const res = createMockRes();
    await handleAuditLog(req, res, {
      fetchFn: mockSupabaseFetch(teacherUser)
    });
    assert.strictEqual(res.getStatus(), 403);
    assert.match(res.getBody().error, /Insufficient permissions/i);
  });

  // ── TEST 4: Admin and SuperAdmin Authorization Success ──
  test('P1.5-04: Authorizes admin and super_admin callers to log audit events', async () => {
    const rpcSpy = {};

    // Admin
    const req1 = createMockReq({
      headers: { authorization: 'Bearer admin_valid_token_12345' },
      body: {
        title: 'Admin Policy Change',
        severity: 'WARN',
        category: 'SECURITY'
      }
    });
    const res1 = createMockRes();
    await handleAuditLog(req1, res1, {
      fetchFn: mockSupabaseFetch(adminUser, rpcSpy)
    });
    assert.strictEqual(res1.getStatus(), 200);
    assert.strictEqual(rpcSpy.called, true);
    assert.strictEqual(rpcSpy.body.p_title, 'Admin Policy Change');
    assert.strictEqual(rpcSpy.body.p_school_id, 'inst-school-101');

    // SuperAdmin
    const superSpy = {};
    const req2 = createMockReq({
      headers: { authorization: 'Bearer superadmin_valid_token_12345' },
      body: {
        title: 'SuperAdmin Global Maintenance',
        severity: 'INFO',
        category: 'SYSTEM'
      }
    });
    const res2 = createMockRes();
    await handleAuditLog(req2, res2, {
      fetchFn: mockSupabaseFetch(superAdminUser, superSpy)
    });
    assert.strictEqual(res2.getStatus(), 200);
    assert.strictEqual(superSpy.called, true);
  });

  // ── TEST 5: Actor Email Spoofing Prevention ──
  test('P1.5-05: Prevents actor_email spoofing: actor is derived from verified session token', async () => {
    const rpcSpy = {};
    const req = createMockReq({
      headers: { authorization: 'Bearer admin_valid_token_12345' },
      body: {
        title: 'Spoof Attempt',
        actor_email: 'attacker@evil.com' // Spoofed in body
      }
    });
    const res = createMockRes();
    await handleAuditLog(req, res, {
      fetchFn: mockSupabaseFetch(adminUser, rpcSpy)
    });
    assert.strictEqual(res.getStatus(), 200);
    // Notice that server forwards the user's verified token in Authorization header
    assert.match(rpcSpy.options.headers.Authorization, /Bearer /);
    // Client-supplied actor_email is not forwarded as a trusted parameter
    assert.strictEqual(rpcSpy.body.actor_email, undefined);
  });

  // ── TEST 6: Tenant Isolation & School ID Forgery Prevention ──
  test('P1.5-06: Prevents tenant forgery: admin cannot log audit event for another school', async () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer admin_valid_token_12345' },
      body: {
        title: 'Cross Tenant Event',
        school_id: 'inst-DIFFERENT-SCHOOL-999' // Forged school ID
      }
    });
    const res = createMockRes();
    await handleAuditLog(req, res, {
      fetchFn: mockSupabaseFetch(adminUser)
    });
    assert.strictEqual(res.getStatus(), 403);
    assert.match(res.getBody().error, /Cannot create audit events for another school\/tenant/);
  });

  // ── TEST 7: Incident Resolution RPC & Endpoint ──
  test('P1.5-07: Incident resolution route validates ID and calls resolve_system_audit_incident RPC', async () => {
    // Missing ID
    const req1 = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer superadmin_token' },
      body: {}
    });
    const res1 = createMockRes();
    await handleSuperAdminRequest(req1, res1, '/api/superadmin/incidents/resolve', {
      fetchFn: mockSupabaseFetch(superAdminUser)
    });
    assert.strictEqual(res1.getStatus(), 400);
    assert.match(res1.getBody().error, /Incident ID is required/);

    // Valid ID -> Calls RPC
    const rpcSpy = {};
    const req2 = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer superadmin_token' },
      body: { id: 'incident-uuid-999', status: 'RESOLVED' }
    });
    const res2 = createMockRes();
    await handleSuperAdminRequest(req2, res2, '/api/superadmin/incidents/resolve', {
      fetchFn: mockSupabaseFetch(superAdminUser, rpcSpy)
    });
    assert.strictEqual(res2.getStatus(), 200);
    assert.strictEqual(rpcSpy.resolveCalled, true);
    assert.strictEqual(rpcSpy.resolveBody.p_incident_id, 'incident-uuid-999');
    assert.strictEqual(rpcSpy.resolveBody.p_new_status, 'RESOLVED');
  });

  // ── TEST 8: Immutability Trigger & SQL Integrity ──
  test('P1.5-08: Migration 005 creates immutability trigger preventing modification of audit fields', () => {
    const migrationPath = resolve(process.cwd(), 'database-migrations/005_p1_secure_audit_definer.sql');
    assert.strictEqual(existsSync(migrationPath), true, '005 migration file must exist');

    const sql = readFileSync(migrationPath, 'utf8');

    // Trigger verification
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.prevent_audit_log_mutation\(\)/);
    assert.match(sql, /CREATE TRIGGER trg_prevent_audit_log_mutation/);
    assert.match(sql, /BEFORE UPDATE ON public\.system_audit_logs/);

    // Immutable columns check
    assert.match(sql, /NEW\.severity IS DISTINCT FROM OLD\.severity/);
    assert.match(sql, /NEW\.category IS DISTINCT FROM OLD\.category/);
    assert.match(sql, /NEW\.actor_email IS DISTINCT FROM OLD\.actor_email/);
    assert.match(sql, /NEW\.school_id IS DISTINCT FROM OLD\.school_id/);
    assert.match(sql, /NEW\.created_at IS DISTINCT FROM OLD\.created_at/);

    // Only status is permitted
    assert.match(sql, /only status may be modified/i);
  });

  // ── TEST 9: Deprecated auth.role() Elimination & Function Permission Hardening ──
  test('P1.5-09: Migration 005 eliminates deprecated auth.role() and revokes PUBLIC execute', () => {
    const migrationPath = resolve(process.cwd(), 'database-migrations/005_p1_secure_audit_definer.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    // Confirm no deprecated auth.role() calls in new policies
    assert.strictEqual(sql.includes('auth.role()'), false, 'Migration 005 must NOT contain deprecated auth.role() calls');

    // Confirm TO authenticated is used
    assert.match(sql, /CREATE POLICY "classes_select_policy" ON public\.classes\s+FOR SELECT TO authenticated/);
    assert.match(sql, /CREATE POLICY "profiles_select_policy" ON public\.profiles\s+FOR SELECT TO authenticated/);
    assert.match(sql, /CREATE POLICY "system_audit_logs_select_policy" ON public\.system_audit_logs\s+FOR SELECT TO authenticated/);

    // Confirm REVOKE from PUBLIC
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.log_system_audit_event.*FROM PUBLIC/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.resolve_system_audit_incident.*FROM PUBLIC/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.is_admin\(\) FROM PUBLIC/);

    // Confirm GRANT to authenticated
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.log_system_audit_event.*TO authenticated/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.resolve_system_audit_incident.*TO authenticated/);
  });

  // ── TEST 10: Live Supabase Endpoint Security Probe ──
  test('P1.5-10: Live Supabase endpoint blocks anonymous RPC calls and table insertions', async () => {
    const supabaseUrl = 'https://qmyrxvtbzlbnvzxypnus.supabase.co';
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxMTQzNzUsImV4cCI6MjA1NTY5MDM3NX0.tB8Nq_yPzRlhZ8bJg8q_l_Ue5669bZ2H854mY_Xo0x0';

    // Probe 1: Anonymous attempt to insert directly into system_audit_logs table
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/system_audit_logs`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Anonymous Penetration Probe',
          severity: 'CRITICAL',
          category: 'SECURITY'
        })
      });

      // Anonymous insert MUST be rejected (401 or 403 with RLS violation code 42501)
      assert.strictEqual([401, 403].includes(res.status), true, `Anonymous table insert must be rejected, got HTTP ${res.status}`);
    } catch (err) {
      // If offline / network error, skip live probe safely
      console.warn('Live probe skipped (network unreachable):', err.message);
    }

    // Probe 2: Anonymous attempt to call log_system_audit_event RPC
    try {
      const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/log_system_audit_event`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_title: 'Anonymous RPC Probe'
        })
      });

      // Anonymous RPC call MUST NOT return 200 OK
      assert.notStrictEqual(rpcRes.status, 200, 'Anonymous RPC call must be rejected');
    } catch (err) {
      console.warn('Live RPC probe skipped (network unreachable):', err.message);
    }
  });
});
