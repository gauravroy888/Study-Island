import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 'https://qmyrxvtbzlbnvzxypnus.supabase.co';
export const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjA4OTcsImV4cCI6MjA5NTM5Njg5N30.ABvW_oBzXC2Ffxm5ToLh6t4WmdKPdtg9SyfeAE76iJo';
export const SUPABASE_KEY = SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Resolves verified authenticated session and user from Supabase Auth.
 * Never relies on unverified localStorage keys for database identity.
 */
export async function getAuthenticatedUser() {
  if (!supabase?.auth?.getSession) return null;
  try {
    const { data: { session } = {} } = await supabase.auth.getSession();
    return session?.user || null;
  } catch {
    return null;
  }
}

/**
 * Returns verified authenticated student/user UUID or null.
 */
export async function getAuthenticatedUserId() {
  const user = await getAuthenticatedUser();
  return user?.id || null;
}

export default supabase;
