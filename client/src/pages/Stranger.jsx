import { useEffect, useRef, useState } from 'react';
import { animate, motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Flag, MapPin, RotateCw, Shuffle, UserPlus } from 'lucide-react';
import UserProfileModal from '../components/UserProfileModal.jsx';
import { api } from '../lib/api.js';
import { readCache, writeCache } from '../lib/cache.js';
import { presenceText } from '../lib/presence.js';
import { getRealtimeSocket } from '../lib/realtime.js';

const MATCH_CACHE_TTL = 90 * 1000;
const deckConfig = {
  nearby: {
    endpoint: '/api/users/available',
    cacheKey: 'match:nearby',
    loadingText: 'Finding active people nearby...',
    emptyText: 'No active users nearby right now.'
  },
  random: {
    endpoint: '/api/users/available/random',
    cacheKey: 'match:random',
    loadingText: 'Shuffling active people...',
    emptyText: 'No active random users right now.'
  }
};

export default function Stranger() {
  const [available, setAvailable] = useState([]);
  const [sentIds, setSentIds] = useState(new Set());
  const [profileUser, setProfileUser] = useState(null);
  const [status, setStatus] = useState('Loading matches...');
  const [mode, setMode] = useState('nearby');
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const dragMovedRef = useRef(false);
  const swipeLockedRef = useRef(false);
  const loadSeqRef = useRef(0);
  const controls = useAnimation();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-140, 0, 140], [-5, 0, 5]);

  useEffect(() => {
    loadMatch();
  }, []);

  useEffect(() => {
    x.set(0);
    controls.start({ opacity: 1, scale: 1, transition: { duration: 0.18 } });
  }, [activeIndex, controls, x]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    const removeFriendFromDeck = ({ chat }) => {
      const friendIds = new Set((chat?.members || []).map((member) => member._id || member));
      setAvailable((current) => {
        const next = current.filter((user) => !friendIds.has(user._id));
        setActiveIndex((index) => Math.max(0, Math.min(index, next.length - 1)));
        return next;
      });
    };

    socket.on('friend:request:accepted', removeFriendFromDeck);
    return () => socket.off('friend:request:accepted', removeFriendFromDeck);
  }, []);

  async function loadMatch() {
    try {
      hydrateDeckFromCache('nearby');
      const cachedUser = readCache('me', 'global', null);
      const { user } = cachedUser ? { user: cachedUser } : await api('/api/users/me');
      if (user.location?.coordinates?.length) {
        refreshLocationInBackground().catch(() => {});
      } else if (!sessionStorage.getItem('varta_location_prompted')) {
        sessionStorage.setItem('varta_location_prompted', 'true');
        await requestAndSaveLocation();
      }
      await loadDeck('nearby');
      prefetchDeck('random');
    } catch (err) {
      setStatus(err.message);
      setLoading(false);
    }
  }

  function hydrateDeckFromCache(nextMode) {
    const cached = readCache(deckConfig[nextMode].cacheKey, 'global', null);
    if (!cached?.users) return false;
    setMode(nextMode);
    setAvailable(cached.users);
    setActiveIndex(0);
    setLoading(false);
    setStatus(formatDeckStatus(nextMode, cached.users.length));
    return true;
  }

  function applyDeck(nextMode, data) {
    const users = shuffle(data.users || []);
    setMode(nextMode);
    setAvailable(users);
    setSentIds(new Set());
    setActiveIndex(0);
    setStatus(formatDeckStatus(nextMode, users.length));
    writeCache(deckConfig[nextMode].cacheKey, { users, source: data.source || nextMode }, 'global', MATCH_CACHE_TTL);
  }

  async function loadDeck(nextMode, { silent = false } = {}) {
    const seq = ++loadSeqRef.current;
    if (!silent) {
      setMode(nextMode);
      setStatus(deckConfig[nextMode].loadingText);
      setLoading(true);
    }
    try {
      const data = await api(deckConfig[nextMode].endpoint);
      if (silent) {
        writeCache(deckConfig[nextMode].cacheKey, { users: shuffle(data.users || []), source: data.source || nextMode }, 'global', MATCH_CACHE_TTL);
      } else if (seq === loadSeqRef.current) {
        applyDeck(nextMode, data);
      }
    } catch (err) {
      if (!silent) setStatus(err.message);
    } finally {
      if (!silent && seq === loadSeqRef.current) setLoading(false);
    }
  }

  async function loadRandomAvailable() {
    hydrateDeckFromCache('random');
    await loadDeck('random');
  }

  function prefetchDeck(nextMode) {
    if (readCache(deckConfig[nextMode].cacheKey, 'global', null)?.users?.length) return;
    loadDeck(nextMode, { silent: true }).catch(() => {});
  }

  async function refreshLocationInBackground() {
    if (!navigator.geolocation || !navigator.permissions) return;
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    if (permission.state !== 'granted') return;

    navigator.geolocation.getCurrentPosition(async (position) => {
      await api('/api/users/me/location', {
        method: 'PATCH',
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
      });
    });
  }

  async function requestAndSaveLocation() {
    if (!navigator.geolocation) return;

    setStatus('Allow location once to improve nearby matching.');
    await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await api('/api/users/me/location', {
              method: 'PATCH',
              body: JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              })
            });
          } finally {
            resolve();
          }
        },
        () => resolve()
      );
    });
  }

  async function addFriend(userId) {
    try {
      if (actionBusy) return;
      setActionBusy(true);
      if (sentIds.has(userId)) {
        await api(`/api/friends/requests/sent/${userId}`, { method: 'DELETE' });
        setSentIds((current) => {
          const next = new Set(current);
          next.delete(userId);
          return next;
        });
        setStatus('Friend request cancelled');
        return;
      }
      await api('/api/friends/requests', { method: 'POST', body: JSON.stringify({ userId }) });
      setSentIds((current) => new Set([...current, userId]));
      setStatus('Friend request sent');
    } catch (err) {
      setStatus(err.message);
    } finally {
      setActionBusy(false);
    }
  }

  function nextUser() {
    setActiveIndex((index) => (available.length ? (index + 1) % available.length : 0));
    x.set(0);
    controls.set({ opacity: 1, scale: 1 });
  }

  function previousUser() {
    setActiveIndex((index) => (available.length ? (index - 1 + available.length) % available.length : 0));
    x.set(0);
    controls.set({ opacity: 1, scale: 1 });
  }

  async function completeSwipe(direction) {
    if (!activeUser || swipeLockedRef.current) return;
    swipeLockedRef.current = true;
    const offset = direction === 'next' ? 460 : -460;
    await Promise.all([
      controls.start({
      opacity: 0,
      scale: 0.94,
      transition: { type: 'spring', stiffness: 260, damping: 28 }
      }),
      animate(x, offset, { type: 'spring', stiffness: 260, damping: 28 })
    ]);
    direction === 'next' ? nextUser() : previousUser();
    swipeLockedRef.current = false;
  }

  function resetSwipe() {
    animate(x, 0, { type: 'spring', stiffness: 420, damping: 32 });
    controls.start({
      opacity: 1,
      scale: 1,
      transition: { type: 'spring', stiffness: 420, damping: 30 }
    });
  }

  function removeFromDeck(userId) {
    setAvailable((current) => {
      const next = current.filter((user) => user._id !== userId);
      setActiveIndex((index) => Math.max(0, Math.min(index, next.length - 1)));
      return next;
    });
  }

  async function reportActiveUser() {
    if (!activeUser || actionBusy) return;
    try {
      setActionBusy(true);
      await api('/api/safety/report', {
        method: 'POST',
        body: JSON.stringify({ userId: activeUser._id, reason: 'inappropriate', notes: 'Reported from match screen.' })
      });
      removeFromDeck(activeUser._id);
      setStatus('User reported and hidden from this deck');
    } catch (err) {
      setStatus(err.message);
    } finally {
      setActionBusy(false);
    }
  }

  const activeUser = available[activeIndex];
  const requestSent = activeUser && sentIds.has(activeUser._id);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 pb-2 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
      <section className="accent-card rounded-[24px] p-3 backdrop-blur lg:sticky lg:top-0 lg:p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold/85">Match</p>
            <h2 className="mt-1 truncate text-xl font-semibold">{mode === 'random' ? 'Random anywhere' : 'Nearby online'}</h2>
            <p className="mt-1 truncate text-xs text-white/48">{status}</p>
          </div>
          <button onClick={mode === 'random' ? loadRandomAvailable : loadMatch} className="btn-icon h-11 w-11 shrink-0 rounded-[16px] text-sky" aria-label="Refresh matches">
            <RotateCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <ModeButton active={mode === 'nearby'} onClick={loadMatch} icon={MapPin} label="Nearby" />
          <ModeButton active={mode === 'random'} onClick={loadRandomAvailable} icon={Shuffle} label="Random" />
        </div>
      </section>

      <div className="relative overflow-visible px-1">
        <div className="pointer-events-none absolute inset-y-16 left-0 z-0 flex items-center">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/7 text-white/42 backdrop-blur"><ChevronLeft size={20} /></span>
        </div>
        <div className="pointer-events-none absolute inset-y-16 right-0 z-0 flex items-center">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/7 text-white/42 backdrop-blur"><ChevronRight size={20} /></span>
        </div>
      <motion.section
        data-no-tab-swipe
        drag={activeUser ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.38}
        style={{ x, rotate }}
        onDragStart={() => {
          dragMovedRef.current = false;
        }}
        onDragEnd={(_, info) => {
          dragMovedRef.current = Math.abs(info.offset.x) > 8;
          window.setTimeout(() => {
            dragMovedRef.current = false;
          }, 80);
          const shouldChange = Math.abs(info.offset.x) > 110 || Math.abs(info.velocity.x) > 650;
          if (!shouldChange) {
            resetSwipe();
            return;
          }
          if (info.offset.x > 0) completeSwipe('next');
          else completeSwipe('previous');
        }}
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={controls}
        whileDrag={{ scale: 0.985 }}
        className="depth-panel interactive-card relative z-10 overflow-hidden rounded-[28px] shadow-[0_24px_70px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.04)]"
      >
        {loading ? (
          <MatchSkeleton />
        ) : activeUser?.avatar ? (
          <motion.div
            key={activeUser._id}
            initial={{ opacity: 0, filter: 'blur(6px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
          <button
            onClick={() => {
              if (!dragMovedRef.current) setProfileUser(activeUser);
            }}
            className="relative block w-full"
            aria-label={`View ${activeUser.name} profile`}
          >
            <img src={activeUser.avatar} alt="" className="h-[28rem] max-h-[56vh] w-full bg-white/10 object-cover lg:h-[34rem]" />
            <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
              <span className="rounded-full border border-rose/20 bg-rose/15 px-3 py-1 text-[11px] font-medium text-white/80 backdrop-blur">Swipe left: previous</span>
              <span className="rounded-full border border-mint/20 bg-mint/15 px-3 py-1 text-[11px] font-medium text-white/80 backdrop-blur">Swipe right: next</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/78 to-transparent p-4 pt-24 text-left">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-2xl font-semibold">{activeUser.name}</h3>
                  <p className="mt-1 truncate text-sm text-white/70">@{activeUser.username} - {activeUser.gender} - {activeUser.age}</p>
                  <p className={`mt-1 text-sm ${activeUser.isOnline ? 'text-mint' : 'text-white/55'}`}>{presenceText(activeUser)}</p>
                </div>
                <span className={`h-3 w-3 rounded-full ${activeUser.isOnline ? 'live-dot bg-mint text-mint shadow-[0_0_18px_rgba(61,214,198,0.7)]' : 'bg-white/35'}`} />
              </div>
              {activeUser.bio && <p className="mt-3 line-clamp-2 text-sm text-white/72">{activeUser.bio}</p>}
            </div>
          </button>
          </motion.div>
        ) : (
          <EmptyMatch mode={mode} onRetry={mode === 'random' ? loadRandomAvailable : loadMatch} />
        )}
      </motion.section>
      </div>

      <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/7 p-1.5 shadow-glow backdrop-blur lg:col-start-2">
        <ActionButton label="Prev" onClick={() => completeSwipe('previous')} icon={ChevronLeft} disabled={!activeUser || loading} />
        <ActionButton label="Report" icon={Flag} onClick={reportActiveUser} disabled={!activeUser || loading || actionBusy} />
        <ActionButton label={requestSent ? 'Cancel' : 'Add'} onClick={() => activeUser && addFriend(activeUser._id)} icon={requestSent ? Check : UserPlus} active={requestSent} disabled={!activeUser || loading || actionBusy} />
        <ActionButton label="Next" onClick={() => completeSwipe('next')} icon={ChevronRight} primary disabled={!activeUser || loading} />
      </div>

      <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} />
    </div>
  );
}

