import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import server from '../server.js';

describe('Phase 2: End-to-End Automated Browser Coverage', () => {
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

    // 2. Start local HTTP server on random free port
    await new Promise((resolve) => {
      testServer = server.listen(0, '127.0.0.1', () => {
        serverPort = testServer.address().port;
        resolve();
      });
    });

    // 3. Launch browser in headless mode if executable is present
    if (chromePath) {
      try {
        browser = await puppeteer.launch({
          executablePath: chromePath,
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });
      } catch (err) {
        console.warn('⚠️ Could not launch browser in E2E test:', err.message);
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

  test('E2E-01: Browser environment detects valid host Chrome/Edge binary', (t) => {
    if (!chromePath) {
      t.skip('Host Chrome/Edge/Chromium binary not detected on this runner — skipping E2E browser tests');
      return;
    }
    assert.ok(chromePath, `Host Chrome/Edge binary must be found. Detected: ${chromePath}`);
    assert.ok(fs.existsSync(chromePath), 'Browser binary must exist on disk');
  });

  test('E2E-02: Authentication flow — Portal login renders and toggles roles', async (t) => {
    if (!browser) {
      t.skip('Browser not launched — skipping E2E test');
      return;
    }
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${serverPort}/login.html`, { waitUntil: 'domcontentloaded' });

      // Title must be accessible
      const title = await page.title();
      assert.match(title, /Login/i);

      // Verify portal tabs exist
      const studentTab = await page.$('.login-tab[data-tab="student"]');
      const teacherTab = await page.$('.login-tab[data-tab="teacher"]');
      const adminTab = await page.$('.login-tab[data-tab="admin"]');

      assert.ok(studentTab, 'Student tab must exist');
      assert.ok(teacherTab, 'Teacher tab must exist');
      assert.ok(adminTab, 'Admin tab must exist');

      // Click Teacher tab and verify form switches
      await teacherTab.click();
      const teacherFormVisible = await page.$eval('#form-teacher', el => el.classList.contains('active'));
      assert.strictEqual(teacherFormVisible, true, 'Clicking Teacher tab must activate teacher form');
    } finally {
      await page.close();
    }
  });

  test('E2E-03: Student Journey — Student Portal SPA loads and renders root shell', async (t) => {
    if (!browser) {
      t.skip('Browser not launched — skipping E2E test');
      return;
    }
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${serverPort}/student/`, { waitUntil: 'domcontentloaded' });
      const rootExists = await page.$('#root');
      assert.ok(rootExists, 'Student portal must mount React root shell');
    } finally {
      await page.close();
    }
  });

  test('E2E-04: Teacher Journey — Teacher Portal SPA loads and renders root shell', async (t) => {
    if (!browser) {
      t.skip('Browser not launched — skipping E2E test');
      return;
    }
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${serverPort}/teacher/`, { waitUntil: 'domcontentloaded' });
      const rootExists = await page.$('#root');
      assert.ok(rootExists, 'Teacher portal must mount React root shell');
    } finally {
      await page.close();
    }
  });

  test('E2E-05: Admin Journey — Admin Portal SPA loads and renders root shell', async (t) => {
    if (!browser) {
      t.skip('Browser not launched — skipping E2E test');
      return;
    }
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${serverPort}/admin/`, { waitUntil: 'domcontentloaded' });
      const rootExists = await page.$('#root');
      assert.ok(rootExists, 'Admin portal must mount React root shell');
    } finally {
      await page.close();
    }
  });

  test('E2E-06: SuperAdmin Journey — SuperAdmin Portal SPA loads and renders root shell', async (t) => {
    if (!browser) {
      t.skip('Browser not launched — skipping E2E test');
      return;
    }
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${serverPort}/superadmin/`, { waitUntil: 'domcontentloaded' });
      const rootExists = await page.$('#root');
      assert.ok(rootExists, 'SuperAdmin portal must mount React root shell');
    } finally {
      await page.close();
    }
  });

  test('E2E-07: Study Island 3D Experience loads and mounts container', async (t) => {
    if (!browser) {
      t.skip('Browser not launched — skipping E2E test');
      return;
    }
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${serverPort}/study-island/index.html`, { waitUntil: 'domcontentloaded' });
      const rootExists = await page.$('#root');
      assert.ok(rootExists, 'Study Island must mount root container');
    } finally {
      await page.close();
    }
  });

  test('E2E-08: Aria AI Bot Singleton Guarantee — Only one active bot widget in DOM', async (t) => {
    if (!browser) {
      t.skip('Browser not launched — skipping E2E test');
      return;
    }
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${serverPort}/login.html`, { waitUntil: 'domcontentloaded' });
      
      // Inject widget multiple times to test singleton defense
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('aria:init'));
        window.dispatchEvent(new CustomEvent('aria:init'));
      });

      const widgets = await page.$$('.ai-tutor-widget-container, #aria-bot-root, [data-aria-bot="true"]');
      assert.ok(widgets.length <= 1, `Singleton invariant: expected <= 1 Aria widget, found ${widgets.length}`);
    } finally {
      await page.close();
    }
  });
});
