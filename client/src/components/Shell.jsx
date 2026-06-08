import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Shuffle, Search, UserRound } from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';
import GuestLimitBanner from './GuestLimitBanner.jsx';
import GuestUpgradeModal from './GuestUpgradeModal.jsx';
import GlobalIncomingCall from './GlobalIncomingCall.jsx';
import NotificationBell from './NotificationBell.jsx';
import SocketStateBanner from './SocketStateBanner.jsx';
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

    window.addEventListener('varta:socket-state', handleSocketState);
    return () => window.removeEventListener('varta:socket-state', handleSocketState);
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
      className={`app-shell mx-auto grid h-dvh w-full max-w-[90rem] grid-cols-1 overflow-hidden text-white md:grid-cols-[5rem_minmax(0,1fr)] ${isRandom ? 'px-1 pt-1 md:gap-2 md:px-2 md:py-2' : 'px-2 pt-2 md:gap-4 md:px-5 md:py-5'}`}
    >
      <DesktopNav locationPath={location.pathname} socketState={socketState} clock={clock} />
      <div className="flex min-h-0 flex-col overflow-hidden">
        {showMainHeader && (
          <header className="mb-2 flex items-center justify-between rounded-[22px] border border-cyan-200/10 bg-slate-950/28 px-3 py-2 shadow-[0_16px_44px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl md:mb-3 md:px-4 md:py-3">
            <BrandLogo compactTitle />
            <NotificationBell />
          </header>
        )}
        <section
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`flex min-h-0 flex-1 flex-col ${navHidden || isChats || isRandom ? 'overflow-hidden pb-0' : 'overflow-y-auto overscroll-contain pb-24 md:pb-0'} ${isChats ? '-mx-3 md:mx-0' : ''}`}
        >
          {!bottomNavHidden && !isRandom && <SocketStateBanner />}
          {!bottomNavHidden && !isRandom && <GuestLimitBanner />}
          <div className={isChats || isRandom ? 'min-h-0 flex-1' : 'mx-auto w-full max-w-6xl'}>
            <Outlet context={{ setBottomNavHidden }} />
          </div>
        </section>
      </div>
      {!isChats && <GlobalIncomingCall />}
      <GuestUpgradeModal />
      {!navHidden && (
        <nav className="safe-bottom premium-nav fixed inset-x-3 bottom-2 z-20 mx-auto max-w-[22rem] rounded-[24px] border border-white/8 px-2 pt-1 backdrop-blur md:hidden">
          <div className="grid grid-cols-4">
            {tabs.map(({ to, label, icon: Icon }, index) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/app'}
                className={({ isActive }) =>
                  `group relative flex min-h-[2.75rem] flex-col items-center justify-center gap-0.5 rounded-[18px] px-1 py-1 text-xs transition ${
                    isActive ? 'text-white' : 'text-white/42 hover:text-white/78'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`absolute top-0.5 h-0.5 w-5 rounded-full transition ${isActive ? navAccent(index) : 'bg-transparent'}`} />
                    <span className={`grid h-7 w-7 place-items-center rounded-[14px] transition ${isActive ? `${navGlow(index)} scale-105 text-ink` : 'bg-white/6 text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'}`}>
                      <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
                    </span>
                    <span className={`text-[9px] font-semibold leading-none ${isActive ? 'text-white' : 'text-white/36'}`}>{label}</span>
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
    <aside className="premium-nav hidden min-h-0 rounded-[28px] border border-white/8 p-2 md:flex md:flex-col">
      <nav className="mt-2 grid gap-2">
        {tabs.map(({ to, label, icon: Icon }, index) => {
          const active = to === '/app' ? locationPath === '/app' : locationPath === to;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/app'}
              title={label}
              aria-label={label}
              className={`group flex items-center justify-center rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                active ? 'bg-white text-ink' : 'text-white/52 hover:bg-white/8 hover:text-white'
              }`}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-2xl ${active ? navGlow(index) : 'bg-white/7'}`}>
                <Icon size={20} />
              </span>
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-auto grid justify-items-center gap-3 rounded-[22px] border border-cyan-200/10 bg-white/5 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" title={`${connected ? 'Realtime online' : 'Reconnecting'} - ${clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}>
        <span className={`live-dot h-2.5 w-2.5 rounded-full ${connected ? 'bg-mint text-mint' : 'bg-gold text-gold'}`} />
        <span className="h-1.5 w-6 rounded-full bg-white/14" />
      </div>
    </aside>
  );
}

function navAccent(index) {
  return ['bg-mint', 'bg-rose', 'bg-sky', 'bg-gold'][index] || 'bg-mint';
}

function navGlow(index) {
  return [
    'bg-mint shadow-[0_8px_24px_rgba(20,184,166,0.30)]',
    'bg-rose shadow-[0_8px_24px_rgba(255,138,168,0.22)]',
    'bg-sky shadow-[0_8px_24px_rgba(6,182,212,0.26)]',
    'bg-gold shadow-[0_8px_22px_rgba(240,189,72,0.18)]'
  ][index] || 'bg-mint';
}
