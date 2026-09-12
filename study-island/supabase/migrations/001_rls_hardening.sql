-- ============================================================
-- EdTech Island RLS Hardening (Phase 2, Migration 001)
-- Modelled on Gaurav-Handover migration 011_secure_rls.sql
-- ============================================================

-- 1. Ensure RLS is enabled on both tables
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_submissions ENABLE ROW LEVEL SECURITY;

-- 2. Drop any old open/permissive policies that may exist
DROP POLICY IF EXISTS "Allow all" ON analytics_events;
DROP POLICY IF EXISTS "Allow authenticated" ON analytics_events;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON analytics_events;
DROP POLICY IF EXISTS "Allow all" ON test_submissions;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON test_submissions;
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON test_submissions;

-- 3. analytics_events strict policies
DROP POLICY IF EXISTS "edtech_ae_select_own" ON analytics_events;
DROP POLICY IF EXISTS "edtech_ae_insert_own" ON analytics_events;
DROP POLICY IF EXISTS "edtech_ae_teacher_select_all" ON analytics_events;

CREATE POLICY "edtech_ae_select_own"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "edtech_ae_insert_own"
  ON analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id OR student_id IS NULL);

-- Teacher bypass: teachers can read all analytics_events
CREATE POLICY "edtech_ae_teacher_select_all"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'teacher'
    )
  );

-- 4. test_submissions strict policies
DROP POLICY IF EXISTS "edtech_ts_select_own" ON test_submissions;
DROP POLICY IF EXISTS "edtech_ts_insert_own" ON test_submissions;
DROP POLICY IF EXISTS "edtech_ts_update_own" ON test_submissions;
DROP POLICY IF EXISTS "edtech_ts_teacher_select_all" ON test_submissions;

CREATE POLICY "edtech_ts_select_own"
  ON test_submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "edtech_ts_insert_own"
  ON test_submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id OR student_id IS NULL);

CREATE POLICY "edtech_ts_update_own"
  ON test_submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "edtech_ts_teacher_select_all"
  ON test_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'teacher'
    )
  );
