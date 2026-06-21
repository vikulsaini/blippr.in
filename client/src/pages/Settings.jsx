import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Ban, Bell, Camera, ChevronRight, Database, FileText, LockKeyhole, LogOut, MapPin, Music, Save, Settings, Shield, Smartphone, Trash2, Unlock, UserRound, Volume2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import ConfirmSheet from '../components/ConfirmSheet.jsx';
import InstallAppButton from '../components/InstallAppButton.jsx';
import { showToast } from '../components/Toast.jsx';
import { api, clearSession } from '../lib/api.js';
import { clearBlipprCache } from '../lib/cache.js';
import { enablePushNotifications } from '../lib/notifications.js';
import { previewSound } from '../lib/sounds.js';
import { loadSoundPrefs, mediaToSound, packSound, saveSoundPrefs, setSoundPreference, soundPack } from '../lib/soundPrefs.js';
import { useUserProfile } from '../hooks/useUserProfile.js';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { me, setMe } = useOutletContext() || {};
  const [user, setUser] = useState(me);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState('home');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [soundPrefs, setSoundPrefs] = useState(() => loadSoundPrefs());
  const photoInputRef = useRef(null);
  const [vaultPassword, setVaultPassword] = useState('');
  const {
    form,
    photoUploading,
    setField,
    uploadProfilePhoto,
    saveProfile: baseSaveProfile
  } = useUserProfile(me, setMe, {
    onSuccess: (updated) => {
      setUser(updated);
    }
  });

  const saveProfile = (event) => baseSaveProfile(event, true);

  useEffect(() => {
    if (me) {
      setUser(me);
    }
  }, [me]);

  useEffect(() => {
    async function loadBlocked() {
      const { users: blocked } = await api('/api/safety/blocked');
      setBlockedUsers(blocked);
    }
    loadBlocked().catch((err) => setMessage(err.message));
  }, []);

  useEffect(() => {
    function handleSoundPrefs(event) {
      setSoundPrefs(event.detail || loadSoundPrefs());
    }
    window.addEventListener('blippr:sound-prefs', handleSoundPrefs);
    return () => window.removeEventListener('blippr:sound-prefs', handleSoundPrefs);
  }, []);

  async function saveVaultPassword(event) {
    if (event) event.preventDefault();
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

  async function refreshLocation() {
    if (!navigator.geolocation) {
      showToast('Location is not supported in this browser', 'error');
      return;
    }

    showToast('Refreshing location...', 'info');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { user: updated } = await api('/api/users/me/location', {
            method: 'PATCH',
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            })
          });
          setUser(updated);
          showToast('Location updated for random rooms', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      () => showToast('Location permission was denied', 'error')
    );
  }

  async function turnOnNotifications() {
    try {
      await enablePushNotifications();
      showToast('Push notifications enabled', 'success');
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
      setBlockedUsers((current) => current.filter((blockedUser) => blockedUser._id !== userId));
      showToast('User unblocked', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearBlipprCache();
    await clearSession();
    navigate('/auth', { replace: true });
  }

  async function exportData() {
    try {
      const data = await api('/api/users/me/export');
      const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'blippr-account-export.json';
      link.click();
      URL.revokeObjectURL(url);
      showToast('Account export prepared', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteAccount() {
    await api('/api/users/me', { method: 'DELETE' });
    clearBlipprCache();
    localStorage.removeItem('blippr_token');
    localStorage.removeItem('blippr_is_guest');
    navigate('/auth', { replace: true });
  }

  async function uploadSound(key, file) {
    try {
      const sound = await mediaToSound(file);
      setSoundPrefs(setSoundPreference(key, sound));
      showToast(`${key === 'ringtone' ? 'Call ringtone' : 'Chat notification'} updated`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function updateSound(key, sound) {
    setSoundPrefs(setSoundPreference(key, sound));
  }

  function toggleDnd() {
    const next = saveSoundPrefs({ dnd: !soundPrefs.dnd });
    setSoundPrefs(next);
  }

  if (!user && !message) return <ProfileSkeleton />;

  return (
    <div className="chat-dark-theme mx-auto w-full max-w-lg md:max-w-2xl py-6 px-4 bg-bg text-text-primary pb-24 scrollbar-none">
      
      {/* Settings Header */}
      <header className="flex items-center gap-3.5 mb-8">
        <button 
          onClick={() => (activeSection === 'home' ? navigate('/app/profile') : setActiveSection('home'))} 
          className="text-primary hover:opacity-80 p-2 -ml-2 rounded-full transition active:scale-95" 
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h2 className="text-xl font-black text-text-primary tracking-tight">{settingsTitle(activeSection)}</h2>
          <p className="text-xs text-text-muted">{settingsSubtitle(activeSection)}</p>
        </div>
      </header>

      {message && (
        <p className="rounded-2xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger mb-4">
          {message}
        </p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          
          {/* HOME PANEL */}
          {activeSection === 'home' && (
            <div className="space-y-6">
              
              {/* Account & Preferences */}
              <div className="glass-panel rounded-3xl p-2 space-y-1 shadow-card">
                <p className="text-[10px] font-black uppercase tracking-wider text-primary px-3.5 py-2">Account &amp; Preferences</p>
                <MenuRow icon={UserRound} iconColor="bg-primary/10 text-primary" title="Profile Settings" subtitle="Photo, name, username, age, gender and bio" onClick={() => setActiveSection('profile')} />
                <MenuRow icon={Bell} iconColor="bg-success/10 text-success" title="Notifications &amp; Sound" subtitle="Push, ringtone, chat tone and quiet mode" onClick={() => setActiveSection('notifications')} />
                <div 
                  className="flex w-full items-center justify-between p-3.5 rounded-2xl opacity-60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-accent/15 text-accent">
                      <Sparkles size={18} />
                    </div>
                    <div className="text-left min-w-0">
                      <span className="block text-sm font-semibold text-text-primary truncate">Theme Appearance</span>
                      <span className="block text-xs text-text-muted mt-0.5 truncate">Stitch Core Light theme (Always Active)</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-accent/10 border border-accent/20 px-3.5 py-1 text-[10px] font-extrabold text-accent uppercase tracking-wide shrink-0">
                    LIGHT
                  </span>
                </div>
              </div>

              {/* Safety & Security */}
              <div className="glass-panel rounded-3xl p-2 space-y-1 shadow-card">
                <p className="text-[10px] font-black uppercase tracking-wider text-primary px-3.5 py-2">Safety &amp; Security</p>
                <MenuRow icon={Shield} iconColor="bg-success/10 text-success" title="Privacy Settings" subtitle="Last seen, read receipts and blocked users" onClick={() => setActiveSection('privacy')} />
                <MenuRow icon={Ban} iconColor="bg-danger/10 text-danger" title="Safety Filter" subtitle="Blocked words and chat protection" onClick={() => setActiveSection('safety')} />
                <MenuRow icon={LockKeyhole} iconColor="bg-amber-500/10 text-amber-500" title="Security &amp; Sessions" subtitle="Active logins and account protection" onClick={() => setActiveSection('security')} />
              </div>

              {/* Data & Legal */}
              <div className="glass-panel rounded-3xl p-2 space-y-1 shadow-card">
                <p className="text-[10px] font-black uppercase tracking-wider text-primary px-3.5 py-2">Data &amp; Legal</p>
                <MenuRow icon={Database} iconColor="bg-primary/10 text-primary" title="Data Controls" subtitle="Export data, privacy policy, and account removal" onClick={() => setActiveSection('data')} />
              </div>

            </div>
          )}

          {/* PROFILE SECTION */}
          {activeSection === 'profile' && (
            <form onSubmit={saveProfile} className="space-y-5">
              <SettingsSection icon={UserRound} iconBg="bg-primary/10 text-primary" title="Profile Details">
                
                {/* Photo Row */}
                <div className="bg-[#171f33]/40 border border-white/5 flex items-center gap-4 rounded-2xl p-4">
                  {form.avatar ? (
                    <img src={form.avatar} alt="" className="h-16 w-16 rounded-full bg-[#0b1326] object-cover shadow-card" />
                  ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-[#0b1326] border border-white/5 text-text-faint">
                      <UserRound size={22} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">Profile Photo</p>
                    <p className="text-xs text-text-muted mt-0.5">Select a new avatar file</p>
                    <button 
                      type="button" 
                      onClick={() => photoInputRef.current?.click()} 
                      disabled={photoUploading} 
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white px-3 py-2 text-xs font-bold transition disabled:opacity-50"
                    >
                      <Camera size={14} />
                      {photoUploading ? 'Uploading...' : 'Choose Photo'}
                    </button>
                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" disabled={photoUploading} onChange={(event) => uploadProfilePhoto(event.target.files?.[0])} />
                  </div>
                </div>

                <Field label="Display Name" value={form.name} onChange={(value) => setField('name', value)} />
                <Field label="Username" value={form.username} onChange={(value) => setField('username', value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} prefix="@" />
                
                <div className="grid grid-cols-[0.9fr_1.1fr] gap-4">
                  <Field label="Age" value={form.age} onChange={(value) => setField('age', value)} type="number" />
                  <GenderControl value={form.gender} onChange={(value) => setField('gender', value)} />
                </div>

                <label className="block">
                  <span className="text-xs text-text-muted font-bold ml-1">Bio</span>
                  <div className="mt-1.5 bg-[#171f33]/40 border border-white/10 rounded-2xl p-0.5 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/45 transition-all">
                    <textarea 
                      value={form.bio} 
                      onChange={(event) => setField('bio', event.target.value)} 
                      className="w-full min-h-20 bg-transparent border-none focus:ring-0 text-sm font-semibold px-4 py-3 placeholder-white/20 text-white outline-none resize-none scrollbar-none" 
                      placeholder="A little about you..." 
                      maxLength={160} 
                    />
                  </div>
                </label>

                <button className="w-full bg-primary hover:brightness-110 text-white font-bold text-sm py-4 rounded-full shadow-glow active:scale-95 transition-all flex items-center justify-center gap-2 mt-4">
                  <Save size={16} />
                  Save Changes
                </button>
              </SettingsSection>
            </form>
          )}

          {/* PRIVACY SECTION */}
          {activeSection === 'privacy' && (
            <SettingsSection icon={Shield} iconBg="bg-success/10 text-success" title="Privacy Settings">
              
              {/* Location refresh row */}
              <ActionRow icon={MapPin} title="Random Room Location" subtitle={user?.location?.updatedAt ? 'Coordinates saved for proximity matchmaking' : 'Location coordinates not shared'} action="Refresh" onClick={refreshLocation} />
              
              <div className="bg-[#171f33]/30 border border-white/5 rounded-2xl p-2 space-y-1 mt-4">
                <ToggleRow title="Show Last Active" subtitle="Allow friends to see your offline presence timer" checked={form.showLastSeen} onChange={() => setField('showLastSeen', !form.showLastSeen)} />
                <ToggleRow title="Read Receipts" subtitle="Send visible seen confirmation on incoming messages" checked={form.readReceipts} onChange={() => setField('readReceipts', !form.readReceipts)} />
              </div>

              {/* Chat Vault */}
              <div className="bg-[#171f33]/40 border border-white/10 rounded-2xl p-5 mt-4 space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <LockKeyhole size={18} />
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">Hidden Chat Vault</h4>
                </div>
                <p className="text-[11px] leading-relaxed text-text-muted font-medium">
                  Set a custom password to hide archived conversation feeds. Type this password in Blippr's search inputs to unlock them.
                </p>
                <Field label="Vault Password (leave blank to clear)" value={vaultPassword} onChange={setVaultPassword} type="password" />
                <button type="button" onClick={saveVaultPassword} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl py-2.5 text-xs font-bold transition">
                  Save Vault Password
                </button>
              </div>

              {/* Blocked List */}
              <div className="space-y-3 pt-3">
                <div className="flex items-center gap-3 px-1">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-danger/10 text-danger"><Ban size={17} /></span>
                  <div>
                    <p className="text-xs font-bold text-white">Blocked Users</p>
                    <p className="text-[10px] text-text-muted font-medium">{blockedUsers.length ? `${blockedUsers.length} users match-restricted` : 'No restricted users'}</p>
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
                      Blocked members will display here.
                    </p>
                  )}
                </div>
              </div>

            </SettingsSection>
          )}

          {/* SAFETY FILTER */}
          {activeSection === 'safety' && (
            <SettingsSection icon={Shield} iconBg="bg-danger/10 text-danger" title="Safety Filter">
              <label className="block">
                <span className="text-xs text-text-muted font-bold ml-1">Blocked Words (comma separated)</span>
                <div className="mt-1.5 bg-[#171f33]/40 border border-white/10 rounded-2xl p-0.5 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/45 transition-all">
                  <textarea 
                    value={form.blockedWords} 
                    onChange={(event) => setField('blockedWords', event.target.value)} 
                    className="w-full min-h-24 bg-transparent border-none focus:ring-0 text-sm font-semibold px-4 py-3 placeholder-white/20 text-white outline-none resize-none scrollbar-none" 
                    placeholder="e.g. offensive, spam, badword" 
                  />
                </div>
              </label>
              <p className="text-[11px] leading-relaxed text-text-muted font-medium ml-1">
                Tip: Messages you compose containing any of these words are automatically masked with stars before delivery.
              </p>
              <button 
                onClick={saveProfile} 
                className="w-full bg-primary hover:brightness-110 text-white font-bold text-sm py-4 rounded-full shadow-glow active:scale-95 transition-all mt-4"
              >
                Save Safety Settings
              </button>
            </SettingsSection>
          )}

          {/* SECURITY SECTION */}
          {activeSection === 'security' && (
            <SettingsSection icon={LockKeyhole} iconBg="bg-amber-500/10 text-amber-500" title="Security &amp; Active Logins">
              <InfoRow icon={Smartphone} title="Current Device Login" subtitle="This browser session is active" value="1 Device" />
              <InfoRow icon={LockKeyhole} title="Access Tokens" subtitle="Secure authentication session protocols" value="JWT Session Active" />
            </SettingsSection>
          )}

          {/* SOUNDS & NOTIFICATIONS */}
          {activeSection === 'notifications' && (
            <SettingsSection icon={Bell} iconBg="bg-success/10 text-success" title="Notifications &amp; Sounds">
              
              <ActionRow icon={Bell} title="Push Notifications" subtitle="Incoming chats, messages, and calls" action="Enable" onClick={turnOnNotifications} />
              
              {/* Quiet mode toggle */}
              <div className="bg-[#171f33]/30 border border-white/5 rounded-2xl p-1 mt-4">
                <ToggleRow title="Quiet Mode (DND)" subtitle="Vibrate and mute all in-app audio tones" checked={soundPrefs.dnd} onChange={toggleDnd} />
              </div>

              {/* Sound Ringers */}
              <div className="space-y-4 pt-2">
                <SoundPicker
                  title="Incoming Call Ringtone"
                  value={soundPrefs.ringtone}
                  onSelect={(sound) => updateSound('ringtone', sound)}
                  onUpload={(file) => uploadSound('ringtone', file)}
                  onPreview={() => previewSound(soundPrefs.ringtone, 'call')}
                />
                <SoundPicker
                  title="Chat Alert sound"
                  value={soundPrefs.messageTone}
                  onSelect={(sound) => updateSound('messageTone', sound)}
                  onUpload={(file) => uploadSound('messageTone', file)}
                  onPreview={() => previewSound(soundPrefs.messageTone, 'message')}
                />
              </div>

              <div className="pt-2">
                <InstallAppButton />
              </div>
            </SettingsSection>
          )}

          {/* DATA & LEGAL */}
          {activeSection === 'data' && (
            <div className="space-y-6">
              
              <SettingsSection icon={Database} iconBg="bg-primary/10 text-primary" title="Data Controls">
                <ActionRow icon={Database} title="Export Account Logs" subtitle="Download profile details, logs and histories" action="Export JSON" onClick={exportData} />
                <InfoRow icon={Shield} title="Content safety database" subtitle="Security reports check on discovery matches" value="Enabled" />
                
                {/* Custom list of links */}
                <div className="bg-[#171f33]/30 border border-white/5 rounded-2xl overflow-hidden mt-4 divide-y divide-white/5">
                  <Link to="/app/legal" className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 text-white/70 flex items-center justify-center">
                        <FileText size={18} />
                      </div>
                      <div className="text-left">
                        <span className="block text-sm font-semibold text-white">Privacy Policy</span>
                        <span className="block text-xs text-text-muted mt-0.5">Read about our encryption and data policies</span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-text-muted/50" />
                  </Link>
                  <Link to="/app/legal" className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 text-white/70 flex items-center justify-center">
                        <FileText size={18} />
                      </div>
                      <div className="text-left">
                        <span className="block text-sm font-semibold text-white">Terms of Use</span>
                        <span className="block text-xs text-text-muted mt-0.5">Community guidelines and beta policy</span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-text-muted/50" />
                  </Link>
                </div>
              </SettingsSection>

              {/* Danger zone actions */}
              <div className="bg-danger/5 border border-danger/20 rounded-3xl p-2 space-y-1">
                <button 
                  onClick={() => setDeleteConfirmOpen(true)} 
                  className="flex w-full items-center gap-3 rounded-2xl p-4 text-left text-danger hover:bg-danger/10 transition active:scale-[0.99]"
                >
                  <span className="rounded-xl bg-danger/10 p-3"><Trash2 size={18} /></span>
                  <span className="font-bold text-sm">Delete Account</span>
                </button>
                <button 
                  onClick={logout} 
                  className="flex w-full items-center gap-3 rounded-2xl p-4 text-left text-danger hover:bg-danger/10 transition active:scale-[0.99]"
                >
                  <span className="rounded-xl bg-danger/10 p-3"><LogOut size={18} /></span>
                  <span className="font-bold text-sm">Logout Session</span>
                </button>
              </div>

              <ConfirmSheet
                open={deleteConfirmOpen}
                title="Delete Account?"
                description="This permanently removes your Blippr account and cannot be undone."
                confirmLabel="Delete"
                tone="danger"
                onCancel={() => setDeleteConfirmOpen(false)}
                onConfirm={deleteAccount}
              />

            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function settingsTitle(section) {
  return {
    home: 'Settings',
    profile: 'Profile settings',
    privacy: 'Privacy controls',
    safety: 'Safety Filter',
    security: 'Security & logins',
    notifications: 'Notifications',
    data: 'Data & Legal'
  }[section] || 'Settings';
}

function settingsSubtitle(section) {
  return {
    home: 'Choose one area to manage',
    profile: 'Photo, identity and bio details',
    privacy: 'Visibility and blocked profile lists',
    safety: 'Filter phrases and protect chat streams',
    security: 'Browser sessions and token states',
    notifications: 'Push notifications and sound alerts',
    data: 'Export details, legal documents and account termination'
  }[section] || 'Manage account details';
}

function ProfileSkeleton() {
  return (
    <div className="w-full max-w-lg mx-auto bg-bg animate-pulse px-4 pt-20 space-y-6">
      <div className="h-28 rounded-3xl bg-surface-glass border border-white/10 skeleton" />
      <div className="space-y-4">
        <div className="h-14 rounded-2xl bg-surface-glass border border-white/10 skeleton" />
        <div className="h-14 rounded-2xl bg-surface-glass border border-white/10 skeleton" />
        <div className="h-14 rounded-2xl bg-surface-glass border border-white/10 skeleton" />
      </div>
    </div>
  );
}

function SettingsSection({ icon: Icon, iconBg, title, children }) {
  return (
    <section className="glass-panel rounded-3xl p-5 shadow-card space-y-4">
      <div className="flex items-center gap-2.5 px-1 pb-1">
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${iconBg}`}><Icon size={16} /></span>
        <h3 className="text-xs font-black uppercase tracking-widest text-white">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', prefix }) {
  return (
    <label className="block">
      <span className="text-xs text-text-muted font-bold ml-1">{label}</span>
      <div className="mt-1.5 flex items-center bg-[#171f33]/40 border border-white/10 rounded-2xl p-0.5 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/45 transition-all">
        {prefix && <span className="text-text-muted font-bold text-sm pl-4 select-none">{prefix}</span>}
        <input 
          value={value} 
          onChange={(event) => onChange(event.target.value)} 
          className={`min-w-0 flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold py-3 placeholder-white/20 text-white outline-none ${prefix ? 'px-1' : 'px-4'}`}
          type={type} 
        />
      </div>
    </label>
  );
}

function GenderControl({ value, onChange }) {
  return (
    <div>
      <span className="text-xs text-text-muted font-bold ml-1">Gender</span>
      <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-2xl border border-border bg-surface-glass/40 p-1 text-xs backdrop-blur-md">
        {['female', 'male'].map((item) => (
          <button 
            key={item} 
            type="button" 
            onClick={() => onChange(item)} 
            className={`rounded-xl px-3 py-2.5 font-bold capitalize cursor-pointer transition-all duration-200 ${value === item ? 'bg-accent text-white shadow-md' : 'text-text-muted hover:text-text-primary'}`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionRow({ icon: Icon, title, subtitle, action, onClick }) {
  return (
    <button 
      type="button" 
      onClick={onClick} 
      className="flex w-full items-center justify-between p-3.5 hover:bg-white/5 active:bg-white/10 rounded-2xl transition"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-accent/15 text-accent">
          <Icon size={18} />
        </div>
        <div className="text-left min-w-0">
          <span className="block text-sm font-semibold text-text-primary truncate">{title}</span>
          <span className="block text-xs text-text-muted mt-0.5 truncate">{subtitle}</span>
        </div>
      </div>
      <span className="bg-accent hover:bg-accent-hover text-white flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide transition shadow-md">
        {action}
        <ChevronRight size={12} />
      </span>
    </button>
  );
}

function MenuRow({ icon: Icon, iconColor, title, subtitle, onClick }) {
  return (
    <button 
      type="button" 
      onClick={onClick} 
      className="flex w-full items-center justify-between p-3.5 hover:bg-white/5 active:bg-white/10 rounded-2xl transition active:scale-[0.99]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconColor}`}>
          <Icon size={18} />
        </div>
        <div className="text-left min-w-0">
          <span className="block text-sm font-semibold text-text-primary truncate">{title}</span>
          <span className="block text-xs text-text-muted mt-0.5 truncate">{subtitle}</span>
        </div>
      </div>
      <ChevronRight size={18} className="text-text-muted/50 shrink-0" />
    </button>
  );
}

function InfoRow({ icon: Icon, title, subtitle, value }) {
  return (
    <div className="flex items-center justify-between p-3.5 glass-card rounded-2xl">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-accent/15 text-accent">
          <Icon size={18} />
        </div>
        <div className="text-left min-w-0">
          <span className="block text-sm font-semibold text-text-primary truncate">{title}</span>
          <span className="block text-xs text-text-muted mt-0.5 truncate">{subtitle}</span>
        </div>
      </div>
      <span className="rounded-full bg-accent/10 border border-accent/20 px-3 py-1 text-[10px] font-bold text-accent uppercase shrink-0">
        {value}
      </span>
    </div>
  );
}

function ToggleRow({ title, subtitle, checked, onChange }) {
  return (
    <button 
      type="button" 
      onClick={onChange} 
      className="flex w-full items-center justify-between p-3.5 hover:bg-white/5 active:bg-white/10 rounded-2xl transition"
    >
      <div className="text-left min-w-0">
        <span className="block text-sm font-semibold text-text-primary truncate">{title}</span>
        <span className="block text-xs text-text-muted mt-0.5 truncate leading-relaxed">{subtitle}</span>
      </div>
      <span className={`relative h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out flex ${checked ? 'bg-accent' : 'bg-zinc-200'}`}>
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

function SoundPicker({ title, value, onSelect, onUpload, onPreview }) {
  return (
    <div className="glass-card rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-accent/15 text-accent">
            <Music size={18} />
          </div>
          <div className="text-left min-w-0">
            <span className="block text-sm font-semibold text-text-primary">{title}</span>
            <span className="block text-xs text-text-muted mt-0.5 truncate max-w-[160px] md:max-w-xs">{value?.name || 'Default Tone'}</span>
          </div>
        </div>
        <button 
          type="button" 
          onClick={onPreview} 
          className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 text-text-primary active:scale-95 transition" 
          aria-label={`Preview ${title}`}
        >
          <Volume2 size={17} />
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {soundPack.map((sound) => (
          <button
            key={sound.id}
            type="button"
            onClick={() => onSelect(packSound(sound.id))}
            className={`rounded-xl px-3 py-2.5 text-xs font-bold cursor-pointer transition duration-200 active:scale-95 ${value?.type === 'pack' && value.id === sound.id ? 'bg-accent text-white shadow-md' : 'bg-white/5 border border-white/10 text-text-muted hover:bg-white/10 hover:text-text-primary'}`}
          >
            {sound.name}
          </button>
        ))}
      </div>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 py-2.5 text-xs font-bold text-text-primary transition active:scale-95 shadow-sm">
        Upload from media
        <input type="file" accept="audio/*" className="hidden" onChange={(event) => onUpload(event.target.files?.[0])} />
      </label>
    </div>
  );
}
