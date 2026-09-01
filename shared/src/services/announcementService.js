import { supabase } from '../lib/supabase.js';

export const announcementService = {
  async getAnnouncements() {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createAnnouncement(announcement) {
    const payload = {
      title: announcement.title,
      content: announcement.content,
      category: announcement.category || 'General',
      created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('announcements').insert([payload]).select().single();
    if (error) throw error;
    return data;
  }
};
export default announcementService;
