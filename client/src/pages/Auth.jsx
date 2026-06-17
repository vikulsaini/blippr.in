import { useState } from 'react';
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
  ChevronDown
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo.jsx';
import { api, setToken } from '../lib/api.js';

const initialProfile = { name: '', username: '', age: '', dob: '', contact: '', gender: 'female', bio: '', hobbies: '' };

const SOCIAL_PROFILES = [
  {
    provider: 'Google',
    name: 'Alex Rivera',
    email: 'alex.rivera@gmail.com',
    username: 'alex_rivera',
    age: 24,
    gender: 'male',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alex',
    bio: 'Software engineer who loves exploring coffee shops and coding late.'
  },
  {
    provider: 'Google',
    name: 'Sara Chen',
    email: 'sara.chen@gmail.com',
    username: 'sara_chen',
    age: 26,
    gender: 'female',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sara',
    bio: 'Product designer and tea enthusiast. Let\'s talk about design & life.'
  },
  {
    provider: 'Facebook',
    name: 'Taylor Jones',
    email: 'taylor.jones@facebook.com',
    username: 'taylor_j',
    age: 22,
    gender: 'female',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Taylor',
    bio: 'Avid traveler, foodie, and music lover. Looking to meet nice people!'
  },
  {
    provider: 'Facebook',
    name: 'Marcus Vance',
    email: 'marcus.vance@facebook.com',
    username: 'marcus_v',
    age: 29,
    gender: 'male',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Marcus',
    bio: 'Fitness coach & adventure photographer. Tell me your favorite trail.'
  }
];

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('signup'); // 'signup' is default as in screenshot. 'login' | 'guest' | 'phone' | 'verifyEmail'
  const [signupStep, setSignupStep] = useState(1); // 1: credentials, 2: profile details
  const [showPassword, setShowPassword] = useState(false);
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
  
  // Social login modal state
  const [socialModal, setSocialModal] = useState(null); // 'Google' | 'Facebook' | null
  const [connectingSocial, setConnectingSocial] = useState(false);
  const [selectedSocialProfile, setSelectedSocialProfile] = useState(null);

  // Validation States
  const isNameValid = profile.name.trim().length >= 2;
  const isUsernameValid = /^[a-z0-9_]{3,24}$/.test(profile.username);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPhoneValid = /^\+?[\d\s-]{8,18}$/.test(phone);
  const isOtpValid = /^\d{6}$/.test(otp);

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

  async function handlePhoneSubmit(event) {
    event.preventDefault();
    if (otpSent) {
      await verifyOtp(event);
    } else {
      await requestOtp(event);
    }
  }

  async function requestOtp(event) {
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

  // Handle Social Login (Google / Facebook mock handler)
  async function triggerSocialLogin(socialProfile) {
    setSelectedSocialProfile(socialProfile);
    setConnectingSocial(true);
    
    // Simulate OAuth handshake
    setTimeout(async () => {
      try {
        // 1. Create a guest session under the hood to get a valid token
        const { token } = await api('/api/auth/guest', {
          method: 'POST',
          body: JSON.stringify({ 
            age: socialProfile.age, 
            gender: socialProfile.gender, 
            bio: socialProfile.bio 
          })
        });
        setToken(token);
        
        // 2. Patch the profile details on the backend to match Google/Facebook account
        try {
          await api('/api/users/me', {
            method: 'PATCH',
            body: JSON.stringify({
              name: socialProfile.name,
              username: socialProfile.username,
              avatar: socialProfile.avatar
            })
          });
        } catch (profileErr) {
          console.warn('Failed to update social details:', profileErr.message);
        }
        
        finishAuth(token);
      } catch (err) {
        setError(err.message);
        setConnectingSocial(false);
        setSocialModal(null);
      }
    }, 1200);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl flex items-center justify-center p-4">
      {/* Unified Dribbble-style card structure */}
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-[0_24px_70px_rgba(0,0,0,0.08)] rounded-[2.5rem] p-5 lg:p-7 grid lg:grid-cols-[1.12fr_0.88fr] gap-12 items-stretch min-h-[640px] overflow-hidden">
        
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
                  <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {mode === 'signup' && signupStep === 1 ? 'Sign Up' : ''}
                    {mode === 'signup' && signupStep === 2 ? 'Profile Details' : ''}
                    {mode === 'login' ? 'Sign In' : ''}
                    {mode === 'phone' ? 'Phone OTP' : ''}
                    {mode === 'guest' ? 'Guest Setup' : ''}
                    {mode === 'verifyEmail' ? 'Verify Email' : ''}
                  </h2>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {mode === 'signup' && signupStep === 1 && 'Secure Your Communications with Blippr'}
                    {mode === 'signup' && signupStep === 2 && 'Step 2: Tell us a bit about yourself'}
                    {mode === 'login' && 'Welcome back to your private cafe'}
                    {mode === 'phone' && 'Fast access via one-time verification code'}
                    {mode === 'guest' && 'Enter instantly without an email address'}
                    {mode === 'verifyEmail' && 'Secure authentication checkpoint'}
                  </p>
                </div>

                <form onSubmit={
                  mode === 'signup' ? submitForm :
                  mode === 'login' ? submitForm :
                  mode === 'phone' ? handlePhoneSubmit :
                  mode === 'guest' ? continueAsGuest :
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
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1"
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
                        className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-bold hover:text-slate-700 transition"
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
                            className="text-slate-400 hover:text-slate-600 transition p-1"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        }
                        isValid={password.length >= 6}
                      />
                    </>
                  )}

                  {/* PHONE OTP FIELDS */}
                  {mode === 'phone' && (
                    <>
                      {otpSent && (
                        <div className="space-y-4 mb-2 animate-fadeIn">
                          <UnderlinedInput 
                            value={profile.name} 
                            onChange={(value) => setProfile((c) => ({ ...c, name: value }))} 
                            placeholder="Full Name" 
                            icon={UserRound} 
                            isValid={isNameValid}
                          />
                          <UnderlinedInput 
                            value={profile.username} 
                            onChange={(value) => setProfile((c) => ({ ...c, username: value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} 
                            placeholder="Username" 
                            prefix="@" 
                            icon={UserRound} 
                            isValid={isUsernameValid}
                          />
                        </div>
                      )}
                      <UnderlinedInput 
                        value={phone} 
                        onChange={setPhone} 
                        placeholder="Phone number (+91 ...)" 
                        type="tel" 
                        icon={Phone} 
                        isValid={isPhoneValid}
                      />
                      {otpSent && (
                        <div className="space-y-4 mt-4 animate-fadeIn">
                          <UnderlinedInput 
                            value={otp} 
                            onChange={setOtp} 
                            placeholder="6-Digit OTP" 
                            inputMode="numeric" 
                            icon={ShieldCheck} 
                            isValid={isOtpValid}
                          />
                          <ProfileSetup profile={profile} setProfile={setProfile} compact />
                        </div>
                      )}
                      {otpHint && (
                        <p className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3.5 text-xs text-accent font-semibold leading-relaxed">
                          {otpHint}
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

                  {/* EMAIL VERIFICATION FIELDS */}
                  {mode === 'verifyEmail' && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-semibold text-slate-500 leading-relaxed dark:bg-slate-800/40 dark:border-slate-800">
                        Verification code sent to <span className="font-bold text-slate-800 dark:text-slate-200">{pendingEmail || email}</span>. Enter code:
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
                      className="btn-primary rounded-full px-8 py-3.5 flex items-center gap-2.5 font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {loading ? 'Please wait...' : mode === 'signup' ? (signupStep === 1 ? 'Sign Up' : 'Complete Setup') : mode === 'login' ? 'Sign In' : mode === 'phone' ? (otpSent ? 'Verify OTP' : 'Send OTP') : mode === 'guest' ? 'Enter Cafe' : 'Verify'}
                      <ChevronRight size={18} />
                    </button>

                    {(mode === 'login' || (mode === 'signup' && signupStep === 1)) && (
                      <>
                        <span className="text-slate-400 text-sm font-semibold">Or</span>
                        <div className="flex items-center gap-2.5">
                          {/* Facebook circular button */}
                          <button
                            type="button"
                            onClick={() => setSocialModal('Facebook')}
                            className="h-11 w-11 rounded-full border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 flex items-center justify-center transition active:scale-95 text-[#1877F2]"
                          >
                            <FacebookIcon />
                          </button>
                          {/* Google circular button */}
                          <button
                            type="button"
                            onClick={() => setSocialModal('Google')}
                            className="h-11 w-11 rounded-full border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 flex items-center justify-center transition active:scale-95"
                          >
                            <GoogleIcon />
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
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800/40 space-y-5">
            {/* Unified Mode switches */}
            <div className="text-xs text-slate-400 dark:text-slate-600 font-bold space-y-2.5">
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
                    <button type="button" onClick={() => switchMode('phone')} className="text-accent hover:underline">Phone OTP</button>
                    <span>•</span>
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
                    <button type="button" onClick={() => switchMode('phone')} className="text-accent hover:underline">Phone OTP</button>
                    <span>•</span>
                    <button type="button" onClick={() => switchMode('guest')} className="text-accent hover:underline">Guest Session</button>
                  </p>
                </>
              )}
              {(mode === 'phone' || mode === 'guest' || mode === 'verifyEmail') && (
                <p className="flex items-center gap-2 flex-wrap text-slate-400 font-bold">
                  <button type="button" onClick={() => switchMode('login')} className="text-accent hover:underline">Email Login</button>
                  <span>•</span>
                  <button type="button" onClick={() => switchMode('signup')} className="text-accent hover:underline">Email Signup</button>
                  {mode !== 'phone' && (
                    <>
                      <span>•</span>
                      <button type="button" onClick={() => switchMode('phone')} className="text-accent hover:underline">Phone OTP</button>
                    </>
                  )}
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
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold cursor-pointer hover:text-slate-600 transition w-fit select-none">
              <Globe size={14} />
              <span>ENG</span>
              <ChevronDown size={12} />
            </div>
          </div>
        </div>

        {/* Right Column: Wave Visual Panel (matches Dribbble Reference) */}
        <div className="hidden lg:flex relative rounded-[2rem] overflow-hidden p-8 flex-col justify-between items-stretch">
          
          {/* Wave Background using custom SVGs */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Gradient Base */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#0F766E] via-[#0D9488] to-[#14B8A6] opacity-95" />
            {/* Wave overlay 1 */}
            <svg className="absolute bottom-0 left-0 w-full h-[65%] opacity-15" viewBox="0 0 1440 800" fill="none" preserveAspectRatio="none">
              <path d="M0,280 C360,380 520,200 780,250 C1040,300 1200,450 1440,370 L1440,800 L0,800 Z" fill="#FFFFFF" />
            </svg>
            {/* Wave overlay 2 */}
            <svg className="absolute bottom-0 left-0 w-full h-[48%] opacity-20" viewBox="0 0 1440 800" fill="none" preserveAspectRatio="none">
              <path d="M0,380 C420,480 680,280 940,330 C1200,380 1320,480 1440,430 L1440,800 L0,800 Z" fill="#FFFFFF" />
            </svg>
          </div>

          {/* Floating Card 1: Stats Mockup */}
          <motion.div 
            initial={{ opacity: 0, x: 25, y: 15 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 80 }}
            className="relative z-10 bg-white/95 dark:bg-slate-900/90 rounded-3xl p-5 shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-white/20 w-[85%] ml-auto mt-6"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Inbox</span>
              <span className="text-xs font-bold text-slate-400">176,18</span>
            </div>
            
            {/* Beautiful Mini Line Chart */}
            <div className="h-16 w-full mt-4 relative">
              <svg className="h-full w-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                <path 
                  d="M0,32 Q15,8 30,25 T60,6 T90,28 L100,12" 
                  fill="none" 
                  stroke="#0D9488" 
                  strokeWidth="3.5" 
                  strokeLinecap="round" 
                />
                <path 
                  d="M0,32 Q15,8 30,25 T60,6 T90,28 L100,12 L100,40 L0,40 Z" 
                  fill="url(#chart-gradient)" 
                  opacity="0.12" 
                />
                <defs>
                  <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0D9488" />
                    <stop offset="100%" stopColor="#0D9488" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
              {/* Floating dark badge with unread count */}
              <div className="absolute top-1.5 right-12 h-6 w-6 rounded-full bg-slate-950 text-white font-extrabold text-[10px] flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md">
                45
              </div>
            </div>
          </motion.div>

          {/* Floating Card 2: Security Mockup */}
          <motion.div 
            initial={{ opacity: 0, x: -25, y: -15 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 0.45, type: "spring", stiffness: 80 }}
            className="relative z-10 bg-white/95 dark:bg-slate-900/90 rounded-3xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-white/20 w-[90%] mr-auto mt-6"
          >
            <div className="flex gap-4 items-start">
              {/* Key badge */}
              <span className="flex-shrink-0 grid place-items-center h-11 w-11 rounded-2xl bg-amber-50 dark:bg-amber-950/20 text-[#FF9800]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25z" />
                </svg>
              </span>
              
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Your data, your rules</h4>
                <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500 font-medium">
                  Your data belongs to you, and our encryption ensures that your chat tunnels remain completely private.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Social Icons floating on background waves */}
          <div className="absolute top-[32%] right-[10%] z-10 h-10 w-10 rounded-full bg-white dark:bg-slate-900 shadow-md flex items-center justify-center border border-slate-100 dark:border-slate-800 animate-bounce" style={{ animationDuration: '3s' }}>
            <span className="text-base">🎵</span> {/* TikTok placeholder */}
          </div>
          <div className="absolute top-[18%] left-[8%] z-10 h-11 w-11 rounded-full bg-white dark:bg-slate-900 shadow-md flex items-center justify-center border border-slate-100 dark:border-slate-800 animate-bounce" style={{ animationDuration: '4.5s' }}>
            <span className="text-lg">📸</span> {/* Instagram placeholder */}
          </div>
          <div className="absolute bottom-[8%] right-[18%] z-10 h-9 w-9 rounded-full bg-white dark:bg-slate-900 shadow-md flex items-center justify-center border border-slate-100 dark:border-slate-800 animate-bounce" style={{ animationDuration: '3.8s' }}>
            <span className="text-sm">💬</span>
          </div>

        </div>

      </div>

      {/* SOCIAL OAUTH MOCK MODAL */}
      <AnimatePresence>
        {socialModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !connectingSocial && setSocialModal(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-elevated p-6 z-10"
            >
              {/* Close Button */}
              {!connectingSocial && (
                <button
                  onClick={() => setSocialModal(null)}
                  className="absolute top-4 right-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X size={18} />
                </button>
              )}

              {connectingSocial ? (
                <div className="py-8 text-center space-y-4">
                  {/* Spinner */}
                  <div className="mx-auto h-12 w-12 rounded-full border-4 border-accent/25 border-t-accent animate-spin" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800 dark:text-white">Connecting to {socialModal}...</p>
                    <p className="text-xs text-slate-400">Simulating secure OAuth authentication handshake</p>
                  </div>
                  {selectedSocialProfile && (
                    <div className="flex items-center justify-center gap-2 pt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <img src={selectedSocialProfile.avatar} className="h-6 w-6 rounded-full border" alt="" />
                      <span>{selectedSocialProfile.name}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-accent">
                    <Sparkles size={20} />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Connect with {socialModal}</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    This is a development sandboxed environment. Choose a mock {socialModal} account below to authenticate immediately:
                  </p>

                  <div className="space-y-2.5 pt-2">
                    {SOCIAL_PROFILES.filter(p => p.provider === socialModal).map((profileOpt, index) => (
                      <button
                        key={index}
                        onClick={() => triggerSocialLogin(profileOpt)}
                        className="flex items-center gap-3 w-full text-left p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-accent hover:bg-accent/5 dark:hover:bg-accent/10 transition group"
                      >
                        <img 
                          src={profileOpt.avatar} 
                          className="h-10 w-10 rounded-full border border-slate-200/80 bg-white shadow-sm"
                          alt="" 
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-accent transition">{profileOpt.name}</p>
                          <p className="text-xs text-slate-400 truncate font-semibold">{profileOpt.email}</p>
                        </div>
                        <div className="text-right text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-100 dark:border-slate-700">
                          {profileOpt.age} • {profileOpt.gender}
                        </div>
                      </button>
                    ))}
                  </div>

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

function FacebookIcon() {
  return (
    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  );
}

// Subcomponents helper

function UnderlinedInput({ value, onChange, placeholder, type = 'text', inputMode, prefix, icon: Icon, suffix, isValid }) {
  return (
    <div className="flex items-center border-b border-slate-100 dark:border-slate-800 transition-all duration-200 focus-within:border-accent focus-within:scale-[1.01] w-full py-1">
      {Icon && <span className="text-slate-400 mr-3.5"><Icon size={18} /></span>}
      {prefix && <span className="text-slate-400 mr-1 text-sm font-semibold">{prefix}</span>}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent py-3 text-sm text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 font-semibold"
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
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700 ml-1 mr-1" />
      )}
      <span className={met ? "text-emerald-600 dark:text-emerald-500" : "text-slate-400 dark:text-slate-500"}>
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
    <div className="space-y-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
      <div className="grid grid-cols-2 gap-3.5">
        <UnderlinedInput 
          value={profile.age} 
          onChange={(value) => update('age', value)} 
          placeholder="Age (18+)" 
          type="number" 
          icon={UserRound}
          isValid={Number(profile.age) >= 18}
        />
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface p-1 text-xs">
          {['female', 'male'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => update('gender', value)}
              className={`rounded-xl px-2 py-2 font-bold capitalize transition-all duration-200 active:scale-[0.96] ${profile.gender === value ? 'bg-accent text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
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
          className="min-h-20 w-full resize-none rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface px-4 py-3.5 text-xs text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200 font-semibold" 
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
