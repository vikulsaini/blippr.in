import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import BrandLogo from '../components/BrandLogo.jsx';
import { api, setToken } from '../lib/api.js';

const initialProfile = { name: '', username: '', age: '', dob: '', contact: '', gender: 'female', bio: '', hobbies: '' };

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState('');

  function finishAuth(token) {
    setToken(token);
    navigate('/app', { replace: true });
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setOtpHint('');
    setEmailHint('');
    setOtpSent(false);
  }

  function showEmailVerification(result, fallbackEmail = email) {
    setPendingEmail(result.email || fallbackEmail);
    setEmailHint(result.verificationCode ? `Testing code: ${result.verificationCode}` : result.message || 'Check your email for the verification code.');
    setEmailCode('');
    setMode('verifyEmail');
  }

  function profilePayload() {
    return {
      ...profile,
      age: Number(profile.age || ageFromDob(profile.dob) || 18),
      dob: profile.dob || undefined,
      interests: profile.hobbies.split(',').map((item) => item.trim()).filter(Boolean)
    };
  }

  async function submitEmail(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const path = mode === 'signup' ? '/api/auth/email/signup' : '/api/auth/email/login';
      const body = mode === 'signup' ? { ...profilePayload(), email, password, name: profile.name, username: profile.username } : { email, password };
      const result = await api(path, { method: 'POST', body: JSON.stringify(body) });
      if (result.verificationRequired) {
        showEmailVerification(result);
        return;
      }
      const { token } = result;
      finishAuth(token);
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') showEmailVerification(err.body || {}, email);
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyEmail(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api('/api/auth/email/verify', {
        method: 'POST',
        body: JSON.stringify({ email: pendingEmail || email, code: emailCode })
      });
      finishAuth(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function resendEmailCode() {
    setError('');
    setEmailHint('');
    setLoading(true);
    try {
      const result = await api('/api/auth/email/resend', {
        method: 'POST',
        body: JSON.stringify({ email: pendingEmail || email })
      });
      showEmailVerification(result, pendingEmail || email);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function continueAsGuest(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api('/api/auth/guest', {
        method: 'POST',
        body: JSON.stringify({ age: Number(profile.age), gender: profile.gender, bio: profile.bio })
      });
      finishAuth(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp(event) {
    event.preventDefault();
    setError('');
    setOtpHint('');
    setLoading(true);
    try {
      const result = await api('/api/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone }) });
      setOtpSent(true);
      if (result.otp) setOtpHint(`Testing OTP: ${result.otp}`);
      else if (!result.smsSent) setOtpHint('OTP was generated, but SMS is not configured on the server.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
       const { token } = await api('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, otp, ...profilePayload(), name: profile.name || 'Blippr User' })
      });
      finishAuth(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell mx-auto grid min-h-screen w-full max-w-6xl items-center gap-6 px-5 py-8 text-text-primary lg:grid-cols-[1fr_minmax(26rem,30rem)]">
      <section className="hidden lg:block">
        <BrandLogo />
        <h1 className="mt-6 max-w-xl text-6xl font-bold leading-tight tracking-tight text-text-primary">Start real conversations without the clutter.</h1>
        <p className="mt-5 max-w-lg text-lg leading-8 text-text-secondary">Blippr brings friends, random live rooms, calls, and safety into one responsive chat app for phones and desktops.</p>
      </section>
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="elevated-card rounded-3xl p-6">
        <div className="lg:hidden">
          <BrandLogo />
          <p className="mt-2 text-sm text-text-secondary">Meet people, become friends, and keep conversations close.</p>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-1 rounded-2xl border border-border-default bg-bg p-1 text-sm">
          <ModeButton active={mode === 'login'} onClick={() => switchMode('login')} label="Login" />
          <ModeButton active={mode === 'signup'} onClick={() => switchMode('signup')} label="Signup" />
          <ModeButton active={mode === 'guest'} onClick={() => switchMode('guest')} label="Guest" />
          <ModeButton active={mode === 'phone'} onClick={() => switchMode('phone')} label="Phone" />
        </div>

        {mode === 'login' && (
          <AuthForm title="Welcome Back" icon={Mail} onSubmit={submitEmail} action="Login" loading={loading}>
            <TextInput value={email} onChange={setEmail} placeholder="Email" type="email" />
            <TextInput value={password} onChange={setPassword} placeholder="Password" type="password" />
          </AuthForm>
        )}

        {mode === 'signup' && (
          <AuthForm title="Create Account" icon={UserRound} onSubmit={submitEmail} action="Create Account" loading={loading}>
            <TextInput value={profile.name} onChange={(value) => setProfile((current) => ({ ...current, name: value }))} placeholder="Full name" />
            <TextInput value={profile.username} onChange={(value) => setProfile((current) => ({ ...current, username: value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} placeholder="Username" prefix="@" />
            <TextInput value={email} onChange={setEmail} placeholder="Email" type="email" />
            <TextInput value={password} onChange={setPassword} placeholder="Password" type="password" />
            <ProfileSetup profile={profile} setProfile={setProfile} />
          </AuthForm>
        )}

        {mode === 'guest' && (
          <AuthForm title="Guest Setup" icon={UserRound} onSubmit={continueAsGuest} action="Continue as Guest" loading={loading}>
            <ProfileSetup profile={profile} setProfile={setProfile} compact />
          </AuthForm>
        )}

        {mode === 'phone' && (
          <AuthForm title="Phone Login" icon={Phone} onSubmit={otpSent ? verifyOtp : requestOtp} action={otpSent ? 'Verify OTP' : 'Send OTP'} loading={loading}>
            {otpSent && <TextInput value={profile.username} onChange={(value) => setProfile((current) => ({ ...current, username: value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} placeholder="Username for new account" prefix="@" />}
            <TextInput value={phone} onChange={setPhone} placeholder="+91 98765 43210" type="tel" />
            {otpSent && <TextInput value={otp} onChange={setOtp} placeholder="6-digit OTP" inputMode="numeric" />}
            {otpSent && (
              <>
                <TextInput value={profile.name} onChange={(value) => setProfile((current) => ({ ...current, name: value }))} placeholder="Full name" />
                <ProfileSetup profile={profile} setProfile={setProfile} compact />
              </>
            )}
            {otpHint && <p className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs text-accent">{otpHint}</p>}
          </AuthForm>
        )}

        {mode === 'verifyEmail' && (
          <AuthForm title="Verify Email" icon={ShieldCheck} onSubmit={verifyEmail} action="Verify and Continue" loading={loading}>
            <p className="rounded-2xl border border-border-default bg-bg px-4 py-3 text-sm text-text-secondary">
              Enter the 6-digit code sent to <span className="font-semibold text-text-primary">{pendingEmail || email}</span>.
            </p>
            <TextInput value={emailCode} onChange={setEmailCode} placeholder="6-digit code" inputMode="numeric" />
            {emailHint && <p className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs text-accent">{emailHint}</p>}
            <button type="button" onClick={resendEmailCode} disabled={loading} className="btn-secondary w-full rounded-2xl py-3 text-sm font-semibold disabled:opacity-55">
              Resend Code
            </button>
          </AuthForm>
        )}

        {error && <p className="mt-4 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}
      </motion.section>
    </main>
  );
}

function ModeButton({ active, onClick, label }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl px-2 py-2 font-medium transition-all duration-200 active:scale-[0.96] ${active ? 'bg-accent text-white shadow-accent-sm' : 'text-text-muted hover:text-text-primary'}`}>
      {label}
    </button>
  );
}

function AuthForm({ title, icon: Icon, onSubmit, action, children, loading = false }) {
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-accent/10 p-3 text-accent"><Icon size={20} /></span>
        <h2 className="text-xl font-bold text-text-primary">{title}</h2>
      </div>
      {children}
      <button disabled={loading} className="btn-primary w-full rounded-2xl py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-55">
        {loading ? 'Please wait...' : action}
      </button>
    </form>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', inputMode, prefix }) {
  return (
    <div className="flex items-center rounded-2xl border border-border-default bg-surface px-4 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
      {prefix && <span className="text-text-faint">{prefix}</span>}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent py-3 text-sm text-text-primary outline-none placeholder:text-text-faint"
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
    <div className="space-y-3 rounded-2xl border border-border-default bg-bg p-3">
      <div className="grid grid-cols-2 gap-3">
        <TextInput value={profile.age} onChange={(value) => update('age', value)} placeholder="Age 18+" type="number" />
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border-default bg-surface p-1 text-sm">
          {['female', 'male'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => update('gender', value)}
              className={`rounded-xl px-2 py-2 font-medium capitalize transition-all duration-200 active:scale-[0.96] ${profile.gender === value ? 'bg-accent text-white shadow-accent-sm' : 'text-text-muted'}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      {!compact && (
        <div className="grid grid-cols-2 gap-3">
          <TextInput value={profile.dob} onChange={(value) => update('dob', value)} placeholder="Date of birth" type="date" />
          <TextInput value={profile.contact} onChange={(value) => update('contact', value)} placeholder="Contact" />
        </div>
      )}
      {!compact && <TextInput value={profile.hobbies} onChange={(value) => update('hobbies', value)} placeholder="Hobbies, comma separated" />}
      {!compact && <textarea value={profile.bio} onChange={(event) => update('bio', event.target.value)} className="min-h-20 w-full resize-none rounded-2xl border border-border-default bg-surface px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-faint focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Short bio" maxLength={160} />}
      {compact && <TextInput value={profile.bio} onChange={(value) => update('bio', value)} placeholder="Short bio" />}
    </div>
  );
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
