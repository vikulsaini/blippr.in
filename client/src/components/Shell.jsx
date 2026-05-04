import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Shuffle, Search, UserRound } from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';
import GlobalIncomingCall from './GlobalIncomingCall.jsx';
import NotificationBell from './NotificationBell.jsx';
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
  const [bottomNavHidden, setBottomNavHidden] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const navHidden = bottomNavHidden || keyboardOpen;
  const showHeader = !bottomNavHidden;
  const touchStartRef = useRef(null);

  useEffect(() => {
    refreshPushSubscriptionIfAllowed().catch(() => {});
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
    <main className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden px-4 pt-4 text-white">
      <header className={`${showHeader ? 'mb-3 flex' : 'sr-only'} items-center justify-between`}>
        <BrandLogo />
        <NotificationBell />
      </header>
      <section
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`min-h-0 flex-1 ${navHidden || isChats ? 'overflow-hidden pb-0' : 'overflow-y-auto overscroll-contain pb-24'} ${isChats ? '-mx-4' : ''}`}
      >
        <Outlet context={{ setBottomNavHidden }} />
      </section>
      {!isChats && <GlobalIncomingCall />}
      {!navHidden && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-white/8 bg-ink/95 px-5 pt-1.5 backdrop-blur">
          <div className="grid grid-cols-4">
            {tabs.map(({ to, label, icon: Icon }) => (
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
                    <span className={`absolute top-0 h-0.5 w-5 rounded-full transition ${isActive ? 'bg-mint' : 'bg-transparent'}`} />
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
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
