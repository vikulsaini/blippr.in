import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getToken } from './lib/api.js';
import { clearVartaCache } from './lib/cache.js';

const Shell = lazy(() => import('./components/Shell.jsx'));
const Auth = lazy(() => import('./pages/Auth.jsx'));
const Chats = lazy(() => import('./pages/Chats.jsx'));
const Stranger = lazy(() => import('./pages/Stranger.jsx'));
const Discover = lazy(() => import('./pages/Discover.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const SettingsPage = lazy(() => import('./pages/Settings.jsx'));
const Landing = lazy(() => import('./pages/Landing.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const Terms = lazy(() => import('./pages/Terms.jsx'));

function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  useAuthInvalidRedirect();

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route
          path="/app"
          element={
            <PrivateRoute>
              <Shell />
            </PrivateRoute>
          }
        >
          <Route index element={<Chats />} />
          <Route path="stranger" element={<Stranger />} />
          <Route path="discover" element={<Discover />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="/stranger" element={<Navigate to="/app/stranger" replace />} />
        <Route path="/discover" element={<Navigate to="/app/discover" replace />} />
        <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
        <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
      </Routes>
    </Suspense>
  );
}

function RouteFallback() {
  return (
    <div className="grid h-dvh place-items-center bg-ink px-6 text-center text-white">
      <div>
        <div className="mx-auto h-10 w-10 animate-pulse rounded-[18px] border border-cyan-200/20 bg-cyan-300/12 shadow-glow" />
        <p className="mt-4 text-sm font-semibold text-slate-200">Loading Varta</p>
      </div>
    </div>
  );
}

function useAuthInvalidRedirect() {
  useEffect(() => {
    function handleInvalidAuth() {
      clearVartaCache();
      if (window.location.pathname !== '/auth') window.location.replace('/auth');
    }

    window.addEventListener('varta:auth-invalid', handleInvalidAuth);
    return () => window.removeEventListener('varta:auth-invalid', handleInvalidAuth);
  }, []);
}
