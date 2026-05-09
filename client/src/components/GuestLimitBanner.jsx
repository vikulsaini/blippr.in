import { useEffect, useMemo, useState } from 'react';
import { Clock3, X } from 'lucide-react';
import { api } from '../lib/api.js';

export default function GuestLimitBanner() {
  const [guestExpiresAt, setGuestExpiresAt] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    api('/api/users/me')
      .then(({ user }) => {
        if (user?.isGuest && user.guestExpiresAt) setGuestExpiresAt(user.guestExpiresAt);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!guestExpiresAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [guestExpiresAt]);

  const remaining = useMemo(() => {
    if (!guestExpiresAt) return 0;
    return Math.max(0, new Date(guestExpiresAt).getTime() - now);
  }, [guestExpiresAt, now]);

  useEffect(() => {
    if (guestExpiresAt && remaining <= 0) window.dispatchEvent(new CustomEvent('varta:guest-expired'));
  }, [guestExpiresAt, remaining]);

  if (!guestExpiresAt || hidden || remaining <= 0) return null;

  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="mb-3 flex items-center gap-3 rounded-[18px] border border-mint/18 bg-mint/10 px-3 py-2 text-sm shadow-[0_14px_40px_rgba(62,224,168,0.08)]">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint text-ink">
        <Clock3 size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white">Guest preview ends in {minutes}:{String(seconds).padStart(2, '0')}</p>
        <p className="truncate text-xs text-white/52">Register before expiry to keep using full Varta.</p>
      </div>
      <button onClick={() => setHidden(true)} className="grid h-8 w-8 place-items-center rounded-full bg-white/8" aria-label="Hide guest timer">
        <X size={14} />
      </button>
    </div>
  );
}
