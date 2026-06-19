import { useEffect, useMemo, useState } from 'react';
import { Clock3, X } from 'lucide-react';
import { api } from '../lib/api.js';

export default function GuestLimitBanner({ me }) {
  const [guestExpiresAt, setGuestExpiresAt] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (me?.isGuest && me.guestExpiresAt) {
      setGuestExpiresAt(me.guestExpiresAt);
    } else {
      setGuestExpiresAt(null);
    }
  }, [me]);

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
    if (guestExpiresAt && remaining <= 0) window.dispatchEvent(new CustomEvent('blippr:guest-expired'));
  }, [guestExpiresAt, remaining]);

  if (!guestExpiresAt || hidden || remaining <= 0) return null;

  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="mb-3 flex items-center gap-3 rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm shadow-sm text-amber-800">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
        <Clock3 size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Guest preview ends in {minutes}:{String(seconds).padStart(2, '0')}</p>
        <p className="truncate text-xs text-amber-600">Register before expiry to keep using full Blippr.</p>
      </div>
      <button onClick={() => setHidden(true)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-amber-100 text-amber-700" aria-label="Hide guest timer">
        <X size={14} />
      </button>
    </div>
  );
}
