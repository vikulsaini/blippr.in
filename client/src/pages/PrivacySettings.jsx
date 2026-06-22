import { useEffect, useState } from 'react';
import { ArrowLeft, Ban, LockKeyhole, Save, Shield, Unlock } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { showToast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';

export default function PrivacySettings() {
  const navigate = useNavigate();
  const { me, setMe } = useOutletContext() || {};
  const [loading, setLoading] = useState(!me);
  const [showLastSeen, setShowLastSeen] = useState(me?.privacy?.showLastSeen !== false);
  const [readReceipts, setReadReceipts] = useState(me?.privacy?.readReceipts !== false);
  const [vaultPassword, setVaultPassword] = useState('');
  const [blockedUsers, setBlockedUsers] = useState([]);

  useEffect(() => {
    if (me) {
      setShowLastSeen(me.privacy?.showLastSeen !== false);
      setReadReceipts(me.privacy?.readReceipts !== false);
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    async function loadBlocked() {
      const { users: blocked } = await api('/api/safety/blocked');
      setBlockedUsers(blocked);
    }
    loadBlocked().catch((err) => showToast(err.message, 'error'));
  }, []);

  async function savePrivacy(event) {
    if (event) event.preventDefault();
    try {
      const { user: updated } = await api('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          privacy: {
            showLastSeen,
            readReceipts
          }
        })
      });
      setMe?.(updated);
      showToast('Privacy settings saved successfully', 'success');
      navigate('/app/profile');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function saveVaultPassword() {
    try {
      await api('/api/users/me/vault', {
        method: 'POST',
        body: JSON.stringify({ vaultPassword: vaultPassword.trim() || null })
      });
      showToast(vaultPassword.trim() ? 'Vault password set' : 'Vault password removed', 'success');
      setVaultPassword('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function unblockUser(userId) {
    try {
      await api('/api/safety/unblock', {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
      setBlockedUsers((current) => current.filter((u) => u._id !== userId));
      showToast('User unblocked', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto bg-bg animate-pulse p-6 mt-12 space-y-6">
        <div className="h-10 w-24 bg-surface rounded skeleton" />
        <div className="h-32 rounded-2xl bg-surface skeleton" />
        <div className="h-48 rounded-2xl bg-surface skeleton" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg md:max-w-xl py-6 px-4 bg-bg text-text-primary pb-24 scrollbar-none">
      
      {/* Header */}
      <header className="flex items-center gap-3.5 mb-8">
        <button 
          onClick={() => navigate('/app/profile')} 
          className="text-primary hover:opacity-80 p-2 -ml-2 rounded-full transition active:scale-95" 
          aria-label="Back to profile"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Privacy &amp; Security</h2>
          <p className="text-xs text-text-muted">Control your visibility and safety preferences</p>
        </div>
      </header>

      <div className="space-y-6">
        
        {/* Toggle Settings Form */}
        <form onSubmit={savePrivacy} className="space-y-5">
          <div className="glass-panel rounded-3xl p-2 space-y-1 shadow-card">
            <ToggleRow 
              title="Show Last Active" 
              subtitle="Allow friends to see your offline presence timer" 
              checked={showLastSeen} 
              onChange={() => setShowLastSeen(!showLastSeen)} 
            />
            <ToggleRow 
              title="Read Receipts" 
              subtitle="Send visible seen confirmation on incoming messages" 
              checked={readReceipts} 
              onChange={() => setReadReceipts(!readReceipts)} 
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-primary hover:brightness-110 text-white font-bold text-sm py-4 rounded-full shadow-glow active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Save size={16} />
            Save Visibility Settings
          </button>
        </form>

        {/* Hidden Chat Vault Card */}
        <div className="glass-panel rounded-3xl p-5 shadow-card space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <LockKeyhole size={18} />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Hidden Chat Vault</h3>
          </div>
          <p className="text-[11px] leading-relaxed text-text-muted font-medium">
            Set a custom password to hide archived conversation feeds. Type this password in Blippr's search inputs to reveal and unlock your hidden vaults.
          </p>
          <label className="block">
            <span className="text-xs font-bold text-text-muted ml-1">Vault Password (leave empty to remove)</span>
            <div className="mt-1.5 bg-[#171f33]/40 border border-white/10 rounded-2xl p-0.5 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/45 transition-all">
              <input 
                type="password"
                value={vaultPassword} 
                onChange={(e) => setVaultPassword(e.target.value)} 
                placeholder="Enter Vault Password" 
                className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold px-4 py-3 placeholder-white/20 text-white outline-none"
              />
            </div>
          </label>
          <button 
            type="button" 
            onClick={saveVaultPassword} 
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl py-2.5 text-xs font-bold transition"
          >
            Update Vault Password
          </button>
        </div>

        {/* Blocked Users Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-1">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-danger/10 text-danger"><Ban size={17} /></span>
            <div>
              <p className="text-xs font-bold text-white">Blocked Users</p>
              <p className="text-[10px] text-text-muted font-medium">{blockedUsers.length ? `${blockedUsers.length} users match-restricted` : 'No blocked users'}</p>
            </div>
          </div>
          <div className="space-y-2">
            {blockedUsers.map((blockedUser) => (
              <div key={blockedUser._id} className="flex items-center justify-between gap-3 bg-[#171f33]/40 border border-white/5 rounded-2xl p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={blockedUser.avatar} alt="" className="h-10 w-10 rounded-full bg-[#0b1326] object-cover border border-white/5" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white leading-tight">{blockedUser.name}</p>
                    <p className="truncate text-[10px] text-text-muted mt-0.5">@{blockedUser.username}</p>
                  </div>
                </div>
                <button 
                  onClick={() => unblockUser(blockedUser._id)} 
                  className="bg-primary hover:brightness-110 text-white p-2.5 rounded-full shrink-0 active:scale-95 transition" 
                  aria-label={`Unblock ${blockedUser.name}`}
                  title="Unblock User"
                >
                  <Unlock size={14} />
                </button>
              </div>
            ))}
            {!blockedUsers.length && (
              <p className="bg-[#171f33]/20 border border-white/5 rounded-2xl px-4 py-4 text-center text-xs text-text-faint font-semibold">
                Blocked people will appear here.
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function ToggleRow({ title, subtitle, checked, onChange }) {
  return (
    <button 
      type="button" 
      onClick={onChange} 
      className="flex w-full items-center justify-between p-3.5 hover:bg-white/5 active:bg-white/10 rounded-2xl transition text-left"
    >
      <div className="min-w-0 flex-1 pr-4">
        <p className="text-sm font-semibold text-white truncate">{title}</p>
        <p className="text-xs text-text-muted mt-0.5 leading-normal">{subtitle}</p>
      </div>
      <span className={`relative h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out flex ${checked ? 'bg-primary' : 'bg-white/10'}`}>
        <motion.span
          animate={{ 
            x: checked ? 20 : 0,
            scaleX: [1, 1.25, 1],
          }}
          transition={{ 
            x: { type: 'spring', stiffness: 500, damping: 28 },
            scaleX: { duration: 0.22, ease: 'easeInOut' }
          }}
          className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 origin-center"
        />
      </span>
    </button>
  );
}
