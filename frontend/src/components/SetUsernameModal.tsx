import React, { useState, useEffect, useCallback } from 'react';
import { AtSign, Check, X, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';

export const SetUsernameModal: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [availability, setAvailability] = useState<{ available: boolean; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Initial suggestion from name or email if empty
  useEffect(() => {
    if (!user) return;
    if (user.username) return;

    let suggestion = '';
    if (user.email) {
      suggestion = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
    } else if (user.name) {
      suggestion = user.name.toLowerCase().replace(/[^a-z0-9_]/g, '');
    }
    if (suggestion.length > 30) suggestion = suggestion.slice(0, 30);
    if (suggestion.length >= 3) {
      setUsername(suggestion);
    }
  }, [user]);

  // Debounced availability check
  useEffect(() => {
    const clean = username.trim().toLowerCase();
    setErrorMsg('');

    if (!clean) {
      setAvailability(null);
      setIsChecking(false);
      return;
    }

    if (clean.length < 3) {
      setAvailability({ available: false, message: 'Username must be at least 3 characters' });
      setIsChecking(false);
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(clean)) {
      setAvailability({ available: false, message: 'Only lowercase letters, numbers, and underscores allowed' });
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.checkUsername(clean);
        setAvailability(res);
      } catch (err: any) {
        setAvailability({ available: false, message: err.message || 'Error checking username availability' });
      } finally {
        setIsChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim().toLowerCase();

    if (!clean || !availability?.available) {
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await api.updateProfile({ username: clean });
      await refreshUser();
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
    } catch (err: any) {
      console.error('Failed to claim username:', err);
      setErrorMsg(err.message || 'Failed to claim username. Please try another one.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || user.username) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative bg-[#13151b] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 sm:p-8 text-center">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-brand/20 blur-2xl pointer-events-none rounded-full" />

        <div className="relative z-10 space-y-6">
          <div className="inline-flex p-3.5 rounded-2xl bg-brand/10 border border-brand/20 text-brand shadow-inner">
            <Sparkles className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white font-display tracking-tight">
              Claim Your Unique Username
            </h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Every member gets their own dedicated profile URL. Pick a unique handle so people can find you at{' '}
              <span className="text-brand font-semibold">rentu.site/your-name</span>.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-2">
                Choose Handle
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-zinc-400 font-bold text-sm pointer-events-none select-none">
                  @
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="e.g. sadiqua"
                  maxLength={30}
                  className="w-full bg-[#1c1f26] border border-white/10 focus:border-brand rounded-xl pl-8 pr-10 py-3 text-sm font-semibold text-white placeholder-zinc-500 outline-none transition-all shadow-inner"
                  autoFocus
                  required
                />
                <div className="absolute right-3">
                  {isChecking ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                  ) : availability?.available ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : availability && !availability.available ? (
                    <X className="w-4 h-4 text-red-400" />
                  ) : null}
                </div>
              </div>

              {/* Status helper text */}
              <div className="mt-2 text-xs">
                {isChecking && (
                  <span className="text-zinc-400">Checking availability...</span>
                )}
                {!isChecking && availability?.available && (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    rentu.site/{username.toLowerCase()} is available!
                  </span>
                )}
                {!isChecking && availability && !availability.available && (
                  <span className="text-red-400 font-medium flex items-center gap-1">
                    <X className="w-3.5 h-3.5" />
                    {availability.message}
                  </span>
                )}
                {!availability && !isChecking && (
                  <span className="text-zinc-500 text-[11px]">
                    3-30 characters • letters, numbers, underscores • you can change this anytime
                  </span>
                )}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-red-300 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={!availability?.available || isChecking || isSubmitting}
              className="w-full mt-2 py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-brand to-brand-hover text-white shadow-lg shadow-brand/25 hover:shadow-brand/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Claiming @{username}...
                </>
              ) : (
                <>
                  Claim & Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

