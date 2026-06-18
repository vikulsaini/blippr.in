import { useEffect, useState } from 'react';
import { Calendar, ChevronRight, Copy, Heart, MapPin, MessageCircle, Shield, ShieldCheck, Settings, Sparkles, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../components/Toast.jsx';
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
    showToast(`${username} copied`, 'success');
  }

  if (!user && !message) return <ProfileSkeleton />;

  const hasInterests = !!user?.interests?.length;
  const hasLocation = !!user?.location?.updatedAt;

  /* Profile completeness */
  const fields = [user?.name, user?.username, user?.avatar, user?.bio, user?.age, hasInterests, hasLocation];
  const completedCount = fields.filter(Boolean).length;
  const completionPct = Math.round((completedCount / fields.length) * 100);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 pb-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      {user?.isGuest && (
        <div className="surface-card rounded-2xl border-accent/20 bg-accent/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:col-span-2">
          <div>
            <p className="font-semibold text-sm text-text-primary">You are logged in as a Guest</p>
            <p className="text-xs text-text-muted mt-0.5">Complete your profile to set a custom username and unlock full features.</p>
          </div>
          <button onClick={() => navigate('/app/settings')} className="btn-primary rounded-full px-4 py-2 text-xs font-semibold shrink-0">
            Set Username →
          </button>
        </div>
      )}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="elevated-card relative overflow-hidden rounded-3xl p-4 lg:min-h-[28rem] lg:p-6"
      >
        <div className="pointer-events-none absolute left-1/2 top-4 h-40 w-40 -translate-x-[58%] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.08),rgba(124,58,237,0.04)_42%,transparent_72%)] blur-2xl" />
        <div className="absolute right-4 top-4 z-10">
          <button onClick={() => navigate('/app/settings')} className="btn-icon h-12 w-12" aria-label="Open settings">
            <Settings size={20} />
          </button>
        </div>

        <div className="relative pt-16 pb-4 text-center">
          <div className="relative mx-auto h-32 w-32">
            {/* Completion ring */}
            <svg className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)]" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="66" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle
                cx="70" cy="70" r="66" fill="none"
                stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${completionPct * 4.15} ${415 - completionPct * 4.15}`}
                strokeDashoffset="104"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent/30 via-sky-400/20 to-violet-300/15 p-[3px] shadow-float overflow-hidden flex items-center justify-center">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover bg-surface" />
              ) : (
                <div className="grid h-full w-full place-items-center rounded-full bg-bg text-text-faint">
                  <UserRound size={34} />
                </div>
              )}
            </div>
            <span className={`absolute bottom-2 right-2 z-10 h-4.5 w-4.5 rounded-full border-2 border-surface ${user?.isOnline ? 'live-dot bg-success text-success' : 'bg-border-default'}`} />
          </div>

          <div className="mx-auto mt-4 max-w-sm rounded-[24px] border border-border-default bg-surface px-4 py-3 shadow-card">
            <h1 className="truncate text-2xl font-semibold text-text-primary">{user?.isGuest ? 'Guest User' : (user?.name || 'Your profile')}</h1>
            {user?.isGuest ? (
              <p className="mx-auto mt-1 text-sm font-medium text-text-muted italic">No custom username set</p>
            ) : (
              <button type="button" onClick={copyUsername} className="mx-auto mt-1 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-text-muted hover:text-accent hover:bg-accent-tint transition active:scale-95 cursor-pointer" aria-label="Copy username">
                @{user?.username || 'username'}
                <Copy size={14} />
              </button>
            )}
          </div>

          <div className={`mt-4 inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm transition mx-auto ${
            user?.isOnline 
              ? 'border-accent/30 bg-accent/8 text-accent' 
              : 'border-slate-300 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}>
            <span className={`h-2 w-2 rounded-full ${user?.isOnline ? 'bg-success badge-pulse' : 'bg-slate-400 dark:bg-slate-500'}`} />
            {presenceText(user)}
          </div>

          <div className="mx-auto mt-3 flex max-w-md items-center justify-between gap-3 rounded-[20px] border border-border-default bg-bg px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge icon={ShieldCheck} label="Trusted" />
              <Badge icon={Sparkles} label="VIP" muted />
              <Badge icon={Shield} label="Verified" muted />
            </div>
            <p className="shrink-0 text-[11px] font-medium text-text-muted">{user?.isGuest ? 'Guest Profile' : 'Registered user'}</p>
          </div>

          {completionPct < 100 && (
            <p className="mt-3 text-[11px] font-semibold text-text-faint">Profile {completionPct}% complete</p>
          )}
        </div>

        {user?.bio ? (
          <p className="mx-auto mt-5 max-w-sm text-center text-sm leading-6 text-text-secondary">{user.bio}</p>
        ) : (
          <p className="mx-auto mt-5 max-w-sm text-center text-sm leading-6 italic text-text-faint">Tell people who you are in one line.</p>
        )}
      </motion.section>

      {message && <p className="rounded-2xl border border-danger/25 bg-danger/8 px-4 py-3 text-sm text-danger lg:col-span-2">{message}</p>}

      <section className="grid grid-cols-3 gap-2 lg:col-start-2 lg:row-start-1">
        <ProfileStat icon={Calendar} label="Age" value={user?.age || '-'} tone="accent" delay={0} />
        <ProfileStat icon={UserRound} label="Gender" value={user?.gender || '-'} tone="sky" delay={0.06} />
        <ProfileStat icon={Shield} label="Blocks" value={user?.blockedUsers?.length || 0} tone="rose" delay={0.12} />
      </section>

      <section className="rounded-3xl border border-border-default bg-surface p-3 shadow-card lg:col-start-2 space-y-3">
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

      <button onClick={() => navigate('/app/settings')} className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold transition lg:col-start-2">
        <Settings size={18} />
        Edit profile & privacy
      </button>
    </div>
  );
}

