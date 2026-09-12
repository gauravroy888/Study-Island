const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SUPABASE_URL, SUPABASE_ANON_KEY, verifySupabaseJWT } = require('./auth');
const { uploadRateLimiter, checkRateLimit } = require('./rateLimit');

// SECURITY: R2 credentials come from environment variables ONLY.
if (process.env.NODE_ENV !== 'test' && (!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || !process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY)) {
  console.warn('⚠️  R2 credentials not found in environment — /api/upload-r2 will be unavailable.');
}

const R2_CONFIG = {
  bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'edtechplatform',
  publicCdnUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || ''
};

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_CONFIG.endpoint,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || ''
  }
});

/**
 * Verifies that a class exists and that the user has verified permission to upload curriculum for it.
 * Requirements:
 * 1. Reject tenant-scoped classes where institution_id is null or empty.
 * 2. Never fall back to the current user's tenant for a class whose tenant is unknown.
 * 3. Never fall back to 'inst-dps-001'.
 * 4. Resolve the class using actual live columns only ('id,institution_id').
 * 5. Students are strictly forbidden from uploading curriculum.
 * 6. Teachers must have a verified assignment in class_teachers.
 * 7. Admins must belong to the same institution as the class.
 * 8. SuperAdmins have platform-wide access, deriving tenant directly from the verified database class record.
 */
async function verifyClassOwnership(user, classId, fetchFn = fetch) {
  if (!user || !classId) return null;
  if (user.role === 'student') return null;

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
    if (!resp.ok) return null;
    const classes = await resp.json();
    if (!Array.isArray(classes) || classes.length === 0) return null;
    const cls = classes[0];

    // 2. Reject classes where institution_id is null or empty (fail closed)
    const tenantId = cls.institution_id;
    if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
      return null;
    }

    // 3. SuperAdmin: authorized for any valid database class, tenant derived directly from database record
    if (['super_admin', 'superadmin'].includes(user.role)) {
      return { valid: true, classId: cls.id, tenantId };
    }

    // 4. Non-superadmins must belong to the same institution as the class
    if (!user.institution_id || tenantId !== user.institution_id) {
      return null; // Cross-tenant upload blocked (fail closed)
    }

    // 5. Admin: authorized for all classes in their institution
    if (user.role === 'admin') {
      return { valid: true, classId: cls.id, tenantId };
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
      if (!ctResp.ok) return null;
      const assignments = await ctResp.json();
      if (!Array.isArray(assignments) || assignments.length === 0) {
        return null; // Unassigned teacher blocked
      }
      return { valid: true, classId: cls.id, tenantId };
    }

    return null;
  } catch (e) {
    return null;
  }
}

// Magic byte file signature validation for allowed educational media types
function detectFileType(buffer) {
  if (!buffer || buffer.length < 4) return null;

  // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  if (buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
    return { ext: 'png', mime: 'image/png' };
  }

  // JPEG: starts with FF D8 FF
  if (buffer.length >= 3 &&
      buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  // WEBP: starts with 52 49 46 46 ... 57 45 42 50 ('RIFF' at 0..3, 'WEBP' at 8..11)
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return { ext: 'webp', mime: 'image/webp' };
  }

  // PDF: starts with 25 50 44 46 ('%PDF')
  if (buffer.length >= 4 &&
      buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { ext: 'pdf', mime: 'application/pdf' };
  }

  // MP4: contains 'ftyp' at offset 4 (offset 4..7: 0x66, 0x74, 0x79, 0x70)
  if (buffer.length >= 8 &&
      buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return { ext: 'mp4', mime: 'video/mp4' };
  }

  // MP3: starts with 49 44 33 ('ID3') or FF FB
  if ((buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
      (buffer.length >= 2 && buffer[0] === 0xFF && (buffer[1] === 0xFB || (buffer[1] & 0xFE) === 0xFA))) {
    return { ext: 'mp3', mime: 'audio/mpeg' };
  }

  return null;
}

