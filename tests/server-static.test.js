import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import server from '../server.js';

let baseUrl = '';
let testServer = null;

describe('Server Static Serving, Caching & Routing Hardening', () => {
  before(async () => {
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

  test('Bug fix: Non-existent route /does-not-exist must return HTTP 404 HTML, NOT 200', async () => {
    const res = await fetch(`${baseUrl}/does-not-exist`);
    assert.strictEqual(res.status, 404, `Expected 404 but got ${res.status}`);
    const text = await res.text();
    assert.ok(text.includes('404'), 'Response must contain 404 page');
    assert.ok(text.includes('Island Portal Not Found'), 'Response must contain branded not found page');
  });

  test('Unmapped /api/* endpoint must return HTTP 404 JSON, NOT fall through to HTML', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.headers.get('content-type'), 'application/json');
    const json = await res.json();
    assert.strictEqual(json.ok, false);
    assert.ok(json.error.includes('API endpoint not found'));
  });

  test('Root / returns 200 with no-cache header', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);
    const cacheControl = res.headers.get('cache-control');
    assert.ok(cacheControl && cacheControl.includes('no-cache'), 'HTML must have no-cache');
  });

  test('Known SPA route /student/courses rewrites to student index.html with 200 and no-cache', async () => {
    const res = await fetch(`${baseUrl}/student/courses`);
    assert.strictEqual(res.status, 200);
    const cacheControl = res.headers.get('cache-control');
    assert.ok(cacheControl && cacheControl.includes('no-cache'), 'SPA index must have no-cache');
    const text = await res.text();
    assert.ok(text.includes('<!DOCTYPE html>') || text.includes('<html'), 'Must return HTML document');
  });

  test('Content-hashed assets receive immutable 1-year cache headers', async () => {
    const studentAssets = path.resolve(import.meta.dirname, '..', 'student', 'assets');
    const files = fs.readdirSync(studentAssets);
    const hashedFile = files.find(f => /-[a-zA-Z0-9_-]{7,}\.(js|css)/.test(f));

    if (hashedFile) {
      const res = await fetch(`${baseUrl}/student/assets/${hashedFile}`);
      assert.strictEqual(res.status, 200);
      const cacheControl = res.headers.get('cache-control');
      assert.ok(
        cacheControl && cacheControl.includes('immutable'),
        `Hashed asset ${hashedFile} must have immutable cache header, got: ${cacheControl}`
      );
      assert.ok(
        cacheControl && cacheControl.includes('31536000'),
        `Hashed asset ${hashedFile} must have 1-year max-age, got: ${cacheControl}`
      );
    }
  });

  test('Path traversal attempts are blocked with HTTP 403 Forbidden', async () => {
    await new Promise((resolve, reject) => {
      const port = testServer.address().port;
      const req = http.get({
        hostname: '127.0.0.1',
        port,
        path: '/../../package.json'
      }, (res) => {
        assert.strictEqual(res.statusCode, 403);
        resolve();
      });
      req.on('error', reject);
    });
  });

  test('Security headers (CSP, X-Frame-Options, HSTS, nosniff) are present on responses', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.strictEqual(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp && csp.includes("frame-ancestors 'self'"), 'CSP must include frame-ancestors self');
    const hsts = res.headers.get('strict-transport-security');
    assert.ok(hsts && hsts.includes('max-age=31536000'), 'HSTS header must be present');
  });
});
