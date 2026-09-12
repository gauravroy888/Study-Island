const { WebSocketServer } = require('ws');
const { SUPABASE_URL, SUPABASE_ANON_KEY, verifySupabaseJWT } = require('./auth');

/**
 * Verifies if a user has access to a specific class.
 * - SuperAdmin: access to all classes.
 * - Admin: access to classes in their institution.
 * - Teacher: access to classes in their institution.
 * - Student: must be enrolled in class_students.
/**
 * Resolves a class and verifies user access.
 * Returns { authorized: boolean, class: Object|null }
 *
 * Requirements:
 * 1. Reject tenant-scoped classes where institution_id is null.
 * 2. Never fall back to the current user's tenant for a class whose tenant is unknown.
 * 3. Never fall back to 'inst-dps-001'.
 * 4. Resolve the class using actual live columns only ('id,institution_id').
 * 5. For students: Require a verified class_students membership.
 * 6. For teachers: Verify class_teachers assignment if that table/relationship is the actual platform model.
 * 7. For admins: Verify same institution.
 * 8. For SuperAdmins: Allow cross-tenant access only where explicitly required (class must exist in DB with valid tenant).
 */
async function resolveAndVerifyClass(user, classId, fetchFn = fetch) {
  if (!user || !classId) return { authorized: false, class: null };

  try {
    // 1. Resolve class from database using actual live columns only (no 'department')
    const resp = await fetchFn(
      `${SUPABASE_URL}/rest/v1/classes?id=eq.${encodeURIComponent(classId)}&select=id,institution_id`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${user.token}`
        }
      }
    );
    if (!resp.ok) return { authorized: false, class: null };
    const classes = await resp.json();
    if (!Array.isArray(classes) || classes.length === 0) return { authorized: false, class: null };
    const cls = classes[0];

    // 2. Reject classes where institution_id is null or empty (fail-closed, zero tenant fallback)
    const classTenant = cls.institution_id;
    if (!classTenant || typeof classTenant !== 'string' || !classTenant.trim()) {
      return { authorized: false, class: null };
    }

    // 3. SuperAdmin: authorized for any valid database class with a verified tenant
    if (['super_admin', 'superadmin'].includes(user.role)) {
      return { authorized: true, class: cls };
    }

    // 4. Non-superadmins must belong to the same institution as the class
    if (!user.institution_id || user.institution_id !== classTenant) {
      return { authorized: false, class: cls };
    }

    // 5. Admin: authorized for all classes within their institution
    if (user.role === 'admin') {
      return { authorized: true, class: cls };
    }

    // 6. Teacher: verify assignment in class_teachers
    if (user.role === 'teacher') {
      const teacherId = user.profile_id || user.id;
      const ctResp = await fetchFn(
        `${SUPABASE_URL}/rest/v1/class_teachers?class_id=eq.${encodeURIComponent(cls.id)}&teacher_id=eq.${encodeURIComponent(teacherId)}&select=class_id,teacher_id`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${user.token}`
          }
        }
      );
      if (!ctResp.ok) return { authorized: false, class: cls };
      const assignments = await ctResp.json();
      const isAssigned = Array.isArray(assignments) && assignments.length > 0;
      return { authorized: isAssigned, class: cls };
    }

    // 7. Student: verify enrollment in class_students
    if (user.role === 'student') {
      const studentId = user.profile_id || user.id;
      const csResp = await fetchFn(
        `${SUPABASE_URL}/rest/v1/class_students?class_id=eq.${encodeURIComponent(cls.id)}&student_id=eq.${encodeURIComponent(studentId)}&select=class_id,student_id`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${user.token}`
          }
        }
      );
      if (!csResp.ok) return { authorized: false, class: cls };
      const enrollments = await csResp.json();
      const isEnrolled = Array.isArray(enrollments) && enrollments.length > 0;
      return { authorized: isEnrolled, class: cls };
    }

    return { authorized: false, class: cls };
  } catch (err) {
    console.error('[WebSocket] Error verifying class access:', err);
    return { authorized: false, class: null };
  }
}

/**
 * Boolean wrapper for resolveAndVerifyClass to maintain backwards compatibility with existing callers.
 */
async function verifyClassAccess(user, classId, fetchFn = fetch) {
  const result = await resolveAndVerifyClass(user, classId, fetchFn);
  return result.authorized;
}

function setupWebSocketServer(server, options = {}) {
  const fetchFn = options.fetchFn || fetch;

  // Native WebSocket Presence & Realtime Isolation Engine
  const wss = new WebSocketServer({
    server,
    maxPayload: 64 * 1024 // Enforce maximum message size (64KB)
  });

  // Presence map: ws socket -> { email, institutionId, role }
  const activePresenceMap = new Map();

  /**
   * Tenant-isolated presence broadcast:
   * Each client only receives the online presence list for their institution_id.
   * Superadmins receive a global view across all tenants.
   */
  const broadcastPresenceList = () => {
    // 1. Gather all distinct active tenants
    const activeTenants = new Set();
    for (const client of wss.clients) {
      if (client.readyState === 1 && client.isAuthenticated && client.institutionId) {
        activeTenants.add(client.institutionId);
      }
    }

    // 2. Broadcast tenant-scoped presence
    for (const tenantId of activeTenants) {
      const tenantEmails = Array.from(new Set(
        Array.from(wss.clients)
          .filter(c => c.readyState === 1 && c.isAuthenticated && c.institutionId === tenantId && c.user?.email)
          .map(c => c.user.email.toLowerCase().trim())
      ));

      const payload = JSON.stringify({
        type: 'presence_sync',
        tenant_id: tenantId,
        emails: tenantEmails
      });

      for (const client of wss.clients) {
        if (client.readyState === 1 && client.isAuthenticated && client.institutionId === tenantId && !client.isSuperAdmin) {
          client.send(payload);
        }
      }
    }

    // 3. Superadmins receive complete cross-tenant presence
    const superAdmins = Array.from(wss.clients).filter(c => c.readyState === 1 && c.isAuthenticated && c.isSuperAdmin);
    if (superAdmins.length > 0) {
      const allEmails = Array.from(new Set(
        Array.from(wss.clients)
          .filter(c => c.readyState === 1 && c.isAuthenticated && c.user?.email)
          .map(c => c.user.email.toLowerCase().trim())
      ));
      const saPayload = JSON.stringify({
        type: 'presence_sync',
        tenant_id: 'all',
        emails: allEmails
      });
      for (const sa of superAdmins) {
        sa.send(saPayload);
      }
    }
  };

  wss.on('connection', async (ws, req) => {
    ws.isAuthenticated = false;
    ws.user = null;
    ws.institutionId = null;
    ws.isSuperAdmin = false;
    ws.rooms = new Set();
    ws.messageTimestamps = [];

    let authTimeout = null;

    const handleAuthenticatedUser = (user) => {
      // Reject non-superadmins with missing tenant context
      if (!user.institution_id && !['super_admin', 'superadmin'].includes(user.role)) {
        ws.close(4403, 'Forbidden: User profile is missing institution context');
        return;
      }

      ws.user = user;
      ws.isAuthenticated = true;
      ws.institutionId = user.institution_id || 'platform';
      ws.isSuperAdmin = ['super_admin', 'superadmin'].includes(user.role);
      ws.rooms.add(`tenant:${ws.institutionId}`);

      if (authTimeout) {
        clearTimeout(authTimeout);
        authTimeout = null;
      }
      activePresenceMap.set(ws, {
        email: user.email.toLowerCase().trim(),
        institutionId: ws.institutionId,
        role: user.role
      });
      broadcastPresenceList();
      ws.send(JSON.stringify({
        type: 'auth_success',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          institution_id: ws.institutionId
        }
      }));
    };

    // Deprecate & reject query string token parameter to prevent leakage in URLs/logs
    let tokenFromUrl = null;
    try {
      const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      tokenFromUrl = reqUrl.searchParams.get('token');
    } catch (_) {}

    if (tokenFromUrl) {
      console.warn('[WebSocket] Rejected query-string token. Initial { type: "auth", token } message is strictly required.');
      ws.close(4401, 'Unauthorized: Query-string tokens are deprecated. Send { type: "auth", token } as initial message');
      return;
    }

    // Expect initial { type: 'auth', token: '<JWT>' } message within 5 seconds
    authTimeout = setTimeout(() => {
      if (!ws.isAuthenticated) {
        ws.close(4401, 'Unauthorized: Authentication timed out after 5 seconds');
      }
    }, 5000);

    ws.on('message', async (message) => {
      // Enforce maximum message size (64KB)
      if (message.length > 64 * 1024) {
        ws.close(1009, 'Message exceeds 64KB size limit');
        return;
      }

      // Basic rate limit: max 60 messages per minute per socket
      const now = Date.now();
      ws.messageTimestamps = ws.messageTimestamps.filter(t => now - t < 60000);
      if (ws.messageTimestamps.length >= 60) {
        ws.send(JSON.stringify({ type: 'error', error: 'Rate limit exceeded: max 60 messages per minute' }));
        return;
      }
      ws.messageTimestamps.push(now);

      let data;
      try {
        data = JSON.parse(message.toString());
      } catch (_) {
        return;
      }

      // Authenticate unauthenticated sockets via initial auth message
      if (!ws.isAuthenticated) {
        if (data.type === 'auth' && data.token) {
          const user = await verifySupabaseJWT(data.token, { fetchFn });
          if (!user || !user.id) {
            if (authTimeout) clearTimeout(authTimeout);
            ws.close(4401, 'Unauthorized: Invalid token in auth message');
            return;
          }
          handleAuthenticatedUser(user);
        } else {
          if (authTimeout) clearTimeout(authTimeout);
          ws.close(4401, 'Unauthorized: Initial message must be auth');
        }
        return;
      }

      // Derivation of identity: The client CANNOT send { type: 'identify', email: ... } to claim any email.
      if (data.type === 'identify') {
        activePresenceMap.set(ws, {
          email: ws.user.email.toLowerCase().trim(),
          institutionId: ws.institutionId,
          role: ws.user.role
        });
        broadcastPresenceList();
        return;
      }

      // Room subscriptions
      if (data.type === 'join_room' || data.type === 'join_class') {
        const rawRoom = data.room || data.class_id;
        if (typeof rawRoom !== 'string' || !rawRoom.trim()) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid room format: room or class_id required'
          }));
          return;
        }
        const cleanRoom = rawRoom.trim();

        // 1. Validate room format: tenant:<id>, class:<id>, or valid alphanumeric/hyphen/underscore id
        const ROOM_FORMAT_REGEX = /^(tenant:[a-zA-Z0-9_-]+|class:[a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+)$/;
        if (!ROOM_FORMAT_REGEX.test(cleanRoom)) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid room format: must be tenant:<id>, class:<id>, or valid alphanumeric id'
          }));
          return;
        }

        // 2. Strict Tenant room boundary enforcement
        if (cleanRoom.startsWith('tenant:')) {
          const targetTenant = cleanRoom.slice(7);
          if (!ws.isSuperAdmin && targetTenant !== ws.institutionId) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Forbidden: Cannot join room outside your institution tenant'
            }));
            return;
          }
          const canonicalRoom = `tenant:${targetTenant}`;
          ws.rooms.add(canonicalRoom);
          ws.send(JSON.stringify({ type: 'room_joined', room: cleanRoom, canonical_room: canonicalRoom }));
          return;
        }

        // 3. Strict Class room boundary enforcement
        const classId = data.class_id || (cleanRoom.startsWith('class:') ? cleanRoom.slice(6) : cleanRoom);
        const { authorized, class: cls } = await resolveAndVerifyClass(ws.user, classId, fetchFn);
        if (!authorized || !cls) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Forbidden: You are not authorized or enrolled in this class'
          }));
          return;
        }

        const canonicalRoom = `class:${cls.id}`;
        ws.rooms.add(canonicalRoom);
        if (cleanRoom !== canonicalRoom) {
          ws.rooms.add(cleanRoom);
        }
        ws.send(JSON.stringify({ type: 'room_joined', room: cleanRoom, canonical_room: canonicalRoom }));
        return;
      }

      if (data.type === 'leave_room' || data.type === 'leave_class') {
        const rawRoom = data.room || data.class_id;
        if (typeof rawRoom === 'string' && rawRoom.trim()) {
          const cleanRoom = rawRoom.trim();
          const classId = cleanRoom.startsWith('class:') ? cleanRoom.slice(6) : cleanRoom;
          ws.rooms.delete(cleanRoom);
          ws.rooms.delete(`class:${classId}`);
          ws.send(JSON.stringify({ type: 'room_left', room: cleanRoom }));
        }
        return;
      }

      // Timetable Updates
      if (data.type === 'timetable_update') {
        const allowedRoles = ['admin', 'teacher', 'super_admin', 'superadmin'];
        if (!allowedRoles.includes(ws.user.role)) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Forbidden: Insufficient privileges to broadcast timetable updates'
          }));
          return;
        }

        const targetClassId = data.payload?.class_id || null;
        let derivedTenantId = null;

        if (targetClassId) {
          // Class-scoped timetable update:
          // 1. Resolve class from database and verify sender permission
          const { authorized, class: cls } = await resolveAndVerifyClass(ws.user, targetClassId, fetchFn);
          if (!authorized || !cls) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Forbidden: Target class does not belong to your institution or you lack permission'
            }));
            return;
          }

          // 2. Derive tenant directly from the verified database class record
          derivedTenantId = cls.institution_id;
        } else {
          // Institution-scoped timetable update:
          if (ws.isSuperAdmin) {
            derivedTenantId = data.payload?.institution_id || ws.institutionId;
          } else {
            derivedTenantId = ws.institutionId;
          }
        }

        if (!derivedTenantId) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Forbidden: Cannot derive institution tenant for timetable broadcast'
          }));
          return;
        }

        // Strictly overwrite any client spoofed tenant with verified derived tenant
        const safePayload = {
          ...data.payload,
          institution_id: derivedTenantId
        };

        const payload = JSON.stringify({
          type: 'timetable_update',
          payload: safePayload,
          tenant_id: derivedTenantId,
          class_id: targetClassId,
          updated_by: ws.user.email
        });

        for (const client of wss.clients) {
          if (client.readyState === 1 && client.isAuthenticated) {
            // Superadmins receive all timetable broadcasts
            if (client.isSuperAdmin) {
              client.send(payload);
              continue;
            }

            // Strict tenant isolation: must belong to the target tenant
            if (client.institutionId !== derivedTenantId) {
              continue;
            }

            // Class isolation:
            // Admin & teacher in that tenant receive all updates for their school
            // Students only receive if subscribed to the target class
            if (targetClassId) {
              const isPrivilegedStaff = ['admin', 'teacher'].includes(client.user?.role);
              const isInClass = client.rooms && (client.rooms.has(targetClassId) || client.rooms.has(`class:${targetClassId}`));
              if (!isPrivilegedStaff && !isInClass) {
                continue;
              }
            }

            client.send(payload);
          }
        }
        return;
      }
    });

    const cleanup = () => {
      if (authTimeout) {
        clearTimeout(authTimeout);
        authTimeout = null;
      }
      activePresenceMap.delete(ws);
      broadcastPresenceList();
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  return {
    wss,
    activePresenceMap,
    broadcastPresenceList
  };
}

module.exports = {
  resolveAndVerifyClass,
  verifyClassAccess,
  setupWebSocketServer
};

