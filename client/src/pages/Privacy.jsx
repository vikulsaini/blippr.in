import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, Database, LockKeyhole, MapPin, Mic, ShieldCheck, Trash2, CheckCircle2, Zap } from 'lucide-react';

export default function Privacy() {
  return (
    <main className="chat-dark-theme min-h-screen bg-bg px-4 py-6 md:py-12 text-text-primary relative overflow-hidden scrollbar-none pb-24">
      {/* Ambient Glows */}
      <div className="fixed top-1/4 -left-20 w-64 h-64 bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-1/4 -right-20 w-80 h-80 bg-success/5 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="mx-auto max-w-3xl">
        
        {/* Top AppBar */}
        <header className="flex items-center gap-3.5 mb-8">
          <Link 
            to="/app/profile" 
            className="text-accent hover:opacity-80 p-2 -ml-2 rounded-full transition active:scale-95"
            aria-label="Back to profile"
          >
            <ArrowLeft size={22} />
          </Link>
          <h1 className="font-heading font-black text-xl text-accent tracking-tighter">Privacy Policy</h1>
        </header>

        {/* Hero Section */}
        <section className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(124,58,237,0.8)] animate-pulse" />
            <span className="text-[10px] font-bold tracking-widest uppercase">Effective Oct 2023</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-text-primary mb-4 leading-tight tracking-tight">
            Your data, protected by <span className="text-accent italic">Blippr</span>.
          </h2>
          <p className="text-sm md:text-base text-text-secondary leading-relaxed max-w-2xl">
            We believe privacy is a fundamental right. This policy outlines how Blippr manages your data across our cloud infrastructure to ensure a secure, electric social experience.
          </p>
        </section>

        {/* Bento Layout for Key Tech */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          
          {/* Auth Card */}
          <div className="glass-card rounded-2xl p-6 hover:border-accent/30 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform text-accent">
              <LockKeyhole size={22} />
            </div>
            <h3 className="text-base font-black text-accent mb-2">Secure Authentication</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              We utilize enterprise-grade encryption. Your credentials are encrypted and managed in a dedicated vault.
            </p>
          </div>

          {/* Real-time Card */}
          <div className="glass-card rounded-2xl p-6 hover:border-success/30 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform text-success">
              <Zap size={22} />
            </div>
            <h3 className="text-base font-black text-success mb-2">Redis Presence</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Active status and real-time socket connections are ephemeral, handled by Redis for sub-millisecond response without persistent logging.
            </p>
          </div>

          {/* Profile Card */}
          <div className="glass-card rounded-2xl p-6 hover:border-amber-500/30 transition-all duration-300 md:col-span-2 flex flex-col md:flex-row gap-5 items-start">
            <div className="w-12 h-12 shrink-0 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Database size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-500 mb-2">MongoDB Profile Data</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Non-sensitive profile information like your bio, username, and social graph are stored in distributed MongoDB clusters. This data is only accessible to authorized users within the Blippr ecosystem.
              </p>
            </div>
          </div>

        </div>

        {/* Detailed Policy Sections */}
        <article className="space-y-10">
          
          {/* Data Collection */}
          <section className="glass-card p-6 rounded-3xl">
            <h4 className="text-base font-black text-text-primary mb-4 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-accent rounded-full" />
              1. Data Collection &amp; Usage
            </h4>
            <div className="space-y-4 text-xs text-text-secondary leading-relaxed">
              <p>To provide our high-energy communication features, we collect the following:</p>
              <ul className="list-none space-y-3 pl-1">
                <li className="flex gap-3">
                  <CheckCircle2 size={16} className="text-accent flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-text-primary">Account Information:</strong> Email and identity tokens managed securely.
                  </span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 size={16} className="text-accent flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-text-primary">Profile Metadata:</strong> Custom avatars, nicknames, and bio text stored in MongoDB.
                  </span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 size={16} className="text-accent flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-text-primary">Media:</strong> Images and videos uploaded to our secure CDN with temporary access tokens.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* Video Calls & Encryption */}
          <section className="p-6 rounded-3xl bg-white/60 border border-border relative overflow-hidden shadow-sm">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-accent/5 blur-3xl rounded-full" />
            <h4 className="text-base font-black text-accent mb-3">2. Video Call Encryption</h4>
            <p className="text-xs text-text-muted leading-relaxed mb-5 relative z-10">
              Blippr video calls are built on WebRTC with forced DTLS/SRTP encryption. This ensures that your audio and video streams are Peer-to-Peer (P2P) whenever possible.
            </p>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 border border-border relative z-10">
              <ShieldCheck size={28} className="text-success shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-success uppercase tracking-wider">E2EE Protocol</p>
                <p className="text-[11px] text-text-primary font-medium mt-0.5">
                  Signals are routed via secure TURN/STUN servers only if P2P is blocked by firewalls.
                </p>
              </div>
            </div>
          </section>

          {/* Cookies & Tracking */}
          <section className="glass-card p-6 rounded-3xl">
            <h4 className="text-base font-black text-text-primary mb-4">3. Cookies &amp; Local Storage</h4>
            <p className="text-xs text-text-muted leading-relaxed mb-4">
              As a Progressive Web App (PWA), Blippr utilizes modern browser storage instead of traditional tracking cookies:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-50 border border-border">
                <p className="text-xs font-bold text-text-primary mb-1.5">Session Storage</p>
                <p className="text-[11px] text-text-muted leading-relaxed italic">
                  Clears when you close the tab. Used for temporary UI state.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-50 border border-border">
                <p className="text-xs font-bold text-text-primary mb-1.5">IndexedDB</p>
                <p className="text-[11px] text-text-muted leading-relaxed italic">
                  Stores chat history offline for instant loading speeds.
                </p>
              </div>
            </div>
          </section>

        </article>

        {/* Footer Contact */}
        <section className="mt-12 p-6 rounded-3xl glass-card relative overflow-hidden flex flex-col items-center text-center">
          <h2 className="text-base font-black text-text-primary">Contact Us</h2>
          <p className="text-xs text-text-muted mt-2 max-w-md leading-relaxed">
            For privacy or safety requests, contact the Blippr project owner through the support channel shared with testers.
          </p>
          <button className="mt-5 px-8 py-3 bg-accent hover:bg-accent-hover text-white rounded-full font-bold text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all">
            Contact Legal Center
          </button>
        </section>

      </div>
    </main>
  );
}
