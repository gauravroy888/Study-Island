import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  handleHealthRequest,
  checkReadiness,
  READINESS_STATUSES,
  ERROR_CATEGORIES
} = require('../server/health.js');

function createMockRes() {
  return {
    statusCode: null,
    headers: {},
    body: '',
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(data) {
      this.body = data;
    }
  };
}

describe('Health & Readiness Contract, Error Categorization & Metrics Protection', () => {

  // ── 1. CONTRACT SPECIFICATION TESTS ─────────────────────────────────────
  test('Contract exports valid READINESS_STATUSES and ERROR_CATEGORIES arrays', () => {
    assert.deepStrictEqual([...READINESS_STATUSES], ['ready', 'degraded', 'offline', 'unconfigured']);
    assert.ok(ERROR_CATEGORIES.includes('dns_failure'));
    assert.ok(ERROR_CATEGORIES.includes('connection_refused'));
    assert.ok(ERROR_CATEGORIES.includes('timeout'));
    assert.ok(ERROR_CATEGORIES.includes('permission_failure'));
    assert.ok(ERROR_CATEGORIES.includes('http_4xx'));
    assert.ok(ERROR_CATEGORIES.includes('http_5xx'));
    assert.ok(ERROR_CATEGORIES.includes('unconfigured'));
    assert.ok(ERROR_CATEGORIES.includes('offline'));
  });

  // ── 2. ENDPOINT 1: GET /api/health ──────────────────────────────────────
  test('GET /api/health returns 200 with platform health, uptime, and no secrets', async () => {
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();

    await handleHealthRequest(req, res, '/api/health');

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, 'healthy');
    assert.strictEqual(typeof body.version, 'string');
    assert.strictEqual(typeof body.uptime_seconds, 'number');
    assert.strictEqual(typeof body.timestamp, 'string');

    // Verify no secret leak
    const raw = JSON.stringify(body);
    assert.ok(!raw.includes('eyJhbGciOi'));
    assert.ok(!raw.includes('service_role'));
  });

  // ── 3. ENDPOINT 2: GET /api/health/live ──────────────────────────────────
  test('GET /api/health/live returns 200 with alive status', async () => {
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();

    await handleHealthRequest(req, res, '/api/health/live');

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, 'alive');
  });

  // ── 4. ENDPOINT 3: GET /api/health/ready ─────────────────────────────────
  test('GET /api/health/ready returns 200 when system is ready', async () => {
    const mockSuccessFetch = async () => ({ status: 200, ok: true });
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();

    await handleHealthRequest(req, res, '/api/health/ready', { fetchFn: mockSuccessFetch });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.ready, true);
    assert.strictEqual(body.status, 'ready');
    assert.strictEqual(body.checks.database_connected, true);
  });

  test('GET /api/health/ready returns 503 when system is degraded (permission failure)', async () => {
    const mock401Fetch = async () => ({ status: 401, ok: false });
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();

    await handleHealthRequest(req, res, '/api/health/ready', { fetchFn: mock401Fetch });

    assert.strictEqual(res.statusCode, 503);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.ready, false);
    assert.strictEqual(body.status, 'degraded');
    assert.strictEqual(body.error_category, 'permission_failure');
    assert.strictEqual(body.checks.database_connected, false);
  });

  test('GET /api/health/ready returns 503 when system is offline (DNS failure)', async () => {
    const mockDnsFailFetch = async () => {
      const err = new Error('getaddrinfo ENOTFOUND mock-supabase.co');
      err.code = 'ENOTFOUND';
      throw err;
    };
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();

    await handleHealthRequest(req, res, '/api/health/ready', { fetchFn: mockDnsFailFetch });

    assert.strictEqual(res.statusCode, 503);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.ready, false);
    assert.strictEqual(body.status, 'offline');
    assert.strictEqual(body.error_category, 'dns_failure');
    assert.strictEqual(body.checks.database_connected, false);
  });

  // ── 5. ERROR CLASSIFICATION IN checkReadiness ───────────────────────────
  test('checkReadiness: 200 OK -> ready: true, database_connected: true', async () => {
    const mockFetch = async () => ({ status: 200, ok: true });
    const readiness = await checkReadiness({ fetchFn: mockFetch });

    assert.ok(READINESS_STATUSES.includes(readiness.status));
    assert.strictEqual(readiness.ready, true);
    assert.strictEqual(readiness.status, 'ready');
    assert.strictEqual(readiness.error_category, null);
    assert.strictEqual(readiness.checks.database_connected, true);
    assert.strictEqual(readiness.checks.database_status, 'connected');
    assert.strictEqual(readiness.checks.auth_status, 'authenticated');
  });

  test('checkReadiness: 401 Unauthorized -> degraded, permission_failure, database_connected: false', async () => {
    const mockFetch = async () => ({ status: 401, ok: false });
    const readiness = await checkReadiness({ fetchFn: mockFetch });

    assert.ok(READINESS_STATUSES.includes(readiness.status));
    assert.strictEqual(readiness.ready, false);
    assert.strictEqual(readiness.status, 'degraded');
    assert.strictEqual(readiness.error_category, 'permission_failure');
    assert.strictEqual(readiness.checks.database_connected, false, 'database_connected must NOT be true for 401');
    assert.strictEqual(readiness.checks.database_error, 'HTTP_401_UNAUTHORIZED');
  });

  test('checkReadiness: 403 Forbidden -> degraded, permission_failure, database_connected: false', async () => {
    const mockFetch = async () => ({ status: 403, ok: false });
    const readiness = await checkReadiness({ fetchFn: mockFetch });

    assert.ok(READINESS_STATUSES.includes(readiness.status));
    assert.strictEqual(readiness.ready, false);
    assert.strictEqual(readiness.status, 'degraded');
    assert.strictEqual(readiness.error_category, 'permission_failure');
    assert.strictEqual(readiness.checks.database_connected, false, 'database_connected must NOT be true for 403');
    assert.strictEqual(readiness.checks.database_error, 'HTTP_403_FORBIDDEN');
  });

  test('checkReadiness: 404 Client Error -> degraded, http_4xx, database_connected: false', async () => {
    const mockFetch = async () => ({ status: 404, ok: false });
    const readiness = await checkReadiness({ fetchFn: mockFetch });

    assert.ok(READINESS_STATUSES.includes(readiness.status));
    assert.strictEqual(readiness.ready, false);
    assert.strictEqual(readiness.status, 'degraded');
    assert.strictEqual(readiness.error_category, 'http_4xx');
    assert.strictEqual(readiness.checks.database_connected, false, 'database_connected must NOT be true for 404');
    assert.strictEqual(readiness.checks.database_error, 'HTTP_404');
  });

  test('checkReadiness: 500 Server Error -> degraded, http_5xx, database_connected: false', async () => {
    const mockFetch = async () => ({ status: 500, ok: false });
    const readiness = await checkReadiness({ fetchFn: mockFetch });

    assert.ok(READINESS_STATUSES.includes(readiness.status));
    assert.strictEqual(readiness.ready, false);
    assert.strictEqual(readiness.status, 'degraded');
    assert.strictEqual(readiness.error_category, 'http_5xx');
    assert.strictEqual(readiness.checks.database_connected, false);
    assert.strictEqual(readiness.checks.database_error, 'HTTP_500');
  });

  test('checkReadiness: 503 Server Error -> degraded, http_5xx, database_connected: false', async () => {
    const mockFetch = async () => ({ status: 503, ok: false });
    const readiness = await checkReadiness({ fetchFn: mockFetch });

    assert.ok(READINESS_STATUSES.includes(readiness.status));
    assert.strictEqual(readiness.ready, false);
    assert.strictEqual(readiness.status, 'degraded');
    assert.strictEqual(readiness.error_category, 'http_5xx');
    assert.strictEqual(readiness.checks.database_connected, false);
    assert.strictEqual(readiness.checks.database_error, 'HTTP_503');
  });

  test('checkReadiness: DNS lookup failure (ENOTFOUND) -> offline, dns_failure, database_connected: false', async () => {
    const mockFetch = async () => {
      const err = new Error('getaddrinfo ENOTFOUND supabase.co');
      err.code = 'ENOTFOUND';
      throw err;
    };
    const readiness = await checkReadiness({ fetchFn: mockFetch });

    assert.ok(READINESS_STATUSES.includes(readiness.status));
    assert.strictEqual(readiness.ready, false);
    assert.strictEqual(readiness.status, 'offline');
    assert.strictEqual(readiness.error_category, 'dns_failure');
    assert.strictEqual(readiness.checks.database_connected, false);
    assert.strictEqual(readiness.checks.database_status, 'unreachable');
    assert.strictEqual(readiness.checks.database_error, 'DNS_LOOKUP_FAILED');
  });

  test('checkReadiness: Connection refused (ECONNREFUSED) -> offline, connection_refused, database_connected: false', async () => {
    const mockFetch = async () => {
      const err = new Error('connect ECONNREFUSED 127.0.0.1:5432');
      err.code = 'ECONNREFUSED';
      throw err;
    };
    const readiness = await checkReadiness({ fetchFn: mockFetch });

    assert.ok(READINESS_STATUSES.includes(readiness.status));
    assert.strictEqual(readiness.ready, false);
    assert.strictEqual(readiness.status, 'offline');
    assert.strictEqual(readiness.error_category, 'connection_refused');
    assert.strictEqual(readiness.checks.database_connected, false);
    assert.strictEqual(readiness.checks.database_status, 'unreachable');
    assert.strictEqual(readiness.checks.database_error, 'CONNECTION_REFUSED');
  });

  test('checkReadiness: Timeout (ETIMEDOUT) -> offline, timeout, database_connected: false', async () => {
    const mockFetch = async () => {
      const err = new Error('Connect timeout occurred');
      err.code = 'ETIMEDOUT';
      throw err;
    };
    const readiness = await checkReadiness({ fetchFn: mockFetch });

    assert.ok(READINESS_STATUSES.includes(readiness.status));
    assert.strictEqual(readiness.ready, false);
    assert.strictEqual(readiness.status, 'offline');
    assert.strictEqual(readiness.error_category, 'timeout');
    assert.strictEqual(readiness.checks.database_connected, false);
    assert.strictEqual(readiness.checks.database_status, 'unreachable');
    assert.strictEqual(readiness.checks.database_error, 'NETWORK_TIMEOUT');
  });

  test('checkReadiness: Undici connection timeout (UND_ERR_CONNECT_TIMEOUT) -> offline, timeout', async () => {
    const mockFetch = async () => {
      const err = new Error('fetch failed');
      err.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' };
      throw err;
    };
    const readiness = await checkReadiness({ fetchFn: mockFetch });

    assert.ok(READINESS_STATUSES.includes(readiness.status));
    assert.strictEqual(readiness.ready, false);
    assert.strictEqual(readiness.status, 'offline');
    assert.strictEqual(readiness.error_category, 'timeout');
    assert.strictEqual(readiness.checks.database_connected, false);
    assert.strictEqual(readiness.checks.database_error, 'NETWORK_TIMEOUT');
  });

  test('checkReadiness: Generic network failure -> offline, offline error_category', async () => {
    const mockFetch = async () => {
      throw new Error('Socket closed unexpectedly');
    };
    const readiness = await checkReadiness({ fetchFn: mockFetch });

    assert.ok(READINESS_STATUSES.includes(readiness.status));
    assert.strictEqual(readiness.ready, false);
    assert.strictEqual(readiness.status, 'offline');
    assert.strictEqual(readiness.error_category, 'offline');
    assert.strictEqual(readiness.checks.database_connected, false);
    assert.strictEqual(readiness.checks.database_error, 'NETWORK_UNREACHABLE');
  });

  // ── 6. ENDPOINT 4: /api/metrics AUTHORIZATION ───────────────────────────
  test('GET /api/metrics rejects unauthenticated requests with 401', async () => {
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();

    await handleHealthRequest(req, res, '/api/metrics');

    assert.strictEqual(res.statusCode, 401);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.ok, false);
    assert.match(parsed.error, /Unauthorized/);
  });

  test('GET /api/metrics rejects student role with 401', async () => {
    const studentUser = {
      id: 'student-id-1',
      email: 'student@school.edu',
      role: 'student',
      institution_id: 'inst-001',
      department: 'inst-001'
    };

    const mockAuthFetch = async (url) => {
      const u = new URL(url);
      if (u.pathname === '/auth/v1/user') return { ok: true, status: 200, json: async () => ({ id: studentUser.id, email: studentUser.email }) };
      if (u.pathname === '/rest/v1/profiles') return { ok: true, status: 200, json: async () => [studentUser] };
      return { ok: false, status: 404 };
    };

    const req = {
      method: 'GET',
      headers: { authorization: 'Bearer student_valid_session_jwt_123' }
    };
    const res = createMockRes();

    await handleHealthRequest(req, res, '/api/metrics', { fetchFn: mockAuthFetch });

    assert.strictEqual(res.statusCode, 401);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.ok, false);
  });

  test('GET /api/metrics rejects teacher role with 401', async () => {
    const teacherUser = {
      id: 'teacher-id-1',
      email: 'teacher@school.edu',
      role: 'teacher',
      institution_id: 'inst-001',
      department: 'inst-001'
    };

    const mockAuthFetch = async (url) => {
      const u = new URL(url);
      if (u.pathname === '/auth/v1/user') return { ok: true, status: 200, json: async () => ({ id: teacherUser.id, email: teacherUser.email }) };
      if (u.pathname === '/rest/v1/profiles') return { ok: true, status: 200, json: async () => [teacherUser] };
      return { ok: false, status: 404 };
    };

    const req = {
      method: 'GET',
      headers: { authorization: 'Bearer teacher_valid_session_jwt_123' }
    };
    const res = createMockRes();

    await handleHealthRequest(req, res, '/api/metrics', { fetchFn: mockAuthFetch });

    assert.strictEqual(res.statusCode, 401);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.ok, false);
  });

  test('GET /api/metrics authorizes admin user with 200 and metrics payload', async () => {
    const adminUser = {
      id: 'admin-id-1',
      email: 'admin@school.edu',
      role: 'admin',
      institution_id: 'inst-001',
      department: 'inst-001'
    };

    const mockAuthFetch = async (url) => {
      const u = new URL(url);
      if (u.pathname === '/auth/v1/user') return { ok: true, status: 200, json: async () => ({ id: adminUser.id, email: adminUser.email }) };
      if (u.pathname === '/rest/v1/profiles') return { ok: true, status: 200, json: async () => [adminUser] };
      return { ok: false, status: 404 };
    };

    const req = {
      method: 'GET',
      headers: { authorization: 'Bearer admin_valid_session_jwt_12345' }
    };
    const res = createMockRes();

    await handleHealthRequest(req, res, '/api/metrics', { fetchFn: mockAuthFetch });

    assert.strictEqual(res.statusCode, 200);
    const parsed = JSON.parse(res.body);
    assert.ok(parsed.system?.uptime_seconds !== undefined);
  });

  test('GET /api/metrics authorizes super_admin user with 200 and metrics payload', async () => {
    const superAdminUser = {
      id: 'super-admin-id-1',
      email: 'superadmin@school.edu',
      role: 'super_admin',
      institution_id: 'inst-001',
      department: 'inst-001'
    };

    const mockAuthFetch = async (url) => {
      const u = new URL(url);
      if (u.pathname === '/auth/v1/user') return { ok: true, status: 200, json: async () => ({ id: superAdminUser.id, email: superAdminUser.email }) };
      if (u.pathname === '/rest/v1/profiles') return { ok: true, status: 200, json: async () => [superAdminUser] };
      return { ok: false, status: 404 };
    };

    const req = {
      method: 'GET',
      headers: { authorization: 'Bearer superadmin_valid_session_jwt_999' }
    };
    const res = createMockRes();

    await handleHealthRequest(req, res, '/api/metrics', { fetchFn: mockAuthFetch });

    assert.strictEqual(res.statusCode, 200);
    const parsed = JSON.parse(res.body);
    assert.ok(parsed.system?.uptime_seconds !== undefined);
  });

  test('GET /api/metrics authorizes METRICS_TOKEN Bearer header', async () => {
    const originalToken = process.env.METRICS_TOKEN;
    process.env.METRICS_TOKEN = 'test-secret-metrics-token-998877';

    try {
      const req = {
        method: 'GET',
        headers: { authorization: 'Bearer test-secret-metrics-token-998877' }
      };
      const res = createMockRes();

      await handleHealthRequest(req, res, '/api/metrics');

      assert.strictEqual(res.statusCode, 200);
      const parsed = JSON.parse(res.body);
      assert.ok(parsed.system?.uptime_seconds !== undefined);
    } finally {
      if (originalToken !== undefined) {
        process.env.METRICS_TOKEN = originalToken;
      } else {
        delete process.env.METRICS_TOKEN;
      }
    }
  });

  // ── 7. SECRET REDACTION TESTS ───────────────────────────────────────────
  test('Responses across all endpoints never leak sensitive keys or tokens', async () => {
    const endpoints = ['/api/health', '/api/health/live', '/api/health/ready'];
    const fakeKey = 'fake_secret_key_should_never_leak';

    for (const ep of endpoints) {
      const req = { method: 'GET', headers: {} };
      const res = createMockRes();
      await handleHealthRequest(req, res, ep);

      assert.ok(!res.body.includes(fakeKey));
      assert.ok(!res.body.includes('service_role'));
      assert.ok(!res.body.includes('SUPABASE_SERVICE_ROLE_KEY'));
      assert.ok(!res.body.includes('CLOUDFLARE_R2_SECRET_ACCESS_KEY'));
      assert.ok(!res.body.includes('GEMINI_API_KEY'));
    }
  });
});

