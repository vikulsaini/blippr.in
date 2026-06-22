import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, LogIn, ShieldCheck, UserCheck, UserPlus, X, ArrowLeft, MessageCircle, Heart, Lock, Bolt } from 'lucide-react';
import { api, getToken } from '../lib/api.js';
import { showNativeNotification } from '../lib/native.js';
import { getRealtimeSocket } from '../lib/realtime.js';
import { showToast } from './Toast.jsx';

const styles = {
  'friend-request': { label: 'Friend request', icon: UserPlus, badgeIcon: Heart, badgeBg: 'bg-rose-500', tone: 'text-rose-400', bg: 'bg-rose-500/10' },
  'friend-request-accepted': { label: 'Request accepted', icon: UserCheck, badgeIcon: Check, badgeBg: 'bg-success', tone: 'text-success', bg: 'bg-success/10' },
  login: { label: 'Security', icon: LogIn, badgeIcon: Lock, badgeBg: 'bg-amber-500', tone: 'text-amber-400', bg: 'bg-amber-500/10' },
  system: { label: 'Update', icon: ShieldCheck, badgeIcon: Bolt, badgeBg: 'bg-primary', tone: 'text-primary', bg: 'bg-primary/10' }
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

  const groupedFeed = useMemo(() => {
    const today = [];
    const yesterday = [];
    const older = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

    feed.forEach((item) => {
      const time = new Date(item.createdAt).getTime();
      if (time >= todayStart) {
        today.push(item);
      } else if (time >= yesterdayStart) {
        yesterday.push(item);
      } else {
        older.push(item);
      }
    });

    return { today, yesterday, older };
  }, [feed]);

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
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setOpen(false)} 
                      className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-primary/5 transition-colors active:scale-95 duration-100 text-primary shrink-0" 
                      aria-label="Close notifications"
                    >
                      <ArrowLeft size={22} />
                    </button>
                    <h2 className="text-lg font-bold text-primary">Notifications</h2>
                  </div>
                  <button 
                    onClick={async () => {
                      try {
                        await api('/api/notifications/read', { method: 'PATCH' });
                        setUnreadCount(0);
                        setNotifications((current) => current.map((n) => ({ ...n, readAt: new Date().toISOString() })));
                        showToast('All notifications marked as read', 'success');
                      } catch {}
                    }}
                    className="font-label-md text-xs text-primary font-bold hover:bg-primary/5 px-2.5 py-1.5 rounded-lg transition-colors active:scale-95 duration-100 shrink-0"
                  >
                    Mark all read
                  </button>
                </div>
              </div>
              {message && <p className="mt-2 text-sm font-semibold text-accent">{message}</p>}
              <div className="mx-auto mt-4 flex w-full flex-1 flex-col space-y-2.5 overflow-y-auto overscroll-contain scrollbar-none pr-1">
                {loading && <NotificationSkeleton />}
                
                {!loading && (
                  <>
                    {groupedFeed.today.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="px-2 pb-1 pt-2">
                          <h3 className="text-[10px] font-black uppercase tracking-wider text-text-muted">Today</h3>
                        </div>
                        {groupedFeed.today.map((item, index) => (
                          <motion.div
                            key={item._id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04, duration: 0.2 }}
                          >
                            <NotificationItem item={item} onRespond={respond} />
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {groupedFeed.yesterday.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="px-2 pb-1 pt-4">
                          <h3 className="text-[10px] font-black uppercase tracking-wider text-text-muted">Yesterday</h3>
                        </div>
                        {groupedFeed.yesterday.map((item, index) => (
                          <motion.div
                            key={item._id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04, duration: 0.2 }}
                          >
                            <NotificationItem item={item} onRespond={respond} />
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {groupedFeed.older.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="px-2 pb-1 pt-4">
                          <h3 className="text-[10px] font-black uppercase tracking-wider text-text-muted">Older</h3>
                        </div>
                        {groupedFeed.older.map((item, index) => (
                          <motion.div
                            key={item._id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04, duration: 0.2 }}
                          >
                            <NotificationItem item={item} onRespond={respond} />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </>
                )}

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
  const BadgeIcon = style.badgeIcon || Bolt;
  const actor = item.actor || item.request?.from;

  return (
    <article className="glass-card rounded-2xl p-4 flex gap-4 transition-all hover:border-primary/30 border border-white/10 shadow-sm relative overflow-hidden group">
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 bg-[#171f33]">
          {actor?.avatar ? (
            <img src={actor.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
              <Icon size={20} />
            </div>
          )}
        </div>
        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#171f33] flex items-center justify-center ${style.badgeBg || 'bg-primary'}`}>
          <span className="text-[10px] text-white flex items-center justify-center">
            <BadgeIcon size={10} className="text-white" />
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-sm font-semibold text-text-primary leading-snug">
            {item.title}
          </p>
          <p className="text-xs text-text-secondary font-medium mt-0.5 leading-relaxed">
            {item.body}
          </p>
          <span className="text-[10px] text-text-faint mt-1 block">{formatTime(item.createdAt)}</span>
        </div>
        {item.request && (
          <div className="flex gap-2">
            <button 
              onClick={() => onRespond(item.request._id, 'accepted')} 
              className="bg-[#7c3aed] text-white px-4 py-1.5 rounded-full font-semibold text-xs active:scale-95 transition-transform"
            >
              Accept
            </button>
            <button 
              onClick={() => onRespond(item.request._id, 'rejected')} 
              className="border border-white/10 hover:bg-white/5 text-[#ccc3d8] px-4 py-1.5 rounded-full font-semibold text-xs active:scale-95 transition-transform"
            >
              Decline
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function formatTime(value) {
  if (!value) return 'now';
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

