import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Sparkles, Shield, EyeOff, Bolt, Palette, Video } from 'lucide-react';
import { showToast } from '../components/Toast.jsx';

export default function ProUpgrade() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState('yearly'); // 'monthly' or 'yearly'

  const features = [
    { 
      icon: EyeOff, 
      color: 'bg-primary/20 text-primary', 
      title: 'No Ads', 
      desc: 'Pure interaction, zero interruptions.' 
    },
    { 
      icon: Bolt, 
      color: 'bg-secondary/20 text-secondary', 
      title: 'Priority Matchmaking', 
      desc: 'Jump the queue and meet people faster.' 
    },
    { 
      icon: Palette, 
      color: 'bg-success/20 text-success', 
      title: 'Exclusive Themes', 
      desc: 'Unique chat skins and profile glows.' 
    },
    { 
      icon: Video, 
      color: 'bg-danger/20 text-danger', 
      title: 'Unlimited Video Calls', 
      desc: 'Talk as long as you want, any time.' 
    }
  ];

  function handleUpgrade() {
    navigate('/app/checkout', { state: { plan: selectedPlan } });
  }

  return (
    <div className="mx-auto w-full max-w-lg py-6 px-4 bg-bg text-text-primary pb-32 scrollbar-none min-h-screen">
      
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
          <h2 className="text-xl font-black text-white tracking-tight">Blippr Pro</h2>
          <p className="text-xs text-text-muted">Unlock exclusive premium features</p>
        </div>
      </header>

      {/* Hero Visual Section */}
      <section className="relative overflow-hidden rounded-3xl h-56 flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/5 border border-white/5 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-2.5">
          <div className="bg-primary text-white px-5 py-1.5 rounded-full font-black tracking-widest text-xs shadow-glow animate-pulse">
            PRO
          </div>
          <h1 className="text-2xl font-black text-center text-white leading-tight">
            Elevate Your<br />
            <span className="text-secondary">Social Game</span>
          </h1>
        </div>
      </section>

      {/* Features Grid */}
      <section className="space-y-4 mb-8">
        <h3 className="text-xs font-black uppercase tracking-widest text-text-secondary px-1">Exclusive Features</h3>
        <div className="grid grid-cols-1 gap-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={i} className="glass-panel p-4 rounded-2xl flex items-center gap-4 hover:bg-white/5 transition-colors group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${feature.color} group-hover:scale-105 transition-transform`}>
                  <Icon size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm text-white">{feature.title}</p>
                  <p className="text-xs text-text-muted mt-0.5">{feature.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="space-y-4 mb-12">
        <h3 className="text-xs font-black uppercase tracking-widest text-text-secondary px-1">Choose Your Plan</h3>
        <div className="flex flex-col gap-4">
          
          {/* Monthly Plan */}
          <div 
            onClick={() => setSelectedPlan('monthly')}
            className={`glass-panel p-5 rounded-3xl flex justify-between items-center cursor-pointer transition-all border ${selectedPlan === 'monthly' ? 'border-primary/50 bg-primary/5' : 'border-white/5'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedPlan === 'monthly' ? 'border-primary' : 'border-white/20'}`}>
                {selectedPlan === 'monthly' && <div className="w-3 h-3 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="font-bold text-sm text-white">Monthly</p>
                <p className="text-xs text-text-muted mt-0.5">Billed every 30 days</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-base font-black text-primary">$9.99</p>
              <p className="text-[10px] text-text-muted">USD / mo</p>
            </div>
          </div>

          {/* Yearly Plan (Best Value) */}
          <div 
            onClick={() => setSelectedPlan('yearly')}
            className={`relative glass-panel p-5 rounded-3xl flex justify-between items-center cursor-pointer transition-all border ${selectedPlan === 'yearly' ? 'border-primary/50 bg-primary/5 shadow-[0_10px_30px_rgba(124,58,237,0.1)]' : 'border-white/5'}`}
          >
            <div className="absolute -top-3 right-6 bg-secondary text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
              Best Value
            </div>
            <div className="flex items-center gap-4">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedPlan === 'yearly' ? 'border-primary' : 'border-white/20'}`}>
                {selectedPlan === 'yearly' && <div className="w-3 h-3 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="font-bold text-sm text-white">Yearly</p>
                <p className="text-xs text-secondary mt-0.5">Save 40% annually</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-base font-black text-primary">$69.99</p>
              <p className="text-[10px] text-text-muted">$5.83 / mo</p>
            </div>
          </div>

        </div>
      </section>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 w-full z-50 bg-[#0b1326]/80 backdrop-blur-lg border-t border-white/5 px-6 py-5 shadow-elevated">
        <div className="max-w-lg mx-auto">
          <button 
            onClick={handleUpgrade}
            className="w-full bg-primary hover:bg-accent-hover text-white py-4 rounded-full font-black text-sm shadow-glow active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
          >
            <span>Upgrade Now</span>
            <ArrowLeft size={16} className="rotate-180 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-center mt-3 text-[10px] text-text-muted leading-relaxed">
            By upgrading, you agree to our Terms of Service. Your subscription will auto-renew. Cancel anytime in settings.
          </p>
        </div>
      </div>

    </div>
  );
}
