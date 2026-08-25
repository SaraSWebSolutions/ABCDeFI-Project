import React, { useState } from 'react';
import { useWallet } from '../Context/WalletContext';
import { Mail, Lock, LogIn, Wallet, Sparkles, CheckCircle, AlertCircle, X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const wallet = useWallet();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authMethod, setAuthMethod] = useState<'email' | 'web3'>('web3');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const endpoint = authMode === 'register' ? '/api/user/register' : '/api/user/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          walletAddress: wallet.address,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (data.token) {
        localStorage.setItem('abcdefi_jwt', data.token);
        setSuccessMsg(`Success! Logged in as ${data.user?.email || email}`);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMaskSiwe = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = await wallet.loginWithSignature();
      if (token) {
        setSuccessMsg(`MetaMask SIWE Verified! Signature matched for ${wallet.address?.slice(0, 8)}...`);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1200);
      } else {
        setError('SIWE signature rejected or failed');
      }
    } catch (err: any) {
      setError(err?.message || 'MetaMask Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleWalletConnectSiwe = async () => {
    setError(null);
    setLoading(true);
    try {
      await wallet.connectWallet('walletconnect');
      const token = await wallet.loginWithSignature();
      if (token) {
        setSuccessMsg('WalletConnect SIWE Verified!');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(err?.message || 'WalletConnect Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-indigo-500/30 w-full max-w-md rounded-3xl p-6 shadow-2xl shadow-indigo-950/50 text-white relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white bg-slate-800/60 p-2 rounded-full transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full text-indigo-400 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> ABCDeFi Production Web3 Auth
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            {authMode === 'login' ? 'Sign In to ABCDeFi' : 'Create New Account'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">Select your preferred Web2 or Web3 authentication method</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Method Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl mb-5 border border-slate-800">
          <button
            onClick={() => setAuthMethod('web3')}
            className={`py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 ${
              authMethod === 'web3' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" /> Web3 Signature (SIWE)
          </button>
          <button
            onClick={() => setAuthMethod('email')}
            className={`py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 ${
              authMethod === 'email' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Email & Social
          </button>
        </div>

        {authMethod === 'web3' ? (
          <div className="space-y-3">
            <button
              onClick={handleMetaMaskSiwe}
              disabled={loading}
              className="w-full p-4 bg-slate-950 hover:bg-slate-800 border border-amber-500/30 hover:border-amber-500/60 rounded-2xl flex items-center justify-between transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🦊</span>
                <div className="text-left">
                  <div className="text-sm font-bold text-white group-hover:text-amber-300">MetaMask SIWE Login</div>
                  <div className="text-[11px] text-slate-400">Cryptographic message signature verification</div>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold">
                SIWE
              </span>
            </button>

            <button
              onClick={handleWalletConnectSiwe}
              disabled={loading}
              className="w-full p-4 bg-slate-950 hover:bg-slate-800 border border-blue-500/30 hover:border-blue-500/60 rounded-2xl flex items-center justify-between transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🌐</span>
                <div className="text-left">
                  <div className="text-sm font-bold text-white group-hover:text-blue-300">WalletConnect SIWE</div>
                  <div className="text-[11px] text-slate-400">Mobile wallet & QR auth</div>
                </div>
              </div>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-bold">
                Mobile
              </span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@abcdefi.io"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              {loading ? 'Processing...' : authMode === 'login' ? 'Sign In with Email' : 'Create Account'}
            </button>

          </form>
        )}

        <div className="mt-6 text-center text-xs text-slate-400 border-t border-slate-800/80 pt-4">
          {authMode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button
                onClick={() => { setAuthMode('register'); setError(null); }}
                className="text-indigo-400 font-bold hover:underline ml-1"
              >
                Sign Up
              </button>
            </span>
          ) : (
            <span>
              Already registered?{' '}
              <button
                onClick={() => { setAuthMode('login'); setError(null); }}
                className="text-indigo-400 font-bold hover:underline ml-1"
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
