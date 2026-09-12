const { SUPABASE_URL, SUPABASE_ANON_KEY, verifySupabaseJWT } = require('./auth');
const { getMetrics } = require('./metrics');

/**
 * Valid readiness contract statuses
 * - ready: Database connected and responsive (2xx), auth valid.
 * - degraded: Upstream reachable but returning error (4xx, 5xx, or permission failure).
 * - offline: Network/infrastructure failure (DNS lookup, connection refused, timeout).
 * - unconfigured: Required configuration (SUPABASE_URL or SUPABASE_ANON_KEY) is missing.
 */
const READINESS_STATUSES = Object.freeze(['ready', 'degraded', 'offline', 'unconfigured']);

const ERROR_CATEGORIES = Object.freeze([
  'dns_failure',
  'connection_refused',
  'timeout',
  'permission_failure',
  'http_4xx',
  'http_5xx',
  'unconfigured',
  'offline'
]);

/**
 * Checks readiness against the documented readiness contract.
 * Never reports database_connected as true for non-2xx responses.
 * Never leaks API keys, secrets, or JWT tokens in response payloads.
 */
async function checkReadiness(options = {}) {
  const fetchFn = options.fetchFn || fetch;

  let overallStatus = 'unconfigured';
  let errorCategory = null;
  let isDatabaseConnected = false;
  let dbStatus = 'unconfigured';
  let dbError = null;
  let authStatus = 'unconfigured';

  const isAuthConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  if (!isAuthConfigured) {
    overallStatus = 'unconfigured';
    errorCategory = 'unconfigured';
    dbStatus = 'unconfigured';
    dbError = 'CONFIGURATION_MISSING';
    authStatus = 'unconfigured';
  } else {
    try {
      const resp = await fetchFn(`${SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: { apikey: SUPABASE_ANON_KEY }
      });

      if (resp.status >= 200 && resp.status < 300) {
        // 2xx Success -> Connected & Authenticated
        isDatabaseConnected = true;
        dbStatus = 'connected';
        dbError = null;
        authStatus = 'authenticated';
        overallStatus = 'ready';
        errorCategory = null;
      } else if (resp.status === 401 || resp.status === 403) {
        // Permission failure -> NOT connected
        isDatabaseConnected = false;
        dbStatus = 'permission_failure';
        dbError = resp.status === 401 ? 'HTTP_401_UNAUTHORIZED' : 'HTTP_403_FORBIDDEN';
        authStatus = 'permission_failure';
        overallStatus = 'degraded';
        errorCategory = 'permission_failure';
      } else if (resp.status >= 400 && resp.status < 500) {
        // Other 4xx client errors -> NOT connected
        isDatabaseConnected = false;
        dbStatus = 'degraded';
        dbError = `HTTP_${resp.status}`;
        authStatus = 'degraded';
        overallStatus = 'degraded';
        errorCategory = 'http_4xx';
      } else if (resp.status >= 500) {
        // 5xx upstream server error -> NOT connected
        isDatabaseConnected = false;
        dbStatus = 'degraded';
        dbError = `HTTP_${resp.status}`;
        authStatus = 'server_error';
        overallStatus = 'degraded';
        errorCategory = 'http_5xx';
      } else {
        isDatabaseConnected = false;
        dbStatus = 'degraded';
        dbError = `HTTP_${resp.status}`;
        authStatus = 'degraded';
        overallStatus = 'degraded';
        errorCategory = 'http_4xx';
      }
    } catch (err) {
      isDatabaseConnected = false;
      dbStatus = 'unreachable';
      overallStatus = 'offline';
      authStatus = 'unreachable';

      const code = err.code || err.cause?.code;
      const name = err.name || err.cause?.name;
      const msg = String(err.message || '');

      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
        dbError = 'DNS_LOOKUP_FAILED';
        errorCategory = 'dns_failure';
      } else if (code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED')) {
        dbError = 'CONNECTION_REFUSED';
        errorCategory = 'connection_refused';
      } else if (
        code === 'ETIMEDOUT' ||
        code === 'UND_ERR_CONNECT_TIMEOUT' ||
        name === 'TimeoutError' ||
        name === 'AbortError' ||
        msg.toLowerCase().includes('timeout')
      ) {
        dbError = 'NETWORK_TIMEOUT';
        errorCategory = 'timeout';
      } else {
        dbError = 'NETWORK_UNREACHABLE';
        errorCategory = 'offline';
      }
    }
  }

  const storageConfigured = Boolean(
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID && process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  );
  const aiConfigured = Boolean(process.env.GEMINI_API_KEY);

  const isReady = overallStatus === 'ready';

  return {
    ready: isReady,
    status: overallStatus,
    error_category: errorCategory,
    checks: {
      database_connected: isDatabaseConnected,
      database_status: dbStatus,
      database_error: dbError,
      auth_configured: isAuthConfigured,
      auth_status: authStatus,
      storage_configured: storageConfigured,
      ai_configured: aiConfigured
    },
    timestamp: new Date().toISOString()
  };
}

async function handleHealthRequest(req, res, pathname, options = {}) {
  const fetchFn = options.fetchFn || fetch;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  // 1. Liveness probe: /api/health/live
  if (pathname === '/api/health/live') {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify({ status: 'alive' }));
    return;
  }

  // 2. General health: /api/health
  if (pathname === '/api/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify({
      status: 'healthy',
      version: '1.0.0',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 3. Readiness probe: /api/health/ready
  if (pathname === '/api/health/ready') {
    const readiness = await checkReadiness({ fetchFn });
    const statusCode = readiness.ready ? 200 : 503;

    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify(readiness));
    return;
  }

  // 4. Metrics endpoint: /api/metrics (Protected: Admin / SuperAdmin / METRICS_TOKEN only)
  if (pathname === '/api/metrics') {
    const authHeader = req.headers['authorization'];
    const metricsToken = process.env.METRICS_TOKEN;

    let isAuthorized = false;

    // Check optional dedicated metrics token
    if (metricsToken && authHeader === `Bearer ${metricsToken}`) {
      isAuthorized = true;
    } else if (authHeader) {
      // Check authenticated Supabase user role
      const user = await verifySupabaseJWT(authHeader, { fetchFn });
      if (user && ['admin', 'super_admin'].includes(user.role)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized: Admin or Metrics credentials required to view metrics' }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify(getMetrics(), null, 2));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Health endpoint not found' }));
}

module.exports = {
  handleHealthRequest,
  checkReadiness,
  READINESS_STATUSES,
  ERROR_CATEGORIES
};

