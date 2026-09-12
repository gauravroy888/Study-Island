import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function useUnreadMessages() {
  const [totalUnread, setTotalUnread] = useState(0);
  const [currentUserEmail, setCurrentUserEmail] = useState(() => {
    try {
      const userStr = localStorage.getItem('edtech_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        return u.email || null;
      }
    } catch { /* ignore parse errors */ }
    return null;
  });

  // Listen for supabase auth state to catch late-loading sessions
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setCurrentUserEmail(session.user.email);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUserEmail) return;

    let msgSubscription;

    const fetchUnreadCount = async () => {
      try {
        // 1. Get all conversations for this user
        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .select('id')
          .or(`participant1_email.eq.${currentUserEmail},participant2_email.eq.${currentUserEmail}`);

        if (convError || !convData || convData.length === 0) {
          setTotalUnread(0);
          return;
        }

        const convIds = convData.map(c => c.id);

        // 2. Get all unread messages in those conversations
        const { data: unreadMsgs, error: msgError } = await supabase
          .from('messages')
          .select('senderEmail')
          .in('conversationId', convIds)
          .eq('is_read', false);

        if (!msgError && unreadMsgs) {
          // Filter out messages sent by the current user (those aren't unread for them)
          const count = unreadMsgs.filter(m => m.senderEmail !== currentUserEmail).length;
          setTotalUnread(count);
        }
      } catch {
        // Fail silently
      }
    };

    fetchUnreadCount();

    // 3. Listen for real-time changes
    msgSubscription = supabase.channel(`global_unread_${currentUserEmail}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchUnreadCount)
      .subscribe();

    return () => {
      if (msgSubscription) {
        supabase.removeChannel(msgSubscription);
      }
    };
  }, [currentUserEmail]); // Re-run when user email changes

  return totalUnread;
}
