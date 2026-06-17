import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Ban, Bell, Camera, ChevronRight, Database, FileText, LockKeyhole, LogOut, MapPin, Music, Save, Settings, Shield, Smartphone, Trash2, Unlock, UserRound, Volume2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ConfirmSheet from '../components/ConfirmSheet.jsx';
import InstallAppButton from '../components/InstallAppButton.jsx';
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
    } else {
      document.documentElement.classList.remove('dark-theme');
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
    event.preventDefault();
    if (form.username.trim() !== '' && form.username.trim().length < 3) {
      setMessage('Username must be at least 3 characters long');
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
        /* wait, wait, the original code had: */
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setUser(updated);
      setMessage('Profile saved');
      if (updated.username && !updated.isGuest) {
        // if user set a real username, refresh state
        setForm((curr) => ({ ...curr, username: updated.username }));
      }
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function refreshLocation() {
    if (!navigator.geolocation) {
      setMessage('Location is not supported in this browser');
      return;
    }

    setMessage('Refreshing location...');
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
          setMessage('Location updated for random rooms');
        } catch (err) {
          setMessage(err.message);
        }
      },
      () => setMessage('Location permission was denied')
    );
  }

  async function turnOnNotifications() {
    try {
      await enablePushNotifications();
      setMessage('Push notifications enabled');
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function unblockUser(userId) {
    try {
      await api('/api/safety/unblock', {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
      setBlockedUsers((current) => current.filter((blockedUser) => blockedUser._id !== userId));
      setMessage('User unblocked');
    } catch (err) {
      setMessage(err.message);
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
      setMessage('Choose an image from your gallery');
      return;
    }
    setPhotoUploading(true);
    setMessage('Uploading profile photo...');
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
      setMessage('Profile photo updated');
    } catch (err) {
      setMessage(err.message);
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
      setMessage('Account export prepared');
    } catch (err) {
      setMessage(err.message);
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
      setMessage(`${key === 'ringtone' ? 'Call ringtone' : 'Chat notification'} updated`);
    } catch (err) {
      setMessage(err.message);
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
            <h2 className="text-xl font-semibold">{settingsTitle(activeSection)}</h2>
            <p className="text-xs text-white/45">{settingsSubtitle(activeSection)}</p>
          </div>
        </header>

        {message && <p className="rounded-[16px] border border-mint/20 bg-mint/10 px-4 py-3 text-sm text-mint">{message}</p>}

        {activeSection === 'home' && (
          <div className="space-y-4">
            {/* Account & Preferences */}
            <div className="depth-panel rounded-[22px] p-2 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-mint px-3 py-1.5">Account & Preferences</p>
              <MenuRow icon={UserRound} title="Profile Settings" subtitle="Photo, name, username, age, gender and bio" onClick={() => setActiveSection('profile')} />
              <MenuRow icon={Bell} title="Notifications" subtitle="Push, ringtone, chat tone and quiet mode" onClick={() => setActiveSection('notifications')} />
              <button type="button" onClick={toggleTheme} className="interactive-card flex w-full items-center gap-3 rounded-[14px] p-3 text-left">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-ink shadow-nm-inset-sm text-mint"><Smartphone size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-800 dark:text-slate-200">Theme Appearance</span>
                  <span className="block truncate text-xs text-slate-500">Switch between Light and Dark modes</span>
                </span>
                <span className="rounded-full bg-ink shadow-nm-inset-sm px-3 py-1 text-xs font-semibold text-mint capitalize">
                  {theme}
                </span>
              </button>
            </div>

            {/* Safety & Security */}
            <div className="depth-panel rounded-[22px] p-2 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-mint px-3 py-1.5">Safety & Security</p>
              <MenuRow icon={Shield} title="Privacy" subtitle="Last seen, read receipts and blocked users" onClick={() => setActiveSection('privacy')} />
              <MenuRow icon={Ban} title="Safety Filter" subtitle="Blocked words and chat protection" onClick={() => setActiveSection('safety')} />
              <MenuRow icon={LockKeyhole} title="Security" subtitle="Sessions and account protection" onClick={() => setActiveSection('security')} />
            </div>

            {/* Data & Legal */}
            <div className="depth-panel rounded-[22px] p-2 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-mint px-3 py-1.5">Data & Legal</p>
              <MenuRow icon={Database} title="Data & Legal" subtitle="Export, privacy policy, terms and account removal" onClick={() => setActiveSection('data')} />
            </div>
          </div>
        )}

        {activeSection === 'profile' && (
        <form onSubmit={saveProfile} className="space-y-3">
          <SettingsSection icon={UserRound} title="Profile Settings">
            <div className="interactive-card flex items-center gap-3 rounded-[16px] p-3">
              {form.avatar ? <img src={form.avatar} alt="" className="h-16 w-16 rounded-full bg-ink object-cover shadow-nm-inset-sm" /> : <div className="grid h-16 w-16 place-items-center rounded-full bg-ink shadow-nm-inset-sm text-white/45"><UserRound size={22} /></div>}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Profile photo</p>
                <p className="mt-0.5 text-xs text-white/45">Choose a photo from your gallery.</p>
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
              <span className="text-xs text-white/45">Bio</span>
              <textarea value={form.bio} onChange={(event) => setField('bio', event.target.value)} className="mt-1.5 min-h-20 w-full resize-none rounded-[14px] border border-white/5 bg-ink px-3 py-2.5 text-sm outline-none shadow-nm-inset-sm" placeholder="A little about you" maxLength={160} />
            </label>
            <button className="btn-primary flex w-full items-center justify-center gap-2 rounded-[14px] py-3 font-semibold">
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
              <span className="grid h-9 w-9 place-items-center rounded-full bg-coral/10 text-coral"><Ban size={17} /></span>
              <div>
                <p className="font-medium">Blocked users</p>
                <p className="text-xs text-white/45">{blockedUsers.length ? `${blockedUsers.length} hidden from you` : 'No blocked users'}</p>
              </div>
            </div>
            <div className="space-y-2">
              {blockedUsers.map((blockedUser) => (
                <div key={blockedUser._id} className="flex items-center gap-3 rounded-[16px] border border-white/5 bg-ink p-2 shadow-nm-inset-sm">
                  <img src={blockedUser.avatar} alt="" className="h-11 w-11 rounded-full bg-ink object-cover shadow-nm-inset-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{blockedUser.name}</p>
                    <p className="truncate text-xs text-white/45">@{blockedUser.username}</p>
                  </div>
                  <button onClick={() => unblockUser(blockedUser._id)} className="btn-primary grid h-10 w-10 place-items-center rounded-full" aria-label={`Unblock ${blockedUser.name}`}>
                    <Unlock size={17} />
                  </button>
                </div>
              ))}
              {!blockedUsers.length && <p className="rounded-[14px] border border-white/5 bg-ink px-3 py-3 text-center text-sm text-white/42 shadow-nm-inset-sm">Blocked people will appear here.</p>}
            </div>
          </div>
        </SettingsSection>
        )}

        {activeSection === 'safety' && (
        <SettingsSection icon={Shield} title="Safety Filter">
          <label className="block">
            <span className="text-xs text-white/45">Blocked words</span>
            <textarea value={form.blockedWords} onChange={(event) => setField('blockedWords', event.target.value)} className="mt-1.5 min-h-20 w-full resize-none rounded-[14px] border border-white/5 bg-ink px-3 py-2.5 text-sm outline-none shadow-nm-inset-sm" placeholder="Comma separated words" />
          </label>
          <p className="text-xs leading-5 text-white/45">Messages you send containing these words are masked before delivery.</p>
          <button onClick={saveProfile} className="btn-primary w-full rounded-[14px] py-3 text-sm font-semibold">Save safety filter</button>
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
          <button type="button" onClick={toggleDnd} className="interactive-card flex w-full items-center gap-3 rounded-[14px] p-3 text-left">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ink shadow-nm-inset-sm text-white/70"><Bell size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Quiet mode</span>
              <span className="block truncate text-xs text-white/45">Mute in-app tones and vibrations</span>
            </span>
            <span className={`rounded-full bg-ink shadow-nm-inset-sm px-3 py-1 text-xs font-semibold ${soundPrefs.dnd ? 'text-coral' : 'text-white/70'}`}>{soundPrefs.dnd ? 'On' : 'Off'}</span>
          </button>
          <InstallAppButton />
        </SettingsSection>
        )}

        {activeSection === 'data' && (
          <>
        <SettingsSection icon={Database} title="Data">
          <ActionRow icon={Database} title="Export account data" subtitle="Download profile, chats, notifications and reports JSON" action="Export" onClick={exportData} />
          <InfoRow icon={Shield} title="Safety data" subtitle="Reports help keep Random safer" value="Enabled" />
          <Link to="/privacy" className="interactive-card flex items-center gap-3 rounded-[14px] p-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ink shadow-nm-inset-sm text-white/70"><FileText size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Privacy Policy</span>
              <span className="block truncate text-xs text-slate-500">How Blippr handles account, chat, call and safety data</span>
            </span>
            <ChevronRight size={17} className="text-white/35" />
          </Link>
          <Link to="/terms" className="interactive-card flex items-center gap-3 rounded-[14px] p-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ink shadow-nm-inset-sm text-white/70"><FileText size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Terms of Use</span>
              <span className="block truncate text-xs text-slate-500">Rules for beta testers, safety and account use</span>
            </span>
            <ChevronRight size={17} className="text-white/35" />
          </Link>
        </SettingsSection>

        <button onClick={() => setDeleteConfirmOpen(true)} className="interactive-card flex w-full items-center gap-3 rounded-[18px] p-4 text-left text-coral">
          <span className="rounded-[14px] bg-ink shadow-nm-inset-sm p-3"><Trash2 size={18} /></span>
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

        <button onClick={logout} className="interactive-card flex w-full items-center gap-3 rounded-[18px] p-4 text-left text-coral">
          <span className="rounded-[14px] bg-ink shadow-nm-inset-sm p-3"><LogOut size={18} /></span>
          <span className="font-medium">Logout</span>
        </button>
          </>
        )}
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
      <section className="rounded-[20px] border border-white/5 bg-ink p-4 shadow-nm-inset">
        <div className="flex animate-pulse items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-white/10" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-40 rounded-full bg-white/10" />
            <div className="h-3 w-28 rounded-full bg-white/8" />
            <div className="h-3 w-20 rounded-full bg-white/8" />
          </div>
        </div>
      </section>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-[18px] border border-white/5 bg-ink shadow-nm-inset-sm" />
      ))}
    </div>
  );
}

