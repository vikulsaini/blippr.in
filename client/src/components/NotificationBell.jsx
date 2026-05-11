import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, LogIn, Phone, ShieldCheck, UserCheck, UserPlus, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { getRealtimeSocket } from '../lib/realtime.js';

const styles = {
  'friend-request': { label: 'Friend request', icon: UserPlus, tone: 'text-mint', bg: 'bg-mint/12' },
  'friend-request-accepted': { label: 'Request accepted', icon: UserCheck, tone: 'text-mint', bg: 'bg-mint/12' },
  login: { label: 'Security', icon: LogIn, tone: 'text-amber-200', bg: 'bg-amber-300/12' },
  call: { label: 'Call', icon: Phone, tone: 'text-coral', bg: 'bg-coral/12' },
  system: { label: 'Update', icon: ShieldCheck, tone: 'text-white/70', bg: 'bg-white/8' }
};

const importantTypes = new Set(['friend-request', 'friend-request-accepted', 'login', 'call', 'system']);

export default function NotificationBell() {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadFeed() {
    try {
      const [requestData, notificationData] = await Promise.all([
        api('/api/friends/requests'),
        api('/api/notifications')
      ]);
      setRequests(requestData.requests || []);
      const importantNotifications = (notificationData.notifications || []).filter((notification) => importantTypes.has(notification.type));
      setNotifications(importantNotifications);
      setUnreadCount(notificationData.unreadCount || importantNotifications.filter((notification) => !notification.readAt).length);
    } catch {
      setRequests([]);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeed();
    const socket = getRealtimeSocket();
    const handleNewRequest = ({ request }) => {
      setRequests((current) => {
        if (current.some((item) => item._id === request._id)) return current;
        return [request, ...current];
      });
    };
    const handleNotification = ({ notification }) => {
      if (!notification) return;
      if (!importantTypes.has(notification.type)) return;
      setNotifications((current) => {
        if (current.some((item) => item._id === notification._id)) return current;
        return [notification, ...current].slice(0, 60);
      });
      setUnreadCount((count) => count + 1);
    };
    const handleAccepted = ({ request, notification }) => {
      setRequests((current) => current.filter((item) => item._id !== request?._id));
      if (notification?.body) setMessage(notification.body);
    };

    socket.on('friend:request:new', handleNewRequest);
    socket.on('friend:request:accepted', handleAccepted);
    socket.on('friend:request:cancelled', ({ requestId }) => {
      setRequests((current) => current.filter((request) => request._id !== requestId));
    });
    socket.on('notification:new', handleNotification);

    return () => {
      socket.off('friend:request:new', handleNewRequest);
      socket.off('friend:request:accepted', handleAccepted);
      socket.off('friend:request:cancelled');
      socket.off('notification:new', handleNotification);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    api('/api/notifications/read', { method: 'PATCH' })
      .then(() => setUnreadCount(0))
      .catch(() => {});
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const feed = useMemo(() => {
    const requestIds = new Set(requests.map((request) => request._id));
    const requestItems = requests.map((request) => ({
      _id: `request:${request._id}`,
      type: 'friend-request',
      title: request.from?.name || 'New request',
      body: `@${request.from?.username || 'user'} wants to connect`,
      createdAt: request.createdAt,
      actor: request.from,
      request
    }));
    const notificationItems = notifications
      .filter((notification) => !(notification.type === 'friend-request' && requestIds.has(String(notification.requestId))))
      .filter((notification) => importantTypes.has(notification.type))
      .map((notification) => ({ ...notification, _id: `notification:${notification._id}` }));
    return [...requestItems, ...notificationItems]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 60);
  }, [notifications, requests]);

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

  const count = requests.length + unreadCount;

  return (
    <div ref={rootRef} className="relative">
      <button onClick={() => setOpen((value) => !value)} className="btn-icon relative h-11 w-11 rounded-[16px]" aria-label="Notifications">
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
            {Math.min(count, 99)}
          </span>
        )}
      </button>
      {open && (
        <section className="glass fixed inset-x-3 top-16 z-30 mx-auto flex max-h-[min(34rem,calc(100dvh-6rem))] max-w-md flex-col rounded-3xl p-4 shadow-glow">
          <div className="flex items-start justify-between gap-3 border-b border-white/8 pb-3">
            <div>
              <h2 className="text-lg font-semibold">Notifications</h2>
              <p className="mt-1 text-xs text-white/45">Requests, accepted requests, security alerts and calls</p>
            </div>
            <button onClick={() => setOpen(false)} className="btn-icon h-9 w-9 rounded-full" aria-label="Close notifications">
              <X size={17} />
            </button>
          </div>
          {message && <p className="mt-2 text-sm text-mint">{message}</p>}
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
            {loading && <NotificationSkeleton />}
            {!loading && feed.map((item) => (
              <NotificationItem key={item._id} item={item} onRespond={respond} />
            ))}
            {!loading && !feed.length && (
              <div className="py-8 text-center">
                <Bell className="mx-auto text-white/35" size={24} />
                <p className="mt-2 text-sm text-white/45">No important notifications yet.</p>
                <p className="mx-auto mt-1 max-w-56 text-xs leading-5 text-white/35">Regular message alerts stay in chats so this screen stays clean.</p>
                <button onClick={loadFeed} className="btn-secondary mt-4 rounded-full px-4 py-2 text-xs font-semibold">Refresh</button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function NotificationSkeleton() {
  return Array.from({ length: 4 }).map((_, index) => (
    <div key={index} className="flex animate-pulse gap-3 rounded-2xl border border-white/10 bg-white/7 p-3">
      <div className="h-10 w-10 rounded-2xl bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 rounded-full bg-white/10" />
        <div className="h-3 w-40 rounded-full bg-white/8" />
        <div className="h-2.5 w-52 rounded-full bg-white/6" />
      </div>
    </div>
  ));
}

function NotificationItem({ item, onRespond }) {
  const style = styles[item.type] || styles.system;
  const Icon = style.icon;
  const actor = item.actor || item.request?.from;

  return (
    <article className="rounded-2xl border border-white/10 bg-white/7 p-3">
      <div className="flex gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${style.bg} ${style.tone}`}>
          {actor?.avatar ? <img src={actor.avatar} alt="" className="h-10 w-10 rounded-2xl object-cover" /> : <Icon size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.tone}`}>{style.label}</span>
            <span className="text-[10px] text-white/35">{formatTime(item.createdAt)}</span>
          </div>
          <p className="mt-1 truncate text-sm font-medium">{item.title}</p>
          <p className="line-clamp-2 text-xs leading-5 text-white/55">{item.body}</p>
        </div>
      </div>
      {item.request && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => onRespond(item.request._id, 'rejected')} className="btn-secondary rounded-[14px] py-2 text-sm" aria-label="Reject"><X className="mx-auto" size={18} /></button>
          <button onClick={() => onRespond(item.request._id, 'accepted')} className="btn-primary rounded-[14px] py-2 text-sm font-semibold" aria-label="Accept"><Check className="mx-auto" size={18} /></button>
        </div>
      )}
    </article>
  );
}

function formatTime(value) {
  if (!value) return 'now';
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
