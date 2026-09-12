const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DEFAULT_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'qmyrxvtbzlbnvzxypnus';
const DEFAULT_MIGRATIONS_DIR = path.resolve(__dirname, '../database-migrations');

/**
 * Numerically sorts migration filenames based on their leading integer prefix.
 * e.g., '001_...' < '002_...' < '010_...'
 */
function sortMigrations(fileList) {
  return [...fileList].sort((a, b) => {
    const numA = parseInt(a.split('_')[0], 10);
    const numB = parseInt(b.split('_')[0], 10);
    if (isNaN(numA) || isNaN(numB)) {
      return a.localeCompare(b);
    }
    return numA - numB;
  });
}

/**
 * Discovers and numerically sorts all .sql files in the migrations directory.
 */
function discoverMigrations(dirPath = DEFAULT_MIGRATIONS_DIR) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Migrations directory not found: ${dirPath}`);
  }
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.sql'));
  const sorted = sortMigrations(files);
  return sorted.map(filename => ({
    filename,
    fullPath: path.join(dirPath, filename),
    number: parseInt(filename.split('_')[0], 10),
    name: filename.replace(/\.sql$/, '')
  }));
}

/**
 * Sanitizes any sensitive tokens or secrets from log messages.
 */
function sanitizeMessage(msg, secrets = []) {
  let sanitized = String(msg || '');
  for (const secret of secrets) {
    if (secret && typeof secret === 'string' && secret.trim().length > 4) {
      sanitized = sanitized.split(secret).join('[REDACTED]');
    }
  }
  // Sanitize standard JWT tokens
  sanitized = sanitized.replace(/Bearer\s+eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, 'Bearer [REDACTED_JWT]');
  return sanitized;
}

/**
 * Queries the list of applied migration names from supabase_migrations.schema_migrations.
 */
async function fetchAppliedMigrations(projectRef, accessToken, fetchFn = fetch) {
  const query = 'SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;';
  const res = await fetchFn(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`Failed to query schema_migrations (HTTP ${res.status}): ${sanitizeMessage(errorBody, [accessToken])}`);
  }

  const rows = await res.json();
  const appliedNames = new Set();
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (row.name) appliedNames.add(row.name);
      if (row.version) appliedNames.add(row.version);
    }
  }
  return appliedNames;
}

/**
 * Determines if a migration is already applied based on tracked schema migrations.
 */
function isMigrationApplied(migration, appliedSet) {
  if (!appliedSet || !(appliedSet instanceof Set)) return false;
  // Match by full name e.g. '008_cleanup_legacy_unsafe_policies_and_drift'
  if (appliedSet.has(migration.name)) return true;
  // Match by version without number prefix if stored by slug
  const slug = migration.name.replace(/^\d+_/, '');
  if (appliedSet.has(slug)) return true;
  // Match by prefix if version contains it
  for (const applied of appliedSet) {
    if (applied.includes(migration.name) || (slug.length > 5 && applied.includes(slug))) {
      return true;
    }
  }
  return false;
}

/**
 * Executes a single migration against the Supabase database.
 */
async function executeMigration(projectRef, accessToken, migration, fetchFn = fetch) {
  const sql = fs.readFileSync(migration.fullPath, 'utf8');

  // Wrap execution and record into schema_migrations if successful
  const recordSql = `
    INSERT INTO supabase_migrations.schema_migrations (version, name)
    VALUES ('${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}_${String(migration.number).padStart(3, '0')}', '${migration.name}')
    ON CONFLICT (version) DO NOTHING;
  `;

  const compoundQuery = `${sql}\n\n-- Record migration\n${recordSql}`;

  const res = await fetchFn(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: compoundQuery })
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${sanitizeMessage(errorBody, [accessToken])}`);
  }

  return await res.text();
}

/**
 * Main migration workflow runner.
 */
