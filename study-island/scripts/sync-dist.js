import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const studyIslandDir = path.resolve(__dirname, '..');
const distDir = path.join(studyIslandDir, 'dist');
const distAssetsDir = path.join(distDir, 'assets');
const targetAssetsDir = path.join(studyIslandDir, 'assets');

function safeCopy(src, dest) {
  try {
    fs.copyFileSync(src, dest);
  } catch {
    fs.writeFileSync(dest, fs.readFileSync(src));
  }
}

// 1. Reconcile and copy dist/assets -> study-island/assets
if (fs.existsSync(distAssetsDir)) {
  if (!fs.existsSync(targetAssetsDir)) {
    fs.mkdirSync(targetAssetsDir, { recursive: true });
  }

  const distFiles = new Set(fs.readdirSync(distAssetsDir));
  const existingTargetFiles = fs.readdirSync(targetAssetsDir);
  let purgedCount = 0;

  // Hashed build artifact pattern: e.g. name-XXXXXXXX.js, name-XXXXXXXX.css
  const hashedAssetPattern = /-[a-zA-Z0-9_-]{7,}\.(js|css|map|svg|jpg|jpeg|png|webp)$/i;

  for (const file of existingTargetFiles) {
    const targetFilePath = path.join(targetAssetsDir, file);
    if (fs.statSync(targetFilePath).isFile()) {
      // If it's a hashed asset that no longer exists in current dist, purge it
      if (hashedAssetPattern.test(file) && !distFiles.has(file)) {
        fs.unlinkSync(targetFilePath);
        purgedCount++;
      }
    }
  }

  if (purgedCount > 0) {
    console.log(`🧹 Purged ${purgedCount} obsolete hashed build assets from ${targetAssetsDir}`);
  }

  const files = fs.readdirSync(distAssetsDir);
  for (const file of files) {
    const src = path.join(distAssetsDir, file);
    const dest = path.join(targetAssetsDir, file);
    if (fs.statSync(src).isFile()) {
      safeCopy(src, dest);
    }
  }
  console.log(`✅ Synced ${files.length} build asset files to ${targetAssetsDir}`);
}

// 2. Copy dist/index.source.html (or dist/index.html) -> study-island/index.html
const distHtmlCandidates = [
  path.join(distDir, 'index.source.html'),
  path.join(distDir, 'index.html')
];

for (const candidate of distHtmlCandidates) {
  if (fs.existsSync(candidate)) {
    const targetHtml = path.join(studyIslandDir, 'index.html');
    safeCopy(candidate, targetHtml);
    console.log(`✅ Updated ${targetHtml} from ${candidate}`);
    break;
  }
}

// 3. Synchronize canonical analytics into quiz.html and copy to dist/quiz.html
try {
  const { syncQuizAnalytics } = await import('./sync-quiz-analytics.js');
  syncQuizAnalytics();
} catch (err) {
  console.warn('⚠️ syncQuizAnalytics error:', err.message);
}

const srcQuiz = path.join(studyIslandDir, 'quiz.html');
const destQuiz = path.join(distDir, 'quiz.html');
if (fs.existsSync(srcQuiz)) {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  safeCopy(srcQuiz, destQuiz);
  console.log(`✅ Synced ${srcQuiz} -> ${destQuiz}`);
}
