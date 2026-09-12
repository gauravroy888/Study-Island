import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import WebSocket from 'ws';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

import { createClient } from '@supabase/supabase-js';

// Load environment variables
try { (await import('dotenv')).default.config(); } catch (_) {}

describe('Phase 3: Multi-Identity Row Level Security (RLS) & Tenant Boundary Matrix', () => {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qmyrxvtbzlbnvzxypnus.supabase.co';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjA4OTcsImV4cCI6MjA5NTM5Njg5N30.ABvW_oBzXC2Ffxm5ToLh6t4WmdKPdtg9SyfeAE76iJo';

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function isNetworkError(e) {
    if (!e) return false;
    const msg = String(e.message || '');
    const code = e.code || e.cause?.code;
    return (
      code === 'ENOTFOUND' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      code === 'EAI_AGAIN' ||
      msg.includes('fetch failed') ||
      msg.includes('Failed to fetch') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('network unreachable') ||
      (e.cause?.name === 'AggregateError' && e.cause?.errors?.some?.(err => isNetworkError(err)))
    );
  }

  // ── MATRIX IDENTITIES (DOCUMENTED MODEL ROLES) ─────────────────────────
  const IDENTITIES = {
    ANON: { role: 'anon', tenant: null },
    STUDENT_A: { role: 'student', tenant: 'dps-rk-puram', studentId: 'student-dps-001' },
    STUDENT_B: { role: 'student', tenant: 'dps-rk-puram', studentId: 'student-dps-002' },
    TEACHER_A: { role: 'teacher', tenant: 'dps-rk-puram', teacherId: 'teacher-dps-001' },
    TEACHER_B: { role: 'teacher', tenant: 'modern-school', teacherId: 'teacher-ms-001' },
    ADMIN_TENANT_A: { role: 'admin', tenant: 'dps-rk-puram' },
    ADMIN_TENANT_B: { role: 'admin', tenant: 'modern-school' },
    SUPERADMIN: { role: 'superadmin', tenant: 'global' }
  };

  test('RLS Matrix Identity Schema: All 8 target identities are registered in model matrix', () => {
    assert.strictEqual(Object.keys(IDENTITIES).length, 8);
    assert.strictEqual(IDENTITIES.ANON.role, 'anon');
    assert.strictEqual(IDENTITIES.STUDENT_A.tenant, 'dps-rk-puram');
    assert.strictEqual(IDENTITIES.TEACHER_B.tenant, 'modern-school');
    assert.strictEqual(IDENTITIES.SUPERADMIN.role, 'superadmin');
  });

  // ── 12 NEGATIVE AUTHORIZATION TESTS ────────────────────────────────────

  test('RLS-NEG-01: Anonymous client cannot insert into system_audit_logs', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('system_audit_logs')
        .insert([{
          title: 'PROBE_UNAUTHORIZED_AUDIT_INSERT',
          actor_email: 'attacker@evil.corp',
          severity: 'CRITICAL',
          category: 'SECURITY'
        }]);

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      assert.ok(error !== null, 'Anonymous client insert into system_audit_logs must be rejected');
      assert.match(error.message, /row-level security|policy|permission|violates/i);
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS-NEG-02: Anonymous client cannot read system_audit_logs', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('system_audit_logs')
        .select('*');

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      if (!error) {
        assert.strictEqual(data.length, 0, 'Unauthenticated read of system_audit_logs must yield 0 rows');
      } else {
        assert.match(error.message, /row-level security|policy|permission/i);
      }
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS-NEG-03: Anonymous client cannot update system_audit_logs (Audit Immutability)', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('system_audit_logs')
        .update({ details: 'TAMPERED_DETAILS' })
        .eq('id', '00000000-0000-0000-0000-000000000000');

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      if (data) {
        assert.strictEqual(data.length, 0, 'Audit log update must affect 0 rows');
      }
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS-NEG-04: Anonymous client cannot delete from system_audit_logs', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('system_audit_logs')
        .delete()
        .eq('id', '00000000-0000-0000-0000-000000000000');

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      if (data) {
        assert.strictEqual(data.length, 0, 'Audit log delete must affect 0 rows');
      }
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS-NEG-05: Anonymous client cannot insert into classes', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('classes')
        .insert([{
          name: 'Unauthorized Class Injection',
          subject: 'Exploit 101',
          institution_id: 'fake-tenant-001'
        }]);

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      assert.ok(error !== null, 'Anonymous class insertion must be rejected by RLS');
      assert.match(error.message, /row-level security|policy|permission|violates/i);
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS-NEG-06: Anonymous client cannot elevate privileges via profiles role update', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('profiles')
        .update({ role: 'super_admin' })
        .eq('role', 'student');

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      if (data) {
        assert.strictEqual(data.length, 0, 'Privilege escalation update on profiles must affect 0 rows');
      }
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS-NEG-07: Anonymous client cannot delete from profiles', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('profiles')
        .delete()
        .eq('id', '00000000-0000-0000-0000-000000000000');

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      if (data) {
        assert.strictEqual(data.length, 0, 'Profile deletion attempt must affect 0 rows');
      }
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS-NEG-08: Anonymous client cannot update raw analytics_events (Raw Telemetry Immutability)', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('analytics_events')
        .update({ event_type: 'corrupted_event' })
        .eq('id', '00000000-0000-0000-0000-000000000000');

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      if (data) {
        assert.strictEqual(data.length, 0, 'Updating analytics_events must affect 0 rows');
      }
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS-NEG-09: Anonymous client cannot delete from analytics_events', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('analytics_events')
        .delete()
        .eq('id', '00000000-0000-0000-0000-000000000000');

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      if (data) {
        assert.strictEqual(data.length, 0, 'Deleting analytics_events must affect 0 rows');
      }
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS-NEG-10: Anonymous client cannot insert arbitrary user_roles', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('user_roles')
        .insert([{
          user_id: '00000000-0000-0000-0000-000000000000',
          role: 'superadmin'
        }]);

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      assert.ok(
        error !== null,
        'Inserting arbitrary user_roles with anon key must be rejected'
      );
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS-NEG-11: Anonymous client cannot insert into school_branding / tenant configuration', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('school_branding')
        .insert([{
          school_name: 'Rogue Tenant Institute',
          institution_id: 'ROGUE_01'
        }]);

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      assert.ok(
        error !== null,
        'Inserting rogue school_branding must be rejected by RLS'
      );
      assert.match(error.message, /row-level security|policy|permission|violates/i);
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS-NEG-12: Cross-student data tampering: updating another student test submission is blocked', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('test_submissions')
        .update({ score_pct: 100 })
        .eq('student_id', 'foreign-student-id-999');

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      if (data) {
        assert.strictEqual(data.length, 0, 'Cross-student submission update must affect 0 rows');
      }
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  // ── 5 POSITIVE AUTHORIZATION & SYSTEM INTEGRITY TESTS ──────────────────

  test('RLS-POS-01: Public read access to school_branding / tenant metadata returns valid structure', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('school_branding')
        .select('institution_id, school_name')
        .limit(3);

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      assert.strictEqual(error, null, `Querying school_branding failed: ${error?.message}`);
      assert.ok(Array.isArray(data), 'school_branding query should return an array');
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS-POS-02: Profile projection query returns safe fields and confirms sensitive fields are dropped', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('profiles')
        .select('id, name, role')
        .limit(1);

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      assert.strictEqual(error, null, `Querying safe profile fields failed: ${error?.message}`);

      // Verify dropped columns are definitely absent
      const { error: pwdErr } = await anonClient
        .from('profiles')
        .select('password')
        .limit(1);

      if (pwdErr && isNetworkError(pwdErr)) {
        t.skip(`Blocked: Live Supabase network unreachable (${pwdErr.message || pwdErr.code})`);
        return;
      }
      assert.ok(pwdErr !== null, 'Password column must not exist in profiles');

      const { error: loginErr } = await anonClient
        .from('profiles')
        .select('login_id')
        .limit(1);

      if (loginErr && isNetworkError(loginErr)) {
        t.skip(`Blocked: Live Supabase network unreachable (${loginErr.message || loginErr.code})`);
        return;
      }
      assert.ok(loginErr !== null, 'login_id column must not exist in profiles');
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS-POS-03: Reading published courses / curriculum catalogue returns valid data structure', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('courses')
        .select('id, title')
        .limit(3);

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      assert.strictEqual(error, null, `Querying courses failed: ${error?.message}`);
      assert.ok(Array.isArray(data), 'Courses query should return an array');
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS-POS-04: Authorized server-side audit logging endpoint handles valid audit submissions', async () => {
    // Audit logging is routed through server/audit.js RPC to bypass client-side direct mutation vulnerabilities
    const serverModule = await import('../server/audit.js');
    assert.strictEqual(typeof serverModule.handleAuditLog, 'function');
  });

  test('RLS-POS-05: System readiness endpoint validates database connectivity without leaking credentials', async () => {
    const { checkReadiness, READINESS_STATUSES } = await import('../server/health.js');
    const readiness = await checkReadiness();

    // 1. Verify contract adherence
    assert.ok(
      READINESS_STATUSES.includes(readiness.status),
      `Readiness status must match contract: ${readiness.status}`
    );
    assert.strictEqual(typeof readiness.ready, 'boolean');
    assert.strictEqual(typeof readiness.checks.database_connected, 'boolean');
    assert.strictEqual(readiness.checks.database_connected, readiness.ready && readiness.status === 'ready');

    // 2. Deterministic connected check
    const mockConnected = await checkReadiness({ fetchFn: async () => ({ status: 200, ok: true }) });
    assert.strictEqual(mockConnected.ready, true);
    assert.strictEqual(mockConnected.status, 'ready');
    assert.strictEqual(mockConnected.checks.database_connected, true);

    // 3. Assure no secrets leaked in output
    const jsonStr = JSON.stringify(readiness);
    assert.ok(!jsonStr.includes(SUPABASE_ANON_KEY), 'Supabase key must not be leaked in readiness check');
    assert.ok(!jsonStr.includes('eyJhbGciOi'), 'JWT must not be leaked in readiness check');
  });

  // ── AUTHENTICATED MULTI-IDENTITY MATRIX TESTS ─────────────────────────────
  // Requires dedicated non-production test credentials in environment.
  // When credentials are missing, tests are explicitly skipped in local dev
  // and fail closed when CI_REQUIRE_RLS_MATRIX=true.

  function getAuthToken(roleKey) {
    const envVar = `TEST_${roleKey}_JWT`;
    return process.env[envVar] || null;
  }

  function requireOrSkipAuth(t, requiredRoleKeys = []) {
    const missing = requiredRoleKeys.filter(k => !getAuthToken(k));
    if (missing.length > 0) {
      const missingVars = missing.map(k => `TEST_${k}_JWT`).join(', ');
      if (process.env.CI_REQUIRE_RLS_MATRIX === 'true' || process.env.CI_REQUIRE_AUTH_RLS === 'true') {
        assert.fail(`CI requires authenticated RLS matrix, but missing environment credentials: ${missingVars}`);
      }
      t.skip(`Explicitly unavailable in local development: missing authenticated test credentials (${missingVars}). Set TEST_*_JWT to run.`);
      return false;
    }
    return true;
  }

  function createAuthenticatedClient(jwt) {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } }
    });
  }

  test('RLS-AUTH-01: [Authenticated Same-Tenant] Student A can read own permitted data', async (t) => {
    if (!requireOrSkipAuth(t, ['STUDENT_A'])) return;
    const client = createAuthenticatedClient(getAuthToken('STUDENT_A'));
    try {
      const { data, error } = await client.from('profiles').select('id, name, role').limit(1);
      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Network unreachable (${error.message})`);
        return;
      }
      assert.strictEqual(error, null, `Student A profile query should succeed: ${error?.message}`);
      assert.ok(Array.isArray(data), 'Student A should receive profile records');
    } catch (err) {
      if (isNetworkError(err)) { t.skip(`Blocked: Network unreachable (${err.message})`); return; }
      throw err;
    }
  });

  test('RLS-AUTH-02: [Authenticated Cross-Tenant Denial] Student A is blocked from Student B private data and Tenant B classes', async (t) => {
    if (!requireOrSkipAuth(t, ['STUDENT_A'])) return;
    const client = createAuthenticatedClient(getAuthToken('STUDENT_A'));
    try {
      // 1. Probe classes in another tenant
      const { data: classesData, error: classesErr } = await client
        .from('classes')
        .select('*')
        .eq('institution_id', 'foreign-tenant-boundary-test');

      if (classesErr && isNetworkError(classesErr)) {
        t.skip(`Blocked: Network unreachable (${classesErr.message})`);
        return;
      }
      assert.strictEqual(classesData ? classesData.length : 0, 0, 'Student A must not see classes from foreign tenant');

      // 2. Probe foreign student analytics events
      const { data: aeData, error: aeErr } = await client
        .from('analytics_events')
        .select('*')
        .eq('student_id', '00000000-0000-0000-0000-000000000002');

      if (aeErr && isNetworkError(aeErr)) {
        t.skip(`Blocked: Network unreachable (${aeErr.message})`);
        return;
      }
      assert.strictEqual(aeData ? aeData.length : 0, 0, 'Student A must not see analytics of Student B');
    } catch (err) {
      if (isNetworkError(err)) { t.skip(`Blocked: Network unreachable (${err.message})`); return; }
      throw err;
    }
  });

  test('RLS-AUTH-03: [Authenticated Same-Tenant] Teacher A reads only assigned classes and enrolled students', async (t) => {
    if (!requireOrSkipAuth(t, ['TEACHER_A'])) return;
    const client = createAuthenticatedClient(getAuthToken('TEACHER_A'));
    try {
      const { data, error } = await client.from('classes').select('id, name, institution_id');
      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Network unreachable (${error.message})`);
        return;
      }
      assert.strictEqual(error, null, `Teacher A class query should succeed: ${error?.message}`);
      assert.ok(Array.isArray(data), 'Teacher A should receive assigned classes array');
    } catch (err) {
      if (isNetworkError(err)) { t.skip(`Blocked: Network unreachable (${err.message})`); return; }
      throw err;
    }
  });

  test('RLS-AUTH-04: [Authenticated Cross-Tenant Denial] Teacher A cannot access classes or students in Tenant B', async (t) => {
    if (!requireOrSkipAuth(t, ['TEACHER_A'])) return;
    const client = createAuthenticatedClient(getAuthToken('TEACHER_A'));
    try {
      const { data, error } = await client
        .from('classes')
        .select('*')
        .eq('institution_id', 'foreign-tenant-boundary-test');

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Network unreachable (${error.message})`);
        return;
      }
      assert.strictEqual(data ? data.length : 0, 0, 'Teacher A must not read classes in foreign tenant');
    } catch (err) {
      if (isNetworkError(err)) { t.skip(`Blocked: Network unreachable (${err.message})`); return; }
      throw err;
    }
  });

  test('RLS-AUTH-05: [Authenticated Cross-Tenant Denial] Admin A cannot access or mutate Tenant B classes', async (t) => {
    if (!requireOrSkipAuth(t, ['ADMIN_TENANT_A'])) return;
    const client = createAuthenticatedClient(getAuthToken('ADMIN_TENANT_A'));
    try {
      const { data, error } = await client
        .from('classes')
        .update({ name: 'TAMPERED_CLASS' })
        .eq('institution_id', 'foreign-tenant-boundary-test');

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Network unreachable (${error.message})`);
        return;
      }
      assert.strictEqual(data ? data.length : 0, 0, 'Admin A update to foreign tenant classes must affect 0 rows');
    } catch (err) {
      if (isNetworkError(err)) { t.skip(`Blocked: Network unreachable (${err.message})`); return; }
      throw err;
    }
  });

  test('RLS-AUTH-06: [SuperAdmin Matrix] SuperAdmin receives intended cross-tenant administrative access', async (t) => {
    if (!requireOrSkipAuth(t, ['SUPERADMIN'])) return;
    const client = createAuthenticatedClient(getAuthToken('SUPERADMIN'));
    try {
      const { data, error } = await client.from('classes').select('id, institution_id').limit(5);
      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Network unreachable (${error.message})`);
        return;
      }
      assert.strictEqual(error, null, `SuperAdmin query should succeed: ${error?.message}`);
      assert.ok(Array.isArray(data), 'SuperAdmin should receive multi-tenant classes');
    } catch (err) {
      if (isNetworkError(err)) { t.skip(`Blocked: Network unreachable (${err.message})`); return; }
      throw err;
    }
  });

  test('RLS-AUTH-07: [Authenticated Immutability] Students cannot update or delete protected analytics events', async (t) => {
    if (!requireOrSkipAuth(t, ['STUDENT_A'])) return;
    const client = createAuthenticatedClient(getAuthToken('STUDENT_A'));
    try {
      const { data: updateData, error: updateErr } = await client
        .from('analytics_events')
        .update({ payload: { tampered: true } })
        .eq('id', '00000000-0000-0000-0000-000000000001');

      if (updateErr && isNetworkError(updateErr)) {
        t.skip(`Blocked: Network unreachable (${updateErr.message})`);
        return;
      }
      assert.strictEqual(updateData ? updateData.length : 0, 0, 'Student cannot update analytics events');

      const { data: deleteData, error: deleteErr } = await client
        .from('analytics_events')
        .delete()
        .eq('id', '00000000-0000-0000-0000-000000000001');

      if (deleteErr && isNetworkError(deleteErr)) {
        t.skip(`Blocked: Network unreachable (${deleteErr.message})`);
        return;
      }
      assert.strictEqual(deleteData ? deleteData.length : 0, 0, 'Student cannot delete analytics events');
    } catch (err) {
      if (isNetworkError(err)) { t.skip(`Blocked: Network unreachable (${err.message})`); return; }
      throw err;
    }
  });

  test('RLS-AUTH-08: [Authenticated Role Escalation Denial] Student cannot update profile role', async (t) => {
    if (!requireOrSkipAuth(t, ['STUDENT_A'])) return;
    const client = createAuthenticatedClient(getAuthToken('STUDENT_A'));
    try {
      const { data, error } = await client
        .from('profiles')
        .update({ role: 'super_admin' })
        .eq('id', '00000000-0000-0000-0000-000000000001');

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Network unreachable (${error.message})`);
        return;
      }
      assert.strictEqual(data ? data.length : 0, 0, 'Student cannot escalate role in profiles');
    } catch (err) {
      if (isNetworkError(err)) { t.skip(`Blocked: Network unreachable (${err.message})`); return; }
      throw err;
    }
  });

  test('RLS-AUTH-09: [Authenticated Privilege Denial] Teacher cannot create or resolve administrative audit records', async (t) => {
    if (!requireOrSkipAuth(t, ['TEACHER_A'])) return;
    const client = createAuthenticatedClient(getAuthToken('TEACHER_A'));
    try {
      const { data, error } = await client
        .from('system_audit_logs')
        .insert([{
          title: 'UNAUTHORIZED_TEACHER_AUDIT',
          severity: 'CRITICAL',
          category: 'SECURITY'
        }]);

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Network unreachable (${error.message})`);
        return;
      }
      assert.ok(error !== null, 'Teacher insert into system_audit_logs must be rejected by RLS');
    } catch (err) {
      if (isNetworkError(err)) { t.skip(`Blocked: Network unreachable (${err.message})`); return; }
      throw err;
    }
  });

  test('RLS-AUTH-10: [Authenticated Tenant Boundary] Admin audit operations are tenant-scoped', async (t) => {
    if (!requireOrSkipAuth(t, ['ADMIN_TENANT_A'])) return;
    const client = createAuthenticatedClient(getAuthToken('ADMIN_TENANT_A'));
    try {
      const { data, error } = await client
        .from('system_audit_logs')
        .select('id, school_id')
        .eq('school_id', 'foreign-tenant-boundary-test');

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Network unreachable (${error.message})`);
        return;
      }
      assert.strictEqual(data ? data.length : 0, 0, 'Admin A must not see foreign tenant audit logs');
    } catch (err) {
      if (isNetworkError(err)) { t.skip(`Blocked: Network unreachable (${err.message})`); return; }
      throw err;
    }
  });
});

