import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import server from '../server.js';

async function findChrome() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function measurePage(browser, baseUrl, path) {
  const page = await browser.newPage();
  let jsBytes = 0;
  let cssBytes = 0;
  let imgBytes = 0;
  let totalBytes = 0;

  page.on('response', async (res) => {
    try {
      const headers = res.headers();
      const length = parseInt(headers['content-length'] || '0', 10);
      const ct = headers['content-type'] || '';
      totalBytes += length;
      if (ct.includes('javascript')) jsBytes += length;
      else if (ct.includes('css')) cssBytes += length;
      else if (ct.includes('image')) imgBytes += length;
    } catch (_) {}
  });

  const startTime = Date.now();
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'load', timeout: 30000 });
  const loadTimeMs = Date.now() - startTime;

  // Extract navigation and paint timing metrics from browser
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const paintEntries = performance.getEntriesByType('paint') || [];
    let fcp = 0;
    for (const p of paintEntries) {
      if (p.name === 'first-contentful-paint') fcp = p.startTime;
    }

    return {
      domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd || 0),
      fcpMs: Math.round(fcp),
      domInteractiveMs: Math.round(nav.domInteractive || 0),
      durationMs: Math.round(nav.duration || 0)
    };
  });

  await page.close();

  return {
    path,
    loadTimeMs,
    domContentLoadedMs: metrics.domContentLoadedMs,
    fcpMs: metrics.fcpMs,
    jsTransferKb: Math.round(jsBytes / 1024),
    cssTransferKb: Math.round(cssBytes / 1024),
    imgTransferKb: Math.round(imgBytes / 1024),
    totalTransferKb: Math.round(totalBytes / 1024)
  };
}

async function run() {
  const chromePath = await findChrome();
  if (!chromePath) {
    console.error('Chrome/Edge executable not found on host.');
    process.exit(1);
  }

  const port = 3899;
  const testServer = server.listen(port, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`🚀 Measuring Web Vitals against ${baseUrl}...`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const pagesToMeasure = [
    '/index.html',
    '/login.html',
    '/student/',
    '/teacher/',
    '/admin/',
    '/superadmin/',
    '/study-island/index.html'
  ];

  const results = [];
  for (const pagePath of pagesToMeasure) {
    process.stdout.write(`  Measuring ${pagePath}... `);
    const m = await measurePage(browser, baseUrl, pagePath);
    results.push(m);
    console.log(`✓ FCP: ${m.fcpMs}ms, Load: ${m.loadTimeMs}ms, JS: ${m.jsTransferKb}KB`);
  }

  await browser.close();
  testServer.close();

  console.log('\n📊 Summary Results:');
  console.table(results);
  return results;
}

run().catch(console.error);
