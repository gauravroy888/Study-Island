import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

describe('P0.5: Database Migration Chain Integrity & Replay Idempotence', () => {
  const migrationsDir = resolve(process.cwd(), 'database-migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  test('MIG-01: All migration files exist in expected order (001 through 011)', () => {
    assert.ok(migrationFiles.length >= 11, 'Must have at least 11 migration files');
    assert.ok(migrationFiles[0].startsWith('001_'), 'Migration 001 exists');
    assert.ok(migrationFiles[1].startsWith('002_'), 'Migration 002 exists');
    assert.ok(migrationFiles[2].startsWith('003_'), 'Migration 003 exists');
    assert.ok(migrationFiles[3].startsWith('004_'), 'Migration 004 exists');
    assert.ok(migrationFiles[4].startsWith('005_'), 'Migration 005 exists');
    assert.ok(migrationFiles[5].startsWith('006_'), 'Migration 006 exists');
    assert.ok(migrationFiles[6].startsWith('007_'), 'Migration 007 exists');
    assert.ok(migrationFiles[7].startsWith('008_'), 'Migration 008 exists');
    assert.ok(migrationFiles[8].startsWith('009_'), 'Migration 009 exists');
    assert.ok(migrationFiles[9].startsWith('010_'), 'Migration 010 exists');
    assert.ok(migrationFiles[10].startsWith('011_'), 'Migration 011 exists');
  });

  test('MIG-02: Zero syntax backslash escapes (\\...\\ or \\$\\$) across all migrations', () => {
    for (const file of migrationFiles) {
      const content = readFileSync(join(migrationsDir, file), 'utf8');
      
      // Check for stray Windows-path style or regex escapes in SQL statements like \policy_name\
      const strayBackslashRegex = /CREATE\s+POLICY\s+\\[^\\\s]+\\/i;
      assert.doesNotMatch(
        content,
        strayBackslashRegex,
        `File ${file} must not contain backslash-escaped policy names`
      );

      // Check for escaped \$\$
      assert.doesNotMatch(
        content,
        /\\\$\\\$/,
        `File ${file} must not contain escaped \\$\\$`
      );
    }
  });

  test('MIG-03: Migration 003 is safely idempotent on re-runs when columns are already dropped', () => {
    const content = readFileSync(join(migrationsDir, '003_p1_profile_security_and_drift.sql'), 'utf8');
    
    // Must NOT have raw unprotected UPDATE referencing password
    assert.doesNotMatch(
      content,
      /^UPDATE\s+public\.profiles\s+SET\s+password/m,
      'Migration 003 must not run raw unguarded UPDATE on dropped columns'
    );

    // Must check column existence before updating
    assert.match(content, /information_schema\.columns/i, 'Must inspect information_schema before updating');
    assert.match(content, /DROP COLUMN IF EXISTS password/i, 'Must use IF EXISTS when dropping');
  });

  test('MIG-04: Migration 004 RLS policy has no hardcoded default tenant fallback', () => {
    const content = readFileSync(join(migrationsDir, '004_p1_audit_logs_and_tenant_rls.sql'), 'utf8');
    
    // Check classes_select_policy definition
    const policySection = content.slice(content.indexOf('classes_select_policy'));
    assert.doesNotMatch(
      policySection,
      /institution_id\s*=\s*'inst-dps-001'/,
      'classes_select_policy must not hardcode inst-dps-001 tenant'
    );
  });

  test('MIG-05: Migration 001 helper functions enforce SECURITY DEFINER and search_path', () => {
    const content = readFileSync(join(migrationsDir, '001_secure_rls_policies.sql'), 'utf8');
    
    const securityDefinerCount = (content.match(/SECURITY DEFINER/gi) || []).length;
    const searchPathCount = (content.match(/SET search_path = public/gi) || []).length;

    assert.ok(securityDefinerCount >= 4, 'Must have at least 4 security definer helper functions');
    assert.ok(searchPathCount >= 4, 'Must set safe search_path = public for all security definer functions');
  });

  test('MIG-06: All CREATE POLICY statements are idempotent (preceded by DROP POLICY IF EXISTS)', () => {
    for (const file of migrationFiles) {
      const content = readFileSync(join(migrationsDir, file), 'utf8');
      const createMatches = [...content.matchAll(/CREATE\s+POLICY\s+"?([^"\s]+)"?\s+ON/gi)];

      for (const match of createMatches) {
        const policyName = match[1];
        const dropRegex = new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"?${policyName}"?\\s+ON`, 'i');
        assert.match(
          content,
          dropRegex,
          `In ${file}, CREATE POLICY ${policyName} must be preceded by DROP POLICY IF EXISTS ${policyName}`
        );
      }
    }
  });

  test('MIG-07: No migration contains unconstrained WITH CHECK (true) or FOR ALL ... USING (true)', () => {
    for (const file of migrationFiles) {
      const content = readFileSync(join(migrationsDir, file), 'utf8');
      const stripped = content.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      
      assert.doesNotMatch(
        stripped,
        /WITH\s+CHECK\s*\(\s*true\s*\)/i,
        `Migration ${file} must not contain unconstrained WITH CHECK (true)`
      );
      assert.doesNotMatch(
        stripped,
        /FOR\s+ALL\s+USING\s*\(\s*true\s*\)/i,
        `Migration ${file} must not contain open wildcard FOR ALL USING (true)`
      );
      assert.doesNotMatch(
        stripped,
        /FOR\s+ALL\s+TO\s+public/i,
        `Migration ${file} must not grant open ALL to public`
      );
    }
  });

  test('MIG-08: scripts/execute-supabase-sql.js contains ZERO USING (true) or WITH CHECK (true)', () => {
    const scriptPath = resolve(process.cwd(), 'scripts', 'execute-supabase-sql.js');
    const content = readFileSync(scriptPath, 'utf8');
    
    assert.doesNotMatch(
      content,
      /USING\s*\(\s*true\s*\)/i,
      'scripts/execute-supabase-sql.js must not contain USING (true)'
    );
    assert.doesNotMatch(
      content,
      /WITH\s+CHECK\s*\(\s*true\s*\)/i,
      'scripts/execute-supabase-sql.js must not contain WITH CHECK (true)'
    );
  });

  test('MIG-09: All operational scripts in scripts/ are free of unsafe legacy RLS policies', () => {
    const scriptsDir = resolve(process.cwd(), 'scripts');
    const scriptFiles = readdirSync(scriptsDir).filter(f => f.endsWith('.js'));
    
    for (const file of scriptFiles) {
      const content = readFileSync(join(scriptsDir, file), 'utf8');
      
      assert.doesNotMatch(
        content,
        /CREATE\s+POLICY.*USING\s*\(\s*true\s*\)/is,
        `Script ${file} must not contain CREATE POLICY with USING (true)`
      );
      assert.doesNotMatch(
        content,
        /CREATE\s+POLICY.*WITH\s+CHECK\s*\(\s*true\s*\)/is,
        `Script ${file} must not contain CREATE POLICY with WITH CHECK (true)`
      );
      assert.doesNotMatch(
        content,
        /Public\s+full\s+access/i,
        `Script ${file} must not recreate "Public full access" policies`
      );
    }
  });

  test('MIG-10: Wildcard FOR ALL ... USING (true) is strictly forbidden across all migrations and scripts', () => {
    for (const file of migrationFiles) {
      const content = readFileSync(join(migrationsDir, file), 'utf8');
      const stripped = content.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      assert.doesNotMatch(
        stripped,
        /FOR\s+ALL\s+USING\s*\(\s*true\s*\)/i,
        `Migration ${file} must not grant open wildcard FOR ALL USING (true)`
      );
    }

    const scriptsDir = resolve(process.cwd(), 'scripts');
    const scriptFiles = readdirSync(scriptsDir).filter(f => f.endsWith('.js'));
    for (const file of scriptFiles) {
      const content = readFileSync(join(scriptsDir, file), 'utf8');
      assert.doesNotMatch(
        content,
        /FOR\s+ALL\s+USING\s*\(\s*true\s*\)/i,
        `Script ${file} must not grant open wildcard FOR ALL USING (true)`
      );
    }
  });

  test('MIG-11: Migration 010 drops legacy null student fallback policies', () => {
    const content = readFileSync(join(migrationsDir, '010_clean_legacy_policy_patterns_and_definers.sql'), 'utf8');
    assert.match(
      content,
      /DROP\s+POLICY\s+IF\s+EXISTS\s+"?edtech_ae_insert_own"?\s+ON\s+public\.analytics_events/i,
      'Migration 010 must drop edtech_ae_insert_own fallback policy'
    );
    assert.match(
      content,
      /DROP\s+POLICY\s+IF\s+EXISTS\s+"?edtech_ts_insert_own"?\s+ON\s+public\.test_submissions/i,
      'Migration 010 must drop edtech_ts_insert_own fallback policy'
    );
  });

  test('MIG-12: All UPDATE policies in Migration 010 enforce symmetric USING and WITH CHECK', () => {
    const content = readFileSync(join(migrationsDir, '010_clean_legacy_policy_patterns_and_definers.sql'), 'utf8');
    const updatePolicies = [...content.matchAll(/CREATE\s+POLICY\s+"?([^"\s]+)"?\s+ON\s+public\.(\w+)\s+FOR\s+UPDATE[\s\S]*?;/gi)];

    assert.ok(updatePolicies.length >= 3, 'Must have at least 3 UPDATE policies in Migration 010');
    for (const [statement, policyName] of updatePolicies) {
      assert.match(
        statement,
        /USING\s*\(/i,
        `Policy ${policyName} must define USING clause`
      );
      assert.match(
        statement,
        /WITH\s+CHECK\s*\(/i,
        `Policy ${policyName} must define WITH CHECK clause`
      );
    }
  });

  test('MIG-13: Migration 010 enforces explicit TO authenticated and auth.uid() IS NOT NULL', () => {
    const content = readFileSync(join(migrationsDir, '010_clean_legacy_policy_patterns_and_definers.sql'), 'utf8');
    assert.doesNotMatch(
      content,
      /auth\.role\(\)\s*=\s*'authenticated'/i,
      'Migration 010 must not use loose auth.role() = authenticated'
    );
    assert.match(
      content,
      /auth\.uid\(\)\s+IS\s+NOT\s+NULL/i,
      'Migration 010 must enforce auth.uid() IS NOT NULL'
    );
  });

  test('MIG-14: Migration 011 enforces SECURITY DEFINER helper and explicit authenticated RLS', () => {
    const content = readFileSync(join(migrationsDir, '011_enable_chat_roster_and_classmate_visibility.sql'), 'utf8');
    assert.match(
      content,
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_my_class_ids[\s\S]*?SECURITY\s+DEFINER[\s\S]*?SET\s+search_path\s*=\s*public/i,
      'Migration 011 must define get_my_class_ids with SECURITY DEFINER and search_path = public'
    );
    assert.match(
      content,
      /CREATE\s+POLICY\s+"profiles_select_policy"\s+ON\s+public\.profiles\s+FOR\s+SELECT\s+TO\s+authenticated/i,
      'Migration 011 must set profiles_select_policy TO authenticated'
    );
  });
});
