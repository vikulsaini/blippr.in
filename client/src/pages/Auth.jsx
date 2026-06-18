import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Mail, 
  Phone, 
  ShieldCheck, 
  UserRound, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ArrowLeft, 
  ChevronRight, 
  X, 
  Calendar,
  Smile,
  Compass,
  Globe,
  ChevronDown,
  Music,
  Camera,
  MessageCircle
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo.jsx';
import { api, setToken } from '../lib/api.js';

const initialProfile = { name: '', username: '', age: '', dob: '', contact: '', gender: 'female', bio: '', hobbies: '' };

const SOCIAL_PROFILES = [];

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('signup'); // 'signup' | 'login' | 'guest' | 'verifyEmail' | 'forgotPassword' | 'resetPassword'
  const [signupStep, setSignupStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleAge, setGoogleAge] = useState('18');
  const [googleGender, setGoogleGender] = useState('female');
  const [googleBio, setGoogleBio] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState('');
  
  const [socialModal, setSocialModal] = useState(null); // 'Google' | null
  const [connectingSocial, setConnectingSocial] = useState(false);
  const [selectedSocialProfile, setSelectedSocialProfile] = useState(null);

  // Validation States
  const isNameValid = profile.name.trim().length >= 2;
  const isUsernameValid = /^[a-z0-9_]{3,24}$/.test(profile.username);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isGoogleInputValid = Number(googleAge) >= 18;

  // Password rules checks
  const hasMinLength = password.length >= 8;
  const hasNumOrSymbol = /[\d\W]/.test(password);
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const isPasswordValid = hasMinLength && hasNumOrSymbol && hasMixedCase;

  function finishAuth(token) {
    setToken(token);
    navigate('/app', { replace: true });
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setSignupStep(1);
    setError('');
    setEmailHint('');
  }

  function showEmailVerification(result, fallbackEmail = email) {
    setPendingEmail(result.email || fallbackEmail);
    setEmailHint(result.message || 'Check your email for the verification code.');
    setEmailCode('');
    setMode('verifyEmail');
  }

  const googleAgeRef = useRef(googleAge);
  const googleGenderRef = useRef(googleGender);
  const googleBioRef = useRef(googleBio);
  const googleInitRef = useRef(false);

  useEffect(() => { googleAgeRef.current = googleAge; }, [googleAge]);
  useEffect(() => { googleGenderRef.current = googleGender; }, [googleGender]);
  useEffect(() => { googleBioRef.current = googleBio; }, [googleBio]);

  async function handleGoogleCredentialResponse(response) {
    setLoading(true);
    setError('');
    try {
      const { token } = await api('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({
          idToken: response.credential,
          age: Number(googleAgeRef.current),
          gender: googleGenderRef.current,
          bio: googleBioRef.current
        })
      });
      finishAuth(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (socialModal === 'Google' && Number(googleAge) >= 18 && window.google) {
      const timer = setTimeout(() => {
        const btnContainer = document.getElementById('google-signin-button');
        if (btnContainer && !googleInitRef.current) {
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'replace-me.apps.googleusercontent.com',
            callback: handleGoogleCredentialResponse
          });
          window.google.accounts.id.renderButton(
            btnContainer,
            { theme: 'outline', size: 'large', width: '320' }
          );
          googleInitRef.current = true;
        }
      }, 100);
      return () => clearTimeout(timer);
    } else if (!socialModal) {
      googleInitRef.current = false;
    }
  }, [socialModal, googleAge]);

  function profilePayload() {
    return {
      ...profile,
      age: Number(profile.age || ageFromDob(profile.dob) || 18),
      dob: profile.dob || undefined,
      interests: profile.hobbies.split(',').map((item) => item.trim()).filter(Boolean)
    };
  }

  async function submitForm(event) {
    if (event) event.preventDefault();
    setError('');

    // Handle multi-step signup check
    if (mode === 'signup' && signupStep === 1) {
      if (!isNameValid || !isUsernameValid || !isEmailValid || !isPasswordValid) {
        setError('Please satisfy all validation checks to continue.');
        return;
      }
      setSignupStep(2);
      return;
    }

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

  async function submitForgotPassword(event) {
    if (event) event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api('/api/auth/email/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      setEmailHint(result.message || 'Check your email for the reset code.');
      setEmailCode('');
      setMode('resetPassword');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitResetPassword(event) {
    if (event) event.preventDefault();
    if (!isPasswordValid) {
      setError('Please satisfy all password requirements.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await api('/api/auth/email/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code: emailCode, password })
      });
      setMode('login');
      setError('');
      setPassword('');
      setEmailCode('');
      setEmailHint(result.message || 'Password reset successfully. You can now log in.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl flex items-center justify-center p-4">
      {/* Clean elevated card */}
      <div className="w-full bg-surface border border-border-default shadow-elevated rounded-[2.5rem] p-5 lg:p-7 grid lg:grid-cols-[1.12fr_0.88fr] gap-12 items-stretch min-h-[640px] overflow-hidden transition-colors duration-[350ms]">
        
        {/* Left Column: Form Content */}
        <div className="flex flex-col justify-between p-4 lg:p-7 space-y-8">
          
          {/* Header section */}
          <div>
            <div className="flex items-center justify-between mb-8">
              <BrandLogo compactTitle />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={mode + (mode === 'signup' ? `-step-${signupStep}` : '')}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.22 }}
                className="space-y-6"
              >
                {/* Form Headline */}
                <div className="space-y-1">
                  <h2 className="text-4xl font-extrabold tracking-tight text-text-primary">
                    {mode === 'signup' && signupStep === 1 ? 'Sign Up' : ''}
                    {mode === 'signup' && signupStep === 2 ? 'Profile Details' : ''}
                    {mode === 'login' ? 'Sign In' : ''}
                    {mode === 'guest' ? 'Guest Setup' : ''}
                    {mode === 'verifyEmail' ? 'Verify Email' : ''}
                    {mode === 'forgotPassword' ? 'Reset Password' : ''}
                    {mode === 'resetPassword' ? 'New Password' : ''}
                  </h2>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
                    {mode === 'signup' && signupStep === 1 && 'Secure Your Communications with Blippr'}
                    {mode === 'signup' && signupStep === 2 && 'Step 2: Tell us a bit about yourself'}
                    {mode === 'login' && 'Welcome back to your private cafe'}
                    {mode === 'guest' && 'Enter instantly without an email address'}
                    {mode === 'verifyEmail' && 'Secure authentication checkpoint'}
                    {mode === 'forgotPassword' && 'Enter your email to receive a reset code'}
                    {mode === 'resetPassword' && 'Enter the 6-digit code and your new password'}
                  </p>
                </div>

                <form onSubmit={
                  mode === 'signup' ? submitForm :
                  mode === 'login' ? submitForm :
                  mode === 'guest' ? continueAsGuest :
                  mode === 'forgotPassword' ? submitForgotPassword :
                  mode === 'resetPassword' ? submitResetPassword :
                  verifyEmail
                } className="space-y-5 pt-2">
                  
                  {/* SIGNUP STEP 1 FIELDS */}
                  {mode === 'signup' && signupStep === 1 && (
                    <>
                      <UnderlinedInput 
                        value={profile.name} 
                        onChange={(value) => setProfile((c) => ({ ...c, name: value }))} 
                        placeholder="Daniel Ahmadi" 
                        icon={UserRound}
                        isValid={isNameValid}
                      />
                      <UnderlinedInput 
                        value={profile.username} 
                        onChange={(value) => setProfile((c) => ({ ...c, username: value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} 
                        placeholder="11danielahmadi" 
                        prefix="@"
                        icon={UserRound}
                        isValid={isUsernameValid}
                      />
                      <UnderlinedInput 
                        value={email} 
                        onChange={setEmail} 
                        placeholder="11danielahmadi@gmail.com" 
                        type="email" 
                        icon={Mail}
                        isValid={isEmailValid}
                      />
                      <div className="space-y-3">
                        <UnderlinedInput 
                          value={password} 
                          onChange={setPassword} 
                          placeholder="Password" 
                          type={showPassword ? 'text' : 'password'} 
                          icon={Lock}
                          suffix={
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-text-faint hover:text-text-secondary transition p-1"
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          }
                          isValid={isPasswordValid}
                        />
                        {/* Real-time Checklist matching Dribbble spec */}
                        <div className="space-y-1.5 pt-1">
                          <PasswordRule met={hasMinLength} text="Least 8 characters" />
                          <PasswordRule met={hasNumOrSymbol} text="Least one number (0-9) or a symbol" />
                          <PasswordRule met={hasMixedCase} text="Lowercase (a-z) and uppercase (A-Z)" />
                          {/* Password strength bar */}
                          {password.length > 0 && (
                            <div className="mt-2 flex gap-1">
                              {[hasMinLength, hasNumOrSymbol, hasMixedCase].map((met, i) => (
                                <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${met ? 'bg-emerald-500' : 'bg-border-default'}`} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* SIGNUP STEP 2 FIELDS */}
                  {mode === 'signup' && signupStep === 2 && (
                    <div className="space-y-4 animate-fadeIn">
                      <button
                        type="button"
                        onClick={() => setSignupStep(1)}
                        className="flex items-center gap-1.5 text-xs text-text-faint font-bold hover:text-text-secondary transition"
                      >
                        <ArrowLeft size={13} /> Back to account credentials
                      </button>
                      <ProfileSetup profile={profile} setProfile={setProfile} />
                    </div>
                  )}

                  {/* SIGN IN FIELDS */}
                  {mode === 'login' && (
                    <>
                      <UnderlinedInput 
                        value={email} 
                        onChange={setEmail} 
                        placeholder="Email Address" 
                        type="email" 
                        icon={Mail}
                        isValid={isEmailValid}
                      />
                      <div className="space-y-2">
                        <UnderlinedInput 
                          value={password} 
                          onChange={setPassword} 
                          placeholder="Password" 
                          type={showPassword ? 'text' : 'password'} 
                          icon={Lock}
                          suffix={
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-text-faint hover:text-text-secondary transition p-1"
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          }
                          isValid={password.length >= 6}
                        />
                        <div className="flex justify-end">
                          <button type="button" onClick={() => switchMode('forgotPassword')} className="text-[11px] font-bold text-accent hover:underline">Forgot password?</button>
                        </div>
                      </div>
                      
                      {emailHint && (
                        <p className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs text-accent font-semibold leading-relaxed">
                          {emailHint}
                        </p>
                      )}
                    </>
                  )}

                  {/* GUEST FIELDS */}
                  {mode === 'guest' && (
                    <div className="space-y-4">
                      <ProfileSetup profile={profile} setProfile={setProfile} compact />
                    </div>
                  )}

                  {/* FORGOT PASSWORD FIELDS */}
                  {mode === 'forgotPassword' && (
                    <div className="space-y-4">
                      <UnderlinedInput 
                        value={email} 
                        onChange={setEmail} 
                        placeholder="Email Address" 
                        type="email" 
                        icon={Mail}
                        isValid={isEmailValid}
                      />
                    </div>
                  )}

                  {/* RESET PASSWORD FIELDS */}
                  {mode === 'resetPassword' && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border-default bg-bg p-4 text-xs font-semibold text-text-muted leading-relaxed transition-colors duration-[350ms]">
                        Reset code sent to <span className="font-bold text-text-primary">{email}</span>. Enter code:
                      </div>
                      <UnderlinedInput 
                        value={emailCode} 
                        onChange={setEmailCode} 
                        placeholder="6-digit code" 
                        inputMode="numeric" 
                        icon={ShieldCheck} 
                        isValid={emailCode.length === 6}
                      />
                      <UnderlinedInput 
                        value={password} 
                        onChange={setPassword} 
                        placeholder="New Password" 
                        type={showPassword ? 'text' : 'password'} 
                        icon={Lock}
                        suffix={
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-text-faint hover:text-text-secondary transition p-1"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        }
                        isValid={isPasswordValid}
                      />
                      <div className="space-y-1.5 pt-1">
                        <PasswordRule met={hasMinLength} text="Least 8 characters" />
                        <PasswordRule met={hasNumOrSymbol} text="Least one number (0-9) or a symbol" />
                        <PasswordRule met={hasMixedCase} text="Lowercase (a-z) and uppercase (A-Z)" />
                      </div>
                      {emailHint && (
                        <p className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs text-accent font-semibold leading-relaxed">
                          {emailHint}
                        </p>
                      )}
                    </div>
                  )}

                  {/* EMAIL VERIFICATION FIELDS */}
                  {mode === 'verifyEmail' && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border-default bg-bg p-4 text-xs font-semibold text-text-muted leading-relaxed transition-colors duration-[350ms]">
                        Verification code sent to <span className="font-bold text-text-primary">{pendingEmail || email}</span>. Enter code:
                      </div>
                      <UnderlinedInput 
                        value={emailCode} 
                        onChange={setEmailCode} 
                        placeholder="6-digit code" 
                        inputMode="numeric" 
                        icon={ShieldCheck} 
                        isValid={emailCode.length === 6}
                      />
                      {emailHint && (
                        <p className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs text-accent font-semibold leading-relaxed">
                          {emailHint}
                        </p>
                      )}
                    </div>
                  )}

                  {error && (
                    <motion.p 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-semibold text-danger bg-danger/5 border border-danger/10 p-3 rounded-2xl"
                    >
                      {error}
                    </motion.p>
                  )}

                  {/* Actions Row: Submit Pill & Social Circles */}
                  <div className="flex items-center gap-4 mt-8 flex-wrap pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary rounded-xl px-8 py-3.5 flex items-center gap-2.5 font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {loading ? 'Please wait...' : mode === 'signup' ? (signupStep === 1 ? 'Sign Up' : 'Complete Setup') : mode === 'login' ? 'Sign In' : mode === 'guest' ? 'Enter Cafe' : mode === 'forgotPassword' ? 'Send Reset Code' : mode === 'resetPassword' ? 'Update Password' : 'Verify'}
                      <ChevronRight size={18} />
                    </button>

                    {(mode === 'login' || (mode === 'signup' && signupStep === 1)) && (
                      <>
                        <span className="text-text-muted text-sm font-semibold">Or</span>
                        <div className="flex items-center gap-2.5">
                          {/* Google login button */}
                          <button
                            type="button"
                            onClick={() => setSocialModal('Google')}
                            className="h-11 px-4 rounded-xl border border-border-default hover:border-accent hover:bg-accent-tint flex items-center gap-2 justify-center transition active:scale-95 shadow-card bg-surface font-bold text-xs text-text-secondary"
                          >
                            <GoogleIcon />
                            <span>Google</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </form>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer switches & Language Selector */}
          <div className="pt-6 border-t border-border-default space-y-5">
            {/* Unified Mode switches */}
            <div className="text-xs text-text-faint font-bold space-y-2.5">
              {mode === 'login' && (
                <>
                  <p>
                    New to Blippr?{' '}
                    <button type="button" onClick={() => switchMode('signup')} className="text-accent font-extrabold hover:underline">
                      Create account
                    </button>
                  </p>
                  <p className="flex items-center gap-1.5 flex-wrap">
                    <span>Alternative ways:</span>
                    <button type="button" onClick={() => switchMode('guest')} className="text-accent hover:underline">Guest Session</button>
                  </p>
                </>
              )}
              {mode === 'signup' && (
                <>
                  <p>
                    Already have an account?{' '}
                    <button type="button" onClick={() => switchMode('login')} className="text-accent font-extrabold hover:underline">
                      Sign In
                    </button>
                  </p>
                  <p className="flex items-center gap-1.5 flex-wrap">
                    <span>Alternative ways:</span>
                    <button type="button" onClick={() => switchMode('guest')} className="text-accent hover:underline">Guest Session</button>
                  </p>
                </>
              )}
              {(mode === 'guest' || mode === 'verifyEmail' || mode === 'forgotPassword' || mode === 'resetPassword') && (
                <p className="flex items-center gap-2 flex-wrap text-text-faint font-bold">
                  <button type="button" onClick={() => switchMode('login')} className="text-accent hover:underline">Email Login</button>
                  <span>•</span>
                  <button type="button" onClick={() => switchMode('signup')} className="text-accent hover:underline">Email Signup</button>
                  {mode !== 'guest' && (
                    <>
                      <span>•</span>
                      <button type="button" onClick={() => switchMode('guest')} className="text-accent hover:underline">Guest Session</button>
                    </>
                  )}
                </p>
              )}
            </div>

            {/* Language Selector at bottom left */}
            <div className="flex items-center gap-1.5 text-xs text-text-faint font-bold cursor-pointer hover:text-text-secondary transition w-fit select-none">
              <Globe size={14} />
              <span>ENG</span>
              <ChevronDown size={12} />
            </div>
          </div>
        </div>

        {/* Right Column: Modern Visual Panel */}
        <div className="hidden lg:flex relative rounded-[2rem] overflow-hidden p-8 flex-col justify-between items-stretch">
          
          {/* Animated Gradient Background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#2563EB] via-[#7C3AED] to-[#EC4899] opacity-90" />
            {/* Animated mesh overlay */}
            <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="auth-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M40 0 L0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#auth-grid)" />
            </svg>
            {/* Animated wave */}
            <svg className="absolute bottom-0 left-0 w-full h-[50%] opacity-15" viewBox="0 0 1440 800" fill="none" preserveAspectRatio="none">
              <path d="M0,280 C360,380 520,200 780,250 C1040,300 1200,450 1440,370 L1440,800 L0,800 Z" fill="#FFFFFF">
                <animate attributeName="d" dur="8s" repeatCount="indefinite" values="M0,280 C360,380 520,200 780,250 C1040,300 1200,450 1440,370 L1440,800 L0,800 Z;M0,320 C300,240 560,380 780,290 C1000,200 1260,360 1440,310 L1440,800 L0,800 Z;M0,280 C360,380 520,200 780,250 C1040,300 1200,450 1440,370 L1440,800 L0,800 Z" />
              </path>
            </svg>
          </div>

          {/* Floating Card 1: Stats Mockup */}
          <motion.div 
            initial={{ opacity: 0, x: 25, y: 15 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 80 }}
            className="relative z-10 rounded-3xl p-5 w-[85%] ml-auto mt-6 backdrop-blur-md bg-white/90 border border-white/30 shadow-elevated"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-text-muted uppercase tracking-widest">Inbox</span>
              <span className="text-xs font-bold text-text-muted">176,18</span>
            </div>
            
            {/* Beautiful Mini Line Chart */}
            <div className="h-16 w-full mt-4 relative">
              <svg className="h-full w-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                <path 
                  d="M0,32 Q15,8 30,25 T60,6 T90,28 L100,12" 
                  fill="none" 
                  stroke="#2563EB" 
                  strokeWidth="3.5" 
                  strokeLinecap="round" 
                />
                <path 
                  d="M0,32 Q15,8 30,25 T60,6 T90,28 L100,12 L100,40 L0,40 Z" 
                  fill="url(#chart-gradient-auth)" 
                  opacity="0.12" 
                />
                <defs>
                  <linearGradient id="chart-gradient-auth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute top-1.5 right-12 h-6 w-6 rounded-full bg-accent text-white font-extrabold text-[10px] flex items-center justify-center shadow-accent-sm">
                45
              </div>
            </div>
          </motion.div>

          {/* Floating Card 2: Security Mockup */}
          <motion.div 
            initial={{ opacity: 0, x: -25, y: -15 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 0.45, type: "spring", stiffness: 80 }}
            className="relative z-10 rounded-3xl p-6 w-[90%] mr-auto mt-6 backdrop-blur-md bg-white/90 border border-white/30 shadow-elevated"
          >
            <div className="flex gap-4 items-start">
              <span className="flex-shrink-0 grid place-items-center h-11 w-11 rounded-2xl bg-amber-50 text-[#FF9800]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25z" />
                </svg>
              </span>
              
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-text-primary">Your data, your rules</h4>
                <p className="text-[11px] leading-relaxed text-text-muted font-medium">
                  Your data belongs to you, and our encryption ensures that your chat tunnels remain completely private.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Floating accent orbs */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="absolute top-[32%] right-[10%] z-10 h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-float"
          >
            <Music size={16} className="text-accent" />
          </motion.div>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 1 }}
            className="absolute top-[18%] left-[8%] z-10 h-11 w-11 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-float"
          >
            <Camera size={18} className="text-accent" />
          </motion.div>
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut', delay: 0.5 }}
            className="absolute bottom-[8%] right-[18%] z-10 h-9 w-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-float"
          >
            <MessageCircle size={14} className="text-accent" />
          </motion.div>

        </div>

      </div>

      {/* SOCIAL OAUTH REAL GOOGLE MODAL */}
      <AnimatePresence>
        {socialModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !loading && setSocialModal(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border-default bg-surface shadow-elevated p-6 z-10 transition-colors duration-[350ms]"
            >
              {/* Close Button */}
              {!loading && (
                <button
                  onClick={() => setSocialModal(null)}
                  className="absolute top-4 right-4 rounded-xl p-1.5 text-text-faint hover:bg-surface-hover transition"
                >
                  <X size={18} />
                </button>
              )}

              {loading ? (
                <div className="py-8 text-center space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-full border-4 border-accent/25 border-t-accent animate-spin" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-text-primary">Connecting to Google...</p>
                    <p className="text-xs text-text-faint">Verifying secure Google authentication token</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-accent">
                    <Sparkles size={20} />
                    <h3 className="text-lg font-bold text-text-primary">Google Profile Setup</h3>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed font-semibold">
                    Age and gender are required to secure our chat channels. Please complete these details:
                  </p>

                  <div className="space-y-4 rounded-2xl border border-border-default bg-bg p-4 transition-colors duration-[350ms]">
                    <div className="grid grid-cols-2 gap-3.5">
                      <UnderlinedInput 
                        value={googleAge} 
                        onChange={setGoogleAge} 
                        placeholder="Age (18+)" 
                        type="number" 
                        icon={UserRound}
                        isValid={isGoogleInputValid}
                      />
                      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border-default bg-surface p-1 text-xs">
                        {['female', 'male'].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setGoogleGender(value)}
                            className={`rounded-xl px-2 py-2 font-bold capitalize transition-all duration-200 active:scale-[0.96] ${googleGender === value ? 'bg-accent text-white shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <textarea 
                      value={googleBio} 
                      onChange={(event) => setGoogleBio(event.target.value)} 
                      className="min-h-20 w-full resize-none rounded-2xl border border-border-default bg-surface px-4 py-3.5 text-xs text-text-primary outline-none placeholder:text-text-faint focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200 font-semibold" 
                      placeholder="Write a short bio (optional)..." 
                      maxLength={160} 
                    />
                  </div>

                  {isGoogleInputValid ? (
                    <div className="flex flex-col items-center justify-center p-4 border border-dashed border-border-default rounded-2xl bg-bg transition-colors duration-[350ms]">
                      <p className="text-[10px] text-text-faint font-bold mb-2.5">Continue with Google:</p>
                      <div id="google-signin-button" className="w-full flex justify-center py-1"></div>
                    </div>
                  ) : (
                    <div className="text-center p-3 rounded-2xl border border-danger/20 bg-danger/5 text-danger text-xs font-semibold">
                      You must be 18 years or older to sign in.
                    </div>
                  )}

                  <button
                    onClick={() => setSocialModal(null)}
                    className="btn-secondary w-full py-3 rounded-2xl text-xs font-bold mt-2"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

// Social Icons

function GoogleIcon() {
  return (
    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

// Subcomponents helper

function UnderlinedInput({ value, onChange, placeholder, type = 'text', inputMode, prefix, icon: Icon, suffix, isValid }) {
  return (
    <div className="flex items-center border-b border-border-default transition-all duration-200 focus-within:border-accent focus-within:scale-[1.01] w-full py-1">
      {Icon && <span className="text-text-faint mr-3.5"><Icon size={18} /></span>}
      {prefix && <span className="text-text-faint mr-1 text-sm font-semibold">{prefix}</span>}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent py-3 text-sm text-text-primary outline-none placeholder:text-text-faint font-semibold"
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
      />
      {suffix && <div className="ml-2 flex items-center">{suffix}</div>}
      {!suffix && isValid && (
        <span className="text-emerald-500 ml-2 flex-shrink-0 animate-fadeIn">
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
    </div>
  );
}

function PasswordRule({ met, text }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold">
      {met ? (
        <span className="text-emerald-500 flex items-center justify-center">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-border-default ml-1 mr-1" />
      )}
      <span className={met ? "text-emerald-600" : "text-text-faint"}>
        {text}
      </span>
    </div>
  );
}

function ProfileSetup({ profile, setProfile, compact = false }) {
  function update(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border-default bg-bg p-4 transition-colors duration-[350ms]">
      <div className="grid grid-cols-2 gap-3.5">
        <UnderlinedInput 
          value={profile.age} 
          onChange={(value) => update('age', value)} 
          placeholder="Age (18+)" 
          type="number" 
          icon={UserRound}
          isValid={Number(profile.age) >= 18}
        />
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border-default bg-surface p-1 text-xs">
          {['female', 'male'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => update('gender', value)}
              className={`rounded-xl px-2 py-2 font-bold capitalize transition-all duration-200 active:scale-[0.96] ${profile.gender === value ? 'bg-accent text-white shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      
      {!compact && (
        <div className="grid grid-cols-2 gap-3.5">
          <UnderlinedInput 
            value={profile.dob} 
            onChange={(value) => update('dob', value)} 
            placeholder="DOB" 
            type="date" 
            icon={Calendar} 
            isValid={!!profile.dob}
          />
          <UnderlinedInput 
            value={profile.contact} 
            onChange={(value) => update('contact', value)} 
            placeholder="Contact info" 
            icon={Phone}
            isValid={profile.contact.trim().length >= 4}
          />
        </div>
      )}
      
      {!compact && (
        <UnderlinedInput 
          value={profile.hobbies} 
          onChange={(value) => update('hobbies', value)} 
          placeholder="Hobbies (e.g. music, coding)" 
          icon={Sparkles}
          isValid={profile.hobbies.trim().length >= 2}
        />
      )}
      
      {!compact && (
        <textarea 
          value={profile.bio} 
          onChange={(event) => update('bio', event.target.value)} 
          className="min-h-20 w-full resize-none rounded-2xl border border-border-default bg-surface px-4 py-3.5 text-xs text-text-primary outline-none placeholder:text-text-faint focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200 font-semibold" 
          placeholder="Write a short bio..." 
          maxLength={160} 
        />
      )}
      
      {compact && (
        <UnderlinedInput 
          value={profile.bio} 
          onChange={(value) => update('bio', value)} 
          placeholder="Short bio..." 
          icon={Sparkles}
          isValid={profile.bio.trim().length >= 2}
        />
      )}
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
