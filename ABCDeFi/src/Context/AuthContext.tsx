import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export interface AuthUser {
  id?: string;
  name?: string;
  email?: string;
  mobileNumber?: number | string;
  walletAddress?: string;
  country?: string;
  isKYC?: boolean;
  isKycVerified?: boolean;
  kycStatus?: string;
  kycSubmittedAt?: string | null;
  kycProviderReference?: string | null;
  role?: 'user' | 'admin';
  creditScore?: number;
  reputation?: number;
  is2FAEnabled?: boolean;
}

export interface PendingAuthState {
  userId?: string;
  email?: string;
  step?: 'LOGIN_2FA' | 'ADMIN_LOGIN_2FA' | 'REGISTER_OTP' | 'FORGOT_OTP' | 'RESET_PASSWORD';
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  loading: boolean;
  sessionVerified: boolean;
  refreshProfile: () => Promise<void>;
  pendingAuth: PendingAuthState | null;
  setPendingAuth: (state: PendingAuthState | null) => void;
  
  loginStep1: (email: string, password: string) => Promise<{ success: boolean; require2FA?: boolean; userId?: string; email?: string; message?: string }>;
  verifyLoginOtp: (userId: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  resendLoginOtp: (userId: string) => Promise<{ success: boolean; message?: string }>;
  adminLoginStep1: (email: string, password: string) => Promise<{ success: boolean; require2FA?: boolean; userId?: string; email?: string; message?: string }>;
  verifyAdminLoginOtp: (userId: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  resendAdminLoginOtp: (userId: string) => Promise<{ success: boolean; message?: string }>;

  register: (data: { name: string; email: string; mobileNumber?: string; country?: string; password: string; refId?: string; privacyData: boolean }) => Promise<{ success: boolean; userId?: string; email?: string; message?: string }>;
  verifyRegisterOtp: (userId: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  resendRegisterOtp: (userId: string) => Promise<{ success: boolean; message?: string }>;

  forgotPasswordRequest: (email: string) => Promise<{ success: boolean; userId?: string; message?: string }>;
  verifyForgotPasswordOtp: (userId: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  resetPasswordSubmit: (userId: string, password: string) => Promise<{ success: boolean; message?: string }>;

  toggle2FA: () => Promise<{ success: boolean; is2FAEnabled?: boolean; message?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  changeEmail: (newEmail: string) => Promise<{ success: boolean; message?: string }>;
  changeMobile: (newMobile: string) => Promise<{ success: boolean; message?: string }>;

  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'abcdefi_auth_user';
const STORAGE_KEY_TOKEN = 'abcdefi_jwt';
const STORAGE_KEY_REFRESH = 'abcdefi_auth_refresh';
const STORAGE_KEY_METHOD = 'abcdefi_auth_method';

type RefreshedSession = {
  token: string;
  refreshToken?: string;
};

const authDiagnosticsEnabled = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

function authDiagnostic(event: string, details: Record<string, unknown>) {
  if (authDiagnosticsEnabled) {
    // Deliberately log only request state: never credentials, OTPs, or tokens.
    console.info(`[AUTH] ${event}`, details);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY_USER);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_TOKEN) || null;
  });

  const [refreshToken, setRefreshTokenState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_REFRESH) || null;
  });

  const [loading, setLoading] = useState(false);
  const refreshRequestRef = useRef<Promise<RefreshedSession | null> | null>(null);
  // Saved browser data is not sufficient to grant application-admin access on
  // a reload.  The authenticated backend profile must confirm the session.
  const [sessionVerified, setSessionVerified] = useState(() => !localStorage.getItem(STORAGE_KEY_TOKEN));

  const [pendingAuth, setPendingAuthState] = useState<PendingAuthState | null>(() => {
    try {
      const saved = sessionStorage.getItem('abcdefi_pending_auth');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const clearAuthSession = useCallback((disconnectWallet = true) => {
    setUser(null);
    setToken(null);
    setRefreshTokenState(null);
    setPendingAuth(null);
    setSessionVerified(true);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_REFRESH);
    localStorage.removeItem(STORAGE_KEY_METHOD);
    localStorage.removeItem('abcdefi_connected_wallet');
    window.dispatchEvent(new Event('abcdefi-auth-session-changed'));
    if (disconnectWallet) {
      window.dispatchEvent(new Event('abcdefi-auth-logout'));
    }
  }, []);

  const setPendingAuth = (val: PendingAuthState | null | ((prev: PendingAuthState | null) => PendingAuthState | null)) => {
    setPendingAuthState(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        if (next) {
          sessionStorage.setItem('abcdefi_pending_auth', JSON.stringify(next));
        } else {
          sessionStorage.removeItem('abcdefi_pending_auth');
        }
      } catch {
        // ignore
      }
      return next;
    });
  };

  const refreshAccessToken = useCallback(async (): Promise<RefreshedSession | null> => {
    const storedRefreshToken = refreshToken || localStorage.getItem(STORAGE_KEY_REFRESH);
    if (!storedRefreshToken) {
      authDiagnostic('refresh skipped', { refreshTokenExists: false });
      return null;
    }

    if (!refreshRequestRef.current) {
      refreshRequestRef.current = (async () => {
        authDiagnostic('refresh attempted', { refreshTokenExists: true });
        const res = await fetch('/api/user/refresh-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
        });
        const data = await res.json().catch(() => ({}));
        authDiagnostic('refresh response', { status: res.status, success: Boolean(res.ok && data.success) });
        if (!res.ok || !data.success || !data.token) return null;

        const refreshed: RefreshedSession = {
          token: data.token,
          refreshToken: data.refreshToken,
        };
        setToken(refreshed.token);
        localStorage.setItem(STORAGE_KEY_TOKEN, refreshed.token);
        if (refreshed.refreshToken) {
          setRefreshTokenState(refreshed.refreshToken);
          localStorage.setItem(STORAGE_KEY_REFRESH, refreshed.refreshToken);
        }
        window.dispatchEvent(new Event('abcdefi-auth-session-changed'));
        return refreshed;
      })().catch((error) => {
        authDiagnostic('refresh failed', { message: error instanceof Error ? error.message : 'unknown error' });
        return null;
      }).finally(() => {
        refreshRequestRef.current = null;
      });
    }

    return refreshRequestRef.current;
  }, [refreshToken]);

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setSessionVerified(true);
      return;
    }

    setSessionVerified(false);

    try {
      let accessToken = token;
      let res = await fetch('/api/user/profile', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      let data = await res.json().catch(() => ({}));
      authDiagnostic('profile response', { status: res.status, authorizationPresent: true });

      if (res.status === 401) {
        authDiagnostic('profile unauthorized', { refreshAttempted: true });
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          accessToken = refreshed.token;
          res = await fetch('/api/user/profile', {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          data = await res.json().catch(() => ({}));
          authDiagnostic('profile retry response', { status: res.status, authorizationPresent: true });
        }
      }

      if (res.ok && data.success && data.data) {
        setUser(data.data);
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.data));
        setSessionVerified(true);
      } else if (res.status === 401) {
        // A failed refresh or a failed one-time retry is definitive.  Do not
        // retry again here, or multiple mounting components could loop.
        clearAuthSession();
      } else {
        setSessionVerified(false);
      }
    } catch (error) {
      console.error('Failed to hydrate authenticated profile:', error);
      setSessionVerified(false);
    }
  }, [clearAuthSession, refreshAccessToken, token]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);


  const saveAuthSession = (userData: AuthUser, accessToken: string, refToken?: string, method: 'password' | 'wallet' = 'password') => {
    setUser(userData);
    setToken(accessToken);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userData));
    localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
    if (refToken) {
      setRefreshTokenState(refToken);
      localStorage.setItem(STORAGE_KEY_REFRESH, refToken);
    } else {
      setRefreshTokenState(null);
      localStorage.removeItem(STORAGE_KEY_REFRESH);
    }
    localStorage.setItem(STORAGE_KEY_METHOD, method);
    window.dispatchEvent(new Event('abcdefi-auth-session-changed'));
    // Login and OTP endpoints only return this session after backend
    // authentication succeeds, so the returned role is safe for this session.
    setSessionVerified(true);
  };

  // WalletContext owns MetaMask interaction. AuthContext owns the app session;
  // the event is emitted only after the backend verifies the signed challenge.
  useEffect(() => {
    const handleWalletAuthenticated = (event: Event) => {
      const detail = (event as CustomEvent<{ user?: AuthUser; token?: string; refreshToken?: string }>).detail;
      if (!detail?.user || !detail.token) return;
      saveAuthSession(detail.user, detail.token, detail.refreshToken, 'wallet');
      setPendingAuth(null);
    };
    window.addEventListener('abcdefi-wallet-authenticated', handleWalletAuthenticated);
    return () => {
      window.removeEventListener('abcdefi-wallet-authenticated', handleWalletAuthenticated);
    };
  }, [clearAuthSession]);

  // Login Step 1
  const loginStep1ForEndpoint = async (
    endpoint: string,
    loginStep: 'LOGIN_2FA' | 'ADMIN_LOGIN_2FA',
    email: string,
    password: string,
  ) => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        if (data?.requireEmailVerify && data?.userId) {
          setPendingAuth({
            userId: data.userId,
            email: data.email || email,
            step: 'REGISTER_OTP'
          });
          return {
            success: true,
            userId: data.userId,
            email: data.email || email,
            message: data.message || 'Please enter the verification code to activate your account.'
          };
        }
        return { success: false, message: data?.message || `Login failed (${res.status})` };
      }

      if (data.success) {
        if (data.require2FA) {
          setPendingAuth({
            userId: data.userId,
            email: data.email || email,
            step: loginStep
          });
          return {
            success: true,
            require2FA: true,
            userId: data.userId,
            email: data.email || email,
            message: data.message
          };
        } else if (data.token && data.user) {
          saveAuthSession(data.user, data.token, data.refreshToken);
          return { success: true, require2FA: false };
        }
      }
      
      return { success: false, message: data.message || 'Invalid email or password' };
    } catch (err: any) {
      return {
        success: false,
        message: err instanceof DOMException && err.name === 'AbortError'
          ? 'Sign-in request timed out. The authentication service did not respond. Please try again later.'
          : err?.message || 'Authentication server unavailable. Please try again.'
      };
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const loginStep1 = (email: string, password: string) =>
    loginStep1ForEndpoint('/api/user/login', 'LOGIN_2FA', email, password);

  const adminLoginStep1 = (email: string, password: string) =>
    loginStep1ForEndpoint('/api/admin/login', 'ADMIN_LOGIN_2FA', email, password);

  // Verify Login OTP (2FA Step 2)
  const verifyLoginOtpForEndpoint = async (endpoint: string, userId: string, otp: string) => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return { success: false, message: data?.message || `2FA Verification failed (${res.status})` };
      }

      if (data.success && data.user) {
        if (!data.token) {
          return { success: false, message: 'Authentication server did not return an access token.' };
        }
        saveAuthSession(data.user, data.token, data.refreshToken);
        setPendingAuth(null);
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Invalid Login OTP code' };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Authentication server unavailable. Please try again.'
      };
    } finally {
      setLoading(false);
    }
  };

  const verifyLoginOtp = (userId: string, otp: string) =>
    verifyLoginOtpForEndpoint('/api/user/verify-login-otp', userId, otp);

  const verifyAdminLoginOtp = (userId: string, otp: string) =>
    verifyLoginOtpForEndpoint('/api/admin/verify-login-otp', userId, otp);

  const resendLoginOtpForEndpoint = async (endpoint: string, userId: string) => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      return { success: Boolean(res.ok && data.success), message: data.message };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Unable to resend login OTP.' };
    }
  };

  const resendLoginOtp = (userId: string) =>
    resendLoginOtpForEndpoint('/api/user/resend-login-otp', userId);

  const resendAdminLoginOtp = (userId: string) =>
    resendLoginOtpForEndpoint('/api/admin/resend-login-otp', userId);

  // Register New User
  const register = async (data: { name: string; email: string; mobileNumber?: string; country?: string; password: string; refId?: string; privacyData: boolean }) => {
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 15_000);

    try {
      const res = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      const resData = await res.json().catch(() => null) as {
        success?: boolean;
        userId?: string;
        email?: string;
        message?: string;
        error?: string;
      } | null;

      if (!resData) {
        return {
          success: false,
          message: `Registration failed (${res.status})`,
        };
      }

      if (!res.ok) {
        return {
          success: false,
          message: resData.message || resData.error || `Registration failed (${res.status})`,
        };
      }

      if (resData.success) {
        setPendingAuth({
          userId: resData.userId,
          email: resData.email || data.email,
          step: 'REGISTER_OTP'
        });
        return {
          success: true,
          userId: resData.userId,
          email: resData.email || data.email,
          message: resData.message
        };
      }
      return { success: false, message: resData.message || 'Registration failed' };
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          success: false,
          message: 'Registration request timed out. Please make sure the ABCDeFi backend is running and try again.',
        };
      }

      console.error('[AuthContext] Registration failed:', error);
      return {
        success: false,
        message: error instanceof Error
          ? error.message
          : 'Unable to create account. Please try again.',
      };
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  // Verify Email OTP after Registration
  const verifyRegisterOtp = async (userId: string, otp: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return { success: false, message: data?.message || `Verification failed (${res.status})` };
      }

      if (data.success) {
        setPendingAuth(null);
        if (data.token && (data.data || data.user)) {
          saveAuthSession(data.data || data.user, data.token, data.refreshToken);
        }
        return { success: true, message: 'Account verified successfully!' };
      }
      return { success: false, message: data.message || 'Invalid or expired verification code' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Verification service unavailable. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  const resendRegisterOtp = async (userId: string) => {
    try {
      const res = await fetch('/api/user/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      return { success: Boolean(res.ok && data.success), message: data.message };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Unable to resend verification code.' };
    }
  };

  // Forgot Password
  const forgotPasswordRequest = async (email: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return { success: false, message: data?.message || `Password reset request failed (${res.status})` };
      }

      if (data.success) {
        setPendingAuth({
          userId: data.userId,
          email,
          step: 'FORGOT_OTP'
        });
        return { success: true, userId: data.userId, message: data.message };
      }
      return { success: false, message: data.message || 'Account not found' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Password reset service unavailable. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  const verifyForgotPasswordOtp = async (userId: string, otp: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/verify-password-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return { success: false, message: data?.message || `OTP verification failed (${res.status})` };
      }

      if (data.success) {
        setPendingAuth(prev => prev ? { ...prev, step: 'RESET_PASSWORD' } : null);
        return { success: true, message: 'OTP Verified. Set your new password.' };
      }
      return { success: false, message: data.message || 'Invalid password reset code' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'OTP verification service unavailable. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  const resetPasswordSubmit = async (userId: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return { success: false, message: data?.message || `Password reset failed (${res.status})` };
      }

      if (data.success) {
        setPendingAuth(null);
        return { success: true, message: 'Password reset successfully! Please log in.' };
      }
      return { success: false, message: data.message || 'Failed to update password' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Password reset service unavailable. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  // Security Settings Changes
  const toggle2FA = async () => {
    try {
      const res = await fetch('/api/user/toggle-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      const data = await res.json();
      if (data.success && user) {
        const updated = { ...user, is2FAEnabled: data.is2FAEnabled };
        setUser(updated);
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e?.message || 'Failed to update 2FA setting' };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e?.message || 'Password update service unavailable.' };
    }
  };

  const changeEmail = async (newEmail: string) => {
    try {
      const res = await fetch('/api/user/change-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newEmail })
      });
      const data = await res.json();
      if (data.success && user) {
        const updated = { ...user, email: newEmail };
        setUser(updated);
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e?.message || 'Email update service unavailable.' };
    }
  };

  const changeMobile = async (newMobile: string) => {
    try {
      const res = await fetch('/api/user/change-mobile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newMobile })
      });
      const data = await res.json();
      if (data.success && user) {
        const updated = { ...user, mobileNumber: newMobile };
        setUser(updated);
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e?.message || 'Mobile update service unavailable.' };
    }
  };

  const logout = () => {
    if (token) {
      fetch('/api/user/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }
    clearAuthSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        loading,
        sessionVerified,
        refreshProfile,
        pendingAuth,
        setPendingAuth,
        loginStep1,
        verifyLoginOtp,
        resendLoginOtp,
        adminLoginStep1,
        verifyAdminLoginOtp,
        resendAdminLoginOtp,
        register,
        verifyRegisterOtp,
        resendRegisterOtp,
        forgotPasswordRequest,
        verifyForgotPasswordOtp,
        resetPasswordSubmit,
        toggle2FA,
        changePassword,
        changeEmail,
        changeMobile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
