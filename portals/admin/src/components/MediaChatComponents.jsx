import React, { useState, useEffect, useRef } from 'react';
import { 
  ExternalLink, Globe, X, Download, Maximize2, Loader2, Pin, Reply, 
  Trash2, Check, CheckCheck, Copy, Forward, ChevronDown, CheckCircle2, Smile 
} from 'lucide-react';

// URL detection regex
export const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// WhatsApp's 6 standard reaction emojis (as in screenshot)
export const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export function extractFirstUrl(text) {
  if (!text) return null;
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

export function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function highlightText(text, query) {
  if (!query || !text) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="chat-highlight-search">{part}</mark>
    ) : part
  );
}

export function formatMessageWithLinks(text, query = '') {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (part.match(URL_REGEX)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-inline-link"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return query ? highlightText(part, query) : part;
  });
}

/**
 * WhatsApp-style Rich Link Preview Card
 */
export function LinkPreviewCard({ url }) {
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (!url) return;

    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace(/^www\./, '');

      let youtubeThumb = null;
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        let videoId = null;
        if (hostname.includes('youtu.be')) {
          videoId = parsed.pathname.slice(1);
        } else {
          videoId = parsed.searchParams.get('v');
        }
        if (videoId) {
          youtubeThumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
      }

      const defaultMeta = {
        domain: hostname,
        title: hostname.toUpperCase(),
        description: url,
        image: youtubeThumb,
        favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
        url: url
      };

      if (!isMounted) return;
      setMeta(defaultMeta);

      fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(4000) })
        .then(res => res.json())
        .then(data => {
          if (!isMounted || !data.contents) return;
          const parser = new DOMParser();
          const doc = parser.parseFromString(data.contents, 'text/html');

          const getOg = (property) =>
            doc.querySelector(`meta[property="${property}"]`)?.getAttribute('content') ||
            doc.querySelector(`meta[name="${property}"]`)?.getAttribute('content');

          const title = getOg('og:title') || getOg('twitter:title') || doc.title || defaultMeta.title;
          const description = getOg('og:description') || getOg('twitter:description') || '';
          const image = getOg('og:image') || getOg('twitter:image') || defaultMeta.image;

          setMeta({
            domain: hostname,
            title: title.trim(),
            description: description.trim(),
            image: image,
            favicon: defaultMeta.favicon,
            url: url
          });
        })
        .catch(() => {});

    } catch (e) {
      if (isMounted) {
        setMeta({ domain: 'Link', title: url, url: url });
      }
    }

    return () => { isMounted = false; };
  }, [url]);

  if (!meta) return null;

  return (
    <a
      href={meta.url}
      target="_blank"
      rel="noopener noreferrer"
      className="chat-link-preview-card"
      onClick={(e) => e.stopPropagation()}
    >
      {meta.image && (
        <div className="chat-link-preview-image">
          <img src={meta.image} alt={meta.title} onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
      )}
      <div className="chat-link-preview-body">
        <div className="chat-link-preview-domain">
          <img
            src={meta.favicon}
            alt=""
            className="chat-link-preview-favicon"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span>{meta.domain}</span>
          <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.7 }} />
        </div>
        <div className="chat-link-preview-title">{meta.title}</div>
        {meta.description && (
          <div className="chat-link-preview-desc">{meta.description}</div>
        )}
      </div>
    </a>
  );
}

/**
 * WhatsApp-style Hover Action Icons Beside Chat Bubble (Smiley Face + Options Chevron)
 */
