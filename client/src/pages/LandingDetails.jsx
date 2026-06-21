import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion as framerMotion } from 'framer-motion';
import { Users, MessageCircle, Globe, Video, Radar, UserPlus, Phone, ShieldCheck, Fingerprint, Zap } from 'lucide-react';

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

function GlowDivider({ className = '' }) {
  return (
    <div className={`relative w-full h-[1px] bg-white/5 ${className}`}>
      <div className="absolute left-1/2 -translate-x-1/2 -top-[1.5px] w-24 h-[4px] bg-primary rounded-full blur-[2px] opacity-60" />
    </div>
  );
}

export default function LandingDetails() {
  return (
    <>
      {/* ─── Glowing divider ─── */}
      <GlowDivider className="mt-8" />

      {/* ─── STATS STRIP ─── */}
      <RevealSection>
        <section className="bg-[#131b2e]/40 border-y border-white/5 py-12 backdrop-blur-md">
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
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Built for Real Connection</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-text-primary">Everything needed for a modern chat app.</h2>
              </div>
              <p className="text-text-secondary font-medium lg:text-lg">
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
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Why Blippr</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-text-primary">A safer, smarter way to connect.</h2>
            </div>
          </RevealSection>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { icon: <Fingerprint size={28} className="text-primary" />, title: 'Identity Guardianship', text: 'Iron-clad Google login, email verification codes, and mobile OTP checkpoints ensure every conversation starts with a verified person.', delay: 0 },
              { icon: <Zap size={28} className="text-primary" />, title: 'Affinity Routing Network', text: 'Matching based on intentional hobby and interest vectors rather than messy geographic drops. Connect with people who share your passions.', delay: 0.1 },
              { icon: <Globe size={28} className="text-primary" />, title: 'Zero Install Friction', text: 'Instant web availability via blippr.in — no bloated iOS or Android store download mandates. Just open and start chatting.', delay: 0.2 }
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
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Safety First</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-text-primary">Control who can reach you.</h2>
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
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Real Stories</p>
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
                <article className="glass-card rounded-2xl p-6 flex flex-col justify-between h-full border border-white/5 hover:bg-white/5 transition duration-300">
                  <p className="text-sm font-semibold leading-6 text-text-secondary italic">"{t.quote}"</p>
                  <div className="mt-6 flex items-center gap-3">
                    <img src={t.avatar} alt={t.name} className="h-10 w-10 rounded-full border border-white/10 object-cover shadow-sm" />
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

      {/* ─── Glowing divider ─── */}
      <GlowDivider />

      {/* ─── INSTALL ─── */}
      <section id="install" className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-10">
          <RevealSection>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Installable PWA</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-text-primary">Share it now, package it later.</h2>
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
      <footer className="border-t border-white/5 bg-[#131b2e]/40 py-12 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <h2 className="text-xl font-black tracking-tighter text-primary">Blippr</h2>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-text-secondary">
              <Link to="/app/legal" className="hover:text-white transition">Legal Hub</Link>
              <a href="#features" className="hover:text-white transition">Features</a>
              <a href="#safety" className="hover:text-white transition">Safety</a>
            </div>
          </div>
          <div className="mt-8 border-t border-white/5 pt-8 text-center">
            <p className="text-sm font-semibold text-text-muted">© {new Date().getFullYear()} Blippr. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

function StatItem({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shadow-sm">
        <Icon size={18} />
      </span>
      <div>
        <p className="text-xl font-extrabold text-text-primary">{value}</p>
        <p className="text-xs font-semibold text-text-muted">{label}</p>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, text }) {
  return (
    <article className="glass-card rounded-2xl p-6 h-full border border-white/5 hover:bg-white/5 transition duration-300 cursor-pointer shadow-sm">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary shadow-sm">
        <Icon size={20} />
      </span>
      <h3 className="mt-5 font-extrabold text-text-primary">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-text-secondary">{text}</p>
    </article>
  );
}

function Pillar({ icon, title, text }) {
  return (
    <article className="glass-card rounded-3xl p-6 text-center h-full border border-white/5 hover:bg-white/5 transition duration-300 cursor-pointer shadow-sm">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 shadow-sm">
        {icon}
      </span>
      <h3 className="mt-5 text-lg font-extrabold text-text-primary">{title}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-text-secondary">{text}</p>
    </article>
  );
}

function SafetyCard({ title, text }) {
  return (
    <article className="glass-card rounded-2xl p-5 h-full border border-white/5 hover:bg-white/5 transition duration-300 shadow-sm">
      <ShieldCheck size={22} className="text-primary" />
      <h3 className="mt-4 font-extrabold text-text-primary">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-text-secondary">{text}</p>
    </article>
  );
}

function InstallStep({ label, title, text }) {
  return (
    <article className="glass-card flex gap-4 rounded-2xl p-5 border border-white/5 hover:bg-white/5 transition duration-300 shadow-sm">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-white text-sm font-extrabold shadow-md shadow-primary/20">{label}</span>
      <div>
        <h3 className="font-extrabold text-text-primary">{title}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-text-secondary">{text}</p>
      </div>
    </article>
  );
}
