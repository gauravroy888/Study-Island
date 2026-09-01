import { supabase } from '../lib/supabase.js';

export const chatService = {
  async getConversations(userId) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*, conversation_participants!inner(user_id)')
      .eq('conversation_participants.user_id', userId);
    if (error) throw error;
    return data || [];
  },

  async getMessages(conversationId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(full_name, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async sendMessage(conversationId, senderId, content) {
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        sender_id: senderId,
        content: content,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};
export default chatService;
