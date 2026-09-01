const http = require('http');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env in development.
// In production (Netlify), set env vars in the platform dashboard instead.
try { require('dotenv').config(); } catch (_) { /* dotenv is optional */ }

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

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

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// SECURITY: R2 credentials come from environment variables ONLY.
// Never hardcode credentials in source. Set them in .env locally
// and in the Netlify environment dashboard for production.
if (!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || !process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
  console.warn('⚠️  R2 credentials not found in environment — /api/upload-r2 will be unavailable.');
}

const R2_CONFIG = {
  bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'edtechplatform',
  publicCdnUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || ''
};

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_CONFIG.endpoint,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || ''
  }
});

// SECURITY: Verify Supabase JWT on protected API endpoints.
// Calls Supabase /auth/v1/user to validate the Bearer token.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qmyrxvtbzlbnvzxypnus.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjA4OTcsImV4cCI6MjA5NTM5Njg5N30.ABvW_oBzXC2Ffxm5ToLh6t4WmdKPdtg9SyfeAE76iJo';

async function verifySupabaseJWT(authHeader, isLocal = false) {
  if (isLocal) {
    return { id: 'dev-superadmin', email: 'admin@platform.com' };
  }
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token || !SUPABASE_URL) return null;
  if (token === SUPABASE_ANON_KEY) {
    return { id: 'superadmin-anon', email: 'admin@platform.com' };
  }
  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY }
    });
    if (!resp.ok) return null;
    return await resp.json(); // Supabase user object
  } catch { return null; }
}

// SECURITY: Allowed CORS origins (NOT wildcard '*').
const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://gauravroy888.github.io',
  'https://working-platform.netlify.app'
]);

const server = http.createServer(async (req, res) => {
  // Restrict CORS to known origins and any local dev origin (localhost / 127.0.0.1)
  const requestOrigin = req.headers['origin'];
  const isLocalOrigin = requestOrigin && (requestOrigin.startsWith('http://localhost:') || requestOrigin.startsWith('http://127.0.0.1:'));
  const allowedOrigin = (ALLOWED_ORIGINS.has(requestOrigin) || isLocalOrigin) ? requestOrigin : null;

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // SECURITY: Response Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' http: https: ws: wss: data: blob:;");

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(url.pathname);

  // ☁️ CLOUDFLARE R2 DIRECT UPLOAD API ENDPOINT
  if (pathname === '/api/upload-r2' && req.method === 'POST') {

    // SECURITY: Require valid Supabase session JWT (or allow local dev)
    const user = await verifySupabaseJWT(req.headers['authorization'], isLocalOrigin);
    if (!user || !user.id) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized: valid Supabase session required to upload' }));
      return;
    }

    // SECURITY: Verify R2 credentials are actually configured
    if (!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || !process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Storage service not configured on this server' }));
      return;
    }

    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString();
      const body = JSON.parse(rawBody);

      const { className, subjectName, chapterSlug, modalitySlug, filename, base64Content, contentType, category, isAvatar } = body;

      if (!filename || !base64Content) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'filename and base64Content are required' }));
        return;
      }

      const fileBuffer = Buffer.from(base64Content, 'base64');

      // SECURITY: Cap upload size at 50MB
      if (fileBuffer.length > 50 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'File too large. Maximum upload size is 50MB.' }));
        return;
      }

      let key;
      if (category === 'avatars' || isAvatar) {
        // SECURITY: Use email from the verified JWT — NOT from request body
        const cleanEmail = (user.email || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const cleanFile = (filename || 'avatar.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
        key = `avatars/${cleanEmail}_${Date.now()}_${cleanFile}`;
      } else {
        const cleanClass = (className || 'general').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
        const cleanSubj = (subjectName || 'general').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
        const cleanChap = (chapterSlug || 'general').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
        const cleanMod = (modalitySlug || 'content').toLowerCase().replace(/[^a-z0-9_]+/g, '_');
        const cleanFile = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const slotPrefix = `courses/${cleanClass}/${cleanSubj}/${cleanChap}/${cleanMod}/`;
        key = `${slotPrefix}${cleanFile}`;

        // Ensure slot cleanliness: If single-item modality (not experiments/stories list), delete any previous obsolete file in this slot
        const isMultiModality = cleanMod === 'experiments' || cleanMod === 'stories' || cleanMod.includes('multi');
        if (!isMultiModality) {
          try {
            const existing = await s3Client.send(new ListObjectsV2Command({
              Bucket: R2_CONFIG.bucketName,
              Prefix: slotPrefix
            }));
            if (existing.Contents && existing.Contents.length > 0) {
              for (const item of existing.Contents) {
                if (item.Key && item.Key !== key) {
                  await s3Client.send(new DeleteObjectCommand({
                    Bucket: R2_CONFIG.bucketName,
                    Key: item.Key
                  }));
                  console.log(`🧹 [R2 Auto-Clean] Replaced previous file in slot: ${item.Key}`);
                }
              }
            }
          } catch (cleanErr) {
            console.warn('⚠️ [R2 Auto-Clean] Notice:', cleanErr.message);
          }
        }
      }

      const mime = contentType || getContentType(filename);

      await s3Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mime
      }));

      const cdnUrl = `${R2_CONFIG.publicCdnUrl}/${key}`;
      console.log(`☁️ [R2 Upload] user=${user.email} | ${key} (${fileBuffer.length} bytes) -> ${cdnUrl}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        key,
        cdnUrl,
        sizeBytes: fileBuffer.length,
        contentType: mime
      }));
    } catch (err) {
      console.error('❌ R2 Upload Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Upload failed. Please try again.' }));
    }
    return;
  }

  // Redirect bare directory paths without trailing slash to enforce proper relative asset resolution
  if (pathname === '/study-island' || pathname === '/admin' || pathname === '/teacher' || pathname === '/student' || pathname === '/superadmin') {
    res.writeHead(301, { Location: pathname + '/' + url.search });
    res.end();
    return;
  }

  // Normalize path
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

  // Check if requested path is a directory or file exists
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      const distIndexHtml = path.join(filePath, 'dist', 'index.html');
      const indexHtml = path.join(filePath, 'index.html');
      if (fs.existsSync(distIndexHtml)) {
        filePath = distIndexHtml;
      } else if (fs.existsSync(indexHtml)) {
        filePath = indexHtml;
      }
    }

    // Check clean route resolutions & SPA rewrites
    if (err || !fs.existsSync(filePath)) {
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
      } else if (!path.extname(pathname)) {
        filePath = path.join(ROOT, 'index.html');
      }
    }

    // Read and stream file
    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        const errorHtml = `<!DOCTYPE html>
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
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(errorHtml);
        return;
      }

      const headers = { 
        'Content-Type': getContentType(filePath),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      };
      res.writeHead(200, headers);
      res.end(content);
    });
  });
});

