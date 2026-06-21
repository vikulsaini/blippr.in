import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, MapPin, Shield, UserRound, LogOut, Settings, Copy, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { showToast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';

export default function Profile() {
  const navigate = useNavigate();
  const { me } = useOutletContext() || {};
  const [user, setUser] = useState(me);
  const [showPromo, setShowPromo] = useState(true);

  useEffect(() => {
    if (me) setUser(me);
  }, [me]);

  async function handleLogout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout warning:', err.message);
    }
    localStorage.removeItem('blippr_token');
    localStorage.removeItem('blippr_is_guest');
    navigate('/', { replace: true });
    window.location.reload();
  }

  if (!user) return <ProfileSkeleton />;

  return (
    <div className="chat-dark-theme mx-auto w-full max-w-lg md:max-w-4xl min-h-[calc(100vh-6rem)] overflow-y-auto bg-bg text-text-primary px-4 pb-24 md:pb-6 scrollbar-none">
      
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between w-full py-4 mb-4">
        <button 
          onClick={() => navigate('/app')} 
          className="text-primary hover:opacity-80 p-2 -ml-2 rounded-full transition active:scale-95"
          aria-label="Back to chats"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="font-heading font-black text-xl text-primary tracking-tighter">My Space</h1>
        <button 
          onClick={() => navigate('/app/settings')} 
          className="text-primary hover:opacity-80 p-2 -mr-2 rounded-full transition active:scale-95"
          aria-label="Open settings"
        >
          <Settings size={22} className="animate-spin-hover" />
        </button>
      </header>

      {/* Responsive Grid layout for larger viewports */}
      <div className="md:grid md:grid-cols-[1.1fr_1.3fr] md:gap-6 md:items-start">
        
        {/* Left Column on Desktop */}
        <div className="space-y-4 md:space-y-6">
          
          {/* Profile Header Card */}
          <section className="glass-panel rounded-3xl p-6 flex flex-col items-center shadow-card relative overflow-hidden">
            {/* Ambient inner glow */}
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
            
            <div className="relative mb-4">
              {/* Gradient avatar ring */}
              <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-primary via-success to-amber-500 shadow-lg">
                <div className="w-full h-full rounded-full border-4 border-surface bg-[#0b1326] overflow-hidden flex items-center justify-center">
                  {user?.avatar ? (
                     <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={48} className="text-text-muted/40" />
                  )}
                </div>
              </div>
              {/* Online Status Glow Indicator */}
              <div className="absolute bottom-2 right-2 w-6 h-6 bg-success rounded-full border-4 border-surface shadow-[0_0_12px_var(--success)]" />
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-black text-text-primary leading-tight tracking-tight">{user?.isGuest ? 'Guest User' : user?.name}</h2>
              <p className="text-sm text-text-muted mt-1">
                {user?.isGuest ? 'Guest Account' : `@${user?.username || 'user'}`}
              </p>
            </div>

            {/* User Stats Bento Grid */}
            <div className="grid grid-cols-3 gap-3.5 w-full mt-6">
              <div className="glass-card rounded-2xl p-3 text-center transition-all hover:border-accent/20">
                <span className="block text-lg font-black text-accent">1.2k</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Blipps</span>
              </div>
              <div className="glass-card rounded-2xl p-3 text-center transition-all hover:border-success/20">
                <span className="block text-lg font-black text-success">482</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Matches</span>
              </div>
              <div className="glass-card rounded-2xl p-3 text-center transition-all hover:border-amber-500/20">
                <span className="block text-lg font-black text-amber-500">8.5k</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Friends</span>
              </div>
            </div>

            {/* Profile Share Link */}
            {!user?.isGuest && user?.username && (
              <button
                type="button"
                onClick={async () => {
                  const value = `${window.location.origin}/u/${user.username}`;
                  await navigator.clipboard?.writeText(value);
                  showToast('Profile link copied!', 'success');
                }}
                className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary px-4 py-3 text-xs font-bold transition active:scale-95"
              >
                <Copy size={14} />
                <span>Copy Shareable Link</span>
              </button>
            )}
          </section>

          {/* Premium Promo Card */}
          {showPromo && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel border border-white/10 rounded-3xl p-5 shadow-card relative overflow-hidden hidden md:block"
            >
              {/* Decorative radial gradient */}
              <div className="absolute -right-20 -bottom-20 w-44 h-44 bg-gradient-to-tr from-primary/20 to-transparent blur-2xl rounded-full" />
              <div className="flex gap-3 relative z-10">
                <span className="text-2xl shrink-0">👑</span>
                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="text-sm font-extrabold text-text-primary leading-none">
                    Join Blippr {user?.isGuest ? 'Premium' : 'VIP'}
                  </h3>
                  <p className="text-xs leading-relaxed text-text-secondary font-medium mt-2">
                    {user?.isGuest 
                      ? 'Register to set a custom username, send friend requests, and unlock nearby matchmaking.' 
                      : 'Subscribe to unlock read receipts, private chat vault, and support independent creators.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-5 relative z-10">
                <button
                  onClick={() => {
                    if (user?.isGuest) {
                      window.dispatchEvent(new CustomEvent('blippr:guest-expired'));
                    } else {
                      showToast('VIP subscriptions coming soon!', 'info');
                    }
                  }}
                  className="flex-1 py-3 bg-accent hover:brightness-110 text-white text-xs font-bold rounded-2xl transition shadow-glow active:scale-95"
                >
                  {user?.isGuest ? 'REGISTER' : 'SUBSCRIBE'}
                </button>
                <button
                  onClick={() => setShowPromo(false)}
                  className="flex-1 py-3 bg-white hover:bg-zinc-50 text-text-primary text-xs font-bold rounded-2xl border border-border transition active:scale-95 shadow-sm"
                >
                  RESTORE
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column on Desktop / Content on Mobile */}
        <div className="mt-4 md:mt-0 space-y-6">
          
          {/* Mobile Promo Card */}
          {showPromo && (
            <div className="glass-panel rounded-3xl p-5 shadow-card relative overflow-hidden md:hidden">
              <div className="absolute -right-20 -bottom-20 w-44 h-44 bg-gradient-to-tr from-primary/20 to-transparent blur-2xl rounded-full" />
              <div className="flex gap-3 relative z-10">
                <span className="text-2xl shrink-0">👑</span>
                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="text-sm font-extrabold text-text-primary leading-none">
                    Join Blippr {user?.isGuest ? 'Premium' : 'VIP'}
                  </h3>
                  <p className="text-xs leading-relaxed text-text-secondary font-medium mt-2">
                    {user?.isGuest 
                      ? 'Register to set a custom username, send friend requests, and unlock nearby matchmaking.' 
                      : 'Subscribe to unlock read receipts, private chat vault, and support independent creators.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-5 relative z-10">
                <button
                  onClick={() => {
                    if (user?.isGuest) {
                      window.dispatchEvent(new CustomEvent('blippr:guest-expired'));
                    } else {
                      showToast('VIP subscriptions coming soon!', 'info');
                    }
                  }}
                  className="flex-1 py-3 bg-accent hover:brightness-110 text-white text-xs font-bold rounded-2xl transition shadow-glow active:scale-95"
                >
                  {user?.isGuest ? 'REGISTER' : 'SUBSCRIBE'}
                </button>
                <button
                  onClick={() => setShowPromo(false)}
                  className="flex-1 py-3 bg-white hover:bg-zinc-50 text-text-primary text-xs font-bold rounded-2xl border border-border transition active:scale-95 shadow-sm"
                >
                  RESTORE
                </button>
              </div>
            </div>
          )}

          {/* Bio & Tags Container */}
          <section className="glass-panel rounded-3xl p-5 shadow-card">
            <h3 className="text-[10px] font-black text-accent uppercase tracking-widest mb-3">Bio</h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-4 italic">
              {user?.bio ? `"${user.bio}"` : '"Building the future of social real-time interactions. Let\'s Blipp! ⚡️"'}
            </p>
            <div className="flex flex-wrap gap-2">
              {user?.interests?.length ? (
                user.interests.map((tag, i) => (
                  <span 
                    key={i} 
                    className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-semibold"
                  >
                    {tag.trim()}
                  </span>
                ))
              ) : (
                <>
                  <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-semibold">Gaming</span>
                  <span className="px-3 py-1 bg-success/10 text-success border border-success/20 rounded-full text-xs font-semibold">Tech</span>
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-xs font-semibold">Music</span>
                </>
              )}
            </div>
          </section>

          {/* Content Settings List */}
          <div>
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2.5 ml-1">Content Settings</h3>
            
            <div className="glass-panel rounded-3xl overflow-hidden shadow-card divide-y divide-white/5">
              <SettingsRow 
                icon={UserRound} 
                iconBg="bg-primary/10 text-primary"
                title="Connected Profile" 
                subtitle={`${user?.age ? `${user.age} y/o` : ''} · ${user?.gender || 'No gender set'}`}
                onClick={() => navigate('/app/profile/edit')} 
              />
              <SettingsRow 
                icon={Heart} 
                iconBg="bg-success/10 text-success"
                title="My Hobbies & Interests" 
                subtitle={user?.interests?.length ? user.interests.join(', ') : 'Add interests for matches'}
                onClick={() => navigate('/app/profile/interests')} 
              />
              <SettingsRow 
                icon={Shield} 
                iconBg="bg-amber-500/10 text-amber-500"
                title="Privacy & Security" 
                subtitle="Control last seen and receipts"
                onClick={() => navigate('/app/profile/privacy')} 
              />
              <SettingsRow 
                icon={MapPin} 
                iconBg="bg-primary/10 text-primary"
                title="Matchmaking Location" 
                subtitle={user?.location?.updatedAt ? 'Location shared' : 'Add location for nearby matches'}
                onClick={() => navigate('/app/profile/location')} 
              />
            </div>
          </div>

          {/* System Settings List */}
          <div>
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2.5 ml-1">System</h3>
            <div className="glass-panel rounded-3xl overflow-hidden shadow-card divide-y divide-white/5">
              <SettingsRow 
                icon={ExternalLink} 
                iconBg="bg-accent/15 text-accent"
                title="Terms of Service" 
                subtitle="Read our terms and user guidelines"
                onClick={() => navigate('/terms')} 
              />
              <SettingsRow 
                icon={Shield} 
                iconBg="bg-accent/15 text-accent"
                title="Privacy Policy" 
                subtitle="Learn how we protect your personal data"
                onClick={() => navigate('/privacy')} 
              />
            </div>

            {/* Logout Action */}
            <button 
              onClick={handleLogout} 
              className="w-full mt-5 p-4 rounded-3xl border border-danger/20 bg-danger/5 hover:bg-danger/10 text-danger font-black text-xs tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <LogOut size={16} />
              LOGOUT SESSION
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function SettingsRow({ icon: Icon, iconBg, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={18} />
        </div>
        <div className="text-left min-w-0">
          <span className="block text-sm font-semibold text-text-primary truncate">{title}</span>
          {subtitle && <span className="block text-xs text-text-muted mt-0.5 truncate">{subtitle}</span>}
        </div>
      </div>
      <ChevronRight size={18} className="text-text-muted/50 shrink-0" />
    </button>
  );
}

function ProfileSkeleton() {
  return (
    <div className="w-full max-w-lg md:max-w-4xl mx-auto bg-bg animate-pulse px-4 pt-20">
      <div className="md:grid md:grid-cols-[1.1fr_1.3fr] md:gap-6">
        <div className="h-64 rounded-3xl bg-surface-glass border border-white/10 relative flex flex-col items-center justify-center pb-8 p-6">
          <div className="h-28 w-28 rounded-full bg-white/10 skeleton" />
          <div className="h-5 w-36 bg-white/10 rounded-full mt-4 skeleton" />
        </div>
        <div className="space-y-6 mt-4 md:mt-0">
          <div className="h-32 rounded-3xl bg-surface-glass border border-white/10 skeleton" />
          <div className="h-48 rounded-3xl bg-surface-glass border border-white/10 skeleton" />
        </div>
      </div>
    </div>
  );
}
