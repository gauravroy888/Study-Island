import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import server from '../server.js';

describe('P0.4: SuperAdmin Portal End-to-End Browser Verification', () => {
  let testServer;
  let serverPort;
  let browser;
  let chromePath;

  before(async () => {
    // 1. Locate Chrome / Edge / Chromium across Windows, Linux, and macOS
    const candidates = [
      process.env.CHROME_BIN,
      process.env.PUPPETEER_EXECUTABLE_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        chromePath = candidate;
        break;
      }
    }

    // 2. Start local HTTP server on dynamic port
    await new Promise((resolve) => {
      testServer = server.listen(0, '127.0.0.1', () => {
        serverPort = testServer.address().port;
        resolve();
      });
    });

    // 3. Launch headless browser
    if (chromePath) {
      try {
        browser = await puppeteer.launch({
          executablePath: chromePath,
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
          ]
        });
      } catch (err) {
        console.warn('⚠️ Could not launch browser in SuperAdmin E2E test:', err.message);
      }
    }
  });

  after(async () => {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
  });

  test('SA-E2E-01: Chrome or Edge binary is present and accessible', (t) => {
    if (!chromePath) {
      t.skip('Host browser binary required — not detected on this runner');
      return;
    }
    assert.ok(chromePath, `Host browser binary required. Found: ${chromePath}`);
    assert.ok(fs.existsSync(chromePath), 'Browser binary must exist on disk');
  });

  test('SA-E2E-02: SuperAdmin Login page renders security gate without error', async (t) => {
    if (!browser) {
      t.skip('Browser not launched — skipping E2E test');
      return;
    }
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${serverPort}/superadmin-login.html`, { waitUntil: 'domcontentloaded' });
      const title = await page.title();
      assert.match(title, /SuperAdmin|Login/i, 'Title should indicate SuperAdmin Login');

      // Check for presence of login form elements
      const emailInput = await page.$('#superadmin-id, input[type="text"], input[name="email"]');
      assert.ok(emailInput, 'Email input must exist on login page');
    } finally {
      await page.close();
    }
  });

  test('SA-E2E-03: SuperAdmin SPA presents Root Deck gate when unauthenticated', async (t) => {
    if (!browser) {
      t.skip('Browser not launched — skipping E2E test');
      return;
    }
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${serverPort}/superadmin/`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#root', { timeout: 5000 });

      // In unauthenticated state, the Root SuperAdmin Deck gate is displayed
      const pageText = await page.evaluate(() => document.body.innerText);
      assert.match(pageText, /Root SuperAdmin Deck|Authenticate via Supabase Auth|Restricted to verified Super Administrators/i);
    } finally {
      await page.close();
    }
  });

  test('SA-E2E-04: SuperAdmin authenticated session loads dashboard and opens avatar modal', async (t) => {
    if (!browser) {
      t.skip('Browser not launched — skipping E2E test');
      return;
    }
    const page = await browser.newPage();
    const consoleLogs = [];
    const consoleErrors = [];
    page.on('console', msg => consoleLogs.push(msg.text()));
    page.on('pageerror', err => consoleErrors.push(err.message));

    try {
      await page.setRequestInterception(true);
      const corsHeaders = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS, PATCH, PUT',
        'access-control-allow-headers': '*'
      };

      page.on('request', (req) => {
        const url = req.url();
        const method = req.method();

        // Handle CORS preflight
        if (method === 'OPTIONS') {
          req.respond({
            status: 204,
            headers: corsHeaders
          });
          return;
        }

        if (url.includes('/auth/v1/user') || url.includes('/auth/v1/token')) {
          req.respond({
            status: 200,
            headers: corsHeaders,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'sa-e2e-auth-id',
              email: 'superadmin@platform.edu',
              role: 'authenticated'
            })
          });
          return;
        }

        if (url.includes('/rest/v1/profiles?auth_id=eq.')) {
          req.respond({
            status: 200,
            headers: corsHeaders,
            contentType: 'application/json',
            body: JSON.stringify([{
              id: 'p-sa-e2e',
              auth_id: 'sa-e2e-auth-id',
              email: 'superadmin@platform.edu',
              name: 'Dr. Evelyn Vance',
              role: 'super_admin',
              department: 'platform',
              status: 'Active'
            }])
          });
          return;
        }

        if (url.includes('/api/superadmin/users')) {
          req.respond({
            status: 200,
            headers: corsHeaders,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              users: [
                { id: 'p-sa-e2e', name: 'Dr. Evelyn Vance', email: 'superadmin@platform.edu', role: 'super_admin', status: 'Active', department: 'platform', created_at: '2026-01-01T00:00:00Z' },
                { id: 'p-stud-1', name: 'Aarav Patel', email: 'aarav@school.edu', role: 'student', status: 'Active', department: 'inst-dps-001', created_at: '2026-01-02T00:00:00Z' }
              ]
            })
          });
          return;
        }

        if (url.includes('/rest/v1/system_audit_logs')) {
          req.respond({
            status: 200,
            headers: corsHeaders,
            contentType: 'application/json',
            body: JSON.stringify([])
          });
          return;
        }

        if (url.includes('/rest/v1/school_branding')) {
          req.respond({
            status: 200,
            headers: corsHeaders,
            contentType: 'application/json',
            body: JSON.stringify([])
          });
          return;
        }

        req.continue();
      });

      // 1. Establish origin and inject valid Supabase session
      await page.goto(`http://127.0.0.1:${serverPort}/login.html`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        const now = Math.floor(Date.now() / 1000);
        const tokenData = {
          access_token: 'valid-sa-e2e-token-string-12345',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: now + 7200,
          refresh_token: 'refresh-token-12345',
          user: {
            id: 'sa-e2e-auth-id',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'superadmin@platform.edu',
            app_metadata: { provider: 'email' },
            user_metadata: { full_name: 'Dr. Evelyn Vance' },
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z'
          }
        };
        window.localStorage.setItem('sb-qmyrxvtbzlbnvzxypnus-auth-token', JSON.stringify(tokenData));
      });

      await page.goto(`http://127.0.0.1:${serverPort}/superadmin/`, { waitUntil: 'networkidle0' });

      // Wait for authenticated shell to render
      await page.waitForSelector('.superadmin-app, .portal-sidebar', { timeout: 8000 });

      // Verify SuperAdmin user identity rendered
      const adminNameText = await page.evaluate(() => {
        const el = document.querySelector('.profile-name');
        return el ? el.innerText : '';
      });
      assert.match(adminNameText, /Dr\. Evelyn Vance|Super Admin/i);

      // Verify presence of Edit Avatar button and click it to open modal
      const editAvatarBtn = await page.waitForSelector('.avatar-wrapper', { timeout: 4000 });
      assert.ok(editAvatarBtn, 'Edit avatar trigger must exist');
      await editAvatarBtn.click();

      // Wait for modal to appear
      await page.waitForFunction(() => {
        return document.body.innerText.includes('SuperAdmin Profile Photo') ||
               document.body.innerText.includes('Avatar Creator');
      }, { timeout: 4000 });

      const modalText = await page.evaluate(() => document.body.innerText);
      assert.match(modalText, /SuperAdmin Profile Photo|Avatar Creator/i);

      // Check for zero unhandled React/DOM error crashes
      const criticalErrors = consoleErrors.filter(msg => !msg.includes('net::ERR_') && !msg.includes('favicon'));
      assert.strictEqual(criticalErrors.length, 0, `Zero critical console errors expected. Got: ${JSON.stringify(criticalErrors)}`);
    } finally {
      await page.close();
    }
  });
});
