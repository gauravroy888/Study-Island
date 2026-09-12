import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

describe('Security: Sensitive Secret Leak Detection', () => {
  const ROOT = path.resolve(import.meta.dirname, '..');

  const COMPROMISED_SECRETS = [
    '21b75f7da0ec0dde4d08d3f19d2102f3', // R2 Account ID
    '5fd10d137b4e437c604356c7d14b138c', // R2 Access Key ID
    '229ede3cbc0f2264b9f72545eecf99c12a5e9e06699ba9da08d7544458755693', // R2 Secret Access Key
    ['AQ', 'Ab8RN6JMuh_LoYGXDGPOJ8X1zpGy3nSFu0PPIc20c6JWoYAyBg'].join('.') // Compromised token signature
  ];

  const SCAN_DIRS = [
    path.join(ROOT, 'portals'),
    path.join(ROOT, 'study-island', 'src'),
    path.join(ROOT, 'shared')
  ];

  // Root-level source files that must also be secret-free
  const ROOT_FILES_TO_SCAN = [
    path.join(ROOT, 'r2-client.js'),
    path.join(ROOT, 'server.js'),
    path.join(ROOT, 'bot-widget.js')
  ];

  function getSourceFiles(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item === 'node_modules' || item === '.git' || item === 'dist' || item === 'dist-react') continue;
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        getSourceFiles(fullPath, fileList);
      } else if (/\.(js|jsx|ts|tsx|html|json)$/i.test(item) && item !== 'package-lock.json') {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  test('No Cloudflare R2 secrets or raw Gemini keys in frontend source code', () => {
    const files = [];
    for (const d of SCAN_DIRS) {
      getSourceFiles(d, files);
    }

    const violations = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const secret of COMPROMISED_SECRETS) {
        if (content.includes(secret)) {
          const relPath = path.relative(ROOT, file);
          violations.push({ file: relPath, secretPrefix: secret.slice(0, 8) + '...' });
        }
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      `Found ${violations.length} secret leaks in frontend source files:\n` +
      violations.map(v => `  - ${v.file} (contains ${v.secretPrefix})`).join('\n')
    );
  });

  test('No hardcoded R2 account ID or secrets in root-level source files', () => {
    const violations = [];

    for (const file of ROOT_FILES_TO_SCAN) {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      for (const secret of COMPROMISED_SECRETS) {
        if (content.includes(secret)) {
          const relPath = path.relative(ROOT, file);
          violations.push({ file: relPath, secretPrefix: secret.slice(0, 8) + '...' });
        }
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      `Found ${violations.length} secret leaks in root source files:\n` +
      violations.map(v => `  - ${v.file} (contains ${v.secretPrefix})`).join('\n')
    );
  });

  test('No R2 S3Client direct initialization in frontend portal r2.js modules', () => {
    const portalR2Files = [
      path.join(ROOT, 'portals', 'admin', 'src', 'lib', 'r2.js'),
      path.join(ROOT, 'portals', 'student', 'src', 'lib', 'r2.js'),
      path.join(ROOT, 'portals', 'teacher', 'src', 'lib', 'r2.js')
    ];

    for (const r2File of portalR2Files) {
      if (fs.existsSync(r2File)) {
        const content = fs.readFileSync(r2File, 'utf8');
        assert.ok(
          !content.includes('secretAccessKey'),
          `File ${path.relative(ROOT, r2File)} still contains secretAccessKey configuration!`
        );
        assert.ok(
          !content.includes('@aws-sdk/client-s3'),
          `File ${path.relative(ROOT, r2File)} still imports @aws-sdk/client-s3 for direct client uploads!`
        );
      }
    }
  });

  test('Standalone secret scan script passes with zero violations', () => {
    const scanScriptPath = path.join(ROOT, 'scripts', 'scan-secrets.js');
    assert.ok(fs.existsSync(scanScriptPath), 'scripts/scan-secrets.js must exist');
    const output = execSync(`node "${scanScriptPath}"`, { encoding: 'utf8' });
    assert.ok(output.includes('Zero credential leaks detected'), 'Secret scanner must report zero leaks');
  });
});

