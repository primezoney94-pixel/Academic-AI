/**
 * Fayl nomini xavfsiz formatga o'tkazadi
 */
function sanitizeFilename(name, maxLen = 60) {
  return name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Windows/Unix taqiqlangan belgilar
    .replace(/\s+/g, '_')
    .substring(0, maxLen)
    || 'document';
}

/**
 * Tasodifiy qisqa ID yaratadi (UUID ning qisqasi)
 */
function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Fayl hajmini o'qilishi uchun formatlaydi
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

module.exports = { sanitizeFilename, shortId, formatBytes };
