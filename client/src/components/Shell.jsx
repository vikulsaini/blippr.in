import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Shuffle, Search, UserRound } from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';
import GuestLimitBanner from './GuestLimitBanner.jsx';
import GuestUpgradeModal from './GuestUpgradeModal.jsx';
import GlobalIncomingCall from './GlobalIncomingCall.jsx';
import NotificationBell from './NotificationBell.jsx';
import SocketStateBanner from './SocketStateBanner.jsx';
import ToastProvider from './Toast.jsx';
import { refreshPushSubscriptionIfAllowed } from '../lib/notifications.js';

const tabs = [
  { to: '/app', label: 'Chats', icon: MessageCircle },
  { to: '/app/stranger', label: 'Random', icon: Shuffle },
  { to: '/app/discover', label: 'Find', icon: Search },
  { to: '/app/profile', label: 'Me', icon: UserRound }
];

export default function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isChats = location.pathname === '/app';
  const isRandom = location.pathname === '/app/stranger';
  const isConversation = isChats && new URLSearchParams(location.search).has('chat');
  const [bottomNavHidden, setBottomNavHidden] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [socketState, setSocketState] = useState('connected');
  const [clock, setClock] = useState(() => new Date());
  const navHidden = bottomNavHidden || keyboardOpen || isRandom;
  const showMainHeader = isChats && !isConversation && !bottomNavHidden;
  const touchStartRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    refreshPushSubscriptionIfAllowed().catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleSocketState(event) {
      setSocketState(event.detail?.state || 'connected');
    }

    window.addEventListener('blippr:socket-state', handleSocketState);
    return () => window.removeEventListener('blippr:socket-state', handleSocketState);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    function updateKeyboardState() {
      const heightGap = window.innerHeight - viewport.height;
      setKeyboardOpen(heightGap > 140);
    }

    updateKeyboardState();
    viewport.addEventListener('resize', updateKeyboardState);
    viewport.addEventListener('scroll', updateKeyboardState);
    return () => {
      viewport.removeEventListener('resize', updateKeyboardState);
      viewport.removeEventListener('scroll', updateKeyboardState);
    };
  }, []);

  /* Scroll to top on route change */
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo?.({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname]);

  function activeTabIndex() {
    const index = tabs.findIndex((tab) => tab.to === location.pathname);
    return index === -1 ? 0 : index;
  }

  function canSwipeTabs(target) {
    if (isConversation) return false;
    if (isChats && target?.closest?.('[data-chat-feed]')) return false;
    return !navHidden && !target?.closest?.('button, a, input, textarea, select, [role="button"], [data-no-tab-swipe]');
  }

  function handleTouchStart(event) {
    if (!canSwipeTabs(event.target)) {
      touchStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, at: Date.now() };
  }

  function handleTouchEnd(event) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || !canSwipeTabs(event.target)) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const fastEnough = Date.now() - start.at < 700;
    const horizontal = Math.abs(dx) > 85 && Math.abs(dx) > Math.abs(dy) * 1.35;
    if (!fastEnough || !horizontal) return;

    const current = activeTabIndex();
    const nextIndex = dx < 0 ? Math.min(current + 1, tabs.length - 1) : Math.max(current - 1, 0);
    if (nextIndex !== current) navigate(tabs[nextIndex].to);
  }

  return (
    <main
      data-random-route={isRandom ? 'true' : undefined}
      className={`app-shell mx-auto grid h-dvh w-full max-w-[90rem] grid-cols-1 overflow-hidden text-text-primary md:grid-cols-[5rem_minmax(0,1fr)] ${isRandom ? 'px-1 pt-1 md:gap-2 md:px-2 md:py-2' : 'px-2 pt-2 md:gap-4 md:px-5 md:py-5'}`}
    >
      <DesktopNav locationPath={location.pathname} socketState={socketState} clock={clock} />
      <div className="flex min-h-0 flex-col overflow-hidden">
        {showMainHeader && (
          <header className="mb-2 flex items-center justify-between rounded-2xl border border-border-default bg-surface px-3 py-2 shadow-card md:mb-3 md:px-4 md:py-3">
            <BrandLogo compactTitle />
            <NotificationBell />
          </header>
        )}
        <section
          ref={contentRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`flex min-h-0 flex-1 flex-col ${navHidden || isChats || isRandom ? 'overflow-hidden pb-0' : 'overflow-y-auto overscroll-contain scrollbar-thin pb-24 md:pb-0'} ${isChats ? '-mx-3 md:mx-0' : ''}`}
        >
          {!bottomNavHidden && !isRandom && <SocketStateBanner />}
          {!bottomNavHidden && !isRandom && <GuestLimitBanner />}
          <div className={isChats || isRandom ? 'min-h-0 flex-1' : 'mx-auto w-full max-w-6xl'}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                className={isChats || isRandom ? 'min-h-0 h-full' : ''}
              >
                <Outlet context={{ setBottomNavHidden }} />
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </div>
      {!isChats && <GlobalIncomingCall />}
      <GuestUpgradeModal />
      <ToastProvider />
      {!navHidden && (
        <nav className="safe-bottom premium-nav fixed inset-x-3 bottom-2 z-20 mx-auto max-w-[22rem] rounded-3xl px-2 pt-1 backdrop-blur-sm md:hidden">
          <div className="grid grid-cols-4">
            {tabs.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/app'}
                className={({ isActive }) =>
                  `group relative flex min-h-[2.75rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1 text-xs transition-all duration-200 active:scale-[0.96] ${
                    isActive ? 'text-accent' : 'text-text-faint hover:text-text-secondary'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute top-0.5 h-0.5 w-5 rounded-full bg-accent"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className={`grid h-7 w-7 place-items-center rounded-xl transition-all duration-200 ${isActive ? 'bg-accent text-white shadow-accent-sm' : 'bg-transparent'}`}>
                      <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
                    </span>
                    <span className={`text-[9px] font-semibold leading-none ${isActive ? 'text-accent' : 'text-text-faint'}`}>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </main>
  );
}

function DesktopNav({ locationPath, socketState, clock }) {
  const connected = socketState === 'connected' || socketState === 'reconnected';
  return (
    <aside className="premium-nav hidden min-h-0 rounded-3xl p-2 md:flex md:flex-col">
      <nav className="mt-2 grid gap-2">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = to === '/app' ? locationPath === '/app' : locationPath === to;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/app'}
              title={label}
              aria-label={label}
              className={`group relative flex items-center justify-center rounded-2xl px-3 py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.96] ${
                active ? 'bg-accent-tint text-accent' : 'text-text-faint hover:bg-surface-hover hover:text-text-secondary'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="desktop-nav-pill"
                  className="absolute inset-0 rounded-2xl bg-accent-tint"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  style={{ zIndex: -1 }}
                />
              )}
              <span className={`grid h-9 w-9 place-items-center rounded-2xl transition-all duration-200 ${active ? 'bg-accent text-white shadow-accent-sm' : 'bg-transparent'}`}>
                <Icon size={20} />
              </span>
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center justify-center gap-3 rounded-2xl border border-border-default bg-bg p-3" title={`${connected ? 'Realtime online' : 'Reconnecting'} - ${clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}>
        <span className={`live-dot h-2.5 w-2.5 rounded-full ${connected ? 'bg-success text-success' : 'bg-gold text-gold'}`} />
        <span className="h-1.5 w-6 rounded-full bg-text-faint/30 border border-border-default" />
      </div>
    </aside>
  );
}
