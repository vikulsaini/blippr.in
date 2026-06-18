import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion as framerMotion } from 'framer-motion';
import { Bell, Fingerprint, Globe, Menu, Phone, Radar, ShieldCheck, Sparkles, UserPlus, Users, Video, X, Zap, MessageCircle, ArrowRight } from 'lucide-react';
import BrandLogo from '../components/BrandLogo.jsx';
import { getToken } from '../lib/api.js';

function useInView(ref, threshold = 0.15) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return inView;
}

function RevealSection({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref);
  return (
    <framerMotion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.25, 1, 0.5, 1] }}
      className={className}
    >
      {children}
    </framerMotion.div>
  );
}

/* ─── Premium Glowing Divider ─── */
function GlowDivider({ className = '' }) {
  return (
    <div className={`relative w-full h-[1px] bg-white/5 ${className}`}>
      <div className="absolute left-1/2 -translate-x-1/2 -top-[1.5px] w-24 h-[4px] bg-emerald-500 rounded-full blur-[2px] opacity-75 animate-pulse" />
    </div>
  );
}

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
            <framerMotion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="absolute right-0 top-0 h-full w-72 bg-[#090d16] border-l border-white/5 shadow-2xl p-6 flex flex-col gap-2"
            >
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
            </framerMotion.div>
          </div>
        )}

        {/* Hero Banner Content */}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pt-16 pb-12 sm:px-8 lg:px-10 flex flex-col justify-center flex-1">
          <div className="text-center space-y-6">
            <framerMotion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.55 }}
            >
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-4 py-2 text-xs font-bold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <Sparkles size={13} className="animate-pulse" />
                Random chats, real connections
              </p>
            </framerMotion.div>

            {/* HackerRank-style Main Headline */}
            <framerMotion.h1 
              initial={{ opacity: 0, y: 22 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.55, delay: 0.1 }}
              className="max-w-4xl text-center mx-auto text-5xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-6xl lg:text-7xl"
            >
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
            </framerMotion.h1>

            {/* HackerRank-style Subtitle */}
            <framerMotion.p 
              initial={{ opacity: 0, y: 22 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.55, delay: 0.2 }}
              className="mt-8 text-center mx-auto max-w-2xl text-base font-semibold leading-relaxed text-zinc-400 sm:text-lg"
            >
              We help you match with interesting people, secure your private conversations, and bridge the distance to form real connections in a digital world.
            </framerMotion.p>

            {/* Actions Row */}
            <framerMotion.div 
              initial={{ opacity: 0, y: 22 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.55, delay: 0.3 }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10"
            >
              <Link to={appLink} className="inline-flex items-center justify-center px-8 py-4 rounded-full border border-emerald-500/40 bg-black text-white hover:bg-zinc-900 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:border-emerald-400 active:scale-[0.98] transition-all duration-200 font-bold text-sm">
                Join The Community
              </Link>
              <a href="#features" className="inline-flex items-center justify-center px-8 py-4 rounded-full border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white active:scale-[0.98] transition-all duration-200 font-semibold text-sm">
                See Features
              </a>
            </framerMotion.div>
          </div>

          {/* Conductor Visual Image Panel */}
          <framerMotion.div
            initial={{ opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.4 }}
            className="relative mt-20 max-w-4xl mx-auto flex justify-center z-10 px-4"
          >
            <div className="absolute w-[85%] h-[300px] bg-emerald-500/5 rounded-full blur-[130px] bottom-0" />
            <img 
              src="/landing_conductor.png" 
              alt="Conductor creating digital connection paths" 
              className="w-full max-w-3xl object-contain rounded-[2.5rem] border border-white/5 shadow-2xl relative z-10" 
            />
          </framerMotion.div>
        </div>
      </section>

      {/* ─── Glowing divider instead of wave ─── */}
      <GlowDivider className="mt-8" />

      {/* ─── STATS STRIP ─── */}
      <RevealSection>
        <section className="bg-slate-950/20 py-12">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-8 px-5 sm:gap-16 sm:px-8 lg:px-10">
            <StatItem icon={Users} value="10K+" label="Active Users" />
            <StatItem icon={MessageCircle} value="500K+" label="Messages Sent" />
            <StatItem icon={Globe} value="50+" label="Countries" />
            <StatItem icon={Video} value="24/7" label="Live Rooms" />
          </div>
        </section>
      </RevealSection>

      {/* ─── Glowing divider ─── */}
      <GlowDivider />

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-20 sm:py-24 relative">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <RevealSection>
            <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-400">Built for Real Connection</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">Everything needed for a modern chat app.</h2>
              </div>
              <p className="text-zinc-400 font-medium lg:text-lg">
                The interface stays compact on phones, then opens up into a clean responsive layout for people reviewing the product on laptops and desktops.
              </p>
            </div>
          </RevealSection>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Radar, title: 'Random Live', text: 'Meet online strangers in temporary text and video rooms.', delay: 0 },
              { icon: UserPlus, title: 'Friend Flow', text: 'Send requests, accept from notifications, and move good random chats into friends.', delay: 0.08 },
              { icon: Phone, title: 'Voice Calls', text: 'Realtime calling with mute, speaker, ringing, and call history.', delay: 0.16 },
              { icon: Video, title: 'Video Calls', text: 'Camera controls, switch camera, and a focused full-screen call UI.', delay: 0.24 }
            ].map((feature) => (
              <RevealSection key={feature.title} delay={feature.delay}>
                <Feature icon={feature.icon} title={feature.title} text={feature.text} />
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Glowing divider ─── */}
      <GlowDivider />

      {/* ─── BRAND PILLARS ─── */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <RevealSection>
            <div className="text-center">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-400">Why Blippr</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">A safer, smarter way to connect.</h2>
            </div>
          </RevealSection>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { icon: <Fingerprint size={28} className="text-emerald-400" />, title: 'Identity Guardianship', text: 'Iron-clad Google login, email verification codes, and mobile OTP checkpoints ensure every conversation starts with a verified person.', delay: 0 },
              { icon: <Zap size={28} className="text-emerald-400" />, title: 'Affinity Routing Network', text: 'Matching based on intentional hobby and interest vectors rather than messy geographic drops. Connect with people who share your passions.', delay: 0.1 },
              { icon: <Globe size={28} className="text-emerald-400" />, title: 'Zero Install Friction', text: 'Instant web availability via blippr.in — no bloated iOS or Android store download mandates. Just open and start chatting.', delay: 0.2 }
            ].map((pillar) => (
              <RevealSection key={pillar.title} delay={pillar.delay}>
                <Pillar icon={pillar.icon} title={pillar.title} text={pillar.text} />
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Glowing divider ─── */}
      <GlowDivider />

      {/* ─── SAFETY ─── */}
      <section id="safety" className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-3 lg:px-10">
          <RevealSection className="lg:col-span-1">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-400">Safety First</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white">Control who can reach you.</h2>
            </div>
          </RevealSection>
          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
            {[
              { title: 'Block', text: 'Blocked users disappear from match, search, and chat lists.', delay: 0 },
              { title: 'Report', text: 'Report profiles from match or chat profile screens.', delay: 0.08 },
              { title: 'Private', text: 'Auth, IP, and account data stay server-side and protected.', delay: 0.16 }
            ].map((card) => (
              <RevealSection key={card.title} delay={card.delay}>
                <SafetyCard title={card.title} text={card.text} />
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Glowing divider ─── */}
      <GlowDivider />

      {/* ─── TESTIMONIALS ─── */}
      <section id="testimonials" className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <RevealSection>
            <div className="text-center mb-14">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-400">Real Stories</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">What Blipprs are saying.</h2>
            </div>
          </RevealSection>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'Chloe S.', role: 'Music Lover', quote: 'Met my current best friend here because we both had "indie rock" in our hobbies. Absolute game changer.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80' },
              { name: 'Devon K.', role: 'Gamer', quote: 'No store install download hassle! It loaded instantly in Safari and matched me with friendly co-op mates.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80' },
              { name: 'Meera P.', role: 'Cinephile', quote: 'The voice call feature works perfectly. Random chats actually turn into long-term friends. 10/10.', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&auto=format&fit=crop&q=80' }
            ].map((t, idx) => (
              <RevealSection key={t.name} delay={idx * 0.1}>
                <article className="bg-slate-950/30 border border-white/5 rounded-2xl p-6 flex flex-col justify-between h-full hover:border-emerald-500/30 transition duration-300">
                  <p className="text-sm font-semibold leading-6 text-zinc-300 italic">"{t.quote}"</p>
                  <div className="mt-6 flex items-center gap-3">
                    <img src={t.avatar} alt={t.name} className="h-10 w-10 rounded-full border border-white/10 object-cover shadow-lg" />
                    <div>
                      <p className="text-sm font-bold text-white">{t.name}</p>
                      <p className="text-xs font-semibold text-zinc-500">{t.role}</p>
                    </div>
                  </div>
                </article>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Glowing divider ─── */}
      <GlowDivider />

      {/* ─── INSTALL ─── */}
      <section id="install" className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-10">
          <RevealSection>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-400">Installable PWA</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">Share it now, package it later.</h2>
              <p className="mt-4 max-w-2xl font-semibold text-zinc-400">
                Blippr opens from the browser and installs on Android from Chrome with the PWA install prompt.
              </p>
            </div>
          </RevealSection>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
            <RevealSection delay={0}>
              <InstallStep label="1" title="Open Link" text="Share the hosted website with testers." />
            </RevealSection>
            <RevealSection delay={0.1}>
              <InstallStep label="2" title="Install App" text="Use the browser install prompt on mobile." />
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/5 bg-slate-950/40 py-12">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <BrandLogo compact className="text-white [&_.text-text-primary]:text-white [&_.text-text-muted]:text-zinc-500 [&_span.bg-surface]:bg-slate-900 [&_span.border-border-default]:border-white/10" />
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-zinc-400">
              <Link to="/privacy" className="hover:text-emerald-400 transition">Privacy</Link>
              <Link to="/terms" className="hover:text-emerald-400 transition">Terms</Link>
              <a href="#features" className="hover:text-emerald-400 transition">Features</a>
              <a href="#safety" className="hover:text-emerald-400 transition">Safety</a>
            </div>
          </div>
          <div className="mt-8 border-t border-white/5 pt-8 text-center">
            <p className="text-sm font-semibold text-zinc-500">© {new Date().getFullYear()} Blippr. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ─── Sub-components ─── */

function StatItem({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 shadow-lg">
        <Icon size={18} />
      </span>
      <div>
        <p className="text-xl font-extrabold text-white">{value}</p>
        <p className="text-xs font-semibold text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, text }) {
  return (
    <article className="bg-slate-950/30 border border-white/5 rounded-2xl p-6 h-full hover:border-emerald-500/30 transition duration-300 cursor-pointer">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 shadow-md">
        <Icon size={20} />
      </span>
      <h3 className="mt-5 font-extrabold text-white">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">{text}</p>
    </article>
  );
}

function Pillar({ icon, title, text }) {
  return (
    <article className="bg-slate-950/30 border border-white/5 rounded-3xl p-6 text-center h-full hover:border-emerald-500/30 transition duration-300 cursor-pointer">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 shadow-md">
        {icon}
      </span>
      <h3 className="mt-5 text-lg font-extrabold text-white">{title}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-zinc-400">{text}</p>
    </article>
  );
}

function SafetyCard({ title, text }) {
  return (
    <article className="bg-slate-950/30 border border-white/5 rounded-2xl p-5 h-full hover:border-emerald-500/30 transition duration-300">
      <ShieldCheck size={22} className="text-emerald-400" />
      <h3 className="mt-4 font-extrabold text-white">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">{text}</p>
    </article>
  );
}

function InstallStep({ label, title, text }) {
  return (
    <article className="bg-slate-950/30 border border-white/5 flex gap-4 rounded-2xl p-5 hover:border-emerald-500/30 transition duration-300">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-black text-sm font-extrabold shadow-md shadow-emerald-500/20">{label}</span>
      <div>
        <h3 className="font-extrabold text-white">{title}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-zinc-400">{text}</p>
      </div>
    </article>
  );
}
