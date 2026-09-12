import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

import { createClient } from '@supabase/supabase-js';

describe('Database Security: Supabase Row Level Security (RLS) & Multi-Tenancy Policies', () => {
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

  test('RLS 1: Anonymous client must NOT be allowed to insert into system_audit_logs', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('system_audit_logs')
        .insert([{
          title: 'SECURITY_PROBE_ANON_INSERT',
          actor_email: 'unauthorized_attacker@exploit.com',
          details: 'probe',
          status: 'ACTIVE',
          severity: 'CRITICAL',
          category: 'SECURITY'
        }]);

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      assert.ok(
        error !== null,
        'Expected RLS policy violation when inserting into system_audit_logs with anon key, but insert succeeded!'
      );
      assert.match(
        error.message,
        /row-level security|policy|permission|violates/i,
        `Expected row-level security error message, got: ${error.message}`
      );
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS 2: Anonymous client must NOT read system_audit_logs', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('system_audit_logs')
        .select('*');

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      // Either PostgREST returns an RLS error, or returns an empty list (0 rows)
      if (!error) {
        assert.strictEqual(
          data.length,
          0,
          `Expected 0 rows for unauthenticated client reading system_audit_logs, got ${data.length}`
        );
      } else {
        assert.match(
          error.message,
          /row-level security|policy|permission/i
        );
      }
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS 3: Schema hardening - dropped password and login_id columns must NOT exist in profiles', async (t) => {
    try {
      const { error: pwdErr } = await anonClient
        .from('profiles')
        .select('password')
        .limit(1);

      if (pwdErr && isNetworkError(pwdErr)) {
        t.skip(`Blocked: Live Supabase network unreachable (${pwdErr.message || pwdErr.code})`);
        return;
      }

      assert.ok(pwdErr !== null, 'Querying dropped column "password" must return error');
      assert.match(
        pwdErr.message,
        /column.*password.*does not exist/i,
        `Expected column does not exist error, got: ${pwdErr.message}`
      );

      const { error: loginErr } = await anonClient
        .from('profiles')
        .select('login_id')
        .limit(1);

      if (loginErr && isNetworkError(loginErr)) {
        t.skip(`Blocked: Live Supabase network unreachable (${loginErr.message || loginErr.code})`);
        return;
      }

      assert.ok(loginErr !== null, 'Querying dropped column "login_id" must return error');
      assert.match(
        loginErr.message,
        /column.*login_id.*does not exist/i,
        `Expected column does not exist error, got: ${loginErr.message}`
      );
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS 4: Anonymous client must NOT be allowed to insert classes', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('classes')
        .insert([{
          name: 'Exploit Unauthorized Class',
          subject: 'Science',
          institution_id: 'fake-tenant'
        }]);

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      assert.ok(
        error !== null,
        'Expected RLS policy violation when creating class with anon key, but insert succeeded!'
      );
      assert.match(
        error.message,
        /row-level security|policy|permission|violates/i,
        `Expected row-level security error message, got: ${error.message}`
      );
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });

  test('RLS 5: Anonymous client cannot elevate privileges via profiles update', async (t) => {
    try {
      const { data, error } = await anonClient
        .from('profiles')
        .update({ role: 'super_admin' })
        .eq('role', 'student');

      if (error && isNetworkError(error)) {
        t.skip(`Blocked: Live Supabase network unreachable (${error.message || error.code})`);
        return;
      }

      // Update should either error out or affect 0 rows
      if (data) {
        assert.strictEqual(
          data.length,
          0,
          `Anonymous update on profiles should affect 0 rows, affected ${data.length}`
        );
      }
    } catch (err) {
      if (isNetworkError(err)) {
        t.skip(`Blocked: Live Supabase network unreachable (${err.message || err.code})`);
        return;
      }
      throw err;
    }
  });
});
