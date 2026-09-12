const crypto = require('crypto');

// Regex patterns for scrubbing sensitive values
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9-_=.]+/gi,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, // emails
  /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, // phone numbers
  /(?:password|secret|apikey|token)["']?\s*[:=]\s*["']?([^"',\s]+)/gi
];

function sanitizeLogMessage(msg) {
  if (typeof msg !== 'string') return msg;
  let sanitized = msg;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

function createRequestId() {
  return crypto.randomUUID();
}

function log(level, category, message, meta = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message: sanitizeLogMessage(message),
    ...meta
  };

  const output = JSON.stringify(record);
  if (level === 'ERROR') {
    console.error(output);
  } else if (level === 'WARN') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

module.exports = {
  createRequestId,
  sanitizeLogMessage,
  info: (cat, msg, meta) => log('INFO', cat, msg, meta),
  warn: (cat, msg, meta) => log('WARN', cat, msg, meta),
  error: (cat, msg, meta) => log('ERROR', cat, msg, meta),
  security: (cat, msg, meta) => log('SECURITY', cat, msg, meta)
};
