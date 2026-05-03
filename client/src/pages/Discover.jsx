import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Search, UserPlus } from 'lucide-react';
import UserProfileModal from '../components/UserProfileModal.jsx';
import { api } from '../lib/api.js';
import { presenceText } from '../lib/presence.js';

export default function Discover() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [sentIds, setSentIds] = useState(new Set());
  const [profileUser, setProfileUser] = useState(null);
  const [message, setMessage] = useState('');

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

  return (
    <div className="space-y-4">
      <section className="glass rounded-3xl p-3">
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
          <Search size={18} className="text-white/45" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search @username or name" />
        </label>
      </section>

      {message && <p className="rounded-2xl border border-mint/20 bg-mint/10 px-4 py-3 text-sm text-mint">{message}</p>}

      <section className="space-y-3">
        {users.map((user, index) => (
          <UserRow key={user._id} user={user} index={index} sent={sentIds.has(user._id)} onProfile={setProfileUser} onAdd={sendRequest} />
        ))}
      </section>

      {!query.trim() && (
        <div className="rounded-3xl border border-white/10 bg-white/8 p-8 text-center">
          <p className="font-medium">Search people</p>
          <p className="mt-1 text-sm text-white/52">Type a name or username to find someone.</p>
        </div>
      )}

      {query.trim() && !users.length && !message && (
        <div className="rounded-3xl border border-white/10 bg-white/8 p-8 text-center">
          <p className="font-medium">No users found</p>
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
      className="glass flex items-center justify-between gap-3 rounded-2xl p-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={() => onProfile(user)} aria-label={`View ${user.name} profile`}>
          <img src={user.avatar} alt="" className="h-14 w-14 rounded-2xl bg-white/12 object-cover" />
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
    <button onClick={onClick} disabled={sent} className={`shrink-0 rounded-full p-3 text-ink ${sent ? 'bg-white' : 'bg-mint'}`} aria-label={sent ? `Request sent to ${label}` : `Add ${label}`}>
      {sent ? <Check size={18} /> : <UserPlus size={18} />}
    </button>
  );
}
