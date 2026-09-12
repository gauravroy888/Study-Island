/**
 * bot-widget-security.test.js
 *
 * P0 Security Tests for bot-widget.js (standalone vanilla JS Aria AI widget).
 *
 * Audits previously found that the React useAriaSession.js hooks were correctly
 * patched for P0 identity/session violations, but the legacy bot-widget.js was
 * not covered by the test suite. These tests close that coverage gap.
 *
 * Invariants verified:
 *   P0-BOT-01: getStudentId() MUST return null (not "guest_student") for unauthenticated visitors.
 *   P0-BOT-02: syncSupabaseSession() MUST NOT write to Supabase for unauthenticated users,
 *               and MUST use a real user JWT (not the anon key) as the Authorization Bearer token.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOT_WIDGET_SRC = readFileSync(join(__dirname, '../bot-widget.js'), 'utf-8');

// ── Helper: extract the body of a named function from source text ─────────────
function extractFunctionSource(src, fnName) {
  const marker = `function ${fnName}(`;
  const start = src.indexOf(marker);
  if (start === -1) return null;
  let depth = 0, bodyStart = -1;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') {
      depth++;
      if (depth === 1) bodyStart = i;
    } else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(bodyStart, i + 1);
    }
  }
  return null;
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('P0: bot-widget.js Security Invariant Tests', () => {

  // ── P0-BOT-01: No synthetic "guest_student" identity ─────────────────────

  test('P0-BOT-01a: Source code must not contain the "guest_student" string literal', () => {
    assert.ok(
      !BOT_WIDGET_SRC.includes('"guest_student"'),
      'VIOLATION: bot-widget.js contains the "guest_student" synthetic identity string. ' +
      'Unauthenticated visitors must never receive a fabricated student_id.'
    );
  });

  test('P0-BOT-01b: getStudentId() must not contain a quoted string fallback', () => {
    const fnSrc = extractFunctionSource(BOT_WIDGET_SRC, 'getStudentId');
    assert.ok(fnSrc, 'getStudentId function must exist in bot-widget.js');

    const hasStringFallback = /"guest[^"]*"|'guest[^']*'/.test(fnSrc);
    assert.ok(
      !hasStringFallback,
      'VIOLATION: getStudentId() contains a quoted string fallback for unauthenticated users.'
    );
  });

  test('P0-BOT-01c: getStudentId() must return null as its terminal fallback', () => {
    const fnSrc = extractFunctionSource(BOT_WIDGET_SRC, 'getStudentId');
    assert.ok(fnSrc, 'getStudentId function must exist in bot-widget.js');
    assert.ok(
      fnSrc.includes('null'),
      'getStudentId() must return null for unauthenticated visitors, not a string literal.'
    );
  });

  // ── P0-BOT-02: No anon key as Bearer token, no writes for unauthenticated ──

  test('P0-BOT-02a: syncSupabaseSession() must guard on null studentId before fetching', () => {
    const fnSrc = extractFunctionSource(BOT_WIDGET_SRC, 'syncSupabaseSession');
    assert.ok(fnSrc, 'syncSupabaseSession function must exist in bot-widget.js');

    const hasNullGuard = /if\s*\(\s*!\s*studentId\s*\)\s*return/.test(fnSrc);
    assert.ok(
      hasNullGuard,
      'VIOLATION: syncSupabaseSession() must have "if (!studentId) return" guard before writing to Supabase.'
    );
  });

  test('P0-BOT-02b: syncSupabaseSession() must NOT use SUPABASE_ANON_KEY as Bearer token', () => {
    const fnSrc = extractFunctionSource(BOT_WIDGET_SRC, 'syncSupabaseSession');
    assert.ok(fnSrc, 'syncSupabaseSession function must exist in bot-widget.js');

    const usesAnonKeyAsBearer = /Authorization.*Bearer.*SUPABASE_ANON_KEY/.test(fnSrc);
    assert.ok(
      !usesAnonKeyAsBearer,
      'VIOLATION: syncSupabaseSession() uses SUPABASE_ANON_KEY as Authorization Bearer. ' +
      'Supabase writes must use the authenticated user real JWT access token.'
    );
  });

  test('P0-BOT-02c: syncSupabaseSession() must use accessToken variable as Bearer', () => {
    const fnSrc = extractFunctionSource(BOT_WIDGET_SRC, 'syncSupabaseSession');
    assert.ok(fnSrc, 'syncSupabaseSession function must exist in bot-widget.js');

    const usesAccessToken = /Authorization.*Bearer.*accessToken/.test(fnSrc);
    assert.ok(
      usesAccessToken,
      'syncSupabaseSession() must use the real user JWT (accessToken) as the Authorization Bearer token.'
    );
  });

  test('P0-BOT-02d: getSupabaseAccessToken() must exist and derive JWT from Supabase localStorage', () => {
    const fnSrc = extractFunctionSource(BOT_WIDGET_SRC, 'getSupabaseAccessToken');
    assert.ok(
      fnSrc,
      'getSupabaseAccessToken() helper must be present in bot-widget.js to safely retrieve the user JWT.'
    );

    assert.ok(
      fnSrc.includes('sb-') && fnSrc.includes('auth-token'),
      'getSupabaseAccessToken() must search localStorage for Supabase sb-*-auth-token session entries.'
    );

    assert.ok(
      fnSrc.includes('return null'),
      'getSupabaseAccessToken() must return null when no valid session is found — never a fallback string.'
    );

    assert.ok(
      !fnSrc.includes('SUPABASE_ANON_KEY'),
      'getSupabaseAccessToken() must not return the SUPABASE_ANON_KEY as a fallback JWT.'
    );
  });

  // ── Singleton guards (regression baseline) ────────────────────────────────

  test('Singleton: iframe check must be present (window.self !== window.top)', () => {
    assert.ok(
      BOT_WIDGET_SRC.includes('window.self !== window.top'),
      'Aria singleton iframe guard must be present in bot-widget.js'
    );
  });

  test('Singleton: __aria_bot_widget_initialized__ guard must be present', () => {
    assert.ok(
      BOT_WIDGET_SRC.includes('__aria_bot_widget_initialized__'),
      'Aria singleton initialization flag must be present in bot-widget.js'
    );
  });

});

// ── P0-CCV-01: CourseCurriculumView.jsx anon-key Bearer token violation ───────

const CCV_SRC = readFileSync(
  join(__dirname, '../portals/superadmin/src/views/CourseCurriculumView.jsx'),
  'utf-8'
);

describe('P0: CourseCurriculumView.jsx Security Invariant Tests', () => {

  test('P0-CCV-01a: Must NOT contain inline hardcoded SUPABASE_KEY/anon key constant inside component body', () => {
    // The anon key JWT starts with this exact prefix — if it appears as a string literal in the component body, it is hardcoded
    const anonKeyLiteral = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI';
    // Find the component function start
    const componentStart = CCV_SRC.indexOf('export function CourseCurriculumView');
    assert.ok(componentStart !== -1, 'CourseCurriculumView function must exist');
    const componentBody = CCV_SRC.slice(componentStart);
    assert.ok(
      !componentBody.includes(anonKeyLiteral),
      'VIOLATION: CourseCurriculumView.jsx contains a hardcoded Supabase anon key string literal ' +
      'inside the component function body. Credentials must not be inlined in component code.'
    );
  });

  test('P0-CCV-01b: sb() helper must NOT use SUPABASE_KEY as Authorization Bearer token', () => {
    const componentStart = CCV_SRC.indexOf('export function CourseCurriculumView');
    const componentBody = CCV_SRC.slice(componentStart);

    // Check line by line: any line containing both "Authorization" and "Bearer" must not also contain "SUPABASE_KEY"
    const lines = componentBody.split('\n');
    const violatingLine = lines.find(line =>
      line.includes('Authorization') && line.includes('Bearer') && line.includes('SUPABASE_KEY')
    );
    assert.ok(
      !violatingLine,
      `VIOLATION: sb() helper uses SUPABASE_KEY as Authorization Bearer. ` +
      `Found on line: "${(violatingLine || '').trim()}". Must use real user JWT instead.`
    );
  });

  test('P0-CCV-01c: sb() helper must use a token variable (real JWT) as Authorization Bearer', () => {
    const componentStart = CCV_SRC.indexOf('export function CourseCurriculumView');
    const componentBody = CCV_SRC.slice(componentStart);
    // Must reference a token variable (not a constant string) for the Bearer
    const usesTokenVar = /Authorization[^}]+Bearer[^}]+token\b/.test(componentBody);
    assert.ok(
      usesTokenVar,
      'sb() helper must use a token variable (real user JWT from session) as Authorization Bearer token.'
    );
  });

  test('P0-CCV-01d: Component must import and use the supabase client for session resolution', () => {
    assert.ok(
      CCV_SRC.includes("import { supabase"),
      'CourseCurriculumView.jsx must import the supabase client for session-based JWT resolution.'
    );
    assert.ok(
      CCV_SRC.includes('supabase.auth.getSession'),
      'CourseCurriculumView.jsx must call supabase.auth.getSession() to resolve the real user JWT.'
    );
  });

});
