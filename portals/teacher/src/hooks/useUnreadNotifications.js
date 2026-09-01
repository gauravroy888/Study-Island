import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const ANNOUNCE_READ_KEY = 'edtech_teacher_read_announcements';

function getReadAnnouncements() {
  try { return new Set(JSON.parse(localStorage.getItem(ANNOUNCE_READ_KEY) || '[]')); }
  catch { return new Set(); }
}

export function useUnreadNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let currentUser = null;
    const userStr = localStorage.getItem('edtech_user');
    if (userStr) {
      try {
        currentUser = JSON.parse(userStr);
      } catch (e) {
        return;
      }
    }
    
    if (!currentUser) return;

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .in('user_email', [currentUser.email, 'all', 'system'])
        .eq('is_read', false);
      
      const { data: announceData } = await supabase
        .from('announcements')
        .select('id');

      const readSet = getReadAnnouncements();
      const unreadAnnounceCount = (announceData || []).filter(a => !readSet.has(`announce_${a.id}`)).length;

      setUnreadCount((count || 0) + unreadAnnounceCount);
    };

    fetchUnreadCount();

    const subscription = supabase.channel('public:notifications:unread')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications'
      }, fetchUnreadCount)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'announcements'
      }, fetchUnreadCount)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return unreadCount;
}
