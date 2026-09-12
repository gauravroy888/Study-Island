-- ============================================================================
-- EdTech Island: Migration 007
-- SuperAdmin Profiles Status & Transactional Integrity Invariants
-- ============================================================================

-- 1. Add status column to public.profiles if it does not already exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'Active';

-- 2. Add check constraint to ensure only valid statuses are permitted
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_check'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('Active', 'Suspended'));
  END IF;
END $$;

-- 3. Backfill status from is_archived if status is null
UPDATE public.profiles 
SET status = CASE WHEN is_archived = true THEN 'Suspended' ELSE 'Active' END 
WHERE status IS NULL;

-- 4. Ensure index on status and role for fast SuperAdmin count & active user queries
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, status);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_id ON public.profiles(auth_id);
