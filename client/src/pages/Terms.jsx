import { Link } from 'react-router-dom';
import { ArrowLeft, Ban, Bell, FileText, LockKeyhole, ShieldCheck, UserCheck, Zap, UserRound, Sparkles } from 'lucide-react';

export default function Terms() {
  return (
    <main className="min-h-screen bg-bg px-4 py-6 md:py-12 text-text-primary relative overflow-hidden scrollbar-none pb-24">
      {/* Ambient Glows */}
      <div className="fixed top-1/4 -right-20 w-64 h-64 bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-1/4 -left-20 w-80 h-80 bg-success/5 blur-[120px] rounded-full pointer-events-none -z-10" />

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
          <h1 className="font-heading font-black text-xl text-accent tracking-tighter">Terms of Service</h1>
        </header>

        {/* Hero Section */}
        <section className="mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent mb-4 text-[10px] font-bold tracking-widest uppercase">
            Updated Oct 2023
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-text-primary mb-4 leading-tight tracking-tight">
            Blippr Legal Center
          </h2>
          <p className="text-sm md:text-base text-text-secondary leading-relaxed max-w-2xl">
            Please read these terms carefully. They govern your use of the Blippr real-time interaction platform and outline your rights as a member of our digital ecosystem.
          </p>
        </section>

        {/* Bento Style Legal Sections */}
        <div className="space-y-6 mb-12">
          
          {/* User Conduct Section */}
          <div className="glass-card p-6 rounded-3xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
                <UserRound size={18} />
              </div>
              <h3 className="text-base font-black text-text-primary">1. User Conduct</h3>
            </div>
            <div className="space-y-3 text-xs text-text-muted leading-relaxed">
              <p>By using Blippr, you agree to represent yourself authentically. Impersonation of any individual or entity is strictly prohibited and results in immediate account suspension.</p>
              <ul className="list-disc pl-5 space-y-1.5 text-text-secondary font-medium">
                <li>Maintain a respectful tone in all real-time communications.</li>
                <li>Do not distribute spam or unauthorized commercial content.</li>
                <li>Respect the privacy and personal data of other Blippr users.</li>
              </ul>
            </div>
          </div>

          {/* Real-time Interactions Section */}
          <div className="glass-card p-6 rounded-3xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
                <Zap size={18} />
              </div>
              <h3 className="text-base font-black text-text-primary">2. Real-time Interactions</h3>
            </div>
            <div className="space-y-3 text-xs text-text-muted leading-relaxed">
              <p>Blippr is built on immediate, "always-on" social connectivity. You acknowledge that real-time features may involve ephemeral data processing that is not permanently stored but is monitored for safety.</p>
              <div className="p-4 rounded-2xl bg-zinc-50 border border-border text-[11px] text-text-muted italic leading-relaxed">
                "Real-time streams are subject to automated moderation filters to maintain the electric and approachable brand atmosphere."
              </div>
            </div>
          </div>

          {/* Matchmaking Rules Section */}
          <div className="glass-card p-6 rounded-3xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Sparkles size={18} />
              </div>
              <h3 className="text-base font-black text-text-primary">3. Matchmaking Rules</h3>
            </div>
            <div className="space-y-3 text-xs text-text-muted leading-relaxed">
              <p>Our proprietary algorithms connect users based on activity, interests, and proximity. Blippr does not guarantee matches but promises a fair and unbiased experience for all active participants.</p>
              <p>Manipulation of matchmaking metrics or using external scripts to bypass discovery queues is a violation of these terms.</p>
            </div>
          </div>

          {/* Safety Guidelines (Featured Card) */}
          <div className="bg-accent/90 p-8 rounded-3xl flex flex-col gap-6 shadow-xl relative overflow-hidden group">
            {/* Atmospheric Background Shader */}
            <div className="absolute -right-20 -top-20 w-52 h-52 bg-white/10 blur-3xl rounded-full pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <ShieldCheck size={24} />
                </div>
                <h3 className="text-lg font-black text-white">4. Safety Guidelines</h3>
              </div>
              <p className="text-xs text-white/90 leading-relaxed mb-6">Your safety is our electric pulse. We maintain zero tolerance for harassment, hate speech, or the distribution of non-consensual media.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0b1326]/40 backdrop-blur-sm p-4 rounded-2xl border border-white/15">
                  <h4 className="text-xs font-bold text-white mb-1 uppercase tracking-wider">Report System</h4>
                  <p className="text-[11px] text-[#ccc3d8]/90 leading-relaxed">Use the 'Blipp' button to flag inappropriate behavior instantly.</p>
                </div>
                <div className="bg-[#0b1326]/40 backdrop-blur-sm p-4 rounded-2xl border border-white/15">
                  <h4 className="text-xs font-bold text-white mb-1 uppercase tracking-wider">Block Policy</h4>
                  <p className="text-[11px] text-[#ccc3d8]/90 leading-relaxed">Blocking a user removes them from your feed and prevents any future matches.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Document Text */}
          <div className="pt-8 space-y-4">
            <h3 className="text-base font-black text-text-primary border-l-4 border-accent pl-4">Legal Framework &amp; Liability</h3>
            <div className="text-xs text-text-muted leading-relaxed space-y-3">
              <p>Blippr (v1.0.4) is provided "as is" without warranty of any kind. We are not liable for interactions occurring outside of our platform or for the conduct of third parties. By using the app, you waive the right to participate in class-action lawsuits against Blippr Inc.</p>
              <p>If you do not agree with any part of these terms, please discontinue use of the platform immediately. Your continued use following any updates constitutes acceptance of the new terms.</p>
            </div>
          </div>

        </div>

        {/* Footer Decoration */}
        <div className="mt-16 flex flex-col items-center justify-center gap-3 py-8 border-t border-border">
          <span className="font-heading font-black text-xl text-accent/30 tracking-tighter">Blippr</span>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">© 2023 Blippr Legal Center. All rights reserved.</p>
        </div>

      </div>
    </main>
  );
}
