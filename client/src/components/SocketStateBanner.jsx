import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function SocketStateBanner() {
  const [state, setState] = useState('');

  useEffect(() => {
    function handleState(event) {
      const nextState = event.detail?.state || '';
      setState(nextState);
      if (nextState === 'connected' || nextState === 'reconnected') {
        window.setTimeout(() => setState(''), nextState === 'reconnected' ? 1800 : 500);
      }
    }

    window.addEventListener('blippr:socket-state', handleState);
    return () => window.removeEventListener('blippr:socket-state', handleState);
  }, []);

  if (!state || state === 'connected') return null;

  const reconnected = state === 'reconnected';
  return (
    <div className={`mb-3 flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm ${reconnected ? 'border-mint/20 bg-mint/10 text-mint' : 'border-white/10 bg-white/7 text-white/65'}`}>
      {reconnected ? <Wifi size={16} /> : <WifiOff size={16} />}
      <span>{reconnected ? 'Reconnected' : 'Connecting...'}</span>
    </div>
  );
}
