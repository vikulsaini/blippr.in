import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Flag, MapPin, RotateCw, Shuffle, UserPlus } from 'lucide-react';
import UserProfileModal from '../components/UserProfileModal.jsx';
import { api } from '../lib/api.js';
import { presenceText } from '../lib/presence.js';
import { getRealtimeSocket } from '../lib/realtime.js';

export default function Stranger() {
  const [available, setAvailable] = useState([]);
  const [sentIds, setSentIds] = useState(new Set());
  const [profileUser, setProfileUser] = useState(null);
  const [status, setStatus] = useState('Loading matches...');
  const [source, setSource] = useState('nearby');
  const [mode, setMode] = useState('nearby');
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const dragMovedRef = useRef(false);
  const swipeLockedRef = useRef(false);
  const controls = useAnimation();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-140, 0, 140], [-5, 0, 5]);

  useEffect(() => {
    loadMatch();
  }, []);

  useEffect(() => {
    controls.start({ x: 0, opacity: 1, scale: 1, transition: { duration: 0.18 } });
  }, [activeIndex, controls]);

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
      const { user } = await api('/api/users/me');
      if (user.location?.coordinates?.length) {
        await refreshLocationInBackground();
      } else if (!sessionStorage.getItem('varta_location_prompted')) {
        sessionStorage.setItem('varta_location_prompted', 'true');
        await requestAndSaveLocation();
      }
      await loadAvailable();
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function loadAvailable() {
    setMode('nearby');
    setLoading(true);
    try {
      const [data, sent] = await Promise.all([
        api('/api/users/available'),
        api('/api/friends/requests/sent')
      ]);
      setAvailable(shuffle(data.users));
      setSentIds(new Set(sent.requests.map((request) => request.to._id)));
      setSource(data.source);
      setActiveIndex(0);
      setStatus(data.users.length ? `${data.users.length} available ${data.source} matches` : 'No new nearby or online users right now.');
    } finally {
      setLoading(false);
    }
  }

  async function loadRandomAvailable() {
    try {
      setStatus('Shuffling random people...');
      setLoading(true);
      setMode('random');
      const [data, sent] = await Promise.all([
        api('/api/users/available/random'),
        api('/api/friends/requests/sent')
      ]);
      setAvailable(shuffle(data.users));
      setSentIds(new Set(sent.requests.map((request) => request.to._id)));
      setSource(data.source);
      setActiveIndex(0);
      setStatus(data.users.length ? `${data.users.length} random users from anywhere` : 'No random users available right now.');
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
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
    controls.set({ x: 0, opacity: 1, scale: 1 });
  }

  function previousUser() {
    setActiveIndex((index) => (available.length ? (index - 1 + available.length) % available.length : 0));
    controls.set({ x: 0, opacity: 1, scale: 1 });
  }

  async function completeSwipe(direction) {
    if (!activeUser || swipeLockedRef.current) return;
    swipeLockedRef.current = true;
    const offset = direction === 'next' ? 460 : -460;
    await controls.start({
      x: offset,
      opacity: 0,
      scale: 0.94,
      transition: { type: 'spring', stiffness: 260, damping: 28 }
    });
    direction === 'next' ? nextUser() : previousUser();
    swipeLockedRef.current = false;
  }

  function resetSwipe() {
    controls.start({
      x: 0,
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
    <div className="space-y-4">
      <section className="flex items-center gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 text-sm">
          <Badge icon={mode === 'random' ? Shuffle : MapPin} label={source === 'random' ? 'Random anywhere' : source === 'nearby' ? 'Nearby first' : 'Online fallback'} />
          <Badge icon={Shuffle} label={status} />
        </div>
        <button onClick={loadMatch} className="surface grid h-11 w-11 shrink-0 place-items-center rounded-[16px]" aria-label="Refresh matches">
          <RotateCw size={18} />
        </button>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <ModeButton active={mode === 'nearby'} onClick={loadMatch} icon={MapPin} label="Nearby" />
        <ModeButton active={mode === 'random'} onClick={loadRandomAvailable} icon={Shuffle} label="Random anywhere" />
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-12 left-0 z-0 flex items-center">
          <span className="rounded-full border border-white/10 bg-white/8 p-3 text-white/45"><ChevronRight size={22} /></span>
        </div>
        <div className="pointer-events-none absolute inset-y-12 right-0 z-0 flex items-center">
          <span className="rounded-full border border-white/10 bg-white/8 p-3 text-white/45"><ChevronLeft size={22} /></span>
        </div>
      <motion.section
        key={activeUser?._id || 'empty'}
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
        className="surface relative z-10 overflow-hidden rounded-[24px]"
      >
        {loading ? (
          <MatchSkeleton />
        ) : activeUser?.avatar ? (
          <button
            onClick={() => {
              if (!dragMovedRef.current) setProfileUser(activeUser);
            }}
            className="relative block w-full"
            aria-label={`View ${activeUser.name} profile`}
          >
            <img src={activeUser.avatar} alt="" className="h-[28rem] max-h-[56vh] w-full bg-white/10 object-cover" />
            <div className="absolute left-4 top-4 flex gap-2">
              <span className="rounded-full bg-ink/70 px-3 py-1 text-xs text-white">Right: next</span>
              <span className="rounded-full bg-ink/70 px-3 py-1 text-xs text-white">Left: previous</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/72 to-transparent p-4 pt-24 text-left">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-2xl font-semibold">{activeUser.name}</h3>
                  <p className="mt-1 truncate text-sm text-white/70">@{activeUser.username} - {activeUser.gender} - {activeUser.age}</p>
                  <p className={`mt-1 text-sm ${activeUser.isOnline ? 'text-mint' : 'text-white/55'}`}>{presenceText(activeUser)}</p>
                </div>
                <span className={`h-3 w-3 rounded-full ${activeUser.isOnline ? 'bg-mint' : 'bg-white/35'}`} />
              </div>
              {activeUser.bio && <p className="mt-3 line-clamp-2 text-sm text-white/72">{activeUser.bio}</p>}
            </div>
          </button>
        ) : (
          <div className="grid h-[26rem] place-items-center p-6 text-center">
            <div>
              <p className="font-semibold">No new matches</p>
              <p className="mt-1 text-sm text-white/52">Friends and existing chats are hidden from Match.</p>
            </div>
          </div>
        )}
      </motion.section>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <ActionButton label="Prev" onClick={() => completeSwipe('previous')} icon={ChevronLeft} disabled={!activeUser || loading} />
        <ActionButton label="Report" icon={Flag} onClick={reportActiveUser} disabled={!activeUser || loading || actionBusy} />
        <ActionButton label={requestSent ? 'Cancel' : 'Add'} onClick={() => activeUser && addFriend(activeUser._id)} icon={requestSent ? Check : UserPlus} active={requestSent} disabled={!activeUser || loading || actionBusy} />
        <ActionButton label="Next" onClick={() => completeSwipe('next')} icon={Shuffle} primary disabled={!activeUser || loading} />
      </div>

      <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} />
    </div>
  );
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

function Badge({ icon: Icon, label }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[16px] border border-white/8 bg-white/5 px-3 py-2">
      <Icon size={15} className="shrink-0 text-mint" />
      <span className="truncate text-xs text-white/62">{label}</span>
    </div>
  );
}

function ActionButton({ label, icon: Icon, onClick, primary = false, active = false, disabled = false }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`flex flex-col items-center gap-1 rounded-[16px] p-3 text-xs font-medium disabled:opacity-35 ${primary ? 'bg-white text-ink' : active ? 'bg-mint text-ink' : 'surface text-white/72'}`}>
      <Icon size={19} />
      {label}
    </button>
  );
}

function ModeButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-2 rounded-[16px] px-3 py-3 text-sm font-semibold ${active ? 'bg-white text-ink' : 'surface text-white/70'}`}>
      <Icon size={17} />
      {label}
    </button>
  );
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}
