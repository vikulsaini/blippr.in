import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Search, UserRound, UserPlus } from 'lucide-react';
import UserProfileModal from '../components/UserProfileModal.jsx';
import { api } from '../lib/api.js';
import { presenceText } from '../lib/presence.js';
import { showToast } from '../components/Toast.jsx';

export default function Discover() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [sentIds, setSentIds] = useState(new Set());
  const [profileUser, setProfileUser] = useState(null);
  const [me, setMe] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api('/api/users/me').then(({ user }) => setMe(user)).catch(() => {});
    api('/api/users/suggested')
      .then(({ users }) => setSuggested(users))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setUsers([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const [data, sent] = await Promise.all([
          api(`/api/users/search?q=${encodeURIComponent(query.trim())}`),
          api('/api/friends/requests/sent')
        ]);
        setUsers(data.users);
        setSentIds(new Set(sent.requests.map((request) => request.to._id)));
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  async function sendRequest(userId) {
    if (sentIds.has(userId)) return;
    try {
      await api('/api/friends/requests', { method: 'POST', body: JSON.stringify({ userId }) });
      setSentIds((current) => new Set([...current, userId]));
      showToast('Friend request sent!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function shareProfile() {
    if (!me?.username) return;
    const value = `${window.location.origin}/u/${me.username}`;
    await navigator.clipboard?.writeText(value);
    showToast('Profile link copied!', 'success');
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-2">
      <section className="surface-card rounded-[24px] p-3 bg-surface shadow-card">
        <label className="search-container">
          <Search size={18} className="text-accent shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search @username or name"
          />
        </label>
      </section>

      {searching ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-3 rounded-[18px] border border-border-default bg-surface p-3 shadow-card">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-12 w-12 rounded-full skeleton shrink-0" />
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="h-3 w-28 rounded-full skeleton" />
                  <div className="h-2.5 w-40 rounded-full skeleton" />
                </div>
              </div>
              <div className="h-10 w-10 rounded-full skeleton shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {users.map((user, index) => (
              <UserRow key={user._id} user={user} index={index} sent={sentIds.has(user._id)} onProfile={setProfileUser} onAdd={sendRequest} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {!query.trim() && (
        <div className="space-y-6">
          <div className="surface-card rounded-[24px] p-6 text-center bg-surface shadow-card">
            <span className="tone-ring mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-light text-accent">
              <UserRound size={21} />
            </span>
            <p className="mt-3 font-semibold text-text-primary">Search people</p>
            <p className="mt-1 text-sm text-text-muted">Example: @vikul or "Riya"</p>
            <button type="button" onClick={shareProfile} disabled={!me?.username} className="btn-secondary mx-auto mt-4 flex items-center gap-2.5 rounded-full px-6 py-3 text-sm font-bold disabled:opacity-40 transition-all shadow-sm">
              <Copy size={15} />
              Share my profile
            </button>
          </div>

          {suggested.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-accent pl-1">Suggested People</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {suggested.map((user, index) => (
                  <UserRow key={user._id} user={user} index={index} sent={sentIds.has(user._id)} onProfile={setProfileUser} onAdd={sendRequest} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {query.trim() && !users.length && !searching && (
        <div className="surface-card rounded-[24px] p-8 text-center bg-surface shadow-card">
          <span className="tone-ring mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-light text-accent">
            <Search size={21} />
          </span>
          <p className="mt-3 font-semibold text-text-primary">No users found</p>
          <p className="mt-1 text-sm text-text-muted">Try another username or name.</p>
        </div>
      )}

      <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} />
    </div>
  );
}

function UserRow({ user, sent, onProfile, onAdd, index }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.035, duration: 0.22 }}
      className="interactive-card group flex items-center justify-between gap-3 rounded-[18px] p-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={() => onProfile(user)} className="relative shrink-0 overflow-hidden rounded-full border border-border-default" aria-label={`View ${user.name} profile`}>
          <img src={user.avatar} alt="" className="h-12 w-12 rounded-full bg-bg object-cover transition-transform duration-300 group-hover:scale-110" />
          {user.isOnline && <span className="absolute bottom-0 right-0 status-dot online" />}
        </button>
        <div className="min-w-0">
          <p className="truncate font-semibold text-text-primary group-hover:text-accent transition-colors">{user.name}</p>
          <p className="truncate text-xs text-text-muted">@{user.username} · {user.gender} · {user.age}</p>
          {user.bio && <p className="truncate text-[11px] text-text-muted italic max-w-[180px]">"{user.bio}"</p>}
          <p className={`truncate text-xs ${user.isOnline ? 'text-accent font-medium' : 'text-text-faint'}`}>{presenceText(user)}</p>
        </div>
      </div>
      <RequestButton sent={sent} onClick={() => onAdd(user._id)} label={user.name} />
    </motion.article>
  );
}

function RequestButton({ sent, onClick, label }) {
  return (
    <button onClick={onClick} disabled={sent} className={`shrink-0 rounded-full p-2.5 transition min-h-[44px] min-w-[44px] flex items-center justify-center ${sent ? 'bg-success text-white shadow-sm disabled:opacity-90' : 'btn-primary'}`} aria-label={sent ? `Request sent to ${label}` : `Add ${label}`}>
      {sent ? <Check size={18} /> : <UserPlus size={18} />}
    </button>
  );
}
