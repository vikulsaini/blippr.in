import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getToken } from './lib/api.js';
import { clearBlipprCache } from './lib/cache.js';

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
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const EditProfile = lazy(() => import('./pages/EditProfile.jsx'));
const Interests = lazy(() => import('./pages/Interests.jsx'));
const PrivacySettings = lazy(() => import('./pages/PrivacySettings.jsx'));
const LocationSettings = lazy(() => import('./pages/LocationSettings.jsx'));

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
          <Route path="profile/edit" element={<EditProfile />} />
          <Route path="profile/interests" element={<Interests />} />
          <Route path="profile/privacy" element={<PrivacySettings />} />
          <Route path="profile/location" element={<LocationSettings />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route
          path="/blippr-control-center-secure-2026"
          element={
            <PrivateRoute>
              <AdminDashboard />
            </PrivateRoute>
          }
        />
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
    <div className="grid h-dvh place-items-center bg-bg px-6 text-center">
      <div>
        <div className="mx-auto h-10 w-10 rounded-2xl border border-border-default bg-accent/10 shadow-glow skeleton" />
        <p className="mt-4 text-sm font-semibold text-text-secondary">Loading Blippr</p>
      </div>
    </div>
  );
}

function useAuthInvalidRedirect() {
  useEffect(() => {
    function handleInvalidAuth() {
      clearBlipprCache();
      if (window.location.pathname !== '/auth') window.location.replace('/auth');
    }

    window.addEventListener('blippr:auth-invalid', handleInvalidAuth);
    return () => window.removeEventListener('blippr:auth-invalid', handleInvalidAuth);
  }, []);
}
