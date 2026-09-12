import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import server from '../server.js';
import { getMetrics, increment, resetMetrics } from '../server/metrics.js';

let baseUrl = '';
let testServer = null;

describe('Observability: Request Tracing, Metrics & Health Checks', () => {
  before(async () => {
    process.env.METRICS_TOKEN = 'test-metrics-token-secret';
    await new Promise((resolve) => {
      testServer = server.listen(0, '127.0.0.1', () => {
        const port = testServer.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
  });

  test('All HTTP responses include a unique X-Request-Id header', async () => {
    const res1 = await fetch(`${baseUrl}/api/health`);
    const res2 = await fetch(`${baseUrl}/api/health`);
    const id1 = res1.headers.get('x-request-id');
    const id2 = res2.headers.get('x-request-id');

    assert.ok(id1, 'Response 1 must have X-Request-Id header');
    assert.ok(id2, 'Response 2 must have X-Request-Id header');
    assert.notStrictEqual(id1, id2, 'Each request must have a distinct Request ID');
    // UUID v4 format verification
    assert.match(id1, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('GET /api/health returns HTTP 200 with platform health status and uptime', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/json');
    const body = await res.json();
    assert.strictEqual(body.status, 'healthy');
    assert.strictEqual(body.version, '1.0.0');
    assert.ok(typeof body.uptime_seconds === 'number');
    assert.ok(body.timestamp);
  });

  test('GET /api/health/live returns HTTP 200 with alive status', async () => {
    const res = await fetch(`${baseUrl}/api/health/live`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'alive');
  });

  test('GET /api/health/ready returns readiness check object without exposing secrets', async () => {
    const res = await fetch(`${baseUrl}/api/health/ready`);
    // Status can be 200 (ready) or 503 (degraded/offline/unconfigured)
    assert.ok([200, 503].includes(res.status), `Unexpected status: ${res.status}`);
    const text = await res.text();
    const body = JSON.parse(text);
    
    // Validate adherence to documented 4-state readiness contract
    const VALID_STATUSES = ['ready', 'degraded', 'offline', 'unconfigured'];
    assert.ok(
      VALID_STATUSES.includes(body.status),
      `Readiness status "${body.status}" must adhere to contract: ${VALID_STATUSES.join(', ')}`
    );
    assert.ok(body.checks);
    assert.strictEqual(typeof body.ready, 'boolean');
    assert.strictEqual(typeof body.checks.database_connected, 'boolean');
    assert.strictEqual(typeof body.checks.storage_configured, 'boolean');
    assert.strictEqual(typeof body.checks.ai_configured, 'boolean');

    // Never report database_connected as true if status is not ready
    if (body.status !== 'ready') {
      assert.strictEqual(body.checks.database_connected, false);
      assert.strictEqual(res.status, 503);
    } else {
      assert.strictEqual(body.checks.database_connected, true);
      assert.strictEqual(res.status, 200);
    }

    // SECURITY: Ensure no secrets or API keys are leaked in readiness response
    assert.strictEqual(text.includes(process.env.GEMINI_API_KEY || 'AIza'), false, 'Must not leak Gemini API key');
    assert.strictEqual(text.includes(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || 'r2_secret'), false, 'Must not leak R2 secret');
    assert.strictEqual(text.includes('eyJhbGciOi'), false, 'Must not leak JWT tokens');
  });

  test('GET /api/metrics rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/metrics`);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.ok, false);
    assert.match(body.error, /Unauthorized/i);
  });

  test('GET /api/metrics rejects invalid token with 401', async () => {
    const res = await fetch(`${baseUrl}/api/metrics`, {
      headers: { Authorization: 'Bearer totally-invalid-token-string' }
    });
    assert.strictEqual(res.status, 401);
  });

  test('GET /api/metrics returns system resources and operational counters when authorized', async () => {
    resetMetrics();
    increment('auth_failures_total', 3);
    increment('rate_limit_events_total', 1);

    const res = await fetch(`${baseUrl}/api/metrics`, {
      headers: { Authorization: `Bearer ${process.env.METRICS_TOKEN}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();

    assert.strictEqual(body.auth_failures_total, 3);
    assert.strictEqual(body.rate_limit_events_total, 1);
    assert.ok(body.system, 'Must include system memory and uptime');
    assert.ok(typeof body.system.memory_rss_mb === 'number');
    assert.ok(typeof body.system.uptime_seconds === 'number');
  });
});
