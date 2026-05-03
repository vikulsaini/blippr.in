import { Navigate, Route, Routes } from 'react-router-dom';
import Shell from './components/Shell.jsx';
import Auth from './pages/Auth.jsx';
import Chats from './pages/Chats.jsx';
import Stranger from './pages/Stranger.jsx';
import Discover from './pages/Discover.jsx';
import Profile from './pages/Profile.jsx';
import { getToken } from './lib/api.js';

function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/"
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
    </Routes>
  );
}
