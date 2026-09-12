// SECURITY: Verify Supabase JWT and resolve authenticated profile.
// Never uses the anonymous key as the user's authorization header.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qmyrxvtbzlbnvzxypnus.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjA4OTcsImV4cCI6MjA5NTM5Njg5N30.ABvW_oBzXC2Ffxm5ToLh6t4WmdKPdtg9SyfeAE76iJo';

const VALID_ROLES = new Set(['student', 'teacher', 'admin', 'superadmin', 'super_admin']);

/**
 * Normalizes user roles into standard platform identifiers.
 * 'superadmin' / 'super_admin' -> 'super_admin'
 * 'admin'                      -> 'admin'
 * 'teacher'                    -> 'teacher'
 * 'student'                    -> 'student'
 * Returns null for unknown, empty, or invalid roles (fail-closed).
 */
function normalizeRole(role) {
  if (!role || typeof role !== 'string') return null;
  const lower = role.trim().toLowerCase();
  if (lower === 'superadmin' || lower === 'super_admin') return 'super_admin';
  if (lower === 'admin') return 'admin';
  if (lower === 'teacher') return 'teacher';
  if (lower === 'student') return 'student';
  return null;
}

/**
 * Extracts and validates a Bearer token string from an Authorization header or raw token.
 * Rejects empty strings, malformed headers, and the Supabase public anon key.
 */
function extractToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const trimmed = authHeader.trim();
  if (!trimmed) return null;

  let token = trimmed;
  if (trimmed.toLowerCase().startsWith('bearer ')) {
    token = trimmed.slice(7).trim();
  }

  if (!token || token.length < 16) return null;

  // CRITICAL: Reject Supabase anon key if passed as a user token
  if (token === SUPABASE_ANON_KEY) {
    return null;
  }

  return token;
}

/**
 * Validates a Supabase JWT against Supabase Auth and queries the profile table
 * using the authenticated user's JWT to respect Row Level Security.
 * 
 * Fails closed (returns null):
 * - If token is missing, malformed, or matches the public anon key.
 * - If Supabase Auth returns an invalid user.
 * - If profile lookup fails or profile does not exist in the database.
 * - If profile role is invalid or cannot be normalized.
 * - If requireTenant is true and institution_id cannot be resolved.
 *
 * @param {string} authHeader - 'Bearer <token>' or raw JWT string
 * @param {Object} [options]
 * @param {boolean} [options.requireTenant=false] - If true, requires non-null institution_id for tenant roles
 * @param {Function} [options.fetchFn=fetch] - Injected fetch for deterministic testing
 * @returns {Promise<Object|null>} Trusted user object or null
 */
async function verifySupabaseJWT(authHeader, options = {}) {
  const { requireTenant = false, fetchFn = fetch } = options;
  const token = extractToken(authHeader);
  if (!token || !SUPABASE_URL) return null;

  try {
    // 1. Verify token against Supabase Auth endpoint
    const authResp = await fetchFn(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY
      }
    });

    if (!authResp || !authResp.ok) {
      return null;
    }

    const authUser = await authResp.json();
    if (!authUser || !authUser.id) {
      return null;
    }

    // 2. Query profile using the AUTHENTICATED USER'S TOKEN (enforces RLS)
    // NEVER use the anonymous key as Bearer token for profile authorization!
    const profileResp = await fetchFn(
      `${SUPABASE_URL}/rest/v1/profiles?auth_id=eq.${encodeURIComponent(authUser.id)}&select=id,role,department,name`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!profileResp || !profileResp.ok) {
      return null;
    }

    const profiles = await profileResp.json();
    if (!Array.isArray(profiles) || profiles.length === 0) {
      // Profile does NOT exist — fail closed, NEVER default to 'student'
      return null;
    }

    const profile = profiles[0];
    const normalizedRole = normalizeRole(profile.role);
    if (!normalizedRole) {
      // Role is missing or invalid — fail closed
      return null;
    }

    const institutionId = profile.department ? profile.department.trim() : null;

    // Reject missing tenant if tenant context is strictly required
    // (super_admin is a platform-wide role and may not have a tenant)
    if (requireTenant && normalizedRole !== 'super_admin' && !institutionId) {
      return null;
    }

    // 3. Return trusted user object containing only validated fields
    return {
      id: authUser.id,
      profile_id: profile.id,
      email: authUser.email || '',
      name: profile.name || authUser.user_metadata?.full_name || null,
      role: normalizedRole,
      institution_id: institutionId,
      token
    };
  } catch (err) {
    return null;
  }
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  VALID_ROLES,
  normalizeRole,
  extractToken,
  verifySupabaseJWT
};