export function WhatsAppHoverActions({ 
  isMe, 
  onReact, 
  onReply, 
  onPin, 
  isPinned, 
  onDelete, 
  onForward, 
  onCopy,
  showDropdown,
  setShowDropdown 
}) {
  const [showReactionPill, setShowReactionPill] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef(null);
  const menuBtnRef = useRef(null);
  const emojiBtnRef = useRef(null);

  const toggleDropdown = () => {
    if (!showDropdown && menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 260);
    }
    setShowDropdown(!showDropdown);
    setShowReactionPill(false);
  };

  const toggleReactionPill = () => {
    if (!showReactionPill && emojiBtnRef.current) {
      const rect = emojiBtnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 180);
    }
    setShowReactionPill(!showReactionPill);
    setShowDropdown(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
        setShowReactionPill(false);
      }
    };
    if (showDropdown || showReactionPill) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown, showReactionPill, setShowDropdown]);

  return (
    <div className={`chat-bubble-hover-actions ${isMe ? 'is-me' : 'is-them'}`} ref={containerRef} onClick={(e) => e.stopPropagation()}>
      {/* 1. Emoji Reaction Trigger Button (Smiley beside bubble) */}
      <div className="hover-action-btn-wrapper">
        <button
          ref={emojiBtnRef}
          type="button"
          className={`chat-hover-action-btn emoji-trigger ${showReactionPill ? 'active' : ''}`}
          onClick={toggleReactionPill}
          title="React with emoji"
        >
          <Smile size={16} />
        </button>

        {/* 6 Quick WhatsApp Emoji Reactions Popup */}
        {showReactionPill && (
          <div className={`chat-quick-reaction-popup ${isMe ? 'is-me' : 'is-them'} ${openUpward ? 'open-upward' : ''}`}>
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="chat-quick-emoji-btn"
                onClick={() => {
                  onReact(emoji);
                  setShowReactionPill(false);
                }}
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Menu Trigger Chevron Button */}
      <div className="hover-action-btn-wrapper">
        <button
          ref={menuBtnRef}
          type="button"
          className={`chat-hover-action-btn menu-trigger ${showDropdown ? 'active' : ''}`}
          onClick={toggleDropdown}
          title="More options"
        >
          <ChevronDown size={16} />
        </button>

        {/* WhatsApp Context Menu Dropdown */}
        {showDropdown && (
          <div className={`whatsapp-context-menu ${isMe ? 'is-me' : 'is-them'} ${openUpward ? 'open-upward' : ''}`}>
            <button
              type="button"
              className="whatsapp-menu-item"
              onClick={() => {
                onReply();
                setShowDropdown(false);
              }}
            >
              <Reply size={15} />
              <span>Reply</span>
            </button>

            {onCopy && (
              <button
                type="button"
                className="whatsapp-menu-item"
                onClick={() => {
                  onCopy();
                  setShowDropdown(false);
                }}
              >
                <Copy size={15} />
                <span>Copy</span>
              </button>
            )}

            {onForward && (
              <button
                type="button"
                className="whatsapp-menu-item"
                onClick={() => {
                  onForward();
                  setShowDropdown(false);
                }}
              >
                <Forward size={15} />
                <span>Forward</span>
              </button>
            )}

            <button
              type="button"
              className="whatsapp-menu-item"
              onClick={() => {
                onPin();
                setShowDropdown(false);
              }}
            >
              <Pin size={15} className={isPinned ? 'active-pin' : ''} />
              <span>{isPinned ? 'Unpin' : 'Pin'}</span>
            </button>

            {isMe && onDelete && (
              <button
                type="button"
                className="whatsapp-menu-item delete"
                onClick={() => {
                  onDelete();
                  setShowDropdown(false);
                }}
              >
                <Trash2 size={15} />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Keep backwards-compatible alias
export const WhatsAppMessageActionToolbar = WhatsAppHoverActions;

/**
 * WhatsApp-style Floating Reaction Badge at Bottom Corner of Bubble
 */
export function WhatsAppReactionBadge({ reactions, currentEmail, onToggleReaction }) {
  if (!reactions || typeof reactions !== 'object') return null;
  const entries = Object.entries(reactions).filter(([_, users]) => Array.isArray(users) && users.length > 0);
  if (entries.length === 0) return null;

  const totalCount = entries.reduce((acc, [_, users]) => acc + users.length, 0);
  const emojis = entries.map(([emoji]) => emoji);

  return (
    <div
      className="chat-reaction-badge-whatsapp"
      onClick={(e) => {
        e.stopPropagation();
        const userEntry = entries.find(([_, users]) => currentEmail && users.some(u => u.toLowerCase() === currentEmail.toLowerCase()));
        if (userEntry) {
          onToggleReaction(userEntry[0]);
        } else {
          onToggleReaction(entries[0][0]);
        }
      }}
      title={entries.map(([emoji, users]) => `${emoji} ${users.length}`).join(', ')}
    >
      <span className="reaction-emojis-row">
        {emojis.slice(0, 3).map((emoji, i) => (
          <span key={i} className="reaction-emoji-item">{emoji}</span>
        ))}
      </span>
      {totalCount > 1 && <span className="reaction-count-text">{totalCount}</span>}
    </div>
  );
}

/**
 * Quoted Message Preview inside a Chat Bubble
 */
export function QuotedMessageBubble({ replyToSender, replyToText, onScrollToOriginal }) {
  if (!replyToText && !replyToSender) return null;

  return (
    <div className="chat-quoted-message-box" onClick={onScrollToOriginal}>
      <div className="chat-quoted-sender">{replyToSender || 'User'}</div>
      <div className="chat-quoted-snippet">{replyToText || 'Attachment'}</div>
    </div>
  );
}

/**
 * WhatsApp-style Forwarded Tag above message text
 */
export function ForwardedMessageTag() {
  return (
    <div className="chat-forwarded-tag">
      <Forward size={12} />
      <span>Forwarded</span>
    </div>
  );
}

/**
 * WhatsApp-style Forward Modal
 */
export function ForwardMessageModal({ 
  message, 
  contacts, 
  onForward, 
  onClose 
}) {
  const [query, setQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [isSending, setIsSending] = useState(false);

  const filtered = contacts.filter(c => 
    (c.name && c.name.toLowerCase().includes(query.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(query.toLowerCase()))
  );

  const handleToggle = (contact) => {
    const key = contact.isGroup ? contact.id : contact.email;
    setSelectedContacts(prev => {
      const exists = prev.some(c => (c.isGroup ? c.id : c.email) === key);
      return exists 
        ? prev.filter(c => (c.isGroup ? c.id : c.email) !== key)
        : [...prev, contact];
    });
  };

  const handleSend = async () => {
    if (selectedContacts.length === 0 || isSending) return;
    setIsSending(true);
    try {
      await onForward(message, selectedContacts);
      onClose();
    } catch (err) {
      console.error("Failed to forward:", err);
      alert("Failed to forward message: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="whatsapp-forward-modal" onClick={(e) => e.stopPropagation()}>
        <div className="whatsapp-forward-header">
          <h3>Forward message to...</h3>
          <button type="button" className="chat-staged-reply-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Message Preview */}
        <div className="whatsapp-forward-preview">
          <div className="whatsapp-forward-preview-icon">
            <Forward size={16} />
          </div>
          <div className="whatsapp-forward-preview-body">
            <span className="whatsapp-forward-preview-sender">{message.senderName || 'Message'}</span>
            <span className="whatsapp-forward-preview-text">
              {message.attachment_type === 'image' ? '📷 Photo' : (message.text || 'Attachment')}
            </span>
          </div>
        </div>

        {/* Search Input */}
        <div className="whatsapp-forward-search">
          <input
            type="text"
            placeholder="Search contacts or groups..."
            className="whatsapp-forward-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {/* Contacts / Groups List */}
        <div className="whatsapp-forward-list">
          {filtered.length > 0 ? (
            filtered.map(contact => {
              const key = contact.isGroup ? contact.id : contact.email;
              const isSelected = selectedContacts.some(c => (c.isGroup ? c.id : c.email) === key);

              return (
                <div
                  key={key}
                  className={`whatsapp-forward-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleToggle(contact)}
                >
                  <div className="whatsapp-forward-avatar">
                    <img
                      src={contact.avatar_url || `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(contact.email || contact.name)}&backgroundColor=0a0f1d`}
                      alt={contact.name}
                    />
                  </div>
                  <div className="whatsapp-forward-info">
                    <div className="whatsapp-forward-name">{contact.name}</div>
                    <div className="whatsapp-forward-sub">{contact.isGroup ? `${contact.participants?.length || 0} members` : (contact.role || contact.email)}</div>
                  </div>
                  <div className={`whatsapp-forward-checkbox ${isSelected ? 'checked' : ''}`}>
                    {isSelected && <CheckCircle2 size={18} />}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="chat-empty-state">No matching contacts found.</div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="whatsapp-forward-footer">
          <span className="whatsapp-forward-count">
            {selectedContacts.length} selected
          </span>
          <button
            type="button"
            className="btn-primary whatsapp-forward-send-btn"
            disabled={selectedContacts.length === 0 || isSending}
            onClick={handleSend}
          >
            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Forward size={16} />}
            <span>Forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pinned Message Header Banner
 */
export function PinnedMessageBanner({ pinnedMessage, onScrollToPinned, onUnpin }) {
  if (!pinnedMessage) return null;

  return (
    <div className="chat-pinned-banner" onClick={onScrollToPinned}>
      <div className="chat-pinned-icon">
        <Pin size={15} />
      </div>
      <div className="chat-pinned-info">
        <span className="chat-pinned-label">Pinned Message</span>
        <span className="chat-pinned-text">
          {pinnedMessage.senderName ? `${pinnedMessage.senderName}: ` : ''}
          {pinnedMessage.text || 'Photo attachment'}
        </span>
      </div>
      {onUnpin && (
        <button
          type="button"
          className="chat-pinned-unpin-btn"
          onClick={(e) => { e.stopPropagation(); onUnpin(); }}
          title="Unpin message"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/**
 * Real-Time Typing Indicator Banner
 */
export function TypingIndicatorBanner({ typingUser }) {
  if (!typingUser) return null;

  return (
    <div className="chat-typing-indicator-banner">
      <span className="typing-text">{typingUser} is typing</span>
      <span className="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </span>
    </div>
  );
}

/**
 * Fullscreen Image Lightbox Modal
 */
export function ImageLightbox({ imageUrl, onClose }) {
  if (!imageUrl) return null;

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edtech_photo_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <div className="chat-image-lightbox-overlay" onClick={onClose}>
      <div className="chat-image-lightbox-actions" onClick={(e) => e.stopPropagation()}>
        <button className="chat-lightbox-btn" onClick={handleDownload} title="Download original image">
          <Download size={18} />
          <span>Save</span>
        </button>
        <button className="chat-lightbox-btn close" onClick={onClose} title="Close">
          <X size={20} />
        </button>
      </div>
      <div className="chat-image-lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img src={imageUrl} alt="Full view" className="chat-lightbox-image" />
      </div>
    </div>
  );
}
