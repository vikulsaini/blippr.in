import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CreditCard, ShieldAlert, ShieldCheck, Lock, Landmark } from 'lucide-react';
import { showToast } from '../components/Toast.jsx';

export default function Checkout() {
  const navigate = useNavigate();
  const locationState = useLocation().state || {};
  const selectedPlan = locationState.plan || 'yearly';

  const [paymentMethod, setPaymentMethod] = useState('card'); // 'card' | 'apple' | 'google'
  const [form, setForm] = useState({ number: '', expiry: '', cvv: '' });
  const [paying, setPaying] = useState(false);

  const priceLabel = selectedPlan === 'yearly' ? '$69.99/yr' : '$9.99/mo';
  const saveLabel = selectedPlan === 'yearly' ? 'Save 40%' : 'Standard Rate';

  function handlePayment(e) {
    e.preventDefault();
    if (paymentMethod === 'card' && (!form.number || !form.expiry || !form.cvv)) {
      showToast('Please fill out all card details', 'error');
      return;
    }
    setPaying(true);
    showToast('Processing secure transaction...', 'info');
    setTimeout(() => {
      setPaying(false);
      showToast('Congratulations! Blippr Pro activated.', 'success');
      navigate('/app/profile');
    }, 2000);
  }

  return (
    <div className="mx-auto w-full max-w-lg py-6 px-4 bg-bg text-text-primary pb-24 scrollbar-none min-h-screen">
      
      {/* Header */}
      <header className="flex items-center gap-3.5 mb-8">
        <button 
          onClick={() => navigate('/app/pro')} 
          className="text-primary hover:opacity-80 p-2 -ml-2 rounded-full transition active:scale-95" 
          aria-label="Back to upgrade"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Checkout</h2>
          <p className="text-xs text-text-muted">Complete your premium subscription</p>
        </div>
      </header>

      {/* Order Summary Card */}
      <section className="glass-panel rounded-2xl p-5 mb-5 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div>
            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Current Selection</p>
            <h2 className="text-lg font-black text-white capitalize">{selectedPlan} Pro</h2>
          </div>
          <div className="text-right">
            <p className="text-base font-black text-secondary">{priceLabel}</p>
            <p className="text-[10px] font-bold text-secondary/70 mt-0.5">{saveLabel}</p>
          </div>
        </div>
        <div className="flex gap-2.5 items-center text-text-secondary text-xs font-semibold relative z-10">
          <CheckCircle2 size={16} className="text-secondary shrink-0" />
          <span>Unlimited messaging &amp; global discovery</span>
        </div>
      </section>

      {/* Payment Method Selection */}
      <section className="mb-5">
        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-3 ml-1">Payment Method</p>
        <div className="grid grid-cols-3 gap-3">
          
          <button 
            type="button"
            onClick={() => setPaymentMethod('card')}
            className={`glass-panel p-4 rounded-2xl flex flex-col items-center gap-2 transition-all border ${paymentMethod === 'card' ? 'ring-2 ring-secondary border-transparent' : 'border-white/5'}`}
          >
            <CreditCard size={20} className="text-secondary" />
            <span className="text-[9px] font-black uppercase text-white tracking-wider">Card</span>
          </button>

          <button 
            type="button"
            onClick={() => setPaymentMethod('apple')}
            className={`glass-panel p-4 rounded-2xl flex flex-col items-center gap-2 transition-all border ${paymentMethod === 'apple' ? 'ring-2 ring-secondary border-transparent' : 'border-white/5'}`}
          >
            <div className="text-sm font-black text-primary">Apple</div>
            <span className="text-[9px] font-black uppercase text-white tracking-wider">Pay</span>
          </button>

          <button 
            type="button"
            onClick={() => setPaymentMethod('google')}
            className={`glass-panel p-4 rounded-2xl flex flex-col items-center gap-2 transition-all border ${paymentMethod === 'google' ? 'ring-2 ring-secondary border-transparent' : 'border-white/5'}`}
          >
            <div className="text-sm font-black text-tertiary-fixed-dim text-[#4edea3]">Google</div>
            <span className="text-[9px] font-black uppercase text-white tracking-wider">Pay</span>
          </button>

        </div>
      </section>

      {/* Card Details Form */}
      {paymentMethod === 'card' ? (
        <section className="glass-panel rounded-3xl p-6 mb-8 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-12 -mt-12" />
          <form onSubmit={handlePayment} className="space-y-5 relative z-10">
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-text-muted ml-1">Card Number</label>
              <div className="bg-[#171f33]/40 border border-white/10 rounded-2xl p-0.5 focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent/45 transition-all flex items-center">
                <input 
                  type="text"
                  value={form.number} 
                  onChange={(e) => setForm(c => ({ ...c, number: e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim().slice(0, 19) }))} 
                  placeholder="0000 0000 0000 0000" 
                  className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold px-4 py-3 placeholder-white/20 text-white outline-none"
                />
                <CreditCard size={18} className="text-text-muted/40 mr-4" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-muted ml-1">Expiry Date</label>
                <div className="bg-[#171f33]/40 border border-white/10 rounded-2xl p-0.5 focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent/45 transition-all">
                  <input 
                    type="text"
                    value={form.expiry} 
                    onChange={(e) => setForm(c => ({ ...c, expiry: e.target.value.replace(/\D/g, '').replace(/(\d{2})(\d{1,2})/, '$1/$2').slice(0, 5) }))} 
                    placeholder="MM/YY" 
                    className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold px-4 py-3 placeholder-white/20 text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-muted ml-1">CVV</label>
                <div className="bg-[#171f33]/40 border border-white/10 rounded-2xl p-0.5 focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent/45 transition-all">
                  <input 
                    type="password"
                    value={form.cvv} 
                    onChange={(e) => setForm(c => ({ ...c, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) }))} 
                    placeholder="***" 
                    className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold px-4 py-3 placeholder-white/20 text-white outline-none"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={paying}
              className="w-full bg-primary hover:bg-accent-hover text-white py-4 rounded-full font-black text-sm shadow-glow active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
            >
              <Lock size={16} />
              <span>{paying ? 'Processing...' : 'Secure Payment'}</span>
            </button>

          </form>
        </section>
      ) : (
        /* Alternative Express Payment CTA */
        <section className="glass-panel rounded-3xl p-6 mb-8 border border-white/10 text-center space-y-4">
          <p className="text-xs font-bold text-text-secondary leading-relaxed">
            Click below to complete the subscription using express billing.
          </p>
          <button 
            type="button" 
            disabled={paying}
            onClick={handlePayment}
            className="w-full bg-white text-black py-4 rounded-full font-black text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span>{paying ? 'Authorizing...' : `Pay ${priceLabel} with ${paymentMethod === 'apple' ? 'Apple Pay' : 'Google Pay'}`}</span>
          </button>
        </section>
      )}

      {/* Trust Footer */}
      <footer className="text-center space-y-4 pt-4">
        <div className="flex items-center justify-center gap-2 text-secondary/80">
          <ShieldCheck size={16} />
          <p className="text-[10px] font-black uppercase tracking-wider">Encrypted Transaction</p>
        </div>
        <p className="text-text-muted text-[11px] leading-relaxed px-6">
          Your payment information is processed securely. You can cancel your subscription anytime in the account settings without hidden fees.
        </p>
        <div className="flex justify-center gap-6 pt-4 text-text-muted/40">
          <Landmark size={24} />
          <ShieldAlert size={24} />
        </div>
      </footer>

    </div>
  );
}
