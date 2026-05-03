import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, MessageCircle, Phone, Radar, ShieldCheck, Sparkles, UserPlus, Video } from 'lucide-react';
import { getToken } from '../lib/api.js';

const avatarSeeds = ['anaya', 'vikram', 'kiara', 'neel', 'zoya', 'arjun'];

export default function Landing() {
  const appLink = getToken() ? '/app' : '/auth';
  if (getToken()) return <Navigate to="/app" replace />;

  return (
    <main className="min-h-screen overflow-hidden bg-ink text-white">
      <section className="relative min-h-screen">
        <div className="absolute inset-0">
          <div className="landing-mesh absolute inset-0" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.16),transparent_28%),linear-gradient(180deg,rgba(8,9,13,0.08),#08090d_86%)]" />
          <HeroScene />
        </div>

        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-ink shadow-glow">
              <MessageCircle size={20} />
            </span>
            <span className="text-xl font-semibold">Varta</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm text-white/62 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#safety" className="hover:text-white">Safety</a>
            <a href="#install" className="hover:text-white">Install</a>
          </div>
          <Link to={appLink} className="btn-secondary rounded-full px-4 py-2 text-sm font-semibold">
            {getToken() ? 'Open app' : 'Login'}
          </Link>
        </nav>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-7xl content-center px-5 pb-12 pt-8 sm:px-8 lg:px-10">
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-sm text-white/70 backdrop-blur">
              <Sparkles size={15} className="text-mint" />
              Real-time friends, nearby matches, and calls
            </p>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
              Meet nearby people. Keep the good conversations.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
              Varta brings stranger matching, friend requests, fast chats, calls, and safety controls into one installable mobile-first web app.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={appLink} className="btn-primary rounded-full px-6 py-3 text-center font-semibold">
                Start Varta
              </Link>
              <a href="#features" className="btn-secondary rounded-full px-6 py-3 text-center font-semibold">
                See features
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="border-t border-white/8 bg-[#0b0d12] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">Built for actual use</p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Everything needed for a modern chat app.</h2>
            </div>
            <p className="text-white/58 lg:text-lg">
              The interface stays compact on phones, then opens up into a clean responsive website for people reviewing the product on laptops and desktops.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Feature icon={Radar} title="Nearby match" text="Find online users near you or switch to random matches from anywhere." />
            <Feature icon={UserPlus} title="Friend flow" text="Send requests, accept from notifications, and move matches into chats." />
            <Feature icon={Phone} title="Voice calls" text="Realtime calling with mute, speaker, ringing, and call history." />
            <Feature icon={Video} title="Video calls" text="Camera controls, switch camera, and a focused full-screen call UI." />
          </div>
        </div>
      </section>

      <section id="safety" className="bg-ink py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-3 lg:px-10">
          <div className="lg:col-span-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">Safety first</p>
            <h2 className="mt-3 text-3xl font-semibold">Control who can reach you.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
            <SafetyCard title="Block" text="Blocked users disappear from match, search, and chat lists." />
            <SafetyCard title="Report" text="Report profiles from match or chat profile screens." />
            <SafetyCard title="Private" text="Auth, IP, and account data stay server-side and protected." />
          </div>
        </div>
      </section>

      <section id="install" className="border-t border-white/8 bg-[#0b0d12] py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:px-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">Installable PWA</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Share it now, package it later.</h2>
            <p className="mt-4 max-w-2xl text-white/58">
              Varta can be opened from the browser, installed on Android from Chrome, and later wrapped as an APK with TWA or Capacitor.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <InstallStep label="1" title="Open link" text="Share the hosted website with testers." />
            <InstallStep label="2" title="Install app" text="Use the browser install prompt on mobile." />
          </div>
        </div>
      </section>
    </main>
  );
}

function HeroScene() {
  return (
    <div className="pointer-events-none absolute inset-0 mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
      <div className="absolute right-2 top-28 hidden w-[34rem] lg:block">
        <motion.div initial={{ opacity: 0, y: 24, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: -2 }} transition={{ duration: 0.65, delay: 0.12 }} className="rounded-[2rem] border border-white/10 bg-white/8 p-4 shadow-glow backdrop-blur-xl">
          <div className="rounded-[1.5rem] bg-[#10131a] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-white/45">Nearby now</p>
                <p className="text-xl font-semibold">6 people online</p>
              </div>
              <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-ink">Live</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {avatarSeeds.map((seed, index) => (
                <motion.div key={seed} animate={{ y: [0, index % 2 ? 8 : -8, 0] }} transition={{ duration: 4 + index * 0.25, repeat: Infinity, ease: 'easeInOut' }} className="rounded-2xl border border-white/8 bg-white/6 p-3">
                  <img src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}`} alt="" className="h-16 w-16 rounded-2xl bg-white/10 object-cover" />
                  <div className="mt-3 h-2 w-16 rounded-full bg-white/18" />
                  <div className="mt-2 h-2 w-10 rounded-full bg-white/10" />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} className="absolute bottom-24 right-5 hidden rounded-3xl border border-white/10 bg-[#11131a]/90 p-4 shadow-glow backdrop-blur md:block lg:right-[35rem]">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint text-ink"><Bell size={19} /></span>
          <div>
            <p className="text-sm font-semibold">New request</p>
            <p className="text-xs text-white/45">Accept to start chatting</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Feature({ icon: Icon, title, text }) {
  return (
    <article className="rounded-[1.35rem] border border-white/8 bg-white/5 p-5">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-ink">
        <Icon size={20} />
      </span>
      <h3 className="mt-5 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/55">{text}</p>
    </article>
  );
}

function SafetyCard({ title, text }) {
  return (
    <article className="rounded-[1.25rem] border border-white/8 bg-white/5 p-5">
      <ShieldCheck size={22} className="text-mint" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/55">{text}</p>
    </article>
  );
}

function InstallStep({ label, title, text }) {
  return (
    <article className="flex gap-4 rounded-[1.25rem] border border-white/8 bg-white/5 p-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-ink">{label}</span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-white/55">{text}</p>
      </div>
    </article>
  );
}
