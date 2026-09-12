const { SUPABASE_URL, SUPABASE_ANON_KEY, verifySupabaseJWT } = require('./auth');

async function parseBody(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > 64 * 1024) throw new Error('Payload too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

/**
 * Resolves a target user profile using immutable profile/auth ID or email.
 * Returns { profile: Object } on success, or { error: string, status: number } on failure.
 */
async function resolveTargetProfile({ id, userId, profileId, email }, token, fetchFn = fetch) {
  const targetId = id || userId || profileId;
  let queryUrl;

  if (targetId) {
    queryUrl = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}&select=id,auth_id,email,name,role,department,status,is_archived`;
  } else if (email) {
    queryUrl = `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,auth_id,email,name,role,department,status,is_archived`;
  } else {
    return { error: 'Target user profile ID or email is required', status: 400 };
  }

  const resp = await fetchFn(queryUrl, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'Failed to resolve profile');
    return { error: `Downstream profile lookup failed: ${errText}`, status: resp.status };
  }

  const profiles = await resp.json();
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return { error: 'Target user profile not found', status: 404 };
  }
  if (profiles.length > 1) {
    return { error: 'Ambiguous target: multiple profiles matched identifier', status: 409 };
  }

  return { profile: profiles[0] };
}

/**
 * Counts currently active SuperAdmins in the platform database.
 * Used to prevent accidental demotion or suspension of the final active SuperAdmin.
 */
async function countActiveSuperAdmins(token, fetchFn = fetch) {
  const resp = await fetchFn(
    `${SUPABASE_URL}/rest/v1/profiles?role=in.(super_admin,superadmin)&select=id,role,status,is_archived`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'Query failed');
    return { error: `Failed to count SuperAdmins: ${errText}`, status: resp.status };
  }

  const list = await resp.json();
  if (!Array.isArray(list)) return { count: 0, superAdmins: [] };
  const active = list.filter(p => p.status !== 'Suspended' && p.is_archived !== true);
  return { count: active.length, superAdmins: active };
}

/**
 * Determines whether a target profile matches the calling authenticated SuperAdmin.
 */
function isSelfTarget(targetProfile, callerUser) {
  if (!targetProfile || !callerUser) return false;
  if (callerUser.profile_id && targetProfile.id === callerUser.profile_id) return true;
  if (callerUser.id && (targetProfile.auth_id === callerUser.id || targetProfile.id === callerUser.id)) return true;
  if (callerUser.email && targetProfile.email && callerUser.email.toLowerCase().trim() === targetProfile.email.toLowerCase().trim()) return true;
  return false;
}

/**
 * Records an audit event ONLY after an underlying mutation has verified success.
 */
async function recordSuperAdminAudit(token, auditPayload, fetchFn = fetch) {
  try {
    const rpcResp = await fetchFn(`${SUPABASE_URL}/rest/v1/rpc/log_system_audit_event`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_severity: auditPayload.severity || 'INFO',
        p_category: auditPayload.category || 'ADMIN',
        p_code: auditPayload.code || 200,
        p_title: auditPayload.title,
        p_details: auditPayload.details || '',
        p_source: auditPayload.source || 'SuperAdmin API',
        p_school_id: auditPayload.school_id || 'platform',
        p_status: 'RESOLVED',
        p_metadata: auditPayload.metadata || {}
      })
    });

    if (rpcResp.ok) return true;

    // Fallback direct insert if RPC is unavailable (e.g. 404)
    await fetchFn(`${SUPABASE_URL}/rest/v1/system_audit_logs`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        severity: auditPayload.severity === 'WARNING' ? 'WARN' : (auditPayload.severity || 'INFO'),
        category: auditPayload.category || 'ADMIN',
        code: auditPayload.code || 200,
        title: auditPayload.title,
        details: auditPayload.details || '',
        source: auditPayload.source || 'SuperAdmin API',
        actor_email: auditPayload.actor_email,
        school_id: auditPayload.school_id || 'platform',
        status: 'RESOLVED',
        metadata: auditPayload.metadata || {}
      })
    });
    return true;
  } catch (e) {
    console.warn('[SuperAdmin] Non-critical audit logging exception:', e.message);
    return false;
  }
}

async function handleSuperAdminRequest(req, res, pathname, options = {}) {
  const fetchFn = options.fetchFn || fetch;

  // 1. Authenticate user strictly using verified Supabase session
  const user = await verifySupabaseJWT(req.headers['authorization'], options);
  if (!user || !user.id) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized: valid Supabase session required' }));
    return;
  }

  // 2. Authorize role: SuperAdmin privileges required
  if (user.role !== 'super_admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Forbidden: SuperAdmin privileges required' }));
    return;
  }

  const token = user.token;

  // GET /api/superadmin/users - Load users via authenticated user token
  if (pathname === '/api/superadmin/users' && req.method === 'GET') {
    try {
      const resp = await fetchFn(
        `${SUPABASE_URL}/rest/v1/profiles?select=id,auth_id,email,name,role,department,avatar_url,status,created_at`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (!resp.ok) {
        const errText = await resp.text().catch(() => 'Downstream error');
        res.writeHead(resp.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: `Failed to fetch profiles: ${errText}` }));
        return;
      }
      const data = await resp.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, users: data }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // POST /api/superadmin/users/role - Update user role
  if (pathname === '/api/superadmin/users/role' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { role, department } = body;
      const validRoles = ['student', 'teacher', 'admin', 'super_admin'];

      if (!role || !validRoles.includes(role.toLowerCase())) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid role specified: must be student, teacher, admin, or super_admin' }));
        return;
      }

      // Validate tenant boundary if department is specified
      if (department !== undefined && (typeof department !== 'string' || !department.trim() || department === 'null' || department === 'undefined')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid department/tenant identifier specified' }));
        return;
      }

      // Resolve target profile using immutable ID or email
      const targetRes = await resolveTargetProfile(body, token, fetchFn);
      if (targetRes.error) {
        res.writeHead(targetRes.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: targetRes.error }));
        return;
      }
      const target = targetRes.profile;
      const targetNewRole = role.toLowerCase();

      // Guard: Prevent unsafe self-demotion
      if (isSelfTarget(target, user) && targetNewRole !== 'super_admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Self-demotion is forbidden: SuperAdmins cannot remove their own SuperAdmin role' }));
        return;
      }

      // Guard: Prevent accidental demotion of final SuperAdmin
      if (['super_admin', 'superadmin'].includes(target.role) && targetNewRole !== 'super_admin') {
        const countRes = await countActiveSuperAdmins(token, fetchFn);
        if (countRes.error) {
          res.writeHead(countRes.status || 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: countRes.error }));
          return;
        }
        if (countRes.count <= 1) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Cannot demote the final SuperAdmin: at least one active SuperAdmin must remain' }));
          return;
        }
      }

      // Mutate profile by immutable ID
      const patchPayload = { role: targetNewRole };
      if (department !== undefined) patchPayload.department = department.trim();

      const updateResp = await fetchFn(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(target.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify(patchPayload)
        }
      );

      if (!updateResp.ok) {
        const errText = await updateResp.text().catch(() => 'Update failed');
        res.writeHead(updateResp.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: `Role update failed: ${errText}` }));
        return;
      }

      const updated = await updateResp.json();
      if (!Array.isArray(updated) || updated.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Role update failed: zero records were modified' }));
        return;
      }
      if (updated.length > 1) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Role update failed: multiple records were modified (transactional integrity violation)' }));
        return;
      }

      // Audit log: write strictly after mutation has verified success
      await recordSuperAdminAudit(token, {
        severity: targetNewRole === 'super_admin' ? 'SECURITY' : 'INFO',
        category: 'SECURITY',
        code: 200,
        title: `Role Modified: ${target.email} → ${targetNewRole}`,
        details: `SuperAdmin ${user.email} changed role of ${target.name || target.email} (ID: ${target.id}) to ${targetNewRole}.`,
        actor_email: user.email,
        school_id: target.department || 'platform',
        metadata: { target_id: target.id, old_role: target.role, new_role: targetNewRole }
      }, fetchFn);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Role updated successfully', user: updated[0] }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // POST /api/superadmin/users/status - Update account status (Active / Suspended)
  if (pathname === '/api/superadmin/users/status' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { status } = body;

      if (!status || !['Active', 'Suspended'].includes(status)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid status specified: must be Active or Suspended' }));
        return;
      }

      // Resolve target profile using immutable ID or email
      const targetRes = await resolveTargetProfile(body, token, fetchFn);
      if (targetRes.error) {
        res.writeHead(targetRes.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: targetRes.error }));
        return;
      }
      const target = targetRes.profile;

      // Guard: Prevent self-suspension
      if (isSelfTarget(target, user) && status === 'Suspended') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Self-suspension is forbidden: SuperAdmins cannot suspend their own account' }));
        return;
      }

      // Guard: Prevent suspension of final SuperAdmin
      if (['super_admin', 'superadmin'].includes(target.role) && status === 'Suspended') {
        const countRes = await countActiveSuperAdmins(token, fetchFn);
        if (countRes.error) {
          res.writeHead(countRes.status || 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: countRes.error }));
          return;
        }
        if (countRes.count <= 1) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Cannot suspend the final SuperAdmin: at least one active SuperAdmin must remain' }));
          return;
        }
      }

      // Mutate profile by immutable ID, synchronizing both status and is_archived
      const updateResp = await fetchFn(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(target.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify({
            status,
            is_archived: status === 'Suspended'
          })
        }
      );

      if (!updateResp.ok) {
        const errText = await updateResp.text().catch(() => 'Update failed');
        res.writeHead(updateResp.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: `Status update failed: ${errText}` }));
        return;
      }

      const updated = await updateResp.json();
      if (!Array.isArray(updated) || updated.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Status update failed: zero records were modified' }));
        return;
      }
      if (updated.length > 1) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Status update failed: multiple records were modified (transactional integrity violation)' }));
        return;
      }

      // Audit log: write strictly after mutation has verified success
      await recordSuperAdminAudit(token, {
        severity: status === 'Suspended' ? 'WARN' : 'INFO',
        category: 'SECURITY',
        code: status === 'Suspended' ? 403 : 200,
        title: `Account Status Changed: ${target.email} → ${status}`,
        details: `SuperAdmin ${user.email} changed status of ${target.name || target.email} (ID: ${target.id}) to ${status}.`,
        actor_email: user.email,
        school_id: target.department || 'platform',
        metadata: { target_id: target.id, old_status: target.status, new_status: status }
      }, fetchFn);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Status updated successfully', user: updated[0] }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // POST /api/superadmin/users/avatar - Secure profile photo update
  if ((pathname === '/api/superadmin/users/avatar' || pathname === '/api/superadmin/profile/avatar') && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const targetAvatarUrl = body.avatar_url || body.avatarUrl;

      if (!targetAvatarUrl || typeof targetAvatarUrl !== 'string' || !targetAvatarUrl.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'avatar_url is required' }));
        return;
      }

      if (targetAvatarUrl.length > 8192) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'avatar_url exceeds maximum permitted length' }));
        return;
      }

      // Determine target profile: if ID provided, update target; else update caller's profile
      const targetIdentifier = {
        id: body.id || body.userId || body.profileId,
        email: body.email
      };

      let target;
      if (targetIdentifier.id || targetIdentifier.email) {
        const targetRes = await resolveTargetProfile(targetIdentifier, token, fetchFn);
        if (targetRes.error) {
          res.writeHead(targetRes.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: targetRes.error }));
          return;
        }
        target = targetRes.profile;
      } else {
        // Default to calling SuperAdmin's own profile
        const selfRes = await resolveTargetProfile({ id: user.profile_id, email: user.email }, token, fetchFn);
        if (selfRes.error) {
          res.writeHead(selfRes.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: selfRes.error }));
          return;
        }
        target = selfRes.profile;
      }

      const updateResp = await fetchFn(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(target.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify({ avatar_url: targetAvatarUrl.trim() })
        }
      );

      if (!updateResp.ok) {
        const errText = await updateResp.text().catch(() => 'Update failed');
        res.writeHead(updateResp.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: `Avatar update failed: ${errText}` }));
        return;
      }

      const updated = await updateResp.json();
      if (!Array.isArray(updated) || updated.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Avatar update failed: zero records were modified' }));
        return;
      }
      if (updated.length > 1) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Avatar update failed: multiple records were modified' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Avatar updated successfully', avatar_url: targetAvatarUrl.trim(), user: updated[0] }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // POST /api/superadmin/broadcast - Platform global broadcast
  if (pathname === '/api/superadmin/broadcast' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { message } = body;
      const trimmed = (message || '').trim();
      if (!trimmed) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Broadcast message is required' }));
        return;
      }

      const payload = {
        title: 'Platform Announcement',
        text: trimmed,
        author: user.name || 'SuperAdmin',
        createdAt: new Date().toISOString()
      };

      const postResp = await fetchFn(`${SUPABASE_URL}/rest/v1/announcements`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      if (!postResp.ok) {
        const errText = await postResp.text().catch(() => 'Insert failed');
        res.writeHead(postResp.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: `Broadcast announcement failed: ${errText}` }));
        return;
      }

      const postData = await postResp.json().catch(() => []);
      if (!Array.isArray(postData) || postData.length === 0) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Broadcast failed: zero announcement records were created' }));
        return;
      }

      // Record audit event after confirmed successful announcement insert
      await recordSuperAdminAudit(token, {
        severity: 'INFO',
        category: 'COMMUNICATION',
        code: 200,
        title: 'Platform Broadcast Published',
        details: `"${trimmed.slice(0, 80)}${trimmed.length > 80 ? '...' : ''}"`,
        actor_email: user.email,
        school_id: 'platform'
      }, fetchFn);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Broadcast published successfully', announcement: postData[0] }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // POST /api/superadmin/incidents/resolve - Resolve security / system audit incident
  if (pathname === '/api/superadmin/incidents/resolve' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { id, status = 'RESOLVED' } = body;
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Incident ID is required' }));
        return;
      }

      const cleanStatus = status.trim().toUpperCase();

      // 1. Try secure RPC resolve_system_audit_incident
      const rpcResp = await fetchFn(`${SUPABASE_URL}/rest/v1/rpc/resolve_system_audit_incident`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_incident_id: id, p_new_status: cleanStatus })
      });

      if (rpcResp.ok) {
        const rpcData = await rpcResp.json().catch(() => null);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: 'Incident resolved', data: rpcData }));
        return;
      }

      // 2. Fallback to status-only PATCH if RPC is not deployed (404)
      if (rpcResp.status === 404) {
        const patchResp = await fetchFn(
          `${SUPABASE_URL}/rest/v1/system_audit_logs?id=eq.${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation'
            },
            body: JSON.stringify({ status: cleanStatus })
          }
        );

        if (!patchResp.ok) {
          const errText = await patchResp.text().catch(() => 'Update failed');
          res.writeHead(patchResp.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: `Failed to update incident: ${errText}` }));
          return;
        }

        const updated = await patchResp.json().catch(() => []);
        if (!Array.isArray(updated) || updated.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Incident resolution failed: zero records were modified' }));
          return;
        }
        if (updated.length > 1) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Incident resolution failed: multiple records affected' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: 'Incident resolved', data: updated[0] }));
        return;
      }

      const errText = await rpcResp.text().catch(() => 'Failed to resolve incident');
      res.writeHead(rpcResp.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: errText || 'Failed to resolve incident' }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'SuperAdmin endpoint not found' }));
}

module.exports = {
  handleSuperAdminRequest,
  resolveTargetProfile,
  countActiveSuperAdmins,
  isSelfTarget,
  recordSuperAdminAudit
};
