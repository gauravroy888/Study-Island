import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Send, ArrowLeft, MoreVertical, MessageSquare, Check, CheckCheck, 
  Paperclip, Loader2, X, Maximize2, Pin, Reply, Trash2, Search as SearchIcon, Smile, 
  Copy, Forward 
} from 'lucide-react';
import { supabase } from '../supabase';
import { compressToJpeg } from '../lib/compressImage';
import { uploadImageToR2 } from '../lib/r2';
import EmojiPicker from './EmojiPicker';
import { 
  LinkPreviewCard, ImageLightbox, WhatsAppMessageActionToolbar, WhatsAppReactionBadge, 
  QuotedMessageBubble, PinnedMessageBanner, TypingIndicatorBanner, ForwardedMessageTag, 
  ForwardMessageModal, extractFirstUrl, formatMessageWithLinks, formatTimeAgo 
} from './MediaChatComponents';
import { usePresence } from '../hooks/usePresence';
import './ChatInterface.css';

export default function ChatInterface({ currentUser: propUser, activeTab, onUnreadCountChange }) {
  // Resolve current logged-in user with robust fallback
  const [currentUser, setCurrentUser] = useState(() => {
    if (propUser) return propUser;
    try {
      const stored = localStorage.getItem('edtech_user');
      return stored ? JSON.parse(stored) : { email: 'immersionlabsindia@gmail.com', name: 'Immersion Labs', role: 'admin' };
    } catch (e) {
      return { email: 'immersionlabsindia@gmail.com', name: 'Immersion Labs', role: 'admin' };
    }
  });

  useEffect(() => {
    if (propUser) setCurrentUser(propUser);
  }, [propUser]);

  const [profiles, setProfiles] = useState([]);
  const [conversationsMap, setConversationsMap] = useState({});
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all"); // 'all' | 'students' | 'teachers'
  
  const [activeContact, setActiveContact] = useState(null); // { id, name, email, role, avatar_url }
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Advanced chat feature states
  // Presence comes from PresenceProvider — no own channel needed
  const { isOnline } = usePresence();
  const [typingUser, setTypingUser] = useState(null);
  const [stagedReply, setStagedReply] = useState(null); // { id, text, senderName }
  const [stagedImage, setStagedImage] = useState(null); // { blob, previewUrl, name, originalSize, compressedSize, isCompressing }
  const [activeLightboxImg, setActiveLightboxImg] = useState(null);
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeDropdownMsgId, setActiveDropdownMsgId] = useState(null);
  const [forwardModalMessage, setForwardModalMessage] = useState(null);
  const [copyToast, setCopyToast] = useState(false);

  const fileInputRef = useRef(null);
  const chatInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeChannelRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  const scrollToMessageId = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('chat-bubble-highlight');
      setTimeout(() => el.classList.remove('chat-bubble-highlight'), 1800);
    }
  };

  // 2. Fetch Profiles & Conversations History
  const fetchProfilesAndConversations = async () => {
    if (!currentUser?.email) return;
    try {
      const { data: profData } = await supabase.from('profiles').select('*').order('name');
      const { data: userData } = await supabase.from('users').select('*');
      
      const combinedMap = new Map();
      
      if (userData && userData.length > 0) {
        userData.forEach(u => {
          const name = u.full_name || u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
          combinedMap.set(u.email.toLowerCase(), {
            id: u.id,
            name: name,
            email: u.email,
            role: u.role || 'student',
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4`
          });
        });
      }

      if (profData && profData.length > 0) {
        profData.forEach(p => {
          combinedMap.set(p.email.toLowerCase(), {
            id: p.id,
            name: p.name || p.email,
            email: p.email,
            role: p.role || 'student',
            avatar_url: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name || p.email)}&backgroundColor=b6e3f4`
          });
        });
      }

      // Fetch all conversations for sorting & last message preview
      const { data: convData } = await supabase.from('conversations')
        .select('*')
        .or(`participant1_email.eq.${currentUser.email},participant2_email.eq.${currentUser.email}`);

      const cMap = {};
      if (convData) {
        convData.forEach(c => {
          const otherEmail = c.participant1_email === currentUser.email ? c.participant2_email : c.participant1_email;
          if (otherEmail) {
            cMap[otherEmail.toLowerCase()] = c;
          }
        });
        setConversationsMap(cMap);
      }

      setProfiles(Array.from(combinedMap.values()));
    } catch (err) {
      console.error("Error fetching profiles from Supabase:", err);
    }
  };

  useEffect(() => {
    fetchProfilesAndConversations();
    
    const profilesSub = supabase.channel('public:profiles_sync_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchProfilesAndConversations)
      .subscribe();

    const usersSub = supabase.channel('public:users_sync_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchProfilesAndConversations)
      .subscribe();

    const convsSub = supabase.channel('public:conversations_sync_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchProfilesAndConversations)
      .subscribe();
      
    return () => { 
      supabase.removeChannel(profilesSub); 
      supabase.removeChannel(usersSub);
      supabase.removeChannel(convsSub);
    };
  }, [currentUser]);

  // 3. Fetch Unread Counts
  const fetchUnreadCounts = async () => {
    if (!currentUser?.email) return;
    
    try {
      const { data: myConvs } = await supabase.from('conversations')
        .select('id, participant1_email, participant2_email')
        .or(`participant1_email.eq.${currentUser.email},participant2_email.eq.${currentUser.email}`);
        
      if (!myConvs || myConvs.length === 0) return;
      const convIds = myConvs.map(c => c.id);
      
      const { data: unreadMsgs } = await supabase.from('messages')
        .select('senderEmail, conversationId')
        .in('conversationId', convIds)
        .eq('is_read', false)
        .neq('senderEmail', currentUser.email);
        
      if (unreadMsgs) {
        const counts = {};
        unreadMsgs.forEach(msg => {
          counts[msg.senderEmail] = (counts[msg.senderEmail] || 0) + 1;
        });
        setUnreadCounts(counts);
        
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        if (onUnreadCountChange) {
          onUnreadCountChange({ chat: total, total });
        }
      }
    } catch (err) {
      console.error("Error fetching unread counts:", err);
    }
  };

  useEffect(() => {
    fetchUnreadCounts();
    
    const unreadSub = supabase.channel('public:messages_unread_sync_admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.new.senderEmail !== currentUser?.email) {
          fetchUnreadCounts();
          fetchProfilesAndConversations();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        fetchUnreadCounts();
      })
      .subscribe();
      
    return () => { supabase.removeChannel(unreadSub); };
  }, [currentUser]);

  // 4. Filter & Sort Contacts (Active conversations first, then alphabetical)
  useEffect(() => {
    if (!profiles) return;
    
    let baseList = profiles.filter(p => p && p.email && (!currentUser?.email || p.email.toLowerCase() !== currentUser.email.toLowerCase()));

    if (filterRole === 'students') {
      baseList = baseList.filter(p => p.role === 'student');
    } else if (filterRole === 'teachers') {
      baseList = baseList.filter(p => p.role === 'teacher' || p.role === 'admin');
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      baseList = baseList.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) || 
        (p.email && p.email.toLowerCase().includes(q))
      );
    }
    
    // Sort contacts by latest conversation activity (updatedAt descending)
    baseList.sort((a, b) => {
      const emailA = (a.email || '').toLowerCase();
      const emailB = (b.email || '').toLowerCase();
      const convA = emailA ? conversationsMap[emailA] : null;
      const convB = emailB ? conversationsMap[emailB] : null;
      const timeA = convA?.updatedAt ? new Date(convA.updatedAt).getTime() : 0;
      const timeB = convB?.updatedAt ? new Date(convB.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

    setFilteredProfiles(baseList);
  }, [profiles, conversationsMap, filterRole, searchQuery, currentUser]);

  // 5. Fetch or Create 1-on-1 Direct Conversation
  useEffect(() => {
    if (!activeContact || !currentUser?.email) return;

    const fetchOrCreateConversation = async () => {
      try {
        const { data, error } = await supabase.from('conversations')
          .select('*')
          .or(`and(participant1_email.eq.${currentUser.email},participant2_email.eq.${activeContact.email}),and(participant1_email.eq.${activeContact.email},participant2_email.eq.${currentUser.email})`)
          .maybeSingle();
          
        if (data) {
          setCurrentConversation(data);
        } else {
          const { data: newConv, error: createErr } = await supabase.from('conversations')
            .insert({ 
              participant1_email: currentUser.email, 
              participant2_email: activeContact.email,
              type: 'direct',
              lastMessage: 'Conversation opened'
            })
            .select()
            .single();
            
          if (newConv) setCurrentConversation(newConv);
          if (createErr) console.error("Error creating direct conversation:", createErr);
        }
      } catch (err) {
        console.error("Error in fetchOrCreateConversation:", err);
      }
    };
    fetchOrCreateConversation();
  }, [activeContact, currentUser]);

  // 6. Fetch Messages & Realtime Subscription + Typing Broadcast
  const fetchMessages = async () => {
    if (!currentConversation?.id) return;
    try {
      const { data } = await supabase.from('messages')
        .select('*')
        .eq('conversationId', currentConversation.id)
        .order('createdAt', { ascending: true });
      
      if (data) {
        setMessages(data);
        setTimeout(() => scrollToBottom(false), 50);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  useEffect(() => {
    fetchMessages();
    setTypingUser(null);
    if (!currentConversation?.id) return;
    
    const channelName = `public:messages:${currentConversation.id}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `conversationId=eq.${currentConversation.id}` 
      }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
        setTimeout(() => scrollToBottom(true), 50);
        
        if (payload.new.senderEmail !== currentUser?.email) {
          supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id).then(() => fetchUnreadCounts());
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversationId=eq.${currentConversation.id}`
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `conversationId=eq.${currentConversation.id}`
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.senderEmail !== currentUser?.email) {
          if (payload.isTyping) {
            setTypingUser(payload.senderName || 'Someone');
          } else {
            setTypingUser(null);
          }
        }
      })
      .subscribe();

    activeChannelRef.current = channel;
      
    return () => { 
      supabase.removeChannel(channel); 
      activeChannelRef.current = null;
    };
  }, [currentConversation]);

  // Mark all unread messages as read when conversation opens
  useEffect(() => {
    if (!currentConversation?.id || !activeContact?.email || !currentUser?.email) return;
    
    const markAsRead = async () => {
      try {
        await supabase.from('messages')
          .update({ is_read: true })
          .eq('conversationId', currentConversation.id)
          .neq('senderEmail', currentUser.email)
          .eq('is_read', false);
          
        setUnreadCounts(prev => ({ ...prev, [activeContact.email]: 0 }));
        fetchUnreadCounts();
      } catch (err) {
        console.error("Error marking messages as read:", err);
      }
    };
    markAsRead();
  }, [currentConversation, activeContact, currentUser]);

  // Broadcast Typing Handler
  const handleInputChange = (e) => {
    const val = e.target.value;
    setNewMessage(val);

    if (activeChannelRef.current && currentConversation?.id) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          senderEmail: currentUser.email,
          senderName: currentUser.name || 'Admin',
          isTyping: true
        }
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (activeChannelRef.current) {
          activeChannelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: {
              senderEmail: currentUser.email,
              senderName: currentUser.name || 'Admin',
              isTyping: false
            }
          });
        }
      }, 2200);
    }
  };

  // Image Selection & Canvas JPEG Compression (≤ 2MB)
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Only image files (JPEG, PNG, WebP, etc.) are supported.');
      e.target.value = '';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert('Selected image exceeds 15MB. Please choose a smaller image.');
      e.target.value = '';
      return;
    }

    try {
      const tempPreview = URL.createObjectURL(file);
      setStagedImage({
        previewUrl: tempPreview,
        name: file.name,
        isCompressing: true,
        blob: null,
      });

      const compressedBlob = await compressToJpeg(file, { maxMB: 2, maxWidth: 1920, quality: 0.82 });
      const compressedUrl = URL.createObjectURL(compressedBlob);

      setStagedImage({
        blob: compressedBlob,
        previewUrl: compressedUrl,
        name: file.name.replace(/\.[^/.]+$/, '') + '.jpg',
        originalSize: (file.size / 1024).toFixed(0) + ' KB',
        compressedSize: (compressedBlob.size / 1024).toFixed(0) + ' KB',
        isCompressing: false,
      });
    } catch (err) {
      console.error('Image compression failed:', err);
      alert('Failed to compress image: ' + err.message);
      setStagedImage(null);
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveStagedImage = () => {
    if (stagedImage?.previewUrl) {
      URL.revokeObjectURL(stagedImage.previewUrl);
    }
    setStagedImage(null);
  };

  // Emoji Reactions Toggle (Strictly 1 reaction per user per message)
  const handleToggleReaction = async (messageId, emoji) => {
    if (!currentUser?.email) return;
    const userEmail = currentUser.email.toLowerCase();
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    const currentReactions = msg.reactions || {};
    const updatedReactions = {};

    // Check what emoji the user currently has reacted with (if any)
    let previousEmojiForUser = null;
    for (const [em, users] of Object.entries(currentReactions)) {
      if (Array.isArray(users) && users.some(u => u.toLowerCase() === userEmail)) {
        previousEmojiForUser = em;
      }
    }

    // Strip current user from all existing emoji reaction lists
    for (const [em, users] of Object.entries(currentReactions)) {
      if (Array.isArray(users)) {
        const filtered = users.filter(u => u.toLowerCase() !== userEmail);
        if (filtered.length > 0) {
          updatedReactions[em] = filtered;
        }
      }
    }

    // If clicked a DIFFERENT emoji, add to new emoji list. If SAME emoji, it's toggled off.
    if (previousEmojiForUser !== emoji) {
      if (!updatedReactions[emoji]) {
        updatedReactions[emoji] = [];
      }
      updatedReactions[emoji].push(currentUser.email);
    }

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: updatedReactions } : m));

    try {
      await supabase.from('messages').update({ reactions: updatedReactions }).eq('id', messageId);
    } catch (err) {
      console.error("Failed to update reaction:", err);
    }
  };

  // Insert Emoji from WhatsApp Emoji Library
  const handleInsertEmoji = (emoji) => {
    setNewMessage(prev => prev + emoji);
    chatInputRef.current?.focus();
  };

  // Copy Message Text
  const handleCopyMessage = (msg) => {
    const textToCopy = msg.text || msg.attachment_url || '';
    if (textToCopy && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    }
  };

  // Forward Message Handler (WhatsApp Style)
  const handleForwardMessage = async (msg, targetContacts) => {
    if (!msg || !targetContacts || targetContacts.length === 0) return;

    for (const target of targetContacts) {
      try {
        let convId = target.id;
        
        if (!target.isGroup) {
          // Find or create conversation with this direct contact
          const { data: existingConv } = await supabase.from('conversations')
            .select('id')
            .or(`and(participant1_email.eq.${currentUser.email},participant2_email.eq.${target.email}),and(participant1_email.eq.${target.email},participant2_email.eq.${currentUser.email})`)
            .maybeSingle();

          if (existingConv) {
            convId = existingConv.id;
          } else {
            const { data: newConv } = await supabase.from('conversations')
              .insert({
                participant1_email: currentUser.email,
                participant2_email: target.email,
                type: 'direct',
                lastMessage: 'Forwarded message'
              })
              .select().single();
            if (newConv) convId = newConv.id;
          }
        }

        if (convId) {
          const forwardPayload = {
            conversationId: convId,
            senderEmail: currentUser.email,
            senderName: currentUser.name || "Administrator",
            text: msg.text || '',
            attachment_url: msg.attachment_url || null,
            attachment_type: msg.attachment_type || null,
            is_forwarded: true,
            is_read: false,
            is_deleted: false,
            reactions: {}
          };

          await supabase.from('messages').insert(forwardPayload);

          const previewText = msg.attachment_type === 'image' 
            ? (msg.text ? `📷 ${msg.text}` : '📷 Photo') 
            : msg.text;

          await supabase.from('conversations')
            .update({ lastMessage: previewText, updatedAt: new Date() })
            .eq('id', convId);
        }
      } catch (err) {
        console.error("Error forwarding message to", target.name, err);
      }
    }

    fetchProfilesAndConversations();
    fetchMessages();
  };

  // Pinned Message Toggle
  const handleTogglePin = async (msg) => {
    if (!currentConversation?.id) return;
    const newPinnedId = currentConversation.pinned_message_id === msg.id ? null : msg.id;

    setCurrentConversation(prev => ({ ...prev, pinned_message_id: newPinnedId }));

    try {
      await supabase.from('conversations').update({ pinned_message_id: newPinnedId }).eq('id', currentConversation.id);
    } catch (err) {
      console.error("Failed to update pin:", err);
    }
  };

  // Delete Message ("Delete for Everyone")
  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Are you sure you want to delete this message for everyone?")) return;

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true, text: 'This message was deleted', attachment_url: null, attachment_type: null } : m));

    try {
      await supabase.from('messages').update({
        is_deleted: true,
        text: 'This message was deleted',
        attachment_url: null,
        attachment_type: null
      }).eq('id', messageId);
    } catch (err) {
      console.error("Failed to delete message:", err);
      alert("Failed to delete message: " + err.message);
    }
  };

  // Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !stagedImage?.blob) || !currentConversation?.id || !currentUser?.email || isSending || isUploading) return;
    
    const msgText = newMessage.trim();
    const currentStaged = stagedImage;
    const currentReply = stagedReply;
    
    setNewMessage('');
    setStagedImage(null);
    setStagedReply(null);
    setShowEmojiPicker(false);
    setIsSending(true);

    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { senderEmail: currentUser.email, isTyping: false }
      });
    }
    
    try {
      let attachmentUrl = null;
      let attachmentType = null;

      if (currentStaged?.blob) {
        setIsUploading(true);
        attachmentUrl = await uploadImageToR2(currentStaged.blob, currentStaged.name);
        attachmentType = 'image';
        setIsUploading(false);
      } else if (extractFirstUrl(msgText)) {
        attachmentType = 'link';
      }

      const payload = {
        conversationId: currentConversation.id,
        senderEmail: currentUser.email,
        senderName: currentUser.name || "Administrator",
        text: msgText,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
        reply_to_id: currentReply?.id || null,
        reply_to_text: currentReply?.text || null,
        reply_to_sender: currentReply?.senderName || null,
        is_read: false,
        is_deleted: false,
        is_forwarded: false,
        reactions: {}
      };

      const { data: insertedMsg, error: msgError } = await supabase.from('messages').insert(payload).select().single();
      
      if (msgError) throw msgError;

      setMessages(prev => {
        if (prev.some(m => m.id === insertedMsg.id)) return prev;
        return [...prev, insertedMsg];
      });
      setTimeout(() => scrollToBottom(true), 50);

      const previewText = attachmentType === 'image' 
        ? (msgText ? `📷 ${msgText}` : '📷 Photo') 
        : msgText;

      await supabase.from('conversations')
        .update({ lastMessage: previewText, updatedAt: new Date() })
        .eq('id', currentConversation.id);

      fetchProfilesAndConversations();
    } catch (err) {
      console.error("Failed to send message:", err);
      setNewMessage(msgText);
      setStagedImage(currentStaged);
      setStagedReply(currentReply);
      alert('Message failed to send: ' + (err.message || 'Network error'));
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const studentCount = profiles.filter(p => p.role === 'student' && p.email !== currentUser?.email).length;
  const facultyCount = profiles.filter(p => (p.role === 'teacher' || p.role === 'admin') && p.email !== currentUser?.email).length;
  const totalCount = profiles.filter(p => p.email !== currentUser?.email).length;

  const pinnedMsg = currentConversation?.pinned_message_id 
    ? messages.find(m => m.id === currentConversation.pinned_message_id) 
    : null;

  const displayMessages = inChatSearchQuery.trim()
    ? messages.filter(m => m.text?.toLowerCase().includes(inChatSearchQuery.toLowerCase()))
    : messages;

  return (
    <div className="chat-interface-container" onClick={() => setActiveDropdownMsgId(null)}>
      {/* Left Pane: Contacts List */}
      <div className={`chat-sidebar ${activeContact ? 'hidden-mobile' : ''}`}>
        <div className="chat-sidebar-header">
          <div className="chat-search-wrapper">
            <Search size={16} className="chat-search-icon" />
            <input 
              type="text" 
              placeholder="Search contacts..." 
              className="chat-search-input" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
          </div>
        </div>

        {/* Filter Category Chips */}
        <div className="chat-filter-chips">
          <button 
            type="button"
            className={`chat-chip ${filterRole === 'all' ? 'active' : ''}`}
            onClick={() => setFilterRole('all')}
          >
            All ({totalCount})
          </button>
          <button 
            type="button"
            className={`chat-chip ${filterRole === 'students' ? 'active' : ''}`}
            onClick={() => setFilterRole('students')}
          >
            Students ({studentCount})
          </button>
          <button 
            type="button"
            className={`chat-chip ${filterRole === 'teachers' ? 'active' : ''}`}
            onClick={() => setFilterRole('teachers')}
          >
            Faculty ({facultyCount})
          </button>
        </div>
        
        {/* Contact List with Last Message & Online Presence */}
        <div className="chat-contacts-list">
          {filteredProfiles.length > 0 ? (
            filteredProfiles.map(contact => {
              const unread = unreadCounts[contact.email] || 0;
              const isSelected = activeContact?.email === contact.email;
              const isUserOnline = isOnline(contact.email);
              const conv = conversationsMap[contact.email.toLowerCase()];

              return (
                <div 
                  key={contact.id || contact.email} 
                  className={`chat-contact-item ${isSelected ? 'active' : ''}`} 
                  onClick={() => setActiveContact(contact)}
                >
                  <div className="chat-contact-avatar">
                    <div className="presence-avatar-wrapper">
                      <img 
                        src={contact.avatar_url || `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(contact.email || contact.name)}&backgroundColor=0a0f1d`} 
                        alt={contact.name} 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(contact.email || contact.name)}&backgroundColor=0a0f1d`;
                        }}
                      />
                      {isUserOnline && <span className="presence-dot" title="Online" />}
                    </div>
                  </div>
                  <div className="chat-contact-info">
                    <div className="chat-contact-name-row">
                      <span className="chat-contact-name">{contact.name}</span>
                      {conv?.updatedAt && (
                        <span className="chat-contact-time">{formatTimeAgo(conv.updatedAt)}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="chat-contact-snippet">
                        {conv?.lastMessage ? conv.lastMessage : contact.email}
                      </span>
                      {unread > 0 && <span className="unread-badge">{unread}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="chat-empty-state">
              No matching database contacts found.
            </div>
          )}
        </div>
      </div>
      
      {/* Right Pane: Active Chat Area */}
      <div className={`chat-main-area ${!activeContact ? 'hidden-mobile' : ''}`}>
        {activeContact ? (
          <>
            <div className="chat-main-header">
              <button className="chat-back-btn" onClick={() => setActiveContact(null)}>
                <ArrowLeft size={20} />
              </button>
              <div className="chat-header-avatar">
                <div className="presence-avatar-wrapper">
                  <img 
                    src={activeContact.avatar_url || `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(activeContact.email || activeContact.name)}&backgroundColor=0a0f1d`} 
                    alt={activeContact.name} 
                  />
                  {isOnline(activeContact.email) && <span className="presence-dot" />}
                </div>
              </div>
              <div className="chat-header-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4>{activeContact.name}</h4>
                  <span className={`chat-contact-role role-${activeContact.role || 'student'}`}>
                    {activeContact.role || 'student'}
                  </span>
                </div>
                <span>
                  {isOnline(activeContact.email) ? (
                    <span style={{ color: '#10B981', fontWeight: 600 }}>● Active Now</span>
                  ) : (
                    activeContact.email
                  )}
                </span>
              </div>
              <div className="chat-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  type="button" 
                  className="chat-action-btn"
                  onClick={() => setShowInChatSearch(!showInChatSearch)} 
                  title="Search inside conversation"
                  style={{ background: showInChatSearch ? 'rgba(0, 240, 255, 0.2)' : 'transparent' }}
                >
                  <SearchIcon size={18} />
                </button>
              </div>
            </div>

            {/* In-Chat Search Bar */}
            {showInChatSearch && (
              <div className="chat-in-search-bar">
                <Search size={14} style={{ opacity: 0.7 }} />
                <input 
                  type="text" 
                  placeholder="Search in this conversation..." 
                  className="chat-in-search-input"
                  value={inChatSearchQuery}
                  onChange={(e) => setInChatSearchQuery(e.target.value)}
                  autoFocus
                />
                {inChatSearchQuery && (
                  <button type="button" className="chat-staged-reply-close" onClick={() => setInChatSearchQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            {/* Pinned Message Banner */}
            {pinnedMsg && (
              <PinnedMessageBanner 
                pinnedMessage={pinnedMsg} 
                onScrollToPinned={() => scrollToMessageId(pinnedMsg.id)} 
                onUnpin={() => handleTogglePin(pinnedMsg)} 
              />
            )}
            
            <div className="chat-messages-area">
              {displayMessages.length === 0 ? (
                <div className="chat-messages-empty">
                  <MessageSquare size={24} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                  <div>No messages found.</div>
                </div>
              ) : (
                displayMessages.map((msg, idx) => {
                  const isMe = msg.senderEmail === currentUser.email;
                  const firstUrl = extractFirstUrl(msg.text);
                  const hasImage = msg.attachment_type === 'image' && msg.attachment_url;
                  const isPinned = currentConversation?.pinned_message_id === msg.id;
                  const hasReactions = msg.reactions && Object.values(msg.reactions).some(u => Array.isArray(u) && u.length > 0);
                  const isDropdownOpen = activeDropdownMsgId === msg.id;

                  return (
                    <div 
                      key={msg.id || idx} 
                      id={`msg-${msg.id}`}
                      className={`chat-bubble-wrapper ${isMe ? 'is-me' : 'is-them'} ${hasReactions ? 'has-reactions' : ''}`}
                    >
                      {/* Outgoing message: action buttons appear to the left of the bubble */}
                      {isMe && !msg.is_deleted && (
                        <WhatsAppMessageActionToolbar 
                          isMe={isMe}
                          isPinned={isPinned}
                          showDropdown={isDropdownOpen}
                          setShowDropdown={(open) => setActiveDropdownMsgId(open ? msg.id : null)}
                          onReact={(emoji) => handleToggleReaction(msg.id, emoji)}
                          onReply={() => setStagedReply({ id: msg.id, text: msg.text || 'Photo', senderName: msg.senderName || 'You' })}
                          onPin={() => handleTogglePin(msg)}
                          onCopy={() => handleCopyMessage(msg)}
                          onForward={() => setForwardModalMessage(msg)}
                          onDelete={() => handleDeleteMessage(msg.id)}
                        />
                      )}

                      <div className="chat-bubble">
                        {/* Forwarded Message Tag */}
                        {msg.is_forwarded && <ForwardedMessageTag />}

                        {/* Quoted Message */}
                        {msg.reply_to_text && (
                          <QuotedMessageBubble 
                            replyToSender={msg.reply_to_sender} 
                            replyToText={msg.reply_to_text} 
                            onScrollToOriginal={() => scrollToMessageId(msg.reply_to_id)} 
                          />
                        )}

                        {/* Image Attachment */}
                        {hasImage && (
                          <div 
                            className="chat-bubble-image-container"
                            onClick={() => setActiveLightboxImg(msg.attachment_url)}
                          >
                            <img 
                              src={msg.attachment_url} 
                              alt="Chat photo" 
                              className="chat-bubble-image" 
                              loading="lazy"
                            />
                            <div className="chat-bubble-image-overlay" title="Click to enlarge">
                              <Maximize2 size={14} />
                            </div>
                          </div>
                        )}

                        {/* Message Text or Deleted Notification */}
                        {msg.is_deleted ? (
                          <div className="chat-deleted-text">
                            <span>🚫 This message was deleted</span>
                          </div>
                        ) : (
                          msg.text && (
                            <div className="chat-bubble-text">
                              {formatMessageWithLinks(msg.text, inChatSearchQuery)}
                            </div>
                          )
                        )}

                        {/* Link Preview Card */}
                        {firstUrl && !hasImage && !msg.is_deleted && (
                          <LinkPreviewCard url={firstUrl} />
                        )}

                        {/* Timestamp & Read Receipts */}
                        <div className="chat-bubble-time">
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                          {isMe && !msg.is_deleted && (
                            msg.is_read ? (
                              <CheckCheck size={13} style={{ marginLeft: '4px', verticalAlign: 'middle', color: 'var(--brand-primary, #00F0FF)' }} title="Read" />
                            ) : (
                              <Check size={13} style={{ marginLeft: '4px', verticalAlign: 'middle', opacity: 0.6 }} title="Delivered" />
                            )
                          )}
                        </div>

                        {/* WhatsApp-Style Floating Reaction Badge at Bottom Corner */}
                        {!msg.is_deleted && (
                          <WhatsAppReactionBadge 
                            reactions={msg.reactions} 
                            currentEmail={currentUser.email} 
                            onToggleReaction={(emoji) => handleToggleReaction(msg.id, emoji)} 
                          />
                        )}
                      </div>

                      {/* Incoming message: action buttons appear to the right of the bubble */}
                      {!isMe && !msg.is_deleted && (
                        <WhatsAppMessageActionToolbar 
                          isMe={isMe}
                          isPinned={isPinned}
                          showDropdown={isDropdownOpen}
                          setShowDropdown={(open) => setActiveDropdownMsgId(open ? msg.id : null)}
                          onReact={(emoji) => handleToggleReaction(msg.id, emoji)}
                          onReply={() => setStagedReply({ id: msg.id, text: msg.text || 'Photo', senderName: msg.senderName || activeContact.name })}
                          onPin={() => handleTogglePin(msg)}
                          onCopy={() => handleCopyMessage(msg)}
                          onForward={() => setForwardModalMessage(msg)}
                          onDelete={null}
                        />
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Real-Time Typing Indicator */}
            <TypingIndicatorBanner typingUser={typingUser} />

            {/* Staged Reply Banner */}
            {stagedReply && (
              <div className="chat-staged-reply-banner">
                <div className="chat-staged-reply-bar" />
                <div className="chat-staged-reply-content">
                  <span className="chat-staged-reply-sender">Replying to {stagedReply.senderName}</span>
                  <span className="chat-staged-reply-text">{stagedReply.text}</span>
                </div>
                <button 
                  type="button" 
                  className="chat-staged-reply-close" 
                  onClick={() => setStagedReply(null)}
                  title="Cancel reply"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Staged Image Preview Bar */}
            {stagedImage && (
              <div className="chat-staged-media-wrapper">
                <img src={stagedImage.previewUrl} alt="Preview" className="chat-staged-media-thumb" />
                <div className="chat-staged-media-info">
                  <div className="chat-staged-media-title">{stagedImage.name}</div>
                  <div className="chat-staged-media-badge">
                    {stagedImage.isCompressing ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>Compressing to JPEG ≤ 2MB...</span>
                      </>
                    ) : (
                      <span>JPEG Ready: {stagedImage.compressedSize} (was {stagedImage.originalSize})</span>
                    )}
                  </div>
                </div>
                <button 
                  type="button" 
                  className="chat-staged-media-remove" 
                  onClick={handleRemoveStagedImage}
                  title="Remove image"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            
            <form className="chat-input-area" onSubmit={handleSendMessage} style={{ position: 'relative' }}>
              {/* WhatsApp Emoji Picker Dropdown */}
              {showEmojiPicker && (
                <EmojiPicker 
                  onSelectEmoji={handleInsertEmoji} 
                  onClose={() => setShowEmojiPicker(false)} 
                />
              )}

              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={handleFileSelect} 
              />
              <button 
                type="button" 
                className="chat-attach-btn" 
                onClick={() => fileInputRef.current?.click()} 
                title="Share Image (Auto-compressed to JPEG ≤ 2MB)"
                disabled={isSending || isUploading || stagedImage?.isCompressing}
              >
                <Paperclip size={19} />
              </button>

              {/* WhatsApp Smile Emoji Button */}
              <button 
                type="button" 
                className={`chat-attach-btn ${showEmojiPicker ? 'active' : ''}`}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                title="Insert Emoji"
                style={{ color: showEmojiPicker ? 'var(--brand-primary, #00F0FF)' : 'inherit' }}
              >
                <Smile size={20} />
              </button>

              <input 
                ref={chatInputRef}
                type="text" 
                placeholder={stagedImage ? "Add a caption..." : (stagedReply ? `Reply to ${stagedReply.senderName}...` : `Type a message...`)} 
                className="chat-input" 
                value={newMessage} 
                onChange={handleInputChange} 
                disabled={isSending || isUploading}
              />
              
              <button 
                type="submit" 
                className="chat-send-btn" 
                disabled={(!newMessage.trim() && !stagedImage?.blob) || isSending || isUploading || stagedImage?.isCompressing}
                title="Send Message"
              >
                {isUploading || isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
          </>
        ) : (
          <div className="chat-placeholder-area">
            <div className="chat-placeholder-content">
              <div className="chat-placeholder-icon">💬</div>
              <h3>Select a User Conversation</h3>
              <p>Choose a student or faculty member from the left menu to start direct real-time messaging.</p>
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Forward Modal */}
      {forwardModalMessage && (
        <ForwardMessageModal 
          message={forwardModalMessage} 
          contacts={filteredProfiles} 
          onForward={handleForwardMessage} 
          onClose={() => setForwardModalMessage(null)} 
        />
      )}

      {/* Lightbox Modal */}
      {activeLightboxImg && (
        <ImageLightbox 
          imageUrl={activeLightboxImg} 
          onClose={() => setActiveLightboxImg(null)} 
        />
      )}
    </div>
  );
}
