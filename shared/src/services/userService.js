import { supabase } from '../lib/supabase.js';

const SAFE_PROFILE_FIELDS = 'id, auth_id, email, name, role, avatar_url, department, age, timetable, is_archived';

export const userService = {
  async getCurrentProfile() {
    const session = (await supabase.auth.getSession())?.data?.session;
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select(SAFE_PROFILE_FIELDS)
      .eq('id', session.user.id)
      .single();
    if (error) throw error;
    return data;
  },

  async getTeachers() {
    const { data, error } = await supabase
      .from('profiles')
      .select(SAFE_PROFILE_FIELDS)
      .eq('role', 'teacher');
    if (error) throw error;
    return data || [];
  },

  async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select(SAFE_PROFILE_FIELDS)
      .single();
    if (error) throw error;
    return data;
  }
};
export default userService;
