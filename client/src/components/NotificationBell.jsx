import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, LogIn, ShieldCheck, UserCheck, UserPlus, X } from 'lucide-react';
import { api, getToken } from '../lib/api.js';
import { showNativeNotification } from '../lib/native.js';
import { getRealtimeSocket } from '../lib/realtime.js';

const styles = {
  'friend-request': { label: 'Friend request', icon: UserPlus, tone: 'text-accent', bg: 'bg-accent/10' },
  'friend-request-accepted': { label: 'Request accepted', icon: UserCheck, tone: 'text-accent', bg: 'bg-accent/10' },
  login: { label: 'Security', icon: LogIn, tone: 'text-gold', bg: 'bg-gold/10' },
  system: { label: 'Update', icon: ShieldCheck, tone: 'text-text-primary border border-border-default', bg: 'bg-surface-hover' }
};

const importantTypes = new Set(['friend-request', 'friend-request-accepted', 'login', 'system']);

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadFeed() {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const [requestData, notificationData] = await Promise.all([
        api('/api/friends/requests'),
        api('/api/notifications')
      ]);
      setRequests(requestData.requests || []);
      const importantNotifications = (notificationData.notifications || []).filter((notification) => importantTypes.has(notification.type));
      setNotifications(importantNotifications);
      setUnreadCount(importantNotifications.filter((notification) => !notification.readAt).length);
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
      showNativeNotification({
        title: notification.title,
        body: notification.body,
        extra: { type: notification.type, url: notification.url }
      }).catch(() => {});
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
    const readAt = new Date().toISOString();
    api('/api/notifications/read', { method: 'PATCH' })
      .then(() => {
        setUnreadCount(0);
        setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt || readAt })));
      })
      .catch(() => {});
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

  const count = feed.filter((item) => item.request || !item.readAt).length;

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen((value) => !value)} 
        className="btn-icon relative h-11 w-11 rounded-[16px] flex items-center justify-center transition active:scale-95" 
        aria-label="Notifications"
      >
        <Bell size={20} className="text-text-primary" />
        {count > 0 && (
          <span className="absolute top-[8px] right-[8px] h-2.5 w-2.5 rounded-full bg-accent ring-[2px] ring-surface badge-pulse z-10" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[105] bg-black/40 backdrop-blur-sm"
            />
            {/* Side Drawer Panel */}
            <motion.section
              initial={{ x: '100%', opacity: 0.95 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 250 }}
              className="fixed inset-y-0 right-0 z-[110] flex h-[100dvh] w-full max-w-md flex-col bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] pt-[calc(env(safe-area-inset-top)+0.85rem)] text-text-primary shadow-elevated border-l border-border-default"
            >
              <div className="border-b border-border-default pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <h2 className="text-xl font-bold md:text-2xl text-text-primary leading-tight">Notifications</h2>
                    <p className="mt-1 text-xs text-text-secondary font-medium leading-relaxed">
                      Friend requests, login alerts and updates
                    </p>
                  </div>
                  <button 
                    onClick={() => setOpen(false)} 
                    className="h-10 w-10 rounded-full bg-surface-hover border border-border-default text-text-primary flex items-center justify-center transition-all duration-300 ease-out hover:scale-110 hover:bg-border-default active:scale-95 shrink-0" 
                    aria-label="Close notifications"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>
              {message && <p className="mt-2 text-sm font-semibold text-accent">{message}</p>}
              <div className="mx-auto mt-4 flex w-full flex-1 flex-col space-y-2.5 overflow-y-auto overscroll-contain scrollbar-thin pr-1">
                {loading && <NotificationSkeleton />}
                {!loading && feed.map((item, index) => (
                  <motion.div
                    key={item._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.2 }}
                  >
                    <NotificationItem item={item} onRespond={respond} />
                  </motion.div>
                ))}
                {!loading && !feed.length && (
                  <div className="py-20 flex-1 flex flex-col items-center justify-center text-center">
                    <div className="relative mb-4">
                      <span className="tone-ring grid h-16 w-16 place-items-center rounded-2xl bg-accent/10 text-accent">
                        <Bell size={28} />
                      </span>
                    </div>
                    <p className="mt-2 text-base font-bold text-text-primary">No important notifications yet.</p>
                    <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-text-secondary font-semibold">
                      Messages and call rings stay in their own chat/call surfaces so this screen stays clean.
                    </p>
                    <button 
                      onClick={loadFeed} 
                      className="btn-secondary mx-auto mt-5 flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold shadow-sm"
                    >
                      Refresh Feed
                    </button>
                  </div>
                )}
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotificationSkeleton() {
  return Array.from({ length: 4 }).map((_, index) => (
    <div key={index} className="flex gap-3 rounded-2xl border border-border-default bg-bg p-3">
      <div className="h-10 w-10 rounded-2xl skeleton" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 rounded-full skeleton" />
        <div className="h-3 w-40 rounded-full skeleton" />
        <div className="h-2.5 w-52 rounded-full skeleton" />
      </div>
    </div>
  ));
}

function NotificationItem({ item, onRespond }) {
  const style = styles[item.type] || styles.system;
  const Icon = style.icon;
  const actor = item.actor || item.request?.from;

  return (
    <article className="rounded-2xl border border-border-default bg-surface p-3 shadow-card transition-all duration-200 hover:shadow-card-hover">
      <div className="flex gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${style.bg} ${style.tone}`}>
          {actor?.avatar ? <img src={actor.avatar} alt="" className="h-10 w-10 rounded-2xl object-cover" /> : <Icon size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.tone}`}>{style.label}</span>
            <span className="text-[10px] text-text-faint">{formatTime(item.createdAt)}</span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-text-primary">{item.title}</p>
          <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary font-medium mt-0.5">{item.body}</p>
        </div>
      </div>
      {item.request && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => onRespond(item.request._id, 'rejected')} className="btn-secondary rounded-[14px] py-2.5 text-sm min-h-[44px]" aria-label="Reject"><X className="mx-auto" size={18} /></button>
          <button onClick={() => onRespond(item.request._id, 'accepted')} className="btn-primary rounded-[14px] py-2.5 text-sm font-semibold min-h-[44px]" aria-label="Accept"><Check className="mx-auto" size={18} /></button>
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