function Badge({ icon: Icon, label, muted = false }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${muted ? 'border-border-default bg-bg text-text-faint' : 'border-accent/20 bg-accent/10 text-accent'}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function ProfileStat({ icon: Icon, label, value, tone, delay = 0 }) {
  const toneColors = {
    accent: { icon: 'text-accent bg-accent/10', text: 'text-accent' },
    sky: { icon: 'text-sky-500 bg-sky-500/10', text: 'text-sky-500' },
    rose: { icon: 'text-rose-500 bg-rose-500/10', text: 'text-rose-500' }
  };
  const colors = toneColors[tone] || toneColors.accent;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="surface-card rounded-2xl p-3 text-center"
    >
      <span className={`mx-auto grid h-9 w-9 place-items-center rounded-xl ${colors.icon}`}>
        <Icon size={16} />
      </span>
      <p className="text-xl font-semibold capitalize text-text-primary mt-1.5">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
    </motion.div>
  );
}

function InfoTile({ icon: Icon, title, subtitle, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`interactive-card flex w-full items-center gap-3 rounded-2xl p-3 text-left ${onClick ? 'cursor-pointer' : 'disabled:pointer-events-none disabled:cursor-default'}`}
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text-primary">{title}</span>
        <span className="block truncate text-[11px] text-text-faint">{subtitle}</span>
        <span className="block truncate text-xs text-text-muted font-semibold">{value}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-text-faint" />
    </button>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <section className="elevated-card rounded-3xl p-4">
        <div className="mx-auto h-28 w-28 rounded-full skeleton" />
        <div className="mx-auto mt-5 h-7 w-44 rounded-full skeleton" />
        <div className="mx-auto mt-3 h-4 w-28 rounded-full skeleton" />
      </section>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-20 rounded-2xl skeleton" />
        ))}
      </div>
    </div>
  );
}
