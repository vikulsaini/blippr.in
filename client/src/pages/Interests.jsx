import { useEffect, useState } from 'react';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';

export default function Interests() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [interestsText, setInterestsText] = useState('');

  useEffect(() => {
    async function load() {
      const { user } = await api('/api/users/me');
      setInterestsText(user.interests?.join(', ') || '');
      setLoading(false);
    }
    load().catch((err) => {
      showToast(err.message, 'error');
      setLoading(false);
    });
  }, []);

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

      await api('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          interests: interestsArray
        })
      });
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
          <h2 className="text-xl font-bold text-text-primary">Hobbies & interests</h2>
          <p className="text-xs text-text-muted">Interests help Blippr match you with related users</p>
        </div>
      </header>

      <form onSubmit={saveInterests} className="space-y-5">
        <div className="surface-card rounded-[22px] border border-border-default bg-surface p-5 shadow-card space-y-4">
          <div className="flex items-center gap-2.5 text-accent">
            <Sparkles size={18} />
            <h3 className="text-xs font-bold text-text-primary">Tell us what you like</h3>
          </div>
          
          <label className="block">
            <span className="text-xs font-bold text-text-muted">Interests (comma separated)</span>
            <textarea 
              value={interestsText} 
              onChange={(e) => setInterestsText(e.target.value)} 
              placeholder="e.g. music, coding, gaming, cinema, reading" 
              className="mt-2.5 min-h-[120px] w-full resize-none rounded-xl border border-border-default bg-bg px-4 py-3 text-xs outline-none text-text-primary placeholder:text-text-faint focus:border-accent transition-colors font-semibold leading-relaxed" 
            />
          </label>
          
          <p className="text-[10px] leading-relaxed text-text-muted font-semibold">
            Tip: Use commas to separate interests (e.g. "gaming, rock climbing"). Max 12 tags. Interests are case-insensitive.
          </p>

          {interestsText.split(',').filter(item => item.trim()).length > 0 && (
            <div className="pt-2">
              <span className="text-[10px] font-bold text-text-muted block mb-2">Preview Tags:</span>
              <div className="flex flex-wrap gap-1.5">
                {interestsText.split(',').map((item, idx) => {
                  const cleaned = item.trim().toLowerCase();
                  if (!cleaned) return null;
                  return (
                    <span key={idx} className="inline-flex items-center gap-1 rounded-lg border border-accent/20 bg-accent/5 px-2.5 py-1 text-[10px] font-bold text-accent">
                      {cleaned}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button 
          type="submit" 
          className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-bold shadow-accent-sm hover:opacity-95 transition-all duration-200"
        >
          <Save size={16} />
          Save Interests
        </button>
      </form>
    </div>
  );
}
