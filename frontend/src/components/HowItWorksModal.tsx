import React from 'react';
import { X, Search, Sparkles, ShieldCheck, HeartHandshake, ArrowRight, LogIn } from 'lucide-react';
import { useAuth } from '../lib/authContext';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDropGear: () => void;
  onOpenDropWish: () => void;
  onOpenAuth?: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({
  isOpen,
  onClose,
  onOpenDropGear,
  onOpenDropWish,
  onOpenAuth,
}) => {
  const { isAuthenticated } = useAuth();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative bg-surface rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-4 border border-divider">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h2 className="text-lg font-black text-ink font-display">How Rentu Works</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-hover text-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-8">
          
          {/* Renting Gear */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-brand-soft text-brand border border-brand/20">
              1. Renting Gear
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-2">
                <div className="w-8 h-8 rounded-full bg-brand-soft text-brand font-black flex items-center justify-center text-xs">1</div>
                <h4 className="font-extrabold text-sm text-ink">Find Local Gear</h4>
                <p className="text-xs text-ink-secondary leading-relaxed">Search cameras, tents, projectors, or fits available in your city.</p>
              </div>
              <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-2">
                <div className="w-8 h-8 rounded-full bg-brand-soft text-brand font-black flex items-center justify-center text-xs">2</div>
                <h4 className="font-extrabold text-sm text-ink">Request & Coordinate</h4>
                <p className="text-xs text-ink-secondary leading-relaxed">Select dates and send a request. Chat directly with the verified owner.</p>
              </div>
              <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-2">
                <div className="w-8 h-8 rounded-full bg-brand-soft text-brand font-black flex items-center justify-center text-xs">3</div>
                <h4 className="font-extrabold text-sm text-ink">Pickup & Flex</h4>
                <p className="text-xs text-ink-secondary leading-relaxed">Pick up locally, create your project or enjoy the weekend, and return smoothly!</p>
              </div>
            </div>
          </div>

          {/* Listing & Earning */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
              2. Listing Your Gear
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-black flex items-center justify-center text-xs">1</div>
                <h4 className="font-extrabold text-sm text-ink">List In 2 Minutes</h4>
                <p className="text-xs text-ink-secondary leading-relaxed">Snap a photo of idle gear, set your daily rate, and list it for rent.</p>
              </div>
              <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-black flex items-center justify-center text-xs">2</div>
                <h4 className="font-extrabold text-sm text-ink">Accept Safe Requests</h4>
                <p className="text-xs text-ink-secondary leading-relaxed">Review renter profiles, student IDs, and trust ratings before accepting.</p>
              </div>
              <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-black flex items-center justify-center text-xs">3</div>
                <h4 className="font-extrabold text-sm text-ink">Make Passive Income</h4>
                <p className="text-xs text-ink-secondary leading-relaxed">Collect rental cash directly from renters while keeping full ownership.</p>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-4 border-t border-divider flex flex-wrap items-center justify-end gap-3">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => { onClose(); onOpenDropGear(); }}
                  className="btn-secondary text-xs cursor-pointer"
                >
                  List an Item
                </button>
                <button
                  onClick={() => { onClose(); onOpenDropWish(); }}
                  className="btn-primary text-xs shadow-pink cursor-pointer"
                >
                  Post a Request 🎯
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="btn-secondary text-xs cursor-pointer"
                >
                  Explore Rentals
                </button>
                <button
                  onClick={() => { onClose(); onOpenAuth?.(); }}
                  className="btn-primary text-xs shadow-pink cursor-pointer inline-flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Join Rentu⁺ to Post</span>
                </button>
              </>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
