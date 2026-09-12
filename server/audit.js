const { SUPABASE_URL, SUPABASE_ANON_KEY, verifySupabaseJWT } = require('./auth');

const ALLOWED_SEVERITIES = new Set(['INFO', 'WARN', 'ERROR', 'CRITICAL']);
const SEVERITY_ALIASES = { 'WARNING': 'WARN' };

const ALLOWED_CATEGORIES = new Set([
  'SYSTEM', 'AUTH', 'SECURITY', 'STORAGE', 'CLASS', 'ACADEMIC', 'MAINTENANCE', 'ADMIN'
]);

const ALLOWED_STATUSES = new Set([
  'ACTIVE', 'RESOLVED', 'ACKNOWLEDGED', 'INVESTIGATING', 'DISMISSED'
]);

async function handleAuditLog(req, res, options = {}) {
  const fetchFn = options.fetchFn || fetch;

  // 1. Authenticate via verifySupabaseJWT
  const user = await verifySupabaseJWT(req.headers['authorization'], { fetchFn });
  if (!user || !user.id) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized: valid Supabase session required' }));
    return;
  }

  // 2. Enforce role authorization: Admins and SuperAdmins only
  const allowedRoles = ['admin', 'super_admin'];
  if (!allowedRoles.includes(user.role)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Forbidden: Insufficient permissions to manage audit logs' }));
    return;
  }

  try {
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of req) {
      totalBytes += chunk.length;
      if (totalBytes > 64 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Payload too large: maximum audit log size is 64KB' }));
        return;
      }
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks).toString();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
      return;
    }

    const { severity, category, code, title, details, source, school_id, status, metadata } = body;

    // Title validation
    if (!title || typeof title !== 'string' || !title.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Valid title is required' }));
      return;
    }

    // Severity validation
    const rawSev = (severity || 'INFO').toString().trim().toUpperCase();
    const cleanSev = SEVERITY_ALIASES[rawSev] || rawSev;
    if (!ALLOWED_SEVERITIES.has(cleanSev)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: false,
        error: `Invalid severity: must be one of ${Array.from(ALLOWED_SEVERITIES).join(', ')}`
      }));
      return;
    }

    // Category validation
    const cleanCat = (category || 'SYSTEM').toString().trim().toUpperCase();
    if (!ALLOWED_CATEGORIES.has(cleanCat)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: false,
        error: `Invalid category: must be one of ${Array.from(ALLOWED_CATEGORIES).join(', ')}`
      }));
      return;
    }

    // Status validation
    const cleanStatus = (status || 'ACTIVE').toString().trim().toUpperCase();
    if (!ALLOWED_STATUSES.has(cleanStatus)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: false,
        error: `Invalid status: must be one of ${Array.from(ALLOWED_STATUSES).join(', ')}`
      }));
      return;
    }

    // Code validation
    const cleanCode = parseInt(code ?? 200, 10);
    if (isNaN(cleanCode) || cleanCode < 100 || cleanCode > 599) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Code must be a valid HTTP/system status code between 100 and 599' }));
      return;
    }

    // Server-derived tenant identification (prevent cross-tenant log spoofing)
    let targetSchoolId;
    if (user.role === 'super_admin') {
      targetSchoolId = school_id || user.institution_id || 'platform';
    } else {
      if (!user.institution_id) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Forbidden: Missing institution context' }));
        return;
      }
      if (school_id && school_id !== user.institution_id) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Forbidden: Cannot create audit events for another school/tenant' }));
        return;
      }
      targetSchoolId = user.institution_id;
    }

    const token = user.token || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
    const rpcResp = await fetchFn(`${SUPABASE_URL}/rest/v1/rpc/log_system_audit_event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        p_severity: cleanSev,
        p_category: cleanCat,
        p_code: cleanCode,
        p_title: String(title).slice(0, 255),
        p_details: details ? String(details).slice(0, 2048) : '',
        p_source: source ? String(source).slice(0, 100) : 'Server API',
        p_school_id: targetSchoolId,
        p_status: cleanStatus,
        p_metadata: (metadata && typeof metadata === 'object') ? metadata : {}
      })
    });

    if (!rpcResp.ok) {
      const errText = await rpcResp.text();
      console.warn('⚠️ [Audit Log] RPC call failed:', rpcResp.status, errText);
      res.writeHead(rpcResp.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Failed to record audit event in database' }));
      return;
    }

    const logRecord = await rpcResp.json();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, data: logRecord }));
  } catch (err) {
    console.error('❌ Audit Log Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Internal server error recording audit log' }));
  }
}

module.exports = {
  handleAuditLog,
  ALLOWED_SEVERITIES,
  ALLOWED_CATEGORIES,
  ALLOWED_STATUSES
};