function SettingsSection({ icon: Icon, title, children }) {
  return (
    <section className="depth-panel rounded-[18px] p-3 border border-slate-300 dark:border-slate-700/60">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-ink shadow-nm-inset-sm text-mint"><Icon size={16} /></span>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', prefix }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="mt-1.5 flex items-center rounded-[14px] border border-slate-300 dark:border-slate-700/80 bg-ink px-3 shadow-nm-inset-sm focus-within:border-mint focus-within:ring-1 focus-within:ring-mint/30 transition">
        {prefix && <span className="text-slate-400 mr-1">{prefix}</span>}
        <input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" type={type} />
      </div>
    </label>
  );
}

function GenderControl({ value, onChange }) {
  return (
    <div>
      <span className="text-xs text-slate-500">Gender</span>
      <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-[14px] border border-slate-300 dark:border-slate-700/80 bg-ink p-1 text-sm shadow-nm-inset-sm">
        {['female', 'male'].map((item) => (
          <button key={item} type="button" onClick={() => onChange(item)} className={`rounded-[10px] px-3 py-2.5 font-medium capitalize ${value === item ? 'btn-primary' : 'text-slate-500 dark:text-slate-400'}`}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionRow({ icon: Icon, title, subtitle, action, onClick }) {
  return (
    <button type="button" onClick={onClick} className="interactive-card flex w-full items-center gap-3 rounded-[14px] p-3 text-left border border-slate-200 dark:border-slate-700/60">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-ink shadow-nm-inset-sm text-white/70"><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-slate-800 dark:text-slate-200">{title}</span>
        <span className="block truncate text-xs text-slate-500">{subtitle}</span>
      </span>
      <span className="btn-primary flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold">
        {action}
        <ChevronRight size={13} />
      </span>
    </button>
  );
}

function MenuRow({ icon: Icon, title, subtitle, onClick }) {
  return (
    <button type="button" onClick={onClick} className="interactive-card flex w-full items-center gap-3 rounded-[14px] p-3 text-left transition active:scale-[0.99] border border-slate-200 dark:border-slate-700/60">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-ink shadow-nm-inset-sm text-white/72"><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-slate-800 dark:text-slate-200">{title}</span>
        <span className="block truncate text-xs text-slate-500">{subtitle}</span>
      </span>
      <ChevronRight size={17} className="text-slate-400" />
    </button>
  );
}

function InfoRow({ icon: Icon, title, subtitle, value }) {
  return (
    <div className="interactive-card flex items-center gap-3 rounded-[14px] p-3 border border-slate-200 dark:border-slate-700/60">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-ink shadow-nm-inset-sm text-white/70"><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-slate-800 dark:text-slate-200">{title}</span>
        <span className="block truncate text-xs text-slate-500">{subtitle}</span>
      </span>
      <span className="rounded-full bg-ink shadow-nm-inset-sm px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400">{value}</span>
    </div>
  );
}

function ToggleRow({ title, subtitle, checked, onChange }) {
  return (
    <button type="button" onClick={onChange} className="interactive-card flex w-full items-center gap-3 rounded-[14px] p-3 text-left border border-slate-200 dark:border-slate-700/60">
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-slate-800 dark:text-slate-200">{title}</span>
        <span className="block truncate text-xs text-slate-500">{subtitle}</span>
      </span>
      <span className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-mint' : 'bg-ink shadow-nm-inset-sm'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-slate-300 shadow transition ${checked ? 'left-6 bg-ink' : 'left-1'}`} />
      </span>
    </button>
  );
}

function SoundPicker({ title, value, onSelect, onUpload, onPreview }) {
  return (
    <div className="interactive-card rounded-[14px] p-3 border border-slate-200 dark:border-slate-700/60">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-ink shadow-nm-inset-sm text-mint"><Music size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-slate-800 dark:text-slate-200">{title}</span>
          <span className="block truncate text-xs text-slate-500">{value?.name || 'Default tone'}</span>
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
            className={`rounded-[13px] px-3 py-2 text-xs font-semibold ${value?.type === 'pack' && value.id === sound.id ? 'btn-primary' : 'btn-secondary text-slate-600 dark:text-white/68'}`}
          >
            {sound.name}
          </button>
        ))}
      </div>
      <label className="btn-secondary mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-[13px] py-2 text-xs font-semibold text-slate-700 dark:text-white/75">
        Upload from media
        <input type="file" accept="audio/*" className="hidden" onChange={(event) => onUpload(event.target.files?.[0])} />
      </label>
    </div>
  );
}
