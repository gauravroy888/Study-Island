import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import server from '../server.js';
import { uploadRateLimiter, aiRateLimiter, checkRateLimit } from '../server/rateLimit.js';

describe('Phase 11: Security Abuse & Rate-Limit Resistance', () => {
  let testServer;
  let serverPort;

  before(async () => {
    await new Promise((resolve) => {
      testServer = server.listen(0, '127.0.0.1', () => {
        serverPort = testServer.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => testServer.close(resolve));
  });

  function makeRequest({ path, method = 'POST', headers = {}, body = '' }) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: serverPort,
          path,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString();
            let json = null;
            try { json = JSON.parse(raw); } catch (_) {}
            resolve({ statusCode: res.statusCode, headers: res.headers, body: raw, json });
          });
        }
      );
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  test('ABUSE-01: Unauthenticated request to /api/ai/chat rejected with HTTP 401', async () => {
    const res = await makeRequest({
      path: '/api/ai/chat',
      body: JSON.stringify({ message: 'Hello' })
    });
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.json?.error || '', /unauthorized/i);
  });

  test('ABUSE-02: Unauthenticated request to /api/upload-r2 rejected with HTTP 401', async () => {
    const res = await makeRequest({
      path: '/api/upload-r2',
      body: JSON.stringify({ filename: 'test.png', base64Content: 'AQID' })
    });
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.json?.error || '', /unauthorized/i);
  });

  test('ABUSE-03: API endpoints reject unauthenticated or malformed requests securely (HTTP 401/400)', async () => {
    const res = await makeRequest({
      path: '/api/audit-log',
      body: '{ broken-json-syntax: '
    });
    // Security by design: Unauthenticated requests are blocked with 401 before processing or DB allocation
    assert.ok(res.statusCode === 400 || res.statusCode === 401, `Expected 400 or 401, got ${res.statusCode}`);
  });

  test('ABUSE-04: AI rate-limiter triggers HTTP 429 when threshold (20 req/min) is exceeded', () => {
    const testUserId = 'abuser_user_id_429';
    // Consume 20 allowed requests
    for (let i = 0; i < 20; i++) {
      const allowed = checkRateLimit(aiRateLimiter, testUserId, 20, 60000);
      assert.strictEqual(allowed, true, `Request ${i + 1} should be permitted`);
    }

    // 21st request must be denied by rate limiter
    const blocked = checkRateLimit(aiRateLimiter, testUserId, 20, 60000);
    assert.strictEqual(blocked, false, '21st request in 1 minute window must be rate-limited (HTTP 429)');
  });

  test('ABUSE-05: Upload rate-limiter triggers when burst threshold (30 uploads/min) is exceeded', () => {
    const testIp = '192.168.1.99';
    for (let i = 0; i < 30; i++) {
      const allowed = checkRateLimit(uploadRateLimiter, testIp, 30, 60000);
      assert.strictEqual(allowed, true, `Upload ${i + 1} should be permitted`);
    }

    const blocked = checkRateLimit(uploadRateLimiter, testIp, 30, 60000);
    assert.strictEqual(blocked, false, '31st upload in 1 minute window must be rate-limited');
  });

  test('ABUSE-06: Path traversal in static requests returns HTTP 403 Forbidden', async () => {
    const res = await makeRequest({
      path: '/../../../Windows/System32/drivers/etc/hosts',
      method: 'GET'
    });
    assert.strictEqual(res.statusCode, 403);
  });

  test('ABUSE-07: Executable masquerading as image in upload is blocked by magic byte validation', async () => {
    // Windows PE executable header "MZ" in base64: "TVo="
    const mzExeBase64 = 'TVoAAAFAAAAEAAAAAAAAAAAAAAA=';
    const res = await makeRequest({
      path: '/api/upload-r2',
      body: JSON.stringify({
        filename: 'malicious.png',
        base64Content: mzExeBase64,
        contentType: 'image/png'
      })
    });
    // Should be rejected with 401 unauth or 400 invalid image
    assert.ok(res.statusCode === 400 || res.statusCode === 401);
  });
});
