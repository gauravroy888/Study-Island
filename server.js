const http = require('http');

// Load environment variables from .env in development.
try { require('dotenv').config(); } catch (_) { /* dotenv is optional */ }

const { applySecurityHeaders, handleStaticRequest } = require('./server/static');
const { handleR2Upload } = require('./server/upload');
const { handleAIChat } = require('./server/ai');
const { handleAuditLog } = require('./server/audit');
const { handleSuperAdminRequest } = require('./server/superadmin');
const { handleHealthRequest } = require('./server/health');
const { createRequestId } = require('./server/logger');
const { setupWebSocketServer } = require('./server/websocket');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// SECURITY: Allowed CORS origins (NOT wildcard '*').
const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://gauravroy888.github.io',
  'https://working-platform.netlify.app'
]);

const server = http.createServer(async (req, res) => {
  // Generate & assign Request Correlation ID
  const requestId = createRequestId();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Restrict CORS to known origins and any local dev origin (localhost / 127.0.0.1)
  const requestOrigin = req.headers['origin'];
  const isLocalOrigin = requestOrigin && (requestOrigin.startsWith('http://localhost:') || requestOrigin.startsWith('http://127.0.0.1:'));
  const allowedOrigin = (ALLOWED_ORIGINS.has(requestOrigin) || isLocalOrigin) ? requestOrigin : null;

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');

  // Apply security headers
  applySecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  // 🏥 HEALTH & METRICS ENDPOINTS
  if (pathname.startsWith('/api/health') || pathname === '/api/metrics') {
    await handleHealthRequest(req, res, pathname);
    return;
  }

  // ☁️ CLOUDFLARE R2 DIRECT UPLOAD API ENDPOINT
  if (pathname === '/api/upload-r2' && req.method === 'POST') {
    await handleR2Upload(req, res, url);
    return;
  }

  // 🤖 SERVER-SIDE AI PROXY ENDPOINT
  if (pathname === '/api/ai/chat' && req.method === 'POST') {
    await handleAIChat(req, res);
    return;
  }

  // 📋 SERVER-SIDE AUDIT LOGGING ENDPOINT
  if (pathname === '/api/audit-log' && req.method === 'POST') {
    await handleAuditLog(req, res);
    return;
  }

  // 👑 SERVER-SIDE SUPERADMIN PRIVILEGED ENDPOINTS
  if (pathname.startsWith('/api/superadmin/')) {
    await handleSuperAdminRequest(req, res, pathname);
    return;
  }

  // 📁 STATIC FILE SERVING & SPA ROUTING
  handleStaticRequest(req, res, pathname, url);
});

// Attach Native WebSocket Server
setupWebSocketServer(server);

// Start server listening
if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`🚀 Cognitive Island Local Server running at http://${HOST}:${PORT}`);
    console.log(`📡 Native WebSocket Presence Server attached to ws://${HOST}:${PORT}`);
    console.log(`👉 Landing Page:      http://${HOST}:${PORT}/index.html`);
    console.log(`👉 Login:             http://${HOST}:${PORT}/login.html`);
    console.log(`👉 SuperAdmin Portal: http://${HOST}:${PORT}/superadmin/`);
    console.log(`👉 Admin Portal:      http://${HOST}:${PORT}/admin/`);
    console.log(`👉 Teacher Portal:    http://${HOST}:${PORT}/teacher/`);
    console.log(`👉 Student Portal:    http://${HOST}:${PORT}/student/`);
    console.log(`👉 Study Island:      http://${HOST}:${PORT}/study-island/`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Server Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Server Unhandled Rejection]:', reason);
});

module.exports = server;
