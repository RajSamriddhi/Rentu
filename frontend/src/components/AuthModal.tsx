import React, { useState } from 'react';
import { X, ShieldCheck, Sparkles, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/authContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { loginWithGoogle, continueWithEmail, demoLogin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setIsLoading(true);
    try {
      await loginWithGoogle();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in cancelled. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setErrorMsg('Pop-up was blocked by browser. Please allow popups for this site.');
      } else if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
        setErrorMsg(`Domain not authorized. Please add "${window.location.hostname}" to Firebase Console -> Authentication -> Settings -> Authorized Domains.`);
      } else {
        setErrorMsg(err.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await continueWithEmail(email, password);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Email auth error:', err);
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
        setErrorMsg(`Domain not authorized. Please add "${window.location.hostname}" to Firebase Console -> Authentication -> Settings -> Authorized Domains.`);
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('Password should be at least 6 characters.');
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = async (role: 'lender' | 'borrower') => {
    setIsLoading(true);
    try {
      await demoLogin(role);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        className="relative bg-surface w-full max-w-sm rounded-3xl border border-divider shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-divider bg-surface">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xl text-ink tracking-tight font-display">
              Rentu<sup className="text-brand font-black text-sm">⁺</sup>
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-hover text-ink transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-black uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              <span>Verified Access</span>
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-ink font-display">
              Welcome to Rentu⁺
            </h3>
            <p className="text-xs text-ink-secondary">
              Sign in to rent, borrow, or list your gear in your neighborhood.
            </p>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-300 text-xs font-semibold text-center animate-in fade-in leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* 1-Click Google Sign-In */}
          <button
            type="button"
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-extrabold text-xs tracking-wide transition-all shadow-xs hover:shadow-sm cursor-pointer disabled:opacity-60 active:scale-[0.99]"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex items-center justify-center my-1">
            <div className="border-t border-divider w-full" />
            <span className="bg-surface px-2 text-[10px] uppercase font-bold text-ink-secondary shrink-0">
              or with email
            </span>
            <div className="border-t border-divider w-full" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-bold text-ink mb-1">Email Address</label>
              <div className="relative flex items-center bg-canvas border border-divider rounded-xl px-3 py-2 focus-within:border-brand">
                <Mail className="w-3.5 h-3.5 text-ink-muted mr-2 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-transparent border-none outline-none text-xs font-semibold text-ink w-full"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-ink mb-1">Password</label>
              <div className="relative flex items-center bg-canvas border border-divider rounded-xl px-3 py-2 focus-within:border-brand">
                <Lock className="w-3.5 h-3.5 text-ink-muted mr-2 shrink-0" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent border-none outline-none text-xs font-semibold text-ink w-full"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary text-xs py-2.5 shadow-pink cursor-pointer mt-1 flex items-center justify-center gap-1.5 disabled:opacity-60 font-bold"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Fast Demo Account Option */}
          <div className="pt-2 border-t border-divider text-center">
            <span className="text-[10px] text-ink-secondary font-semibold block mb-1.5">
              Quick Test Accounts:
            </span>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleDemoSignIn('lender')}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-lg bg-canvas hover:bg-zinc-200 dark:hover:bg-zinc-800 text-[11px] font-bold text-ink cursor-pointer border border-divider"
              >
                ⚡ Lender Demo
              </button>
              <button
                type="button"
                onClick={() => handleDemoSignIn('borrower')}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-lg bg-canvas hover:bg-zinc-200 dark:hover:bg-zinc-800 text-[11px] font-bold text-ink cursor-pointer border border-divider"
              >
                🎒 Renter Demo
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-ink-secondary justify-center pt-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Secure Authentication & Identity Protection</span>
          </div>
        </div>
      </div>
    </div>
  );
};
