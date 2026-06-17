import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Archive, BellOff, MessageCircle, Pin, Search, Shuffle, Star, Trash2, X } from 'lucide-react';
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
  currentUserId,
  query,
  setQuery,
  typingChatId,
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
  const visibleChats = useMemo(() => {
    const scoped = chats.filter((chat) => {
      if (tab === 'archived') return chat.archived;
      if (tab === 'favorites') return chat.starred && !chat.archived;
      return !chat.archived;
    });
    return filterChats(scoped, query, currentUserId);
  }, [chats, currentUserId, query, tab]);
  const archivedCount = useMemo(() => chats.filter((chat) => chat.archived).length, [chats]);

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
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <div className="pl-4">
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">Chats</h2>
              {archivedCount > 0 && <p className="text-sm font-medium text-text-muted">{archivedCount} archived chats</p>}
            </div>
          </div>
        )}

        {!selectedChats.size && (
          <div className="px-4">
            {/* Filter tabs with accent bottom indicator */}
            <div className="mb-3 grid grid-cols-3 gap-1 rounded-2xl border border-border-default bg-bg p-1">
              <TabButton active={tab === 'chats'} onClick={() => setTab('chats')} label="Chats" />
              <TabButton active={tab === 'favorites'} onClick={() => setTab('favorites')} label="Favorites" />
              <TabButton active={tab === 'archived'} onClick={() => setTab('archived')} label="Archived" />
            </div>
            <label className="flex shrink-0 items-center gap-3 rounded-2xl border border-border-default bg-surface px-4 py-3 shadow-card transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
              <Search size={18} className="text-accent" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-faint"
                placeholder="Search friends or messages"
              />
            </label>
          </div>
        )}
      </div>

      <div data-chat-feed className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24 md:pb-3 scrollbar-thin">
        {/* Mobile Pull-to-Refresh Gesture Hint */}
        <div className="flex justify-center py-2 text-[10px] font-semibold text-text-faint md:hidden opacity-70">
          <span>↓ Pull down to refresh feeds</span>
        </div>
        {loading ? (
          <ChatSkeleton />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-1"
          >
            {visibleChats.map((chat) => {
              const other = getOtherMember(chat, currentUserId);
              const displayName = getNickname(chat, currentUserId, other);
              return (
                <SwipeChatRow
                  key={chat._id}
                  chat={chat}
                  selected={selectedChats.has(chat._id)}
                  currentUserId={currentUserId}
                  typing={typingChatId === chat._id}
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
          </motion.div>
        )}
        {!loading && !chats.length && (
          <div className="space-y-4">
            <EmptyState
              icon={MessageCircle}
              title="No Chats Yet"
              text="Start a random chat to make your first friend."
              action="Start Random Matching"
              onAction={onFindPeople}
            />
            <div className="surface-card rounded-3xl p-5 text-left space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">How Blippr Works</h3>
              <ul className="space-y-3 text-xs leading-relaxed text-text-secondary">
                <li className="flex items-start gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-accent font-bold">1</span>
                  <div>
                    <p className="font-semibold text-text-primary">Start Matching</p>
                    <p className="text-text-muted">Go to Random Chat to meet live online strangers instantly via text or video.</p>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-accent font-bold">2</span>
                  <div>
                    <p className="font-semibold text-text-primary">Find & Connect</p>
                    <p className="text-text-muted">Search for people by username or name in the Find section to add them as friends.</p>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-accent font-bold">3</span>
                  <div>
                    <p className="font-semibold text-text-primary">Complete Your Profile</p>
                    <p className="text-text-muted">Add an avatar and bio to make your profile stand out and match with better people.</p>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-accent font-bold">4</span>
                  <div>
                    <p className="font-semibold text-text-primary">Safe & Filtered</p>
                    <p className="text-text-muted">Add safety filters and block words in Settings to control what content you receive.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        )}
        {!loading && chats.length > 0 && !visibleChats.length && (
          <EmptyState
            icon={tab === 'archived' ? Archive : Search}
            title={tab === 'archived' ? 'No Archived Chats' : 'No Chats Found'}
            text={tab === 'favorites' ? 'Star close friends to see them here.' : 'Try another name or message.'}
            action={tab === 'archived' ? 'Back to Chats' : 'Clear Search'}
            onAction={() => (tab === 'archived' ? setTab('chats') : setQuery(''))}
          />
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
