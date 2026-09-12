-- ============================================================================
-- EdTech Island: P1 Migration 005
-- Secure Audit SECURITY DEFINER Hardening, Incident Resolution & RLS Integrity
-- ============================================================================

-- 1. SECURITY DEFINER RPC: public.log_system_audit_event
-- Fail-closed authorization: verified 'admin', 'superadmin', or 'super_admin' only.
-- Enforces tenant isolation and prevents spoofing of actor_email or school_id.
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
  v_caller_role TEXT;
  v_caller_dept TEXT;
  v_actor_email TEXT;
  v_school_id TEXT;
  v_clean_severity TEXT;
  v_clean_category TEXT;
  v_clean_status TEXT;
  v_clean_code INTEGER;
  v_clean_title TEXT;
  v_row public.system_audit_logs;
BEGIN
  -- Fail closed: Require authenticated caller
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to log audit event';
  END IF;

  -- Fetch caller role and department from public.profiles
  SELECT role, department INTO v_caller_role, v_caller_dept
  FROM public.profiles
  WHERE auth_id = auth.uid()
  LIMIT 1;

  -- Verify administrative privileges
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'superadmin', 'super_admin') THEN
    RAISE EXCEPTION 'Forbidden: Insufficient permissions to record system audit logs';
  END IF;

  -- Derive actor email strictly from authenticated JWT
  v_actor_email := COALESCE(auth.jwt() ->> 'email', 'system@internal');

  -- Enforce tenant isolation
  IF v_caller_role IN ('super_admin', 'superadmin') THEN
    v_school_id := COALESCE(p_school_id, v_caller_dept, 'platform');
  ELSE
    IF v_caller_dept IS NULL THEN
      RAISE EXCEPTION 'Forbidden: Administrator has no assigned institution/department';
    END IF;
    IF p_school_id IS NOT NULL AND p_school_id != v_caller_dept THEN
      RAISE EXCEPTION 'Forbidden: Cannot create audit events for another school/tenant';
    END IF;
    v_school_id := v_caller_dept;
  END IF;

  -- Severity validation & normalization
  v_clean_severity := UPPER(TRIM(COALESCE(p_severity, 'INFO')));
  IF v_clean_severity = 'WARNING' THEN
    v_clean_severity := 'WARN';
  END IF;
  IF v_clean_severity NOT IN ('INFO', 'WARN', 'ERROR', 'CRITICAL') THEN
    RAISE EXCEPTION 'Invalid severity: %', p_severity;
  END IF;

  -- Category validation
  v_clean_category := UPPER(TRIM(COALESCE(p_category, 'SYSTEM')));
  IF v_clean_category NOT IN ('SYSTEM', 'AUTH', 'SECURITY', 'STORAGE', 'CLASS', 'ACADEMIC', 'MAINTENANCE', 'ADMIN', 'STRUCTURE', 'COPIED_DATA', 'UNAUTHORIZED_ACCESS', 'PERFORMANCE') THEN
    RAISE EXCEPTION 'Invalid category: %', p_category;
  END IF;

  -- Status validation
  v_clean_status := UPPER(TRIM(COALESCE(p_status, 'ACTIVE')));
  IF v_clean_status NOT IN ('ACTIVE', 'RESOLVED', 'ACKNOWLEDGED', 'INVESTIGATING', 'DISMISSED') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  -- Title validation & truncation
  v_clean_title := TRIM(COALESCE(p_title, ''));
  IF length(v_clean_title) = 0 THEN
    RAISE EXCEPTION 'Valid title is required';
  END IF;

  -- Code validation
  v_clean_code := COALESCE(p_code, 200);
  IF v_clean_code < 100 OR v_clean_code > 599 THEN
    v_clean_code := 200;
  END IF;

  -- Insert audit log record
  INSERT INTO public.system_audit_logs (
    severity,
    category,
    code,
    title,
    details,
    source,
    actor_email,
    school_id,
    status,
    metadata,
    created_at
  )
  VALUES (
    v_clean_severity,
    v_clean_category,
    v_clean_code,
    substring(v_clean_title from 1 for 255),
    substring(COALESCE(p_details, '') from 1 for 4096),
    substring(COALESCE(p_source, 'Platform Client') from 1 for 100),
    v_actor_email,
    v_school_id,
    v_clean_status,
    COALESCE(p_metadata, '{}'::jsonb),
    now()
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;


-- 2. NARROWLY SCOPED INCIDENT RESOLUTION RPC
-- Allows authenticated administrators to resolve/acknowledge incidents
-- without granting broad UPDATE access across arbitrary columns.
CREATE OR REPLACE FUNCTION public.resolve_system_audit_incident(
  p_incident_id UUID,
  p_new_status TEXT DEFAULT 'RESOLVED'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_dept TEXT;
  v_clean_status TEXT;
  v_row public.system_audit_logs;
BEGIN
  -- Require authenticated session
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to resolve incidents';
  END IF;

  -- Verify administrative permissions
  SELECT role, department INTO v_caller_role, v_caller_dept
  FROM public.profiles
  WHERE auth_id = auth.uid()
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'superadmin', 'super_admin') THEN
    RAISE EXCEPTION 'Forbidden: Insufficient permissions to resolve incidents';
  END IF;

  IF p_incident_id IS NULL THEN
    RAISE EXCEPTION 'Incident ID is required';
  END IF;

  -- Validate target status
  v_clean_status := UPPER(TRIM(COALESCE(p_new_status, 'RESOLVED')));
  IF v_clean_status NOT IN ('RESOLVED', 'ACKNOWLEDGED', 'INVESTIGATING', 'DISMISSED') THEN
    RAISE EXCEPTION 'Invalid incident status: %', p_new_status;
  END IF;

  -- Update status respecting tenant isolation
  IF v_caller_role IN ('super_admin', 'superadmin') THEN
    UPDATE public.system_audit_logs
    SET status = v_clean_status
    WHERE id = p_incident_id
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.system_audit_logs
    SET status = v_clean_status
    WHERE id = p_incident_id AND (school_id = v_caller_dept OR school_id IS NULL)
    RETURNING * INTO v_row;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident not found or unauthorized to resolve';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;


-- 3. AUDIT LOG IMMUTABILITY TRIGGER
-- Guarantees that historical audit data cannot be tampered with.
-- Only 'status' may be updated; all forensic fields are strictly immutable.
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR
     NEW.severity IS DISTINCT FROM OLD.severity OR
     NEW.category IS DISTINCT FROM OLD.category OR
     NEW.code IS DISTINCT FROM OLD.code OR
     NEW.title IS DISTINCT FROM OLD.title OR
     NEW.details IS DISTINCT FROM OLD.details OR
     NEW.source IS DISTINCT FROM OLD.source OR
     NEW.actor_email IS DISTINCT FROM OLD.actor_email OR
     NEW.school_id IS DISTINCT FROM OLD.school_id OR
     NEW.created_at IS DISTINCT FROM OLD.created_at OR
     NEW.metadata IS DISTINCT FROM OLD.metadata THEN
    RAISE EXCEPTION 'Audit log entries are immutable; only status may be modified';
  END IF;

  IF UPPER(TRIM(NEW.status)) NOT IN ('ACTIVE', 'RESOLVED', 'ACKNOWLEDGED', 'INVESTIGATING', 'DISMISSED') THEN
    RAISE EXCEPTION 'Invalid audit log status: %', NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.system_audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mutation
BEFORE UPDATE ON public.system_audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_log_mutation();


-- 4. HARDEN FUNCTION PERMISSIONS
-- Revoke all default PUBLIC execute privileges on SECURITY DEFINER functions.
-- Grant execute only to verified authenticated users.
REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_email() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_department()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department FROM public.profiles WHERE auth_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_department() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_department() TO authenticated;

REVOKE ALL ON FUNCTION public.log_system_audit_event(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_system_audit_event(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_system_audit_incident(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_system_audit_incident(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.prevent_audit_log_mutation() FROM PUBLIC;


-- 5. ROW LEVEL SECURITY POLICIES ON system_audit_logs
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert on system_audit_logs" ON public.system_audit_logs;
DROP POLICY IF EXISTS "system_audit_logs_select_policy" ON public.system_audit_logs;
DROP POLICY IF EXISTS "system_audit_logs_insert_policy" ON public.system_audit_logs;
DROP POLICY IF EXISTS "system_audit_logs_update_policy" ON public.system_audit_logs;
DROP POLICY IF EXISTS "system_audit_logs_delete_policy" ON public.system_audit_logs;

-- SELECT: Only administrators can read audit records, scoped by tenant
CREATE POLICY "system_audit_logs_select_policy" ON public.system_audit_logs
FOR SELECT TO authenticated
USING (
  public.is_admin() AND (
    public.get_my_role() IN ('super_admin', 'superadmin') OR
    school_id = public.get_my_department() OR
    school_id IS NULL
  )
);

-- INSERT: Only administrators can insert audit logs directly (actor_email must match JWT)
CREATE POLICY "system_audit_logs_insert_policy" ON public.system_audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin() AND (
    actor_email = (auth.jwt() ->> 'email') OR
    actor_email = 'system@internal' OR
    actor_email IS NULL
  )
);

-- UPDATE: Only administrators can update; trigger strictly enforces status-only modifications
CREATE POLICY "system_audit_logs_update_policy" ON public.system_audit_logs
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Immutable audit trail: No DELETE policy for anyone


-- 6. ELIMINATE DEPRECATED ROLE FUNCTION IN FAVOR OF TO authenticated
-- classes_select_policy: Enforce tenant boundary without deprecated role checks
DROP POLICY IF EXISTS "classes_select_policy" ON public.classes;
CREATE POLICY "classes_select_policy" ON public.classes
FOR SELECT TO authenticated
USING (
  public.is_admin() OR
  (
    ((is_archived = false) OR (is_archived IS NULL)) AND
    (
      institution_id IS NULL OR
      institution_id = public.get_my_department()
    )
  )
);

-- profiles_select_policy: Use TO authenticated instead of inline role checks
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth_id = auth.uid()
  OR public.is_admin()
  OR role = 'teacher'
  OR (
    public.get_my_role() = 'teacher'
    AND id IN (
      SELECT cs.student_id
      FROM public.class_students cs
      JOIN public.class_teachers ct ON ct.class_id = cs.class_id
      WHERE ct.teacher_id = public.get_my_profile_id()
    )
  )
);

-- subjects_select_policy: Use TO authenticated instead of inline role checks
DROP POLICY IF EXISTS "subjects_select_policy" ON public.subjects;
CREATE POLICY "subjects_select_policy" ON public.subjects
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
