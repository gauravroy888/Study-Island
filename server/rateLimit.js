// In-memory rate limiting helpers
const uploadRateLimiter = new Map(); // key -> [timestamps]
const aiRateLimiter = new Map();     // key -> [timestamps]

function checkRateLimit(limiterMap, key, limit, windowMs) {
  const now = Date.now();
  let timestamps = limiterMap.get(key);
  if (!timestamps) {
    timestamps = [];
    limiterMap.set(key, timestamps);
  }
  timestamps = timestamps.filter(t => now - t < windowMs);
  if (timestamps.length >= limit) {
    limiterMap.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  limiterMap.set(key, timestamps);
  return true;
}

// Periodically clean up stale rate limit entries (every 5 minutes)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of uploadRateLimiter.entries()) {
    const valid = timestamps.filter(t => now - t < 60000);
    if (valid.length === 0) uploadRateLimiter.delete(key);
    else uploadRateLimiter.set(key, valid);
  }
  for (const [key, timestamps] of aiRateLimiter.entries()) {
    const valid = timestamps.filter(t => now - t < 60000);
    if (valid.length === 0) aiRateLimiter.delete(key);
    else aiRateLimiter.set(key, valid);
  }
}, 300000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

module.exports = {
  uploadRateLimiter,
  aiRateLimiter,
  checkRateLimit
};
