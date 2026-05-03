import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, UserRound } from 'lucide-react';
import { api, setToken } from '../lib/api.js';

const initialProfile = { name: '', username: '', age: '', gender: 'female', bio: '' };

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState('');

  function finishAuth(token) {
    setToken(token);
    window.location.href = '/';
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setOtpSent(false);
  }

  function profilePayload() {
    return {
      ...profile,
      age: Number(profile.age)
    };
  }

  async function submitEmail(event) {
    event.preventDefault();
    setError('');
    try {
      const path = mode === 'signup' ? '/api/auth/email/signup' : '/api/auth/email/login';
      const body = mode === 'signup' ? { ...profilePayload(), email, password, name: profile.name, username: profile.username } : { email, password };
      const { token } = await api(path, { method: 'POST', body: JSON.stringify(body) });
      finishAuth(token);
    } catch (err) {
      setError(err.message);
    }
  }

  async function continueAsGuest(event) {
    event.preventDefault();
    setError('');
    try {
      const { token } = await api('/api/auth/guest', {
        method: 'POST',
        body: JSON.stringify({ age: Number(profile.age), gender: profile.gender, bio: profile.bio })
      });
      finishAuth(token);
    } catch (err) {
      setError(err.message);
    }
  }

  async function requestOtp(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone }) });
      setOtpSent(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    setError('');
    try {
      const { token } = await api('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, otp, ...profilePayload(), name: profile.name || 'Varta User' })
      });
      finishAuth(token);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-8 text-white">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="surface rounded-[22px] p-5 shadow-glow">
        <div>
          <h1 className="text-4xl font-semibold">Varta</h1>
          <p className="mt-2 text-sm text-white/58">Meet people, become friends, and keep conversations close.</p>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-1 rounded-[16px] border border-white/8 bg-white/5 p-1 text-sm">
          <ModeButton active={mode === 'login'} onClick={() => switchMode('login')} label="Login" />
          <ModeButton active={mode === 'signup'} onClick={() => switchMode('signup')} label="Signup" />
          <ModeButton active={mode === 'guest'} onClick={() => switchMode('guest')} label="Guest" />
          <ModeButton active={mode === 'phone'} onClick={() => switchMode('phone')} label="Phone" />
        </div>

        {mode === 'login' && (
          <AuthForm title="Welcome back" icon={Mail} onSubmit={submitEmail} action="Login">
            <TextInput value={email} onChange={setEmail} placeholder="Email" type="email" />
            <TextInput value={password} onChange={setPassword} placeholder="Password" type="password" />
          </AuthForm>
        )}

        {mode === 'signup' && (
          <AuthForm title="Create account" icon={UserRound} onSubmit={submitEmail} action="Create account">
            <TextInput value={profile.name} onChange={(value) => setProfile((current) => ({ ...current, name: value }))} placeholder="Full name" />
            <TextInput value={profile.username} onChange={(value) => setProfile((current) => ({ ...current, username: value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} placeholder="Username" prefix="@" />
            <TextInput value={email} onChange={setEmail} placeholder="Email" type="email" />
            <TextInput value={password} onChange={setPassword} placeholder="Password" type="password" />
            <ProfileSetup profile={profile} setProfile={setProfile} />
          </AuthForm>
        )}

        {mode === 'guest' && (
          <AuthForm title="Guest setup" icon={UserRound} onSubmit={continueAsGuest} action="Continue as guest">
            <ProfileSetup profile={profile} setProfile={setProfile} compact />
          </AuthForm>
        )}

        {mode === 'phone' && (
          <AuthForm title="Phone login" icon={Phone} onSubmit={otpSent ? verifyOtp : requestOtp} action={otpSent ? 'Verify OTP' : 'Send OTP'}>
            <TextInput value={profile.name} onChange={(value) => setProfile((current) => ({ ...current, name: value }))} placeholder="Full name" />
            {otpSent && <TextInput value={profile.username} onChange={(value) => setProfile((current) => ({ ...current, username: value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} placeholder="Username for new account" prefix="@" />}
            <TextInput value={phone} onChange={setPhone} placeholder="+91 98765 43210" type="tel" />
            {otpSent && <TextInput value={otp} onChange={setOtp} placeholder="6-digit OTP" inputMode="numeric" />}
            <ProfileSetup profile={profile} setProfile={setProfile} compact />
          </AuthForm>
        )}

        {error && <p className="mt-4 rounded-[16px] border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>}
      </motion.section>
    </main>
  );
}

function ModeButton({ active, onClick, label }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-[12px] px-2 py-2 font-medium transition ${active ? 'bg-white text-ink' : 'text-white/62'}`}>
      {label}
    </button>
  );
}

function AuthForm({ title, icon: Icon, onSubmit, action, children }) {
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="rounded-[14px] bg-white/8 p-3 text-mint"><Icon size={20} /></span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {children}
      <button className="w-full rounded-[16px] bg-white py-3 font-semibold text-ink">{action}</button>
    </form>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', inputMode, prefix }) {
  return (
    <div className="flex items-center rounded-[16px] border border-white/8 bg-white/5 px-4">
      {prefix && <span className="text-white/35">{prefix}</span>}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent py-3 outline-none"
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
      />
    </div>
  );
}

function ProfileSetup({ profile, setProfile, compact = false }) {
  function update(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="space-y-3 rounded-[18px] border border-white/8 bg-white/5 p-3">
      <div className="grid grid-cols-2 gap-3">
        <TextInput value={profile.age} onChange={(value) => update('age', value)} placeholder="Age 18+" type="number" />
        <div className="grid grid-cols-2 gap-1 rounded-[16px] border border-white/8 bg-white/5 p-1 text-sm">
          {['female', 'male'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => update('gender', value)}
              className={`rounded-[12px] px-2 py-2 font-medium capitalize transition ${profile.gender === value ? 'bg-white text-ink' : 'text-white/62'}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      {!compact && <textarea value={profile.bio} onChange={(event) => update('bio', event.target.value)} className="min-h-20 w-full resize-none rounded-[16px] border border-white/8 bg-white/5 px-4 py-3 outline-none" placeholder="Short bio" maxLength={160} />}
      {compact && <TextInput value={profile.bio} onChange={(value) => update('bio', value)} placeholder="Short bio" />}
    </div>
  );
}
