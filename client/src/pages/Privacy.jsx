import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, Database, LockKeyhole, MapPin, Mic, ShieldCheck, Trash2 } from 'lucide-react';
import BrandLogo from '../components/BrandLogo.jsx';

export default function Privacy() {
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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">Privacy Policy</p>
          <h1 className="mt-3 text-4xl font-semibold">How Varta protects your conversations.</h1>
          <p className="mt-4 leading-7 text-white/58">
            This policy explains what Varta collects, why it is used, and the controls available to users. It is written for the current beta version of Varta.
          </p>
          <p className="mt-2 text-sm text-white/38">Last updated: May 4, 2026</p>
        </section>

        <div className="mt-8 grid gap-3">
          <PolicyBlock icon={Database} title="Data We Collect">
            Varta stores account profile details such as name, username, age confirmation, gender, bio, profile photo, login method, friend requests, chats, messages, call history, reports, blocks, and notification subscriptions. Guest accounts may reuse the same device/network identity to reduce spam.
          </PolicyBlock>
          <PolicyBlock icon={MapPin} title="Location">
            Location is used only for nearby random-room discovery. The browser asks permission before sharing location. Varta stores approximate coordinates for discovery and updates them only when permission is granted.
          </PolicyBlock>
          <PolicyBlock icon={Mic} title="Calls, Camera, And Voice">
            Microphone and camera access are used for WebRTC calls and voice messages. Call media is transferred peer-to-peer when possible and is not intentionally recorded by Varta. Call metadata such as time, type, status, and duration may be stored for chat history.
          </PolicyBlock>
          <PolicyBlock icon={Bell} title="Notifications">
            Push subscriptions are stored so Varta can send message, request, login, and call alerts. Custom ringtone files selected in the app are stored locally in your browser/PWA, not uploaded as account data.
          </PolicyBlock>
          <PolicyBlock icon={ShieldCheck} title="Safety">
            Blocks and reports help hide users from each other, reduce abuse, and support moderation. Reported content and profile details may be reviewed for safety decisions.
          </PolicyBlock>
          <PolicyBlock icon={LockKeyhole} title="Security">
            Sessions use JWT authentication. Passwords are hashed before storage. You should not share OTPs, passwords, or account links with anyone.
          </PolicyBlock>
          <PolicyBlock icon={Trash2} title="Your Controls">
            You can edit your profile, change username and photo, block or unblock users, clear local cache, disable browser notifications, and request removal of account data from the app owner during the beta period.
          </PolicyBlock>
        </div>

        <section className="mt-8 rounded-[22px] border border-white/8 bg-white/5 p-5">
          <h2 className="font-semibold">Contact</h2>
          <p className="mt-2 text-sm leading-6 text-white/58">
            For privacy or safety requests, contact the Varta project owner through the support channel shared with testers.
          </p>
        </section>
      </div>
    </main>
  );
}

function PolicyBlock({ icon: Icon, title, children }) {
  return (
    <article className="rounded-[22px] border border-white/8 bg-white/5 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8 text-mint"><Icon size={20} /></span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/58">{children}</p>
    </article>
  );
}
