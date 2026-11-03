import React from 'react';
import { 
  Search, 
  ShieldCheck, 
  RotateCcw, 
  ArrowRight, 
  Plus
} from 'lucide-react';

interface HowItWorksSectionProps {
  onExploreGear?: () => void;
  onOpenDropGear?: () => void;
  onOpenDropWish?: () => void;
  onOpenAuth?: () => void;
  onViewCommunity?: () => void;
  showCommunityLink?: boolean;
}

export const HowItWorksSection: React.FC<HowItWorksSectionProps> = ({
  onExploreGear,
  onOpenDropGear,
}) => {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="bg-surface rounded-3xl border border-divider p-6 sm:p-10 shadow-sm space-y-8">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-divider pb-5">
          <div>
            <span className="text-[11px] font-black uppercase text-brand tracking-wider">
              Simple & Secure
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-ink font-display mt-0.5">
              How Rentu Works
            </h2>
            <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
              Renting from neighbors is fast, safe, and transparent.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExploreGear}
              className="btn-secondary text-xs px-3.5 py-1.5 font-bold cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Explore Gear</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onOpenDropGear}
              className="btn-primary text-xs px-3.5 py-1.5 font-bold shadow-pink cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>List Item</span>
            </button>
          </div>
        </div>

        {/* 3 Clear, Linear Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Step 1 */}
          <div className="p-5 rounded-2xl bg-canvas border border-divider space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand font-black flex items-center justify-center text-xs">
              <Search className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-ink font-display">
              1. Browse & Reserve
            </h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Find cameras, tools, camping equipment, or everyday essentials from verified neighbors nearby. Pick your dates on the calendar.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-5 rounded-2xl bg-canvas border border-divider space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black flex items-center justify-center text-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-ink font-display">
              2. Meet & Verify
            </h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Coordinate meetup details via direct chat. When handing over the item, verify the exchange with secure 6-digit codes on your phones.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-5 rounded-2xl bg-canvas border border-divider space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black flex items-center justify-center text-xs">
              <RotateCcw className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-ink font-display">
              3. Use & Return
            </h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Enjoy using the gear for your shoot, project, or trip. Return it on time, verify the return handover code, and leave a review.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};
