import React from 'react';
import { Plus, ShieldCheck, ArrowRight, Lock, MessageSquare } from 'lucide-react';

interface HeroSectionProps {
  onOpenDropGear: () => void;
  onOpenDropWish?: () => void;
  onGetStarted: () => void;
  itemsCount?: number;
  requestsCount?: number;
  activeUsersCount?: number;
  isLoading?: boolean;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  onSearch?: () => void;
  onOpenUserProfile?: (userId: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenDropGear,
  onGetStarted,
  itemsCount = 0,
  requestsCount = 0,
  activeUsersCount = 0,
  isLoading = false,
}) => {
  return (
    <section className="relative overflow-hidden pt-10 sm:pt-16 pb-10 sm:pb-14 bg-canvas transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-ink tracking-tight font-display leading-[1.1] max-w-3xl mx-auto">
          Rent. Lend. Borrow.{' '}
          <span className="text-brand">Everything.</span>
        </h1>

        {/* Value Proposition */}
        <p className="mt-4 sm:mt-5 text-sm sm:text-base lg:text-lg font-medium text-ink-secondary max-w-xl mx-auto leading-relaxed">
          Why buy gear you only need for a few days? Rent cameras, tools, camping equipment, and tech from verified neighbors nearby.
        </p>

        {/* Action Buttons */}
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
          <button
            type="button"
            onClick={onGetStarted}
            className="w-full sm:w-auto btn-primary text-xs sm:text-sm px-6 py-3 font-bold shadow-pink rounded-full inline-flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
          >
            <span>Explore Marketplace</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenDropGear}
            className="w-full sm:w-auto bg-surface hover:bg-canvas text-ink border border-divider hover:border-brand/40 text-xs sm:text-sm px-6 py-3 font-bold rounded-full inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-transform hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>List Your Gear</span>
          </button>
        </div>

        {/* Trust Badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs font-semibold text-ink-secondary">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>100% Peer Verified</span>
          </div>
          <span className="text-divider">•</span>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>6-Digit Handover Verification</span>
          </div>
          <span className="text-divider">•</span>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-brand shrink-0" />
            <span>Direct Chat Coordination</span>
          </div>
        </div>

        {/* Minimalist Stats Strip */}
        <div className="mt-10 border-t border-divider pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto text-center sm:text-left">
          <div className="p-3">
            {isLoading ? (
              <div className="h-7 w-12 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse my-0.5 mx-auto sm:mx-0" />
            ) : (
              <div className="text-xl sm:text-2xl font-black text-ink font-display">{itemsCount}</div>
            )}
            <div className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider mt-0.5">Gear Available</div>
          </div>
          <div className="p-3">
            {isLoading ? (
              <div className="h-7 w-12 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse my-0.5 mx-auto sm:mx-0" />
            ) : (
              <div className="text-xl sm:text-2xl font-black text-ink font-display">{requestsCount}</div>
            )}
            <div className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider mt-0.5">Active Requests</div>
          </div>
          <div className="p-3">
            {isLoading ? (
              <div className="h-7 w-12 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse my-0.5 mx-auto sm:mx-0" />
            ) : (
              <div className="text-xl sm:text-2xl font-black text-ink font-display">{activeUsersCount}</div>
            )}
            <div className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider mt-0.5">Active Users</div>
          </div>
          <div className="p-3">
            <div className="text-xl sm:text-2xl font-black text-brand font-display">100%</div>
            <div className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider mt-0.5">Peer Verified</div>
          </div>
        </div>

      </div>
    </section>
  );
};
