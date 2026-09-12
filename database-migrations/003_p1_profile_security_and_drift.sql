-- ============================================================================
-- EdTech Island: P1 Migration 003
-- Profile Schema Security & Obsolete Credential Column Cleanup
-- ============================================================================

-- 1. Ensure any remaining password/login_id values in profiles are wiped safely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'password'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET password = NULL WHERE password IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'login_id'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET login_id = NULL WHERE login_id IS NOT NULL';
  END IF;
END $$;

-- 2. Drop obsolete plaintext credential columns from public.profiles
-- Supabase Auth in auth.users manages user credentials securely.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS password;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS login_id;

-- 3. Confirm index on email and role for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department);
