import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Archive, BellOff, MessageCircle, Pin, Search, Star, Trash2, X } from 'lucide-react';
import { callPreview, getNickname, getOtherMember } from '../lib/chat.js';
import { haptics } from '../lib/haptics.js';
import { presenceText } from '../lib/presence.js';

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
  const activeChats = useMemo(() => chats.filter((chat) => !chat.archived), [chats]);
  const onlineFriendCount = useMemo(() => {
    const onlineIds = new Set();
    activeChats.forEach((chat) => {
      const other = getOtherMember(chat, currentUserId);
      if (other?.isOnline) onlineIds.add(other._id);
    });
    return onlineIds.size;
  }, [activeChats, currentUserId]);

  return (
    <section className="flex min-h-0 flex-1 flex-col px-2 pt-2 md:px-4 md:pt-3">
      <div className="sticky top-0 z-10 -mx-3 bg-ink/90 px-3 pb-3 backdrop-blur-xl md:-mx-4 md:px-4">
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
            <div>
              <h2 className="bg-gradient-to-r from-white via-cyan-100 to-mint bg-clip-text text-2xl font-bold text-transparent">Chats</h2>
              <p className="text-sm font-medium text-slate-300/85">
                {activeChats.length} friends, {onlineFriendCount} online now
                {chats.some((chat) => chat.archived) ? `, ${chats.filter((chat) => chat.archived).length} archived` : ''}
              </p>
            </div>
            <span className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
              {onlineFriendCount} online
            </span>
          </div>
        )}

        {!selectedChats.size && (
          <>
            <div className="mb-3 grid grid-cols-3 gap-1 rounded-[16px] border border-cyan-200/10 bg-slate-950/35 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(6,182,212,0.06)]">
              <TabButton active={tab === 'chats'} onClick={() => setTab('chats')} label="Chats" />
              <TabButton active={tab === 'favorites'} onClick={() => setTab('favorites')} label="Favorites" />
              <TabButton active={tab === 'archived'} onClick={() => setTab('archived')} label="Archived" />
            </div>
            <label className="flex shrink-0 items-center gap-3 rounded-[16px] border border-cyan-200/12 bg-black/24 px-4 py-3 shadow-[inset_0_2px_8px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.07)]">
              <Search size={18} className="text-cyan-200/80" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-100 outline-none"
                placeholder="Search friends or messages"
              />
            </label>
          </>
        )}
      </div>

      <div data-chat-feed className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-20 md:pb-3">
        {loading ? (
          <ChatSkeleton />
        ) : (
          visibleChats.map((chat) => {
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
          })
        )}
        {!loading && !chats.length && (
          <EmptyState
            icon={MessageCircle}
            title="No friends yet"
            text="Discover people nearby and send a request to start chatting."
            action="Find people"
            onAction={onFindPeople}
          />
        )}
        {!loading && chats.length > 0 && !visibleChats.length && (
          <EmptyState
            icon={tab === 'archived' ? Archive : Search}
            title={tab === 'archived' ? 'No archived chats' : 'No chats found'}
            text={tab === 'favorites' ? 'Star close friends to see them here.' : 'Try another name or message.'}
            action={tab === 'archived' ? 'Back to chats' : 'Clear search'}
            onAction={() => (tab === 'archived' ? setTab('chats') : setQuery(''))}
          />
        )}
      </div>
    </section>
  );
}

