import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Ban, Bell, Camera, ChevronRight, Database, FileText, LockKeyhole, LogOut, MapPin, Music, Save, Settings, Shield, Smartphone, Trash2, Unlock, UserRound, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import ConfirmSheet from '../components/ConfirmSheet.jsx';
import InstallAppButton from '../components/InstallAppButton.jsx';
import { showToast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';
import { clearBlipprCache } from '../lib/cache.js';
import { enablePushNotifications } from '../lib/notifications.js';
import { presenceText } from '../lib/presence.js';
import { previewSound } from '../lib/sounds.js';
import { loadSoundPrefs, mediaToSound, packSound, saveSoundPrefs, setSoundPreference, soundPack } from '../lib/soundPrefs.js';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [form, setForm] = useState({ name: '', username: '', age: '', gender: 'female', bio: '', avatar: '', showLastSeen: true, readReceipts: true, blockedWords: '' });
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState('home');
  const [settingsOpen] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [soundPrefs, setSoundPrefs] = useState(() => loadSoundPrefs());
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('blippr_theme') || 'light');

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('blippr_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark-theme');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0B1120');
    } else {
      document.documentElement.classList.remove('dark-theme');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#F8FAFC');
    }
  }

  useEffect(() => {
    async function load() {
      const [{ user: currentUser }, { users: blocked }] = await Promise.all([
        api('/api/users/me'),
        api('/api/safety/blocked')
      ]);
      setUser(currentUser);
      setBlockedUsers(blocked);
      setForm({
        name: currentUser.name || '',
        username: currentUser.isGuest ? '' : (currentUser.username || ''),
        age: currentUser.age || '',
        gender: currentUser.gender || 'female',
        bio: currentUser.bio || '',
        avatar: currentUser.avatar || '',
        showLastSeen: currentUser.privacy?.showLastSeen !== false,
        readReceipts: currentUser.privacy?.readReceipts !== false,
        blockedWords: currentUser.safety?.blockedWords?.join(', ') || ''
      });
    }
    load().catch((err) => setMessage(err.message));
  }, []);

  useEffect(() => {
    function handleSoundPrefs(event) {
      setSoundPrefs(event.detail || loadSoundPrefs());
    }
    window.addEventListener('blippr:sound-prefs', handleSoundPrefs);
    return () => window.removeEventListener('blippr:sound-prefs', handleSoundPrefs);
  }, []);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event) {
    if (event) event.preventDefault();
    if (form.username.trim() !== '' && form.username.trim().length < 3) {
      showToast('Username must be at least 3 characters long', 'error');
      return;
    }
    try {
      const payload = {
        name: form.name,
        age: Number(form.age),
        gender: form.gender,
        bio: form.bio,
        avatar: form.avatar,
        privacy: {
          showLastSeen: form.showLastSeen,
          readReceipts: form.readReceipts
        },
        safety: {
          blockedWords: form.blockedWords.split(',').map((word) => word.trim().toLowerCase()).filter(Boolean)
        }
      };
      if (form.username.trim() !== '') {
        payload.username = form.username;
      }
      if (!payload.avatar?.trim()) delete payload.avatar;
      const { user: updated } = await api('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setUser(updated);
      showToast('Profile saved', 'success');
      if (updated.username && !updated.isGuest) {
        setForm((curr) => ({ ...curr, username: updated.username }));
      }
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
    localStorage.removeItem('blippr_token');
    navigate('/auth', { replace: true });
  }

  async function uploadProfilePhoto(file) {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      showToast('Choose an image from your gallery', 'error');
      return;
    }
    setPhotoUploading(true);
    showToast('Uploading profile photo...', 'info');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { media } = await api('/api/media/upload', {
        method: 'POST',
        body: formData
      });
      const { user: updated } = await api('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ avatar: media.url })
      });
      setField('avatar', media.url);
      setUser(updated);
      showToast('Profile photo updated', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPhotoUploading(false);
    }
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

  if (settingsOpen) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-3">
        <header className="flex items-center gap-3">
          <button onClick={() => (activeSection === 'home' ? navigate('/app/profile') : setActiveSection('home'))} className="btn-icon h-10 w-10" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">{settingsTitle(activeSection)}</h2>
            <p className="text-xs text-text-muted">{settingsSubtitle(activeSection)}</p>
          </div>
        </header>

        {message && <p className="rounded-2xl border border-accent/20 bg-accent/8 px-4 py-3 text-sm font-medium text-accent">{message}</p>}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            {activeSection === 'home' && (
              <div className="space-y-4">
                {/* Account & Preferences */}
                <div className="surface-card rounded-3xl p-2 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-accent px-3 py-1.5">Account & Preferences</p>
                  <MenuRow icon={UserRound} title="Profile Settings" subtitle="Photo, name, username, age, gender and bio" onClick={() => setActiveSection('profile')} />
                  <MenuRow icon={Bell} title="Notifications" subtitle="Push, ringtone, chat tone and quiet mode" onClick={() => setActiveSection('notifications')} />
                  <button type="button" onClick={toggleTheme} className="interactive-card flex w-full items-center gap-3 rounded-2xl p-3 text-left">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent"><Smartphone size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-text-primary">Theme Appearance</span>
                      <span className="block truncate text-xs text-text-muted">Switch between Light and Dark modes</span>
                    </span>
                    <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent capitalize">
                      {theme}
                    </span>
                  </button>
                </div>

                {/* Safety & Security */}
                <div className="surface-card rounded-3xl p-2 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-accent px-3 py-1.5">Safety & Security</p>
                  <MenuRow icon={Shield} title="Privacy" subtitle="Last seen, read receipts and blocked users" onClick={() => setActiveSection('privacy')} />
                  <MenuRow icon={Ban} title="Safety Filter" subtitle="Blocked words and chat protection" onClick={() => setActiveSection('safety')} />
                  <MenuRow icon={LockKeyhole} title="Security" subtitle="Sessions and account protection" onClick={() => setActiveSection('security')} />
                </div>

                {/* Data & Legal */}
                <div className="surface-card rounded-3xl p-2 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-accent px-3 py-1.5">Data & Legal</p>
                  <MenuRow icon={Database} title="Data & Legal" subtitle="Export, privacy policy, terms and account removal" onClick={() => setActiveSection('data')} />
                </div>
              </div>
            )}

            {activeSection === 'profile' && (
              <form onSubmit={saveProfile} className="space-y-3">
                <SettingsSection icon={UserRound} title="Profile Settings">
                  <div className="surface-card flex items-center gap-3 rounded-2xl p-3">
                    {form.avatar ? <img src={form.avatar} alt="" className="h-16 w-16 rounded-full bg-bg object-cover shadow-card" /> : <div className="grid h-16 w-16 place-items-center rounded-full bg-bg text-text-faint"><UserRound size={22} /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary">Profile photo</p>
                      <p className="mt-0.5 text-xs text-text-muted">Choose a photo from your gallery.</p>
                      <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoUploading} className="btn-secondary mt-3 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50">
                        <Camera size={15} />
                        {photoUploading ? 'Uploading...' : 'Choose photo'}
                      </button>
                      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" disabled={photoUploading} onChange={(event) => uploadProfilePhoto(event.target.files?.[0])} />
                    </div>
                  </div>
                  <Field label="Display name" value={form.name} onChange={(value) => setField('name', value)} />
                  <Field label="Username" value={form.username} onChange={(value) => setField('username', value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} prefix="@" />
                  <div className="grid grid-cols-[0.9fr_1.1fr] gap-3">
                    <Field label="Age" value={form.age} onChange={(value) => setField('age', value)} type="number" />
                    <GenderControl value={form.gender} onChange={(value) => setField('gender', value)} />
                  </div>
                  <label className="block">
                    <span className="text-xs text-text-muted">Bio</span>
                    <textarea value={form.bio} onChange={(event) => setField('bio', event.target.value)} className="mt-1.5 min-h-20 w-full resize-none rounded-2xl border border-border-default bg-surface px-3 py-2.5 text-sm outline-none text-text-primary placeholder:text-text-faint" placeholder="A little about you" maxLength={160} />
                  </label>
                  <button className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-semibold min-h-[44px]">
                    <Save size={18} />
                    Save changes
                  </button>
                </SettingsSection>
              </form>
            )}

            {activeSection === 'privacy' && (
              <SettingsSection icon={Shield} title="Privacy">
                <ActionRow icon={MapPin} title="Random room location" subtitle={user?.location?.updatedAt ? 'Location saved for nearby rooms' : 'Not shared yet'} action="Refresh" onClick={refreshLocation} />
                <ToggleRow title="Show last seen" subtitle="Let friends see when you were last active" checked={form.showLastSeen} onChange={() => setField('showLastSeen', !form.showLastSeen)} />
                <ToggleRow title="Read receipts" subtitle="Send seen status when you read messages" checked={form.readReceipts} onChange={() => setField('readReceipts', !form.readReceipts)} />
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-3 px-1">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-danger/10 text-danger"><Ban size={17} /></span>
                    <div>
                      <p className="font-medium text-text-primary">Blocked users</p>
                      <p className="text-xs text-text-muted">{blockedUsers.length ? `${blockedUsers.length} hidden from you` : 'No blocked users'}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {blockedUsers.map((blockedUser) => (
                      <div key={blockedUser._id} className="flex items-center gap-3 rounded-2xl border border-border-default bg-surface p-2 shadow-card">
                        <img src={blockedUser.avatar} alt="" className="h-11 w-11 rounded-full bg-bg object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">{blockedUser.name}</p>
                          <p className="truncate text-xs text-text-muted">@{blockedUser.username}</p>
                        </div>
                        <button onClick={() => unblockUser(blockedUser._id)} className="btn-primary grid h-10 w-10 place-items-center rounded-full" aria-label={`Unblock ${blockedUser.name}`}>
                          <Unlock size={17} />
                        </button>
                      </div>
                    ))}
                    {!blockedUsers.length && <p className="rounded-2xl border border-border-default bg-bg px-3 py-3 text-center text-sm text-text-faint">Blocked people will appear here.</p>}
                  </div>
                </div>
              </SettingsSection>
            )}

            {activeSection === 'safety' && (
              <SettingsSection icon={Shield} title="Safety Filter">
                <label className="block">
                  <span className="text-xs text-text-muted">Blocked words</span>
                  <textarea value={form.blockedWords} onChange={(event) => setField('blockedWords', event.target.value)} className="mt-1.5 min-h-20 w-full resize-none rounded-2xl border border-border-default bg-surface px-3 py-2.5 text-sm outline-none text-text-primary placeholder:text-text-faint" placeholder="Comma separated words" />
                </label>
                <p className="text-xs leading-5 text-text-muted">Messages you send containing these words are masked before delivery.</p>
                <button onClick={saveProfile} className="btn-primary w-full rounded-2xl py-3 text-sm font-semibold min-h-[44px]">Save safety filter</button>
              </SettingsSection>
            )}

            {activeSection === 'security' && (
              <SettingsSection icon={LockKeyhole} title="Security">
                <InfoRow icon={Smartphone} title="Active logins" subtitle="This browser is currently active" value="1 device" />
                <InfoRow icon={LockKeyhole} title="Password and sessions" subtitle="Email login sessions use JWT security" value="Protected" />
              </SettingsSection>
            )}

            {activeSection === 'notifications' && (
              <SettingsSection icon={Bell} title="Notifications">
                <ActionRow icon={Bell} title="Push notifications" subtitle="Messages, requests, and calls" action="Enable" onClick={turnOnNotifications} />
                <SoundPicker
                  title="Call ringtone"
                  value={soundPrefs.ringtone}
                  onSelect={(sound) => updateSound('ringtone', sound)}
                  onUpload={(file) => uploadSound('ringtone', file)}
                  onPreview={() => previewSound(soundPrefs.ringtone, 'call')}
                />
                <SoundPicker
                  title="Chat notification"
                  value={soundPrefs.messageTone}
                  onSelect={(sound) => updateSound('messageTone', sound)}
                  onUpload={(file) => uploadSound('messageTone', file)}
                  onPreview={() => previewSound(soundPrefs.messageTone, 'message')}
                />
                <button type="button" onClick={toggleDnd} className="interactive-card flex w-full items-center gap-3 rounded-2xl p-3 text-left">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-text-muted"><Bell size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-text-primary">Quiet mode</span>
                    <span className="block truncate text-xs text-text-muted">Mute in-app tones and vibrations</span>
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${soundPrefs.dnd ? 'bg-danger/10 text-danger' : 'bg-bg text-text-muted'}`}>{soundPrefs.dnd ? 'On' : 'Off'}</span>
                </button>
                <InstallAppButton />
              </SettingsSection>
            )}

            {activeSection === 'data' && (
              <>
                <SettingsSection icon={Database} title="Data">
                  <ActionRow icon={Database} title="Export account data" subtitle="Download profile, chats, notifications and reports JSON" action="Export" onClick={exportData} />
                  <InfoRow icon={Shield} title="Safety data" subtitle="Reports help keep Random safer" value="Enabled" />
                  <Link to="/privacy" className="interactive-card flex items-center gap-3 rounded-2xl p-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-text-muted"><FileText size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-text-primary">Privacy Policy</span>
                      <span className="block truncate text-xs text-text-muted">How Blippr handles account, chat, call and safety data</span>
                    </span>
                    <ChevronRight size={17} className="text-text-faint" />
                  </Link>
                  <Link to="/terms" className="interactive-card flex items-center gap-3 rounded-2xl p-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-text-muted"><FileText size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-text-primary">Terms of Use</span>
                      <span className="block truncate text-xs text-text-muted">Rules for beta testers, safety and account use</span>
                    </span>
                    <ChevronRight size={17} className="text-text-faint" />
                  </Link>
                </SettingsSection>

                <button onClick={() => setDeleteConfirmOpen(true)} className="interactive-card flex w-full items-center gap-3 rounded-2xl p-4 text-left text-danger mt-3">
                  <span className="rounded-xl bg-danger/10 p-3"><Trash2 size={18} /></span>
                  <span className="font-medium">Delete Account</span>
                </button>

                <ConfirmSheet
                  open={deleteConfirmOpen}
                  title="Delete Account?"
                  description="This permanently removes your Blippr account and cannot be undone."
                  confirmLabel="Delete"
                  tone="danger"
                  onCancel={() => setDeleteConfirmOpen(false)}
                  onConfirm={deleteAccount}
                />

                <button onClick={logout} className="interactive-card flex w-full items-center gap-3 rounded-2xl p-4 text-left text-danger mt-2">
                  <span className="rounded-xl bg-danger/10 p-3"><LogOut size={18} /></span>
                  <span className="font-medium">Logout</span>
                </button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return <ProfileSkeleton />;
}

function settingsTitle(section) {
  return {
    home: 'Settings',
    profile: 'Profile Settings',
    privacy: 'Privacy',
    safety: 'Safety Filter',
    security: 'Security',
    notifications: 'Notifications',
    data: 'Data & Legal'
  }[section] || 'Settings';
}

function settingsSubtitle(section) {
  return {
    home: 'Choose one area to manage',
    profile: 'Photo, identity and bio',
    privacy: 'Visibility and blocked users',
    safety: 'Filter words and protect chats',
    security: 'Sessions and account protection',
    notifications: 'Push, sounds and quiet mode',
    data: 'Export, legal pages and account controls'
  }[section] || 'Profile, privacy, security and app controls';
}

function ProfileSkeleton() {
  return (
    <div className="space-y-3">
      <section className="elevated-card rounded-3xl p-4">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full skeleton" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-40 rounded-full skeleton" />
            <div className="h-3 w-28 rounded-full skeleton" />
            <div className="h-3 w-20 rounded-full skeleton" />
          </div>
        </div>
      </section>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-16 rounded-2xl skeleton" />
      ))}
    </div>
  );
}

function SettingsSection({ icon: Icon, title, children }) {
  return (
    <section className="surface-card rounded-2xl p-3">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-accent"><Icon size={16} /></span>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-primary">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', prefix }) {
  return (
    <label className="block">
      <span className="text-xs text-text-muted">{label}</span>
      <div className="mt-1.5 flex items-center rounded-2xl border border-border-default bg-surface px-3 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        {prefix && <span className="text-text-faint mr-1">{prefix}</span>}
        <input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none text-text-primary placeholder:text-text-faint" type={type} />
      </div>
    </label>
  );
}

function GenderControl({ value, onChange }) {
  return (
    <div>
      <span className="text-xs text-text-muted">Gender</span>
      <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-2xl border border-border-default bg-bg p-1 text-sm">
        {['female', 'male'].map((item) => (
          <button key={item} type="button" onClick={() => onChange(item)} className={`rounded-xl px-3 py-2.5 font-medium capitalize cursor-pointer transition-all duration-200 ${value === item ? 'btn-primary' : 'text-text-muted hover:text-text-secondary'}`}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionRow({ icon: Icon, title, subtitle, action, onClick }) {
  return (
    <button type="button" onClick={onClick} className="interactive-card flex w-full items-center gap-3 rounded-2xl p-3 text-left min-h-[44px]">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-text-muted"><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-text-primary">{title}</span>
        <span className="block truncate text-xs text-text-muted">{subtitle}</span>
      </span>
      <span className="btn-primary flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold">
        {action}
        <ChevronRight size={13} />
      </span>
    </button>
  );
}

function MenuRow({ icon: Icon, title, subtitle, onClick }) {
  return (
    <button type="button" onClick={onClick} className="interactive-card flex w-full items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.99] min-h-[44px]">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-text-muted"><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-text-primary">{title}</span>
        <span className="block truncate text-xs text-text-muted">{subtitle}</span>
      </span>
      <ChevronRight size={17} className="text-text-faint" />
    </button>
  );
}

function InfoRow({ icon: Icon, title, subtitle, value }) {
  return (
    <div className="surface-card flex items-center gap-3 rounded-2xl p-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-text-muted"><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-text-primary">{title}</span>
        <span className="block truncate text-xs text-text-muted">{subtitle}</span>
      </span>
      <span className="rounded-full bg-bg border border-border-default px-3 py-1 text-xs font-semibold text-text-muted">{value}</span>
    </div>
  );
}

function ToggleRow({ title, subtitle, checked, onChange }) {
  return (
    <button type="button" onClick={onChange} className="interactive-card flex w-full items-center gap-3 rounded-2xl p-3 text-left min-h-[44px]">
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-text-primary">{title}</span>
        <span className="block truncate text-xs text-text-muted">{subtitle}</span>
      </span>
      <span className={`relative h-7 w-12 rounded-full transition-all duration-300 ${checked ? 'bg-accent' : 'bg-border-default'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-card transition-all duration-300 ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

function SoundPicker({ title, value, onSelect, onUpload, onPreview }) {
  return (
    <div className="surface-card rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent"><Music size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-text-primary">{title}</span>
          <span className="block truncate text-xs text-text-muted">{value?.name || 'Default tone'}</span>
        </span>
        <button type="button" onClick={onPreview} className="btn-icon h-10 w-10" aria-label={`Preview ${title}`}>
          <Volume2 size={17} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {soundPack.map((sound) => (
          <button
            key={sound.id}
            type="button"
            onClick={() => onSelect(packSound(sound.id))}
            className={`rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer transition-all duration-200 ${value?.type === 'pack' && value.id === sound.id ? 'btn-primary' : 'btn-secondary text-text-muted'}`}
          >
            {sound.name}
          </button>
        ))}
      </div>
      <label className="btn-secondary mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-text-muted">
        Upload from media
        <input type="file" accept="audio/*" className="hidden" onChange={(event) => onUpload(event.target.files?.[0])} />
      </label>
    </div>
  );
}
