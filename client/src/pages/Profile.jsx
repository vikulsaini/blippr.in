import { useEffect, useState } from 'react';
import { Calendar, Heart, MapPin, Settings, Shield, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { presenceText } from '../lib/presence.js';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [blockedCount, setBlockedCount] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      const [{ user: currentUser }, { users: blocked }] = await Promise.all([
        api('/api/users/me'),
        api('/api/safety/blocked')
      ]);
      setUser(currentUser);
      setBlockedCount(blocked.length);
    }
    load().catch((err) => setMessage(err.message));
  }, []);

  if (!user && !message) return <ProfileSkeleton />;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 pb-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <section className="accent-card interactive-card relative overflow-hidden rounded-[28px] p-4 lg:min-h-[28rem] lg:p-6">
        <div className="pointer-events-none absolute -left-10 top-10 h-32 w-32 rounded-full bg-mint/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-8 bottom-8 h-32 w-32 rounded-full bg-rose/10 blur-3xl" />
        <div className="absolute right-4 top-4 z-10">
          <button onClick={() => navigate('/app/settings')} className="btn-icon h-11 w-11" aria-label="Open settings">
            <Settings size={19} />
          </button>
        </div>

        <div className="pt-7 text-center">
          <div className="relative mx-auto h-28 w-28">
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-mint via-sky to-rose p-[2px]">
              <span className="block h-full w-full rounded-full bg-ink" />
            </span>
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)] rounded-full object-cover" />
            ) : (
              <div className="absolute inset-1 grid rounded-full bg-white/8 place-items-center text-white/45">
                <UserRound size={34} />
              </div>
            )}
            <span className={`absolute bottom-2 right-2 h-4 w-4 rounded-full border-2 border-ink ${user?.isOnline ? 'live-dot bg-mint text-mint shadow-[0_0_18px_rgba(61,214,198,0.7)]' : 'bg-white/35'}`} />
          </div>

          <h1 className="mt-4 truncate text-3xl font-semibold">{user?.name || 'Your profile'}</h1>
          <p className="mt-1 text-sm text-white/55">@{user?.username || 'username'}</p>
          <p className="mt-2 inline-flex rounded-full border border-mint/20 bg-mint/10 px-3 py-1 text-xs font-semibold text-mint">
            {presenceText(user)}
          </p>
        </div>

        {user?.bio ? (
          <p className="mx-auto mt-5 max-w-sm text-center text-sm leading-6 text-white/70">{user.bio}</p>
        ) : (
          <p className="mx-auto mt-5 max-w-sm text-center text-sm leading-6 text-white/42">Add a short bio from settings so friends know more about you.</p>
        )}
      </section>

      {message && <p className="rounded-[16px] border border-coral/25 bg-coral/10 px-4 py-3 text-sm text-coral lg:col-span-2">{message}</p>}

      <section className="grid grid-cols-3 gap-2 lg:col-start-2 lg:row-start-1">
        <ProfileStat label="Age" value={user?.age || '-'} tone="mint" />
        <ProfileStat label="Gender" value={user?.gender || '-'} tone="sky" />
        <ProfileStat label="Blocked" value={blockedCount} tone="rose" />
      </section>

      <section className="depth-panel rounded-[22px] p-3 lg:col-start-2">
        <InfoTile icon={Heart} title="Interests" value={user?.interests?.length ? user.interests.join(', ') : 'No interests added'} />
        <InfoTile icon={MapPin} title="Random rooms" value={user?.location?.updatedAt ? 'Location ready' : 'Location not added'} />
        <InfoTile icon={Shield} title="Privacy" value={user?.privacy?.showLastSeen === false ? 'Last seen hidden' : 'Last seen visible'} />
        <InfoTile icon={Calendar} title="Member type" value={user?.isGuest ? 'Guest account' : 'Registered account'} />
      </section>

      <button onClick={() => navigate('/app/settings')} className="btn-primary flex w-full items-center justify-center gap-2 rounded-[18px] py-3 font-semibold lg:col-start-2">
        <Settings size={18} />
        Open settings
      </button>
    </div>
  );
}

function ProfileStat({ label, value, tone }) {
  const tones = {
    mint: 'from-mint/18 to-mint/5 text-mint',
    sky: 'from-sky/18 to-sky/5 text-sky',
    rose: 'from-rose/18 to-rose/5 text-rose'
  };
  return (
    <div className={`interactive-card rounded-[18px] border border-white/8 bg-gradient-to-b ${tones[tone]} p-3 text-center`}>
      <p className="text-xl font-semibold capitalize text-white">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-white/45">{label}</p>
    </div>
  );
}

function InfoTile({ icon: Icon, title, value }) {
  return (
    <div className="interactive-card flex items-center gap-3 rounded-[16px] p-3">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/8 text-mint">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-white/45">{value}</span>
      </span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <section className="accent-card rounded-[28px] p-4">
        <div className="mx-auto h-28 w-28 animate-pulse rounded-full bg-white/10" />
        <div className="mx-auto mt-5 h-7 w-44 animate-pulse rounded-full bg-white/10" />
        <div className="mx-auto mt-3 h-4 w-28 animate-pulse rounded-full bg-white/8" />
      </section>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-[18px] border border-white/8 bg-white/5" />
        ))}
      </div>
    </div>
  );
}