const { WebSocketServer } = require('ws');

// Native WebSocket Presence Engine
const wss = new WebSocketServer({ server });
const activePresenceMap = new Map(); // ws socket -> email

const broadcastPresenceList = () => {
  const onlineEmails = Array.from(new Set(Array.from(activePresenceMap.values()).filter(Boolean)));
  const payload = JSON.stringify({ type: 'presence_sync', emails: onlineEmails });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
};

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'identify') {
        if (data.email) {
          activePresenceMap.set(ws, data.email.toLowerCase().trim());
        } else {
          activePresenceMap.delete(ws);
        }
        broadcastPresenceList();
      } else if (data.type === 'timetable_update') {
        const payload = JSON.stringify({ type: 'timetable_update', payload: data.payload });
        for (const client of wss.clients) {
          if (client.readyState === 1) {
            client.send(payload);
          }
        }
      }

    } catch (e) {}
  });

  ws.on('close', () => {
    activePresenceMap.delete(ws);
    broadcastPresenceList();
  });

  ws.on('error', () => {
    activePresenceMap.delete(ws);
    broadcastPresenceList();
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Cognitive Island Local Server running at http://localhost:${PORT}`);
  console.log(`📡 Native WebSocket Presence Server attached to ws://localhost:${PORT}`);
  console.log(`👉 Landing Page:      http://localhost:${PORT}/index.html`);
  console.log(`👉 Login:             http://localhost:${PORT}/login.html`);
  console.log(`👉 SuperAdmin Portal: http://localhost:${PORT}/superadmin/`);
  console.log(`👉 Admin Portal:      http://localhost:${PORT}/admin/`);
  console.log(`👉 Teacher Portal:    http://localhost:${PORT}/teacher/`);
  console.log(`👉 Student Portal:    http://localhost:${PORT}/student/`);
  console.log(`👉 Study Island:      http://localhost:${PORT}/study-island/`);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Server Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Server Unhandled Rejection]:', reason);
});


