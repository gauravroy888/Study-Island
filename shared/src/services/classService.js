import { supabase } from '../lib/supabase.js';

export const classService = {
  async getClasses() {
    const { data, error } = await supabase.from('classes').select('*').order('name');
    if (error) throw error;
    return data || [];
  },

  async getClassRoster(classId) {
    const { data, error } = await supabase
      .from('student_enrollments')
      .select('student_id, profiles(*)')
      .eq('class_id', classId);
    if (error) {
      // Fallback query if enrollment table is pending
      const { data: allProfiles, error: pErr } = await supabase.from('profiles').select('*').eq('role', 'student');
      if (pErr) throw pErr;
      return allProfiles || [];
    }
    return data ? data.map(d => d.profiles) : [];
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
