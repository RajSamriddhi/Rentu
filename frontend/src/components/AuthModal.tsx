import React from 'react';
import { X, ShieldCheck, Sparkles } from 'lucide-react';
import { useClerk } from '@clerk/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { openSignIn } = useClerk();

  if (!isOpen) return null;

  const handleGoogleSignIn = () => {
    onClose();
    if (onSuccess) onSuccess();
    openSignIn();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      <div 
        className="relative bg-surface w-full max-w-sm rounded-3xl border border-divider shadow-2xl overflow-hidden my-auto"
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
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6 text-center">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 text-brand text-[11px] font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Peer-to-Peer Gear Network</span>
            </div>
            <h3 className="text-xl font-extrabold text-ink font-display">
              Welcome to Rentu⁺
            </h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Borrow, rent, and list premium gear in your city with seamless verified access.
            </p>
          </div>

          {/* Google Sign In Button */}
          <div className="space-y-3 pt-1">
            <button
              type="button"
              id="google-signin-btn"
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-2xl bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-extrabold text-sm tracking-wide transition-all shadow-sm hover:shadow-md cursor-pointer group active:scale-[0.99]"
            >
              {/* Official Google 4-Color Icon */}
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
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
              <span>Sign in with Google</span>
            </button>

            <div className="flex items-center gap-1.5 text-[11px] text-ink-secondary justify-center pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Fast 1-click verification · Verified trust identity</span>
            </div>
          </div>

          <div className="text-[10px] text-ink-secondary/70 border-t border-divider pt-4">
            By signing in, you agree to Rentu⁺ Community Guidelines, Trust Deposit terms & Privacy Policy.
          </div>
        </div>
      </div>
    </div>
  );
};
