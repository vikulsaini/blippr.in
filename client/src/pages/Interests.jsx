import { useEffect, useState } from 'react';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { showToast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';

export default function Interests() {
  const navigate = useNavigate();
  const { me, setMe } = useOutletContext() || {};
  const [loading, setLoading] = useState(!me);
  const [interestsText, setInterestsText] = useState(me?.interests?.join(', ') || '');

  useEffect(() => {
    if (me) {
      setInterestsText(me.interests?.join(', ') || '');
      setLoading(false);
    }
  }, [me]);

  async function saveInterests(event) {
    if (event) event.preventDefault();
    try {
      const interestsArray = interestsText
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
        
      if (interestsArray.length > 12) {
        showToast('You can add up to 12 interests', 'error');
        return;
      }

      const { user: updated } = await api('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          interests: interestsArray
        })
      });
      setMe?.(updated);
      showToast('Interests saved successfully', 'success');
      navigate('/app/profile');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto bg-bg animate-pulse p-6 mt-12 space-y-6">
        <div className="h-10 w-24 bg-surface rounded skeleton" />
        <div className="h-32 rounded-2xl bg-surface skeleton" />
      </div>
    );
  }

  return (
    <div className="chat-dark-theme mx-auto w-full max-w-lg md:max-w-xl py-6 px-4 bg-bg text-text-primary pb-24 scrollbar-none">
      
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
          <h2 className="text-xl font-black text-white tracking-tight">Hobbies &amp; Interests</h2>
          <p className="text-xs text-text-muted">Interests help Blippr match you with related users</p>
        </div>
      </header>

      <form onSubmit={saveInterests} className="space-y-5">
        <div className="glass-panel rounded-3xl p-5 shadow-card space-y-4">
          <div className="flex items-center gap-2 text-primary px-1">
            <Sparkles size={18} />
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Tell us what you like</h3>
          </div>
          
          <label className="block">
            <span className="text-xs font-bold text-text-muted ml-1">Interests (comma separated)</span>
            <div className="mt-2 bg-[#171f33]/40 border border-white/10 rounded-2xl p-0.5 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/45 transition-all">
              <textarea 
                value={interestsText} 
                onChange={(e) => setInterestsText(e.target.value)} 
                placeholder="e.g. music, coding, gaming, cinema, reading" 
                className="w-full min-h-[120px] bg-transparent border-none focus:ring-0 text-sm font-semibold px-4 py-3 placeholder-white/20 text-white outline-none resize-none scrollbar-none leading-relaxed" 
              />
            </div>
          </label>
          
          <p className="text-[10px] leading-relaxed text-text-muted font-bold ml-1">
            Tip: Use commas to separate interests (e.g. "gaming, rock climbing"). Max 12 tags. Interests are case-insensitive.
          </p>

          {interestsText.split(',').filter(item => item.trim()).length > 0 && (
            <div className="pt-2">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-wider block mb-3 ml-1">Preview Tags:</span>
              <motion.div layout className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {interestsText.split(',').map((item, idx) => {
                    const cleaned = item.trim().toLowerCase();
                    if (!cleaned) return null;
                    return (
                      <motion.span
                        layout
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        key={`${cleaned}-${idx}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary"
                      >
                        {cleaned}
                      </motion.span>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            </div>
          )}
        </div>

        <button 
          type="submit" 
          className="w-full bg-primary hover:brightness-110 text-white font-bold text-sm py-4 rounded-full shadow-glow active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
        >
          <Save size={16} />
          Save Interests
        </button>
      </form>
    </div>
  );
}
