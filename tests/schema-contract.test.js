import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveCurriculumContext } = require('../server/ai.js');

const SUPABASE_URL = 'https://qmyrxvtbzlbnvzxypnus.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjA4OTcsImV4cCI6MjA5NTM5Njg5N30.ABvW_oBzXC2Ffxm5ToLh6t4WmdKPdtg9SyfeAE76iJo';

describe('Live Schema Contract & Drift Prevention', () => {

  describe('Live Supabase REST Column Verifications', () => {
    function isNetworkError(e) {
      if (!e) return false;
      const msg = String(e.message || '');
      const code = e.code || e.cause?.code;
      return (
        code === 'ENOTFOUND' ||
        code === 'ECONNREFUSED' ||
        code === 'ETIMEDOUT' ||
        code === 'UND_ERR_CONNECT_TIMEOUT' ||
        code === 'EAI_AGAIN' ||
        msg.includes('fetch failed') ||
        msg.includes('Failed to fetch') ||
        msg.includes('ENOTFOUND') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('network unreachable') ||
        (e.cause?.name === 'AggregateError' && e.cause?.errors?.some?.(err => isNetworkError(err)))
      );
    }

    async function probeTableCols(table, cols) {
      const q = cols.join(',');
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${q}&limit=1`, {
          headers: { apikey: SUPABASE_ANON_KEY }
        });
        return { status: res.status, ok: res.ok, text: await res.text() };
      } catch (err) {
        return { networkError: err };
      }
    }

    test('classes table has verified columns (id, name, subject, institution_id)', async (t) => {
      const res = await probeTableCols('classes', ['id', 'name', 'subject', 'institution_id']);
      if (res.networkError) {
        t.skip(`Blocked: Live Supabase network unreachable (${res.networkError.message})`);
        return;
      }
      assert.strictEqual(res.ok, true, 'classes columns should return HTTP 200');
      assert.strictEqual(res.status, 200);
    });

    test('classes.department is confirmed NON-EXISTENT in live schema (returns 400)', async (t) => {
      const res = await probeTableCols('classes', ['department']);
      if (res.networkError) {
        t.skip(`Blocked: Live Supabase network unreachable (${res.networkError.message})`);
        return;
      }
      assert.strictEqual(res.status, 400, 'classes.department must be rejected by PostgREST');
      assert.match(res.text, /column classes\.department does not exist/);
    });

    test('course_chapters table has verified core & modality columns', async (t) => {
      const verifiedCols = [
        'id', 'subject_id', 'title', 'chapter_slug', 'description', 'chapter_order',
        'is_published', 'icon_class', 'front_visuals_url', 'scene_3d_model_url',
        'experience_url', 'experiments_url', 'quiz_url', 'mixed_reality_url', 'stories_url',
        'experience_ready', 'experiments_ready', 'quiz_ready', 'mixed_reality_ready',
        'stories_ready', 'custom_modalities', 'experiments_list', 'stories_list',
        'modality_urls', 'front_visuals_ready'
      ];
      const res = await probeTableCols('course_chapters', verifiedCols);
      if (res.networkError) {
        t.skip(`Blocked: Live Supabase network unreachable (${res.networkError.message})`);
        return;
      }
      assert.strictEqual(res.ok, true, 'course_chapters columns should return HTTP 200');
      assert.strictEqual(res.status, 200);
    });

    test('course_chapters.chapter_name is confirmed NON-EXISTENT in live schema (returns 400)', async (t) => {
      const res = await probeTableCols('course_chapters', ['chapter_name']);
      if (res.networkError) {
        t.skip(`Blocked: Live Supabase network unreachable (${res.networkError.message})`);
        return;
      }
      assert.strictEqual(res.status, 400, 'chapter_name must be rejected by PostgREST');
      assert.match(res.text, /column course_chapters\.chapter_name does not exist/);
    });

    test('course_chapters.class_name is confirmed NON-EXISTENT in live schema (returns 400)', async (t) => {
      const res = await probeTableCols('course_chapters', ['class_name']);
      if (res.networkError) {
        t.skip(`Blocked: Live Supabase network unreachable (${res.networkError.message})`);
        return;
      }
      assert.strictEqual(res.status, 400, 'class_name must be rejected by PostgREST');
      assert.match(res.text, /column course_chapters\.class_name does not exist/);
    });

    test('subjects table has verified columns (id, name, class_id, icon)', async (t) => {
      const res = await probeTableCols('subjects', ['id', 'name', 'class_id', 'icon']);
      if (res.networkError) {
        t.skip(`Blocked: Live Supabase network unreachable (${res.networkError.message})`);
        return;
      }
      assert.strictEqual(res.ok, true, 'subjects columns should return HTTP 200');
      assert.strictEqual(res.status, 200);
    });

    test('course_chapters -> subjects relationship join is supported by PostgREST', async (t) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/course_chapters?select=id,title,subject_id,subjects(id,name)&limit=1`, {
          headers: { apikey: SUPABASE_ANON_KEY }
        });
        assert.strictEqual(res.ok, true);
        assert.strictEqual(res.status, 200);
      } catch (err) {
        if (isNetworkError(err)) {
          t.skip(`Blocked: Live Supabase network unreachable (${err.message})`);
          return;
        }
        throw err;
      }
    });

    test('courses table has verified columns (id, title, class_name, subject, description, thumbnail_url, is_published)', async (t) => {
      const res = await probeTableCols('courses', [
        'id', 'title', 'class_name', 'subject', 'description', 'thumbnail_url', 'is_published'
      ]);
      if (res.networkError) {
        t.skip(`Blocked: Live Supabase network unreachable (${res.networkError.message})`);
        return;
      }
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.status, 200);
    });

    test('chapter_modalities table has verified columns', async (t) => {
      const res = await probeTableCols('chapter_modalities', [
        'id', 'chapter_id', 'modality_type', 'title', 'resource_url', 'content_status'
      ]);
      if (res.networkError) {
        t.skip(`Blocked: Live Supabase network unreachable (${res.networkError.message})`);
        return;
      }
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.status, 200);
    });

    test('class_students table has verified relationship columns', async (t) => {
      const res = await probeTableCols('class_students', ['class_id', 'student_id']);
      if (res.networkError) {
        t.skip(`Blocked: Live Supabase network unreachable (${res.networkError.message})`);
        return;
      }
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.status, 200);
    });

    test('profiles table has verified tenant & identity columns (id, auth_id, role, department)', async (t) => {
      const res = await probeTableCols('profiles', ['id', 'auth_id', 'role', 'department']);
      if (res.networkError) {
        t.skip(`Blocked: Live Supabase network unreachable (${res.networkError.message})`);
        return;
      }
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.status, 200);
    });
  });

  describe('Runtime Contract: Upload Authorization Fail-Closed Tenant Checks', () => {
    const { handleR2Upload } = require('../server/upload.js');

    function createMockReq(body, token = 'teacher_valid_session_jwt_123') {
      return {
        headers: {
          authorization: `Bearer ${token}`,
          'content-length': String(JSON.stringify(body).length)
        },
        socket: { remoteAddress: '127.0.0.1' },
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify(body));
        }
      };
    }

    function createMockRes() {
      return {
        statusCode: null,
        body: '',
        writeHead(status) { this.statusCode = status; },
        end(data) { this.body = data; }
      };
    }

    test('fails closed if class record has no institution_id', async () => {
      const mockFetch = async (url) => {
        const u = new URL(url);
        if (u.pathname === '/auth/v1/user') {
          return { ok: true, json: async () => ({ id: 'u-1', email: 't@school.edu' }) };
        }
        if (u.pathname === '/rest/v1/profiles') {
          return { ok: true, json: async () => [{ id: 'u-1', role: 'teacher', department: 'inst-A' }] };
        }
        if (u.pathname === '/rest/v1/classes') {
          // Class has NULL institution_id
          return { ok: true, json: async () => [{ id: 'c-1', institution_id: null }] };
        }
        return { ok: false, status: 404 };
      };

      const req = createMockReq({
        filename: 'img.png',
        base64Content: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).toString('base64'),
        classId: 'c-1',
        chapterSlug: 'ch-1'
      });
      const res = createMockRes();
      const mockS3 = { send: async () => ({}) };

      await handleR2Upload(req, res, new URL('http://localhost/api/upload-r2'), {
        s3Client: mockS3,
        fetchFn: mockFetch
      });

      assert.strictEqual(res.statusCode, 403, 'Must fail closed with 403 when class has no tenant');
    });

    test('fails closed if user profile has no institution context', async () => {
      const mockFetch = async (url) => {
        const u = new URL(url);
        if (u.pathname === '/auth/v1/user') {
          return { ok: true, json: async () => ({ id: 'u-2', email: 't2@school.edu' }) };
        }
        if (u.pathname === '/rest/v1/profiles') {
          // Teacher has empty department/institution
          return { ok: true, json: async () => [{ id: 'u-2', role: 'teacher', department: '' }] };
        }
        if (u.pathname === '/rest/v1/classes') {
          return { ok: true, json: async () => [{ id: 'c-2', institution_id: 'inst-A' }] };
        }
        return { ok: false, status: 404 };
      };

      const req = createMockReq({
        filename: 'img.png',
        base64Content: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).toString('base64'),
        classId: 'c-2',
        chapterSlug: 'ch-1'
      });
      const res = createMockRes();
      const mockS3 = { send: async () => ({}) };

      await handleR2Upload(req, res, new URL('http://localhost/api/upload-r2'), {
        s3Client: mockS3,
        fetchFn: mockFetch
      });

      assert.strictEqual(res.statusCode, 403, 'Must fail closed with 403 when user has no tenant');
    });
  });

  describe('Runtime Contract: WebSocket Class Access Fail-Closed Tenant Checks', () => {
    const { verifyClassAccess } = require('../server/websocket.js');

    test('verifyClassAccess fails closed if class record has no institution_id', async () => {
      const teacher = { id: 't-1', role: 'teacher', institution_id: 'inst-A', token: 'token-123456789012' };
      const mockFetch = async () => ({
        ok: true,
        json: async () => [{ id: 'class-null-tenant', institution_id: null }]
      });

      const allowed = await verifyClassAccess(teacher, 'class-null-tenant', mockFetch);
      assert.strictEqual(allowed, false, 'Must fail closed when class has no institution_id');
    });

    test('verifyClassAccess fails closed if teacher has no institution_id', async () => {
      const teacher = { id: 't-2', role: 'teacher', institution_id: null, token: 'token-123456789012' };
      const mockFetch = async () => ({
        ok: true,
        json: async () => [{ id: 'class-1', institution_id: 'inst-A' }]
      });

      const allowed = await verifyClassAccess(teacher, 'class-1', mockFetch);
      assert.strictEqual(allowed, false, 'Must fail closed when teacher has no institution_id');
    });

    test('verifyClassAccess fails closed if class belongs to different institution', async () => {
      const teacher = { id: 't-3', role: 'teacher', institution_id: 'inst-A', token: 'token-123456789012' };
      const mockFetch = async () => ({
        ok: true,
        json: async () => [{ id: 'class-2', institution_id: 'inst-B' }]
      });

      const allowed = await verifyClassAccess(teacher, 'class-2', mockFetch);
      assert.strictEqual(allowed, false, 'Must fail closed on cross-tenant class access');
    });

    test('verifyClassAccess succeeds when class belongs to same institution and teacher is assigned', async () => {
      const teacher = { id: 't-4', role: 'teacher', institution_id: 'inst-A', token: 'token-123456789012' };
      const mockFetch = async (url) => {
        assert.doesNotMatch(url, /department/, 'Query must not include department on classes');
        if (url.includes('/classes')) {
          assert.match(url, /select=id,institution_id/, 'Query must select id,institution_id');
          return {
            ok: true,
            json: async () => [{ id: 'class-1', institution_id: 'inst-A' }]
          };
        }
        if (url.includes('/class_teachers')) {
          assert.match(url, /teacher_id=eq\.t-4/, 'Query must filter by teacher ID');
          return {
            ok: true,
            json: async () => [{ class_id: 'class-1', teacher_id: 't-4' }]
          };
        }
        return { ok: false, status: 404 };
      };

      const allowed = await verifyClassAccess(teacher, 'class-1', mockFetch);
      assert.strictEqual(allowed, true, 'Must allow access within same tenant for assigned teacher');
    });
  });

  describe('Runtime Contract: AI Curriculum Resolution Schema Safety', () => {
    test('resolves chapter from DB using title, description, and joined subjects relationship', async () => {
      const mockFetch = async (url) => {
        const u = new URL(url);
        if (u.pathname.includes('/rest/v1/course_chapters')) {
          assert.doesNotMatch(u.search, /chapter_name/, 'Query must not request non-existent chapter_name');
          assert.doesNotMatch(u.search, /class_name/, 'Query must not request non-existent class_name');
          assert.match(u.search, /title/, 'Query must select title');
          assert.match(u.search, /subjects\(id,name\)/, 'Query must join subjects relation');

          return {
            ok: true,
            json: async () => ([{
              id: 'ch-optics-uuid',
              title: 'OPTICS & LIGHT PROPAGATION',
              chapter_slug: 'optics-light',
              description: 'Ray tracing and shadow dynamics in 3D.',
              subject_id: 'sub-science-uuid',
              subjects: { id: 'sub-science-uuid', name: 'Physics & Optics' }
            }])
          };
        }
        return { ok: false, status: 404 };
      };

      const res = await resolveCurriculumContext({
        chapterId: 'optics-light',
        token: 'valid-jwt',
        fetchFn: mockFetch
      });

      assert.ok(res);
      assert.strictEqual(res.grounded, true);
      assert.strictEqual(res.chapterId, 'ch-optics-uuid');
      assert.strictEqual(res.title, 'OPTICS & LIGHT PROPAGATION');
      assert.strictEqual(res.subject, 'Physics & Optics');
      assert.match(res.contextText, /OPTICS & LIGHT PROPAGATION/);
      assert.match(res.contextText, /Physics & Optics/);
    });

    test('returns ungrounded (null) if subject relationship cannot be verified (Rule 10)', async () => {
      const mockFetch = async (url) => {
        const u = new URL(url);
        if (u.pathname.includes('/rest/v1/course_chapters')) {
          return {
            ok: true,
            json: async () => ([{
              id: 'ch-unlinked-uuid',
              title: 'UNLINKED CHAPTER',
              chapter_slug: 'unlinked-chapter',
              description: 'Chapter with unverified subject relation.',
              subject_id: 'sub-nonexistent',
              subjects: null // Relationship could not be resolved!
            }])
          };
        }
        return { ok: false, status: 404 };
      };

      const res = await resolveCurriculumContext({
        chapterId: 'unlinked-chapter',
        token: 'valid-jwt',
        fetchFn: mockFetch
      });

      assert.strictEqual(res, null, 'Unverified subject relationship must fail closed as ungrounded');
    });
  });
});
