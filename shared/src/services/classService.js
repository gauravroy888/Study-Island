import { supabase } from '../lib/supabase.js';

export const classService = {
  async getClasses() {
    const { data, error } = await supabase.from('classes').select('*').order('name');
    if (error) throw error;
    return data || [];
  },

  async getClassRoster(classId) {
    const { data, error } = await supabase
      .from('class_students')
      .select('student_id, profiles(id, auth_id, email, name, role, avatar_url, department, age)')
      .eq('class_id', classId);
    if (error) {
      console.error('[classService] Failed to load class roster:', error);
      return []; // NEVER query all profiles as a fallback!
    }
    return data ? data.map(d => d.profiles).filter(Boolean) : [];
  },

  async getLiveClasses() {
    const { data, error } = await supabase
      .from('live_classes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createLiveClass(payload) {
    const { data, error } = await supabase.from('live_classes').insert([payload]).select().single();
    if (error) throw error;
    return data;
  },

  async updateLiveClassStatus(id, status) {
    const { data, error } = await supabase.from('live_classes').update({ status }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
};
export default classService;
