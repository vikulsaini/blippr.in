import { useEffect, useState } from 'react';
import { Calendar, ChevronRight, Copy, Heart, MapPin, Shield, ShieldCheck, Settings, Sparkles, UserRound } from 'lucide-react';
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

  async function copyUsername() {
    const username = user?.username ? `@${user.username}` : '';
    if (!username) return;
    await navigator.clipboard?.writeText(username);
    setMessage(`${username} copied`);
  }

  if (!user && !message) return <ProfileSkeleton />;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 pb-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <section className="interactive-card relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_50%_18%,rgba(20,184,166,0.14),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.075),rgba(255,255,255,0.028)_58%,rgba(124,58,237,0.055))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(6,182,212,0.08)] backdrop-blur-xl lg:min-h-[28rem] lg:p-6">
        <div className="pointer-events-none absolute left-1/2 top-4 h-40 w-40 -translate-x-[58%] rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.28),rgba(14,165,233,0.13)_42%,transparent_72%)] blur-2xl" />
        <div className="pointer-events-none absolute -right-8 bottom-8 h-36 w-36 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute right-4 top-4 z-10">
          <button onClick={() => navigate('/app/settings')} className="btn-icon h-11 w-11" aria-label="Open settings">
            <Settings size={19} />
          </button>
        </div>

        <div className="relative pt-7 text-center">
          <div className="relative mx-auto h-32 w-32">
            <span className="absolute -inset-5 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.22),rgba(124,58,237,0.12)_45%,transparent_70%)] blur-xl" />
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-mint via-sky to-violet-300 p-[3px] shadow-[0_22px_60px_rgba(20,184,166,0.25),0_12px_36px_rgba(0,0,0,0.42)]">
              <span className="block h-full w-full rounded-full bg-ink shadow-[inset_0_2px_10px_rgba(255,255,255,0.08)]" />
            </span>
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="absolute inset-1.5 h-[calc(100%-0.75rem)] w-[calc(100%-0.75rem)] rounded-full object-cover shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]" />
            ) : (
              <div className="absolute inset-1.5 grid place-items-center rounded-full bg-white/8 text-white/45">
                <UserRound size={34} />
              </div>
            )}
            <span className={`absolute bottom-3 right-3 h-4 w-4 rounded-full border-2 border-ink ${user?.isOnline ? 'live-dot bg-mint text-mint shadow-[0_0_18px_rgba(61,214,198,0.7)]' : 'bg-white/35'}`} />
          </div>

          <div className="mx-auto mt-4 max-w-sm rounded-[24px] border border-white/10 bg-black/28 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-xl">
            <h1 className="truncate text-2xl font-semibold">{user?.name || 'Your profile'}</h1>
            <button type="button" onClick={copyUsername} className="mx-auto mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-white/62 transition hover:bg-white/8 hover:text-white" aria-label="Copy username">
              @{user?.username || 'username'}
              <Copy size={13} />
            </button>
          </div>

          <p className="mt-3 inline-flex rounded-full border border-mint/20 bg-gradient-to-r from-mint/22 to-sky/18 px-3 py-1 text-xs font-semibold text-mint shadow-[0_0_28px_rgba(45,212,191,0.18),inset_0_1px_0_rgba(255,255,255,0.18)]">
            {presenceText(user)}
          </p>

          <div className="mx-auto mt-3 flex max-w-md items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.055] px-3 py-2 shadow-[0_18px_42px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
            <div className="flex flex-wrap gap-1.5">
              <Badge icon={ShieldCheck} label="Trusted" />
              <Badge icon={Sparkles} label="VIP" muted />
              <Badge icon={Shield} label="Verified" muted />
            </div>
            <p className="shrink-0 text-[11px] font-medium text-white/45">12 Friends · 3 Rooms · 1 Badge</p>
          </div>
        </div>

        {user?.bio ? (
          <p className="mx-auto mt-5 max-w-sm text-center text-sm leading-6 text-white/70">{user.bio}</p>
        ) : (
          <p className="mx-auto mt-5 max-w-sm text-center text-sm leading-6 text-white/42">Tell people who you are in one line.</p>
        )}
      </section>

      {message && <p className="rounded-[16px] border border-coral/25 bg-coral/10 px-4 py-3 text-sm text-coral lg:col-span-2">{message}</p>}

      <section className="grid grid-cols-3 gap-2 lg:col-start-2 lg:row-start-1">
        <ProfileStat icon={Calendar} label="Age" value={user?.age || '-'} tone="mint" />
        <ProfileStat icon={UserRound} label="Gender" value={user?.gender || '-'} tone="sky" />
        <ProfileStat icon={Shield} label="Blocked" value={blockedCount} tone="rose" />
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.07),transparent_48%),rgba(255,255,255,0.035)] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.09)] backdrop-blur-xl lg:col-start-2">
        <InfoTile icon={Heart} title="Interests" subtitle="Help us match you better" value={user?.interests?.length ? user.interests.join(', ') : 'No interests added'} />
        <InfoTile icon={MapPin} title="Random rooms" subtitle={user?.location?.updatedAt ? 'Location ready' : 'Share location for nearby matches'} value={user?.location?.updatedAt ? 'Location ready' : 'Location not added'} />
        <InfoTile icon={Shield} title="Privacy" subtitle="Control last seen and receipts" value={user?.privacy?.showLastSeen === false ? 'Last seen hidden' : 'Last seen visible'} />
        <InfoTile icon={Calendar} title="Member type" subtitle={user?.isGuest ? 'Guest or registered account' : 'Upgrade to VIP for more control & visibility'} value={user?.isGuest ? 'Guest account' : 'Registered account'} />
      </section>

      <button onClick={() => navigate('/app/settings')} className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-cyan-100/40 bg-gradient-to-r from-cyan-300 via-sky to-violet-300 py-3.5 font-semibold text-ink shadow-[0_24px_56px_rgba(6,182,212,0.24),0_18px_34px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.72)] transition active:scale-[0.98] lg:col-start-2">
        <Settings size={18} />
        Edit profile & privacy
      </button>
    </div>
  );
}

function Badge({ icon: Icon, label, muted = false }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${muted ? 'border-white/8 bg-white/6 text-white/45' : 'border-mint/20 bg-mint/10 text-mint'}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function ProfileStat({ icon: Icon, label, value, tone }) {
  const tones = {
    mint: 'from-mint/18 to-mint/5 text-mint',
    sky: 'from-sky/18 to-sky/5 text-sky',
    rose: 'from-rose/18 to-rose/5 text-rose'
  };
  return (
    <div className={`interactive-card rounded-[20px] border border-white/10 bg-gradient-to-b ${tones[tone]} p-3 text-center shadow-[0_18px_44px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.12)]`}>
      <span className="mx-auto grid h-8 w-8 place-items-center rounded-2xl bg-white/8 text-current">
        <Icon size={15} />
      </span>
      <p className="text-xl font-semibold capitalize text-white">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-white/45">{label}</p>
    </div>
  );
}

function InfoTile({ icon: Icon, title, subtitle, value }) {
  return (
    <div className="interactive-card flex items-center gap-3 rounded-[18px] border border-white/6 bg-white/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/8 text-mint">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-[11px] text-white/35">{subtitle}</span>
        <span className="block truncate text-xs text-white/45">{value}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-white/28" />
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
