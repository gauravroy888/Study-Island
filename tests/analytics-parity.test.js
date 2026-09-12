import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('P1.3-Parity: Analytics SDK & Standalone Quiz Implementation Parity', () => {
  const rootDir = process.cwd();
  const sdkPath = path.resolve(rootDir, 'study-island/src/lib/analytics-sdk.js');
  const quizHtmlPath = path.resolve(rootDir, 'study-island/quiz.html');

  const sdkSource = fs.readFileSync(sdkPath, 'utf8');
  const quizSource = fs.readFileSync(quizHtmlPath, 'utf8');

  test('PARITY-01: Both implementations enforce identical Bloom taxonomy weights', () => {
    const requiredWeights = [
      "remember: 0.5",
      "understand: 0.7",
      "apply: 1.0",
      "analyze: 1.2",
      "evaluate: 1.4",
      "create: 1.5"
    ];

    for (const weight of requiredWeights) {
      assert.ok(sdkSource.includes(weight), `SDK must contain weight ${weight}`);
      assert.ok(quizSource.includes(weight), `quiz.html must contain weight ${weight}`);
    }
  });

  test('PARITY-02: Both implementations enforce identical independence heuristic weights', () => {
    const requiredWeights = [
      "independent: 1.00",
      "self_corrected: 0.75",
      "assisted: 0.60",
      "failed: 0.00"
    ];

    for (const weight of requiredWeights) {
      assert.ok(sdkSource.includes(weight), `SDK must contain weight ${weight}`);
      assert.ok(quizSource.includes(weight), `quiz.html must contain weight ${weight}`);
    }
  });

  test('PARITY-03: Both implementations reject unauthenticated cloud writes (Fail-Closed)', () => {
    // Both must verify authenticated studentId is present and valid UUID before cloud write
    assert.ok(
      sdkSource.includes('!studentId') && sdkSource.includes('queued_unauthenticated'),
      'analytics-sdk.js must queue unauthenticated flushes fail-closed'
    );
    assert.ok(
      quizSource.includes('!studentId') && quizSource.includes('queued_unauthenticated'),
      'quiz.html must queue unauthenticated flushes fail-closed'
    );
  });

  test('PARITY-04: Both implementations prohibit anonymous keys as bearer tokens', () => {
    // In SDK: verified authenticated session is required via resolveAuthenticatedIdentity() before insert
    assert.ok(
      sdkSource.includes('resolveAuthenticatedIdentity') && sdkSource.includes('unauthenticated_identity'),
      'analytics-sdk.js must require verified session identity before cloud flush'
    );
    // In standalone quiz: explicitly checks accessToken presence and prohibits anon fallback
    assert.ok(
      quizSource.includes('!accessToken') && quizSource.includes('missing_session_token'),
      'quiz.html must reject cloud flush when session token is missing'
    );
  });

  test('PARITY-05: Both implementations override spoofed client student IDs with verified Supabase session', () => {
    // Both must query localStorage for sb-*-auth-token and override client-supplied ID
    assert.ok(
      sdkSource.includes("k.startsWith('sb-')") && sdkSource.includes("k.endsWith('-auth-token')"),
      'analytics-sdk.js must detect authenticated Supabase token'
    );
    assert.ok(
      quizSource.includes("k.startsWith('sb-')") && quizSource.includes("k.endsWith('-auth-token')"),
      'quiz.html must detect authenticated Supabase token'
    );
  });

  test('PARITY-06: Both implementations store unauthenticated events in offline WAL with fail-closed status', () => {
    assert.ok(
      sdkSource.includes("status: 'queued_unauthenticated'") && sdkSource.includes("reason: 'unauthenticated_identity'"),
      'analytics-sdk.js must mark queued events as queued_unauthenticated'
    );
    assert.ok(
      quizSource.includes("status: 'queued_unauthenticated'") && quizSource.includes("reason: 'unauthenticated_identity'"),
      'quiz.html must mark queued events as queued_unauthenticated'
    );
  });

  test('PARITY-07: Both implementations preserve idempotency and session ID tracking', () => {
    assert.ok(
      sdkSource.includes('session_id') && sdkSource.includes('activity_id'),
      'analytics-sdk.js must track session_id and activity_id'
    );
    assert.ok(
      quizSource.includes('session_id') && quizSource.includes('activity_id'),
      'quiz.html must track session_id and activity_id'
    );
  });

  test('PARITY-08: Synchronization script ensures standalone quiz analytics is up to date', async () => {
    const { generateStandaloneEduSdk } = await import('../study-island/scripts/sync-quiz-analytics.js');
    const generatedBundle = generateStandaloneEduSdk();
    assert.ok(typeof generatedBundle === 'string');
    assert.ok(generatedBundle.includes('EduSDK_VERSION = \'2.0.0-synced\''));
    assert.ok(quizSource.includes('EduSDK_VERSION = \'2.0.0-synced\''), 'quiz.html must have synchronized version');
  });
});
