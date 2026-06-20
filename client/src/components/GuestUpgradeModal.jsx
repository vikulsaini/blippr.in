import { useEffect, useState } from 'react';
import { LockKeyhole, Mail, Save } from 'lucide-react';
import { api, setToken } from '../lib/api.js';
import { motion, AnimatePresence } from 'framer-motion';
import { modalOverlay, modalContent } from '../lib/motion.js';

export default function GuestUpgradeModal({ me }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    dob: '',
    contact: '',
    gender: 'female',
    bio: '',
    hobbies: ''
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('blippr:guest-expired', show);
    if (me?.isGuest && me.guestExpiresAt && new Date(me.guestExpiresAt).getTime() < Date.now()) {
      setOpen(true);
    }
    return () => window.removeEventListener('blippr:guest-expired', show);
  }, [me]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function ageFromDob(dob) {
    if (!dob) return 18;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const month = today.getMonth() - birth.getMonth();
    if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
    return Math.max(18, age);
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const { token } = await api('/api/auth/guest/upgrade', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          dob: form.dob || undefined,
          age: ageFromDob(form.dob),
          contact: form.contact,
          gender: form.gender,
          bio: form.bio,
          interests: form.hobbies.split(',').map((item) => item.trim()).filter(Boolean)
        })
      });
      setToken(token);
      localStorage.removeItem('blippr_is_guest');
      setOpen(false);
      window.location.reload();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={modalOverlay}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[100] grid place-items-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.form
            onSubmit={submit}
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-[32px] bg-surface-glass backdrop-blur-md p-6 shadow-elevated border border-white/10 scrollbar-none"
          >
            <div className="flex items-center gap-3.5 mb-5">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary shrink-0">
                <LockKeyhole size={21} />
              </span>
              <div>
                <h2 className="text-lg font-black text-white leading-tight">Create account to continue</h2>
                <p className="text-xs text-text-muted mt-0.5">Guest access is limited. Register to unlock full Blippr.</p>
              </div>
            </div>

            <div className="space-y-4">
              <Field label="Full Name" value={form.name} onChange={(value) => update('name', value)} />
              
              <Field label="Email Address" value={form.email} onChange={(value) => update('email', value)} type="email" icon={Mail} />
              
              <Field label="Password" value={form.password} onChange={(value) => update('password', value)} type="password" />
              
              <div className="grid grid-cols-2 gap-4">
                <Field label="Date of Birth" value={form.dob} onChange={(value) => update('dob', value)} type="date" />
                <Field label="Contact" value={form.contact} onChange={(value) => update('contact', value)} />
              </div>

              <div>
                <span className="text-xs text-text-muted font-bold ml-1">Gender</span>
                <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-[#171f33]/40 p-1 text-xs">
                  {['female', 'male'].map((gender) => (
                    <button 
                      key={gender} 
                      type="button" 
                      onClick={() => update('gender', gender)} 
                      className={`rounded-xl py-2.5 font-bold capitalize cursor-pointer transition-all duration-200 ${form.gender === gender ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Hobbies (comma separated)" value={form.hobbies} onChange={(value) => update('hobbies', value)} />

              <label className="block">
                <span className="text-xs text-text-muted font-bold ml-1">Short Bio</span>
                <div className="mt-1.5 bg-[#171f33]/40 border border-white/10 rounded-2xl p-0.5 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/45 transition-all">
                  <textarea 
                    value={form.bio} 
                    onChange={(event) => update('bio', event.target.value)} 
                    className="w-full min-h-20 bg-transparent border-none focus:ring-0 text-sm font-semibold px-4 py-3 placeholder-white/20 text-white outline-none resize-none scrollbar-none" 
                    placeholder="Tell people about you..." 
                    maxLength={160} 
                  />
                </div>
              </label>
            </div>

            {message && (
              <p className="mt-4 rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
                {message}
              </p>
            )}

            <button 
              disabled={loading} 
              className="w-full bg-primary hover:brightness-110 text-white font-bold text-sm py-4 rounded-full shadow-glow active:scale-95 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-55"
            >
              <Save size={16} />
              {loading ? 'Creating account...' : 'Register and continue'}
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, value, onChange, type = 'text', icon: Icon }) {
  return (
    <label className="block">
      <span className="text-xs text-text-muted font-bold ml-1">{label}</span>
      <div className="mt-1.5 flex items-center bg-[#171f33]/40 border border-white/10 rounded-2xl p-0.5 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/45 transition-all">
        {Icon && <Icon size={16} className="text-text-muted font-bold text-sm pl-4 select-none shrink-0" />}
        <input 
          value={value} 
          onChange={(event) => onChange(event.target.value)} 
          className={`min-w-0 flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold py-3 placeholder-white/20 text-white outline-none ${Icon ? 'px-1' : 'px-4'}`}
          type={type} 
        />
      </div>
    </label>
  );
}
