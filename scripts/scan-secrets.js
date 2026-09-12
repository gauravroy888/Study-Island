#!/usr/bin/env node
/**
 * scripts/scan-secrets.js
 * Scans repository source files and build output bundles for credential leaks.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SCAN_TARGETS = [
  'portals',
  'study-island',
  'shared',
  'server.js',
  'r2-client.js',
  'supabase-config.js',
  'student',
  'teacher',
  'admin',
  'superadmin'
];

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next'
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp4', '.webm', '.mp3', '.wav',
  '.pdf', '.zip'
]);

// Compromised and dangerous credential signatures
const SENSITIVE_PATTERNS = [
  {
    name: 'Private Key',
    regex: /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY/
  },
  {
    name: 'Known Leaked R2 Secret Key',
    regex: /229ede3cbc0f2264b9f72545eecf99c12a5e9e06699ba9da08d7544458755693/
  },
  {
    name: 'Compromised Gemini Key',
    regex: new RegExp(['AQ', 'Ab8RN6JMuh_LoYGXDGPOJ8X1zpGy3nSFu0PPIc20c6JWoYAyBg'].join('\\.'))
  },
  {
    name: 'Hardcoded R2 / AWS Secret Access Key Assignment',
    regex: /(?:aws_secret_access_key|secretAccessKey|r2_secret_access_key)\s*[:=]\s*["'][A-Za-z0-9/+=]{30,}["']/i
  },
  {
    name: 'Supabase Service Role Secret Key',
    regex: /service_role["']?\s*:\s*["']ey[A-Za-z0-9._-]+["']/i
  }
];

let leaksFound = 0;
const violations = [];

function scanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return;
  if (path.basename(filePath) === 'package-lock.json') return;

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return;
  }

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.regex.test(content)) {
      const relPath = path.relative(ROOT, filePath);
      violations.push({ file: relPath, pattern: pattern.name });
      leaksFound++;
    }
  }
}

function walk(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const basename = path.basename(dirPath);
  if (IGNORE_DIRS.has(basename)) return;

  const stat = fs.statSync(dirPath);
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      walk(path.join(dirPath, entry));
    }
  } else if (stat.isFile()) {
    scanFile(dirPath);
  }
}

console.log('🔍 Starting comprehensive secret scan across source code and build bundles...');

for (const target of SCAN_TARGETS) {
  walk(path.join(ROOT, target));
}

if (leaksFound > 0) {
  console.error(`\n🚨 CRITICAL: Detected ${leaksFound} credential leak(s):`);
  for (const v of violations) {
    console.error(`  - [${v.pattern}] in ${v.file}`);
  }
  process.exit(1);
}

console.log('✅ Secret scan PASSED: Zero credential leaks detected.');
process.exit(0);
