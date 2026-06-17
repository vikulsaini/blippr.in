import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Search, UserRound, UserPlus } from 'lucide-react';
import UserProfileModal from '../components/UserProfileModal.jsx';
import { api } from '../lib/api.js';
import { presenceText } from '../lib/presence.js';

export default function Discover() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [sentIds, setSentIds] = useState(new Set());
  const [profileUser, setProfileUser] = useState(null);
  const [me, setMe] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api('/api/users/me').then(({ user }) => setMe(user)).catch(() => {});
    api('/api/users/suggested')
      .then(({ users }) => setSuggested(users))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setUsers([]);
      setMessage('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const [data, sent] = await Promise.all([
          api(`/api/users/search?q=${encodeURIComponent(query.trim())}`),
          api('/api/friends/requests/sent')
        ]);
        setUsers(data.users);
        setSentIds(new Set(sent.requests.map((request) => request.to._id)));
        setMessage('');
      } catch (err) {
        setMessage(err.message);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  async function sendRequest(userId) {
    if (sentIds.has(userId)) return;
    try {
      await api('/api/friends/requests', { method: 'POST', body: JSON.stringify({ userId }) });
      setSentIds((current) => new Set([...current, userId]));
      setMessage('Friend request sent');
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function shareProfile() {
    if (!me?.username) return;
    const value = `${window.location.origin}/u/${me.username}`;
    await navigator.clipboard?.writeText(value);
    setMessage('Profile link copied');
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <section className="depth-panel rounded-[20px] p-2 md:p-3">
        <label className="flex items-center gap-3 rounded-[16px] border border-slate-300 dark:border-slate-700/80 bg-ink px-4 py-3 shadow-nm-inset-sm transition focus-within:border-mint focus-within:ring-1 focus-within:ring-mint/30">
          <Search size={18} className="text-mint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="Search @username or name" />
        </label>
      </section>

      {message && <p className="rounded-[16px] border border-mint/20 bg-mint/10 px-4 py-3 text-sm text-mint">{message}</p>}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {users.map((user, index) => (
          <UserRow key={user._id} user={user} index={index} sent={sentIds.has(user._id)} onProfile={setProfileUser} onAdd={sendRequest} />
        ))}
      </section>

      {!query.trim() && (
        <div className="space-y-6">
          <div className="depth-panel rounded-[24px] p-6 text-center">
            <span className="tone-ring mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-mint/10 text-mint">
              <UserRound size={21} />
            </span>
            <p className="mt-3 font-medium text-slate-800 dark:text-slate-200">Search people</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 font-semibold">Example: @vikul or "Riya"</p>
            <button type="button" onClick={shareProfile} disabled={!me?.username} className="border-2 border-mint text-mint bg-transparent hover:bg-mint/8 mx-auto mt-4 flex items-center gap-2.5 rounded-full px-6 py-3 text-sm font-bold disabled:opacity-40 transition-all active:scale-95 shadow-sm">
              <Copy size={15} />
              Share my profile
            </button>
          </div>

          {suggested.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-mint pl-1">Suggested People</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {suggested.map((user, index) => (
                  <UserRow key={user._id} user={user} index={index} sent={sentIds.has(user._id)} onProfile={setProfileUser} onAdd={sendRequest} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {query.trim() && !users.length && !message && (
        <div className="depth-panel rounded-[24px] p-8 text-center">
          <span className="tone-ring mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-mint/10 text-mint">
            <Search size={21} />
          </span>
          <p className="mt-3 font-medium">No users found</p>
          <p className="mt-1 text-sm text-white/52">Try another username or name.</p>
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
      transition={{ delay: index * 0.035, duration: 0.22 }}
      className="interactive-card flex items-center justify-between gap-3 rounded-[18px] p-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={() => onProfile(user)} className="relative" aria-label={`View ${user.name} profile`}>
          <img src={user.avatar} alt="" className="h-12 w-12 rounded-full bg-ink object-cover shadow-nm-inset-sm" />
          {user.isOnline && <span className="live-dot absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-mint text-mint" />}
        </button>
        <div className="min-w-0">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-xs text-white/55">@{user.username} - {user.gender} - {user.age}</p>
          <p className={`truncate text-xs ${user.isOnline ? 'text-mint' : 'text-white/45'}`}>{presenceText(user)}</p>
        </div>
      </div>
      <RequestButton sent={sent} onClick={() => onAdd(user._id)} label={user.name} />
    </motion.article>
  );
}

function RequestButton({ sent, onClick, label }) {
  return (
    <button onClick={onClick} disabled={sent} className={`shrink-0 rounded-full p-3 ${sent ? 'btn-primary' : 'btn-primary'}`} aria-label={sent ? `Request sent to ${label}` : `Add ${label}`}>
      {sent ? <Check size={18} /> : <UserPlus size={18} />}
    </button>
  );
}
