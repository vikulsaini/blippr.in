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
  const [searchOpen, setSearchOpen] = useState(false);
  const [showThreadsPromo, setShowThreadsPromo] = useState(true);
  const [isGeneralOpen, setIsGeneralOpen] = useState(true);
  const [isEventsOpen, setIsEventsOpen] = useState(true);
  const [isPersonalOpen, setIsPersonalOpen] = useState(true);

  const visibleChats = useMemo(() => {
    const scoped = chats.filter((chat) => {
      if (tab === 'vault') return chat.archived;
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

  // Collapsible Sakura Categories logic
  const generalChannels = useMemo(() => {
    const items = mockChannels.filter(c => c.category === 'general');
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [mockChannels, query]);

  const eventChannels = useMemo(() => {
    const items = mockChannels.filter(c => c.category === 'events');
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [mockChannels, query]);

  const personalChats = useMemo(() => {
    return visibleChats;
  }, [visibleChats]);

  const generalUnread = useMemo(() => generalChannels.reduce((sum, c) => sum + (c.unreadCount || 0), 0), [generalChannels]);
  const eventsUnread = useMemo(() => eventChannels.reduce((sum, c) => sum + (c.unreadCount || 0), 0), [eventChannels]);
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
          <div className="flex shrink-0 items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3">
              {me?.avatar ? (
                <img src={me.avatar} alt="" className="h-9 w-9 rounded-full border border-border-default object-cover shadow-sm" />
              ) : (
                <div className="grid h-9 w-9 place-items-center rounded-full bg-accent/10 font-bold text-accent text-sm">
                  BC
                </div>
              )}
              <div className="flex items-center gap-1">
                <h2 className="text-lg font-bold tracking-tight text-text-primary">Blippr Chat</h2>
                <ChevronDown size={15} className="text-text-muted mt-0.5" />
              </div>
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
        {showThreadsPromo && (
          <div className="flex items-center justify-between rounded-2xl border border-accent/20 bg-accent-tint p-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                <Mail size={18} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-text-primary">Threads</h4>
                <p className="text-[11px] text-text-muted truncate">You have unread design threads</p>
              </div>
            </div>
            <button
              onClick={() => setShowThreadsPromo(false)}
              className="rounded-full p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary transition shrink-0"
              aria-label="Dismiss threads"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {loading ? (
          <ChatSkeleton />
        ) : (
          <div className="space-y-4">
            {/* Category 1: General Lounges */}
            <div className="space-y-1">
              <button
                onClick={() => setIsGeneralOpen(!isGeneralOpen)}
                className="flex w-full items-center justify-between py-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted hover:text-text-primary transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  {isGeneralOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>General Lounges</span>
                </div>
                {generalUnread > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {generalUnread}
                  </span>
                )}
              </button>
              <AnimatePresence initial={false}>
                {isGeneralOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-1.5 pl-1.5 animate-collapse"
                  >
                    {generalChannels.map((channel) => (
                      <MockChannelRow
                        key={channel._id}
                        channel={channel}
                        typing={!!typingChats?.[channel._id]}
                        onOpen={() => onOpenChat(channel)}
                      />
                    ))}
                    {!loading && generalChannels.length === 0 && (
                      <p className="text-xs text-text-faint py-1 pl-4">No channels found</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Category 2: Interest Rooms */}
            <div className="space-y-1">
              <button
                onClick={() => setIsEventsOpen(!isEventsOpen)}
                className="flex w-full items-center justify-between py-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted hover:text-text-primary transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  {isEventsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Interest Rooms</span>
                </div>
                {eventsUnread > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {eventsUnread}
                  </span>
                )}
              </button>
              <AnimatePresence initial={false}>
                {isEventsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-1.5 pl-1.5 animate-collapse"
                  >
                    {eventChannels.map((channel) => (
                      <MockChannelRow
                        key={channel._id}
                        channel={channel}
                        typing={!!typingChats?.[channel._id]}
                        onOpen={() => onOpenChat(channel)}
                      />
                    ))}
                    {!loading && eventChannels.length === 0 && (
                      <p className="text-xs text-text-faint py-1 pl-4">No channels found</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Category 3: Direct Messages */}
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

function SwipeChatRow({ chat, currentUserId, selected, typing, displayName, other, onOpen, onProfile, onSelect, onSetChatPreference }) {
  const x = useMotionValue(0);
  const archiveOpacity = useTransform(x, [0, 80], [0.4, 1]);
  const archiveScale = useTransform(x, [0, 80], [0.9, 1.05]);
  const muteOpacity = useTransform(x, [-80, 0], [1, 0.4]);
  const muteScale = useTransform(x, [-80, 0], [1.05, 0.9]);

  function handleSwipeEnd(_, info) {
    if (info.offset.x > 86) {
      haptics.success();
      onSetChatPreference(chat, 'archive');
    } else if (info.offset.x < -86) {
      haptics.tap();
      onSetChatPreference(chat, 'mute');
    }
  }

  return (
    <motion.div
      variants={itemVariants}
      className="relative mb-1.5 overflow-hidden rounded-2xl bg-bg"
    >
      <motion.div
        style={{ opacity: archiveOpacity, scale: archiveScale }}
        className="absolute inset-y-0 left-0 flex items-center gap-2 pl-4 text-xs font-semibold text-accent"
      >
        <Archive size={17} />
        Archive
      </motion.div>
      <motion.div
        style={{ opacity: muteOpacity, scale: muteScale }}
        className="absolute inset-y-0 right-0 flex items-center gap-2 pr-4 text-xs font-semibold text-danger"
      >
        <BellOff size={17} />
        Mute
      </motion.div>
      <motion.article
        drag="x"
        style={{ x }}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDragEnd={handleSwipeEnd}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect();
        }}
        className={`interactive-card relative flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left md:px-3 ${chat.unreadCount ? 'ring-1 ring-accent/20' : ''} ${selected ? 'border-accent/20 bg-accent-tint' : ''}`}
      >
        <button
          className="relative"
          onClick={(event) => {
            event.stopPropagation();
            onProfile();
          }}
          aria-label={`View ${displayName || 'friend'} profile`}
        >
          {other?.avatar ? <img src={other.avatar} alt="" className="h-10 w-10 rounded-full border border-border-default object-cover shadow-card" /> : <div className="h-10 w-10 rounded-full border border-border-default bg-bg" />}
          {other?.isOnline && <span className="absolute bottom-0 right-0 status-dot online" />}
        </button>
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
          <div className="mt-1 flex items-center justify-between gap-3">
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

function MockChannelRow({ channel, typing, onOpen }) {
  return (
    <article
      onClick={onOpen}
      className="interactive-card relative flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left md:px-3"
    >
      <div className="relative shrink-0">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-light text-accent border border-border-default">
          <Hash size={18} />
        </div>
        {typing && <span className="absolute bottom-0 right-0 status-dot online" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate font-semibold text-text-primary text-sm">{channel.name}</p>
          <span className="text-[10px] text-text-faint font-medium">Channel</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-3">
          <p className={`truncate text-xs ${typing ? 'font-semibold text-accent' : channel.unreadCount ? 'font-semibold text-text-primary' : 'font-medium text-text-muted'}`}>
            {typing ? 'typing...' : channel.description}
          </p>
          {channel.unreadCount > 0 && (
            <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white badge-pulse">
              {channel.unreadCount}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
