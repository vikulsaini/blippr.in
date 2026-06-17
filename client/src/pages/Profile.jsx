import { useEffect, useState } from 'react';
import { Calendar, ChevronRight, Copy, Heart, MapPin, MessageCircle, Shield, ShieldCheck, Settings, Sparkles, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { presenceText } from '../lib/presence.js';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [chatsCount, setChatsCount] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      const [{ user: currentUser }, { chats: allChats }] = await Promise.all([
        api('/api/users/me'),
        api('/api/chats')
      ]);
      setUser(currentUser);
      setChatsCount(allChats.length);
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

  const hasInterests = !!user?.interests?.length;
  const hasLocation = !!user?.location?.updatedAt;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 pb-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      {user?.isGuest && (
        <div className="surface rounded-2xl border border-mint/20 bg-mint/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:col-span-2 shadow-nm-flat-sm">
          <div>
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">You are logged in as a Guest</p>
            <p className="text-xs text-slate-500 mt-0.5">Complete your profile to set a custom username and unlock full features.</p>
          </div>
          <button onClick={() => navigate('/app/settings')} className="btn-primary rounded-full px-4 py-2 text-xs font-semibold shrink-0">
            Set Username →
          </button>
        </div>
      )}

      <section className="interactive-card relative overflow-hidden rounded-[30px] p-4 lg:min-h-[28rem] lg:p-6 border border-slate-300 dark:border-slate-700/60">
        <div className="pointer-events-none absolute left-1/2 top-4 h-40 w-40 -translate-x-[58%] rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.28),rgba(14,165,233,0.13)_42%,transparent_72%)] blur-2xl" />
        <div className="pointer-events-none absolute -right-8 bottom-8 h-36 w-36 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute right-4 top-4 z-10">
          <button onClick={() => navigate('/app/settings')} className="btn-icon h-12 w-12" aria-label="Open settings">
            <Settings size={20} />
          </button>
        </div>

        <div className="relative pt-16 pb-4 text-center">
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

          <div className="mx-auto mt-4 max-w-sm rounded-[24px] border border-slate-300 dark:border-slate-700/80 bg-ink px-4 py-3 shadow-nm-inset">
            <h1 className="truncate text-2xl font-semibold">{user?.isGuest ? 'Guest User' : (user?.name || 'Your profile')}</h1>
            {user?.isGuest ? (
              <p className="mx-auto mt-1 text-sm font-medium text-slate-500 italic">No custom username set</p>
            ) : (
              <button type="button" onClick={copyUsername} className="mx-auto mt-1 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:text-mint hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition active:scale-95" aria-label="Copy username">
                @{user?.username || 'username'}
                <Copy size={14} />
              </button>
            )}
          </div>

          <p className="mt-3 inline-flex rounded-full border border-mint/20 bg-gradient-to-r from-mint/22 to-sky/18 px-3 py-1 text-xs font-semibold text-mint shadow-[0_0_28px_rgba(45,212,191,0.18),inset_0_1px_0_rgba(255,255,255,0.18)]">
            {presenceText(user)}
          </p>

          <div className="mx-auto mt-3 flex max-w-md items-center justify-between gap-3 rounded-[20px] border border-white/5 bg-ink px-3 py-2 shadow-nm-inset-sm">
            <div className="flex flex-wrap gap-1.5">
              <Badge icon={ShieldCheck} label="Trusted" />
              <Badge icon={Sparkles} label="VIP" muted />
              <Badge icon={Shield} label="Verified" muted />
            </div>
            <p className="shrink-0 text-[11px] font-medium text-slate-500">{user?.isGuest ? 'Guest Profile' : 'Registered user'}</p>
          </div>
        </div>

        {user?.bio ? (
          <p className="mx-auto mt-5 max-w-sm text-center text-sm leading-6 text-slate-700 dark:text-slate-300">{user.bio}</p>
        ) : (
          <p className="mx-auto mt-5 max-w-sm text-center text-sm leading-6 italic text-slate-400 dark:text-slate-500">Tell people who you are in one line.</p>
        )}
      </section>

      {message && <p className="rounded-[16px] border border-coral/25 bg-coral/10 px-4 py-3 text-sm text-coral lg:col-span-2">{message}</p>}

      <section className="grid grid-cols-3 gap-2 lg:col-start-2 lg:row-start-1">
        <ProfileStat icon={Calendar} label="Age" value={user?.age || '-'} tone="mint" />
        <ProfileStat icon={UserRound} label="Gender" value={user?.gender || '-'} tone="sky" />
        <ProfileStat icon={Shield} label="Safety Blocks" value={user?.blockedUsers?.length || 0} tone="rose" />
      </section>

      <section className="rounded-[24px] border border-slate-300 dark:border-slate-700/60 bg-ink p-3 shadow-nm-inset lg:col-start-2 space-y-3">
        {!hasInterests && !hasLocation ? (
          <InfoTile icon={Sparkles} title="Complete your profile" subtitle="Add interests and share location to match with nearby users" value="Complete your profile →" onClick={() => navigate('/app/settings')} />
        ) : (
          <>
            <InfoTile icon={Heart} title="Interests" subtitle="Help us match you better" value={user?.interests?.length ? user.interests.join(', ') : 'No interests added'} />
            <InfoTile icon={MapPin} title="Random rooms" subtitle={user?.location?.updatedAt ? 'Location ready' : 'Share location for nearby matches'} value={user?.location?.updatedAt ? 'Location ready' : 'Location not added'} />
          </>
        )}
        <InfoTile icon={Shield} title="Privacy" subtitle="Control last seen and receipts" value={user?.privacy?.showLastSeen === false ? 'Last seen hidden' : 'Last seen visible'} />
        <InfoTile icon={Calendar} title="Member type" subtitle={user?.isGuest ? 'Guest or registered account' : 'Upgrade to VIP for more control & visibility'} value={user?.isGuest ? 'Guest account' : 'Registered account'} />
      </section>

      <button onClick={() => navigate('/app/settings')} className="btn-primary flex w-full items-center justify-center gap-2 rounded-[20px] py-3.5 font-semibold transition lg:col-start-2">
        <Settings size={18} />
        Edit profile & privacy
      </button>
    </div>
  );
}

function Badge({ icon: Icon, label, muted = false }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${muted ? 'border-slate-300 dark:border-white/8 bg-slate-100 dark:bg-white/6 text-slate-500 dark:text-white/45' : 'border-mint/20 bg-mint/10 text-mint'}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function ProfileStat({ icon: Icon, label, value, tone }) {
  const textTones = {
    mint: 'text-mint',
    sky: 'text-sky',
    rose: 'text-rose'
  };
  return (
    <div className="rounded-[20px] p-3 text-center bg-slate-50/50 dark:bg-[#1A2230] border border-slate-200 dark:border-slate-700/60 shadow-nm-flat-sm transition hover:scale-105 active:scale-95">
      <span className={`mx-auto grid h-8 w-8 place-items-center rounded-2xl bg-ink shadow-nm-inset-sm ${textTones[tone]}`}>
        <Icon size={15} />
      </span>
      <p className="text-xl font-semibold capitalize text-slate-800 dark:text-slate-100 mt-1">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function InfoTile({ icon: Icon, title, subtitle, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`interactive-card flex w-full items-center gap-3 rounded-[18px] p-3 text-left ${onClick ? 'cursor-pointer' : 'disabled:pointer-events-none'}`}
    >
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-ink shadow-nm-inset-sm text-mint">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{title}</span>
        <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">{subtitle}</span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400 font-semibold">{value}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-slate-400 dark:text-slate-600" />
    </button>
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
