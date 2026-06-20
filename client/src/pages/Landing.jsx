import { useState, lazy, Suspense } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Menu, X, Sparkles, Shuffle, Compass, Send, Smile, MoreVertical, ArrowRight, Zap } from 'lucide-react';
import { getToken } from '../lib/api.js';

const LandingDetails = lazy(() => import('./LandingDetails.jsx'));

export default function Landing() {
  const isGuest = localStorage.getItem('blippr_is_guest') === 'true';
  const appLink = getToken() ? (isGuest ? '/app/stranger' : '/app') : '/auth';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (getToken()) return <Navigate to={isGuest ? '/app/stranger' : '/app'} replace />;

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#191c1e] font-sans antialiased relative overflow-x-hidden selection:bg-accent/25 selection:text-white vibrant-gradient">
      {/* ─── Header Navigation ─── */}
      <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-black/5 flex items-center justify-between px-6 sm:px-8 lg:px-10 h-16">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tighter text-primary">Blippr</h1>
          </Link>
        </div>
        <div className="hidden items-center gap-8 text-sm font-semibold text-text-secondary md:flex">
          <a href="#features" className="transition hover:text-primary">Features</a>
          <a href="#safety" className="transition hover:text-primary">Safety</a>
          <a href="#testimonials" className="transition hover:text-primary">Testimonials</a>
          <a href="#install" className="transition hover:text-primary">Install</a>
          <Link to="/privacy" className="transition hover:text-primary">Privacy</Link>
          <Link to="/terms" className="transition hover:text-primary">Terms</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link to={appLink} className="border border-black/10 text-text-primary hover:bg-black/5 rounded-full px-5 py-2 text-sm font-semibold hidden md:inline-flex transition-all duration-200">
            {getToken() ? 'Open App' : 'Login'}
          </Link>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="h-10 w-10 rounded-full border border-black/10 bg-white/5 flex items-center justify-center text-[#191c1e] hover:bg-black/5 transition md:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* ─── Mobile Menu Drawer ─── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-fadeIn">
          <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" />
          <div className="absolute right-0 top-0 h-full w-72 bg-[#F8FAFC] border-l border-black/5 shadow-2xl p-6 flex flex-col gap-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black tracking-tighter text-primary">Blippr</h2>
              <button onClick={() => setMobileMenuOpen(false)} className="h-9 w-9 rounded-full border border-black/10 flex items-center justify-center text-[#4a4455] hover:bg-black/5">
                <X size={18} />
              </button>
            </div>
            {[
              { href: '#features', label: 'Features' },
              { href: '#safety', label: 'Safety' },
              { href: '#testimonials', label: 'Testimonials' },
              { href: '#install', label: 'Install' }
            ].map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-black/5 hover:text-primary transition-all">
                {item.label}
              </a>
            ))}
            <Link to="/privacy" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-black/5 hover:text-primary transition-all">Privacy</Link>
            <Link to="/terms" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-black/5 hover:text-primary transition-all">Terms</Link>
            <div className="mt-auto">
              <Link to={appLink} onClick={() => setMobileMenuOpen(false)} className="flex w-full items-center justify-center py-3.5 rounded-full bg-primary text-white font-bold text-sm shadow-[0_8px_20px_rgba(124,58,237,0.25)] transition-all hover:brightness-110 active:scale-95">
                {getToken() ? 'Open App' : 'Get Started'}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ─── Hero Content Area ─── */}
      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pt-28 pb-12 sm:px-8 lg:px-10 flex flex-col justify-center min-h-[calc(100vh-4rem)]">
        <section className="text-center mb-16 relative">
          <div className="flex justify-center mb-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-bold text-primary shadow-[0_0_15px_rgba(124,58,237,0.05)]">
              <Sparkles size={13} className="animate-pulse" />
              Random chats, real connections
            </span>
          </div>
          <h2 className="font-display-lg text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.1] mb-6 tracking-tighter text-[#191c1e]">
            Blipp faster than <br />
            <span className="text-primary italic">you think.</span>
          </h2>
          <p className="font-body-lg text-[#4a4455] max-w-xl mx-auto mb-10 text-base sm:text-lg">
            The electric social engine for real-time digital sparks. Connect instantly, chat fluidly, and find your vibe in a heartbeat.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <Link to={appLink} className="w-full sm:w-auto px-8 py-4 bg-primary text-white font-bold rounded-full shadow-[0_8px_20px_rgba(124,58,237,0.25)] hover:brightness-110 active:scale-95 transition-all text-center text-sm sm:text-base">
              Start Blipping
            </Link>
            <div className="flex gap-4 w-full sm:w-auto">
              <Link to="/app/stranger" className="flex-1 sm:flex-none px-5 py-4 glass-card rounded-full font-semibold text-sm hover:bg-black/5 transition-colors flex items-center justify-center gap-2 cursor-pointer text-[#4a4455]">
                <Shuffle size={16} />
                Stranger Match
              </Link>
              <Link to="/app/discover" className="flex-1 sm:flex-none px-5 py-4 glass-card rounded-full font-semibold text-sm hover:bg-black/5 transition-colors flex items-center justify-center gap-2 cursor-pointer text-[#4a4455]">
                <Compass size={16} />
                Explore
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Preview Bento Grid ─── */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-20">
          {/* Active Chat Preview */}
          <div className="md:col-span-7 glass-card rounded-3xl p-6 overflow-hidden min-h-[340px] flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <img className="w-10 h-10 rounded-full object-cover border-2 border-secondary/20" alt="Alex Spark avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMrkMRntzCr8pOwPP6B_JMn0b-XtiXy4TSH6uvnU6JY46REM_7PmFff_xTpbZUWkQpv6LHPSmYp5sBFZc4f_jkbBQ9KyUo2r8LcQ4-0iWKfHg04_hxeoFBY9y_DOpND-wqKlUl5wGvwxqyEO64wJLcqYiHvPyRWMrtFfvA7ZC6LiAgtKXLRP2s6u8oKCebmdSt29lmdXdkOiYDP91AEWqhEJPpbnL1uzFG75obZhm7nlzYeWpp83Zo_Ugl35RVPaYrlLjjPmnPZ64j" />
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-secondary rounded-full border-2 border-white shadow-[0_0_8px_rgba(0,104,122,0.3)]"></span>
                </div>
                <div>
                  <p className="font-semibold text-[#191c1e] leading-tight text-sm">Alex Spark</p>
                  <p className="text-secondary text-[11px] font-bold uppercase tracking-widest mt-0.5">Typing...</p>
                </div>
              </div>
              <MoreVertical size={18} className="text-[#4a4455]/60" />
            </div>

            <div className="flex-grow space-y-3 mb-6">
              <div className="flex flex-col items-start max-w-[80%]">
                <div className="bg-slate-200/60 text-[#191c1e] rounded-2xl rounded-bl-none px-4 py-3 text-sm">
                  Hey! Did you see the new stream? ⚡️
                </div>
                <span className="text-[9px] text-[#4a4455]/50 mt-1 ml-1">2:41 PM</span>
              </div>
              <div className="flex flex-col items-end max-w-[80%] ml-auto">
                <div className="bg-primary text-white rounded-2xl rounded-br-none px-4 py-3 text-sm shadow-md">
                  Just caught the highlight. Insane energy!
                </div>
                <span className="text-[9px] text-[#4a4455]/50 mt-1 mr-1">2:42 PM</span>
              </div>
            </div>

            <div className="relative">
              <div className="w-full h-12 bg-slate-100 rounded-full flex items-center px-4 border border-black/5">
                <span className="text-[#4a4455]/50 text-xs">Type a blipp...</span>
                <div className="ml-auto flex gap-2 text-primary/60">
                  <Smile size={18} className="cursor-pointer hover:opacity-85 transition-opacity" />
                  <Send size={18} className="cursor-pointer hover:opacity-85 transition-opacity" />
                </div>
              </div>
            </div>
          </div>

          {/* Discovery & Pulse Column */}
          <div className="md:col-span-5 flex flex-col gap-4">
            {/* Find crew card */}
            <div className="glass-card rounded-3xl p-6 flex-grow relative overflow-hidden group shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none transition-opacity group-hover:opacity-100 opacity-50" />
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                  <div className="bg-tertiary-container/10 text-tertiary px-3 py-1 rounded-full text-[10px] font-bold inline-block mb-4 uppercase tracking-wider">
                    DISCOVER
                  </div>
                  <h3 className="text-xl font-bold text-[#191c1e] mb-2">Find your crew.</h3>
                  <p className="text-[#4a4455] text-sm mb-4 font-medium">Join 2.4k others blipping right now in Tokyo.</p>
                </div>
                <div className="flex items-center -space-x-2 mt-4">
                  <img className="w-8 h-8 rounded-full border-2 border-white object-cover" alt="User" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBpC8FXPTBfW40FdF-aD3nEN8zvt21HiKhVejaC1Wcx0_KW-nnVRrSKVAZ41Pm16ZLT2B6CMT_pH2FEzphzRyKJSua07Go_cP3iupl-YAQTJB5PDCallocgqoeG5mzgwqkCXjhUkNikjid2_UlOm5EoHiopUixOyEsfxiHr1PjSkVjNHGFgmjogzgmr8XWqTd6rrtY5CONm0t3vdGFIjrZqbNRUBJ__aSQ1jepxuNc1PFyHTXSjtLSK1-GawPpaP8ll5Kl1J75yFY4_" />
                  <img className="w-8 h-8 rounded-full border-2 border-white object-cover" alt="User" src="https://lh3.googleusercontent.com/aida-public/AB6AXuADQ6b9YHIJBc7C45mvrIdsOXCNSpGBZqaV54ZLviGee1YQ-NgZnTpmqu796NtYd5njaJUro3eyYY_QKNe8v8eJbWZafEfHblKbYNE4Osv5JbWyVcVUTJuhkMHOtJ0Q3iUKZ494zMt_fmYrmo-AFQHo9h-P3VrvYH9e_FYdGdYdvEnWR224icUcXynMP3Vr1c5Y1EAwUCuy4-T2gaZJs-aQYy_-QWXAPMDePdlM4A-Rrvh6kDccwGcMHtu-9jufQoZE0QPa1d1LkMgQ" />
                  <img className="w-8 h-8 rounded-full border-2 border-white object-cover" alt="User" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDYWWqx-cZVaNt4l_n-O0Z5l6dfqAwxy7d6XMpT_oCouOIfO-2vdjgngyI4l82wkFcVi_oh1CfMT3H1fALvcuoLAwP5ghPZA8mom-4FeE5deU4SbR8f2JURUWBnnrgclmLCi09rlMSM8kcj07aLIu1IMHOzeR6zN0m87W3CRaqlX8pnhIFtEVi5I7azahsgmXXfrXsiMNpwZfDg-42B1W0NSA8z6BnjxpXcr2VstYeWeihqKMgtWs4gjeWZdYqakkbpR5GhBLYvW7Rb" />
                  <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-[#4a4455]">+2k</div>
                </div>
              </div>
            </div>

            {/* Pulse monitor card */}
            <div className="bg-secondary text-white rounded-3xl p-6 h-40 flex flex-col justify-between group overflow-hidden relative shadow-md">
              <div className="absolute -right-4 -bottom-4 opacity-20 group-hover:scale-110 transition-transform duration-300">
                <Zap size={120} className="text-white fill-white" />
              </div>
              <h3 className="font-bold text-xl relative z-10 leading-tight">
                Real-time pulses. <br />Zero delay.
              </h3>
              <div className="flex items-center gap-2 relative z-10">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                <span className="text-white/80 text-xs font-bold uppercase tracking-wider">System: Hyper-active</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Fluid Conversations Section ─── */}
        <section className="mb-20">
          <div className="relative w-full rounded-[40px] overflow-hidden bg-slate-100/50 border border-black/5 p-8 sm:p-12 text-center shadow-inner">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/10 blur-[80px] rounded-full" />
            <h3 className="text-2xl font-bold text-[#191c1e] mb-4">Fluid Conversations</h3>
            <p className="font-body-md text-[#4a4455] max-w-md mx-auto text-sm sm:text-base leading-relaxed font-medium">
              Our engine predicts your next move to ensure the conversation never misses a beat. Experience the speed of thought.
            </p>
            <button className="mt-8 text-primary font-bold flex items-center justify-center gap-2 mx-auto hover:underline active:scale-95 transition-transform">
              Learn about Blipp-Sync
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </div>

      <Suspense fallback={
        <div className="py-24 text-center text-[#4a4455]/70 animate-pulse font-semibold text-sm">
          Loading connection details...
        </div>
      }>
        <LandingDetails />
      </Suspense>
    </main>
  );
}
