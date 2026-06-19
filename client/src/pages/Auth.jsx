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
import { api, setToken, loginWithSupabase } from '../lib/api.js';
import { getAnonymousPushSubscription } from '../lib/notifications.js';
import { supabase } from '../lib/supabase.js';

const initialProfile = { name: '', username: '', age: '', dob: '', contact: '', gender: 'female', bio: '', hobbies: '' };

const SOCIAL_PROFILES = [];

export default function Auth() {
  const isSupabaseEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  const navigate = useNavigate();
  const [mode, setMode] = useState('signup'); // 'signup' | 'login' | 'guest' | 'verifyEmail' | 'forgotPassword' | 'resetPassword'
  const [signupStep, setSignupStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [supabaseAccessToken, setSupabaseAccessToken] = useState('');
  const [googleAge, setGoogleAge] = useState('18');
  const [googleGender, setGoogleGender] = useState('female');
  const [googleBio, setGoogleBio] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState('');
  const [guestTermsAccepted, setGuestTermsAccepted] = useState(false);
  
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

  function finishAuth(token, isGuest = false) {
    setToken(token, isGuest);
    navigate(isGuest ? '/app/stranger' : '/app', { replace: true });
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setSignupStep(1);
    setError('');
    setEmailHint('');
    setConfirmPassword('');
    setOtpSent(false);
    setEmailVerified(false);
    setSupabaseAccessToken('');
    setEmailCode('');
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

  async function sendSupabaseSignupOtp() {
    setError('');
    setOtpSending(true);
    try {
      if (!isEmailValid) {
        throw new Error('Please enter a valid email address.');
      }
      if (!isPasswordValid) {
        throw new Error('Please satisfy all password rules before sending OTP.');
      }
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: password
      });
      if (signUpError) throw signUpError;

      setOtpSent(true);
      setEmailHint('6-digit confirmation code sent to your email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setOtpSending(false);
    }
  }

  async function verifySupabaseSignupOtp() {
    setError('');
    setLoading(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.toLowerCase(),
        token: emailCode,
        type: 'signup'
      });
      if (verifyError) throw verifyError;

      if (!data.session) {
        throw new Error('Verification succeeded, but no session was returned. Please try logging in.');
      }

      setSupabaseAccessToken(data.session.access_token);
      setEmailVerified(true);
      setEmailHint('Email successfully verified! Click Complete Setup below to finish.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

    if (mode === 'signup') {
      if (!isUsernameValid) {
        setError('Please enter a valid username (3-24 characters, lowercase, numbers, underscores).');
        return;
      }
      if (!isEmailValid) {
        setError('Please enter a valid email address.');
        return;
      }
      if (!isPasswordValid) {
        setError('Please satisfy all password requirements.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!profile.dob) {
        setError('Date of birth is required.');
        return;
      }
      if (ageFromDob(profile.dob) < 18) {
        setError('You must be 18 years or older to sign up.');
        return;
      }

      setLoading(true);
      try {
        if (isSupabaseEnabled) {
          if (!emailVerified || !supabaseAccessToken) {
            setError('Please verify your email via the OTP code first.');
            setLoading(false);
            return;
          }

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
          return;
        }

        // Fallback standard signup
        let subscription = null;
        if ('Notification' in window && Notification.permission === 'granted') {
          subscription = await getAnonymousPushSubscription();
        }
        const result = await api('/api/auth/email/signup', {
          method: 'POST',
          body: JSON.stringify({
            name: profile.username,
            username: profile.username,
            email,
            password,
            age: ageFromDob(profile.dob),
            dob: profile.dob,
            gender: profile.gender,
            pushSubscription: subscription
          })
        });

        if (result.verificationRequired) {
          showEmailVerification(result);
          return;
        }
        finishAuth(result.token);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'login') {
      setLoading(true);
      try {
        if (isSupabaseEnabled) {
          const { data, error: loginError } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase(),
            password: password
          });
          if (loginError) throw loginError;

          const accessToken = data.session.access_token;
          const result = await loginWithSupabase({
            accessToken,
            name: profile.username || undefined,
            username: profile.username || undefined,
            age: profile.dob ? ageFromDob(profile.dob) : undefined,
            gender: profile.gender || undefined
          });
          finishAuth(result.token);
          return;
        }

        let subscription = null;
        if ('Notification' in window && Notification.permission === 'granted') {
          subscription = await getAnonymousPushSubscription();
        }
        const result = await api('/api/auth/email/login', {
          method: 'POST',
          body: JSON.stringify({ email, password, pushSubscription: subscription })
        });
        if (result.verificationRequired) {
          showEmailVerification(result);
          return;
        }
        finishAuth(result.token);
      } catch (err) {
        if (err.code === 'EMAIL_NOT_VERIFIED') showEmailVerification(err.body || {}, email);
        else setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }
  }

  async function verifyEmail(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSupabaseEnabled) {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email: (pendingEmail || email).toLowerCase(),
          token: emailCode,
          type: 'email'
        });
        if (verifyError) throw verifyError;

        const accessToken = data.session.access_token;

        const result = await loginWithSupabase({
          accessToken,
          name: profile.name,
          username: profile.username,
          age: Number(profile.age || 18),
          gender: profile.gender,
          bio: profile.bio || '',
          interests: profile.hobbies.split(',').map((i) => i.trim()).filter(Boolean)
        });

        finishAuth(result.token);
        return;
      }

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
      if (isSupabaseEnabled) {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: (pendingEmail || email).toLowerCase(),
          options: {
            shouldCreateUser: true
          }
        });
        if (otpError) throw otpError;

        setEmailHint('New verification code sent via Supabase.');
        return;
      }

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

  async function handlePushResend() {
    setError('');
    setEmailHint('');
    setLoading(true);
    try {
      const subscription = await getAnonymousPushSubscription();
      if (!subscription) {
        throw new Error('Please enable notification permissions to receive OTP via Push.');
      }
      const result = await api('/api/auth/email/resend', {
        method: 'POST',
        body: JSON.stringify({ email: pendingEmail || email, pushSubscription: subscription })
      });
      setEmailHint(result.message || 'Verification code sent via push notification.');
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
    <main className="relative min-h-screen w-full bg-[#030508] text-white flex items-center justify-center p-4 md:p-8 overflow-hidden font-sans">
      {/* Top Ambient Glow Orb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[450px] bg-gradient-to-b from-[#1d4ed8]/35 via-[#2563eb]/10 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-[1.1fr_0.9fr] gap-8 xl:gap-16 items-stretch min-h-[700px]">
        
        {/* Left Column: Form Content */}
        <div className="flex flex-col justify-between bg-black/30 backdrop-blur-2xl border border-white/5 shadow-2xl rounded-[2.5rem] p-6 sm:p-10 lg:p-12 space-y-8 relative overflow-hidden">
          
          {/* Header/Logo section */}
          <div>
            <div className="flex justify-center mb-8">
              <BrandLogo className="text-white [&_.text-text-primary]:text-white [&_.text-text-muted]:text-zinc-500 [&_span.bg-surface]:bg-[#111827]/80 [&_span.border-border-default]:border-white/10" />
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
                <div className="space-y-2 text-center">
                  <h2 className="text-3xl font-extrabold tracking-tight text-white animate-fadeIn">
                    {mode === 'signup' ? 'Create an Account' : ''}
                    {mode === 'login' ? 'Hi There!' : ''}
                    {mode === 'guest' ? 'Guest Setup' : ''}
                    {mode === 'verifyEmail' ? 'Verify Email' : ''}
                    {mode === 'forgotPassword' ? 'Reset Password' : ''}
                    {mode === 'resetPassword' ? 'New Password' : ''}
                  </h2>
                  <p className="text-xs font-semibold text-zinc-400 max-w-md mx-auto leading-relaxed animate-fadeIn">
                    {mode === 'signup' && 'To create an account, provide details, verify email, and set a password.'}
                    {mode === 'login' && 'Please enter required details.'}
                    {mode === 'guest' && 'Enter instantly without an email address.'}
                    {mode === 'verifyEmail' && 'Secure authentication checkpoint.'}
                    {mode === 'forgotPassword' && 'Enter your email to receive a reset code.'}
                    {mode === 'resetPassword' && 'Enter the 6-digit code and your new password.'}
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
                  
                  {/* Social Login Buttons (Google & Apple) */}
                  {(mode === 'login' || (mode === 'signup' && signupStep === 1)) && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Google button */}
                        <button
                          type="button"
                          onClick={() => setSocialModal('Google')}
                          className="h-14 px-6 rounded-full border border-white/10 hover:border-accent/50 hover:bg-white/5 flex items-center gap-3 justify-center transition active:scale-95 bg-[#111827]/40 font-semibold text-sm text-white"
                        >
                          <GoogleIcon />
                          <span>Google</span>
                        </button>
                        
                        {/* Apple button (mock) */}
                        <button
                          type="button"
                          onClick={() => alert('Apple Sign-in is coming soon!')}
                          className="h-14 px-6 rounded-full border border-white/10 hover:border-accent/50 hover:bg-white/5 flex items-center gap-3 justify-center transition active:scale-95 bg-[#111827]/40 font-semibold text-sm text-white"
                        >
                          <AppleIcon />
                          <span>Apple</span>
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="flex items-center gap-4 py-2">
                        <div className="h-[1px] flex-1 bg-white/10" />
                        <span className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">Or</span>
                        <div className="h-[1px] flex-1 bg-white/10" />
                      </div>
                    </div>
                  )}
                  
                  {/* SIGNUP FIELDS */}
                  {mode === 'signup' && (
                    <>
                      <UnderlinedInput 
                        value={profile.username} 
                        onChange={(value) => setProfile((c) => ({ ...c, username: value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} 
                        placeholder="Username" 
                        prefix="@"
                        isValid={isUsernameValid}
                        disabled={emailVerified}
                      />
                      
                      {/* Gender Selector */}
                      <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-[#111827]/40 p-1 text-xs">
                        {['female', 'male'].map((value) => (
                          <button
                            key={value}
                            type="button"
                            disabled={emailVerified}
                            onClick={() => setProfile((c) => ({ ...c, gender: value }))}
                            className={`group relative rounded-full px-2 py-2.5 font-bold capitalize transition-all duration-200 active:scale-[0.96] z-10 ${profile.gender === value ? 'text-white' : 'text-zinc-400 hover:text-white'} disabled:opacity-50`}
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

                      {/* Date of Birth */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-4">Date of Birth</label>
                        <UnderlinedInput 
                          value={profile.dob} 
                          onChange={(value) => setProfile((c) => ({ ...c, dob: value }))} 
                          placeholder="DOB" 
                          type="date" 
                          isValid={profile.dob && ageFromDob(profile.dob) >= 18}
                          disabled={emailVerified}
                        />
                      </div>

                      {/* Email with Inline Send OTP Button */}
                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                          <UnderlinedInput 
                            value={email} 
                            onChange={setEmail} 
                            placeholder="Email Address" 
                            type="email" 
                            isValid={isEmailValid}
                            disabled={emailVerified}
                          />
                        </div>
                        {isSupabaseEnabled && !emailVerified && (
                          <button
                            type="button"
                            disabled={!isEmailValid || !isPasswordValid || password !== confirmPassword || loading || otpSending}
                            onClick={sendSupabaseSignupOtp}
                            className="h-14 px-5 rounded-full border border-accent/35 hover:border-accent hover:bg-accent/5 font-bold text-xs transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-accent"
                          >
                            {otpSent ? 'Resend OTP' : 'Send OTP'}
                          </button>
                        )}
                        {isSupabaseEnabled && emailVerified && (
                          <span className="text-emerald-500 font-bold text-xs flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 rounded-full animate-fadeIn">
                            ✓ Verified
                          </span>
                        )}
                      </div>

                      {/* Inline OTP Field (Only visible when OTP is sent and not verified) */}
                      {isSupabaseEnabled && otpSent && !emailVerified && (
                        <div className="flex gap-2 items-center animate-fadeIn">
                          <div className="flex-1">
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
                            onClick={verifySupabaseSignupOtp}
                            className="h-14 px-6 rounded-full bg-gradient-to-r from-accent to-accent-hover text-white font-bold text-xs transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                          >
                            {loading ? 'Verifying...' : 'Verify'}
                          </button>
                        </div>
                      )}

                      {/* Passwords */}
                      <UnderlinedInput 
                        value={password} 
                        onChange={setPassword} 
                        placeholder="Password" 
                        type={showPassword ? 'text' : 'password'} 
                        disabled={emailVerified}
                        suffix={
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-zinc-500 hover:text-zinc-300 transition p-1"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        }
                        isValid={isPasswordValid}
                      />
                      
                      <UnderlinedInput 
                        value={confirmPassword} 
                        onChange={setConfirmPassword} 
                        placeholder="Confirm Password" 
                        type={showPassword ? 'text' : 'password'} 
                        disabled={emailVerified}
                        isValid={confirmPassword.length > 0 && password === confirmPassword}
                      />

                      {/* Password Rules Checklist */}
                      {!emailVerified && (
                        <div className="space-y-1.5 pt-1">
                          <PasswordRule met={hasMinLength} text="Least 8 characters" />
                          <PasswordRule met={hasNumOrSymbol} text="Least one number (0-9) or a symbol" />
                          <PasswordRule met={hasMixedCase} text="Lowercase (a-z) and uppercase (A-Z)" />
                          {password.length > 0 && (
                            <div className="mt-2 flex gap-1">
                              {[hasMinLength, hasNumOrSymbol, hasMixedCase].map((met, i) => (
                                <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${met ? 'bg-emerald-500' : 'bg-white/10'}`} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* SIGN IN FIELDS */}
                  {mode === 'login' && (
                    <>
                      <UnderlinedInput 
                        value={email} 
                        onChange={setEmail} 
                        placeholder="Email Address" 
                        type="email" 
                        isValid={isEmailValid}
                      />
                      <div className="space-y-2">
                        <UnderlinedInput 
                          value={password} 
                          onChange={setPassword} 
                          placeholder="Password" 
                          type={showPassword ? 'text' : 'password'} 
                          suffix={
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-zinc-500 hover:text-zinc-300 transition p-1"
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          }
                          isValid={password.length >= 6}
                        />
                        <div className="flex justify-end">
                          <button type="button" onClick={() => switchMode('forgotPassword')} className="text-[11px] font-bold text-cyan-400 hover:underline">Forgot password?</button>
                        </div>
                      </div>
                      
                      {emailHint && (
                        <p className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs text-cyan-400 font-semibold leading-relaxed">
                          {emailHint}
                        </p>
                      )}
                    </>
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
                      <div className="grid grid-cols-2 gap-3.5">
                        <UnderlinedInput 
                          value={profile.age} 
                          onChange={(value) => setProfile((c) => ({ ...c, age: value }))} 
                          placeholder="Age (18+)" 
                          type="number" 
                          isValid={Number(profile.age) >= 18}
                        />
                        <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-[#111827]/40 p-1 text-xs">
                          {['female', 'male'].map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setProfile((c) => ({ ...c, gender: value }))}
                              className={`group relative rounded-full px-2 py-2.5 font-bold capitalize transition-all duration-200 active:scale-[0.96] z-10 ${profile.gender === value ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
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
                        <label htmlFor="guest-terms" className="text-xs text-zinc-400 leading-normal font-semibold cursor-pointer">
                          I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Privacy Policy</a>, and I certify that I am 18 years of age or older.
                        </label>
                      </div>
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
                        isValid={isEmailValid}
                      />
                    </div>
                  )}

                  {/* RESET PASSWORD FIELDS */}
                  {mode === 'resetPassword' && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs font-semibold text-zinc-400 leading-relaxed transition-colors duration-[350ms]">
                        Reset code sent to <span className="font-bold text-white">{email}</span>. Enter code:
                      </div>
                      <UnderlinedInput 
                        value={emailCode} 
                        onChange={setEmailCode} 
                        placeholder="6-digit code" 
                        inputMode="numeric" 
                        isValid={emailCode.length === 6}
                      />
                      <UnderlinedInput 
                        value={password} 
                        onChange={setPassword} 
                        placeholder="New Password" 
                        type={showPassword ? 'text' : 'password'} 
                        suffix={
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-zinc-500 hover:text-zinc-300 transition p-1"
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
                        <p className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs text-cyan-400 font-semibold leading-relaxed">
                          {emailHint}
                        </p>
                      )}
                    </div>
                  )}

                  {/* EMAIL VERIFICATION FIELDS */}
                  {mode === 'verifyEmail' && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs font-semibold text-zinc-400 leading-relaxed transition-colors duration-[350ms]">
                        Verification code sent to <span className="font-bold text-white">{pendingEmail || email}</span>. Enter code:
                      </div>
                      <UnderlinedInput 
                        value={emailCode} 
                        onChange={setEmailCode} 
                        placeholder="6-digit code" 
                        inputMode="numeric" 
                        isValid={emailCode.length === 6}
                      />
                      {emailHint && (
                        <p className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs text-cyan-400 font-semibold leading-relaxed">
                          {emailHint}
                        </p>
                      )}
                      <div className="flex flex-col gap-2 pt-2">
                        {!isSupabaseEnabled && (
                          <button
                            type="button"
                            onClick={handlePushResend}
                            disabled={loading}
                            className="w-full py-3 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-bold rounded-2xl flex items-center justify-center gap-2 transition duration-200 text-xs active:scale-[0.98]"
                          >
                            🔔 Send code via Push Notification (Free)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={resendEmailCode}
                          disabled={loading}
                          className="w-full py-2 px-4 text-zinc-400 hover:text-zinc-300 font-semibold text-[11px] transition"
                        >
                          Resend Code via Email
                        </button>
                      </div>
                    </div>
                  )}

                  {error && (
                    <motion.p 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-2xl animate-fadeIn"
                    >
                      {error}
                    </motion.p>
                  )}

                  {/* Actions Row: Submit Pill & Social Circles */}
                  <div className="space-y-4 mt-8 pt-2">
                    <button
                      type="submit"
                      disabled={loading || (mode === 'signup' && isSupabaseEnabled && !emailVerified)}
                      className="w-full h-14 bg-gradient-to-r from-accent via-accent-hover to-success hover:from-accent-hover hover:to-success text-white font-bold rounded-full shadow-lg shadow-accent/20 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-sm"
                    >
                      {loading ? 'Please wait...' : mode === 'signup' ? 'Complete Setup' : mode === 'login' ? 'Log In' : mode === 'guest' ? 'Enter Cafe' : mode === 'forgotPassword' ? 'Send Reset Code' : mode === 'resetPassword' ? 'Update Password' : 'Verify'}
                      <ChevronRight size={18} />
                    </button>

                    {/* Action Links */}
                    <div className="text-center pt-2">
                      {mode === 'login' && (
                        <p className="text-sm text-zinc-400">
                          Create an account?{' '}
                          <button type="button" onClick={() => switchMode('signup')} className="text-accent font-bold hover:underline">
                            Sign Up
                          </button>
                        </p>
                      )}
                      {mode === 'signup' && (
                        <p className="text-sm text-zinc-400">
                          Have an account?{' '}
                          <button type="button" onClick={() => switchMode('login')} className="text-cyan-400 font-bold hover:underline">
                            Log In
                          </button>
                        </p>
                      )}
                      {(mode === 'guest' || mode === 'verifyEmail' || mode === 'forgotPassword' || mode === 'resetPassword') && (
                        <div className="flex items-center justify-center gap-3 text-xs text-zinc-500 font-bold">
                          <button type="button" onClick={() => switchMode('login')} className="text-cyan-400 hover:underline">Email Login</button>
                          <span>•</span>
                          <button type="button" onClick={() => switchMode('signup')} className="text-cyan-400 hover:underline">Email Signup</button>
                          {mode !== 'guest' && (
                            <>
                              <span>•</span>
                              <button type="button" onClick={() => switchMode('guest')} className="text-cyan-400 hover:underline">Guest Session</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {(mode === 'login' || mode === 'signup') && (
                      <div className="text-center">
                        <button type="button" onClick={() => switchMode('guest')} className="text-xs text-zinc-500 font-bold hover:text-zinc-300 hover:underline transition">
                          Continue as Guest
                        </button>
                      </div>
                    )}
                  </div>
                </form>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer links */}
          <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-zinc-500">
            <div className="flex items-center gap-3">
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 hover:underline">Terms of Service</a>
              <span>|</span>
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 hover:underline">Privacy Policy</a>
            </div>
            
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-300 transition select-none text-[11px]">
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
              <span className="text-xs text-zinc-400 font-semibold select-none">
                Out regular users
              </span>
            </div>

            {/* Next/Skip buttons */}
            <div className="flex items-center gap-4">
              <button 
                type="button"
                onClick={() => switchMode('guest')}
                className="text-xs text-zinc-500 font-bold hover:text-zinc-300 transition"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                className="w-12 h-12 rounded-full bg-gradient-to-r from-accent to-accent-hover hover:from-accent-hover hover:to-accent flex items-center justify-center text-white shadow-lg shadow-accent/25 active:scale-95 transition"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
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
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#0e1322] shadow-2xl p-6 z-10"
            >
              {/* Close Button */}
              {!loading && (
                <button
                  onClick={() => setSocialModal(null)}
                  className="absolute top-4 right-4 rounded-full p-1.5 text-zinc-500 hover:bg-white/5 transition"
                >
                  <X size={18} />
                </button>
              )}

              {loading ? (
                <div className="py-8 text-center space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-full border-4 border-cyan-500/25 border-t-cyan-500 animate-spin" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">Connecting to Google...</p>
                    <p className="text-xs text-zinc-500">Verifying secure Google authentication token</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Sparkles size={20} />
                    <h3 className="text-lg font-bold text-white">Google Profile Setup</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                    Age and gender are required to secure our chat channels. Please complete these details:
                  </p>

                  <div className="space-y-4 rounded-2xl border border-white/5 bg-black/20 p-4">
                    <div className="grid grid-cols-2 gap-3.5">
                      <UnderlinedInput 
                        value={googleAge} 
                        onChange={setGoogleAge} 
                        placeholder="Age (18+)" 
                        type="number" 
                        isValid={isGoogleInputValid}
                      />
                      <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-[#111827]/40 p-1 text-xs">
                        {['female', 'male'].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setGoogleGender(value)}
                            className={`group relative rounded-full px-2 py-2.5 font-bold capitalize transition-all duration-200 active:scale-[0.96] z-10 ${googleGender === value ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
                          >
                            {googleGender === value && (
                              <motion.span
                                layoutId="google-gender-pill"
                                className="absolute inset-0 rounded-full bg-gradient-to-r from-accent to-accent-hover -z-10 shadow-md"
                                transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                              />
                            )}
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <textarea 
                      value={googleBio} 
                      onChange={(event) => setGoogleBio(event.target.value)} 
                      className="min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-[#111827]/40 px-4 py-3.5 text-xs text-white outline-none placeholder:text-zinc-500 focus:border-accent/80 focus:ring-2 focus:ring-accent/20 transition-all duration-200 font-semibold" 
                      placeholder="Write a short bio (optional)..." 
                      maxLength={160} 
                    />
                  </div>

                  {isGoogleInputValid ? (
                    <div className="flex flex-col items-center justify-center p-4 border border-dashed border-white/10 rounded-2xl bg-black/20 transition-colors duration-[350ms]">
                      <p className="text-[10px] text-zinc-500 font-bold mb-2.5">Continue with Google:</p>
                      <div id="google-signin-button" className="w-full flex justify-center py-1"></div>
                    </div>
                  ) : (
                    <div className="text-center p-3 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-semibold">
                      You must be 18 years or older to sign in.
                    </div>
                  )}

                  <button
                    onClick={() => setSocialModal(null)}
                    className="w-full py-3.5 rounded-full border border-white/10 hover:bg-white/5 text-xs font-bold mt-2 text-zinc-400 hover:text-white transition"
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
    <div className="relative flex items-center w-full">
      {prefix && (
        <span className="absolute left-6 text-zinc-500 text-sm font-semibold select-none">
          {prefix}
        </span>
      )}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full bg-[#111827]/40 border border-white/10 rounded-full py-4 ${prefix ? 'pl-11' : 'px-6'} pr-12 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-accent/80 focus:ring-2 focus:ring-accent/20 transition-all duration-200 font-semibold`}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
      />
      {suffix && <div className="absolute right-6 flex items-center">{suffix}</div>}
      {!suffix && isValid && (
        <span className="absolute right-6 text-emerald-500 flex-shrink-0 animate-fadeIn">
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
      <span className={met ? "text-emerald-500" : "text-zinc-500"}>
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
      <div className="grid grid-cols-2 gap-3.5">
        <UnderlinedInput 
          value={profile.age} 
          onChange={(value) => update('age', value)} 
          placeholder="Age (18+)" 
          type="number" 
          isValid={Number(profile.age) >= 18}
        />
        <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-[#111827]/40 p-1 text-xs">
          {['female', 'male'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => update('gender', value)}
              className={`group relative rounded-full px-2 py-2.5 font-bold capitalize transition-all duration-200 active:scale-[0.96] z-10 ${profile.gender === value ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
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
        <div className="grid grid-cols-2 gap-3.5">
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
          className="min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-[#111827]/40 px-4 py-3.5 text-xs text-white outline-none placeholder:text-zinc-500 focus:border-accent/80 focus:ring-2 focus:ring-accent/20 transition-all duration-200 font-semibold" 
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
