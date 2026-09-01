import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Send, ArrowLeft, MoreVertical, Users, Check, CheckCheck, 
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

export default function ChatInterface({ currentUser: propUser, activeTab, selectedClass, isManager, onUnreadCountChange }) {
  const [currentUser, setCurrentUser] = useState(() => {
    if (propUser) return propUser;
    try {
      const stored = localStorage.getItem('edtech_user');
      return stored ? JSON.parse(stored) : { email: 'teacher@edtech.org', name: 'Teacher', role: 'teacher' };
    } catch (e) {
      return { email: 'teacher@edtech.org', name: 'Teacher', role: 'teacher' };
    }
  });

  useEffect(() => {
    if (propUser) setCurrentUser(propUser);
  }, [propUser]);

  const [profiles, setProfiles] = useState([]);
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [conversationsMap, setConversationsMap] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  
  const [activeContact, setActiveContact] = useState(null); // { isGroup, id, name, email, participants }
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
  const [stagedReply, setStagedReply] = useState(null);
  const [stagedImage, setStagedImage] = useState(null);
  const [activeLightboxImg, setActiveLightboxImg] = useState(null);
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeDropdownMsgId, setActiveDropdownMsgId] = useState(null);
  const [forwardModalMessage, setForwardModalMessage] = useState(null);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

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

  // 2. Fetch Profiles, Groups & Conversation Activity
  const fetchProfilesAndConversations = async () => {
    if (!currentUser) return;
    try {
      const { data: profData } = await supabase.from('profiles').select('id,name,email,role,avatar_url').order('name');
      const { data: userData } = await supabase.from('users').select('*');

      const combinedMap = new Map();

      if (userData && userData.length > 0) {
        userData.forEach(u => {
          const name = u.full_name || u.name || u.email;
          combinedMap.set(u.email.toLowerCase(), {
            id: u.id,
            name: name,
            email: u.email,
            role: u.role || 'teacher',
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
            role: p.role || 'teacher',
            avatar_url: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name || p.email)}&backgroundColor=b6e3f4`
          });
        });
      }

      setProfiles(Array.from(combinedMap.values()));

      // Fetch Groups
      const { data: grpData } = await supabase.from('conversations')
        .select('*')
        .eq('type', 'group')
        .contains('participants', [currentUser.email]);
      if (grpData) setGroups(grpData);

      // Fetch Direct conversations
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
      }
      if (grpData) {
        grpData.forEach(g => {
          cMap[g.id] = g;
        });
      }
      setConversationsMap(cMap);
    } catch(err) {
      console.error('Error fetching profiles & conversations:', err);
    }
  };

  useEffect(() => {
    fetchProfilesAndConversations();
    
    const profilesSub = supabase.channel('public:profiles_sync_teacher')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchProfilesAndConversations)
      .subscribe();
      
    const groupsSub = supabase.channel('public:conversations:groups_sync_teacher')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchProfilesAndConversations)
      .subscribe();
      
    return () => { 
      supabase.removeChannel(profilesSub); 
      supabase.removeChannel(groupsSub);
    };
  }, [currentUser]);

  // 3. Fetch Unread Counts
  const fetchUnreadCounts = async () => {
    if (!currentUser) return;
    
    const { data: myConvs } = await supabase.from('conversations')
      .select('id')
      .or(`participant1_email.eq.${currentUser.email},participant2_email.eq.${currentUser.email},participants.cs.["${currentUser.email}"]`);
      
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
        const grp = groups.find(g => g.id === msg.conversationId);
        const key = grp ? grp.id : msg.senderEmail;
        counts[key] = (counts[key] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
  };

  useEffect(() => {
    fetchUnreadCounts();
    const unreadSub = supabase.channel('public:messages:unread_sync_teacher')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.new.senderEmail !== currentUser?.email) {
          fetchUnreadCounts();
          fetchProfilesAndConversations();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(unreadSub); };
  }, [currentUser, groups]);
  
  useEffect(() => {
    if (onUnreadCountChange && profiles.length > 0) {
      let studentsCount = 0;
      let staffCount = 0;
      let teachersCount = 0;
      let groupsCount = 0;
      
      profiles.forEach(p => {
        const count = unreadCounts[p.email] || 0;
        if (count > 0) {
          if (p.role === 'student') studentsCount += count;
          if (p.role === 'teacher' || p.role === 'admin') staffCount += count;
          if (p.role === 'teacher') teachersCount += count;
        }
      });
      
      groups.forEach(g => {
        groupsCount += (unreadCounts[g.id] || 0);
      });
      
      const total = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
      
      onUnreadCountChange({
        total,
        students: studentsCount,
        staff: staffCount,
        teachers: teachersCount,
        groups: groupsCount,
        direct: total, 
        chat: total 
      });
    }
  }, [unreadCounts, profiles, groups, onUnreadCountChange]);

  // 4. Filter & Sort Contacts
  useEffect(() => {
    if (!profiles || !currentUser) return;
    
    let filtered = [];
    
    if (activeTab === 'group' || activeTab === 'groups') {
      filtered = groups.map(g => ({ ...g, isGroup: true }));
    } else {
      filtered = profiles.filter(p => p.email !== currentUser.email);
      if (activeTab === 'students') {
        filtered = filtered.filter(p => p.role === 'student');
      } else if (activeTab === 'staff' || activeTab === 'teachers') {
        filtered = filtered.filter(p => p.role === 'teacher' || p.role === 'admin');
      } else if (activeTab === 'class_view' || activeTab === 'classes') {
        const classStudents = filtered.filter(p => p.role === 'student');
        const classGroups = groups
          .filter(g => !selectedClass || g.class_name === selectedClass)
          .map(g => ({ ...g, isGroup: true }));
        filtered = [...classGroups, ...classStudents];
      }
    }
    
    if (searchQuery) {
      filtered = filtered.filter(p => (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) || (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase())));
    }

    // Sort by recent activity
    filtered.sort((a, b) => {
      const keyA = a.isGroup ? a.id : (a.email ? a.email.toLowerCase() : '');
      const keyB = b.isGroup ? b.id : (b.email ? b.email.toLowerCase() : '');
      const convA = keyA ? conversationsMap[keyA] : null;
      const convB = keyB ? conversationsMap[keyB] : null;
      const timeA = convA?.updatedAt ? new Date(convA.updatedAt).getTime() : 0;
      const timeB = convB?.updatedAt ? new Date(convB.updatedAt).getTime() : 0;
      return timeB - timeA;
    });
    
    setFilteredProfiles(filtered);

    if (filtered.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const targetEmail = params.get('email');
      const targetName = params.get('name');

      let target = null;
      if (targetEmail) {
        target = filtered.find(p => p.email?.toLowerCase() === targetEmail.toLowerCase());
      }
      if (!target && targetName) {
        target = filtered.find(p => p.name?.toLowerCase().includes(targetName.toLowerCase()));
      }

      setActiveContact(current => {
        if (target) return target;
        if (!current) return filtered[0];
        const exists = filtered.find(p => p.isGroup ? p.id === current.id : p.email === current.email);
        return exists ? current : filtered[0];
      });
    } else {
      setActiveContact(null);
    }
  }, [profiles, groups, conversationsMap, activeTab, searchQuery, currentUser, selectedClass]);

  // 5. Fetch or Create Conversation
  useEffect(() => {
    if (!activeContact || !currentUser) return;

    const fetchOrCreateConversation = async () => {
      if (activeContact.isGroup) {
        const { data } = await supabase.from('conversations').select('*').eq('id', activeContact.id).single();
        if (data) setCurrentConversation(data);
      } else {
        const { data, error } = await supabase.from('conversations')
          .select('*')
          .or(`and(participant1_email.eq.${currentUser.email},participant2_email.eq.${activeContact.email}),and(participant1_email.eq.${activeContact.email},participant2_email.eq.${currentUser.email})`)
          .maybeSingle();
          
        if (data) {
          setCurrentConversation(data);
        } else if (!error) {
          const { data: newConv, error: createErr } = await supabase.from('conversations')
            .insert({ participant1_email: currentUser.email, participant2_email: activeContact.email })
            .select().single();
          if (newConv) setCurrentConversation(newConv);
          if (createErr) console.error('Error creating conversation:', createErr);
        }
      }
    };
    fetchOrCreateConversation();
  }, [activeContact, currentUser]);

  // 6. Fetch Messages & Realtime Subscription + Typing Broadcast
  const fetchMessages = async () => {
    if (!currentConversation) return;
    const { data } = await supabase.from('messages')
      .select('*')
      .eq('conversationId', currentConversation.id)
      .order('createdAt', { ascending: true });
    
    if (data) {
      setMessages(data);
      setTimeout(() => scrollToBottom(false), 50);
    }
  };

  useEffect(() => {
    fetchMessages();
    setTypingUser(null);
    if (!currentConversation) return;
    
    const channelName = `public:messages:${currentConversation.id}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversationId=eq.${currentConversation.id}` }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
        setTimeout(() => scrollToBottom(true), 50);
        
        if (payload.new.senderEmail !== currentUser?.email) {
          supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id).then(() => fetchUnreadCounts());
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversationId=eq.${currentConversation.id}` }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversationId=eq.${currentConversation.id}` }, (payload) => {
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

  // Mark conversation as read when opened
  useEffect(() => {
    if (!currentConversation || !activeContact || !currentUser) return;
    const markAsRead = async () => {
      await supabase.from('messages')
        .update({ is_read: true })
        .eq('conversationId', currentConversation.id)
        .neq('senderEmail', currentUser.email)
        .eq('is_read', false);
        
      setUnreadCounts(prev => ({ ...prev, [activeContact.isGroup ? activeContact.id : activeContact.email]: 0 }));
      fetchUnreadCounts();
    };
    markAsRead();
  }, [currentConversation, activeContact, currentUser]);

  // Typing Input Handler
  const handleInputChange = (e) => {
    const val = e.target.value;
    setNewMessage(val);

    if (activeChannelRef.current && currentConversation?.id) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          senderEmail: currentUser.email,
          senderName: currentUser.name || 'Teacher',
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
              senderName: currentUser.name || 'Teacher',
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
    }
  };

  // Forward Message Handler (WhatsApp Style)
  const handleForwardMessage = async (msg, targetContacts) => {
    if (!msg || !targetContacts || targetContacts.length === 0) return;

    for (const target of targetContacts) {
      try {
        let convId = target.id;
        
        if (!target.isGroup) {
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
            senderName: currentUser.name || "Teacher",
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
    if ((!newMessage.trim() && !stagedImage?.blob) || !currentConversation || !currentUser || isSending || isUploading) return;
    
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
        senderName: currentUser.name,
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

      await supabase.from('conversations').update({ lastMessage: previewText, updatedAt: new Date() }).eq('id', currentConversation.id);
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

  // Create Group
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || selectedMembers.length === 0) {
      alert("Please enter a group name and select at least one student.");
      return;
    }
    
    const participants = [currentUser.email, ...selectedMembers];
    
    const { error } = await supabase.from('conversations').insert({
      name: newGroupName,
      type: 'group',
      participants: participants,
      class_name: selectedClass || null,
      lastMessage: 'Group created'
    });
    
    if (error) {
      alert("Error creating group: " + error.message);
    } else {
      setNewGroupName("");
      setSelectedMembers([]);
      setShowGroupModal(false);
      alert("Group created successfully!");
      fetchProfilesAndConversations();
    }
  };

  const toggleMemberSelection = (email) => {
    setSelectedMembers(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);
  };

  const pinnedMsg = currentConversation?.pinned_message_id 
    ? messages.find(m => m.id === currentConversation.pinned_message_id) 
    : null;

  const displayMessages = inChatSearchQuery.trim()
    ? messages.filter(m => m.text?.toLowerCase().includes(inChatSearchQuery.toLowerCase()))
    : messages;

  return (
    <div className="chat-interface-container" onClick={() => setActiveDropdownMsgId(null)}>
      {/* Left Pane */}
      <div className={`chat-sidebar ${activeContact ? 'hidden-mobile' : ''}`}>
        <div className="chat-sidebar-header">
          <div className="chat-search-wrapper">
            <Search size={16} className="chat-search-icon" />
            <input type="text" placeholder="Search contacts..." className="chat-search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          {isManager && (activeTab === 'class_view' || activeTab === 'classes') && (
            <button className="chat-action-btn" onClick={() => setShowGroupModal(true)} title="Create Group">
              <Users size={18} />
            </button>
          )}
        </div>
        
        <div className="chat-contacts-list">
          {filteredProfiles.length > 0 ? filteredProfiles.map(contact => {
            const key = contact.isGroup ? contact.id : contact.email;
            const unread = unreadCounts[key] || 0;
            const contactNameStr = contact.name || contact.group_name || 'Group';
            const hasColor = contact.isGroup && contactNameStr.includes('|');
            const bgColor = hasColor ? contactNameStr.split('|')[0] : 'var(--accent-purple)';
            const displayName = hasColor ? contactNameStr.split('|')[1] : contactNameStr;
            const isUserOnline = !contact.isGroup && isOnline(contact.email);
            const conv = conversationsMap[key];

            return (
              <div key={contact.id} className={`chat-contact-item ${activeContact?.id === contact.id ? 'active' : ''}`} onClick={() => setActiveContact(contact)}>
                <div className="chat-contact-avatar">
                  {contact.isGroup ? (
                    <div className="avatar-placeholder" style={{ background: bgColor }}><Users size={20} /></div>
                  ) : (
                    <div className="presence-avatar-wrapper">
                      <img 
                        src={contact.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=b6e3f4`} 
                        alt={displayName} 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=b6e3f4`;
                        }}
                      />
                      {isUserOnline && <span className="presence-dot" title="Online" />}
                    </div>
                  )}
                </div>
                <div className="chat-contact-info">
                  <div className="chat-contact-name-row">
                    <span className="chat-contact-name">{displayName}</span>
                    {conv?.updatedAt && (
                      <span className="chat-contact-time">{formatTimeAgo(conv.updatedAt)}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="chat-contact-snippet">
                      {conv?.lastMessage ? conv.lastMessage : (contact.isGroup ? `${contact.participants?.length || 0} members` : contact.email)}
                    </span>
                    {unread > 0 && <span className="unread-badge">{unread}</span>}
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="chat-empty-state">No contacts found.</div>
          )}
        </div>
      </div>
      
      {/* Right Pane */}
      <div className={`chat-main-area ${!activeContact ? 'hidden-mobile' : ''}`}>
        {activeContact ? (
          <>
            <div className="chat-main-header">
              <button className="chat-back-btn" onClick={() => setActiveContact(null)}><ArrowLeft size={20} /></button>
              <div className="chat-header-avatar">
                {activeContact.isGroup ? (
                   <div className="avatar-placeholder" style={{ background: (activeContact.name || activeContact.group_name || '').includes('|') ? (activeContact.name || activeContact.group_name).split('|')[0] : 'var(--accent-purple)' }}><Users size={20} /></div>
                ) : (
                  <div className="presence-avatar-wrapper">
                    <img 
                      src={activeContact.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(activeContact.name || 'User')}&backgroundColor=b6e3f4`} 
                      alt={activeContact.name} 
                    />
                    {isOnline(activeContact.email) && <span className="presence-dot" />}
                  </div>
                )}
              </div>
              <div className="chat-header-info">
                <h4>{activeContact.isGroup && (activeContact.name || activeContact.group_name || '').includes('|') ? (activeContact.name || activeContact.group_name).split('|')[1] : (activeContact.name || activeContact.group_name || 'User')}</h4>
                <span>
                  {activeContact.isGroup 
                    ? `Group Chat (${activeContact.participants?.length || 0} members)` 
                    : (isOnline(activeContact.email) ? <span style={{ color: '#10B981', fontWeight: 600 }}>● Active Now</span> : activeContact.email)}
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
                <div className="chat-messages-empty">Say hi to {activeContact.name}!</div>
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
                      {activeContact.isGroup && !isMe && (
                        <div style={{ marginRight: '8px', display: 'flex', alignItems: 'flex-end' }}>
                          {(() => {
                            const sender = profiles.find(p => p.email.toLowerCase() === (msg.senderEmail || '').toLowerCase());
                            const senderFallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(msg.senderName || 'User')}&backgroundColor=b6e3f4`;
                            return (
                              <img 
                                src={sender?.avatar_url || senderFallback} 
                                title={msg.senderName} 
                                alt={msg.senderName} 
                                style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} 
                                onError={(e) => { e.target.src = senderFallback; }}
                              />
                            );
                          })()}
                        </div>
                      )}

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
                              alt="Chat attachment" 
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
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
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
                placeholder={stagedImage ? "Add a caption..." : (stagedReply ? `Reply to ${stagedReply.senderName}...` : "Type a message...")} 
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
              <h3>Select a conversation</h3>
              <p>Choose a contact from the left menu to start messaging.</p>
            </div>
          </div>
        )}
      </div>

      {/* Group Creation Modal */}
      {showGroupModal && (
        <div className="chat-modal-overlay">
          <div className="chat-modal" style={{ maxWidth: '500px' }}>
            <h3>Create a New Group</h3>
            <p>Select students to assign to this group activity.</p>
            <form onSubmit={handleCreateGroup}>
              <input type="text" placeholder="Group Name (e.g., Team Alpha)" required value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
              
              <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '10px', margin: '15px 0' }}>
                {profiles.filter(p => p.role === 'student').map(student => (
                  <label key={student.email} style={{ display: 'flex', alignItems: 'center', padding: '8px', cursor: 'pointer', gap: '10px' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedMembers.includes(student.email)}
                      onChange={() => toggleMemberSelection(student.email)}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#fff' }}>{student.name}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{student.email}</span>
                    </div>
                  </label>
                ))}
              </div>
              
              <div className="chat-modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowGroupModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