async function handleR2Upload(req, res, url, options = {}) {
  const fetchFn = options.fetchFn || fetch;
  const clientS3 = options.s3Client || s3Client;

  // Enforce request size limit BEFORE buffering
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const isAvatarOrImageReq = url.searchParams.get('category') === 'avatars' ||
    url.searchParams.get('isAvatar') === 'true' ||
    req.headers['x-category'] === 'avatars' ||
    (req.headers['content-type'] && (req.headers['content-type'].includes('image/') || req.headers['content-type'].includes('avatar')));
  const preBufferMax = isAvatarOrImageReq ? 10 * 1024 * 1024 : 50 * 1024 * 1024;

  if (contentLength > preBufferMax) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: false,
      error: `Payload too large: Content-Length (${contentLength} bytes) exceeds limit of ${preBufferMax} bytes.`
    }));
    return;
  }

  // SECURITY: Require valid authenticated Supabase session JWT
  const user = await verifySupabaseJWT(req.headers['authorization'], { fetchFn });
  if (!user || !user.id) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized: valid Supabase session required to upload' }));
    return;
  }

  // Rate Limiting: max 30 uploads per minute per user/IP
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const rateLimitKey = user.id || clientIp;
  if (!checkRateLimit(uploadRateLimiter, rateLimitKey, 30, 60 * 1000)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Rate limit exceeded: maximum 30 uploads per minute' }));
    return;
  }

  // SECURITY: Verify R2 credentials are configured (allow test mock bypass)
  const isS3Configured = Boolean(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID && process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) || Boolean(options.s3Client);
  if (!isS3Configured) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Storage service not configured on this server' }));
    return;
  }

  try {
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of req) {
      totalBytes += chunk.length;
      if (totalBytes > 50 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'File too large. Maximum upload size is 50MB.' }));
        return;
      }
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks).toString();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (jsonErr) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
      return;
    }

    const { chapterSlug, modalitySlug, filename, base64Content, category, isAvatar } = body;

    if (!filename || !base64Content) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'filename and base64Content are required' }));
      return;
    }

    const fileBuffer = Buffer.from(base64Content, 'base64');
    const isAvatarUpload = category === 'avatars' || Boolean(isAvatar);
    const maxAllowedSize = isAvatarUpload ? 10 * 1024 * 1024 : 50 * 1024 * 1024;

    if (fileBuffer.length > maxAllowedSize) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: false,
        error: `File too large. Maximum upload size is ${isAvatarUpload ? '10MB' : '50MB'}.`
      }));
      return;
    }

    // Magic byte file signature validation on the uploaded buffer
    const detectedType = detectFileType(fileBuffer);
    if (!detectedType) {
      res.writeHead(415, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: false,
        error: 'Unsupported Media Type: File signature does not match allowed types (PNG, JPEG, WEBP, PDF, MP4, MP3).'
      }));
      return;
    }

    // Sanitize and randomize object names: crypto.randomUUID() + validated extension. Prevent path traversal.
    const safeUUID = crypto.randomUUID();
    const safeFilename = `${safeUUID}.${detectedType.ext}`;

    let key;
    if (isAvatarUpload) {
      const cleanUserId = String(user.id).replace(/[^a-z0-9_-]/gi, '_');
      key = `avatars/${cleanUserId}_${safeFilename}`;
    } else {
      // Course curriculum upload: strictly forbidden for students
      if (user.role === 'student') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Forbidden: Students are not permitted to upload course materials' }));
        return;
      }

      // Require stable DB ID for class
      const targetClassId = body.class_id || body.classId;
      if (!targetClassId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'classId is required for course curriculum uploads' }));
        return;
      }

      // Verify class exists and belongs to the user's institution
      const verified = await verifyClassOwnership(user, targetClassId, fetchFn);
      if (!verified) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Forbidden: You do not have permission to upload curriculum for this class' }));
        return;
      }

      const cleanChap = (chapterSlug || 'general').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/\.\./g, '');
      const cleanMod = (modalitySlug || 'content').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/\.\./g, '');
      const tenantPrefix = String(verified.tenantId).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
      const classPrefix = String(verified.classId).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');

      key = `courses/${tenantPrefix}/${classPrefix}/${cleanChap}/${cleanMod}/${safeFilename}`;
    }

    // Prevent path traversal attacks
    if (key.includes('..') || key.startsWith('/') || key.startsWith('\\')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Invalid object key path traversal detected' }));
      return;
    }

    const mime = detectedType.mime;

    await clientS3.send(new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mime
    }));

    const cdnUrl = `${R2_CONFIG.publicCdnUrl}/${key}`;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`☁️ [R2 Upload] user=${user.email} | ${key} (${fileBuffer.length} bytes) -> ${cdnUrl}`);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      key,
      cdnUrl,
      sizeBytes: fileBuffer.length,
      contentType: mime
    }));
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('❌ R2 Upload Error:', err);
    }
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Upload failed. Please try again.' }));
  }
}

module.exports = {
  detectFileType,
  handleR2Upload,
  verifyClassOwnership,
  s3Client,
  R2_CONFIG
};
