import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
import { setupWebSocketServer } from '../server/websocket.js';

describe('P0.3: WebSocket Room & Tenant Isolation Engine', () => {
  let server;
  let port;

  // Custom mock fetch for WebSocket tests
  const mockFetch = async (url, options = {}) => {
    const urlStr = String(url);
    const authHeader = options.headers?.Authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();

    // 1. Supabase Auth endpoint
    if (urlStr.includes('/auth/v1/user')) {
      if (token === 'student-token-instA') {
        return { ok: true, json: async () => ({ id: 'auth-student-1', email: 's1@inst-a.edu' }) };
      }
      if (token === 'student-token-no-tenant') {
        return { ok: true, json: async () => ({ id: 'auth-student-2', email: 's2@external.edu' }) };
      }
      if (token === 'teacher-token-instA') {
        return { ok: true, json: async () => ({ id: 'auth-teacher-1', email: 't1@inst-a.edu' }) };
      }
      if (token === 'teacher-token-unassigned-instA') {
        return { ok: true, json: async () => ({ id: 'auth-teacher-unassigned', email: 't-unassigned@inst-a.edu' }) };
      }
      if (token === 'teacher-token-instB') {
        return { ok: true, json: async () => ({ id: 'auth-teacher-instB', email: 't-b@inst-b.edu' }) };
      }
      if (token === 'admin-token-instA') {
        return { ok: true, json: async () => ({ id: 'auth-admin-1', email: 'a1@inst-a.edu' }) };
      }
      if (token === 'superadmin-token') {
        return { ok: true, json: async () => ({ id: 'auth-sa-1', email: 'sa@platform.edu' }) };
      }
      return { ok: false, status: 401 };
    }

    // 2. Profiles lookup
    if (urlStr.includes('/rest/v1/profiles?auth_id=eq.')) {
      if (token === 'student-token-instA') {
        return { ok: true, json: async () => ([{ id: 'p-student-1', role: 'student', department: 'inst-A', name: 'Student 1' }]) };
      }
      if (token === 'student-token-no-tenant') {
        return { ok: true, json: async () => ([{ id: 'p-student-2', role: 'student', department: '', name: 'Student No Tenant' }]) };
      }
      if (token === 'teacher-token-instA') {
        return { ok: true, json: async () => ([{ id: 'p-teacher-1', role: 'teacher', department: 'inst-A', name: 'Teacher 1' }]) };
      }
      if (token === 'teacher-token-unassigned-instA') {
        return { ok: true, json: async () => ([{ id: 'p-teacher-unassigned', role: 'teacher', department: 'inst-A', name: 'Teacher Unassigned' }]) };
      }
      if (token === 'teacher-token-instB') {
        return { ok: true, json: async () => ([{ id: 'p-teacher-instB', role: 'teacher', department: 'inst-B', name: 'Teacher Inst B' }]) };
      }
      if (token === 'admin-token-instA') {
        return { ok: true, json: async () => ([{ id: 'p-admin-1', role: 'admin', department: 'inst-A', name: 'Admin 1' }]) };
      }
      if (token === 'superadmin-token') {
        return { ok: true, json: async () => ([{ id: 'p-sa-1', role: 'super_admin', department: 'platform', name: 'Super Admin' }]) };
      }
      return { ok: false, status: 404 };
    }

    // 3. Classes lookup
    if (urlStr.includes('/rest/v1/classes?id=eq.')) {
      if (urlStr.includes('class-null-tenant')) {
        return { ok: true, json: async () => ([{ id: 'class-null-tenant', institution_id: null }]) };
      }
      if (urlStr.includes('class-A1')) {
        return { ok: true, json: async () => ([{ id: 'class-A1', institution_id: 'inst-A' }]) };
      }
      if (urlStr.includes('class-B1')) {
        return { ok: true, json: async () => ([{ id: 'class-B1', institution_id: 'inst-B' }]) };
      }
      return { ok: true, json: async () => ([]) };
    }

    // 4. class_students enrollment lookup
    if (urlStr.includes('/rest/v1/class_students?class_id=eq.')) {
      if (urlStr.includes('class-A1') && urlStr.includes('p-student-1')) {
        return { ok: true, json: async () => ([{ class_id: 'class-A1', student_id: 'p-student-1' }]) };
      }
      return { ok: true, json: async () => ([]) };
    }

    // 5. class_teachers assignment lookup
    if (urlStr.includes('/rest/v1/class_teachers?class_id=eq.')) {
      if (urlStr.includes('class-A1') && urlStr.includes('p-teacher-1')) {
        return { ok: true, json: async () => ([{ class_id: 'class-A1', teacher_id: 'p-teacher-1' }]) };
      }
      return { ok: true, json: async () => ([]) };
    }

    return { ok: false, status: 404 };
  };

  before(async () => {
    server = http.createServer();
    setupWebSocketServer(server, { fetchFn: mockFetch });
    await new Promise((res) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        res();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((res) => server.close(res));
    }
  });

  test('P0.3-01: Rejects query-string token with 4401 close code', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}?token=some-token`);
    ws.on('close', (code, reason) => {
      assert.strictEqual(code, 4401);
      assert.match(reason.toString(), /Query-string tokens are deprecated/i);
      done();
    });
  });

  test('P0.3-02: Rejects connection if initial message is not auth', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'identify', email: 'impostor@school.edu' }));
    });
    ws.on('close', (code, reason) => {
      assert.strictEqual(code, 4401);
      assert.match(reason.toString(), /Initial message must be auth/i);
      done();
    });
  });

  test('P0.3-03: Rejects connection if token is invalid', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'invalid-expired-token' }));
    });
    ws.on('close', (code, reason) => {
      assert.strictEqual(code, 4401);
      assert.match(reason.toString(), /Invalid token/i);
      done();
    });
  });

  test('P0.3-04: Rejects connection with 4403 if user lacks institution context', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'student-token-no-tenant' }));
    });
    ws.on('close', (code, reason) => {
      assert.strictEqual(code, 4403);
      assert.match(reason.toString(), /missing institution context/i);
      done();
    });
  });

  test('P0.3-05: Authenticates successfully with valid token and joins tenant room', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'student-token-instA' }));
    });
    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        assert.strictEqual(data.user.email, 's1@inst-a.edu');
        assert.strictEqual(data.user.institution_id, 'inst-A');
        assert.strictEqual(data.user.role, 'student');
        ws.close();
        done();
      }
    });
  });

  test('P0.3-06: Cross-tenant room subscription is blocked for normal users', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'student-token-instA' }));
    });
    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        ws.send(JSON.stringify({ type: 'join_room', room: 'tenant:inst-B' }));
      }
      if (data.type === 'error') {
        assert.match(data.error, /Cannot join room outside your institution/i);
        ws.close();
        done();
      }
    });
  });

  test('P0.3-07: Student unenrolled in class cannot join class room', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'student-token-instA' }));
    });
    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        ws.send(JSON.stringify({ type: 'join_class', class_id: 'class-B1' }));
      }
      if (data.type === 'error') {
        assert.match(data.error, /not authorized or enrolled/i);
        ws.close();
        done();
      }
    });
  });

  test('P0.3-08: Student enrolled in class can join class room', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'student-token-instA' }));
    });
    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        ws.send(JSON.stringify({ type: 'join_class', class_id: 'class-A1' }));
      }
      if (data.type === 'room_joined') {
        assert.strictEqual(data.room, 'class-A1');
        ws.close();
        done();
      }
    });
  });

  test('P0.3-09: Student cannot broadcast timetable updates', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'student-token-instA' }));
    });
    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        ws.send(JSON.stringify({ type: 'timetable_update', payload: { period: 1 } }));
      }
      if (data.type === 'error') {
        assert.match(data.error, /Insufficient privileges/i);
        ws.close();
        done();
      }
    });
  });

  test('P0.3-10: Timetable update overwrites spoofed tenant with authenticated institution_id', (t, done) => {
    const wsTeacher = new WebSocket(`ws://127.0.0.1:${port}`);
    const wsStudent = new WebSocket(`ws://127.0.0.1:${port}`);

    wsStudent.on('open', () => {
      wsStudent.send(JSON.stringify({ type: 'auth', token: 'student-token-instA' }));
    });

    wsStudent.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        wsTeacher.send(JSON.stringify({ type: 'auth', token: 'teacher-token-instA' }));
      }
      if (data.type === 'timetable_update') {
        assert.strictEqual(data.tenant_id, 'inst-A');
        assert.strictEqual(data.payload.institution_id, 'inst-A');
        assert.strictEqual(data.updated_by, 't1@inst-a.edu');
        wsTeacher.close();
        wsStudent.close();
        done();
      }
    });

    wsTeacher.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        wsTeacher.send(JSON.stringify({
          type: 'timetable_update',
          payload: {
            institution_id: 'inst-SPOOFED',
            subject: 'Physics'
          }
        }));
      }
    });
  });

  test('P0.3-11: Teacher assigned to class can join class room', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'teacher-token-instA' }));
    });
    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        ws.send(JSON.stringify({ type: 'join_class', class_id: 'class-A1' }));
      }
      if (data.type === 'room_joined') {
        assert.strictEqual(data.room, 'class-A1');
        assert.strictEqual(data.canonical_room, 'class:class-A1');
        ws.close();
        done();
      }
    });
  });

  test('P0.3-12: Teacher unassigned to class cannot join class room', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'teacher-token-unassigned-instA' }));
    });
    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        ws.send(JSON.stringify({ type: 'join_class', class_id: 'class-A1' }));
      }
      if (data.type === 'error') {
        assert.match(data.error, /not authorized or enrolled/i);
        ws.close();
        done();
      }
    });
  });

  test('P0.3-13: Cross-tenant teacher cannot join class room', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'teacher-token-instB' }));
    });
    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        ws.send(JSON.stringify({ type: 'join_class', class_id: 'class-A1' }));
      }
      if (data.type === 'error') {
        assert.match(data.error, /not authorized or enrolled/i);
        ws.close();
        done();
      }
    });
  });

  test('P0.3-14: Class with null institution_id is rejected on room join (fails closed)', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'admin-token-instA' }));
    });
    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        ws.send(JSON.stringify({ type: 'join_class', class_id: 'class-null-tenant' }));
      }
      if (data.type === 'error') {
        assert.match(data.error, /not authorized or enrolled/i);
        ws.close();
        done();
      }
    });
  });

  test('P0.3-15: Malformed room identifier is rejected with error', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'student-token-instA' }));
    });
    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        ws.send(JSON.stringify({ type: 'join_room', room: '../../malicious/room' }));
      }
      if (data.type === 'error') {
        assert.match(data.error, /Invalid room format/i);
        ws.close();
        done();
      }
    });
  });

  test('P0.3-16: Unassigned teacher cannot broadcast timetable update for a class', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'teacher-token-unassigned-instA' }));
    });
    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        ws.send(JSON.stringify({
          type: 'timetable_update',
          payload: {
            class_id: 'class-A1',
            subject: 'Chemistry'
          }
        }));
      }
      if (data.type === 'error') {
        assert.match(data.error, /Forbidden: Target class does not belong to your institution or you lack permission/i);
        ws.close();
        done();
      }
    });
  });

  test('P0.3-17: Cross-tenant teacher cannot broadcast timetable update for a class', (t, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'teacher-token-instB' }));
    });
    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        ws.send(JSON.stringify({
          type: 'timetable_update',
          payload: {
            class_id: 'class-A1',
            subject: 'Biology'
          }
        }));
      }
      if (data.type === 'error') {
        assert.match(data.error, /Forbidden: Target class does not belong to your institution or you lack permission/i);
        ws.close();
        done();
      }
    });
  });

  test('P0.3-18: Assigned teacher broadcasts timetable update for class, deriving tenant from class DB record', (t, done) => {
    const wsTeacher = new WebSocket(`ws://127.0.0.1:${port}`);
    const wsStudent = new WebSocket(`ws://127.0.0.1:${port}`);

    wsStudent.on('open', () => {
      wsStudent.send(JSON.stringify({ type: 'auth', token: 'student-token-instA' }));
    });

    wsStudent.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        wsStudent.send(JSON.stringify({ type: 'join_class', class_id: 'class-A1' }));
      }
      if (data.type === 'room_joined') {
        wsTeacher.send(JSON.stringify({ type: 'auth', token: 'teacher-token-instA' }));
      }
      if (data.type === 'timetable_update') {
        assert.strictEqual(data.tenant_id, 'inst-A');
        assert.strictEqual(data.class_id, 'class-A1');
        assert.strictEqual(data.payload.institution_id, 'inst-A');
        assert.strictEqual(data.payload.subject, 'Optics');
        assert.strictEqual(data.updated_by, 't1@inst-a.edu');
        wsTeacher.close();
        wsStudent.close();
        done();
      }
    });

    wsTeacher.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'auth_success') {
        wsTeacher.send(JSON.stringify({
          type: 'timetable_update',
          payload: {
            class_id: 'class-A1',
            institution_id: 'inst-SPOOFED',
            subject: 'Optics'
          }
        }));
      }
    });
  });
});
