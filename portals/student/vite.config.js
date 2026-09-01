import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf'
};

function servePlatformStatic() {
  const platformDir = path.resolve(__dirname, '..', '..');
  const primaryStudyIsland = path.resolve(platformDir, 'study-island');
  const secondaryStudyIsland = path.resolve(platformDir, '..', 'study-island');

  return {
    name: 'serve-platform-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url || '';
        const pathname = decodeURIComponent(rawUrl.split('?')[0]);

        // 1. Serve /study-island and all internal assets
        if (pathname === '/study-island' || pathname.startsWith('/study-island/')) {
          let relativePath = pathname.replace(/^\/study-island/, '');
          if (!relativePath || relativePath === '/' || relativePath === '/index.html') {
            relativePath = '/index.html';
          }
          let filePath = path.join(primaryStudyIsland, relativePath);
          if (relativePath === '/index.html' && fs.existsSync(path.join(primaryStudyIsland, 'dist', 'index.html'))) {
            filePath = path.join(primaryStudyIsland, 'dist', 'index.html');
          }
          if (!fs.existsSync(filePath)) {
            filePath = path.join(secondaryStudyIsland, relativePath);
            if (relativePath === '/index.html' && fs.existsSync(path.join(secondaryStudyIsland, 'dist', 'index.html'))) {
              filePath = path.join(secondaryStudyIsland, 'dist', 'index.html');
            }
          }

          if (fs.existsSync(filePath)) {
            if (fs.statSync(filePath).isDirectory()) {
              filePath = fs.existsSync(path.join(filePath, 'dist', 'index.html'))
                ? path.join(filePath, 'dist', 'index.html')
                : path.join(filePath, 'index.html');
            }
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              const ext = path.extname(filePath).toLowerCase();
              const contentType = MIME_TYPES[ext] || 'application/octet-stream';
              res.setHeader('Content-Type', contentType);
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
        }

        // 2. Serve /login.html or /login
        if (pathname === '/login.html' || pathname === '/login') {
          const loginPath = path.join(platformDir, 'login.html');
          if (fs.existsSync(loginPath)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            fs.createReadStream(loginPath).pipe(res);
            return;
          }
        }

        // 3. Serve bot-widget.js + bot-widget.css from platform root
        if (pathname === '/bot-widget.js' || pathname === '/bot-widget.css') {
          const filePath = path.join(platformDir, pathname.slice(1));
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            res.setHeader('Content-Type', MIME_TYPES[ext] || 'text/plain');
            res.setHeader('Access-Control-Allow-Origin', '*');
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }

        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), servePlatformStatic()],
  base: './',
  server: {
    port: 3000,
    open: true,
    strictPort: true,   // fail fast if 3000 is taken
    fs: {
      allow: ['..', '../..']
    }
  },
  build: {
    outDir: '../../student',
    emptyOutDir: true
  }
})
