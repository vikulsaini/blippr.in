import { useEffect, useState } from 'react';
import { ArrowLeft, Ban, Bell, ChevronRight, Database, LockKeyhole, LogOut, MapPin, Save, Settings, Shield, Smartphone, Unlock, UserRound } from 'lucide-react';
import InstallAppButton from '../components/InstallAppButton.jsx';
import { api } from '../lib/api.js';
import { enablePushNotifications } from '../lib/notifications.js';
import { presenceText } from '../lib/presence.js';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [form, setForm] = useState({ name: '', username: '', age: '', gender: 'female', bio: '', avatar: '' });
  const [message, setMessage] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        username: currentUser.username || '',
        age: currentUser.age || '',
        gender: currentUser.gender || 'female',
        bio: currentUser.bio || '',
        avatar: currentUser.avatar || ''
      });
    }
    load().catch((err) => setMessage(err.message));
  }, []);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    try {
      const payload = { ...form, age: Number(form.age) };
      if (!payload.avatar.trim()) delete payload.avatar;
      const { user: updated } = await api('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setUser(updated);
      setMessage('Profile saved');
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
          setMessage('Location updated for matching');
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

  function logout() {
    localStorage.removeItem('varta_token');
    window.location.href = '/auth';
  }

  if (settingsOpen) {
    return (
      <div className="space-y-3">
        <header className="flex items-center gap-3">
          <button onClick={() => setSettingsOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white/8" aria-label="Back to profile">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-semibold">Settings</h2>
            <p className="text-xs text-white/45">Profile, privacy, security and app controls</p>
          </div>
        </header>

        {message && <p className="rounded-[16px] border border-mint/20 bg-mint/10 px-4 py-3 text-sm text-mint">{message}</p>}

        <form onSubmit={saveProfile} className="space-y-3">
          <SettingsSection icon={UserRound} title="Profile settings">
            <div className="flex items-center gap-3">
              {form.avatar ? <img src={form.avatar} alt="" className="h-14 w-14 rounded-full bg-white/8 object-cover" /> : <div className="h-14 w-14 rounded-full bg-white/8" />}
              <div className="min-w-0 flex-1">
                <Field label="Profile photo URL" value={form.avatar} onChange={(value) => setField('avatar', value)} />
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
              <textarea value={form.bio} onChange={(event) => setField('bio', event.target.value)} className="mt-1.5 min-h-20 w-full resize-none rounded-[14px] border border-white/8 bg-ink/35 px-3 py-2.5 text-sm outline-none" placeholder="A little about you" maxLength={160} />
            </label>
            <button className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-white py-3 font-semibold text-ink">
              <Save size={18} />
              Save changes
            </button>
          </SettingsSection>
        </form>

        <SettingsSection icon={Shield} title="Privacy">
          <ActionRow icon={MapPin} title="Matching location" subtitle={user?.location?.updatedAt ? 'Location saved for nearby matches' : 'Not shared yet'} action="Refresh" onClick={refreshLocation} />
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
                <div key={blockedUser._id} className="flex items-center gap-3 rounded-[16px] bg-ink/30 p-2">
                  <img src={blockedUser.avatar} alt="" className="h-11 w-11 rounded-full bg-white/8 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{blockedUser.name}</p>
                    <p className="truncate text-xs text-white/45">@{blockedUser.username}</p>
                  </div>
                  <button onClick={() => unblockUser(blockedUser._id)} className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink" aria-label={`Unblock ${blockedUser.name}`}>
                    <Unlock size={17} />
                  </button>
                </div>
              ))}
              {!blockedUsers.length && <p className="rounded-[14px] bg-white/4 px-3 py-3 text-center text-sm text-white/42">Blocked people will appear here.</p>}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection icon={LockKeyhole} title="Security">
          <InfoRow icon={Smartphone} title="Active logins" subtitle="This browser is currently active" value="1 device" />
          <InfoRow icon={LockKeyhole} title="Password and sessions" subtitle="Email login sessions use JWT security" value="Protected" />
        </SettingsSection>

        <SettingsSection icon={Bell} title="Notifications">
          <ActionRow icon={Bell} title="Push notifications" subtitle="Messages, requests, and calls" action="Enable" onClick={turnOnNotifications} />
          <InstallAppButton />
        </SettingsSection>

        <SettingsSection icon={Database} title="Data">
          <InfoRow icon={Database} title="Account data" subtitle="Profile, chats, blocks and requests are stored securely" value="Synced" />
          <InfoRow icon={Shield} title="Safety data" subtitle="Reports help keep Match safer" value="Enabled" />
        </SettingsSection>

        <button onClick={logout} className="surface flex w-full items-center gap-3 rounded-[18px] p-4 text-left text-coral">
          <span className="rounded-[14px] bg-coral/10 p-3"><LogOut size={18} /></span>
          <span className="font-medium">Logout</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="rounded-[20px] border border-white/8 bg-white/5 p-4">
        <div className="mb-3 flex justify-end">
          <button onClick={() => setSettingsOpen(true)} className="grid h-10 w-10 place-items-center rounded-full bg-white/8" aria-label="Open settings">
            <Settings size={18} />
          </button>
        </div>
        <div className="flex items-center gap-4">
          {user?.avatar ? <img src={user.avatar} alt="" className="h-20 w-20 rounded-full bg-white/8 object-cover" /> : <div className="h-20 w-20 rounded-full bg-white/8" />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-2xl font-semibold">{user?.name || 'Your profile'}</h2>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${user?.isOnline ? 'bg-mint' : 'bg-white/35'}`} />
            </div>
            <p className="truncate text-sm text-white/55">@{user?.username || 'username'}</p>
            <p className="mt-1 text-xs text-mint">{presenceText(user)}</p>
          </div>
        </div>
        {user?.bio && <p className="mt-4 border-t border-white/8 pt-3 text-sm leading-relaxed text-white/68">{user.bio}</p>}
      </section>

      {message && <p className="rounded-[16px] border border-mint/20 bg-mint/10 px-4 py-3 text-sm text-mint">{message}</p>}

      <section className="rounded-[18px] border border-white/8 bg-white/5 p-2">
        <MenuRow icon={Settings} title="Settings" subtitle="Profile, security, notifications and data" onClick={() => setSettingsOpen(true)} />
        <MenuRow icon={MapPin} title="Matching location" subtitle={user?.location?.updatedAt ? 'Location is ready for nearby matches' : 'Refresh to improve matches'} onClick={refreshLocation} />
        <MenuRow icon={Shield} title="Privacy" subtitle={`${blockedUsers.length} blocked users`} onClick={() => setSettingsOpen(true)} />
      </section>
    </div>
  );
}

function SettingsSection({ icon: Icon, title, children }) {
  return (
    <section className="rounded-[18px] border border-white/8 bg-white/5 p-3">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white/8 text-mint"><Icon size={16} /></span>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/62">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', prefix }) {
  return (
    <label className="block">
      <span className="text-xs text-white/42">{label}</span>
      <div className="mt-1.5 flex items-center rounded-[14px] border border-white/8 bg-ink/35 px-3">
        {prefix && <span className="text-white/35">{prefix}</span>}
        <input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" type={type} />
      </div>
    </label>
  );
}

function GenderControl({ value, onChange }) {
  return (
    <div>
      <span className="text-xs text-white/42">Gender</span>
      <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-[14px] border border-white/8 bg-ink/35 p-1 text-sm">
        {['female', 'male'].map((item) => (
          <button key={item} type="button" onClick={() => onChange(item)} className={`rounded-[10px] px-3 py-2.5 font-medium capitalize ${value === item ? 'bg-white text-ink' : 'text-white/62'}`}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionRow({ icon: Icon, title, subtitle, action, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-[14px] bg-ink/35 p-3 text-left">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white/8 text-white/70"><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block truncate text-xs text-white/45">{subtitle}</span>
      </span>
      <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink">
        {action}
        <ChevronRight size={13} />
      </span>
    </button>
  );
}

function MenuRow({ icon: Icon, title, subtitle, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-[14px] p-3 text-left hover:bg-white/5">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white/8 text-white/72"><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block truncate text-xs text-white/45">{subtitle}</span>
      </span>
      <ChevronRight size={17} className="text-white/35" />
    </button>
  );
}

function InfoRow({ icon: Icon, title, subtitle, value }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-ink/35 p-3">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white/8 text-white/70"><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block truncate text-xs text-white/45">{subtitle}</span>
      </span>
      <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/72">{value}</span>
    </div>
  );
}
