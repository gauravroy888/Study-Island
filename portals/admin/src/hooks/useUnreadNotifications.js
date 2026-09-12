import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function useUnreadNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let currentUser = null;
    const userStr = localStorage.getItem('edtech_user');
    if (userStr) {
      try {
        currentUser = JSON.parse(userStr);
      } catch {
        return;
      }
    }
    
    if (!currentUser) return;

    let isMounted = true;
    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_email', currentUser.email)
        .eq('is_read', false);
      
      if (count !== null && isMounted) {
        setUnreadCount(count);
      }
    };

    void fetchUnreadCount();

    const subscription = supabase.channel('public:notifications:unread')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_email=eq.${currentUser.email}`
      }, () => {
        if (isMounted) void fetchUnreadCount();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(subscription);
    };
  }, []);

  return unreadCount;
}
