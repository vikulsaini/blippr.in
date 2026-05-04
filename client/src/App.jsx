import { Navigate, Route, Routes } from 'react-router-dom';
import Shell from './components/Shell.jsx';
import Auth from './pages/Auth.jsx';
import Chats from './pages/Chats.jsx';
import Stranger from './pages/Stranger.jsx';
import Discover from './pages/Discover.jsx';
import Profile from './pages/Profile.jsx';
import Landing from './pages/Landing.jsx';
import Privacy from './pages/Privacy.jsx';
import { getToken } from './lib/api.js';

function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/privacy" element={<Privacy />} />
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
      </Route>
      <Route path="/stranger" element={<Navigate to="/app/stranger" replace />} />
      <Route path="/discover" element={<Navigate to="/app/discover" replace />} />
      <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
    </Routes>
  );
}
