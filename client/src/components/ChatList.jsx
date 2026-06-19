import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Archive, BellOff, MessageCircle, Pin, Search, Shuffle, Star, Trash2, X, Users, LockKeyhole, Hash, ChevronDown, ChevronRight, Mail } from 'lucide-react';
import { api } from '../lib/api.js';
import { callPreview, getNickname, getOtherMember } from '../lib/chat.js';
import { haptics } from '../lib/haptics.js';
import { presenceText } from '../lib/presence.js';

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.04
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 350,
      damping: 28
    }
  }
};

export default function ChatList({
  chats,
  mockChannels = [],
  me,
  currentUserId,
  query,
  setQuery,
  typingChats = {},
  selectedChats,
  onClearSelection,
  onPreference,
  onDeleteSelected,
  onSetChatPreference,
  onOpenChat,
  onToggleSelect,
  onOpenProfile,
  onFindPeople,
  loading = false
}) {
  const [tab, setTab] = useState('chats');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showThreadsPromo, setShowThreadsPromo] = useState(true);
  const [isGeneralOpen, setIsGeneralOpen] = useState(true);
  const [isEventsOpen, setIsEventsOpen] = useState(true);
  const [isPersonalOpen, setIsPersonalOpen] = useState(true);

  const visibleChats = useMemo(() => {
    const scoped = chats.filter((chat) => {
      if (tab === 'vault' || tab === 'archived') return chat.archived;
      if (tab === 'favorites') return chat.starred && !chat.archived;
      return !chat.archived;
    });
    return filterChats(scoped, query, currentUserId);
  }, [chats, currentUserId, query, tab]);

  const archivedCount = useMemo(() => chats.filter((chat) => chat.archived).length, [chats]);

  useEffect(() => {
    if (query.trim().length < 3) return;
    const timer = setTimeout(async () => {
      try {
        const { valid } = await api('/api/users/me/vault/verify', {
          method: 'POST',
          body: JSON.stringify({ password: query.trim() })
        });
        if (valid) {
          setTab('vault');
          setQuery('');
          haptics.success();
        }
      } catch (e) {
        // ignore
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const personalChats = useMemo(() => {
    return visibleChats;
  }, [visibleChats]);

  const personalUnread = useMemo(() => personalChats.reduce((sum, c) => sum + (c.unreadCount || 0), 0), [personalChats]);

  return (
    <section className="flex min-h-0 flex-1 flex-col px-2 pt-2 md:px-4 md:pt-3">
      <div className="sticky top-0 z-10 -mx-3 bg-surface/90 px-3 pb-3 backdrop-blur-xl md:-mx-4 md:px-4">
        {selectedChats.size ? (
          <SelectionToolbar
            count={selectedChats.size}
            onClear={onClearSelection}
            onPreference={(kind) => {
              haptics.success();
              onPreference(kind);
            }}
            onDelete={onDeleteSelected}
          />
        ) : (
          <div className="flex shrink-0 items-center justify-between px-4 py-2 relative">
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 focus:outline-none hover:opacity-80 transition cursor-pointer"
              >
                <h2 className="text-lg font-bold tracking-tight text-text-primary">
                  {tab === 'archived' ? 'Archived Chats' : 'Blippr Chat'}
                </h2>
                <ChevronDown size={15} className="text-text-muted mt-0.5" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute left-0 mt-2 w-48 rounded-2xl border border-border-default bg-surface p-1 shadow-elevated z-50 animate-fadeIn">
                    <button
                      onClick={() => {
                        setTab('chats');
                        setMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${tab === 'chats' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-surface-hover'}`}
                    >
                      Active Chats
                    </button>
                    <button
                      onClick={() => {
                        setTab('archived');
                        setMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${tab === 'archived' ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-surface-hover'}`}
                    >
                      Archived Chats
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="grid h-9 w-9 place-items-center rounded-full bg-bg hover:bg-surface-hover text-text-secondary transition active:scale-95 cursor-pointer"
              aria-label="Toggle Search"
            >
              <Search size={18} />
            </button>
          </div>
        )}

        {!selectedChats.size && (
          <div className="px-4">
            {tab === 'vault' && (
              <div className="mb-3 flex items-center justify-between rounded-2xl border border-accent bg-accent/10 px-4 py-2 text-accent">
                <span className="font-semibold text-sm">Hidden Vault Unlocked</span>
                <button onClick={() => setTab('chats')} className="grid h-8 w-8 place-items-center rounded-full text-accent bg-accent/20 cursor-pointer"><LockKeyhole size={16}/></button>
              </div>
            )}
            {(searchOpen || query) && (
              <label className="search-container mt-2">
                <Search size={18} className="text-accent shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search channels, friends or messages"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="p-1 rounded-full text-text-muted hover:bg-surface-hover">
                    <X size={14} />
                  </button>
                )}
              </label>
            )}
          </div>
        )}
      </div>

      <div data-chat-feed className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24 md:pb-3 scrollbar-thin px-4 space-y-4">


        {loading ? (
          <ChatSkeleton />
        ) : (
          <div className="space-y-4">
            {/* Category: Direct Messages */}
            <div className="space-y-1">
              <button
                onClick={() => setIsPersonalOpen(!isPersonalOpen)}
                className="flex w-full items-center justify-between py-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted hover:text-text-primary transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  {isPersonalOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Direct Messages</span>
                </div>
                {personalUnread > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-white badge-pulse">
                    {personalUnread}
                  </span>
                )}
              </button>
              <AnimatePresence initial={false}>
                {isPersonalOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-1.5 pl-1.5 animate-collapse"
                  >
                    {personalChats.map((chat) => {
                      const other = getOtherMember(chat, currentUserId);
                      const displayName = getNickname(chat, currentUserId, other);
                      return (
                        <SwipeChatRow
                          key={chat._id}
                          chat={chat}
                          selected={selectedChats.has(chat._id)}
                          currentUserId={currentUserId}
                          typing={!!typingChats?.[chat._id]}
                          displayName={displayName}
                          other={other}
                          onOpen={() => onOpenChat(chat)}
                          onProfile={() => other && onOpenProfile(other, chat)}
                          onSelect={() => {
                            haptics.select();
                            onToggleSelect(chat._id);
                          }}
                          onPreference={onPreference}
                          onSetChatPreference={onSetChatPreference}
                        />
                      );
                    })}
                    {!loading && personalChats.length === 0 && (
                      <div className="py-2 text-center">
                        <p className="text-xs text-text-muted">No personal messages yet.</p>
                        <button onClick={onFindPeople} className="btn-secondary mt-2 px-3 py-1.5 text-xs rounded-full font-semibold">Start Matching</button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SelectionToolbar({ count, onClear, onPreference, onDelete }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="elevated-card rounded-3xl p-2">
      <div className="flex items-center gap-2">
        <button onClick={onClear} className="btn-icon h-10 w-10" aria-label="Cancel selection"><X size={18} /></button>
        <motion.p key={count} initial={{ scale: 0.86 }} animate={{ scale: 1 }} className="min-w-0 flex-1 font-semibold text-text-primary">{count} selected</motion.p>
        <ToolbarButton icon={Archive} label="Archive" onClick={() => onPreference('archive')} />
        <ToolbarButton icon={Pin} label="Pin" onClick={() => onPreference('pin')} />
        <ToolbarButton icon={Star} label="Favorite" onClick={() => onPreference('star')} />
        <ToolbarButton icon={BellOff} label="Mute" onClick={() => onPreference('mute')} />
        <ToolbarButton icon={Trash2} label="Delete" onClick={onDelete} danger />
      </div>
    </motion.div>
  );
}

function ToolbarButton({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button onClick={onClick} className={`grid min-w-[3.1rem] cursor-pointer justify-items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[10px] font-semibold transition active:scale-[0.96] ${danger ? 'bg-danger/8 text-danger hover:bg-danger/12' : 'bg-accent/8 text-accent hover:bg-accent/12'}`}>
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

function SwipeChatRow({ chat, currentUserId, selected, typing, displayName, other, onOpen, onSelect, onSetChatPreference }) {
  const x = useMotionValue(0);

  // Archive (Swipe Right): x goes from 0 to positive
  const archiveBg = useTransform(x, [0, 120], ['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 1)']);
  const archiveColor = useTransform(x, [0, 120], ['rgba(52, 211, 153, 1)', 'rgba(255, 255, 255, 1)']);
  const archiveOpacity = useTransform(x, [0, 20, 120], [0, 0.4, 1]);
  const archiveScale = useTransform(x, [0, 120, 180], [0.85, 1, 1.12]);

  // Mute (Swipe Left): x goes from 0 to negative
  const muteBg = useTransform(x, [-120, 0], ['rgba(245, 158, 11, 1)', 'rgba(245, 158, 11, 0.1)']);
  const muteColor = useTransform(x, [-120, 0], ['rgba(255, 255, 255, 1)', 'rgba(251, 191, 36, 1)']);
  const muteOpacity = useTransform(x, [-120, -20, 0], [1, 0.4, 0]);
  const muteScale = useTransform(x, [-180, -120, 0], [1.12, 1, 0.85]);

  function handleSwipeEnd(_, info) {
    const offset = info.offset.x;
    if (offset > 120) {
      haptics.success();
      onSetChatPreference(chat, 'archive');
    } else if (offset < -120) {
      haptics.tap();
      onSetChatPreference(chat, 'mute');
    }
  }

  return (
    <motion.div
      variants={itemVariants}
      className="relative mb-1.5 overflow-hidden rounded-2xl bg-bg"
    >
      {/* Archive Slide Action Background */}
      <motion.div
        style={{
          opacity: archiveOpacity,
          backgroundColor: archiveBg,
          color: archiveColor
        }}
        className="absolute inset-y-0 left-0 w-1/2 flex items-center justify-start pl-4 gap-2 text-xs font-bold rounded-l-2xl"
      >
        <motion.div
          style={{ scale: archiveScale }}
          className="flex items-center gap-2"
        >
          <Archive size={17} />
          <span>Archive</span>
        </motion.div>
      </motion.div>

      {/* Mute Slide Action Background */}
      <motion.div
        style={{
          opacity: muteOpacity,
          backgroundColor: muteBg,
          color: muteColor
        }}
        className="absolute inset-y-0 right-0 w-1/2 flex items-center justify-end pr-4 gap-2 text-xs font-bold rounded-r-2xl"
      >
        <motion.div
          style={{ scale: muteScale }}
          className="flex items-center gap-2"
        >
          <BellOff size={17} />
          <span>Mute</span>
        </motion.div>
      </motion.div>

      <motion.article
        drag="x"
        style={{ x }}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={1}
        dragMomentum={false}
        onDragEnd={handleSwipeEnd}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect();
        }}
        className={`interactive-card relative flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left ${chat.unreadCount ? 'ring-1 ring-accent/20' : ''} ${selected ? 'border-accent/20 bg-accent-tint' : ''}`}
      >
        <ChatRowButton onOpen={onOpen} onLongSelect={onSelect}>
          <div className="flex items-center justify-between gap-3">
            <p className="truncate font-semibold text-text-primary">{displayName || 'Friend'}</p>
            <span className="flex items-center gap-1">
              {chat.archived && <Archive size={12} className="text-text-faint" />}
              {chat.pinned && <Pin size={12} className="text-accent" />}
              {chat.starred && <Star size={12} className="fill-gold text-gold" />}
              {chat.muted && <BellOff size={12} className="text-text-faint" />}
              <span className={`status-dot ${other?.isOnline ? 'online' : 'offline'}`} />
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p className={`truncate text-xs ${typing ? 'font-semibold text-accent' : chat.unreadCount ? 'font-semibold text-text-primary' : 'font-medium text-text-muted'}`}>
              {typing ? 'typing...' : chat.lastMessage?.text || callPreview(chat.lastCall, currentUserId) || presenceText(other)}
            </p>
            {chat.unreadCount > 0 && (
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white badge-pulse">
                {chat.unreadCount}
              </span>
            )}
          </div>
        </ChatRowButton>
      </motion.article>
    </motion.div>
  );
}

function ChatSkeleton() {
  return (
    <div className="space-y-2 pt-1">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-1 py-3">
          <div className="h-10 w-10 rounded-full skeleton" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-32 rounded-full skeleton" />
            <div className="h-2.5 w-48 rounded-full skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text, action, onAction }) {
  return (
    <div className="surface-card mt-4 rounded-3xl p-6 text-center">
      <span className="tone-ring mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent"><Icon size={22} /></span>
      <p className="mt-3 font-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-sm text-text-muted">{text}</p>
      <button onClick={onAction} className="btn-primary mt-4 rounded-full px-4 py-2 text-sm font-semibold">{action}</button>
    </div>
  );
}

function TabButton({ active, label, onClick }) {
  return (
    <button onClick={onClick} className={`relative cursor-pointer rounded-xl py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.96] ${active ? 'bg-surface text-text-primary shadow-card' : 'text-text-muted hover:text-text-primary'}`}>
      {label}
      <span className={`absolute inset-x-4 bottom-1 h-0.5 rounded-full transition-all duration-300 ${active ? 'bg-accent opacity-100' : 'bg-transparent opacity-0'}`} />
    </button>
  );
}

function filterChats(chats, query, currentUserId) {
  const needle = query.trim().toLowerCase();
  if (!needle) return chats;
  return chats.filter((chat) => {
    const other = getOtherMember(chat, currentUserId);
    const displayName = getNickname(chat, currentUserId, other);
    const value = `${displayName} ${other?.name || ''} ${other?.username || ''} ${chat.lastMessage?.text || ''} ${callPreview(chat.lastCall, currentUserId)}`.toLowerCase();
    return value.includes(needle);
  });
}

function ChatRowButton({ children, onOpen, onLongSelect }) {
  const timerRef = useRef(null);
  const longPressRef = useRef(false);
  const pointerRef = useRef(null);

  function start(event) {
    clearTimeout(timerRef.current);
    longPressRef.current = false;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    timerRef.current = setTimeout(() => {
      longPressRef.current = true;
      onLongSelect();
    }, 420);
  }

  function move(event) {
    const startPoint = pointerRef.current;
    if (!startPoint) return;
    const moved = Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y);
    if (moved > 10) clear();
  }

  function clear() {
    clearTimeout(timerRef.current);
    pointerRef.current = null;
  }

  function click(event) {
    if (longPressRef.current) {
      event.preventDefault();
      event.stopPropagation();
      longPressRef.current = false;
      return;
    }
    onOpen();
  }

  return (
    <button
      onClick={click}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      className="min-w-0 flex-1 cursor-pointer text-left"
    >
      {children}
    </button>
  );
}


