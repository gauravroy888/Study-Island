-- ============================================================
-- EdTech Island: learning_summaries Table (Phase 2, Migration 002)
-- Per-student per-chapter best score tracking
-- Modelled on Gaurav-Handover migration 007_restore_learning_summaries.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS learning_summaries (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL,
    chapter_id            TEXT NOT NULL,
    activity_type         TEXT DEFAULT 'chapter_quiz',

    -- Attempt counter
    total_attempts        INTEGER NOT NULL DEFAULT 0,

    -- Accuracy tracking (0.0–1.0 canonical scale)
    latest_accuracy       NUMERIC CHECK (latest_accuracy IS NULL OR (latest_accuracy >= 0 AND latest_accuracy <= 1)),
    best_accuracy         NUMERIC CHECK (best_accuracy IS NULL OR (best_accuracy >= 0 AND best_accuracy <= 1)),
    average_accuracy      NUMERIC CHECK (average_accuracy IS NULL OR (average_accuracy >= 0 AND average_accuracy <= 1)),

    -- Mastery tracking (0.0–1.0 weighted MASTERY_V1 scale)
    latest_mastery        NUMERIC CHECK (latest_mastery IS NULL OR (latest_mastery >= 0 AND latest_mastery <= 1)),
    best_mastery          NUMERIC CHECK (best_mastery IS NULL OR (best_mastery >= 0 AND best_mastery <= 1)),
    average_mastery       NUMERIC CHECK (average_mastery IS NULL OR (average_mastery >= 0 AND average_mastery <= 1)),

    -- Fluency tracking (0.0–1.0 FLUENCY_V1 scale)
    latest_fluency        NUMERIC CHECK (latest_fluency IS NULL OR (latest_fluency >= 0 AND latest_fluency <= 1)),
    best_fluency          NUMERIC CHECK (best_fluency IS NULL OR (best_fluency >= 0 AND best_fluency <= 1)),

    -- Per-LO evidence scores (JSONB: { "SCI6-CH10-S01-LO01": 0.84, ... })
    best_lo_scores        JSONB DEFAULT '{}'::jsonb,
    latest_lo_scores      JSONB DEFAULT '{}'::jsonb,

    -- Timing
    latest_time_taken_ms  BIGINT,
    average_time_taken_ms BIGINT,

    -- Timestamps
    last_activity_date    TIMESTAMPTZ DEFAULT NOW(),
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),

    -- One row per student per chapter
    CONSTRAINT uq_ls_user_chapter UNIQUE (user_id, chapter_id),

    -- FK to Supabase auth users
    CONSTRAINT fk_ls_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ls_user_id ON learning_summaries (user_id);
CREATE INDEX IF NOT EXISTS idx_ls_chapter_id ON learning_summaries (chapter_id);
CREATE INDEX IF NOT EXISTS idx_ls_user_chapter ON learning_summaries (user_id, chapter_id);

-- RLS
ALTER TABLE learning_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ls_select_own" ON learning_summaries;
DROP POLICY IF EXISTS "ls_insert_own" ON learning_summaries;
DROP POLICY IF EXISTS "ls_update_own" ON learning_summaries;
DROP POLICY IF EXISTS "ls_teacher_select_all" ON learning_summaries;

CREATE POLICY "ls_select_own" ON learning_summaries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ls_insert_own" ON learning_summaries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ls_update_own" ON learning_summaries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ls_teacher_select_all" ON learning_summaries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'teacher'
    )
  );
