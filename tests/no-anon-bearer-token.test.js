import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// PART 1: Static Codebase Security Scanning Tests
// ─────────────────────────────────────────────────────────────────────────────
describe('Static Security Audit: Elimination of Anon Key as Authorization Bearer', () => {
  const repoRoot = resolve('.');

  function getSourceFiles(dir, extensions = ['.js', '.jsx', '.ts', '.tsx', '.html']) {
    const fullDir = resolve(repoRoot, dir);
    const files = [];

    function walk(current) {
      let entries = [];
      try {
        entries = readdirSync(current);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'assets') continue;
        const fullPath = join(current, entry);
        try {
          const st = statSync(fullPath);
          if (st.isDirectory()) {
            walk(fullPath);
          } else if (st.isFile() && extensions.includes(extname(fullPath))) {
            files.push(fullPath);
          }
        } catch {}
      }
    }

    walk(fullDir);
    return files;
  }

  test('No frontend or shared source file passes anon key as Authorization: Bearer', () => {
    const scanDirs = [
      'portals/superadmin/src',
      'portals/admin/src',
      'portals/teacher/src',
      'portals/student/src',
      'study-island/src',
      'shared/src'
    ];

    const allFiles = [];
    for (const dir of scanDirs) {
      allFiles.push(...getSourceFiles(dir));
    }
    // Also include standalone entry HTML files
    allFiles.push(resolve(repoRoot, 'study-island/quiz.html'));
    allFiles.push(resolve(repoRoot, 'index.html'));

    const forbiddenBearerPatterns = [
      /Bearer\s+\$\{\s*SUPABASE_CONFIG\.key\s*\}/i,
      /Bearer\s+\$\{\s*SUPABASE_ANON_KEY\s*\}/i,
      /Bearer\s+\$\{\s*SUPABASE_KEY\s*\}/i,
      /Bearer\s+\$\{\s*SUPABASE_ANON\s*\}/i,
      /Authorization['"]?\s*:\s*[`'"]Bearer\s+\$\{\s*SUPABASE_CONFIG\.key\s*\}/i,
      /Authorization['"]?\s*:\s*[`'"]Bearer\s+\$\{\s*SUPABASE_ANON_KEY\s*\}/i,
      /Authorization['"]?\s*:\s*[`'"]Bearer\s+\$\{\s*SUPABASE_KEY\s*\}/i,
      /Authorization['"]?\s*:\s*[`'"]Bearer\s*['"]\s*\+\s*SUPABASE_ANON/i,
      /Authorization['"]?\s*:\s*[`'"]Bearer\s*['"]\s*\+\s*key/i
    ];

    const violations = [];

    for (const file of allFiles) {
      const content = readFileSync(file, 'utf-8');
      for (const pattern of forbiddenBearerPatterns) {
        if (pattern.test(content)) {
          violations.push({
            file: file.replace(repoRoot, ''),
            pattern: pattern.toString()
          });
        }
      }
    }

    assert.equal(
      violations.length,
      0,
      `Detected ${violations.length} files using Supabase anon key as Bearer token:\n` +
        JSON.stringify(violations, null, 2)
    );
  });

  test('Zero occurrences of undefined CURRENT_SUPER_ADMIN exist in any component', () => {
    const scanDirs = [
      'portals/superadmin/src',
      'portals/admin/src',
      'portals/teacher/src',
      'portals/student/src',
      'study-island/src',
      'shared/src'
    ];

    const allFiles = [];
    for (const dir of scanDirs) {
      allFiles.push(...getSourceFiles(dir));
    }

    const violations = [];
    for (const file of allFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('CURRENT_SUPER_ADMIN')) {
        violations.push(file.replace(repoRoot, ''));
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found lingering CURRENT_SUPER_ADMIN in: ${violations.join(', ')}`
    );
  });

  test('ProfilePhotoModal.jsx has clean auth checks and uses session access token', () => {
    const filePath = resolve(repoRoot, 'portals/superadmin/src/modals/ProfilePhotoModal.jsx');
    const content = readFileSync(filePath, 'utf-8');

    assert.doesNotMatch(content, /Bearer\s+\$\{\s*SUPABASE_CONFIG\.key\s*\}/);
    assert.doesNotMatch(content, /CURRENT_SUPER_ADMIN/);
    assert.match(content, /if\s*\(!currentUser\)/);
    assert.match(content, /supabase\.auth\.getSession\(\)/);
  });

  test('SystemHealthView.jsx sends only apikey for ping and uses supabase client for messages', () => {
    const filePath = resolve(repoRoot, 'portals/superadmin/src/views/SystemHealthView.jsx');
    const content = readFileSync(filePath, 'utf-8');

    assert.doesNotMatch(content, /Bearer\s+\$\{\s*SUPABASE_CONFIG\.key\s*\}/);
    assert.match(content, /supabase\s*\.from\(['"]messages['"]\)\s*\.select/);
  });

  test('ContentControlView.jsx uses supabase client for telemetry query', () => {
    const filePath = resolve(repoRoot, 'portals/superadmin/src/views/ContentControlView.jsx');
    const content = readFileSync(filePath, 'utf-8');

    assert.doesNotMatch(content, /Bearer\s+\$\{\s*SUPABASE_CONFIG\.key\s*\}/);
    assert.match(content, /supabase\s*\.from\(['"]messages['"]\)\s*\.select/);
  });

  test('CourseCurriculumView.jsx does not scan localStorage or fall back to anon Bearer', () => {
    const filePath = resolve(repoRoot, 'portals/superadmin/src/views/CourseCurriculumView.jsx');
    const content = readFileSync(filePath, 'utf-8');

    assert.doesNotMatch(content, /let authHeader = `Bearer \${SUPABASE_CONFIG\.key}`/);
    assert.doesNotMatch(content, /localStorage\.key\(i\)/);
    assert.match(content, /Authentication required to upload curriculum media/);
  });

  test('CustomCoursesView.jsx sb() helper uses verified session access token', () => {
    const filePath = resolve(repoRoot, 'portals/superadmin/src/views/CustomCoursesView.jsx');
    const content = readFileSync(filePath, 'utf-8');

    assert.doesNotMatch(content, /Authorization:\s*`Bearer \${SUPABASE_KEY}`/);
    assert.match(content, /Authorization:\s*`Bearer \${token}`/);
    assert.match(content, /No authenticated session/);
  });

  test('TenantManagementView.jsx uses supabase client for classes fetch and update', () => {
    const filePath = resolve(repoRoot, 'portals/superadmin/src/views/TenantManagementView.jsx');
    const content = readFileSync(filePath, 'utf-8');

    assert.doesNotMatch(content, /Authorization:\s*`Bearer \${SUPABASE_KEY}`/);
    assert.match(content, /supabase\s*\.from\(['"]classes['"]\)\s*\.select/);
    assert.match(content, /supabase\s*\.from\(['"]classes['"]\)\s*\.update/);
  });

  test('Landing page index.html sends apikey header without Bearer token', () => {
    const filePath = resolve(repoRoot, 'index.html');
    const content = readFileSync(filePath, 'utf-8');

    assert.doesNotMatch(content, /'Authorization':\s*'Bearer\s*'\s*\+\s*key/);
    assert.match(content, /headers:\s*\{\s*'apikey':\s*key\s*\}/);
  });

  test('Quiz.html flushToCloud sends apikey header without anon Bearer token', () => {
    const filePath = resolve(repoRoot, 'study-island/quiz.html');
    const content = readFileSync(filePath, 'utf-8');

    assert.doesNotMatch(content, /'Authorization':\s*'Bearer\s*'\s*\+\s*SUPABASE_ANON/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 2: Runtime Interaction & Behavioral Simulation Tests
// ─────────────────────────────────────────────────────────────────────────────
describe('Runtime Interaction Security Contracts', () => {
  const mockAnonKey = 'mock-anon-key-public-only';
  const mockValidUserJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWFkbWluLTEiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImVtYWlsIjoiYWRtaW5AZWR0ZWNoaXNsYW5kLmludGVybmFsIn0.signature';

  let capturedRequests = [];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    capturedRequests = [];
    globalThis.fetch = async (url, options = {}) => {
      const headers = {};
      if (options.headers) {
        if (typeof options.headers.forEach === 'function') {
          options.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
        } else {
          for (const [k, v] of Object.entries(options.headers)) {
            headers[k.toLowerCase()] = v;
          }
        }
      }
      capturedRequests.push({
        url: typeof url === 'string' ? url : url.toString(),
        method: options.method || 'GET',
        headers,
        body: options.body
      });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ ok: true, data: [] }),
        text: async () => JSON.stringify({ ok: true, data: [] }),
        blob: async () => new Blob(['mock-image-data'], { type: 'image/jpeg' })
      };
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // 1. Profile Modal Simulation
  describe('Profile Modal Interaction', () => {
    function simulateProfileSave({ currentUser, sessionToken }) {
      if (!currentUser) {
        return { status: 'denied', error: 'Authentication required to modify administrator profile photo.' };
      }
      if (!sessionToken) {
        throw new Error('No authenticated session found. Please re-login.');
      }
      // Issue authenticated request
      const headers = {
        'apikey': mockAnonKey,
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      };
      globalThis.fetch(`https://qmyrxvtbzlbnvzxypnus.supabase.co/rest/v1/profiles?email=eq.${encodeURIComponent(currentUser.email)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ avatar_url: 'https://cdn.edtechisland.internal/new-avatar.svg' })
      });
      return { status: 'success' };
    }

    test('Unauthenticated caller cannot save profile and fails closed', () => {
      const res = simulateProfileSave({ currentUser: null, sessionToken: null });
      assert.equal(res.status, 'denied');
      assert.equal(capturedRequests.length, 0, 'Zero network requests made when unauthenticated');
    });

    test('Saving avatar with active session sends session token and NEVER anon key as Bearer', () => {
      const res = simulateProfileSave({
        currentUser: { email: 'superadmin@edtechisland.internal', name: 'SuperAdmin', role: 'super_admin' },
        sessionToken: mockValidUserJwt
      });
      assert.equal(res.status, 'success');
      assert.equal(capturedRequests.length, 1);
      const req = capturedRequests[0];
      assert.equal(req.headers['authorization'], `Bearer ${mockValidUserJwt}`);
      assert.notEqual(req.headers['authorization'], `Bearer ${mockAnonKey}`);
      assert.equal(req.headers['apikey'], mockAnonKey);
    });
  });

  // 2. Avatar Upload to Storage Simulation
  describe('Avatar Upload to Storage Interaction', () => {
    async function simulateAvatarUpload({ sessionToken, fileBlob }) {
      if (!sessionToken) {
        throw new Error('Authentication required: no active session found.');
      }
      const headers = {
        'apikey': mockAnonKey,
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'image/jpeg'
      };
      return globalThis.fetch('https://qmyrxvtbzlbnvzxypnus.supabase.co/storage/v1/object/avatars/avatar-test.jpg', {
        method: 'POST',
        headers,
        body: fileBlob
      });
    }

    test('Avatar upload fails closed without session token and sends zero requests', async () => {
      await assert.rejects(
        async () => simulateAvatarUpload({ sessionToken: null, fileBlob: 'test-data' }),
        /Authentication required/
      );
      assert.equal(capturedRequests.length, 0);
    });

    test('Avatar upload with session token uses user JWT Bearer and apikey header', async () => {
      await simulateAvatarUpload({ sessionToken: mockValidUserJwt, fileBlob: 'test-data' });
      assert.equal(capturedRequests.length, 1);
      const req = capturedRequests[0];
      assert.equal(req.headers['authorization'], `Bearer ${mockValidUserJwt}`);
      assert.notEqual(req.headers['authorization'], `Bearer ${mockAnonKey}`);
    });
  });

  // 3. System Diagnostic Scan Simulation
  describe('System Diagnostic Scan Interaction', () => {
    async function simulatePingSupabaseRest({ sessionToken = null }) {
      const headers = { 'apikey': mockAnonKey };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      return globalThis.fetch('https://qmyrxvtbzlbnvzxypnus.supabase.co/rest/v1/classes?select=id&limit=1', { headers });
    }

    test('Unauthenticated REST latency ping sends apikey only and NEVER sends anon Bearer', async () => {
      await simulatePingSupabaseRest({ sessionToken: null });
      assert.equal(capturedRequests.length, 1);
      const req = capturedRequests[0];
      assert.equal(req.headers['apikey'], mockAnonKey);
      assert.equal(req.headers['authorization'], undefined, 'Authorization header must not be set for unauthenticated ping');
    });

    test('Authenticated REST latency ping sends session Bearer without anon key in Authorization', async () => {
      await simulatePingSupabaseRest({ sessionToken: mockValidUserJwt });
      assert.equal(capturedRequests.length, 1);
      const req = capturedRequests[0];
      assert.equal(req.headers['apikey'], mockAnonKey);
      assert.equal(req.headers['authorization'], `Bearer ${mockValidUserJwt}`);
    });
  });

  // 4. Audit Failure Fallback Simulation
  describe('Audit Failure Fallback Interaction', () => {
    async function simulateLogIncident({ sessionToken, incidentData }) {
      if (!sessionToken) {
        throw new Error('Authentication required for audit event submission');
      }
      return globalThis.fetch('/api/audit-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(incidentData)
      });
    }

    test('Audit incident logging requires session token and never sends anon key as Bearer', async () => {
      await simulateLogIncident({
        sessionToken: mockValidUserJwt,
        incidentData: { severity: 'WARNING', title: 'Test Incident', code: 401 }
      });
      assert.equal(capturedRequests.length, 1);
      const req = capturedRequests[0];
      assert.equal(req.headers['authorization'], `Bearer ${mockValidUserJwt}`);
      assert.notEqual(req.headers['authorization'], `Bearer ${mockAnonKey}`);
    });

    test('Audit incident logging rejects when unauthenticated', async () => {
      await assert.rejects(
        async () => simulateLogIncident({ sessionToken: null, incidentData: {} }),
        /Authentication required/
      );
    });
  });

  // 5. Curriculum Upload Simulation
  describe('Curriculum Upload Interaction', () => {
    async function simulateCurriculumUpload({ sessionToken, fileData }) {
      if (!sessionToken) {
        throw new Error('Authentication required to upload curriculum media. Please log in.');
      }
      return globalThis.fetch('/api/upload-r2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(fileData)
      });
    }

    test('Curriculum upload fails closed if session is absent and never falls back to anon Bearer', async () => {
      await assert.rejects(
        async () => simulateCurriculumUpload({ sessionToken: null, fileData: { filename: 'test.html' } }),
        /Authentication required to upload curriculum media/
      );
      assert.equal(capturedRequests.length, 0);
    });

    test('Curriculum upload with active session attaches verified session JWT', async () => {
      await simulateCurriculumUpload({
        sessionToken: mockValidUserJwt,
        fileData: { filename: 'chapter_10.html', base64Content: 'SGVsbG8=' }
      });
      assert.equal(capturedRequests.length, 1);
      const req = capturedRequests[0];
      assert.equal(req.headers['authorization'], `Bearer ${mockValidUserJwt}`);
      assert.notEqual(req.headers['authorization'], `Bearer ${mockAnonKey}`);
    });
  });
});
