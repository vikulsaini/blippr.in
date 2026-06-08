import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Search, Sparkles, UserPlus } from 'lucide-react';
import UserProfileModal from '../components/UserProfileModal.jsx';
import { api } from '../lib/api.js';
import { presenceText } from '../lib/presence.js';

export default function Discover() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [sentIds, setSentIds] = useState(new Set());
  const [profileUser, setProfileUser] = useState(null);
  const [me, setMe] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api('/api/users/me').then(({ user }) => setMe(user)).catch(() => {});
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
        <label className="flex items-center gap-3 rounded-[16px] border border-white/8 bg-white/5 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <Search size={18} className="text-white/45" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search @username or name" />
        </label>
      </section>

      {message && <p className="rounded-[16px] border border-mint/20 bg-mint/10 px-4 py-3 text-sm text-mint">{message}</p>}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {users.map((user, index) => (
          <UserRow key={user._id} user={user} index={index} sent={sentIds.has(user._id)} onProfile={setProfileUser} onAdd={sendRequest} />
        ))}
      </section>

      {!query.trim() && (
        <div className="depth-panel rounded-[24px] p-8 text-center">
          <span className="tone-ring mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-sky/10 text-sky">
            <Sparkles size={21} />
          </span>
          <p className="mt-3 font-medium">Search people</p>
          <p className="mt-1 text-sm text-white/52">Example: @vikul or "Riya"</p>
          <button type="button" onClick={shareProfile} disabled={!me?.username} className="btn-secondary mx-auto mt-4 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-40">
            <Copy size={14} />
            Share my profile
          </button>
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
      className="interactive-card depth-panel flex items-center justify-between gap-3 rounded-[18px] p-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={() => onProfile(user)} className="relative" aria-label={`View ${user.name} profile`}>
          <img src={user.avatar} alt="" className="h-12 w-12 rounded-full bg-white/12 object-cover" />
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
