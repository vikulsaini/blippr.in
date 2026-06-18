import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, MapPin, Shield, UserRound, LogOut, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [showPromo, setShowPromo] = useState(true);

  useEffect(() => {
    async function load() {
      const { user: currentUser } = await api('/api/users/me');
      setUser(currentUser);
    }
    load().catch((err) => setMessage(err.message));
  }, []);

  async function handleLogout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout warning:', err.message);
    }
    localStorage.removeItem('blippr_token');
    navigate('/', { replace: true });
    window.location.reload();
  }

  if (!user && !message) return <ProfileSkeleton />;

  return (
    <div className="mx-auto w-full max-w-lg md:max-w-4xl min-h-full overflow-y-auto bg-bg text-text-primary">
      {/* Responsive Grid layout for larger viewports */}
      <div className="md:grid md:grid-cols-[1.1fr_1.3fr] md:gap-6 md:p-6 md:items-start pb-24 md:pb-6">
        
        {/* Left Column on Desktop */}
        <div className="space-y-4 md:space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-accent to-violet-600 px-6 pt-6 pb-8 rounded-b-[2.5rem] md:rounded-[2.5rem] shadow-card relative">
            {/* Top controls */}
            <div className="flex items-center justify-between w-full mb-4">
              <button 
                onClick={() => navigate('/app')} 
                className="text-white hover:bg-white/10 p-2 rounded-full transition active:scale-95"
                aria-label="Back to chats"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={() => navigate('/app/settings')} 
                className="text-white hover:bg-white/10 p-2 rounded-full transition active:scale-95"
                aria-label="Open settings"
              >
                <Settings size={20} className="animate-spin-hover" />
              </button>
            </div>

            {/* Profile details */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative h-24 w-24 rounded-full border-[4px] border-white/90 bg-white/10 shadow-elevated flex items-center justify-center overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound size={32} className="text-white/60" />
                )}
              </div>
              <h1 className="text-lg font-bold text-white mt-3 text-center">{user?.isGuest ? 'Guest User' : user?.name}</h1>
              <p className="text-white/70 text-xs mt-0.5 text-center select-none font-medium">
                {user?.isGuest ? 'Guest account' : user?.email || `@${user?.username}`}
              </p>
            </div>
          </div>

          {/* Premium Promo Card (based on reference) */}
          {showPromo && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="surface-card rounded-[22px] p-5 border border-border-default bg-surface shadow-card relative overflow-hidden hidden md:block"
            >
              <div className="flex gap-3">
                <span className="text-xl shrink-0">👑</span>
                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="text-xs font-extrabold text-text-primary capitalize leading-none">
                    {user?.name?.split(' ')[0] || 'User'}, join Blippr {user?.isGuest ? 'Premium' : 'VIP'}
                  </h3>
                  <p className="text-[10px] leading-relaxed text-text-muted font-medium mt-1">
                    {user?.isGuest 
                      ? 'Register to set a custom username, send friend requests, and unlock nearby matchmaking.' 
                      : 'Subscribe to unlock read receipts, private chat vault, and support independent creators.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={() => {
                    if (user?.isGuest) {
                      window.dispatchEvent(new CustomEvent('blippr:guest-expired'));
                    } else {
                      showToast('VIP subscriptions coming soon!', 'info');
                    }
                  }}
                  className="flex-1 py-2.5 bg-accent hover:bg-accent-hover text-white text-[11px] font-bold rounded-xl transition shadow-sm"
                >
                  {user?.isGuest ? 'REGISTER' : 'SUBSCRIBE'}
                </button>
                <button
                  onClick={() => setShowPromo(false)}
                  className="flex-1 py-2.5 bg-surface-hover hover:opacity-90 text-text-secondary text-[11px] font-bold rounded-xl border border-border-default transition"
                >
                  RESTORE
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column on Desktop / Content on Mobile */}
        <div className="px-4 py-6 md:px-0 md:py-0 space-y-6">
          {/* Mobile Promo Card */}
          {showPromo && (
            <div className="surface-card rounded-[22px] p-5 border border-border-default bg-surface shadow-card relative overflow-hidden md:hidden">
              <div className="flex gap-3">
                <span className="text-xl shrink-0">👑</span>
                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="text-xs font-extrabold text-text-primary capitalize leading-none">
                    {user?.name?.split(' ')[0] || 'User'}, join Blippr {user?.isGuest ? 'Premium' : 'VIP'}
                  </h3>
                  <p className="text-[10px] leading-relaxed text-text-muted font-medium mt-1">
                    {user?.isGuest 
                      ? 'Register to set a custom username, send friend requests, and unlock nearby matchmaking.' 
                      : 'Subscribe to unlock read receipts, private chat vault, and support independent creators.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={() => {
                    if (user?.isGuest) {
                      window.dispatchEvent(new CustomEvent('blippr:guest-expired'));
                    } else {
                      showToast('VIP subscriptions coming soon!', 'info');
                    }
                  }}
                  className="flex-1 py-2.5 bg-accent hover:bg-accent-hover text-white text-[11px] font-bold rounded-xl transition shadow-sm"
                >
                  {user?.isGuest ? 'REGISTER' : 'SUBSCRIBE'}
                </button>
                <button
                  onClick={() => setShowPromo(false)}
                  className="flex-1 py-2.5 bg-surface-hover hover:opacity-90 text-text-secondary text-[11px] font-bold rounded-xl border border-border-default transition"
                >
                  RESTORE
                </button>
              </div>
            </div>
          )}

          {message && (
            <p className="rounded-2xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger md:hidden">{message}</p>
          )}

          {/* Settings option lists */}
          <div>
            <div className="px-4 py-1.5 bg-surface-hover rounded-xl text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-2.5 w-fit">
              Content
            </div>
            
            <div className="surface-card rounded-[22px] border border-border-default bg-surface overflow-hidden shadow-card divide-y divide-border-default/40">
              <SettingsRow 
                icon={UserRound} 
                title="Connected profile" 
                subtitle={`${user?.age ? `${user.age} y/o` : ''} · ${user?.gender || 'No gender set'}`}
                onClick={() => navigate('/app/profile/edit')} 
              />
              <SettingsRow 
                icon={Heart} 
                title="My hobbies & interests" 
                subtitle={user?.interests?.length ? user.interests.join(', ') : 'Add interests for matches'}
                onClick={() => navigate('/app/profile/interests')} 
              />
              <SettingsRow 
                icon={Shield} 
                title="Privacy & security" 
                subtitle="Control last seen and receipts"
                onClick={() => navigate('/app/profile/privacy')} 
              />
              <SettingsRow 
                icon={MapPin} 
                title="Matchmaking location" 
                subtitle={user?.location?.updatedAt ? 'Location shared' : 'Add location for nearby matches'}
                onClick={() => navigate('/app/profile/location')} 
              />
            </div>
          </div>

          <div>
            <div className="px-4 py-1.5 bg-surface-hover rounded-xl text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-2.5 w-fit">
              System
            </div>
            <div className="surface-card rounded-[22px] border border-border-default bg-surface overflow-hidden shadow-card">
              <SettingsRow 
                icon={LogOut} 
                title="Logout" 
                subtitle="Log out from your current session"
                onClick={handleLogout}
                danger
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function SettingsRow({ icon: Icon, title, subtitle, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 p-4 text-left hover:bg-surface-hover/50 transition active:scale-[0.99]"
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${danger ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'}`}>
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-xs font-bold leading-none ${danger ? 'text-danger' : 'text-text-primary'}`}>{title}</span>
        <span className="block truncate text-[10px] text-text-faint mt-1.5 font-semibold leading-none">{subtitle}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-text-faint/60" />
    </button>
  );
}

function ProfileSkeleton() {
  return (
    <div className="w-full max-w-lg md:max-w-4xl mx-auto bg-bg animate-pulse">
      <div className="md:grid md:grid-cols-[1.1fr_1.3fr] md:gap-6 md:p-6">
        <div className="h-48 rounded-b-[2.5rem] md:rounded-[2.5rem] bg-accent/25 relative flex flex-col items-center justify-end pb-8">
          <div className="h-24 w-24 rounded-full bg-white/20 skeleton" />
          <div className="h-5 w-36 bg-white/20 rounded-full mt-3 skeleton" />
        </div>
        <div className="px-4 py-6 space-y-6 md:px-0 md:py-0">
          <div className="h-24 rounded-[22px] bg-surface skeleton" />
          <div className="space-y-3">
            <div className="h-4 w-20 bg-surface rounded skeleton" />
            <div className="h-48 rounded-[22px] bg-surface skeleton" />
          </div>
        </div>
      </div>
    </div>
  );
}