function SelectionToolbar({ count, onClear, onPreference, onDelete }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="accent-card rounded-[20px] p-2">
      <div className="flex items-center gap-2">
        <button onClick={onClear} className="btn-icon h-10 w-10" aria-label="Cancel selection"><X size={18} /></button>
        <motion.p key={count} initial={{ scale: 0.86 }} animate={{ scale: 1 }} className="min-w-0 flex-1 font-semibold">{count} selected</motion.p>
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
    <button onClick={onClick} className={`grid min-w-[3.1rem] justify-items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[10px] font-semibold ${danger ? 'bg-coral/12 text-coral' : 'bg-white/8 text-white/70'}`}>
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

function SwipeChatRow({ chat, currentUserId, selected, typing, displayName, other, onOpen, onProfile, onSelect, onSetChatPreference }) {
  const xRef = useRef(0);

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
    <div className="relative mb-1.5 overflow-hidden rounded-[20px] border border-cyan-200/8 bg-black/10">
      <div className="absolute inset-y-0 left-0 flex items-center gap-2 pl-3 text-xs font-semibold text-mint">
        <Archive size={17} />
        Archive
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-3 text-xs font-semibold text-rose/80">
        <BellOff size={17} />
        Mute
      </div>
      <motion.article
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDrag={(_, info) => { xRef.current = info.offset.x; }}
        onDragEnd={handleSwipeEnd}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect();
        }}
        className={`interactive-card relative flex w-full items-center gap-3 rounded-[20px] border border-white/6 bg-slate-950/38 px-2.5 py-2.5 text-left shadow-[0_12px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur md:px-3 ${chat.unreadCount ? 'border-cyan-200/14 bg-cyan-300/7' : ''} ${selected ? 'border-mint/30 bg-mint/12' : ''}`}
      >
        <button
          className="relative"
          onClick={(event) => {
            event.stopPropagation();
            onProfile();
          }}
          aria-label={`View ${displayName || 'friend'} profile`}
        >
          {other?.avatar ? <img src={other.avatar} alt="" className="h-10 w-10 rounded-full border border-cyan-100/14 object-cover shadow-[0_10px_26px_rgba(0,0,0,0.30)]" /> : <div className="h-10 w-10 rounded-full border border-cyan-100/14 bg-white/8" />}
          {other?.isOnline && <span className="live-dot absolute ml-7 mt-7 h-2.5 w-2.5 rounded-full bg-mint text-mint" />}
        </button>
        <ChatRowButton onOpen={onOpen} onLongSelect={onSelect}>
          <div className="flex items-center justify-between gap-3">
            <p className="truncate font-semibold text-white">{displayName || 'Friend'}</p>
            <span className="flex items-center gap-1">
              {chat.archived && <Archive size={12} className="text-white/35" />}
              {chat.pinned && <Pin size={12} className="text-sky" />}
              {chat.starred && <Star size={12} className="fill-gold text-gold" />}
              {chat.muted && <BellOff size={12} className="text-white/35" />}
              <span className={`h-2 w-2 rounded-full ${other?.isOnline ? 'bg-mint shadow-[0_0_14px_rgba(61,214,198,0.55)]' : 'bg-white/25'}`} />
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className={`truncate text-xs ${typing ? 'font-semibold text-mint' : chat.unreadCount ? 'font-semibold text-slate-100' : 'font-medium text-slate-300/75'}`}>
              {typing ? 'typing...' : chat.lastMessage?.text || callPreview(chat.lastCall, currentUserId) || presenceText(other)}
            </p>
            {chat.unreadCount > 0 && (
              <span className="shrink-0 rounded-full bg-gradient-to-r from-mint to-sky px-2 py-0.5 text-[10px] font-semibold text-ink">
                {chat.unreadCount}
              </span>
            )}
          </div>
        </ChatRowButton>
      </motion.article>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="space-y-1 pt-1">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex animate-pulse items-center gap-3 border-b border-white/8 px-1 py-3">
          <div className="h-10 w-10 rounded-full bg-white/8" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-32 rounded-full bg-white/10" />
            <div className="h-2.5 w-48 rounded-full bg-white/7" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text, action, onAction }) {
  return (
    <div className="surface mt-4 rounded-[20px] p-6 text-center">
      <span className="tone-ring mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/8 text-mint"><Icon size={22} /></span>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-white/55">{text}</p>
      <button onClick={onAction} className="btn-primary mt-4 rounded-full px-4 py-2 text-sm font-semibold">{action}</button>
    </div>
  );
}

function TabButton({ active, label, onClick }) {
  return (
    <button onClick={onClick} className={`rounded-[12px] py-2 text-xs font-semibold ${active ? 'btn-primary' : 'text-white/55'}`}>
      {label}
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
      className="min-w-0 flex-1 text-left"
    >
      {children}
    </button>
  );
}
