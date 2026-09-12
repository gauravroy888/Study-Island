// Operational telemetry & metrics accumulator for EdTech Island server
const metrics = {
  auth_failures_total: 0,
  rls_failures_total: 0,
  upload_failures_total: 0,
  ai_requests_total: 0,
  ai_errors_total: 0,
  ws_connections_total: 0,
  ws_disconnections_total: 0,
  rate_limit_events_total: 0,
  analytics_ingestion_failures_total: 0,
  analytics_events_received_total: 0,
  analytics_events_rejected_total: 0,
  analytics_events_duplicate_total: 0
};

function increment(metricName, count = 1) {
  if (Object.prototype.hasOwnProperty.call(metrics, metricName)) {
    metrics[metricName] += count;
  }
}

function getMetrics() {
  const mem = process.memoryUsage();
  return {
    ...metrics,
    system: {
      uptime_seconds: Math.floor(process.uptime()),
      memory_rss_mb: Math.round(mem.rss / 1024 / 1024),
      memory_heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      memory_heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024)
    },
    timestamp: new Date().toISOString()
  };
}

function resetMetrics() {
  for (const key of Object.keys(metrics)) {
    metrics[key] = 0;
  }
}

module.exports = {
  metrics,
  increment,
  getMetrics,
  resetMetrics
};