function formatDeckStatus(mode, count) {
  if (count) return `${count} active ${mode === 'random' ? 'random' : 'nearby'} user${count > 1 ? 's' : ''}`;
  return deckConfig[mode].emptyText;
}

function MatchSkeleton() {
  return (
    <div className="h-[28rem] max-h-[56vh] w-full animate-pulse p-4">
      <div className="h-full rounded-[20px] bg-white/5" />
      <div className="absolute inset-x-4 bottom-4 space-y-3">
        <div className="h-7 w-44 rounded-full bg-white/10" />
        <div className="h-4 w-56 rounded-full bg-white/8" />
        <div className="h-4 w-36 rounded-full bg-white/8" />
      </div>
    </div>
  );
}

function EmptyMatch({ mode, onRetry }) {
  const title = mode === 'random' ? 'No active random users' : 'No active users nearby';
  const text = mode === 'random'
    ? 'Random only shows people who are online right now.'
    : 'Nearby only shows online people around your current location.';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="grid h-[26rem] place-items-center p-6 text-center"
    >
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/8 text-mint">
          {mode === 'random' ? <Shuffle size={24} /> : <MapPin size={24} />}
        </span>
        <p className="mt-4 font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-6 text-white/52">{text}</p>
        <button onClick={onRetry} className="btn-secondary mt-5 rounded-full px-4 py-2 text-sm font-semibold">
          Check again
        </button>
      </div>
    </motion.div>
  );
}

function ActionButton({ label, icon: Icon, onClick, primary = false, active = false, disabled = false }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`grid h-14 w-14 place-items-center rounded-full text-[10px] font-semibold transition disabled:opacity-35 ${primary ? 'bg-gradient-to-br from-mint to-sky text-ink shadow-[0_10px_24px_rgba(61,214,198,0.18)]' : active ? 'bg-gradient-to-br from-gold to-mint text-ink' : label === 'Report' ? 'bg-rose/12 text-rose hover:bg-rose/18' : 'bg-white/9 text-white/74 hover:bg-white/14'}`}
      aria-label={label}
    >
      <span className="grid gap-0.5 justify-items-center">
        <Icon size={18} />
        <span>{label}</span>
      </span>
    </button>
  );
}

function ModeButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-2 rounded-[16px] px-3 py-3 text-sm font-semibold ${active ? 'btn-primary' : 'btn-secondary'}`}>
      <Icon size={17} />
      {label}
    </button>
  );
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}
