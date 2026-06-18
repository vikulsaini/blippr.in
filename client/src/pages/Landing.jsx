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

/* ─── Animated SVG Wave Divider ─── */
function WaveDivider({ flip = false, className = '' }) {
  return (
    <div className={`wave-divider ${flip ? 'wave-divider-flip' : ''} ${className}`}>
      <svg viewBox="0 0 1440 64" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d={flip
          ? "M0,32 C240,0 480,64 720,32 C960,0 1200,48 1440,24 L1440,64 L0,64 Z"
          : "M0,24 C240,48 480,0 720,32 C960,64 1200,16 1440,40 L1440,0 L0,0 Z"
        } />
      </svg>
    </div>
  );
}

/* ─── Animated floating orbs background ─── */
function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <framerMotion.div
        className="absolute left-[10%] top-[15%] h-72 w-72 rounded-full opacity-[0.04]"
        style={{ background: 'radial-gradient(circle, var(--accent), transparent 70%)' }}
        animate={{ x: [0, 30, -10, 0], y: [0, -20, 15, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut' }}
      />
      <framerMotion.div
        className="absolute right-[5%] top-[40%] h-96 w-96 rounded-full opacity-[0.03]"
        style={{ background: 'radial-gradient(circle, #8B5CF6, transparent 70%)' }}
        animate={{ x: [0, -25, 15, 0], y: [0, 20, -10, 0], scale: [1, 0.9, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 15, ease: 'easeInOut' }}
      />
      <framerMotion.div
        className="absolute left-[40%] bottom-[10%] h-64 w-64 rounded-full opacity-[0.03]"
        style={{ background: 'radial-gradient(circle, #EC4899, transparent 70%)' }}
        animate={{ x: [0, 20, -15, 0], y: [0, -15, 20, 0] }}
        transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut' }}
      />
    </div>
  );
}

export default function Landing() {
  const isGuest = localStorage.getItem('blippr_is_guest') === 'true';
  const appLink = getToken() ? (isGuest ? '/app/stranger' : '/app') : '/auth';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  if (getToken()) return <Navigate to={isGuest ? '/app/stranger' : '/app'} replace />;

  return (
    <main className="min-h-screen overflow-hidden bg-bg text-text-primary">
      {/* ─── HERO ─── */}
      <section className="relative min-h-screen">
        <FloatingOrbs />

        {/* Nav */}
        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <Link to="/" className="flex items-center gap-3">
            <BrandLogo />
          </Link>
          <div className="hidden items-center gap-8 text-sm font-semibold text-text-secondary md:flex">
            <a href="#features" className="transition hover:text-accent">Features</a>
            <a href="#safety" className="transition hover:text-accent">Safety</a>
            <a href="#testimonials" className="transition hover:text-accent">Testimonials</a>
            <a href="#install" className="transition hover:text-accent">Install</a>
            <Link to="/privacy" className="transition hover:text-accent">Privacy</Link>
            <Link to="/terms" className="transition hover:text-accent">Terms</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to={appLink} className="btn-secondary rounded-xl px-5 py-2.5 text-sm font-semibold hidden md:inline-flex hover:shadow-card-hover transition">
              {getToken() ? 'Open App' : 'Login'}
            </Link>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="btn-icon h-10 w-10 rounded-xl md:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" />
            <framerMotion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="absolute right-0 top-0 h-full w-72 bg-surface border-l border-border-default shadow-elevated p-6 flex flex-col gap-2"
            >
              <div className="flex justify-between items-center mb-6">
                <BrandLogo compact />
                <button onClick={() => setMobileMenuOpen(false)} className="btn-icon h-9 w-9" aria-label="Close menu">
                  <X size={18} />
                </button>
              </div>
              {[
                { href: '#features', label: 'Features' },
                { href: '#safety', label: 'Safety' },
                { href: '#testimonials', label: 'Testimonials' },
                { href: '#install', label: 'Install' }
              ].map((item) => (
                <a key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-surface-hover hover:text-accent transition">
                  {item.label}
                </a>
              ))}
              <Link to="/privacy" className="rounded-xl px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-surface-hover hover:text-accent transition">Privacy</Link>
              <Link to="/terms" className="rounded-xl px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-surface-hover hover:text-accent transition">Terms</Link>
              <div className="mt-auto">
                <Link to={appLink} onClick={() => setMobileMenuOpen(false)} className="btn-primary flex w-full items-center justify-center py-3 rounded-xl text-sm font-bold">
                  {getToken() ? 'Open App' : 'Get Started'}
                </Link>
              </div>
            </framerMotion.div>
          </div>
        )}

        {/* Hero Content */}
        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-7xl content-center px-5 pb-12 pt-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-12 lg:px-10">
          <framerMotion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border-default bg-surface px-4 py-2 text-sm font-semibold text-text-secondary shadow-card">
              <Sparkles size={15} className="text-accent" />
              Random chats, real friendships
            </p>
            <h1 className="max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight text-text-primary sm:text-6xl lg:text-7xl">
              Random Connections.<br />
              <span className="gradient-text">Authentic Friendships.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-text-secondary sm:text-lg">
              Meet new people through live random chat, send friend requests when the conversation clicks, and keep the good ones forever — all from your browser.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link to={appLink} className="btn-primary px-8 py-3.5 rounded-xl text-center text-base font-bold active:scale-[0.98] transition flex items-center justify-center gap-2">
                Start Random Chat
                <ArrowRight size={18} />
              </Link>
              <a href="#features" className="btn-secondary rounded-xl px-8 py-3.5 text-center text-base font-semibold transition">
                See Features
              </a>
            </div>
          </framerMotion.div>

          {/* App Preview Widget */}
          <framerMotion.div
            initial={{ opacity: 0, y: 24, rotate: -1 }}
            animate={{ opacity: 1, y: 0, rotate: -1 }}
            transition={{ duration: 0.65, delay: 0.12 }}
            className="mt-12 hidden lg:block"
          >
            <ChatPreviewWidget />
          </framerMotion.div>
        </div>
      </section>

      {/* ─── Wave Divider ─── */}
      <WaveDivider />

      {/* ─── STATS STRIP ─── */}
      <RevealSection>
        <section className="border-y border-border-default bg-surface py-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-8 px-5 sm:gap-16 sm:px-8 lg:px-10">
            <StatItem icon={Users} value="10K+" label="Active Users" />
            <StatItem icon={MessageCircle} value="500K+" label="Messages Sent" />
            <StatItem icon={Globe} value="50+" label="Countries" />
            <StatItem icon={Video} value="24/7" label="Live Rooms" />
          </div>
        </section>
      </RevealSection>

      {/* ─── FEATURES ─── */}
      <section id="features" className="bg-surface py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <RevealSection>
            <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Built for Real Use</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Everything needed for a modern chat app.</h2>
              </div>
              <p className="text-text-secondary font-medium lg:text-lg">
                The interface stays compact on phones, then opens up into a clean responsive layout for people reviewing the product on laptops and desktops.
              </p>
            </div>
          </RevealSection>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* ─── Wave Divider ─── */}
      <WaveDivider flip />

      {/* ─── BRAND PILLARS ─── */}
      <section className="bg-bg py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <RevealSection>
            <div className="text-center">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Why Blippr</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-text-primary">A safer, smarter way to connect.</h2>
            </div>
          </RevealSection>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icon: <Fingerprint size={28} className="text-accent" />, title: 'Identity Guardianship', text: 'Iron-clad Google login, email verification codes, and mobile OTP checkpoints ensure every conversation starts with a verified person.', delay: 0 },
              { icon: <Zap size={28} className="text-accent" />, title: 'Affinity Routing Network', text: 'Matching based on intentional hobby and interest vectors rather than messy geographic drops. Connect with people who share your passions.', delay: 0.1 },
              { icon: <Globe size={28} className="text-accent" />, title: 'Zero Install Friction', text: 'Instant web availability via blippr.in — no bloated iOS or Android store download mandates. Just open and start chatting.', delay: 0.2 }
            ].map((pillar) => (
              <RevealSection key={pillar.title} delay={pillar.delay}>
                <Pillar icon={pillar.icon} title={pillar.title} text={pillar.text} />
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Wave Divider ─── */}
      <WaveDivider />

      {/* ─── SAFETY ─── */}
      <section id="safety" className="bg-surface py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-3 lg:px-10">
          <RevealSection className="lg:col-span-1">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Safety First</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Control who can reach you.</h2>
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

      {/* ─── TESTIMONIALS ─── */}
      <section id="testimonials" className="border-t border-border-default bg-bg py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <RevealSection>
            <div className="text-center mb-12">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Real Stories</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-text-primary">What Blipprs are saying.</h2>
            </div>
          </RevealSection>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'Chloe S.', role: 'Music Lover', quote: 'Met my current best friend here because we both had "indie rock" in our hobbies. Absolute game changer.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80' },
              { name: 'Devon K.', role: 'Gamer', quote: 'No store install download hassle! It loaded instantly in Safari and matched me with friendly co-op mates.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80' },
              { name: 'Meera P.', role: 'Cinephile', quote: 'The voice call feature works perfectly. Random chats actually turn into long-term friends. 10/10.', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&auto=format&fit=crop&q=80' }
            ].map((t, idx) => (
              <RevealSection key={t.name} delay={idx * 0.1}>
                <article className="gradient-border-card bg-surface p-6 flex flex-col justify-between h-full rounded-2xl">
                  <p className="text-sm font-semibold leading-6 text-text-secondary italic">"{t.quote}"</p>
                  <div className="mt-6 flex items-center gap-3">
                    <img src={t.avatar} alt={t.name} className="h-10 w-10 rounded-full border border-border-default object-cover shadow-card" />
                    <div>
                      <p className="text-sm font-bold text-text-primary">{t.name}</p>
                      <p className="text-xs font-semibold text-text-muted">{t.role}</p>
                    </div>
                  </div>
                </article>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── INSTALL ─── */}
      <section id="install" className="border-t border-border-default bg-surface py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:px-10">
          <RevealSection>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Installable PWA</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Share it now, package it later.</h2>
              <p className="mt-4 max-w-2xl font-semibold text-text-secondary">
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
      <footer className="border-t border-border-default bg-surface py-10">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <BrandLogo compact />
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-text-secondary">
              <Link to="/privacy" className="hover:text-accent transition">Privacy</Link>
              <Link to="/terms" className="hover:text-accent transition">Terms</Link>
              <a href="#features" className="hover:text-accent transition">Features</a>
              <a href="#safety" className="hover:text-accent transition">Safety</a>
            </div>
          </div>
          <div className="mt-6 border-t border-border-default pt-6 text-center">
            <p className="text-sm font-semibold text-text-muted">© {new Date().getFullYear()} Blippr. All rights reserved.</p>
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
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-light text-accent shadow-card">
        <Icon size={18} />
      </span>
      <div>
        <p className="text-xl font-extrabold text-text-primary">{value}</p>
        <p className="text-xs font-semibold text-text-muted">{label}</p>
      </div>
    </div>
  );
}

