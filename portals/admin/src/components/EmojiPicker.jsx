import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Smile, ThumbsUp, Heart, Sparkles, BookOpen, Coffee, Flame } from 'lucide-react';

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '🥹', '☺️', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝',
      '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔',
      '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
      '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔',
      '🫣', '🤭', '🥱', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧',
      '😮', '😲', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒',
      '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '🤖'
    ]
  },
  {
    id: 'gestures',
    name: 'Gestures & People',
    icon: '👋',
    emojis: [
      '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '✍️', '✋',
      '🤚', '🖐️', '🖖', '🫱', '🫲', '🫳', '🫴', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘',
      '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👋', '💪', '🦾', '🙏', '💅',
      '🤳', '💃', '🕺', '🧑‍🏫', '🧑‍🎓', '🧑‍💻', '🧑‍🔬', '👨‍🏫', '👩‍🏫', '👨‍🎓', '👩‍🎓', '🙋‍♂️', '🙋‍♀️', '🤷‍♂️', '🤷‍♀️'
    ]
  },
  {
    id: 'hearts',
    name: 'Hearts & Symbols',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞',
      '💓', '💗', '💖', '💘', '💝', '💟', '💯', '💢', '💥', '💫', '💦', '💨', '🔥',
      '⭐', '🌟', '✨', '⚡', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🎖️',
      '🎯', '🔔', '📢', '📣', '💬', '💭', '🗯️', '✔️', '✅', '❌', '⭕', '❓', '❗'
    ]
  },
  {
    id: 'school',
    name: 'Education & Study',
    icon: '📚',
    emojis: [
      '📚', '📖', '📕', '📗', '📘', '📙', '📓', '📔', '📒', '📝', '✏️', '🖊️', '🖋️',
      '🖌️', '🖍️', '📐', '📏', '🖇️', '📎', '📌', '📍', '✂️', '🔬', '🔭', '🧪', '🧫',
      '🧬', '💻', '🖥️', '📱', '💡', '🎓', '🎒', '🧭', '🎨', '🎬', '🎧', '🎤', '⚽',
      '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '♟️', '🎮', '🧩'
    ]
  },
  {
    id: 'food',
    name: 'Food & Nature',
    icon: '🍕',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑',
      '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯',
      '🥗', '🍿', '🍫', '🍬', '🍭', '☕', '🍵', '🧃', '🥤', '🌸', '🌺', '🌻', '🌹',
      '🌷', '🌼', '🌲', '🌳', '🌴', '🍀', '🍁', '🍂', '🌈', '☀️', '🌙', '🪐', '🌍'
    ]
  }
];

export default function EmojiPicker({ onSelectEmoji, onClose }) {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [search, setSearch] = useState('');
  const pickerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) {
      const cat = EMOJI_CATEGORIES.find(c => c.id === activeCategory);
      return cat ? cat.emojis : [];
    }
    const q = search.toLowerCase();
    // Search across all categories
    const all = [];
    EMOJI_CATEGORIES.forEach(cat => {
      cat.emojis.forEach(e => {
        if (!all.includes(e)) all.push(e);
      });
    });
    return all;
  }, [activeCategory, search]);

  return (
    <div className="whatsapp-emoji-picker-container" ref={pickerRef} onClick={(e) => e.stopPropagation()}>
      {/* Header Search Bar */}
      <div className="whatsapp-emoji-search-row">
        <Search size={14} className="whatsapp-emoji-search-icon" />
        <input
          type="text"
          placeholder="Search emojis..."
          className="whatsapp-emoji-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        {search && (
          <button type="button" className="whatsapp-emoji-clear-btn" onClick={() => setSearch('')}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* Emoji Grid */}
      <div className="whatsapp-emoji-grid-scroll">
        {filteredEmojis.length > 0 ? (
          <div className="whatsapp-emoji-grid">
            {filteredEmojis.map((emoji, index) => (
              <button
                key={index}
                type="button"
                className="whatsapp-emoji-cell"
                onClick={() => {
                  onSelectEmoji(emoji);
                }}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <div className="whatsapp-emoji-empty">No matching emojis</div>
        )}
      </div>

      {/* Category Bottom Tabs (WhatsApp style) */}
      {!search && (
        <div className="whatsapp-emoji-category-bar">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`whatsapp-emoji-cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
              title={cat.name}
            >
              <span>{cat.icon}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
