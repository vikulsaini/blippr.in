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
    <div className="mx-auto w-full max-w-lg md:max-w-xl py-6 px-4 bg-bg text-text-primary pb-24">
      {/* Header */}
      <header className="flex items-center gap-3.5 mb-6">
        <button 
          onClick={() => navigate('/app/profile')} 
          className="btn-icon h-10 w-10 flex items-center justify-center rounded-full hover:bg-surface-hover transition active:scale-95" 
          aria-label="Back to profile"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Privacy & security</h2>
          <p className="text-xs text-text-muted">Control your visibility and safety preferences</p>
        </div>
      </header>

      <div className="space-y-6">
        {/* Toggle Settings Form */}
        <form onSubmit={savePrivacy} className="space-y-5">
          <div className="surface-card rounded-[22px] border border-border-default bg-surface p-5 shadow-card space-y-5">
            <ToggleRow 
              title="Show last seen" 
              subtitle="Let friends see when you were last active" 
              checked={showLastSeen} 
              onChange={() => setShowLastSeen(!showLastSeen)} 
            />
            <ToggleRow 
              title="Read receipts" 
              subtitle="Send seen status when you read messages" 
              checked={readReceipts} 
              onChange={() => setReadReceipts(!readReceipts)} 
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-bold shadow-accent-sm hover:opacity-95 transition-all duration-200"
          >
            <Save size={16} />
            Save Visibility Settings
          </button>
        </form>

        {/* Hidden Chat Vault Card */}
        <div className="surface-card rounded-[22px] border border-border-default bg-surface p-5 shadow-card space-y-4">
          <div className="flex items-center gap-2 text-accent">
            <LockKeyhole size={18} />
            <h3 className="text-xs font-extrabold text-text-primary">Hidden Chat Vault</h3>
          </div>
          <p className="text-[11px] leading-relaxed text-text-muted font-semibold">
            Set a password to hide archived chats. Type this password in Blippr's search bar to reveal and unlock your hidden vaults.
          </p>
          <label className="block">
            <span className="text-xs font-bold text-text-muted">Vault Password (leave empty to remove)</span>
            <input 
              type="password"
              value={vaultPassword} 
              onChange={(e) => setVaultPassword(e.target.value)} 
              placeholder="Enter Vault Password" 
              className="mt-2 w-full rounded-xl border border-border-default bg-bg px-4 py-3 text-xs text-text-primary outline-none focus:border-accent transition-colors font-semibold"
            />
          </label>
          <button 
            type="button" 
            onClick={saveVaultPassword} 
            className="btn-secondary w-full rounded-xl py-2.5 text-xs font-bold transition"
          >
            Update Vault Password
          </button>
        </div>

        {/* Blocked Users Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-1">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-danger/10 text-danger"><Ban size={17} /></span>
            <div>
              <p className="text-xs font-bold text-text-primary">Blocked users</p>
              <p className="text-[10px] text-text-muted font-medium">{blockedUsers.length ? `${blockedUsers.length} users hidden from matching` : 'No blocked users'}</p>
            </div>
          </div>
          <div className="space-y-2">
            {blockedUsers.map((blockedUser) => (
              <div key={blockedUser._id} className="flex items-center gap-3 rounded-2xl border border-border-default bg-surface p-3 shadow-card transition duration-200">
                <img src={blockedUser.avatar} alt="" className="h-10 w-10 rounded-full bg-bg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-text-primary">{blockedUser.name}</p>
                  <p className="truncate text-[10px] text-text-muted mt-0.5">@{blockedUser.username}</p>
                </div>
                <button 
                  onClick={() => unblockUser(blockedUser._id)} 
                  className="btn-primary grid h-9 w-9 place-items-center rounded-xl shrink-0" 
                  aria-label={`Unblock ${blockedUser.name}`}
                >
                  <Unlock size={15} />
                </button>
              </div>
            ))}
            {!blockedUsers.length && (
              <p className="rounded-2xl border border-border-default bg-bg px-4 py-4 text-center text-xs text-text-faint font-semibold">
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
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-text-primary">{title}</p>
        <p className="text-[10px] text-text-muted mt-1 leading-normal font-semibold">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-accent' : 'bg-border-default'}`}
      >
        <motion.span
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0"
        />
      </button>
    </div>
  );
}