function ChatPreviewWidget() {
  return (
    <div className="elevated-card overflow-hidden rounded-3xl p-1.5 bg-surface">
      <div className="rounded-[20px] bg-bg p-4 border border-border-default">
        {/* Mock header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-text-muted">Active now</p>
            <p className="text-lg font-extrabold text-text-primary">3 conversations</p>
          </div>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-white shadow-accent-sm">Live</span>
        </div>
        {/* Mock chat rows */}
        <div className="space-y-2">
          {[
            { name: 'Anaya', msg: 'Hey! That music rec was amazing', time: '2m', unread: 2, online: true },
            { name: 'Vikram', msg: 'Want to hop on a call later?', time: '15m', unread: 0, online: true },
            { name: 'Kiara', msg: 'Thanks for the friend request!', time: '1h', unread: 1, online: false }
          ].map((chat, index) => (
            <framerMotion.div
              key={chat.name}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.12, duration: 0.35 }}
              className="flex items-center gap-3 rounded-2xl border border-border-default bg-surface p-3 shadow-card hover:shadow-card-hover hover:border-accent transition-all duration-250 cursor-pointer"
            >
              <div className="relative">
                <div className="grid h-10 w-10 place-items-center rounded-full border border-border-default bg-accent-light text-sm font-extrabold text-accent">
                  {chat.name[0]}
                </div>
                {chat.online && <span className="status-dot online absolute -bottom-0.5 -right-0.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-bold text-text-primary">{chat.name}</p>
                  <span className="text-[11px] font-semibold text-text-faint">{chat.time}</span>
                </div>
                <p className="truncate text-xs font-semibold text-text-muted">{chat.msg}</p>
              </div>
              {chat.unread > 0 && (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-white shadow-accent-sm">{chat.unread}</span>
              )}
            </framerMotion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, text }) {
  return (
    <article className="gradient-border-card bg-surface rounded-2xl p-5 h-full cursor-pointer">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-light text-accent shadow-card">
        <Icon size={20} />
      </span>
      <h3 className="mt-5 font-extrabold text-text-primary">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-text-muted">{text}</p>
    </article>
  );
}

function Pillar({ icon, title, text }) {
  return (
    <article className="gradient-border-card bg-surface rounded-3xl p-6 text-center h-full cursor-pointer">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-light shadow-card">
        {icon}
      </span>
      <h3 className="mt-5 text-lg font-extrabold text-text-primary">{title}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-text-secondary">{text}</p>
    </article>
  );
}

function SafetyCard({ title, text }) {
  return (
    <article className="surface-card bg-surface rounded-2xl p-5 h-full">
      <ShieldCheck size={22} className="text-accent" />
      <h3 className="mt-4 font-extrabold text-text-primary">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-text-muted">{text}</p>
    </article>
  );
}

function InstallStep({ label, title, text }) {
  return (
    <article className="surface-card bg-surface flex gap-4 rounded-2xl p-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-extrabold text-white shadow-accent-sm">{label}</span>
      <div>
        <h3 className="font-extrabold text-text-primary">{title}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-text-muted">{text}</p>
      </div>
    </article>
  );
}
