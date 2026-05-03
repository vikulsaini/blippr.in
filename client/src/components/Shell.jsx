import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { MessageCircle, Shuffle, Search, UserRound } from 'lucide-react';
import NotificationBell from './NotificationBell.jsx';
import { refreshPushSubscriptionIfAllowed } from '../lib/notifications.js';

const tabs = [
  { to: '/', label: 'Chats', icon: MessageCircle },
  { to: '/stranger', label: 'Match', icon: Shuffle },
  { to: '/discover', label: 'Find', icon: Search },
  { to: '/profile', label: 'Me', icon: UserRound }
];

export default function Shell() {
  const location = useLocation();
  const isChats = location.pathname === '/';
  const [bottomNavHidden, setBottomNavHidden] = useState(false);
  const showHeader = !bottomNavHidden;

  useEffect(() => {
    refreshPushSubscriptionIfAllowed().catch(() => {});
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-4 text-white">
      <header className={`${showHeader ? 'mb-3 flex' : 'sr-only'} items-center justify-between`}>
        <div>
          <h1 className="text-[1.7rem] font-semibold tracking-normal">Varta</h1>
        </div>
        <NotificationBell />
      </header>
      <section className={`min-h-0 flex-1 ${bottomNavHidden ? 'pb-0' : 'pb-24'} ${isChats ? '-mx-4' : ''}`}>
        <Outlet context={{ setBottomNavHidden }} />
      </section>
      {!bottomNavHidden && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-white/8 bg-ink/95 px-5 pt-1.5 backdrop-blur">
          <div className="grid grid-cols-4">
            {tabs.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
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
