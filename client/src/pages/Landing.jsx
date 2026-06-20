import { useState, lazy, Suspense } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Menu, X, Sparkles, Fingerprint } from 'lucide-react';
import BrandLogo from '../components/BrandLogo.jsx';
import { getToken } from '../lib/api.js';

const LandingDetails = lazy(() => import('./LandingDetails.jsx'));

export default function Landing() {
  const isGuest = localStorage.getItem('blippr_is_guest') === 'true';
  const appLink = getToken() ? (isGuest ? '/app/stranger' : '/app') : '/auth';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  if (getToken()) return <Navigate to={isGuest ? '/app/stranger' : '/app'} replace />;

  return (
    <main className="min-h-screen overflow-hidden bg-[#030712] text-white font-sans antialiased selection:bg-emerald-500/25 selection:text-white">
      
      {/* ─── HERO SECTION WITH VIDEO BACKGROUND ─── */}
      <section className="relative min-h-screen flex flex-col justify-between">
        
        {/* Animated Video Loop Background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="w-full h-full object-cover opacity-20 filter grayscale brightness-50 z-0"
          >
            <source src="https://assets.mixkit.co/videos/preview/mixkit-glowing-digital-network-connections-background-34325-large.mp4" type="video/mp4" />
          </video>
          {/* Gradients to blend video smoothly */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/95 via-[#030712]/80 to-[#030712]" />
          {/* Top Ambient Teal Glow Orb */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[550px] bg-gradient-to-b from-emerald-500/10 to-transparent rounded-full blur-[140px] pointer-events-none z-0" />
        </div>

        {/* Navbar Header */}
        <nav className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10 border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
          <Link to="/" className="flex items-center gap-3">
            <BrandLogo className="text-white [&_.text-text-primary]:text-white [&_.text-text-muted]:text-zinc-500 [&_span.bg-surface]:bg-[#111827]/85 [&_span.border-border-default]:border-white/10" />
          </Link>
          <div className="hidden items-center gap-8 text-sm font-semibold text-zinc-400 md:flex">
            <a href="#features" className="transition hover:text-emerald-400">Features</a>
            <a href="#safety" className="transition hover:text-emerald-400">Safety</a>
            <a href="#testimonials" className="transition hover:text-emerald-400">Testimonials</a>
            <a href="#install" className="transition hover:text-emerald-400">Install</a>
            <Link to="/privacy" className="transition hover:text-emerald-400">Privacy</Link>
            <Link to="/terms" className="transition hover:text-emerald-400">Terms</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to={appLink} className="border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 rounded-full px-5 py-2.5 text-sm font-semibold hidden md:inline-flex transition">
              {getToken() ? 'Open App' : 'Login'}
            </Link>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="h-10 w-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition md:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </nav>

        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden animate-fadeIn">
            <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" />
            <div className="absolute right-0 top-0 h-full w-72 bg-[#090d16] border-l border-white/5 shadow-2xl p-6 flex flex-col gap-2 animate-slide-left">
              <div className="flex justify-between items-center mb-6">
                <BrandLogo compact className="text-white [&_span.bg-surface]:bg-slate-900 [&_span.border-border-default]:border-white/10" />
                <button onClick={() => setMobileMenuOpen(false)} className="h-9 w-9 rounded-full border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5" aria-label="Close menu">
                  <X size={18} />
                </button>
              </div>
              {[
                { href: '#features', label: 'Features' },
                { href: '#safety', label: 'Safety' },
                { href: '#testimonials', label: 'Testimonials' },
                { href: '#install', label: 'Install' }
              ].map((item) => (
                <a key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-zinc-400 hover:bg-white/5 hover:text-emerald-400 transition">
                  {item.label}
                </a>
              ))}
              <Link to="/privacy" className="rounded-xl px-4 py-3 text-sm font-semibold text-zinc-400 hover:bg-white/5 hover:text-emerald-400 transition">Privacy</Link>
              <Link to="/terms" className="rounded-xl px-4 py-3 text-sm font-semibold text-zinc-400 hover:bg-white/5 hover:text-emerald-400 transition">Terms</Link>
              <div className="mt-auto">
                <Link to={appLink} onClick={() => setMobileMenuOpen(false)} className="flex w-full items-center justify-center py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-sm shadow-lg shadow-emerald-500/20">
                  {getToken() ? 'Open App' : 'Get Started'}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Hero Banner Content */}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pt-16 pb-12 sm:px-8 lg:px-10 flex flex-col justify-center flex-1">
          <div className="text-center space-y-6">
            <div className="animate-fade-in-up">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-4 py-2 text-xs font-bold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <Sparkles size={13} className="animate-pulse" />
                Random chats, real connections
              </p>
            </div>

            {/* HackerRank-style Main Headline */}
            <h1 className="animate-fade-in-up delay-100 max-w-4xl text-center mx-auto text-5xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-6xl lg:text-7xl">
              The future of connection <br />
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 text-3xl sm:text-5xl lg:text-6xl font-extrabold">
                <span className="text-zinc-400 font-bold">Is</span>
                
                {/* Fingerprint Badge */}
                <span className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.25)] select-none">
                  <Fingerprint size={24} className="sm:w-[28px] sm:h-[28px]" />
                </span>
                
                {/* Cursive Handwriting Text */}
                <span className="text-white text-5xl sm:text-7xl lg:text-8xl font-normal tracking-wide mx-2" style={{ fontFamily: "'Caveat', cursive" }}>
                  human
                </span>
                
                <span className="text-zinc-500 font-light">+</span>
                
                {/* Sparkle Badge */}
                <span className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400 shadow-[0_0_18px_rgba(20,184,166,0.25)] select-none">
                  <Sparkles size={24} className="sm:w-[28px] sm:h-[28px] animate-pulse" />
                </span>
                
                {/* Anonymous Text */}
                <span className="text-white tracking-wide">anonymous</span>
              </div>
            </h1>

            {/* HackerRank-style Subtitle */}
            <p className="animate-fade-in-up delay-200 mt-8 text-center mx-auto max-w-2xl text-base font-semibold leading-relaxed text-zinc-400 sm:text-lg">
              We help you match with interesting people, secure your private conversations, and bridge the distance to form real connections in a digital world.
            </p>

            {/* Actions Row */}
            <div className="animate-fade-in-up delay-300 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
              <Link to={appLink} className="inline-flex items-center justify-center px-8 py-4 rounded-full border border-emerald-500/40 bg-black text-white hover:bg-zinc-900 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:border-emerald-400 active:scale-[0.98] transition-all duration-200 font-bold text-sm">
                Join The Community
              </Link>
              <a href="#features" className="inline-flex items-center justify-center px-8 py-4 rounded-full border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white active:scale-[0.98] transition-all duration-200 font-semibold text-sm">
                See Features
              </a>
            </div>
          </div>

          {/* Conductor Visual Image Panel */}
          <div className="animate-fade-in-up delay-400 relative mt-20 max-w-4xl mx-auto flex justify-center z-10 px-4">
            <div className="absolute w-[85%] h-[300px] bg-emerald-500/5 rounded-full blur-[130px] bottom-0" />
            <img 
              src="/landing_conductor.png" 
              alt="Conductor creating digital connection paths" 
              className="w-full max-w-3xl object-contain rounded-[2.5rem] border border-white/5 shadow-2xl relative z-10" 
            />
          </div>
        </div>
      </section>

      <Suspense fallback={
        <div className="py-24 text-center text-zinc-600 animate-pulse font-semibold text-sm">
          Loading connection details...
        </div>
      }>
        <LandingDetails />
      </Suspense>
    </main>
  );
}
