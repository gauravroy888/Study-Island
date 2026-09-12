import { supabase } from '../supabase';

export const R2_PUBLIC_URL = import.meta.env.VITE_CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string') {
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        resolve(base64);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Uploads an image Blob securely via backend /api/upload-r2 endpoint and returns its public CDN URL.
 * Cloudflare R2 secrets are never present in frontend client bundles.
 *
 * @param {Blob}   blob         - Compressed image blob (from compressToJpeg)
 * @param {string} originalName - Original filename (used only for reference)
 * @returns {Promise<string>} Public CDN URL of the uploaded image
 */
export async function uploadImageToR2(blob, originalName = 'photo.jpg') {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  if (!token) {
    throw new Error('Authentication required to upload media.');
  }

  const base64Content = await blobToBase64(blob);

  const res = await fetch('/api/upload-r2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      filename: originalName || 'photo.jpg',
      base64Content,
      contentType: blob.type || 'image/jpeg',
      className: 'general',
      subjectName: 'chat',
      chapterSlug: 'media',
      modalitySlug: 'multi'
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`R2 upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data.ok || !data.cdnUrl) {
    throw new Error(data.error || 'R2 upload failed');
  }

  return data.cdnUrl;
}
