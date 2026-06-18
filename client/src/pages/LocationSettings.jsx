import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';

export default function LocationSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function load() {
      const { user: currentUser } = await api('/api/users/me');
      setUser(currentUser);
      setLoading(false);
    }
    load().catch((err) => {
      showToast(err.message, 'error');
      setLoading(false);
    });
  }, []);

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
    <div className="mx-auto w-full max-w-lg md:max-w-xl py-6 px-4 bg-bg text-text-primary pb-24">
      {/* Header */}
      <header className="flex items-center gap-3.5 mb-6">
        <button 
          onClick={() => navigate('/app/profile')} 
          className="btn-icon h-10 w-10 flex items-center justify-center rounded-full hover:bg-surface-hover transition active:scale-95" 
          aria-label="Back to profile"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Matchmaking location</h2>
          <p className="text-xs text-text-muted">Proximity matching coordinates settings</p>
        </div>
      </header>

      <div className="space-y-5">
        <div className="surface-card rounded-[22px] border border-border-default bg-surface p-5 shadow-card text-center space-y-5 relative overflow-hidden">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
            <MapPin size={24} className={refreshing ? 'animate-bounce' : ''} />
          </div>
          
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-text-primary">
              {locationShared ? 'Location Shared Successfully' : 'Location Not Shared'}
            </h3>
            <p className="text-xs text-text-muted font-medium max-w-xs mx-auto leading-relaxed">
              {locationShared 
                ? `Last updated: ${new Date(user.location.updatedAt).toLocaleDateString()} at ${new Date(user.location.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
                : 'Blippr matches you with online users nearby if location is shared. Share location coordinates from your browser.'}
            </p>
          </div>

          {locationShared && user?.location?.coordinates && (
            <div className="text-[10px] text-text-faint font-extrabold bg-bg py-2 px-3 rounded-xl w-fit mx-auto border border-border-default">
              LAT: {user.location.coordinates[1]?.toFixed(4)} · LNG: {user.location.coordinates[0]?.toFixed(4)}
            </div>
          )}
        </div>

        <button 
          type="button" 
          onClick={refreshLocation}
          disabled={refreshing}
          className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-bold shadow-accent-sm hover:opacity-95 transition-all duration-200 disabled:opacity-75"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Retrieving coordinates...' : 'Refresh Location'}
        </button>
      </div>
    </div>
  );
}
