import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowLeft, ShieldAlert } from 'lucide-react';

export default function ReportReceived() {
  const navigate = useNavigate();
  const [transactionId, setTransactionId] = useState('');

  useEffect(() => {
    // Generate a random confirmation ID
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    setTransactionId(`#BLP-${randomNum}-CONF`);
  }, []);

  return (
    <div className="mx-auto w-full max-w-lg min-h-[calc(100vh-6rem)] flex flex-col justify-between px-4 pb-20 relative overflow-hidden text-on-surface flex items-center justify-center">
      {/* Top App Bar */}
      <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 py-4 bg-[#0b1326]/70 backdrop-blur-xl border-b border-outline-variant/20 shadow-xl">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/app')}
            className="p-2 rounded-full hover:bg-white/5 text-primary transition-all active:scale-95 duration-200 flex items-center justify-center"
            aria-label="Back to Home"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-headline-md text-headline-md font-bold text-primary">Report Issue</h1>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="relative z-10 w-full pt-24 pb-12 flex flex-col items-center">
        {/* Confirmation Card */}
        <div className="glass-panel p-8 rounded-xl w-full text-center flex flex-col items-center space-y-6 border border-outline-variant/20 shadow-2xl">
          {/* Icon Container */}
          <div className="relative flex items-center justify-center">
            {/* Outer Glow Orbs */}
            <div className="absolute w-44 h-44 bg-secondary/15 blur-3xl rounded-full animate-pulse"></div>
            <div className="w-32 h-32 rounded-full flex items-center justify-center bg-secondary/10 border-2 border-secondary/30 shadow-[0_0_40px_rgba(78,222,163,0.2)]">
              <CheckCircle2 size={64} className="text-secondary" />
            </div>
          </div>
          
          {/* Text Content */}
          <div className="space-y-2">
            <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">Report Received</h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              Thank you for keeping Blippr safe. Our moderation team will review your report within 24 hours.
            </p>
          </div>
          
          {/* Action Cluster */}
          <div className="w-full flex flex-col gap-3 pt-4">
            <button 
              onClick={() => navigate('/app')}
              className="w-full py-4 bg-primary-container text-white font-label-md text-label-md rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary-container/20"
            >
              Back to Home
            </button>
            <button 
              onClick={() => navigate('/app/legal')}
              className="w-full py-4 glass-panel text-secondary-fixed-dim font-label-md text-label-md rounded-lg hover:bg-white/5 active:scale-[0.98] transition-all border border-secondary-fixed-dim/20"
            >
              View Safety Center
            </button>
          </div>
        </div>

        {/* Secondary Info */}
        <p className="mt-8 font-label-sm text-label-sm text-outline tracking-wider uppercase">
          Transaction ID: {transactionId}
        </p>
      </main>
    </div>
  );
}
