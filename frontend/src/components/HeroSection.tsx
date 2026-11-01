import React from 'react';
import { Plus, Sparkles, ShieldCheck, ArrowRight, Heart, Zap } from 'lucide-react';

interface HeroSectionProps {
  onOpenDropGear: () => void;
  onOpenDropWish?: () => void;
  onGetStarted: () => void;
  itemsCount?: number;
  requestsCount?: number;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  onSearch?: () => void;
  onOpenUserProfile?: (userId: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenDropGear,
  onOpenDropWish,
  onGetStarted,
  itemsCount = 0,
  requestsCount = 0,
}) => {
  return (
    <section className="relative overflow-hidden pt-10 sm:pt-16 pb-12 sm:pb-16 bg-gradient-to-b from-[#FFF5F7] via-[#FFF8F9] to-canvas dark:from-[#1b1219] dark:via-[#131118] dark:to-canvas transition-colors">
      {/* Subtle Background Glow Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-brand/10 dark:bg-brand/15 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        {/* Chic Top Pill Sticker */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide bg-white/90 dark:bg-zinc-800/90 border border-pink-200 dark:border-pink-900/40 text-brand shadow-xs mb-6 sm:mb-8 animate-in fade-in duration-300">
          <Sparkles className="w-3.5 h-3.5 fill-brand" />
          <span className="uppercase text-[11px] font-black tracking-wider">The Neighborhood Sharing Network</span>
        </div>

        {/* Minimalist, Editorial Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-ink tracking-tight font-display leading-[1.08] max-w-4xl mx-auto">
          Borrow. Rent. Lend.{' '}
          <span className="text-brand relative inline-block">
            Everything.
            <svg
              className="absolute -bottom-2 sm:-bottom-3 left-0 w-full"
              viewBox="0 0 250 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 9C50 3 150 2 247 8"
                stroke="#E11D74"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        {/* Chic Value Proposition Explaining What Rentu Is */}
        <p className="mt-6 sm:mt-8 text-base sm:text-lg lg:text-xl font-medium text-ink-secondary max-w-2xl mx-auto leading-relaxed">
          Why buy gear you will only use once? Rent cameras, outdoor equipment, tech, and everyday essentials from verified neighbors nearby — or monetize what you own.
        </p>

        {/* Two Call To Action Buttons: List Something & Request Something */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 max-w-md mx-auto">
          {/* CTA 1: List Something */}
          <button
            type="button"
            onClick={onOpenDropGear}
            className="w-full sm:w-auto btn-primary text-sm sm:text-base px-7 sm:px-8 py-3.5 sm:py-4 font-black shadow-pink rounded-full inline-flex items-center justify-center gap-2.5 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="List gear or an item to earn rental income"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>List Something</span>
          </button>

          {/* CTA 2: Request Something */}
          <button
            type="button"
            onClick={onOpenDropWish || onGetStarted}
            className="w-full sm:w-auto bg-surface hover:bg-canvas text-ink border border-divider hover:border-brand/40 text-sm sm:text-base px-7 sm:px-8 py-3.5 sm:py-4 font-black rounded-full inline-flex items-center justify-center gap-2.5 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Ask neighbors for something you want to borrow or rent"
          >
            <Zap className="w-4 h-4 text-brand" />
            <span>Request Something</span>
          </button>
        </div>

        {/* Micro Trust & Safety Perks */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs font-semibold text-ink-secondary">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>100% Peer Verified</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-divider hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <span className="text-amber-500 font-bold">🔒</span>
            <span>6-Digit Handover Verification</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-divider hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <span className="text-brand font-bold">💬</span>
            <span>Direct DM Agreements</span>
          </div>
        </div>

        {/* Minimalist Community Stats Strip */}
        <div className="mt-12 sm:mt-16 bg-surface/90 backdrop-blur-sm border border-divider rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 divide-x-0 sm:divide-x divide-divider w-full md:w-auto">
            <div className="text-center sm:text-left sm:pr-6">
              <div className="text-2xl sm:text-3xl font-black text-ink font-display">{itemsCount}</div>
              <div className="text-xs font-semibold text-ink-secondary">Items Available</div>
            </div>
            <div className="text-center sm:text-left sm:px-6">
              <div className="text-2xl sm:text-3xl font-black text-ink font-display">{requestsCount}</div>
              <div className="text-xs font-semibold text-ink-secondary">Active Requests</div>
            </div>
            <div className="text-center sm:text-left sm:px-6">
              <div className="text-2xl sm:text-3xl font-black text-ink font-display">8</div>
              <div className="text-xs font-semibold text-ink-secondary">Categories</div>
            </div>
            <div className="text-center sm:text-left sm:pl-6">
              <div className="text-2xl sm:text-3xl font-black text-brand font-display">100%</div>
              <div className="text-xs font-semibold text-ink-secondary">Peer Verified</div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-divider">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-secondary">
              <div className="w-7 h-7 rounded-full bg-[#FCE7F3] dark:bg-pink-950/60 text-brand flex items-center justify-center shrink-0">
                <Heart className="w-3.5 h-3.5 fill-brand" />
              </div>
              <span className="hidden lg:inline">Join a neighborhood that shares & saves.</span>
            </div>

            <button
              type="button"
              onClick={onGetStarted}
              className="btn-primary text-xs px-5 py-2.5 shrink-0 cursor-pointer rounded-full inline-flex items-center gap-1.5"
            >
              <span>Explore Marketplace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};
