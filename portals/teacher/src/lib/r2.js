import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── Cloudflare R2 Configuration ──────────────────────────────────────────────
const R2_ACCOUNT_ID     = '21b75f7da0ec0dde4d08d3f19d2102f3';
const R2_ACCESS_KEY_ID  = '5fd10d137b4e437c604356c7d14b138c';
const R2_SECRET_KEY     = '229ede3cbc0f2264b9f72545eecf99c12a5e9e06699ba9da08d7544458755693';
const R2_BUCKET         = 'edtechplatform';
export const R2_PUBLIC_URL = 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev';
// ──────────────────────────────────────────────────────────────────────────────

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_KEY,
  },
});

/**
 * Uploads a JPEG Blob directly to Cloudflare R2 and returns its public CDN URL.
 * Uses a presigned PUT URL so no server/Edge Function is needed.
 *
 * @param {Blob}   blob         - Compressed JPEG blob (from compressToJpeg)
 * @param {string} originalName - Original filename (used only for reference)
 * @returns {Promise<string>} Public CDN URL of the uploaded image
 */
export async function uploadImageToR2(blob, originalName = 'photo.jpg') {
  const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const key = `chat/${uid}.jpg`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: 'image/jpeg',
  });

  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

  const res = await fetch(presignedUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'image/jpeg' },
  });

  if (!res.ok) {
    throw new Error(`R2 upload failed (${res.status}): ${await res.text()}`);
  }

  return `${R2_PUBLIC_URL}/${key}`;
}
