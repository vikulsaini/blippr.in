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
import { api, setToken, loginWithSupabase, getToken } from '../lib/api.js';
import { getAnonymousPushSubscription } from '../lib/notifications.js';
import { supabase } from '../lib/supabase.js';

const initialProfile = { name: '', username: '', age: '', dob: '', contact: '', gender: 'female', bio: '', hobbies: '' };

const SOCIAL_PROFILES = [];

export default function Auth() {
  const isSupabaseEnabled = Boolean(supabase);
  const navigate = useNavigate();
  
  // Supported modes: 'login' | 'guest' | 'completeProfile'
  const [mode, setMode] = useState('login'); 
  const [authSubMode, setAuthSubMode] = useState('login'); // 'login' or 'signup'
  const [loginMethod, setLoginMethod] = useState('otp'); // 'otp' or 'password'
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [supabaseAccessToken, setSupabaseAccessToken] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(initialProfile);

  const syncingTokenRef = useRef(null);
  const profileRef = useRef(profile);
  const authSubModeRef = useRef(authSubMode);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    authSubModeRef.current = authSubMode;
  }, [authSubMode]);
  const [error, setError] = useState('');
  const [guestTermsAccepted, setGuestTermsAccepted] = useState(false);

  // Username status: 'idle' | 'checking' | 'available' | 'taken'
  const [usernameStatus, setUsernameStatus] = useState('idle');

  // Validation States
  const isUsernameValid = /^[a-z0-9_]{3,24}$/.test(profile.username);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordsMatch = password.length >= 8 && password === confirmPassword;

  function finishAuth(token, isGuest = false) {
    setToken(token, isGuest);
    let role = '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      role = payload.role || '';
    } catch (e) {}

    if (role === 'admin') {
      navigate('/blippr-control-center-secure-2026', { replace: true });
    } else {
      navigate(isGuest ? '/app/stranger' : '/app', { replace: true });
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setEmailHint('');
    setOtpSent(false);
    setEmailCode('');
  }

  function switchSubMode(nextSubMode) {
    setAuthSubMode(nextSubMode);
    setError('');
    setEmailHint('');
    setOtpSent(false);
    setEmailCode('');
    setPassword('');
    setConfirmPassword('');
    setUsernameStatus('idle');
  }

  // Username availability check effect
  useEffect(() => {
    const trimmed = profile.username.trim().toLowerCase();
    if (!trimmed || trimmed.length < 3 || !/^[a-z0-9_]{3,24}$/.test(trimmed)) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await api(`/api/auth/username-check?username=${trimmed}`);
        if (res.available) {
          setUsernameStatus('available');
        } else {
          setUsernameStatus('taken');
        }
      } catch (err) {
        setUsernameStatus('idle');
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [profile.username]);

  async function syncSupabaseSession(token, signupData = null) {
    if (syncingTokenRef.current === token) return;
    syncingTokenRef.current = token;

    setLoading(true);
    setError('');
    try {
      const syncPayload = { accessToken: token };
      if (signupData) {
        syncPayload.name = signupData.username;
        syncPayload.username = signupData.username;
        syncPayload.age = ageFromDob(signupData.dob);
        syncPayload.gender = signupData.gender;
      }
      const result = await loginWithSupabase(syncPayload);
      finishAuth(result.token);
    } catch (err) {
      // Throttle resetting the ref for 3 seconds to avoid infinite retry loops on rapid errors
      setTimeout(() => {
        if (syncingTokenRef.current === token) {
          syncingTokenRef.current = null;
        }
      }, 3000);
      if (err.body && err.body.code === 'PROFILE_REQUIRED') {
        setSupabaseAccessToken(token);
        setMode('completeProfile');
      } else {
        setError(err.message || 'Failed to sync authentication session.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isSupabaseEnabled) return;

    // Handle PKCE code exchange if redirected with a code parameter
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    if (code) {
      // Remove code from URL to keep it clean and avoid reuse
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
      
      setLoading(true);
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (error) {
            console.error('Error exchanging PKCE code for session:', error.message);
            setError(error.message);
            setLoading(false);
          }
        })
        .catch(err => {
          console.error('Failed to exchange PKCE code:', err);
          setError(err.message || 'Failed to complete login from email link.');
          setLoading(false);
        });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED')) {
        const hasLocalToken = Boolean(getToken());
        // Only trigger sync if we don't have a token or if we are completing profile
        if (!hasLocalToken) {
          await syncSupabaseSession(session.access_token, authSubModeRef.current === 'signup' ? profileRef.current : null);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isSupabaseEnabled]);

  async function signInWithGoogle() {
    setError('');
    setLoading(true);
    try {
      if (!supabase) {
        throw new Error('Google sign-in is currently unavailable (Supabase configuration missing).');
      }
      const { error: oAuthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/auth'
        }
      });
      if (oAuthError) throw oAuthError;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function sendEmailOtp() {
    setError('');
    setOtpSending(true);
    try {
      if (!isEmailValid) {
        throw new Error('Please enter a valid email address.');
      }
      if (!supabase) {
        throw new Error('OTP login is currently unavailable (Supabase configuration missing).');
      }
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase()
      });
      if (otpError) throw otpError;
      setOtpSent(true);
      setEmailHint('6-digit verification code sent to your email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setOtpSending(false);
    }
  }

  async function handleEmailSignup(event) {
    if (event) event.preventDefault();
    setError('');
    
    if (!isUsernameValid) {
      setError('Please enter a valid username (3-24 characters, lowercase, numbers, underscores).');
      return;
    }
    if (usernameStatus !== 'available') {
      setError('Selected username is not available.');
      return;
    }
    if (!isEmailValid) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!profile.dob) {
      setError('Date of birth is required.');
      return;
    }
    if (ageFromDob(profile.dob) < 18) {
      setError('You must be 18 years or older to join.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setOtpSending(true);
    try {
      if (!supabase) {
        throw new Error('Email signup is currently unavailable (Supabase configuration missing).');
      }
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: password
      });
      if (signUpError) throw signUpError;
      setOtpSent(true);
      setEmailHint('6-digit verification code sent to your email to verify your signup.');
    } catch (err) {
      setError(err.message);
    } finally {
      setOtpSending(false);
    }
  }

  async function handleEmailPasswordLogin(event) {
    if (event) event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!supabase) {
        throw new Error('Email login is currently unavailable (Supabase configuration missing).');
      }
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: password
      });
      if (loginError) throw loginError;
      if (data.session) {
        await syncSupabaseSession(data.session.access_token, null);
      } else {
        throw new Error('Login succeeded, but no session was returned.');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function verifyEmailOtp() {
    setError('');
    setLoading(true);
    try {
      if (!supabase) {
        throw new Error('OTP verification is currently unavailable (Supabase configuration missing).');
      }
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.toLowerCase(),
        token: emailCode,
        type: authSubMode === 'signup' ? 'signup' : 'email'
      });
      if (verifyError) throw verifyError;
      if (data.session) {
        await syncSupabaseSession(data.session.access_token, authSubMode === 'signup' ? profile : null);
      } else {
        throw new Error('Verification succeeded, but no session was returned.');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function submitCompleteProfile(event) {
    if (event) event.preventDefault();
    setError('');
    
    if (!isUsernameValid) {
      setError('Please enter a valid username (3-24 characters, lowercase, numbers, underscores).');
      return;
    }
    if (!profile.dob) {
      setError('Date of birth is required.');
      return;
    }
    if (ageFromDob(profile.dob) < 18) {
      setError('You must be 18 years or older to join.');
      return;
    }

    setLoading(true);
    try {
      const result = await loginWithSupabase({
        accessToken: supabaseAccessToken,
        name: profile.username,
        username: profile.username,
        age: ageFromDob(profile.dob),
        gender: profile.gender,
        bio: '',
        interests: []
      });
      finishAuth(result.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function continueAsGuest(event) {
    event.preventDefault();
    if (!profile.name?.trim()) {
      setError('Profile name is required');
      return;
    }
    if (Number(profile.age) < 18) {
      setError('You must be 18 or older to join.');
      return;
    }
    if (!guestTermsAccepted) {
      setError('You must accept the terms and conditions.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { token } = await api('/api/auth/guest', {
        method: 'POST',
        body: JSON.stringify({ name: profile.name, age: Number(profile.age), gender: profile.gender, bio: profile.bio })
      });
      finishAuth(token, true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full bg-[#F8FAFC] text-[#191c1e] flex flex-col items-center justify-center p-4 overflow-hidden relative vibrant-gradient">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Content Canvas */}
      <div className="w-full max-w-md flex flex-col items-center gap-6 z-10 animate-fadeIn duration-500">
        {/* Brand Logo Area */}
        <div className="mb-4 text-center">
          <h1 className="font-display-lg text-4xl font-bold text-primary tracking-tighter">Blippr</h1>
          <p className="text-xs text-[#3d3748] uppercase tracking-widest mt-1">Electric Social Connection</p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel w-full p-8 rounded-3xl shadow-2xl flex flex-col gap-6 bg-white/70 backdrop-blur-xl border border-black/5">
          {/* Tab Toggle (Only in Login mode, when OTP not sent) */}
          {mode === 'login' && !otpSent && (
            <div className="flex p-1 bg-slate-100/50 rounded-full w-full overflow-hidden border border-black/5 text-xs font-bold">
              <button
                type="button"
                onClick={() => switchSubMode('login')}
                className={`flex-1 py-2.5 rounded-full text-center transition-all duration-300 ${authSubMode === 'login' ? 'bg-primary text-white shadow-md' : 'text-[#4a4455] hover:text-primary'}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => switchSubMode('signup')}
                className={`flex-1 py-2.5 rounded-full text-center transition-all duration-300 ${authSubMode === 'signup' ? 'bg-primary text-white shadow-md' : 'text-[#4a4455] hover:text-primary'}`}
              >
                Sign Up
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={`${mode}-${authSubMode}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22 }}
              className="flex flex-col gap-5"
            >
              {/* Form Headline */}
              <div className="text-center">
                <h2 className="text-xl font-bold tracking-tight text-[#191c1e]">
                  {mode === 'guest' ? 'Guest Setup' : ''}
                  {mode === 'completeProfile' ? 'Complete Profile' : ''}
                  {mode === 'login' && (authSubMode === 'login' ? 'Welcome Back' : 'Create Account')}
                </h2>
                <p className="text-xs font-semibold text-[#4a4455] mt-1 max-w-xs mx-auto leading-relaxed">
                  {mode === 'guest' && 'Enter instantly without an email address.'}
                  {mode === 'completeProfile' && 'Choose your unique username, gender, and date of birth to complete setup.'}
                  {mode === 'login' && (authSubMode === 'login' ? 'Access your account instantly via Google, OTP, or Password.' : 'Sign up via email verification and customize your profile.')}
                </p>
              </div>

              <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4">
                
                {/* Google OAuth Button */}
                {mode === 'login' && !otpSent && (
                  <div className="flex flex-col gap-4">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={signInWithGoogle}
                      className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 py-3.5 rounded-full font-bold text-sm active:scale-95 transition-all shadow-md hover:bg-slate-50 disabled:opacity-50 border border-black/10"
                    >
                      <GoogleIcon />
                      <span>Continue with Google</span>
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-4 py-1">
                      <div className="h-[1px] flex-1 bg-black/10" />
                      <span className="text-[#5c5768] text-[10px] font-bold uppercase tracking-wider">OR</span>
                      <div className="h-[1px] flex-1 bg-black/10" />
                    </div>
                  </div>
                )}

                {/* LOGIN SUB-MODE SURFACES */}
                {mode === 'login' && authSubMode === 'login' && (
                  <div className="flex flex-col gap-4">
                    {/* Login Method Toggle */}
                    {!otpSent && (
                      <div className="flex items-center justify-center gap-6 text-[11px] font-bold text-[#3d3748] mb-2 select-none">
                        <button
                          type="button"
                          onClick={() => setLoginMethod('otp')}
                          className={`pb-1 border-b-2 transition ${loginMethod === 'otp' ? 'text-primary border-primary' : 'border-transparent hover:text-slate-800'}`}
                        >
                          OTP Code
                        </button>
                        <button
                          type="button"
                          onClick={() => setLoginMethod('password')}
                          className={`pb-1 border-b-2 transition ${loginMethod === 'password' ? 'text-primary border-primary' : 'border-transparent hover:text-slate-800'}`}
                        >
                          Password
                        </button>
                      </div>
                    )}

                    {/* OTP Login Method */}
                    {loginMethod === 'otp' ? (
                      <div className="flex flex-col gap-4">
                        {!otpSent ? (
                          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                            <div className="w-full">
                              <UnderlinedInput 
                                value={email} 
                                onChange={setEmail} 
                                placeholder="Email Address" 
                                type="email" 
                                isValid={isEmailValid}
                                disabled={loading || otpSending}
                              />
                            </div>
                            <button
                              type="button"
                              disabled={!isEmailValid || loading || otpSending}
                              onClick={sendEmailOtp}
                              className="h-14 px-5 rounded-full border border-primary/30 hover:bg-primary/5 font-bold text-xs transition active:scale-95 disabled:opacity-30 text-primary"
                            >
                              {otpSending ? 'Sending...' : 'Send OTP'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-4 animate-fadeIn">
                            <p className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary font-semibold leading-relaxed">
                              {emailHint || 'Verification code sent.'}
                            </p>
                            <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                              <div className="w-full">
                                <UnderlinedInput 
                                  value={emailCode} 
                                  onChange={setEmailCode} 
                                  placeholder="6-digit OTP code" 
                                  inputMode="numeric" 
                                  isValid={emailCode.length === 6}
                                />
                              </div>
                              <button
                                type="button"
                                disabled={emailCode.length !== 6 || loading}
                                onClick={verifyEmailOtp}
                                className="h-14 px-6 rounded-full bg-primary text-white font-bold text-xs transition active:scale-95 disabled:opacity-50"
                              >
                                {loading ? 'Verifying...' : 'Verify'}
                              </button>
                            </div>
                            <div className="text-center pt-2">
                              <button
                                type="button"
                                onClick={() => { setOtpSent(false); setEmailCode(''); }}
                                className="text-xs text-[#4a4455] hover:text-primary font-bold transition underline"
                              >
                                Change email address
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Password Login Method */
                      <div className="flex flex-col gap-4 animate-fadeIn">
                        <UnderlinedInput 
                          value={email} 
                          onChange={setEmail} 
                          placeholder="Email Address" 
                          type="email" 
                          isValid={isEmailValid}
                          disabled={loading}
                        />
                        <UnderlinedInput 
                          value={password} 
                          onChange={setPassword} 
                          placeholder="Password" 
                          type="password" 
                          isValid={password.length >= 8}
                          disabled={loading}
                        />
                        <button
                          type="submit"
                          onClick={handleEmailPasswordLogin}
                          disabled={loading || !isEmailValid || password.length < 8}
                          className="w-full h-14 bg-primary text-white font-bold rounded-full shadow-[0_8px_20px_rgba(124,58,237,0.25)] active:scale-95 transition-all hover:brightness-110 disabled:opacity-50 text-xs"
                        >
                          {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* SIGN UP SUB-MODE SURFACES */}
                {mode === 'login' && authSubMode === 'signup' && (
                  <div className="flex flex-col gap-4">
                    {!otpSent ? (
                      <div className="flex flex-col gap-4 animate-fadeIn">
                        {/* Username Checker */}
                        <div className="relative">
                          <UnderlinedInput 
                            value={profile.username} 
                            onChange={(value) => setProfile((c) => ({ ...c, username: value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} 
                            placeholder="Choose Username" 
                            prefix="@"
                            isValid={usernameStatus === 'available'}
                          />
                          {usernameStatus === 'checking' && (
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-text-muted text-xs font-bold animate-pulse">Checking...</span>
                          )}
                          {usernameStatus === 'taken' && (
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-danger text-xs font-bold">Taken</span>
                          )}
                          {usernameStatus === 'available' && (
                            <span className="absolute right-12 top-1/2 -translate-y-1/2 text-success text-[10px] font-bold">Available</span>
                          )}
                        </div>

                        {/* Email input */}
                        <UnderlinedInput 
                          value={email} 
                          onChange={setEmail} 
                          placeholder="Email Address" 
                          type="email" 
                          isValid={isEmailValid}
                        />

                        {/* Age / DOB Input */}
                        <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_0.9fr] gap-3 items-center">
                          <UnderlinedInput 
                            value={profile.dob} 
                            onChange={(value) => setProfile((c) => ({ ...c, dob: value }))} 
                            placeholder="Date of Birth" 
                            type="date" 
                            isValid={profile.dob && ageFromDob(profile.dob) >= 18}
                          />
                          
                          {/* Gender Select */}
                          <div className="grid grid-cols-2 gap-0.5 rounded-full border border-border-default bg-slate-100/50 p-1 text-[11px] h-14 items-center">
                            {['female', 'male'].map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setProfile((c) => ({ ...c, gender: value }))}
                                className={`group relative rounded-full py-2.5 font-bold capitalize transition-all duration-200 active:scale-[0.96] z-10 ${profile.gender === value ? 'text-white' : 'text-[#4a4455] hover:text-primary'}`}
                              >
                                {profile.gender === value && (
                                  <motion.span
                                    layoutId="signup-gender-pill"
                                    className="absolute inset-0 rounded-full bg-primary -z-10 shadow-md"
                                    transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                                  />
                                )}
                                {value}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Password Fields */}
                        <UnderlinedInput 
                          value={password} 
                          onChange={setPassword} 
                          placeholder="Password (8+ chars)" 
                          type="password" 
                          isValid={password.length >= 8}
                        />
                        <div className="relative">
                          <input 
                            type="password" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            className={`w-full bg-slate-100/40 border rounded-full py-4 px-6 pr-12 text-sm text-[#191c1e] placeholder:text-[#5c5768] outline-none focus:ring-2 focus:ring-primary/25 transition-all duration-200 font-semibold ${passwordsMatch ? 'border-success/80 focus:border-success shadow-[0_0_12px_rgba(16,185,129,0.15)]' : confirmPassword.length >= 8 ? 'border-danger/80 focus:border-danger' : 'border-black/5 focus:border-primary/80'}`}
                            placeholder="Confirm Password"
                          />
                          {passwordsMatch && (
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-success flex-shrink-0 animate-fadeIn">
                              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </div>

                        {confirmPassword && !passwordsMatch && (
                          <p className="text-[10px] text-danger font-semibold pl-4">
                            {password.length < 8 ? 'Password must be at least 8 characters' : 'Passwords do not match'}
                          </p>
                        )}
                        {passwordsMatch && (
                          <p className="text-[10px] text-success font-semibold pl-4 flex items-center gap-1.5 animate-fadeIn">
                            <span className="h-1.5 w-1.5 rounded-full bg-success animate-ping" />
                            Passwords match!
                          </p>
                        )}

                        <button
                          type="submit"
                          onClick={handleEmailSignup}
                          disabled={otpSending || usernameStatus !== 'available' || !isEmailValid || !profile.dob || ageFromDob(profile.dob) < 18 || password.length < 8 || password !== confirmPassword}
                          className="w-full h-14 bg-primary text-white font-bold rounded-full shadow-[0_8px_20px_rgba(124,58,237,0.25)] active:scale-95 transition-all hover:brightness-110 disabled:opacity-50 text-xs mt-2"
                        >
                          {otpSending ? 'Sending OTP...' : 'Create Account'}
                        </button>
                      </div>
                    ) : (
                      /* OTP Code for signup */
                      <div className="flex flex-col gap-4 animate-fadeIn">
                        <p className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary font-semibold leading-relaxed">
                          {emailHint || 'Verification code sent.'}
                        </p>
                        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                          <div className="w-full">
                            <UnderlinedInput 
                              value={emailCode} 
                              onChange={setEmailCode} 
                              placeholder="6-digit OTP code" 
                              inputMode="numeric" 
                              isValid={emailCode.length === 6}
                            />
                          </div>
                          <button
                            type="button"
                            disabled={emailCode.length !== 6 || loading}
                            onClick={verifyEmailOtp}
                            className="h-14 px-6 rounded-full bg-primary text-white font-bold text-xs transition active:scale-95 disabled:opacity-50"
                          >
                            {loading ? 'Verifying...' : 'Verify'}
                          </button>
                        </div>
                        <div className="text-center pt-2">
                          <button
                            type="button"
                            onClick={() => { setOtpSent(false); setEmailCode(''); }}
                            className="text-xs text-[#4a4455] hover:text-primary font-bold transition underline"
                          >
                            Go back to signup
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* COMPLETE PROFILE FIELDS */}
                {mode === 'completeProfile' && (
                  <div className="flex flex-col gap-5 animate-fadeIn">
                    <UnderlinedInput 
                      value={profile.username} 
                      onChange={(value) => setProfile((c) => ({ ...c, username: value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} 
                      placeholder="Choose Username" 
                      prefix="@"
                      isValid={isUsernameValid}
                    />
                    
                    {/* Gender Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#3d3748] font-bold uppercase tracking-wider pl-4">Gender</label>
                      <div className="grid grid-cols-2 gap-1 rounded-full border border-black/5 bg-slate-100/50 p-1 text-xs">
                        {['female', 'male'].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setProfile((c) => ({ ...c, gender: value }))}
                            className={`group relative rounded-full px-2 py-2.5 font-bold capitalize transition-all duration-200 active:scale-[0.96] z-10 ${profile.gender === value ? 'text-white' : 'text-[#4a4455] hover:text-primary'}`}
                          >
                            {profile.gender === value && (
                              <motion.span
                                layoutId="complete-gender-pill"
                                className="absolute inset-0 rounded-full bg-primary -z-10 shadow-md"
                                transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                              />
                            )}
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Date of Birth */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#3d3748] font-bold uppercase tracking-wider pl-4">Date of Birth</label>
                      <UnderlinedInput 
                        value={profile.dob} 
                        onChange={(value) => setProfile((c) => ({ ...c, dob: value }))} 
                        placeholder="DOB" 
                        type="date" 
                        isValid={profile.dob && ageFromDob(profile.dob) >= 18}
                      />
                    </div>
                  </div>
                )}

                {/* GUEST FIELDS */}
                {mode === 'guest' && (
                  <div className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-slate-100/30 p-4 transition-colors duration-[350ms]">
                    <UnderlinedInput 
                      value={profile.name} 
                      onChange={(value) => setProfile((c) => ({ ...c, name: value }))} 
                      placeholder="Profile Name" 
                      isValid={profile.name.trim().length >= 2}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <UnderlinedInput 
                        value={profile.age} 
                        onChange={(value) => setProfile((c) => ({ ...c, age: value }))} 
                        placeholder="Age (18+)" 
                        type="number" 
                        isValid={Number(profile.age) >= 18}
                      />
                      <div className="grid grid-cols-2 gap-1 rounded-full border border-black/5 bg-slate-100/50 p-1 text-xs h-14 items-center">
                        {['female', 'male'].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setProfile((c) => ({ ...c, gender: value }))}
                            className={`group relative rounded-full px-2 py-2.5 font-bold capitalize transition-all duration-200 active:scale-[0.96] z-10 ${profile.gender === value ? 'text-white' : 'text-[#4a4455] hover:text-primary'}`}
                          >
                            {profile.gender === value && (
                              <motion.span
                                layoutId="guest-gender-pill"
                                className="absolute inset-0 rounded-full bg-primary -z-10 shadow-md"
                                transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                              />
                            )}
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 pt-2 select-none">
                      <input
                        id="guest-terms"
                        type="checkbox"
                        checked={guestTermsAccepted}
                        onChange={(e) => setGuestTermsAccepted(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-black/10 text-primary focus:ring-primary/25 bg-slate-100"
                      />
                      <label htmlFor="guest-terms" className="text-xs text-[#4a4455] leading-normal font-semibold cursor-pointer">
                        I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a>, and I certify that I am 18 years of age or older.
                      </label>
                    </div>
                  </div>
                )}

                {error && (
                  <motion.p 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs font-semibold text-danger bg-danger/10 border border-danger/25 p-3 rounded-2xl animate-fadeIn text-center animate-shake"
                  >
                    {error}
                  </motion.p>
                )}

                {/* Actions Row: Submit Button (only for Guest or Complete Profile modes) */}
                {(mode === 'guest' || mode === 'completeProfile') && (
                  <div className="space-y-4 mt-4 pt-2">
                    <button
                      type="submit"
                      disabled={loading || (mode === 'completeProfile' && (!isUsernameValid || !profile.dob || ageFromDob(profile.dob) < 18))}
                      onClick={mode === 'completeProfile' ? verifyEmailOtp : handleGuestLogin}
                      className="w-full h-14 bg-primary text-white font-bold rounded-full shadow-[0_8px_20px_rgba(124,58,237,0.25)] flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-sm"
                    >
                      {loading ? 'Please wait...' : mode === 'completeProfile' ? 'Complete Registration' : 'Enter Cafe'}
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}

                {/* Mode Switching */}
                <div className="text-center pt-2">
                  {mode === 'login' ? (
                    <button type="button" onClick={() => switchMode('guest')} className="text-xs text-[#4a4455] font-bold hover:text-primary hover:underline transition">
                      Continue as Guest
                    </button>
                  ) : (
                    <button type="button" onClick={() => switchMode('login')} className="text-xs text-[#4a4455] font-bold hover:text-primary hover:underline transition">
                      Return to Login
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Security Badge */}
        <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-200/40 backdrop-blur-sm border border-black/5 shadow-sm text-xs font-semibold text-[#3d3748] self-center">
          <ShieldCheck size={16} className="text-[#00687a]" />
          <span className="uppercase tracking-wider">End-to-End Encrypted Access</span>
        </div>
      </div>
    </main>
  );
}

// Social Icons

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
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

function AppleIcon() {
  return (
    <svg className="h-4.5 w-4.5 fill-current text-white" viewBox="0 0 24 24">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.56 2.95-1.39z" />
    </svg>
  );
}

// Subcomponents helper

function UnderlinedInput({ value, onChange, placeholder, type = 'text', inputMode, prefix, icon: Icon, suffix, isValid }) {
  return (
    <div className="relative w-full">
      {prefix && (
        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted text-sm font-semibold select-none">
          {prefix}
        </span>
      )}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full bg-surface-hover/40 border border-border-default rounded-full py-4 ${prefix ? 'pl-11' : 'px-6'} pr-12 text-sm text-text-primary placeholder:text-text-muted/60 outline-none focus:border-accent/80 focus:ring-2 focus:ring-accent/25 transition-all duration-200 font-semibold`}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
      />
      {suffix && <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center">{suffix}</div>}
      {!suffix && isValid && (
        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-success flex-shrink-0 animate-fadeIn">
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path className="animate-draw-checkmark" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
    </div>
  );
}

function PasswordRule({ met, text }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold">
      {met ? (
        <span className="text-success flex items-center justify-center">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600 ml-1 mr-1" />
      )}
      <span className={met ? "text-success" : "text-text-muted"}>
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
    <div className="space-y-4 rounded-2xl border border-border-default bg-surface-hover/30 p-4 transition-colors duration-[350ms]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <UnderlinedInput 
          value={profile.age} 
          onChange={(value) => update('age', value)} 
          placeholder="Age (18+)" 
          type="number" 
          isValid={Number(profile.age) >= 18}
        />
        <div className="grid grid-cols-2 gap-1 rounded-full border border-border-default bg-surface-hover/40 p-1 text-xs h-14 items-center">
          {['female', 'male'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => update('gender', value)}
              className={`group relative rounded-full px-2 py-2.5 font-bold capitalize transition-all duration-200 active:scale-[0.96] z-10 ${profile.gender === value ? 'text-white' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {profile.gender === value && (
                <motion.span
                  layoutId="signup-gender-pill"
                  className="absolute inset-0 rounded-full bg-accent -z-10 shadow-md"
                  transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                />
              )}
              {value}
            </button>
          ))}
        </div>
      </div>
      
      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <UnderlinedInput 
            value={profile.dob} 
            onChange={(value) => update('dob', value)} 
            placeholder="DOB" 
            type="date" 
            isValid={!!profile.dob}
          />
          <UnderlinedInput 
            value={profile.contact} 
            onChange={(value) => update('contact', value)} 
            placeholder="Contact info" 
            isValid={profile.contact.trim().length >= 4}
          />
        </div>
      )}
      
      {!compact && (
        <UnderlinedInput 
          value={profile.hobbies} 
          onChange={(value) => update('hobbies', value)} 
          placeholder="Hobbies (e.g. music, coding)" 
          isValid={profile.hobbies.trim().length >= 2}
        />
      )}
      
      {!compact && (
        <textarea 
          value={profile.bio} 
          onChange={(event) => update('bio', event.target.value)} 
          className="min-h-20 w-full resize-none rounded-2xl border border-border-default bg-surface-hover/40 px-4 py-3.5 text-xs text-text-primary outline-none placeholder:text-text-muted/60 focus:border-accent/80 focus:ring-2 focus:ring-accent/25 transition-all duration-200 font-semibold" 
          placeholder="Write a short bio..." 
          maxLength={160} 
        />
      )}
      
      {compact && (
        <UnderlinedInput 
          value={profile.bio} 
          onChange={(value) => update('bio', value)} 
          placeholder="Short bio..." 
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
