-- ============================================================================
-- EdTech Island: P1 Migration 004
-- Audit Logs Hardening & Tenant-Level RLS Policies
-- ============================================================================

-- Security Definer helper to get user's department without RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_department()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department FROM public.profiles WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- 1. SYSTEM AUDIT LOGS: Remove client-writable hole & add append-only / admin security
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert on system_audit_logs" ON public.system_audit_logs;
DROP POLICY IF EXISTS "system_audit_logs_insert_policy" ON public.system_audit_logs;
DROP POLICY IF EXISTS "system_audit_logs_update_policy" ON public.system_audit_logs;
DROP POLICY IF EXISTS "system_audit_logs_delete_policy" ON public.system_audit_logs;

-- Admins only for insert (actor_email must match their JWT or system)
CREATE POLICY "system_audit_logs_insert_policy" ON public.system_audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin() AND (actor_email = (auth.jwt() ->> 'email') OR actor_email = 'system@internal' OR actor_email IS NULL)
);

-- Admins only for updating incident status (e.g. RESOLVED)
CREATE POLICY "system_audit_logs_update_policy" ON public.system_audit_logs
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- No DELETE policy for anyone (immutable audit trail)

-- 2. Security Definer RPC for safe audit logging
CREATE OR REPLACE FUNCTION public.log_system_audit_event(
  p_severity TEXT,
  p_category TEXT,
  p_code INTEGER,
  p_title TEXT,
  p_details TEXT,
  p_source TEXT,
  p_school_id TEXT,
  p_status TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_email TEXT;
  v_row public.system_audit_logs;
BEGIN
  IF auth.role() != 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required to log audit event';
  END IF;

  v_actor_email := COALESCE(auth.jwt() ->> 'email', 'system@internal');

  INSERT INTO public.system_audit_logs (
    severity, category, code, title, details, source, actor_email, school_id, status, metadata, created_at
  )
  VALUES (
    COALESCE(p_severity, 'INFO'),
    COALESCE(p_category, 'SYSTEM'),
    COALESCE(p_code, 200),
    p_title,
    p_details,
    COALESCE(p_source, 'Platform Client'),
    v_actor_email,
    COALESCE(p_school_id, public.get_my_department()),
    COALESCE(p_status, 'ACTIVE'),
    COALESCE(p_metadata, '{}'::jsonb),
    now()
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

-- 3. TENANT ISOLATION: Add institution_id to classes & clean up wide-open class_students policy
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS institution_id TEXT;
CREATE INDEX IF NOT EXISTS idx_classes_institution_id ON public.classes(institution_id);

-- Drop wide-open public policy on class_students
DROP POLICY IF EXISTS "Enable all access for all users" ON public.class_students;

-- Harden classes SELECT with tenant / institution boundary
DROP POLICY IF EXISTS "classes_select_policy" ON public.classes;
CREATE POLICY "classes_select_policy" ON public.classes
FOR SELECT TO public
USING (
  public.is_admin() OR 
  (
    (auth.role() = 'authenticated') AND 
    ((is_archived = false) OR (is_archived IS NULL)) AND
    (
      institution_id IS NULL OR 
      institution_id = public.get_my_department()
    )
  )
);

