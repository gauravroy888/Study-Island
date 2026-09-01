import { supabase } from '../lib/supabase.js';

export const userService = {
  async getCurrentProfile() {
    const session = (await supabase.auth.getSession())?.data?.session;
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (error) throw error;
    return data;
  },

  async getTeachers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'teacher');
    if (error) throw error;
    return data || [];
  },

  async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};
export default userService;
