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
    <main className="relative min-h-screen w-full bg-[#030508] text-white flex items-center justify-center p-4 md:p-8 overflow-hidden font-sans">
      {/* Top Ambient Glow Orb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[450px] bg-gradient-to-b from-[#1d4ed8]/35 via-[#2563eb]/10 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-[1.1fr_0.9fr] gap-8 xl:gap-16 items-stretch min-h-[700px]">
        
        {/* Left Column: Form Content */}
        <div className="flex flex-col justify-between bg-black/30 backdrop-blur-2xl border border-white/5 shadow-2xl rounded-[2.5rem] p-6 sm:p-10 lg:p-12 space-y-8 relative overflow-hidden">
          
          {/* Header/Logo section */}
          <div>
            <div className="flex justify-center mb-6">
              <BrandLogo className="text-white [&_.text-text-primary]:text-white [&_.text-text-muted]:text-zinc-400 [&_span.bg-surface]:bg-[#111827]/80 [&_span.border-border-default]:border-white/10" />
            </div>

            {/* Sub-mode Tab Selector (Only in Login mode, when OTP not sent) */}
            {mode === 'login' && !otpSent && (
              <div className="flex rounded-full bg-[#111827]/60 p-1 border border-white/5 text-xs mb-6 max-w-sm mx-auto font-bold">
                <button
                  type="button"
                  onClick={() => switchSubMode('login')}
                  className={`flex-1 py-2.5 rounded-full text-center transition-all ${authSubMode === 'login' ? 'bg-gradient-to-r from-accent to-accent-hover text-white shadow-md' : 'text-zinc-300 hover:text-white'}`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => switchSubMode('signup')}
                  className={`flex-1 py-2.5 rounded-full text-center transition-all ${authSubMode === 'signup' ? 'bg-gradient-to-r from-accent to-accent-hover text-white shadow-md' : 'text-zinc-300 hover:text-white'}`}
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
                className="space-y-5"
              >
                {/* Form Headline */}
                <div className="space-y-1.5 text-center">
                  <h2 className="text-2xl font-extrabold tracking-tight text-white">
                    {mode === 'guest' ? 'Guest Setup' : ''}
                    {mode === 'completeProfile' ? 'Complete Profile' : ''}
                    {mode === 'login' && (authSubMode === 'login' ? 'Welcome Back' : 'Create Account')}
                  </h2>
                  <p className="text-xs font-semibold text-zinc-300 max-w-md mx-auto leading-relaxed">
                    {mode === 'guest' && 'Enter instantly without an email address.'}
                    {mode === 'completeProfile' && 'Choose your unique username, gender, and date of birth to complete setup.'}
                    {mode === 'login' && (authSubMode === 'login' ? 'Access your account instantly via Google, OTP, or Password.' : 'Sign up via email verification and customize your profile.')}
                  </p>
                </div>

                <form onSubmit={(e) => e.preventDefault()} className="space-y-4 pt-1">
                  
                  {/* Google OAuth Button (if not otpSent) */}
                  {mode === 'login' && !otpSent && (
                    <div className="space-y-4">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={signInWithGoogle}
                        className="w-full h-13 px-6 rounded-full border border-white/10 hover:border-accent/50 hover:bg-white/5 flex items-center gap-3 justify-center transition active:scale-95 bg-[#111827]/40 font-semibold text-xs text-white disabled:opacity-50"
                      >
                        <GoogleIcon />
                        <span>Continue with Google</span>
                      </button>

                      {/* Divider */}
                      <div className="flex items-center gap-4 py-1">
                        <div className="h-[1px] flex-1 bg-white/10" />
                        <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Or</span>
                        <div className="h-[1px] flex-1 bg-white/10" />
                      </div>
                    </div>
                  )}

                  {/* LOGIN SUB-MODE SURFACES */}
                  {mode === 'login' && authSubMode === 'login' && (
                    <div className="space-y-4">
                      
                      {/* Login Method Toggle */}
                      {!otpSent && (
                        <div className="flex items-center justify-center gap-6 text-[11px] font-bold text-zinc-400 mb-2 select-none">
                          <button
                            type="button"
                            onClick={() => setLoginMethod('otp')}
                            className={`pb-1 border-b-2 transition ${loginMethod === 'otp' ? 'text-accent border-accent' : 'border-transparent hover:text-zinc-300'}`}
                          >
                            OTP Code
                          </button>
                          <button
                            type="button"
                            onClick={() => setLoginMethod('password')}
                            className={`pb-1 border-b-2 transition ${loginMethod === 'password' ? 'text-accent border-accent' : 'border-transparent hover:text-zinc-300'}`}
                          >
                            Password
                          </button>
                        </div>
                      )}

                      {/* OTP Login Method */}
                      {loginMethod === 'otp' ? (
                        <div className="space-y-4">
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
                                className="h-14 px-5 rounded-full border border-accent/35 hover:border-accent hover:bg-accent/5 font-bold text-xs transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-accent"
                              >
                                {otpSending ? 'Sending...' : 'Send OTP'}
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-4 animate-fadeIn">
                              <p className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs text-accent font-semibold leading-relaxed">
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
                                  className="h-14 px-6 rounded-full bg-gradient-to-r from-accent to-accent-hover text-white font-bold text-xs transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                  {loading ? 'Verifying...' : 'Verify'}
                                </button>
                              </div>
                              <div className="text-center pt-2">
                                <button
                                  type="button"
                                  onClick={() => { setOtpSent(false); setEmailCode(''); }}
                                  className="text-xs text-zinc-300 hover:text-white font-bold transition underline"
                                >
                                  Change email address
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Password Login Method */
                        <div className="space-y-4 animate-fadeIn">
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
                            className="w-full h-14 bg-gradient-to-r from-accent to-accent-hover text-white font-bold rounded-full shadow-lg shadow-accent/25 active:scale-95 transition disabled:opacity-50 text-xs"
                          >
                            {loading ? 'Signing in...' : 'Sign In'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SIGN UP SUB-MODE SURFACES */}
                  {mode === 'login' && authSubMode === 'signup' && (
                    <div className="space-y-4">
                      {!otpSent ? (
                        <div className="space-y-4 animate-fadeIn">
                          {/* Username with availability checker */}
                          <div className="relative">
                            <UnderlinedInput 
                              value={profile.username} 
                              onChange={(value) => setProfile((c) => ({ ...c, username: value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} 
                              placeholder="Choose Username" 
                              prefix="@"
                              isValid={usernameStatus === 'available'}
                            />
                            {usernameStatus === 'checking' && (
                              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-300 text-xs font-bold animate-pulse">Checking...</span>
                            )}
                            {usernameStatus === 'taken' && (
                              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-red-500 text-xs font-bold">Taken</span>
                            )}
                            {usernameStatus === 'available' && (
                              <span className="absolute right-12 top-1/2 -translate-y-1/2 text-emerald-500 text-[10px] font-bold">Available</span>
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
                            <div className="grid grid-cols-2 gap-0.5 rounded-full border border-white/10 bg-[#111827]/40 p-1 text-[11px] h-14 items-center">
                              {['female', 'male'].map((value) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setProfile((c) => ({ ...c, gender: value }))}
                                  className={`group relative rounded-full py-2.5 font-bold capitalize transition-all duration-200 active:scale-[0.96] z-10 ${profile.gender === value ? 'text-white' : 'text-zinc-300 hover:text-white'}`}
                                >
                                  {profile.gender === value && (
                                    <motion.span
                                      layoutId="signup-gender-pill"
                                      className="absolute inset-0 rounded-full bg-gradient-to-r from-accent to-accent-hover -z-10 shadow-md"
                                      transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                                    />
                                  )}
                                  {value}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Password & Matcher Effect */}
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
                              className={`w-full bg-[#111827]/40 border rounded-full py-4 px-6 pr-12 text-sm text-white placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-accent/20 transition-all duration-200 font-semibold ${passwordsMatch ? 'border-emerald-500/80 focus:border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.15)]' : confirmPassword.length >= 8 ? 'border-red-500/80 focus:border-red-500' : 'border-white/10 focus:border-accent/80'}`}
                              placeholder="Confirm Password"
                            />
                            {passwordsMatch && (
                              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-emerald-500 flex-shrink-0 animate-fadeIn">
                                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                  <path className="animate-draw-checkmark" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            )}
                          </div>

                          {confirmPassword && !passwordsMatch && (
                            <p className="text-[10px] text-red-400 font-semibold pl-4">
                              {password.length < 8 ? 'Password must be at least 8 characters' : 'Passwords do not match'}
                            </p>
                          )}
                          {passwordsMatch && (
                            <p className="text-[10px] text-emerald-400 font-semibold pl-4 flex items-center gap-1.5 animate-fadeIn">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                              Passwords match!
                            </p>
                          )}

                          <button
                            type="submit"
                            onClick={handleEmailSignup}
                            disabled={otpSending || usernameStatus !== 'available' || !isEmailValid || !profile.dob || ageFromDob(profile.dob) < 18 || password.length < 8 || password !== confirmPassword}
                            className="w-full h-14 bg-gradient-to-r from-accent to-accent-hover text-white font-bold rounded-full shadow-lg shadow-accent/25 active:scale-95 transition disabled:opacity-50 text-xs mt-2"
                          >
                            {otpSending ? 'Sending OTP...' : 'Send Signup OTP'}
                          </button>
                        </div>
                      ) : (
                        /* OTP Verification Box for Signup */
                        <div className="space-y-4 animate-fadeIn">
                          <p className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs text-accent font-semibold leading-relaxed">
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
                              className="h-14 px-6 rounded-full bg-gradient-to-r from-accent to-accent-hover text-white font-bold text-xs transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                            >
                              {loading ? 'Verifying...' : 'Verify'}
                            </button>
                          </div>
                          <div className="text-center pt-2">
                            <button
                              type="button"
                              onClick={() => { setOtpSent(false); setEmailCode(''); }}
                              className="text-xs text-zinc-300 hover:text-white font-bold transition underline"
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
                    <div className="space-y-5 animate-fadeIn">
                      <UnderlinedInput 
                        value={profile.username} 
                        onChange={(value) => setProfile((c) => ({ ...c, username: value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} 
                        placeholder="Choose Username" 
                        prefix="@"
                        isValid={isUsernameValid}
                      />
                      
                      {/* Gender Selector */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider pl-4">Gender</label>
                        <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-[#111827]/40 p-1 text-xs">
                          {['female', 'male'].map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setProfile((c) => ({ ...c, gender: value }))}
                              className={`group relative rounded-full px-2 py-2.5 font-bold capitalize transition-all duration-200 active:scale-[0.96] z-10 ${profile.gender === value ? 'text-white' : 'text-zinc-300 hover:text-white'}`}
                            >
                              {profile.gender === value && (
                                <motion.span
                                  layoutId="complete-gender-pill"
                                  className="absolute inset-0 rounded-full bg-gradient-to-r from-accent to-accent-hover -z-10 shadow-md"
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
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider pl-4">Date of Birth</label>
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
                    <div className="space-y-4 rounded-2xl border border-white/5 bg-black/20 p-4 transition-colors duration-[350ms]">
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
                        <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-[#111827]/40 p-1 text-xs h-14 items-center">
                          {['female', 'male'].map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setProfile((c) => ({ ...c, gender: value }))}
                              className={`group relative rounded-full px-2 py-2.5 font-bold capitalize transition-all duration-200 active:scale-[0.96] z-10 ${profile.gender === value ? 'text-white' : 'text-zinc-300 hover:text-white'}`}
                            >
                              {profile.gender === value && (
                                <motion.span
                                  layoutId="guest-gender-pill"
                                  className="absolute inset-0 rounded-full bg-gradient-to-r from-accent to-accent-hover -z-10 shadow-md"
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
                          className="mt-1 h-4 w-4 rounded border-white/10 text-cyan-400 focus:ring-cyan-400/25 bg-black/20"
                        />
                        <label htmlFor="guest-terms" className="text-xs text-zinc-300 leading-normal font-semibold cursor-pointer">
                          I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Privacy Policy</a>, and I certify that I am 18 years of age or older.
                        </label>
                      </div>
                    </div>
                  )}

                  {error && (
                    <motion.p 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-2xl animate-fadeIn animate-shake text-center"
                    >
                      {error}
                    </motion.p>
                  )}

                  {/* Actions Row: Submit Button (only for Guest or Complete Profile modes) */}
                  {(mode === 'guest' || mode === 'completeProfile') && (
                    <div className="space-y-4 mt-8 pt-2">
                      <button
                        type="submit"
                        disabled={loading || (mode === 'completeProfile' && (!isUsernameValid || !profile.dob || ageFromDob(profile.dob) < 18))}
                        className="w-full h-14 bg-gradient-to-r from-accent via-accent-hover to-success hover:from-accent-hover hover:to-success text-white font-bold rounded-full shadow-lg shadow-accent/20 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-sm"
                      >
                        {loading ? 'Please wait...' : mode === 'completeProfile' ? 'Complete Registration' : 'Enter Cafe'}
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  )}

                  {/* Mode Switching & Navigation Links */}
                  <div className="space-y-4 pt-4">
                    <div className="text-center">
                      {mode === 'login' ? (
                        <button type="button" onClick={() => switchMode('guest')} className="text-xs text-zinc-300 font-bold hover:text-white hover:underline transition">
                          Continue as Guest
                        </button>
                      ) : (
                        <button type="button" onClick={() => switchMode('login')} className="text-xs text-zinc-300 font-bold hover:text-white hover:underline transition">
                          Return to Login
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer links */}
          <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-zinc-300">
            <div className="flex items-center gap-3">
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">Terms of Service</a>
              <span>|</span>
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">Privacy Policy</a>
            </div>
            
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition select-none text-[11px]">
              <Globe size={13} />
              <span>ENGLISH (US)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Modern Visual Onboarding Panel (Desktop/Tablet) */}
        <div className="hidden lg:flex relative rounded-[2.5rem] bg-gradient-to-b from-[#0B0F19] to-[#030508] border border-white/5 shadow-2xl p-10 flex-col justify-between items-stretch overflow-hidden">
          {/* Logo Header */}
          <div className="flex items-center gap-2">
            <BrandLogo compact className="text-white [&_span.bg-surface]:bg-[#111827]/80 [&_span.border-border-default]:border-white/10" />
          </div>

          {/* Central Globe illustration */}
          <div className="flex-1 flex items-center justify-center py-6 relative">
            <div className="absolute w-72 h-72 bg-accent/15 rounded-full blur-[80px] z-0" />
            <img 
              src="/auth_globe.png" 
              alt="Glowing Earth Globe" 
              className="w-80 h-80 object-contain relative z-10 animate-[pulse_6s_infinite_ease-in-out]" 
            />
          </div>

          {/* Onboarding Typography */}
          <div className="space-y-4">
            <span className="text-xs font-bold text-accent uppercase tracking-[0.2em] select-none">Connect Instantly</span>
            <h3 className="text-3xl font-extrabold leading-tight text-white select-none">
              Share <span className="bg-gradient-to-r from-accent to-success bg-clip-text text-transparent">Moment</span><br />
              Around You!
            </h3>
          </div>

          {/* Stats & Controls */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
            {/* Avatar row */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                <img className="w-8 h-8 rounded-full border border-[#030508] object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80" alt="User 1" />
                <img className="w-8 h-8 rounded-full border border-[#030508] object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80" alt="User 2" />
                <img className="w-8 h-8 rounded-full border border-[#030508] object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80" alt="User 3" />
                <div className="w-8 h-8 rounded-full border border-[#030508] bg-gradient-to-r from-accent to-accent-hover flex items-center justify-center text-[10px] font-bold text-white">
                  +17M
                </div>
              </div>
              <span className="text-xs text-zinc-300 font-semibold select-none">
                Our regular users
              </span>
            </div>

            {/* Next/Skip buttons */}
            <div className="flex items-center gap-4">
              <button 
                type="button"
                onClick={() => switchMode('guest')}
                className="text-xs text-zinc-300 font-bold hover:text-white transition"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => switchMode(mode === 'login' ? 'guest' : 'login')}
                className="w-12 h-12 rounded-full bg-gradient-to-r from-accent to-accent-hover hover:from-accent-hover hover:to-accent flex items-center justify-center text-white shadow-lg shadow-accent/25 active:scale-95 transition"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
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
        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-semibold select-none">
          {prefix}
        </span>
      )}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full bg-[#111827]/40 border border-white/10 rounded-full py-4 ${prefix ? 'pl-11' : 'px-6'} pr-12 text-sm text-white placeholder:text-zinc-400 outline-none focus:border-accent/80 focus:ring-2 focus:ring-accent/20 transition-all duration-200 font-semibold`}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
      />
      {suffix && <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center">{suffix}</div>}
      {!suffix && isValid && (
        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-emerald-500 flex-shrink-0 animate-fadeIn">
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
        <span className="text-emerald-500 flex items-center justify-center">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600 ml-1 mr-1" />
      )}
      <span className={met ? "text-emerald-500" : "text-zinc-400"}>
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
    <div className="space-y-4 rounded-2xl border border-white/5 bg-black/20 p-4 transition-colors duration-[350ms]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <UnderlinedInput 
          value={profile.age} 
          onChange={(value) => update('age', value)} 
          placeholder="Age (18+)" 
          type="number" 
          isValid={Number(profile.age) >= 18}
        />
        <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-[#111827]/40 p-1 text-xs h-14 items-center">
          {['female', 'male'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => update('gender', value)}
              className={`group relative rounded-full px-2 py-2.5 font-bold capitalize transition-all duration-200 active:scale-[0.96] z-10 ${profile.gender === value ? 'text-white' : 'text-zinc-300 hover:text-white'}`}
            >
              {profile.gender === value && (
                <motion.span
                  layoutId="signup-gender-pill"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-accent to-accent-hover -z-10 shadow-md"
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
          className="min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-[#111827]/40 px-4 py-3.5 text-xs text-white outline-none placeholder:text-zinc-400 focus:border-accent/80 focus:ring-2 focus:ring-accent/20 transition-all duration-200 font-semibold" 
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
