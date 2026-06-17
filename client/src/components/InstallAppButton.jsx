import { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
}

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [message, setMessage] = useState('');

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
      setMessage('');
    }

    function handleInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      setMessage('Blippr is installed');
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function installApp() {
    if (installed) {
      setMessage('Blippr is already installed');
      return;
    }

    if (!installPrompt) {
      setMessage('Open browser menu and choose Install app or Add to home screen.');
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setMessage(choice.outcome === 'accepted' ? 'Installing Blippr...' : 'Install cancelled');
  }

  return (
    <div className="surface-card rounded-3xl border border-slate-200 bg-white p-3">
      <button type="button" onClick={installApp} className="flex w-full items-center gap-3 text-left">
        <span className="rounded-2xl bg-accent-tint p-3 text-accent">
          {installed ? <Smartphone size={18} /> : <Download size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-text-primary">{installed ? 'Blippr installed' : 'Install Blippr'}</span>
          <span className="block truncate text-xs text-text-muted">Download from browser like an app</span>
        </span>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">{installed ? 'Done' : 'Install'}</span>
      </button>
      {message && <p className="mt-3 rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-text-secondary">{message}</p>}
    </div>
  );
}
