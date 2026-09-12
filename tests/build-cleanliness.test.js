import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

describe('Build Output Cleanliness: Stale Artifact Prevention', () => {
  test('study-island/assets must NOT contain stale duplicate component chunks', () => {
    const assetsDir = path.join(ROOT, 'study-island', 'assets');
    assert.ok(fs.existsSync(assetsDir), 'study-island/assets exists');

    const files = fs.readdirSync(assetsDir);
    const componentPrefixes = [
      'UniversalChapterView-',
      'StudyIslandView-',
      'QuizView-',
      'ShadowLabView-',
      'LegacyHtmlView-',
      'ChapterDetailView-',
      'AITutorWidget-',
      'index.source-'
    ];

    for (const prefix of componentPrefixes) {
      const matching = files.filter(f => f.startsWith(prefix) && f.endsWith('.js'));
      assert.ok(
        matching.length <= 1,
        `Found ${matching.length} duplicate chunks for ${prefix} in study-island/assets: ${matching.join(', ')}`
      );
    }
  });

  test('superadmin/assets must NOT contain multiple index-*.js entry chunks', () => {
    const superadminAssetsDir = path.join(ROOT, 'superadmin', 'assets');
    assert.ok(fs.existsSync(superadminAssetsDir), 'superadmin/assets exists');

    const files = fs.readdirSync(superadminAssetsDir);
    const indexChunks = files.filter(f => f.startsWith('index-') && f.endsWith('.js'));
    assert.ok(
      indexChunks.length <= 1,
      `Found ${indexChunks.length} duplicate index-*.js chunks in superadmin/assets: ${indexChunks.join(', ')}`
    );
  });

  test('study-island/scripts/sync-dist.js contains obsolete asset purging logic', () => {
    const syncDistPath = path.join(ROOT, 'study-island', 'scripts', 'sync-dist.js');
    assert.ok(fs.existsSync(syncDistPath), 'sync-dist.js exists');

    const content = fs.readFileSync(syncDistPath, 'utf8');
    assert.ok(
      content.includes('unlinkSync'),
      'sync-dist.js must purge obsolete hashed assets using unlinkSync'
    );
    assert.ok(
      content.includes('hashedAssetPattern'),
      'sync-dist.js must identify hashed assets via pattern match'
    );
  });
});
