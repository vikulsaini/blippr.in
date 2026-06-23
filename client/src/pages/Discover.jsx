import { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Search, MapPin, Heart, X as XIcon, Star, UserPlus, Mail, Check, UserMinus } from 'lucide-react';
import UserProfileModal from '../components/UserProfileModal.jsx';
import { api, getTokenSubject } from '../lib/api.js';
import { presenceText } from '../lib/presence.js';
import { showToast } from '../components/Toast.jsx';

export default function Discover() {
  const { me } = useOutletContext() || {};
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [profileUser, setProfileUser] = useState(null);
  const [searching, setSearching] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('All Near Me');
  
  // Card index tracking
  const [cardIndex, setCardIndex] = useState(0);

  const [friendIds, setFriendIds] = useState(new Set());
  const [sentRequestIds, setSentRequestIds] = useState(new Set());
  const [receivedRequestIds, setReceivedRequestIds] = useState(new Set());

  const filters = ['All Near Me', 'Gamers', 'Artists', 'Techies', 'Music'];

  async function fetchRelations() {
    const myId = getTokenSubject();
    if (!myId) return;
    try {
      const [sentRes, receivedRes, chatsRes] = await Promise.all([
        api('/api/friends/requests/sent'),
        api('/api/friends/requests'),
        api('/api/chats')
      ]);
      setSentRequestIds(new Set(sentRes?.requests?.map((r) => (r.to?._id || r.to)) || []));
      setReceivedRequestIds(new Set(receivedRes?.requests?.map((r) => (r.from?._id || r.from)) || []));
      
      const fIds = new Set();
      chatsRes?.chats?.forEach((chat) => {
        if (chat.type === 'direct' && !chat.temporary) {
          const otherMember = chat.members?.find((m) => {
            const mId = (m?._id || m || '').toString();
            return mId !== myId;
          });
          if (otherMember) {
            fIds.add(otherMember._id || otherMember);
          }
        }
      });
      setFriendIds(fIds);
    } catch (err) {
      console.warn('Failed to fetch relations:', err);
    }
  }

  useEffect(() => {
    if (!getTokenSubject()) return;

    const loadSuggestions = () => {
      api('/api/users/suggested')
        .then((data) => setSuggested(data?.users || []))
        .catch(() => {});
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          try {
            await api('/api/users/me/location', {
              method: 'POST',
              body: JSON.stringify({ latitude, longitude, accuracy })
            });
          } catch (err) {
            console.warn('Failed to sync location:', err);
          } finally {
            loadSuggestions();
          }
        },
        (error) => {
          console.warn('Geolocation denied or failed:', error);
          loadSuggestions();
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      loadSuggestions();
    }

    fetchRelations();
  }, []);

  useEffect(() => {
    if (!getTokenSubject()) return;
    if (!query.trim()) {
      setUsers([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const [data] = await Promise.all([
          api(`/api/users/search?q=${encodeURIComponent(query.trim())}`),
          fetchRelations()
        ]);
        setUsers(data?.users || []);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  async function toggleRequest(userId, status) {
    if (status === 'friend') {
      try {
        await api(`/api/friends/${userId}`, { method: 'DELETE' });
        setFriendIds((current) => {
          const next = new Set(current);
          next.delete(userId);
          return next;
        });
        showToast('Unfriended successfully', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }
    if (status === 'sent') {
      try {
        await api(`/api/friends/requests/sent/${userId}`, { method: 'DELETE' });
        setSentRequestIds((current) => {
          const next = new Set(current);
          next.delete(userId);
          return next;
        });
        showToast('Friend request cancelled', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }
    if (status === 'received') {
      try {
        const pending = await api('/api/friends/requests');
        const req = pending.requests.find((r) => r.from._id === userId || r.from === userId);
        if (req) {
          await api(`/api/friends/requests/${req._id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'accepted' })
          });
          setReceivedRequestIds((current) => {
            const next = new Set(current);
            next.delete(userId);
            return next;
          });
          setFriendIds((current) => new Set([...current, userId]));
          showToast('Friend request accepted!', 'success');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }
    try {
      await api('/api/friends/requests', { method: 'POST', body: JSON.stringify({ userId }) });
      setSentRequestIds((current) => new Set([...current, userId]));
      showToast('Friend request sent!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const getUserStatus = (userId) => {
    if (friendIds.has(userId)) return 'friend';
    if (sentRequestIds.has(userId)) return 'sent';
    if (receivedRequestIds.has(userId)) return 'received';
    return 'none';
  };

  // Filter suggested users by category chip
  const filteredSuggested = useMemo(() => {
    return suggested.filter((u) => {
      // Exclude friends
      if (friendIds.has(u._id)) return false;
      if (sentRequestIds.has(u._id)) return false;
      if (receivedRequestIds.has(u._id)) return false;
      if (u._id === me?._id) return false;
      if (selectedFilter === 'All Near Me') return true;
      
      const category = selectedFilter.toLowerCase();
      // Simple keyword matching against user's bio/hobbies
      const bio = (u.bio || '').toLowerCase();
      const hobbies = (u.hobbies || '').toLowerCase();
      const interestsStr = (u.interests || []).join(' ').toLowerCase();

      return bio.includes(category) || hobbies.includes(category) || interestsStr.includes(category);
    });
  }, [suggested, friendIds, sentRequestIds, receivedRequestIds, selectedFilter, me?._id]);

  const activeUser = filteredSuggested[cardIndex];

  const handleSwipe = (direction) => {
    if (!activeUser) return;
    if (direction === 'right') {
      const status = getUserStatus(activeUser._id);
      if (status === 'none') {
        toggleRequest(activeUser._id, status);
      }
    }
    setCardIndex((prev) => prev + 1);
  };

  return (
    <div className="mx-auto w-full max-w-mobile min-h-[calc(100vh-6rem)] flex flex-col justify-between px-4 pb-20 relative overflow-hidden">
      
      {/* Decorative Glow Elements */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-[#7c3aed]/10 rounded-full blur-[64px] pointer-events-none" />
      <div className="absolute -right-16 top-1/3 w-64 h-64 bg-[#4edea3]/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Search and Filters Header */}
      <div className="space-y-4 pt-4 z-20">
        <section className="border border-white/10 bg-[#171f33]/70 backdrop-blur-md rounded-full p-1.5 shadow-md">
          <label className="flex items-center gap-2 px-3">
            <Search size={18} className="text-[#d2bbff] shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent border-none text-[#dbe2fd] placeholder-[#ccc3d8]/40 focus:ring-0 text-sm py-1.5"
              placeholder="Search conversations or users..."
            />
          </label>
        </section>

        {!query.trim() && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-2 px-2 z-10">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => {
                  setSelectedFilter(f);
                  setCardIndex(0);
                }}
                className={`flex-shrink-0 px-4 py-2 rounded-full font-label-md text-label-md transition-colors ${
                  selectedFilter === f
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-variant text-on-surface-variant border border-white/5'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex items-center justify-center py-4 relative min-h-[360px] z-10">
        {searching ? (
          <div className="w-full aspect-[3/4] rounded-[32px] border border-white/10 bg-[#171f33]/70 backdrop-blur-md flex flex-col items-center justify-center text-[#ccc3d8]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#d2bbff] border-t-transparent mb-3" />
            <p className="text-sm font-semibold">Searching users...</p>
          </div>
        ) : query.trim() ? (
          // Grid Search Results
          <div className="w-full grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {users.length > 0 ? (
              users.map((user) => (
                <UserRow key={user._id} user={user} status={getUserStatus(user._id)} onProfile={setProfileUser} onAction={toggleRequest} />
              ))
            ) : (
              <div className="col-span-full border border-white/10 bg-[#171f33]/70 backdrop-blur-md p-8 rounded-[24px] text-center shadow-md">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#7c3aed]/25 text-[#d2bbff] border border-[#7c3aed]/30 shadow-[0_0_15px_rgba(124,58,237,0.2)]">
                  <Search size={21} />
                </span>
                <p className="mt-3 font-semibold text-white">No users found</p>
                <p className="mt-1 text-xs text-[#ccc3d8]/80">Try another username or name.</p>
              </div>
            )}
          </div>
        ) : (
          // Tinder-Style Swiping Card Stack
          <div className="card-stack relative w-full aspect-[3/4] max-w-[340px]">
            <AnimatePresence>
              {activeUser ? (
                filteredSuggested.slice(cardIndex, cardIndex + 3).reverse().map((user, idx, arr) => {
                  const isTop = idx === arr.length - 1;
                  return (
                    <SwipeCard
                      key={user._id}
                      user={user}
                      isTop={isTop}
                      status={getUserStatus(user._id)}
                      onSwipe={handleSwipe}
                      onProfile={setProfileUser}
                      depthIndex={arr.length - 1 - idx}
                    />
                  );
                })
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 border border-white/10 bg-[#171f33]/70 backdrop-blur-md rounded-[32px] shadow-2xl">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-[#7c3aed]/25 text-[#d2bbff] border border-[#7c3aed]/30 shadow-[0_0_15px_rgba(124,58,237,0.2)] mb-4 animate-pulse">
                    <MapPin size={28} />
                  </span>
                  <p className="text-lg font-bold text-white">Find your crew</p>
                  <p className="text-xs text-[#ccc3d8]/80 mt-2 max-w-[220px]">
                    No more Suggested users in this category. Change filter chip or try searching above!
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {!query.trim() && activeUser && (
        <div className="flex items-center justify-center gap-6 mt-10 z-30">
          {/* Pass Button */}
          <button
            onClick={() => handleSwipe('left')}
            className="w-16 h-16 rounded-full flex items-center justify-center bg-white/5 backdrop-blur-md border border-white/10 text-on-surface-variant hover:text-error transition-all hover:bg-error/10 active:scale-90 duration-200"
            title="Pass"
            id="btn-pass"
          >
            <span className="material-symbols-outlined text-4xl">close</span>
          </button>
          {/* Super Blipp Button */}
          <button
            onClick={() => handleSwipe('right')}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5 backdrop-blur-md border border-white/10 text-tertiary hover:scale-110 transition-all active:scale-90 duration-200"
            title="Super Blipp"
          >
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
          </button>
          {/* Blipp Button */}
          <button
            onClick={() => handleSwipe('right')}
            className="w-16 h-16 rounded-full flex items-center justify-center bg-primary-container text-white blipp-shadow hover:scale-110 transition-all active:scale-90 duration-200"
            title="Blipp"
            id="btn-blipp"
          >
            <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
          </button>
        </div>
      )}

      {/* User Profile Detail Modal */}
      <UserProfileModal
        user={profileUser}
        currentUserId={me?._id}
        onClose={() => setProfileUser(null)}
        onUnfriend={async () => {
          if (profileUser) {
            await toggleRequest(profileUser._id, 'friend');
            setProfileUser(null);
            // Sync card index if it's the active swiped card
            fetchRelations();
          }
        }}
        onBlock={async (userId) => {
          await api('/api/safety/block', {
            method: 'POST',
            body: JSON.stringify({ userId })
          });
          setFriendIds((current) => {
            const next = new Set(current);
            next.delete(userId);
            return next;
          });
          setProfileUser(null);
          showToast('User blocked', 'success');
        }}
        onReport={async (userId, reason) => {
          await api('/api/safety/report', {
            method: 'POST',
            body: JSON.stringify({ userId, reason, notes: 'Reported from Discover.' })
          });
          setProfileUser(null);
          showToast('User reported', 'success');
        }}
      />
    </div>
  );
}

// Interactive Swipe Card with Framer Motion
function SwipeCard({ user, isTop, status, onSwipe, onProfile, depthIndex }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-150, 150], [-15, 15]);
  const opacity = useTransform(x, [-150, -100, 0, 100, 150], [0.5, 1, 1, 1, 0.5]);

  const handleDragEnd = (event, info) => {
    if (!isTop) return;
    const swipeThreshold = 90;
    if (info.offset.x > swipeThreshold) {
      onSwipe('right');
    } else if (info.offset.x < -swipeThreshold) {
      onSwipe('left');
    }
  };

  const scale = 1 - depthIndex * 0.05;
  const translateY = depthIndex * 12;

  return (
    <motion.div
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        opacity: isTop ? opacity : 0.85 - depthIndex * 0.2,
        scale,
        y: translateY,
        cursor: isTop ? 'grab' : 'auto',
        zIndex: 30 - depthIndex,
      }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: 'grabbing', scale: scale * 1.02 }}
      transition={isTop ? undefined : { type: 'spring', stiffness: 300, damping: 24 }}
      className="card-item absolute inset-0 rounded-[32px] overflow-hidden border border-white/15 bg-[#171f33] shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col justify-between"
    >
      <div className="w-full h-full relative group">
        {user.avatar ? (
          <img src={user.avatar} className="w-full h-full object-cover select-none pointer-events-none" alt={user.name || 'User'} />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-[#131b2e] to-[#171f33] flex items-center justify-center">
            <div className="text-center">
              <span className="text-4xl font-extrabold text-[#d2bbff] select-none">{(user.name || 'U').charAt(0).toUpperCase()}</span>
            </div>
          </div>
        )}
        
        {/* Presence Indicator */}
        {user.isOnline && (
          <div className="absolute top-4 right-4 flex items-center gap-1 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></div>
            <span className="font-label-md text-label-md text-on-surface">Active</span>
          </div>
        )}
 
        {/* Info Overlay */}
        <div className="absolute inset-0 glass-overlay flex flex-col justify-end p-6 select-none">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-headline-md text-headline-md text-on-surface">{user.name || 'User'}</h2>
            <span className="text-on-surface/80 text-body-lg font-body-lg">{user.age}</span>
          </div>
          
          <div className="flex items-center gap-1 text-on-surface-variant text-body-sm font-body-sm mb-4">
            <span className="material-symbols-outlined text-[16px]">location_on</span>
            <span>{presenceText(user)}{user.distance !== undefined && user.distance !== null ? ` · ${user.distance.toFixed(1)} km away` : ''}</span>
          </div>

          {/* Interests tags */}
          <div className="flex flex-wrap gap-2">
            {(user.hobbies ? user.hobbies.split(',') : (user.interests || [])).slice(0, 3).map((tag, i) => (
              <span key={i} className="px-3 py-1 rounded-full bg-secondary/15 text-secondary text-label-md font-label-md">
                {tag.trim()}
              </span>
            ))}
          </div>
          
          <button 
            type="button" 
            onClick={() => onProfile(user)}
            className="absolute bottom-6 right-6 h-8 px-3.5 rounded-full bg-white/10 border border-white/15 text-white font-bold text-[10px] hover:bg-white/20 transition-all duration-200 hover:border-white/30 hover:scale-105 active:scale-95"
          >
            Profile
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// User Row List for Search Mode
function UserRow({ user, status, onProfile, onAction }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-[#171f33]/60 backdrop-blur-md p-3 hover:bg-[#171f33]/90 hover:border-white/15 hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)] transition-all duration-200"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={() => onProfile(user)} className="relative shrink-0 overflow-hidden rounded-full border border-[#d2bbff]/20" aria-label={`View ${user.name} profile`}>
          {user.avatar ? (
            <img src={user.avatar} alt="" className="h-12 w-12 rounded-full bg-bg object-cover transition-transform duration-300 hover:scale-105" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-accent to-[#7c3aed] flex items-center justify-center text-white font-bold text-sm">
              {(user.name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          {user.isOnline && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#4edea3] border-2 border-[#171f33] shadow-[0_0_8px_#4edea3]" />}
        </button>
        <div className="min-w-0">
          <p className="truncate font-semibold text-white leading-tight">{user.name || 'User'}</p>
          <p className="truncate text-[11px] text-[#ccc3d8]/80 mt-0.5">@{user.username || 'user'} · {user.gender || 'unknown'} · {user.age || '18'}</p>
          {user.bio && <p className="truncate text-[10px] text-[#ccc3d8]/70 italic max-w-[170px] mt-0.5">"{user.bio}"</p>}
        </div>
      </div>
      <RequestButton status={status} onClick={() => onAction(user._id, status)} label={user.name} />
    </motion.article>
  );
}

function RequestButton({ status, onClick, label }) {
  if (status === 'friend') {
    return (
      <button
        onClick={onClick}
        className="shrink-0 rounded-full p-2.5 transition min-h-[40px] min-w-[40px] flex items-center justify-center bg-[#4edea3]/10 text-[#4edea3] hover:bg-red-500/10 hover:text-red-400 border border-[#4edea3]/20 hover:border-red-500/25"
        title={`Unfriend ${label}`}
      >
        <Check size={18} />
      </button>
    );
  }

  if (status === 'sent') {
    return (
      <button
        onClick={onClick}
        className="shrink-0 rounded-full p-2.5 transition min-h-[40px] min-w-[40px] flex items-center justify-center bg-[#7c3aed]/15 text-[#d2bbff] hover:bg-red-500/15 hover:text-red-400 border border-[#7c3aed]/20 hover:border-red-500/25"
        title={`Cancel request to ${label}`}
      >
        <Mail size={18} />
      </button>
    );
  }

  if (status === 'received') {
    return (
      <button
        onClick={onClick}
        className="shrink-0 rounded-full p-2.5 transition min-h-[40px] min-w-[40px] flex items-center justify-center bg-amber-500/15 text-amber-400 hover:bg-amber-500 hover:text-white border border-amber-500/20"
        title={`Accept request from ${label}`}
      >
        <UserPlus size={18} />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full p-2.5 transition min-h-[40px] min-w-[40px] flex items-center justify-center bg-[#7c3aed] text-white hover:bg-[#6d28d9] shadow-[0_0_12px_rgba(124,58,237,0.4)] hover:scale-105 active:scale-95 duration-200"
      title={`Add ${label}`}
    >
      <UserPlus size={18} />
    </button>
  );
}
