const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

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
  '.pdf': 'application/pdf',
  '.csv': 'text/csv; charset=utf-8'
};

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

const HASHED_ASSET_REGEX = /-[a-zA-Z0-9_-]{7,}\.(js|css|map|svg|jpg|jpeg|png|webp|woff2|wasm)$/i;

function getCacheControl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html' || !ext) {
    return 'no-cache, must-revalidate';
  }
  const basename = path.basename(filePath);
  if (HASHED_ASSET_REGEX.test(basename)) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=3600';
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "connect-src 'self' https://qmyrxvtbzlbnvzxypnus.supabase.co wss://qmyrxvtbzlbnvzxypnus.supabase.co https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev ws: wss:",
      "frame-src 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );
}

function render404Page(pathname) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>404 - Page Not Found | EdTech Island</title>
  <style>
    body { margin:0; font-family: system-ui, -apple-system, sans-serif; background:#070d18; color:#fff; display:flex; align-items:center; justify-content:center; min-height:100vh; text-align:center; padding:20px; }
    .card { background: rgba(13,20,36,0.85); border: 1px solid rgba(0,240,255,0.3); border-radius:24px; padding: 48px 36px; max-width:480px; backdrop-filter:blur(20px); box-shadow:0 20px 60px rgba(0,0,0,0.5); }
    h1 { font-size:4rem; margin:0 0 8px 0; color:#00F0FF; font-weight:900; }
    h2 { font-size:1.4rem; margin:0 0 16px 0; }
    p { color:#94a3b8; font-size:0.95rem; line-height:1.6; margin-bottom:28px; }
    a { display:inline-block; padding:12px 28px; background:linear-gradient(135deg,#00F0FF,#3B82F6); color:#000; font-weight:800; border-radius:14px; text-decoration:none; box-shadow:0 0 20px rgba(0,240,255,0.4); }
  </style>
</head>
<body>
  <div class="card">
    <h1>404</h1>
    <h2>Island Portal Not Found</h2>
    <p>The path <code>${pathname}</code> does not exist on this EdTech Island server.</p>
    <a href="/index.html">← Return to Home</a>
  </div>
</body>
</html>`;
}

function handleStaticRequest(req, res, pathname, url) {
  // SECURITY: Prevent path traversal attacks
  const rawUrl = req.url || '';
  if (rawUrl.includes('..') || pathname.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Reject unhandled API routes with JSON 404
  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: `API endpoint not found: ${pathname}` }));
    return;
  }

  // Redirect bare directory paths without trailing slash to enforce proper relative asset resolution
  if (pathname === '/study-island' || pathname === '/admin' || pathname === '/teacher' || pathname === '/student' || pathname === '/superadmin') {
    res.writeHead(301, { Location: pathname + '/' + (url ? url.search : '') });
    res.end();
    return;
  }

  // Normalize root path
  if (pathname === '/') {
    pathname = '/index.html';
  }

  let filePath = path.join(ROOT, pathname);

  // SECURITY: Prevent path traversal attacks
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Check if requested path is a directory
  let isDirectory = false;
  try {
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      isDirectory = true;
      const distIndexHtml = path.join(filePath, 'dist', 'index.html');
      const indexHtml = path.join(filePath, 'index.html');
      if (fs.existsSync(distIndexHtml)) {
        filePath = distIndexHtml;
      } else if (fs.existsSync(indexHtml)) {
        filePath = indexHtml;
      }
    }
  } catch (_) {
    // stat failed, file does not exist yet at exact path
  }

  // Route resolution & SPA rewrites when file not found directly
  if (!fs.existsSync(filePath) || isDirectory) {
    if (pathname === '/login' || pathname === '/login.html') {
      filePath = path.join(ROOT, 'login.html');
    } else if (pathname === '/superadmin-login' || pathname === '/superadmin-login.html') {
      filePath = path.join(ROOT, 'superadmin-login.html');
    } else if ((pathname === '/dashboard' || pathname.startsWith('/student')) && !path.extname(pathname)) {
      filePath = path.join(ROOT, 'student', 'index.html');
    } else if (pathname.startsWith('/teacher') && !path.extname(pathname)) {
      filePath = path.join(ROOT, 'teacher', 'index.html');
    } else if (pathname.startsWith('/admin') && !path.extname(pathname)) {
      filePath = path.join(ROOT, 'admin', 'index.html');
    } else if ((pathname === '/superadmin' || pathname.startsWith('/superadmin/')) && !path.extname(pathname)) {
      filePath = path.join(ROOT, 'superadmin', 'index.html');
    } else if (pathname.startsWith('/study-island') && !path.extname(pathname)) {
      filePath = fs.existsSync(path.join(ROOT, 'study-island', 'dist', 'index.html'))
        ? path.join(ROOT, 'study-island', 'dist', 'index.html')
        : path.join(ROOT, 'study-island', 'index.html');
    } else if (!path.extname(pathname) && fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    }
  }

  // Stream resolved file or return 404
  fs.readFile(filePath, (readErr, content) => {
    if (readErr) {
      res.writeHead(404, { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, must-revalidate'
      });
      res.end(render404Page(pathname));
      return;
    }

    const headers = {
      'Content-Type': getContentType(filePath),
      'Cache-Control': getCacheControl(filePath)
    };
    res.writeHead(200, headers);
    res.end(content);
  });
}

module.exports = {
  ROOT,
  MIME_TYPES,
  getContentType,
  getCacheControl,
  applySecurityHeaders,
  render404Page,
  handleStaticRequest
};
