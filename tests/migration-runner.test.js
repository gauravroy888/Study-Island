import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  sortMigrations,
  discoverMigrations,
  sanitizeMessage,
  isMigrationApplied,
  runMigrations
} from '../scripts/execute-supabase-sql.js';

describe('P0.5-Runner: Supabase Migration Execution Engine', () => {
  test('RUNNER-01: sortMigrations orders files numerically by leading integer prefix', () => {
    const unsorted = [
      '010_new_feature.sql',
      '002_canonical_fix.sql',
      '001_secure_rls.sql',
      '009_fix_search_path.sql'
    ];
    const sorted = sortMigrations(unsorted);
    assert.deepStrictEqual(sorted, [
      '001_secure_rls.sql',
      '002_canonical_fix.sql',
      '009_fix_search_path.sql',
      '010_new_feature.sql'
    ]);
  });

  test('RUNNER-02: discoverMigrations discovers all migration files from database-migrations in order', () => {
    const migrations = discoverMigrations();
    assert.ok(migrations.length >= 9, 'Should discover at least 9 migrations');
    for (let i = 0; i < migrations.length - 1; i++) {
      assert.ok(
        migrations[i].number <= migrations[i + 1].number,
        `Migrations must be ordered numerically: ${migrations[i].filename} should come before or equal to ${migrations[i + 1].filename}`
      );
    }
  });

  test('RUNNER-03: isMigrationApplied correctly recognizes applied migrations', () => {
    const appliedSet = new Set([
      '001_secure_rls_policies',
      '008_cleanup_legacy_unsafe_policies_and_drift',
      'harden_class_tenant_authorization'
    ]);

    assert.strictEqual(
      isMigrationApplied({ name: '001_secure_rls_policies' }, appliedSet),
      true
    );
    assert.strictEqual(
      isMigrationApplied({ name: '008_cleanup_legacy_unsafe_policies_and_drift' }, appliedSet),
      true
    );
    assert.strictEqual(
      isMigrationApplied({ name: '006_harden_class_tenant_authorization' }, appliedSet),
      true
    );
    assert.strictEqual(
      isMigrationApplied({ name: '999_unapplied_migration' }, appliedSet),
      false
    );
  });

  test('RUNNER-04: sanitizeMessage redacts secrets and JWT tokens', () => {
    const secret = 'super_secret_supabase_token_12345';
    const raw = `Connecting with token: ${secret} and Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb28iOiJiYXIifQ.abcdef`;
    const sanitized = sanitizeMessage(raw, [secret]);

    assert.ok(!sanitized.includes(secret), 'Raw secret token must not appear in output');
    assert.ok(sanitized.includes('[REDACTED]'), 'Secret token should be replaced with [REDACTED]');
    assert.ok(!sanitized.includes('eyJhbGciOi'), 'Raw JWT should not appear in output');
    assert.ok(sanitized.includes('[REDACTED_JWT]'), 'JWT should be replaced with [REDACTED_JWT]');
  });

  test('RUNNER-05: Dry-run mode does not make HTTP requests and reports pending files', async () => {
    let fetchCalled = false;
    const mockFetch = async () => {
      fetchCalled = true;
      return { ok: true, json: async () => [] };
    };

    const logs = [];
    const mockLogger = {
      log: (msg) => logs.push(msg),
      error: (msg) => logs.push(msg)
    };

    const result = await runMigrations({
      dryRun: true,
      accessToken: null,
      fetchFn: mockFetch,
      logger: mockLogger
    });

    assert.strictEqual(fetchCalled, false, 'Fetch should not be called in dry-run mode without token');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.dryRun, true);
    assert.ok(result.pending.length >= 9, 'All migrations should be listed as pending in dry-run without token');
  });

  test('RUNNER-06: Non-2xx HTTP status from Supabase is treated as failure and halts execution', async () => {
    const executed = [];
    const mockFetch = async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.query.includes('SELECT version, name FROM supabase_migrations.schema_migrations')) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ name: '001_secure_rls_policies', version: '1' }]
        };
      }
      // Fail on the first attempted migration
      return {
        ok: false,
        status: 500,
        text: async () => 'Internal PostgreSQL syntax error in migration'
      };
    };

    const logs = [];
    const mockLogger = {
      log: (msg) => logs.push(msg),
      error: (msg) => logs.push(msg)
    };

    const result = await runMigrations({
      dryRun: false,
      accessToken: 'test_token',
      fetchFn: mockFetch,
      logger: mockLogger
    });

    assert.strictEqual(result.ok, false, 'Non-2xx response must cause runner to report ok: false');
    assert.ok(result.error.includes('HTTP 500'), 'Error message must reflect HTTP status');
    assert.strictEqual(result.applied.length, 0, 'No migration should be marked applied when request fails');
  });

  test('RUNNER-07: Network errors cause runner to fail gracefully', async () => {
    const mockFetch = async () => {
      throw new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:443');
    };

    const logs = [];
    const mockLogger = {
      log: (msg) => logs.push(msg),
      error: (msg) => logs.push(msg)
    };

    const result = await runMigrations({
      dryRun: false,
      accessToken: 'test_token',
      fetchFn: mockFetch,
      logger: mockLogger
    });

    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('ECONNREFUSED') || result.error.includes('fetch failed'));
  });

  test('RUNNER-08: Runner executes multiple pending migrations in sequential order and skips applied ones', async () => {
    const executedQueries = [];
    const mockFetch = async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.query.includes('SELECT version, name FROM supabase_migrations.schema_migrations')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { name: '001_secure_rls_policies', version: '1' },
            { name: '002_canonical_schema_drift_fix', version: '2' }
          ]
        };
      }
      executedQueries.push(body.query);
      return {
        ok: true,
        status: 200,
        text: async () => 'SUCCESS'
      };
    };

    const logs = [];
    const mockLogger = {
      log: (msg) => logs.push(msg),
      error: (msg) => logs.push(msg)
    };

    const result = await runMigrations({
      dryRun: false,
      accessToken: 'valid_test_token',
      fetchFn: mockFetch,
      logger: mockLogger
    });

    assert.strictEqual(result.ok, true);
    assert.ok(result.skipped.includes('001_secure_rls_policies.sql'), '001 should be skipped');
    assert.ok(result.skipped.includes('002_canonical_schema_drift_fix.sql'), '002 should be skipped');
    assert.ok(result.applied.includes('003_p1_profile_security_and_drift.sql'), '003 should be executed');
    assert.ok(executedQueries.length >= 7, 'Remaining migrations should be executed sequentially');
  });
});
