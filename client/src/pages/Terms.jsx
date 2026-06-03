import { Link } from 'react-router-dom';
import { ArrowLeft, Ban, Bell, FileText, LockKeyhole, ShieldCheck, UserCheck } from 'lucide-react';
import BrandLogo from '../components/BrandLogo.jsx';

export default function Terms() {
  return (
    <main className="min-h-screen bg-ink px-5 py-6 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-4">
          <BrandLogo />
          <Link to="/app/profile" className="btn-icon h-10 w-10 rounded-full" aria-label="Back to settings">
            <ArrowLeft size={18} />
          </Link>
        </header>

        <section className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">Terms Of Use</p>
          <h1 className="mt-3 text-4xl font-semibold">Use Varta respectfully and safely.</h1>
          <p className="mt-4 leading-7 text-white/58">
            These terms are written for the current Varta beta. By using the app, testers agree to use it responsibly and report issues instead of abusing them.
          </p>
          <p className="mt-2 text-sm text-white/38">Last updated: May 11, 2026</p>
        </section>

        <div className="mt-8 grid gap-3">
          <TermsBlock icon={UserCheck} title="Age Requirement">
            Varta is for users who are 18 or older. Do not create an account or continue as guest if you are under 18.
          </TermsBlock>
          <TermsBlock icon={ShieldCheck} title="Respectful Use">
            Do not harass, threaten, impersonate, spam, or share illegal, hateful, sexual, or unsafe content. Random rooms and chat features are for real conversations only.
          </TermsBlock>
          <TermsBlock icon={Ban} title="Moderation">
            Varta may limit, block, or remove accounts that abuse random rooms, messaging, calls, reports, or notifications. Reports may include profile and message references for review.
          </TermsBlock>
          <TermsBlock icon={Bell} title="Notifications And Calls">
            Calls, ringing, vibration, and push notifications depend on browser, device, network, and permission support. Some features may not work on every phone or browser.
          </TermsBlock>
          <TermsBlock icon={LockKeyhole} title="Account Security">
            Keep your OTP, password, and device secure. If you notice suspicious login activity, change credentials and contact the project owner.
          </TermsBlock>
          <TermsBlock icon={FileText} title="Beta Disclaimer">
            Varta is currently shared for testing and review. Features can change, break, or be removed while the app is improved.
          </TermsBlock>
        </div>

        <section className="mt-8 rounded-[22px] border border-white/8 bg-white/5 p-5">
          <h2 className="font-semibold">Contact</h2>
          <p className="mt-2 text-sm leading-6 text-white/58">
            For account, safety, or terms questions, contact the Varta project owner through the support channel shared with testers.
          </p>
        </section>
      </div>
    </main>
  );
}

function TermsBlock({ icon: Icon, title, children }) {
  return (
    <article className="rounded-[22px] border border-white/8 bg-white/5 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold/10 text-gold"><Icon size={20} /></span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/58">{children}</p>
    </article>
  );
}
