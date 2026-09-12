import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Analytics Integrity: Score Fabrication & Floor Prevention', () => {
  test('Zero checkpoints must NOT fabricate engagement score of 65 or higher', async () => {
    // Dynamically test analytics SDK logic
    const { EduAnalyticsSDK } = await import('../study-island/src/lib/analytics-sdk.js');
    const sdk = new EduAnalyticsSDK();

    sdk.start({
      activity_id: 'test_act_001',
      activity_type: 'quiz',
      student_id: '00000000-0000-0000-0000-000000000001'
    });

    // Complete session with ZERO checkpoints
    const summary = sdk.complete();

    assert.ok(summary, 'Summary should be returned');
    assert.strictEqual(summary.questions_total, 0, 'Total questions should be 0');
    assert.strictEqual(summary.questions_correct, 0, 'Correct count should be 0');

    // CRITICAL: Engagement must NOT have an artificial floor of 65!
    assert.ok(
      summary.dimensions.engagement === null || summary.dimensions.engagement === 0 || summary.status === 'insufficient_evidence',
      `Expected engagement to be null, 0, or status 'insufficient_evidence', but got ${summary.dimensions.engagement}`
    );

    // Formula versioning check
    assert.ok(
      summary.formula_version || summary.metric_version,
      'Derived metric summary must include explicit formula_version or metric_version'
    );
  });

  test('Missing LO-04 must NOT fabricate practicalSkill as 85% of mastery', async () => {
    const { EduAnalyticsSDK } = await import('../study-island/src/lib/analytics-sdk.js');
    const sdk = new EduAnalyticsSDK();

    sdk.start({
      activity_id: 'test_act_002',
      student_id: '00000000-0000-0000-0000-000000000001'
    });

    sdk.recordCheckpoint({
      item_id: 'q1',
      correct: true,
      lo_code: 'LO-01',
      bloom_level: 'remember'
    });

    const summary = sdk.complete();

    // LO-04 was never tested
    const practicalSkill = summary.dimensions.practicalSkill ?? summary.dimensions.practical_skill;
    assert.ok(
      practicalSkill === null || practicalSkill === 0 || summary.status === 'insufficient_evidence' || practicalSkill === undefined,
      `practicalSkill was fabricated without LO-04 evidence! Value: ${practicalSkill}`
    );
  });
});
