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
      setMessage('Varta is installed');
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
      setMessage('Varta is already installed');
      return;
    }

    if (!installPrompt) {
      setMessage('Open browser menu and choose Install app or Add to home screen.');
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setMessage(choice.outcome === 'accepted' ? 'Installing Varta...' : 'Install cancelled');
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/8 p-3">
      <button type="button" onClick={installApp} className="flex w-full items-center gap-3 text-left">
        <span className="rounded-2xl bg-mint/15 p-3 text-mint">
          {installed ? <Smartphone size={18} /> : <Download size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{installed ? 'Varta installed' : 'Install Varta'}</span>
          <span className="block truncate text-xs text-white/45">Download from browser like an app</span>
        </span>
        <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-ink">{installed ? 'Done' : 'Install'}</span>
      </button>
      {message && <p className="mt-3 rounded-2xl bg-ink/30 px-3 py-2 text-xs text-white/55">{message}</p>}
    </div>
  );
}
