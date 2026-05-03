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
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-3">
          <div className="surface grid grid-cols-4 rounded-[22px] p-1.5 shadow-glow">
            {tabs.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `group relative flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-[17px] px-2 py-2 text-xs transition ${
                    isActive ? 'bg-white text-ink' : 'text-white/52 hover:bg-white/8 hover:text-white'
                  }`
                }
              >
                <Icon size={20} strokeWidth={2.3} />
                <span className="text-[11px] font-medium">{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </main>
  );
}
