/**
 * Compresses an image File to JPEG using only the Canvas API.
 * Zero external dependencies — 100% native browser.
 *
 * @param {File|Blob} file - Original image file
 * @param {object}   opts
 * @param {number}   opts.maxMB    - Max output size in MB  (default 2)
 * @param {number}   opts.maxWidth - Max output width px    (default 1920)
 * @param {number}   opts.quality  - Initial JPEG quality   (default 0.82)
 * @returns {Promise<Blob>} Compressed JPEG blob, always ≤ maxMB
 */
export function compressToJpeg(file, { maxMB = 2, maxWidth = 1920, quality = 0.82 } = {}) {
  const maxBytes = maxMB * 1024 * 1024;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Scale down if wider than maxWidth
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Recursively drop quality until the blob fits
      const tryBlob = (q) => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Canvas toBlob returned null')); return; }
          if (blob.size <= maxBytes || q <= 0.1) {
            resolve(blob);
          } else {
            tryBlob(parseFloat((q - 0.08).toFixed(2)));
          }
        }, 'image/jpeg', q);
      };

      tryBlob(quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = objectUrl;
  });
}
