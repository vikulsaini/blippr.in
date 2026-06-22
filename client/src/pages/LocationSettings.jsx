import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, RefreshCw } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { showToast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';

export default function LocationSettings() {
  const navigate = useNavigate();
  const { me, setMe } = useOutletContext() || {};
  const [loading, setLoading] = useState(!me);
  const [user, setUser] = useState(me);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (me) {
      setUser(me);
      setLoading(false);
    }
  }, [me]);

  async function refreshLocation() {
    if (!navigator.geolocation) {
      showToast('Location is not supported in this browser', 'error');
      return;
    }

    setRefreshing(true);
    showToast('Refreshing location coordinates...', 'info');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { user: updated } = await api('/api/users/me/location', {
            method: 'PATCH',
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            })
          });
          setUser(updated);
          setMe?.(updated);
          showToast('Location updated for random rooms', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          setRefreshing(false);
        }
      },
      () => {
        showToast('Location permission was denied', 'error');
        setRefreshing(false);
      }
    );
  }

  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto bg-bg animate-pulse p-6 mt-12 space-y-6">
        <div className="h-10 w-24 bg-surface rounded skeleton" />
        <div className="h-32 rounded-2xl bg-surface skeleton" />
      </div>
    );
  }

  const locationShared = !!user?.location?.updatedAt;

  return (
    <div className="mx-auto w-full max-w-lg md:max-w-xl py-6 px-4 bg-bg text-text-primary pb-24 scrollbar-none">
      
      {/* Header */}
      <header className="flex items-center gap-3.5 mb-8">
        <button 
          onClick={() => navigate('/app/profile')} 
          className="text-primary hover:opacity-80 p-2 -ml-2 rounded-full transition active:scale-95" 
          aria-label="Back to profile"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Matchmaking Location</h2>
          <p className="text-xs text-text-muted">Proximity matching coordinates settings</p>
        </div>
      </header>

      <div className="space-y-5">
        <div className="glass-panel rounded-3xl p-6 shadow-card text-center space-y-5 relative overflow-hidden">
          {/* Ambient inner glow */}
          <div className="absolute -right-10 -top-10 w-24 h-24 bg-primary/10 blur-2xl rounded-full pointer-events-none" />
          
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <MapPin size={26} className={refreshing ? 'animate-bounce' : ''} />
          </div>
          
          <div className="space-y-1">
            <h3 className="text-sm font-black text-white">
              {locationShared ? 'Location Shared Successfully' : 'Location Not Shared'}
            </h3>
            <p className="text-xs text-text-muted font-medium max-w-xs mx-auto leading-relaxed mt-1">
              {locationShared 
                ? `Last updated: ${new Date(user.location.updatedAt).toLocaleDateString()} at ${new Date(user.location.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
                : 'Blippr matches you with online users nearby if location is shared. Share location coordinates from your browser.'}
            </p>
          </div>

          {locationShared && user?.location?.coordinates && (
            <div className="text-[10px] text-primary font-extrabold bg-primary/10 py-2.5 px-3.5 rounded-xl w-fit mx-auto border border-primary/20">
              LAT: {user.location.coordinates[1]?.toFixed(4)} · LNG: {user.location.coordinates[0]?.toFixed(4)}
            </div>
          )}
        </div>

        <button 
          type="button" 
          onClick={refreshLocation}
          disabled={refreshing}
          className="w-full bg-primary hover:brightness-110 text-white font-bold text-sm py-4 rounded-full shadow-glow active:scale-95 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Retrieving coordinates...' : 'Refresh Location'}
        </button>
      </div>
    </div>
  );
}
