import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { dropdownSlide } from '../lib/motion.js';
import { Archive, Bell, BellOff, MessageCircle, Pin, Search, Shuffle, Star, Trash2, X, Users, LockKeyhole, Hash, ChevronDown, ChevronRight, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { callPreview, getNickname, getOtherMember } from '../lib/chat.js';
import { haptics } from '../lib/haptics.js';
import { presenceText } from '../lib/presence.js';
import NotificationBell from './NotificationBell.jsx';

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.04
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10, height: 'auto' },
  show: {
    opacity: 1,
    y: 0,
    height: 'auto',
    transition: {
      type: 'spring',
      stiffness: 350,
      damping: 28
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    height: 0,
    marginBottom: 0,
    transition: {
      duration: 0.2
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
  loading = false,
  hasMoreActive = false,
  hasMoreArchived = false,
  loadingMore = false,
  onLoadMore
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('chats');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showThreadsPromo, setShowThreadsPromo] = useState(true);
  const [isGeneralOpen, setIsGeneralOpen] = useState(true);
  const [isEventsOpen, setIsEventsOpen] = useState(true);
  const [isPersonalOpen, setIsPersonalOpen] = useState(true);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      const isArchivedTab = tab === 'archived';
      const hasMore = isArchivedTab ? hasMoreArchived : hasMoreActive;
      if (hasMore && !loadingMore && onLoadMore) {
        onLoadMore(isArchivedTab);
      }
    }
  };

  const visibleChats = useMemo(() => {
    const scoped = chats.filter((chat) => {
      if (tab === 'vault' || tab === 'archived') return chat.archived;
      if (tab === 'favorites') return chat.starred && !chat.archived;
      return !chat.archived;
    });
    return filterChats(scoped, query, currentUserId);
  }, [chats, currentUserId, query, tab]);

  const archivedCount = useMemo(() => chats.filter((chat) => chat.archived).length, [chats]);

  const activeFriends = useMemo(() => {
    return chats
      .map((chat) => {
        const other = getOtherMember(chat, currentUserId);
        return other ? { ...other, chat } : null;
      })
      .filter((item) => item && item.isOnline);
  }, [chats, currentUserId]);

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
      <div className="sticky top-0 z-10 -mx-3 bg-bg/70 px-3 pb-3 backdrop-blur-xl md:-mx-4 md:px-4">
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
            <div className="flex items-center gap-3">
              <div 
                onClick={() => navigate('/app/profile')} 
                className="w-8 h-8 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center cursor-pointer hover:opacity-90 active:scale-95 transition shrink-0"
              >
                {me?.avatar ? (
                  <img className="w-full h-full object-cover" src={me.avatar} alt="" />
                ) : (
                  <div className="text-[10px] font-black text-white">ME</div>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-1.5 focus:outline-none hover:opacity-80 transition cursor-pointer"
                >
                  <h2 className="font-display-lg text-lg font-black text-primary tracking-tighter">
                    {tab === 'archived' ? 'Archived' : 'Blippr'}
                  </h2>
                  <ChevronDown size={14} className="text-primary mt-0.5" />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <motion.div
                        variants={dropdownSlide}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="absolute left-0 mt-2 w-48 rounded-2xl border border-white/10 bg-surface-container p-1 shadow-elevated z-50 origin-top-left"
                      >
                        <button
                          onClick={() => {
                            setTab('chats');
                            setMenuOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${tab === 'chats' ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-white/5'}`}
                        >
                          Active Chats
                        </button>
                        <button
                          onClick={() => {
                            setTab('archived');
                            setMenuOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${tab === 'archived' ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-white/5'}`}
                        >
                          Archived Chats
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="md:hidden flex items-center">
                <NotificationBell />
              </div>
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/5 hover:bg-white/10 text-primary transition active:scale-95 cursor-pointer"
                aria-label="Toggle Search"
              >
                <Search size={18} />
              </button>
            </div>
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
              <div className="relative mt-2 px-1">
                <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search conversations..."
                  className="w-full bg-surface-container border-none rounded-full py-3 pl-12 pr-10 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/50 transition-all outline-none text-sm font-semibold"
                />
                {query && (
                  <button 
                    onClick={() => setQuery('')} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-text-muted hover:bg-white/5 transition"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div data-chat-feed onScroll={handleScroll} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24 md:pb-3 scrollbar-thin px-4 space-y-4">
        {tab === 'chats' && activeFriends.length > 0 && (
          <section className="mb-2 shrink-0">
            <h2 className="font-label-md text-label-md text-on-surface-variant/60 mb-4 uppercase tracking-widest">Active Now</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none scroll-smooth">
              {activeFriends.map((friend) => {
                const displayName = getNickname(friend.chat, currentUserId, friend);
                return (
                  <div
                    key={friend._id}
                    onClick={() => onOpenChat(friend.chat)}
                    className="flex flex-col items-center gap-2 flex-shrink-0 active:scale-95 transition-transform cursor-pointer"
                  >
                    <div className="relative w-16 h-16 rounded-full p-0.5 border-2 border-primary shadow-[0_0_15px_rgba(210,187,255,0.3)] bg-[#0b1326]">
                      {friend.avatar ? (
                        <img className="w-full h-full rounded-full object-cover" src={friend.avatar} alt={displayName} />
                      ) : (
                        <div className="w-full h-full rounded-full bg-gradient-to-tr from-accent to-accent-light flex items-center justify-center text-white font-bold text-sm">
                          {displayName ? displayName.charAt(0).toUpperCase() : 'F'}
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-secondary rounded-full border-2 border-surface presence-glow"></div>
                    </div>
                    <span className="font-label-md text-label-md text-on-surface max-w-[64px] truncate">{displayName.split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {loading ? (
          <ChatSkeleton />
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1 mb-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted/60">Messages</h3>
              {personalUnread > 0 && (
                <span className="text-secondary text-xs font-bold">{personalUnread} Unread</span>
              )}
            </div>
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-1.5">
            <AnimatePresence initial={false}>
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
            </AnimatePresence>
          </motion.div>
          {loadingMore && (
              <div className="py-4 text-center text-text-muted text-xs font-semibold animate-pulse flex items-center justify-center gap-1.5">
                <span>Loading more conversations</span>
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent text-accent animate-ping" />
              </div>
            )}
            {!loading && personalChats.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-center relative overflow-hidden select-none">
                {/* Hero Illustration / Icon */}
                <div className="relative mb-6">
                  {/* Abstract Glow */}
                  <div className="absolute inset-0 bg-primary/15 blur-2xl rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
                  <div className="relative w-36 h-36 bg-[#171f33]/60 border border-white/10 rounded-full flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-primary/40 text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  </div>
                  {/* Floating Micro-Elements */}
                  <div className="absolute -top-1 -right-1 w-10 h-10 bg-[#1e293b] border border-white/10 rounded-xl flex items-center justify-center shadow-md hover:rotate-12 transition-transform duration-300">
                    <span className="material-symbols-outlined text-[#4edea3] text-lg">chat_bubble</span>
                  </div>
                  <div className="absolute bottom-2 -left-4 w-8 h-8 bg-[#1e293b] border border-white/10 rounded-full flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-[#7c3aed] text-md" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                  </div>
                </div>

                {/* Typography */}
                <h3 className="text-lg font-bold text-text-primary mb-1.5 tracking-tight">No Sparks Yet</h3>
                <p className="text-xs text-text-secondary max-w-[240px] mb-6 leading-relaxed">
                  Start a conversation to see your digital sparks fly.
                </p>

                {/* Action button */}
                <button 
                  onClick={onFindPeople}
                  className="px-6 py-3 bg-primary text-white font-bold text-xs rounded-full shadow-lg hover:brightness-105 active:scale-95 transition-all duration-200"
                >
                  Start Blipping
                </button>

                {/* Suggestion Chips */}
                <div className="mt-8 flex gap-2 flex-wrap justify-center">
                  <span 
                    onClick={onFindPeople}
                    className="px-3.5 py-1.5 bg-[#171f33]/50 border border-white/5 rounded-full text-[10.5px] font-bold text-text-secondary cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    Say Hello 👋
                  </span>
                  <span 
                    onClick={onFindPeople}
                    className="px-3.5 py-1.5 bg-[#171f33]/50 border border-white/5 rounded-full text-[10.5px] font-bold text-text-secondary cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    Find Matches
                  </span>
                </div>
              </div>
            )}
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

const SwipeChatRow = memo(function SwipeChatRow({ chat, currentUserId, selected, typing, displayName, other, onOpen, onSelect, onSetChatPreference }) {
  const x = useMotionValue(0);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [muteFlashing, setMuteFlashing] = useState(false);
  const rowRef = useRef(null);

  const dragInfo = useRef({
    startX: 0,
    startY: 0,
    lockDirection: 'none', // 'none', 'horizontal', 'vertical'
    hasDragged: false,
    isDragging: false
  });

  // Archive (Swipe Left): x goes from 0 to negative. Threshold is -100px.
  const archiveBg = useTransform(x, [-100, 0, 100], ['rgba(16, 185, 129, 1)', 'rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.1)']);
  const archiveColor = useTransform(x, [-100, 0, 100], ['rgba(255, 255, 255, 1)', 'rgba(52, 211, 153, 1)', 'rgba(52, 211, 153, 1)']);
  const archiveOpacity = useTransform(x, [-100, -20, 0, 100], [1, 0.4, 0, 0]);
  const archiveScale = useTransform(x, [-100, 0, 100], [1.0, 0.5, 0.5]);

  // Mute (Swipe Right): x goes from 0 to positive. Threshold is 80px.
  const muteBg = useTransform(x, [-100, 0, 80], ['rgba(245, 158, 11, 0.1)', 'rgba(245, 158, 11, 0.1)', 'rgba(245, 158, 11, 1)']);
  const muteColor = useTransform(x, [-100, 0, 80], ['rgba(251, 191, 36, 1)', 'rgba(251, 191, 36, 1)', 'rgba(255, 255, 255, 1)']);
  const muteOpacity = useTransform(x, [-100, 0, 20, 80], [0, 0, 0.4, 1]);
  const muteScale = useTransform(x, [-100, 0, 80], [0.5, 0.5, 1.0]);

  // Click prevention capture listener
  useEffect(() => {
    const element = rowRef.current;
    if (!element) return;

    function handleClickCapture(e) {
      if (dragInfo.current.hasDragged) {
        e.preventDefault();
        e.stopPropagation();
        dragInfo.current.hasDragged = false;
      }
    }

    element.addEventListener('click', handleClickCapture, true);
    return () => {
      element.removeEventListener('click', handleClickCapture, true);
    };
  }, []);

  // Touch Events for Mobile Axis-Locking
  useEffect(() => {
    const element = rowRef.current;
    if (!element) return;

    const drag = dragInfo.current;

    function handleTouchStart(e) {
      if (isCollapsing) return;
      const touch = e.touches[0];
      drag.startX = touch.clientX;
      drag.startY = touch.clientY;
      drag.lockDirection = 'none';
      drag.hasDragged = false;
      drag.isDragging = true;
    }

    function handleTouchMove(e) {
      if (!drag.isDragging || drag.lockDirection === 'vertical' || isCollapsing) return;

      const touch = e.touches[0];
      const diffX = touch.clientX - drag.startX;
      const diffY = touch.clientY - drag.startY;

      if (drag.lockDirection === 'none') {
        if (Math.abs(diffY) > 10) {
          drag.lockDirection = 'vertical';
          return;
        } else if (Math.abs(diffX) > 10) {
          drag.lockDirection = 'horizontal';
          drag.hasDragged = true;
        }
      }

      if (drag.lockDirection === 'horizontal') {
        if (e.cancelable) {
          e.preventDefault();
        }
        const rowWidth = element.offsetWidth || window.innerWidth;
        const friction = 0.8;
        let targetX = diffX * friction;

        if (targetX < 0) {
          targetX = Math.max(-rowWidth, targetX);
        } else {
          targetX = Math.min(150, targetX);
        }
        x.set(targetX);
      }
    }

    function handleTouchEnd(e) {
      if (!drag.isDragging) return;
      drag.isDragging = false;

      if (drag.lockDirection === 'horizontal') {
        const currentX = x.get();
        const rowWidth = element.offsetWidth || window.innerWidth;
        const archiveThreshold = -Math.max(100, rowWidth * 0.4);
        const muteThreshold = 80;

        if (currentX <= archiveThreshold) {
          haptics.success();
          animate(x, -rowWidth, { duration: 0.15, ease: "easeOut" }).then(() => {
            setIsCollapsing(true);
            setTimeout(() => {
              onSetChatPreference(chat, 'archive');
              setIsCollapsing(false);
              x.set(0);
            }, 250);
          });
        } else if (currentX >= muteThreshold) {
          haptics.tap();
          if (navigator.vibrate && navigator.userActivation?.hasBeenActive) {
            navigator.vibrate(15);
          }
          setMuteFlashing(true);
          setTimeout(() => setMuteFlashing(false), 200);

          onSetChatPreference(chat, 'mute');
          animate(x, 0, { type: 'spring', stiffness: 300, damping: 20 });
        } else {
          animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
        }
      }
      drag.lockDirection = 'none';
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [chat, isCollapsing, onSetChatPreference, x]);

  // Mouse Events for Desktop drag
  useEffect(() => {
    const element = rowRef.current;
    if (!element) return;

    const drag = dragInfo.current;

    function handleMouseDown(e) {
      if (e.button !== 0 || isCollapsing) return;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.lockDirection = 'none';
      drag.hasDragged = false;
      drag.isDragging = true;

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    function handleMouseMove(e) {
      if (!drag.isDragging || isCollapsing) return;

      const diffX = e.clientX - drag.startX;
      const diffY = e.clientY - drag.startY;

      if (drag.lockDirection === 'none') {
        if (Math.abs(diffX) > 5) {
          drag.lockDirection = 'horizontal';
          drag.hasDragged = true;
        } else if (Math.abs(diffY) > 5) {
          drag.lockDirection = 'vertical';
        }
      }

      if (drag.lockDirection === 'horizontal') {
        const rowWidth = element.offsetWidth || window.innerWidth;
        const friction = 0.8;
        let targetX = diffX * friction;

        if (targetX < 0) {
          targetX = Math.max(-rowWidth, targetX);
        } else {
          targetX = Math.min(150, targetX);
        }
        x.set(targetX);
      }
    }

    function handleMouseUp(e) {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (!drag.isDragging) return;
      drag.isDragging = false;

      if (drag.lockDirection === 'horizontal') {
        const currentX = x.get();
        const rowWidth = element.offsetWidth || window.innerWidth;
        const archiveThreshold = -Math.max(100, rowWidth * 0.4);
        const muteThreshold = 80;

        if (currentX <= archiveThreshold) {
          haptics.success();
          animate(x, -rowWidth, { duration: 0.15, ease: "easeOut" }).then(() => {
            setIsCollapsing(true);
            setTimeout(() => {
              onSetChatPreference(chat, 'archive');
              setIsCollapsing(false);
              x.set(0);
            }, 250);
          });
        } else if (currentX >= muteThreshold) {
          haptics.tap();
          if (navigator.vibrate && navigator.userActivation?.hasBeenActive) {
            navigator.vibrate(15);
          }
          setMuteFlashing(true);
          setTimeout(() => setMuteFlashing(false), 200);

          onSetChatPreference(chat, 'mute');
          animate(x, 0, { type: 'spring', stiffness: 300, damping: 20 });
        } else {
          animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
        }
      }
      drag.lockDirection = 'none';
    }

    element.addEventListener('mousedown', handleMouseDown);

    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [chat, isCollapsing, onSetChatPreference, x]);

  return (
    <motion.div
      variants={itemVariants}
      animate={isCollapsing ? {
        height: 0,
        paddingTop: 0,
        paddingBottom: 0,
        marginTop: 0,
        marginBottom: 0,
        opacity: 0
      } : "show"}
      transition={isCollapsing ? { duration: 0.25, ease: [0.25, 1, 0.5, 1] } : undefined}
      className="relative mb-1.5 overflow-hidden rounded-2xl bg-bg"
    >
      {/* Mute Slide Action Background (revealed on Right Swipe) */}
      <motion.div
        style={{
          opacity: muteOpacity,
          backgroundColor: muteBg,
          color: muteColor
        }}
        className="absolute inset-y-0 left-0 w-1/2 flex items-center justify-start pl-4 gap-2 text-xs font-bold rounded-l-2xl"
      >
        <motion.div
          style={{ scale: muteScale }}
          className="flex items-center gap-2"
        >
          {chat.muted ? <Bell size={17} /> : <BellOff size={17} />}
          <span>{chat.muted ? 'Unmuted' : 'Muted'}</span>
        </motion.div>
      </motion.div>

      {/* Archive Slide Action Background (revealed on Left Swipe) */}
      <motion.div
        style={{
          opacity: archiveOpacity,
          backgroundColor: archiveBg,
          color: archiveColor
        }}
        className="absolute inset-y-0 right-0 w-1/2 flex items-center justify-end pr-4 gap-2 text-xs font-bold rounded-r-2xl"
      >
        <motion.div
          style={{ scale: archiveScale }}
          className="flex items-center gap-2"
        >
          {chat.archived ? <Mail size={17} /> : <Archive size={17} />}
          <span>{chat.archived ? 'Unarchived' : 'Archived'}</span>
        </motion.div>
      </motion.div>

      <motion.article
        ref={rowRef}
        style={{ x }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect();
        }}
        className={`relative flex w-full items-center gap-4 rounded-xl p-4 text-left cursor-pointer transition-[background-color,border-color] duration-200 active:scale-[0.98] ${
          selected 
            ? 'border-primary/25 bg-primary/10 shadow-glow' 
            : chat.unreadCount 
              ? 'glass-card border border-white/10' 
              : 'bg-surface-container-low hover:bg-[#171f33]/80 border border-white/5'
        } ${chat.muted ? 'opacity-80' : ''} ${muteFlashing ? 'bg-amber-500/20 ring-2 ring-amber-500/30' : ''}`}
      >
        <ChatRowButton onOpen={onOpen} onLongSelect={onSelect}>
          <div className="flex items-center gap-4 w-full">
            {/* Avatar Container with online status dot and pinned badge */}
            <div className={`relative h-14 w-14 shrink-0 rounded-full flex items-center justify-center ${chat.unreadCount ? 'p-0.5 border-2 border-primary shadow-[0_0_12px_rgba(210,187,255,0.4)]' : 'p-0.5 border border-white/10'} ${!other?.isOnline ? 'grayscale' : ''}`}>
              {other?.avatar ? (
                <img src={other.avatar} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <div className="h-full w-full rounded-full bg-gradient-to-tr from-primary to-[#7c3aed] flex items-center justify-center text-white font-bold text-sm">
                  {displayName ? displayName.charAt(0).toUpperCase() : 'F'}
                </div>
              )}
              {other?.isOnline && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-secondary rounded-full border-2 border-surface-container presence-glow" />
              )}
              {chat.pinned && (
                <span className="material-symbols-outlined absolute -top-1 -left-1 text-primary text-[14px] bg-surface rounded-full p-0.5 border border-white/10" style={{ fontVariationSettings: "'FILL' 1" }}>
                  push_pin
                </span>
              )}
            </div>

            {/* Chat info details */}
            <div className="min-w-0 flex-1">
              <div className="flex justify-between items-baseline gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">{displayName || 'Friend'}</h3>
                  {(chat.isStranger || other?.isStranger) && (
                    <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-label-md text-label-md shrink-0">Stranger</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="flex items-center gap-1">
                    {chat.archived && <Archive size={11} className="text-text-faint" />}
                    {chat.starred && <Star size={11} className="fill-gold text-gold" />}
                    {chat.muted && <BellOff size={11} className="text-text-faint" />}
                  </span>
                  <span className={`font-label-md text-label-md ${chat.unreadCount ? 'text-secondary font-bold' : 'text-on-surface-variant/40'}`}>
                    {chat.lastMessage ? formatMessageTime(chat.lastMessage.createdAt) : ''}
                  </span>
                </div>
              </div>
              <p className={`mt-1 truncate text-xs ${typing ? 'font-semibold text-primary' : chat.unreadCount ? 'font-semibold text-text-primary' : 'font-medium text-text-muted'}`}>
                {typing ? 'typing...' : chat.lastMessage?.text || callPreview(chat.lastCall, currentUserId) || presenceText(other)}
              </p>
            </div>

            {chat.unreadCount > 0 && (
              <div className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_10px_rgba(210,187,255,0.6)] shrink-0 self-center ml-2 badge-pulse" />
            )}
          </div>
        </ChatRowButton>
      </motion.article>
    </motion.div>
  );
}, (prev, next) => {
  return (
    prev.selected === next.selected &&
    prev.typing === next.typing &&
    prev.displayName === next.displayName &&
    prev.currentUserId === next.currentUserId &&
    prev.other?.isOnline === next.other?.isOnline &&
    prev.chat.updatedAt === next.chat.updatedAt &&
    prev.chat.unreadCount === next.chat.unreadCount &&
    prev.chat.pinned === next.chat.pinned &&
    prev.chat.starred === next.chat.starred &&
    prev.chat.muted === next.chat.muted &&
    prev.chat.archived === next.chat.archived &&
    prev.chat.lastMessage?.text === next.chat.lastMessage?.text &&
    prev.chat.lastMessage?.status === next.chat.lastMessage?.status
  );
});

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
    }, 3000);
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

function formatMessageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}