async function runMigrations(options = {}) {
  const isDirectCli = require.main === module;
  const {
    dryRun = process.argv.includes('--dry-run'),
    projectRef = process.env.SUPABASE_PROJECT_REF || DEFAULT_PROJECT_REF,
    accessToken = process.env.SUPABASE_TOKEN,
    migrationsDir = DEFAULT_MIGRATIONS_DIR,
    fetchFn = globalThis.fetch,
    logger = console,
    setExitCode = isDirectCli
  } = options;

  logger.log('====================================================');
  logger.log(`📦 Supabase Migration Runner (${dryRun ? 'DRY RUN' : 'LIVE EXECUTION'})`);
  logger.log(`Target Project: ${projectRef}`);
  logger.log(`Directory:      ${migrationsDir}`);
  logger.log('====================================================');

  const migrations = discoverMigrations(migrationsDir);
  logger.log(`Discovered ${migrations.length} migration file(s) in canonical order.`);

  if (!accessToken && !dryRun) {
    const errMsg = '❌ Error: SUPABASE_TOKEN not configured in environment. Execution aborted.';
    logger.error(errMsg);
    if (setExitCode && typeof process !== 'undefined') process.exitCode = 1;
    return { ok: false, error: errMsg, applied: [], skipped: [], pending: migrations.map(m => m.filename) };
  }

  let appliedSet = new Set();
  if (accessToken) {
    try {
      appliedSet = await fetchAppliedMigrations(projectRef, accessToken, fetchFn);
      logger.log(`Found ${appliedSet.size} applied migration record(s) in database.`);
    } catch (err) {
      const errMsg = `❌ Error querying migration history: ${err.message}`;
      logger.error(errMsg);
      if (setExitCode && typeof process !== 'undefined') process.exitCode = 1;
      return { ok: false, error: errMsg, applied: [], skipped: [], pending: [] };
    }
  } else if (dryRun) {
    logger.log('ℹ️  No SUPABASE_TOKEN in environment: dry-run inspecting local file sequence only.');
  }

  const applied = [];
  const skipped = [];
  const pending = [];

  for (const mig of migrations) {
    if (isMigrationApplied(mig, appliedSet)) {
      skipped.push(mig.filename);
    } else {
      pending.push(mig);
    }
  }

  logger.log(`\n📋 Status: ${skipped.length} already applied, ${pending.length} pending.`);

  if (dryRun) {
    logger.log('\n🔍 [DRY RUN] Would execute the following pending migration(s):');
    if (pending.length === 0) {
      logger.log('   (No pending migrations. All migrations up-to-date.)');
    } else {
      for (const m of pending) {
        logger.log(`   - [PENDING] ${m.filename}`);
      }
    }
    return { ok: true, dryRun: true, applied: [], skipped, pending: pending.map(m => m.filename) };
  }

  for (const mig of pending) {
    logger.log(`\n🚀 Executing: ${mig.filename}...`);
    try {
      await executeMigration(projectRef, accessToken, mig, fetchFn);
      logger.log(`✅ Success: ${mig.filename}`);
      applied.push(mig.filename);
      appliedSet.add(mig.name);
    } catch (err) {
      const safeErr = sanitizeMessage(err.message, [accessToken]);
      logger.error(`❌ Migration Failed: ${mig.filename} -> ${safeErr}`);
      logger.error('🛑 Halting immediately on first failure to prevent database corruption.');
      if (setExitCode && typeof process !== 'undefined') process.exitCode = 1;
      return {
        ok: false,
        error: safeErr,
        failedFile: mig.filename,
        applied,
        skipped,
        pending: pending.filter(p => p.filename !== mig.filename && !applied.includes(p.filename)).map(p => p.filename)
      };
    }
  }

  logger.log('\n====================================================');
  logger.log('🎉 Migration Run Complete!');
  logger.log(`Applied: ${applied.length} | Skipped: ${skipped.length} | Failed: 0`);
  logger.log('====================================================');

  return { ok: true, applied, skipped, pending: [] };
}

async function executeSql(options = {}) {
  return runMigrations(options);
}

if (require.main === module) {
  runMigrations();
}

module.exports = {
  sortMigrations,
  discoverMigrations,
  sanitizeMessage,
  fetchAppliedMigrations,
  isMigrationApplied,
  executeMigration,
  runMigrations,
  executeSql
};
