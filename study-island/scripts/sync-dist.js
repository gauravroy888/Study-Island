import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const studyIslandDir = path.resolve(__dirname, '..');
const distDir = path.join(studyIslandDir, 'dist');
const distAssetsDir = path.join(distDir, 'assets');
const targetAssetsDir = path.join(studyIslandDir, 'assets');

// 1. Copy dist/assets -> study-island/assets
if (fs.existsSync(distAssetsDir)) {
  if (!fs.existsSync(targetAssetsDir)) {
    fs.mkdirSync(targetAssetsDir, { recursive: true });
  }
  const files = fs.readdirSync(distAssetsDir);
  for (const file of files) {
    const src = path.join(distAssetsDir, file);
    const dest = path.join(targetAssetsDir, file);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, dest);
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
    fs.copyFileSync(candidate, targetHtml);
    console.log(`✅ Updated ${targetHtml} from ${candidate}`);
    break;
  }
}
