import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import WebSocket from 'ws';

process.env.NODE_ENV = 'test';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

before(() => {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
});

after(() => {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
});

const require = createRequire(import.meta.url);
const {
  detectFileType,
  handleR2Upload
} = require('../server/upload.js');

function createMockReq({ headers = {}, body = '' }) {
  const buffer = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  const req = Readable.from([buffer]);
  req.headers = {
    'content-length': String(buffer.length),
    ...headers
  };
  req.socket = { remoteAddress: '127.0.0.1' };
  return req;
}

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

// Minimal valid file buffers for magic byte testing
const VALID_PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
const VALID_JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
const VALID_WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38]);
const VALID_PDF = Buffer.from('%PDF-1.4\n%test\n');
const VALID_MP4 = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D]);
const VALID_MP3 = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
const MALICIOUS_EXE = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00');

describe('P1.1: Upload Security, Authorization & Magic Byte Validation', () => {

  describe('Magic Byte File Detection', () => {
    test('detects PNG file signatures correctly', () => {
      const type = detectFileType(VALID_PNG);
      assert.deepStrictEqual(type, { ext: 'png', mime: 'image/png' });
    });

    test('detects JPEG file signatures correctly', () => {
      const type = detectFileType(VALID_JPEG);
      assert.deepStrictEqual(type, { ext: 'jpg', mime: 'image/jpeg' });
    });

    test('detects WEBP file signatures correctly', () => {
      const type = detectFileType(VALID_WEBP);
      assert.deepStrictEqual(type, { ext: 'webp', mime: 'image/webp' });
    });

    test('detects PDF file signatures correctly', () => {
      const type = detectFileType(VALID_PDF);
      assert.deepStrictEqual(type, { ext: 'pdf', mime: 'application/pdf' });
    });

    test('detects MP4 file signatures correctly', () => {
      const type = detectFileType(VALID_MP4);
      assert.deepStrictEqual(type, { ext: 'mp4', mime: 'video/mp4' });
    });

    test('detects MP3 file signatures correctly', () => {
      const type = detectFileType(VALID_MP3);
      assert.deepStrictEqual(type, { ext: 'mp3', mime: 'audio/mpeg' });
    });

    test('rejects Windows PE executable masquerading as image/pdf', () => {
      const type = detectFileType(MALICIOUS_EXE);
      assert.strictEqual(type, null);
    });

    test('rejects truncated or empty buffers', () => {
      assert.strictEqual(detectFileType(Buffer.alloc(0)), null);
      assert.strictEqual(detectFileType(Buffer.from([0x89, 0x50])), null);
      assert.strictEqual(detectFileType(null), null);
    });
  });

  describe('Destination Authorization & Role Gating in handleR2Upload', () => {
    const mockS3 = {
      uploaded: [],
      async send(cmd) {
        this.uploaded.push(cmd.input);
        return { ETag: '"test-etag"' };
      }
    };

    function createMockAuthFetch(userProfile) {
      return async (url) => {
        const u = new URL(url);
        if (u.pathname === '/auth/v1/user') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: userProfile.id, email: userProfile.email })
          };
        }
        if (u.pathname === '/rest/v1/profiles') {
          return {
            ok: true,
            status: 200,
            json: async () => [{
              id: userProfile.id,
              role: userProfile.role,
              department: userProfile.department || userProfile.institution_id || 'inst-001',
              name: userProfile.name || 'Test User'
            }]
          };
        }
        if (u.pathname === '/rest/v1/classes') {
          if (userProfile._classes) {
            return {
              ok: true,
              status: 200,
              json: async () => userProfile._classes
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => []
          };
        }
        if (u.pathname === '/rest/v1/class_teachers') {
          if (userProfile._class_teachers !== undefined) {
            return {
              ok: true,
              status: 200,
              json: async () => userProfile._class_teachers
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => [{
              class_id: userProfile._classes?.[0]?.id || 'class-101',
              teacher_id: userProfile.id
            }]
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      };
    }

    test('rejects unauthenticated requests with 401', async () => {
      const req = createMockReq({
        headers: {},
        body: { filename: 'test.png', base64Content: VALID_PNG.toString('base64') }
      });
      const res = createMockRes();
      const url = new URL('http://localhost/api/upload-r2');

      await handleR2Upload(req, res, url, {
        s3Client: mockS3,
        fetchFn: async () => ({ ok: false, status: 401 })
      });

      assert.strictEqual(res.statusCode, 401);
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.ok, false);
      assert.match(parsed.error, /Unauthorized/);
    });

    test('rejects students attempting course curriculum uploads with 403', async () => {
      const studentProfile = {
        id: 'student-uuid-1',
        email: 'student@school.edu',
        role: 'student',
        institution_id: 'inst-001'
      };

      const req = createMockReq({
        headers: { authorization: 'Bearer student_valid_session_jwt_123' },
        body: {
          filename: 'slides.pdf',
          base64Content: VALID_PDF.toString('base64'),
          chapterSlug: 'chapter-10',
          classId: 'class-101'
        }
      });
      const res = createMockRes();
      const url = new URL('http://localhost/api/upload-r2');

      await handleR2Upload(req, res, url, {
        s3Client: mockS3,
        fetchFn: createMockAuthFetch(studentProfile)
      });

      assert.strictEqual(res.statusCode, 403);
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.ok, false);
      assert.match(parsed.error, /Students are not permitted/);
    });

    test('rejects teacher course upload if classId is missing with 400', async () => {
      const teacherProfile = {
        id: 'teacher-uuid-1',
        email: 'teacher@school.edu',
        role: 'teacher',
        institution_id: 'inst-001'
      };

      const req = createMockReq({
        headers: { authorization: 'Bearer teacher_valid_session_jwt_123' },
        body: {
          filename: 'diagram.png',
          base64Content: VALID_PNG.toString('base64'),
          chapterSlug: 'chapter-10'
          // classId omitted
        }
      });
      const res = createMockRes();
      const url = new URL('http://localhost/api/upload-r2');

      await handleR2Upload(req, res, url, {
        s3Client: mockS3,
        fetchFn: createMockAuthFetch(teacherProfile)
      });

      assert.strictEqual(res.statusCode, 400);
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.ok, false);
      assert.match(parsed.error, /classId is required/);
    });

    test('rejects teacher course upload if class belongs to another tenant with 403', async () => {
      const teacherProfile = {
        id: 'teacher-uuid-1',
        email: 'teacher@school.edu',
        role: 'teacher',
        institution_id: 'inst-001',
        _classes: [{ id: 'class-999', institution_id: 'inst-DIFFERENT' }]
      };

      const req = createMockReq({
        headers: { authorization: 'Bearer teacher_valid_session_jwt_123' },
        body: {
          filename: 'diagram.png',
          base64Content: VALID_PNG.toString('base64'),
          chapterSlug: 'chapter-10',
          classId: 'class-999'
        }
      });
      const res = createMockRes();
      const url = new URL('http://localhost/api/upload-r2');

      await handleR2Upload(req, res, url, {
        s3Client: mockS3,
        fetchFn: createMockAuthFetch(teacherProfile)
      });

      assert.strictEqual(res.statusCode, 403);
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.ok, false);
      assert.match(parsed.error, /permission to upload curriculum for this class/);
    });

    test('rejects teacher course upload if class has missing tenant data (fails closed)', async () => {
      const teacherProfile = {
        id: 'teacher-uuid-1',
        email: 'teacher@school.edu',
        role: 'teacher',
        institution_id: 'inst-001',
        _classes: [{ id: 'class-no-tenant', institution_id: null }]
      };

      const req = createMockReq({
        headers: { authorization: 'Bearer teacher_valid_session_jwt_123' },
        body: {
          filename: 'diagram.png',
          base64Content: VALID_PNG.toString('base64'),
          chapterSlug: 'chapter-10',
          classId: 'class-no-tenant'
        }
      });
      const res = createMockRes();
      const url = new URL('http://localhost/api/upload-r2');

      await handleR2Upload(req, res, url, {
        s3Client: mockS3,
        fetchFn: createMockAuthFetch(teacherProfile)
      });

      assert.strictEqual(res.statusCode, 403);
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.ok, false);
      assert.match(parsed.error, /permission to upload curriculum for this class/);
    });

    test('authorizes teacher course upload with verified class and derives server key', async () => {
      const teacherProfile = {
        id: 'teacher-uuid-1',
        email: 'teacher@school.edu',
        role: 'teacher',
        institution_id: 'inst-001',
        _classes: [{ id: 'class-101', institution_id: 'inst-001' }]
      };

      const req = createMockReq({
        headers: { authorization: 'Bearer teacher_valid_session_jwt_123' },
        body: {
          filename: 'optics-lab.png',
          base64Content: VALID_PNG.toString('base64'),
          chapterSlug: 'chapter-10-optics',
          modalitySlug: '3d_scene',
          classId: 'class-101'
        }
      });
      const res = createMockRes();
      const url = new URL('http://localhost/api/upload-r2');

      await handleR2Upload(req, res, url, {
        s3Client: mockS3,
        fetchFn: createMockAuthFetch(teacherProfile)
      });

      assert.strictEqual(res.statusCode, 200);
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.ok, true);
      assert.match(parsed.key, /^courses\/inst-001\/class-101\/chapter-10-optics\/3d_scene\/[a-f0-9-]+\.png$/);
    });

    test('allows avatar upload for student with sanitized destination key', async () => {
      const studentProfile = {
        id: 'student-uuid-42',
        email: 'student42@school.edu',
        role: 'student',
        institution_id: 'inst-001'
      };

      const req = createMockReq({
        headers: { authorization: 'Bearer student_valid_session_jwt_123' },
        body: {
          filename: 'my-avatar.png',
          base64Content: VALID_PNG.toString('base64'),
          category: 'avatars'
        }
      });
      const res = createMockRes();
      const url = new URL('http://localhost/api/upload-r2?category=avatars');

      await handleR2Upload(req, res, url, {
        s3Client: mockS3,
        fetchFn: createMockAuthFetch(studentProfile)
      });

      assert.strictEqual(res.statusCode, 200);
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.ok, true);
      assert.match(parsed.key, /^avatars\/student-uuid-42_[a-f0-9-]+\.png$/);
    });

    test('rejects malicious executable masquerading as PNG with 415', async () => {
      const teacherProfile = {
        id: 'teacher-uuid-1',
        email: 'teacher@school.edu',
        role: 'teacher',
        institution_id: 'inst-001',
        _classes: [{ id: 'class-101', institution_id: 'inst-001' }]
      };

      const req = createMockReq({
        headers: { authorization: 'Bearer teacher_valid_session_jwt_123' },
        body: {
          filename: 'exploit.png',
          base64Content: MALICIOUS_EXE.toString('base64'),
          classId: 'class-101'
        }
      });
      const res = createMockRes();
      const url = new URL('http://localhost/api/upload-r2');

      await handleR2Upload(req, res, url, {
        s3Client: mockS3,
        fetchFn: createMockAuthFetch(teacherProfile)
      });

      assert.strictEqual(res.statusCode, 415);
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.ok, false);
      assert.match(parsed.error, /Unsupported Media Type/);
    });
    test('rejects unassigned teacher course upload with 403', async () => {
      const teacherProfile = {
        id: 'teacher-uuid-unassigned',
        email: 'teacher-unassigned@school.edu',
        role: 'teacher',
        institution_id: 'inst-001',
        _classes: [{ id: 'class-101', institution_id: 'inst-001' }],
        _class_teachers: [] // Empty assignments
      };

      const req = createMockReq({
        headers: { authorization: 'Bearer teacher_unassigned_jwt' },
        body: {
          filename: 'diagram.png',
          base64Content: VALID_PNG.toString('base64'),
          chapterSlug: 'chapter-10',
          classId: 'class-101'
        }
      });
      const res = createMockRes();
      const url = new URL('http://localhost/api/upload-r2');

      await handleR2Upload(req, res, url, {
        s3Client: mockS3,
        fetchFn: createMockAuthFetch(teacherProfile)
      });

      assert.strictEqual(res.statusCode, 403);
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.ok, false);
      assert.match(parsed.error, /permission to upload curriculum for this class/);
    });

    test('authorizes admin course upload for class in same institution', async () => {
      const adminProfile = {
        id: 'admin-uuid-1',
        email: 'admin@school.edu',
        role: 'admin',
        institution_id: 'inst-001',
        _classes: [{ id: 'class-admin-101', institution_id: 'inst-001' }]
      };

      const req = createMockReq({
        headers: { authorization: 'Bearer admin_valid_session_jwt_123' },
        body: {
          filename: 'curriculum-plan.pdf',
          base64Content: VALID_PDF.toString('base64'),
          chapterSlug: 'chapter-admin-plan',
          classId: 'class-admin-101'
        }
      });
      const res = createMockRes();
      const url = new URL('http://localhost/api/upload-r2');

      await handleR2Upload(req, res, url, {
        s3Client: mockS3,
        fetchFn: createMockAuthFetch(adminProfile)
      });

      assert.strictEqual(res.statusCode, 200);
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.ok, true);
      assert.match(parsed.key, /^courses\/inst-001\/class-admin-101\/chapter-admin-plan\/content\/[a-f0-9-]+\.pdf$/);
    });

    test('rejects admin course upload for class in different institution with 403', async () => {
      const adminProfile = {
        id: 'admin-uuid-1',
        email: 'admin@school.edu',
        role: 'admin',
        institution_id: 'inst-001',
        _classes: [{ id: 'class-inst2', institution_id: 'inst-002' }]
      };

      const req = createMockReq({
        headers: { authorization: 'Bearer admin_valid_session_jwt_123' },
        body: {
          filename: 'curriculum-plan.pdf',
          base64Content: VALID_PDF.toString('base64'),
          chapterSlug: 'chapter-admin-plan',
          classId: 'class-inst2'
        }
      });
      const res = createMockRes();
      const url = new URL('http://localhost/api/upload-r2');

      await handleR2Upload(req, res, url, {
        s3Client: mockS3,
        fetchFn: createMockAuthFetch(adminProfile)
      });

      assert.strictEqual(res.statusCode, 403);
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.ok, false);
      assert.match(parsed.error, /permission to upload curriculum for this class/);
    });

    test('authorizes superadmin upload and derives key strictly from DB class tenant (not platform default)', async () => {
      const saProfile = {
        id: 'sa-uuid-1',
        email: 'sa@platform.edu',
        role: 'superadmin',
        institution_id: 'platform',
        _classes: [{ id: 'class-remote-99', institution_id: 'inst-remote-tenant' }]
      };

      const req = createMockReq({
        headers: { authorization: 'Bearer superadmin_valid_session_jwt_123' },
        body: {
          filename: 'universal-diagram.png',
          base64Content: VALID_PNG.toString('base64'),
          chapterSlug: 'chapter-optics',
          modalitySlug: 'front_visuals',
          classId: 'class-remote-99'
        }
      });
      const res = createMockRes();
      const url = new URL('http://localhost/api/upload-r2');

      await handleR2Upload(req, res, url, {
        s3Client: mockS3,
        fetchFn: createMockAuthFetch(saProfile)
      });

      assert.strictEqual(res.statusCode, 200);
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.ok, true);
      // Key must start with DB tenant 'inst-remote-tenant', NOT 'platform'
      assert.match(parsed.key, /^courses\/inst-remote-tenant\/class-remote-99\/chapter-optics\/front_visuals\/[a-f0-9-]+\.png$/);
    });
  });
});
