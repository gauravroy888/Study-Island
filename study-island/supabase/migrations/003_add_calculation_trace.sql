-- ============================================================
-- EdTech Island: analytics_events Column Extensions (Phase 2, Migration 003)
-- Adds calculation_trace, lo_evidence_scores, internal_scores columns
-- ============================================================

-- Add calculation audit trail column
ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS calculation_trace JSONB DEFAULT NULL;

-- Add per-LO weighted evidence scores (0.0–1.0 per LO)
ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS lo_evidence_scores JSONB DEFAULT NULL;

-- Add canonical 0.0–1.0 internal scores for analytics pipeline
ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS internal_scores JSONB DEFAULT NULL;

-- Index for lo_evidence_scores GIN queries (allows fast JSONB key lookups)
CREATE INDEX IF NOT EXISTS idx_ae_lo_evidence_scores
  ON analytics_events USING GIN (lo_evidence_scores);
