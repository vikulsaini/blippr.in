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
          className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4"
        >
          <motion.form
            onSubmit={submit}
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-[24px] bg-surface p-5 shadow-elevated border border-border-default"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-tint text-accent">
                <LockKeyhole size={21} />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-text-primary">Create account to continue</h2>
                <p className="text-sm text-text-secondary">Guest access is limited. Register to unlock full Blippr.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <Field label="Full name" value={form.name} onChange={(value) => update('name', value)} />
              <Field label="Email" value={form.email} onChange={(value) => update('email', value)} type="email" icon={Mail} />
              <Field label="Password" value={form.password} onChange={(value) => update('password', value)} type="password" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date of birth" value={form.dob} onChange={(value) => update('dob', value)} type="date" />
                <Field label="Contact" value={form.contact} onChange={(value) => update('contact', value)} />
              </div>
              <div>
                <span className="text-xs text-text-muted">Gender</span>
                <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-[16px] border border-border-default bg-bg p-1">
                  {['female', 'male'].map((gender) => (
                    <button key={gender} type="button" onClick={() => update('gender', gender)} className={`rounded-[12px] py-2 text-sm font-semibold capitalize ${form.gender === gender ? 'btn-primary' : 'text-text-muted'}`}>
                      {gender}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Hobbies, comma separated" value={form.hobbies} onChange={(value) => update('hobbies', value)} />
              <label className="block">
                <span className="text-xs text-text-muted">Short bio</span>
                <textarea value={form.bio} onChange={(event) => update('bio', event.target.value)} className="mt-1.5 min-h-20 w-full resize-none rounded-[16px] px-4 py-3 outline-none text-sm transition" placeholder="Tell people about you" maxLength={160} />
              </label>
            </div>
            {message && <p className="mt-3 rounded-[14px] border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{message}</p>}
            <button disabled={loading} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-[16px] py-3 font-semibold disabled:opacity-55">
              <Save size={18} />
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
      <span className="text-xs text-text-muted">{label}</span>
      <div className="mt-1.5 flex items-center gap-2 rounded-[16px] px-4 transition">
        {Icon && <Icon size={16} className="text-text-faint" />}
        <input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-text-faint" type={type} />
      </div>
    </label>
  );
}
