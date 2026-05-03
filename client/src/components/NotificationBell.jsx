import { useEffect, useRef, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { getRealtimeSocket } from '../lib/realtime.js';

export default function NotificationBell() {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState('');

  async function loadRequests() {
    try {
      const { requests: pending } = await api('/api/friends/requests');
      setRequests(pending);
    } catch {
      setRequests([]);
    }
  }

  useEffect(() => {
    loadRequests();
    const socket = getRealtimeSocket();
    const handleNewRequest = ({ request }) => {
      setRequests((current) => {
        if (current.some((item) => item._id === request._id)) return current;
        return [request, ...current];
      });
    };
    const handleAccepted = ({ request, notification }) => {
      setRequests((current) => current.filter((item) => item._id !== request._id));
      if (notification?.body) setMessage(notification.body);
    };

    socket.on('friend:request:new', handleNewRequest);
    socket.on('friend:request:accepted', handleAccepted);
    socket.on('friend:request:cancelled', ({ requestId }) => {
      setRequests((current) => current.filter((request) => request._id !== requestId));
    });

    return () => {
      socket.off('friend:request:new', handleNewRequest);
      socket.off('friend:request:accepted', handleAccepted);
      socket.off('friend:request:cancelled');
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  async function respond(requestId, status) {
    try {
      await api(`/api/friends/requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setRequests((current) => current.filter((request) => request._id !== requestId));
      setMessage(status === 'accepted' ? 'Request accepted' : 'Request rejected');
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button onClick={() => setOpen((value) => !value)} className="relative rounded-2xl border border-white/15 bg-white/10 p-3" aria-label="Notifications">
        <Bell size={20} />
        {requests.length > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
            {requests.length}
          </span>
        )}
      </button>
      {open && (
        <section className="glass absolute right-0 top-14 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-3xl p-4 shadow-glow">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Requests</h2>
            <span className="text-xs text-white/50">{requests.length} pending</span>
          </div>
          {message && <p className="mt-2 text-sm text-mint">{message}</p>}
          <div className="mt-3 max-h-96 space-y-3 overflow-y-auto">
            {requests.map((request) => (
              <article key={request._id} className="rounded-2xl border border-white/10 bg-white/8 p-3">
                <div className="flex items-center gap-3">
                  <img src={request.from.avatar} alt="" className="h-11 w-11 rounded-2xl bg-white/10 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{request.from.name}</p>
                    <p className="truncate text-xs text-white/55">@{request.from.username} - {request.from.gender} - {request.from.age}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => respond(request._id, 'rejected')} className="rounded-2xl border border-white/10 py-2 text-sm" aria-label="Reject"><X className="mx-auto" size={18} /></button>
                  <button onClick={() => respond(request._id, 'accepted')} className="rounded-2xl bg-mint py-2 text-sm font-semibold text-ink" aria-label="Accept"><Check className="mx-auto" size={18} /></button>
                </div>
              </article>
            ))}
            {!requests.length && <p className="py-6 text-center text-sm text-white/45">No pending requests.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
