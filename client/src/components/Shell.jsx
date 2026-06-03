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
  { to: '/app/stranger', label: 'Match', icon: Shuffle },
  { to: '/app/discover', label: 'Find', icon: Search },
  { to: '/app/profile', label: 'Me', icon: UserRound }
];

export default function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isChats = location.pathname === '/app';
  const isConversation = isChats && new URLSearchParams(location.search).has('chat');
  const [bottomNavHidden, setBottomNavHidden] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [socketState, setSocketState] = useState('connected');
  const [clock, setClock] = useState(() => new Date());
  const navHidden = bottomNavHidden || keyboardOpen;
  const showHeader = !bottomNavHidden;
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
    <main className="app-shell mx-auto grid h-dvh w-full max-w-[90rem] grid-cols-1 overflow-hidden px-3 pt-3 text-white md:grid-cols-[5rem_minmax(0,1fr)] md:gap-4 md:px-5 md:py-5 xl:grid-cols-[16rem_minmax(0,1fr)]">
      <DesktopNav locationPath={location.pathname} socketState={socketState} clock={clock} />
      <div className="flex min-h-0 flex-col overflow-hidden">
        <header className={`${showHeader ? 'mb-3 flex' : 'sr-only md:not-sr-only md:mb-3 md:flex'} items-center justify-between rounded-[24px] md:border md:border-white/8 md:bg-white/5 md:px-4 md:py-3`}>
          <BrandLogo />
          <NotificationBell />
        </header>
        <section
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`min-h-0 flex-1 ${navHidden || isChats ? 'overflow-hidden pb-0' : 'overflow-y-auto overscroll-contain pb-24 md:pb-0'} ${isChats ? '-mx-3 md:mx-0' : ''}`}
        >
          {!bottomNavHidden && <SocketStateBanner />}
          {!bottomNavHidden && <GuestLimitBanner />}
          <div className={!isChats ? 'mx-auto w-full max-w-6xl' : 'h-full'}>
            <Outlet context={{ setBottomNavHidden }} />
          </div>
        </section>
      </div>
      {!isChats && <GlobalIncomingCall />}
      <GuestUpgradeModal />
      {!navHidden && (
        <nav className="safe-bottom premium-nav fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-white/8 px-5 pt-1.5 backdrop-blur md:hidden">
          <div className="grid grid-cols-4">
            {tabs.map(({ to, label, icon: Icon }, index) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/app'}
                className={({ isActive }) =>
                  `group relative flex min-h-[3rem] flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-xs transition ${
                    isActive ? 'text-white' : 'text-white/42 hover:text-white/78'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`absolute top-0 h-0.5 w-5 rounded-full transition ${isActive ? navAccent(index) : 'bg-transparent'}`} />
                    <span className={`grid h-8 w-8 place-items-center rounded-2xl transition ${isActive ? `${navGlow(index)} text-ink` : ''}`}>
                      <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                    </span>
                    <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-white/42'}`}>{label}</span>
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
    <aside className="premium-nav hidden min-h-0 rounded-[28px] border border-white/8 p-2 md:flex md:flex-col xl:p-3">
      <div className="hidden px-3 py-3 xl:block">
        <BrandLogo />
        <p className="mt-2 text-xs leading-5 text-white/42">Realtime chats, matches, calls, and safety controls.</p>
      </div>
      <nav className="mt-2 grid gap-2">
        {tabs.map(({ to, label, icon: Icon }, index) => {
          const active = to === '/app' ? locationPath === '/app' : locationPath === to;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/app'}
              className={`group flex items-center justify-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition xl:justify-start ${
                active ? 'bg-white text-ink' : 'text-white/52 hover:bg-white/8 hover:text-white'
              }`}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-2xl ${active ? navGlow(index) : 'bg-white/7'}`}>
                <Icon size={20} />
              </span>
              <span className="hidden xl:inline">{label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-auto hidden space-y-3 rounded-[22px] border border-white/8 bg-white/5 p-3 xl:block">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/38">System</span>
          <span className={`live-dot h-2.5 w-2.5 rounded-full ${connected ? 'bg-mint text-mint' : 'bg-gold text-gold'}`} />
        </div>
        <div>
          <p className="text-sm font-semibold">{connected ? 'Realtime online' : 'Reconnecting'}</p>
          <p className="mt-1 text-xs text-white/45">{clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {['chat', 'match', 'call'].map((item, index) => (
            <span key={item} className={`h-1.5 rounded-full ${connected ? navAccent(index) : 'bg-white/14'}`} />
          ))}
        </div>
      </div>
    </aside>
  );
}

function navAccent(index) {
  return ['bg-mint', 'bg-rose', 'bg-sky', 'bg-gold'][index] || 'bg-mint';
}

function navGlow(index) {
  return [
    'bg-mint shadow-[0_8px_22px_rgba(61,214,198,0.22)]',
    'bg-rose shadow-[0_8px_22px_rgba(255,138,168,0.20)]',
    'bg-sky shadow-[0_8px_22px_rgba(98,168,255,0.20)]',
    'bg-gold shadow-[0_8px_22px_rgba(240,189,72,0.18)]'
  ][index] || 'bg-mint';
}
