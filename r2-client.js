/**
 * Cloudflare R2 Storage Client Helper ($0 Egress CDN)
 * Bucket Name: edtechplatform
 * Public CDN Domain: https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev
 */

const R2_CONFIG = {
  bucketName: 'edtechplatform',
  publicCdnUrl: 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev',
  accountId: '21b75f7da0ec0dde4d08d3f19d2102f3',
  endpoint: 'https://21b75f7da0ec0dde4d08d3f19d2102f3.r2.cloudflarestorage.com'
};

/**
 * Construct full high-speed CDN URL for any R2 asset
 * @param {string} key - R2 file key path (e.g. 'courses/class-6th/models/optics.glb')
 * @returns {string} - Public CDN streaming URL
 */
export function getR2PublicUrl(key) {
  if (!key) return '';
  if (key.startsWith('http://') || key.startsWith('https://')) return key; // Already a full URL
  const cleanKey = key.startsWith('/') ? key.slice(1) : key;
  return `${R2_CONFIG.publicCdnUrl}/${cleanKey}`;
}

/**
 * Standardized folder path generator for R2 assets
 */
export function generateR2AssetKey(className, subject, assetType, filename) {
  const sanitizedClass = (className || 'general').toLowerCase().replace(/\s+/g, '-');
  const sanitizedSubject = (subject || 'science').toLowerCase().replace(/\s+/g, '-');
  const sanitizedFileName = (filename || 'file').toLowerCase().replace(/\s+/g, '_');
  
  return `courses/${sanitizedClass}/${sanitizedSubject}/${assetType}/${Date.now()}_${sanitizedFileName}`;
}

export default R2_CONFIG;
