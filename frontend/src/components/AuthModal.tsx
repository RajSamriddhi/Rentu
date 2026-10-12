import React, { useState } from 'react';
import { X, Sparkles, ShieldCheck } from 'lucide-react';
import { useClerk } from '@clerk/react';
import { useAuth } from '../lib/authContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { login, register, demoLogin } = useAuth();
  const { openSignIn, openSignUp } = useClerk();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [locality, setLocality] = useState('Saket, New Delhi');
  const [phone, setPhone] = useState('+91 98');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleClerkAuth = (action: 'signin' | 'signup') => {
    onClose();
    if (action === 'signup') {
      openSignUp();
    } else {
      openSignIn();
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (mode === 'signin') {
        await login(email, password);
      } else {
        await register({
          email,
          password,
          name,
          locality,
          phone,
        });
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemo = async (role: 'lender' | 'borrower' | 'admin') => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await demoLogin(role);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div 
        className="relative bg-surface w-full max-w-md rounded-3xl border border-divider shadow-xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider bg-surface">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xl text-ink tracking-tight font-display">
              Rentu<sup className="text-brand font-black text-sm">⁺</sup>
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-hover text-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Clerk Instant Auth */}
          <div className="space-y-2">
            <button
              type="button"
              id="clerk-auth-btn"
              onClick={() => handleClerkAuth(mode)}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-zinc-950 hover:bg-black dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-black text-xs sm:text-sm tracking-wide transition-all shadow-md hover:shadow-lg cursor-pointer border border-zinc-800 dark:border-zinc-200"
            >
              <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center text-white text-[10px] font-black">
                ⚡
              </div>
              <span>Continue with Clerk (Google & Email)</span>
              <Sparkles className="w-4 h-4 text-brand animate-pulse" />
            </button>
            <div className="flex items-center gap-1.5 text-[10px] text-ink-secondary justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Secured by Clerk Identity · Fast & Passwordless</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-divider"></div>
            <span className="text-[10px] font-bold uppercase text-ink-secondary tracking-widest">or preview instantly</span>
            <div className="flex-1 h-px bg-divider"></div>
          </div>

          {/* Quick Demo Switcher */}
          <div className="p-3.5 rounded-2xl bg-canvas border border-divider">
            <span className="block text-[10px] font-black uppercase text-ink-secondary tracking-wider mb-2 text-center">
              ⚡ Instant 1-Click Demo Login
            </span>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('lender')}
                className="bg-surface hover:bg-surface-hover border border-divider rounded-xl p-2 text-center text-xs font-bold text-ink shadow-xs cursor-pointer hover:border-brand transition-all"
              >
                📸 Rohit <span className="block text-[9px] text-ink-secondary font-medium">Delhi</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('borrower')}
                className="bg-surface hover:bg-surface-hover border border-divider rounded-xl p-2 text-center text-xs font-bold text-ink shadow-xs cursor-pointer hover:border-brand transition-all"
              >
                🎨 Ananya <span className="block text-[9px] text-ink-secondary font-medium">Bangalore</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('admin')}
                className="bg-surface hover:bg-surface-hover border border-divider rounded-xl p-2 text-center text-xs font-bold text-ink shadow-xs cursor-pointer hover:border-brand transition-all"
              >
                👑 Aarav <span className="block text-[9px] text-ink-secondary font-medium">Mumbai</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-wider justify-center border-b border-divider pb-3">
            <button
              onClick={() => { setMode('signin'); setErrorMsg(''); }}
              className={`pb-1 transition-colors cursor-pointer ${
                mode === 'signin' ? 'text-brand border-b-2 border-brand font-extrabold' : 'text-ink-secondary hover:text-ink'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setErrorMsg(''); }}
              className={`pb-1 transition-colors cursor-pointer ${
                mode === 'signup' ? 'text-brand border-b-2 border-brand font-extrabold' : 'text-ink-secondary hover:text-ink'
              }`}
            >
              Create Account
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Maya Sharma"
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-medium text-ink outline-none focus:border-brand"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Locality</label>
                  <input
                    type="text"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder="e.g. Saket, New Delhi"
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-medium text-ink outline-none focus:border-brand"
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-medium text-ink outline-none focus:border-brand"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-medium text-ink outline-none focus:border-brand"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-3 text-xs sm:text-sm font-extrabold mt-2 cursor-pointer shadow-pink"
            >
              <span>{isSubmitting ? 'Please wait...' : mode === 'signin' ? 'Sign In 🚀' : 'Join Rentu⁺ ✨'}</span>
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};
