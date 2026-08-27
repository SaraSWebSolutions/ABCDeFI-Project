import React, { useState } from 'react';
import { useAuth } from '../Context/AuthContext';
import { useWallet } from '../Context/WalletContext';
import { DEVELOPMENT_AUTH_ENABLED } from '../Config/auth';
import { Lock, Mail, User, Globe, ArrowRight, ShieldCheck, KeyRound, AlertCircle, CheckCircle2, Phone, Tag, RefreshCw, Eye, EyeOff } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const {
    loginStep1,
    verifyLoginOtp,
    resendLoginOtp,
    register,
    verifyRegisterOtp,
    resendRegisterOtp,
    forgotPasswordRequest,
    verifyForgotPasswordOtp,
    resetPasswordSubmit,
    pendingAuth,
    setPendingAuth,
  } = useAuth();
  const { address, isConnecting, isCorrectNetwork, loginWithSignature, switchChain } = useWallet();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register extra state
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [country, setCountry] = useState('United States');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [refId, setRefId] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // OTP State
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // State indicators
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetFormAlerts = () => {
    setError(null);
    setSuccessMessage(null);
    setOtpCode('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormAlerts();

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await loginStep1(email, password);

      if (!result.success) {
        setError(result.message || 'Login failed. Please check your credentials.');
      } else if (result.require2FA) {
        setSuccessMessage(result.message || 'Verification OTP sent to your email.');
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Authentication server unavailable. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify2FAOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormAlerts();

    if (!/^\d{6}$/.test(otpCode)) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (!pendingAuth?.userId) {
      setError('Session expired. Please sign in again.');
      setPendingAuth(null);
      return;
    }

    setIsSubmitting(true);
    const result = await verifyLoginOtp(pendingAuth.userId, otpCode);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.message || 'Invalid 2FA code. Please check and try again.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormAlerts();

    if (!name.trim() || !email.trim() || !password) {
      setError('Full Name, Email, and Password are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setError('Password must be at least 8 characters with 1 uppercase, 1 number & 1 special character (@$!%*?&).');
      return;
    }

    if (!privacyAccepted) {
      setError('You must accept the Privacy Policy to create an account.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobileNumber: mobileNumber?.trim() || '',
        country: country?.trim() || '',
        password,
        refId: refId?.trim() || undefined,
        privacyData: true,
      });

      if (!result?.success) {
        setError(result?.message || 'Registration failed.');
        return;
      }

      setSuccessMessage(
        result.message || 'Verification code sent to your email.'
      );

      setPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      console.error('[Registration] Failed:', error);

      const registrationError = error as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const message =
        registrationError.response?.data?.message ||
        registrationError.response?.data?.error ||
        registrationError.message ||
        'Unable to create account. Please try again.';

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormAlerts();

    if (!/^\d{6}$/.test(otpCode)) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (!pendingAuth?.userId) {
      setError('Session expired. Please register again.');
      return;
    }

    setIsSubmitting(true);
    const result = await verifyRegisterOtp(pendingAuth.userId, otpCode);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.message || 'Verification failed. Invalid OTP.');
    } else {
      setMode('login');
      setSuccessMessage('Email verified successfully! You can now log in.');
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormAlerts();

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    const result = await forgotPasswordRequest(email);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.message || 'Failed to send reset code.');
    } else {
      setSuccessMessage(result.message || 'Password reset OTP sent to your email.');
    }
  };

  const handleVerifyForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormAlerts();

    if (!/^\d{6}$/.test(otpCode)) {
      setError('Please enter the OTP code.');
      return;
    }

    if (!pendingAuth?.userId) {
      setError('Session expired. Please try again.');
      return;
    }

    setIsSubmitting(true);
    const result = await verifyForgotPasswordOtp(pendingAuth.userId, otpCode);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.message || 'Invalid reset code.');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormAlerts();

    if (!newPassword || newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!pendingAuth?.userId) {
      setError('Session expired. Please try again.');
      return;
    }

    setIsSubmitting(true);
    const result = await resetPasswordSubmit(pendingAuth.userId, newPassword);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.message || 'Failed to reset password.');
    } else {
      setMode('login');
      setSuccessMessage('Password updated successfully! Please sign in with your new password.');
    }
  };

  const handleResendOtp = async () => {
    if (!pendingAuth?.userId) return;
    setIsSubmitting(true);
    let res;
    if (pendingAuth.step === 'LOGIN_2FA') {
      res = await resendLoginOtp(pendingAuth.userId);
    } else {
      res = await resendRegisterOtp(pendingAuth.userId);
    }
    setIsSubmitting(false);
    if (res?.success) {
      setSuccessMessage(res.message || 'A new verification OTP has been sent.');
    } else {
      setError('Failed to resend OTP.');
    }
  };

  const handleDevelopmentWalletSignIn = async () => {
    resetFormAlerts();
    setIsSubmitting(true);
    try {
      await loginWithSignature();
      setSuccessMessage('Wallet signature verified. Opening your local dashboard…');
    } catch (signInError: unknown) {
      setError(signInError instanceof Error ? signInError.message : 'Wallet authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (DEVELOPMENT_AUTH_ENABLED) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="w-full max-w-md z-10">
          <div className="text-center mb-6">
            <img src="/images/login_logo.svg" alt="ABCDeFi Logo" className="w-16 h-16 object-contain mx-auto drop-shadow-xl mb-3" />
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">ABCDeFi</h1>
            <p className="text-xs text-slate-400 font-medium mt-1">Local development authentication</p>
          </div>
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800/80 shadow-2xl backdrop-blur-xl">
            <h2 className="text-xl font-bold text-center text-white">Sign in with MetaMask</h2>
            <p className="text-xs text-slate-400 mt-2 text-center leading-relaxed">
              Local-only mode. The backend verifies a real wallet signature; no email, SMS, or OTP is sent.
              This is not production authentication.
            </p>
            {address && <p className="mt-4 text-xs text-slate-300 text-center font-mono">Connected: {address}</p>}
            {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
            {successMessage && <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{successMessage}</p>}
            {address && !isCorrectNetwork && (
              <button type="button" onClick={() => void switchChain('Hardhat Local').catch((switchError: unknown) => setError(switchError instanceof Error ? switchError.message : 'Unable to switch network.'))}
                className="w-full mt-4 py-2.5 px-4 rounded-xl font-bold text-xs border border-amber-400/50 text-amber-200 hover:bg-amber-400/10 transition">
                Switch to Hardhat Local (31337)
              </button>
            )}
            <button type="button" onClick={() => void handleDevelopmentWalletSignIn()} disabled={isSubmitting || isConnecting}
              className="w-full mt-5 py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:from-emerald-400 hover:to-cyan-400 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50">
              {isSubmitting || isConnecting ? 'Waiting for MetaMask…' : address ? 'Sign MetaMask Challenge' : 'Connect MetaMask & Sign In'}
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-500 mt-6">ABCDeFi Local Development • Canonical Hardhat chain 31337</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 my-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <img
            src="/images/login_logo.svg"
            alt="ABCDeFi Logo"
            className="w-16 h-16 object-contain mx-auto drop-shadow-xl mb-3"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/images/abcdefi-logo.svg';
            }}
          />
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            ABCDeFi
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Decentralized Collateral Lending Protocol
          </p>
        </div>

        {/* Card Container */}
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800/80 shadow-2xl backdrop-blur-xl relative">
          {/* Header Title */}
          <div className="mb-5 text-center">
            <h2 className="text-xl font-bold text-white">
              {pendingAuth?.step === 'LOGIN_2FA' && '2FA Security Check'}
              {pendingAuth?.step === 'REGISTER_OTP' && 'Verify Email OTP'}
              {pendingAuth?.step === 'FORGOT_OTP' && 'Verify Password Reset Code'}
              {pendingAuth?.step === 'RESET_PASSWORD' && 'Set New Password'}
              {!pendingAuth && mode === 'login' && 'Sign in to ABCDeFi'}
              {!pendingAuth && mode === 'register' && 'Create your account'}
              {!pendingAuth && mode === 'forgot' && 'Reset your password'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {pendingAuth?.step === 'LOGIN_2FA' && `We sent a 6-digit authentication code to ${pendingAuth.email}`}
              {pendingAuth?.step === 'REGISTER_OTP' && `Please enter the 6-digit code sent to ${pendingAuth.email}`}
              {pendingAuth?.step === 'FORGOT_OTP' && `Check your inbox (${pendingAuth.email}) for the verification code`}
              {pendingAuth?.step === 'RESET_PASSWORD' && 'Enter your strong new password below'}
              {!pendingAuth && mode === 'login' && 'Enter your credentials to access your dashboard'}
              {!pendingAuth && mode === 'register' && 'Fill in your details to start borrowing, lending and staking'}
              {!pendingAuth && mode === 'forgot' && 'Enter your registered email to receive password reset OTP'}
            </p>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. STANDARD LOGIN FORM */}
          {!pendingAuth && mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      resetFormAlerts();
                    }}
                    className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:from-emerald-400 hover:to-cyan-400 transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Signing In...</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-4 border-t border-slate-800/80 text-xs text-slate-400">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    resetFormAlerts();
                  }}
                  className="text-emerald-400 font-bold hover:underline ml-1 cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          )}

          {/* 2. STANDARD REGISTER FORM */}
          {!pendingAuth && mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      required
                      className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="+1 555 0199"
                      className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Country</label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="United States"
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password *</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Referral Code (Optional)</label>
                <div className="relative">
                  <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={refId}
                    onChange={(e) => setRefId(e.target.value)}
                    placeholder="e.g. REF12345"
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="privacy"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                />
                <label htmlFor="privacy" className="text-[11px] text-slate-400 cursor-pointer">
                  I agree to the <span className="text-emerald-400 font-medium">Privacy Policy</span> and <span className="text-emerald-400 font-medium">Terms of Service</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:from-emerald-400 hover:to-cyan-400 transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Creating Account...</span>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ShieldCheck className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    resetFormAlerts();
                  }}
                  className="text-emerald-400 font-bold hover:underline ml-1 cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* 3. STANDARD FORGOT PASSWORD FORM */}
          {!pendingAuth && mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:from-emerald-400 hover:to-cyan-400 transition shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Sending Request...' : 'Send Reset Code'}
              </button>

              <div className="text-center pt-3 border-t border-slate-800/80 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    resetFormAlerts();
                  }}
                  className="text-slate-400 hover:text-slate-200 transition font-medium cursor-pointer"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* 4. LOGIN 2FA OTP FORM */}
          {pendingAuth?.step === 'LOGIN_2FA' && (
            <form onSubmit={handleVerify2FAOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">6-Digit Security OTP</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    inputMode="numeric"
                    minLength={6}
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    required
                    autoFocus
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-center text-lg tracking-[0.4em] font-mono font-bold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isSubmitting}
                  className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Resend OTP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingAuth(null);
                    setMode('login');
                    resetFormAlerts();
                  }}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || otpCode.length !== 6}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:from-emerald-400 hover:to-cyan-400 transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Verifying...' : 'Verify & Access Dashboard'}
              </button>
            </form>
          )}

          {/* 5. REGISTER OTP FORM */}
          {pendingAuth?.step === 'REGISTER_OTP' && (
            <form onSubmit={handleVerifyRegisterOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">6-Digit Verification OTP</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    inputMode="numeric"
                    minLength={6}
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    required
                    autoFocus
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-center text-lg tracking-[0.4em] font-mono font-bold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isSubmitting}
                  className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Resend OTP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingAuth(null);
                    setMode('login');
                    resetFormAlerts();
                  }}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || otpCode.length !== 6}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:from-emerald-400 hover:to-cyan-400 transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Verifying...' : 'Verify Email & Continue'}
              </button>
            </form>
          )}

          {/* 6. FORGOT OTP FORM */}
          {pendingAuth?.step === 'FORGOT_OTP' && (
            <form onSubmit={handleVerifyForgotOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Reset Code</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    inputMode="numeric"
                    minLength={6}
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    required
                    autoFocus
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-center text-lg tracking-[0.4em] font-mono font-bold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="text-right text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setPendingAuth(null);
                    setMode('login');
                    resetFormAlerts();
                  }}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || otpCode.length !== 6}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:from-emerald-400 hover:to-cyan-400 transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>
          )}

          {/* 7. RESET PASSWORD FORM */}
          {pendingAuth?.step === 'RESET_PASSWORD' && (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:from-emerald-400 hover:to-cyan-400 transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Updating...' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>

        {/* Footer Note */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          ABCDeFi Decentralized Protocol • Collateral Lending &amp; Token Ecosystem
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
