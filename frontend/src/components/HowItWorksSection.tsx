import React, { useState } from 'react';
import { 
  Zap, 
  ArrowRight, 
  Quote, 
  Users, 
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Gift
} from 'lucide-react';
import { useAuth } from '../lib/authContext';

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
  onOpenDropWish,
  onOpenAuth,
  onViewCommunity,
  showCommunityLink = true,
}) => {
  const { isAuthenticated } = useAuth();
  const [howItWorksTab, setHowItWorksTab] = useState<'renting' | 'listing' | 'trust'>('renting');

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="bg-surface rounded-3xl border border-divider p-6 sm:p-10 shadow-lg space-y-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-divider pb-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-brand tracking-wider">
              <Zap className="w-4 h-4" />
              <span>The Rentu Experience</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-ink font-display">
              How Rentu⁺ Works
            </h2>
            <p className="text-xs sm:text-sm text-ink-secondary">
              Everything you need to know about borrowing, renting, listing, and building neighborhood trust.
            </p>
          </div>

          {/* Toggle Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-canvas rounded-2xl border border-divider shrink-0">
            <button
              onClick={() => setHowItWorksTab('renting')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                howItWorksTab === 'renting'
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              1. Borrowing Gear
            </button>
            <button
              onClick={() => setHowItWorksTab('listing')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                howItWorksTab === 'listing'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              2. Listing & Lending
            </button>
            <button
              onClick={() => setHowItWorksTab('trust')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                howItWorksTab === 'trust'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              3. Trust & Reviews
            </button>
          </div>
        </div>

        {/* TAB 1: RENTING / BORROWING GEAR */}
        {howItWorksTab === 'renting' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Step 1 */}
              <div 
                onClick={onExploreGear}
                className="p-5 rounded-2xl bg-canvas border border-divider space-y-3 relative group hover:border-brand/40 transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-2xl bg-brand-soft text-brand font-black flex items-center justify-center text-sm shadow-xs">
                  1
                </div>
                <h3 className="font-extrabold text-base text-ink">Find Local Gear</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Search cameras, projectors, tents, audio mixers, or power tools available right in your locality. Filter by distance, category, or rental price.
                </p>
                <div className="pt-2 text-[11px] font-bold text-brand flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Explore gear near you</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-5 rounded-2xl bg-canvas border border-divider space-y-3 relative group hover:border-brand/40 transition-all">
                <div className="w-10 h-10 rounded-2xl bg-brand-soft text-brand font-black flex items-center justify-center text-sm shadow-xs">
                  2
                </div>
                <h3 className="font-extrabold text-base text-ink">Set Calendar & Handover</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Select your exact rental start and return dates from the interactive calendar. Choose between meeting at the owner's spot, requesting delivery, or a custom mutual spot.
                </p>
                <div className="pt-2 text-[11px] font-bold text-brand flex items-center gap-1">
                  <span>Flexible 3-way handover</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-5 rounded-2xl bg-canvas border border-divider space-y-3 relative group hover:border-brand/40 transition-all">
                <div className="w-10 h-10 rounded-2xl bg-brand-soft text-brand font-black flex items-center justify-center text-sm shadow-xs">
                  3
                </div>
                <h3 className="font-extrabold text-base text-ink">Create, Flex & Return</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Pick up the equipment, shoot your project or enjoy your weekend getaway, and return on time. Leave a review to boost each other's community karma!
                </p>
                <div className="pt-2 text-[11px] font-bold text-brand flex items-center gap-1">
                  <span>5-star reviews build score</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

            </div>

            {/* Bottom Notice */}
            <div className="p-4 rounded-2xl bg-brand/5 border border-brand/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-ink font-medium">
                <span className="text-base">💡</span>
                <span>Can't find what you need? Post a request and verified neighbors will offer their idle gear to you!</span>
              </div>
              <button
                onClick={() => {
                  if (!isAuthenticated && onOpenAuth) {
                    onOpenAuth();
                  } else if (onOpenDropWish) {
                    onOpenDropWish();
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl bg-brand text-white text-xs font-bold shrink-0 hover:bg-brand-hover cursor-pointer shadow-xs hover:scale-105 transition-all"
              >
                Post a Gear Request
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: LISTING & LENDING */}
        {howItWorksTab === 'listing' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Step 1 */}
              <div 
                onClick={() => {
                  if (!isAuthenticated && onOpenAuth) {
                    onOpenAuth();
                  } else if (onOpenDropGear) {
                    onOpenDropGear();
                  }
                }}
                className="p-5 rounded-2xl bg-canvas border border-divider space-y-3 relative group hover:border-purple-400 transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-black flex items-center justify-center text-sm shadow-xs">
                  1
                </div>
                <h3 className="font-extrabold text-base text-ink">List In Under 2 Minutes</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Snap a photo of your camera, projector, or camping kit. Set your daily price or offer it for ₹0/day as a free community share to earn gift economy karma!
                </p>
                <div className="pt-2 text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Free or paid rentals</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-5 rounded-2xl bg-canvas border border-divider space-y-3 relative group hover:border-purple-400 transition-all">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-black flex items-center justify-center text-sm shadow-xs">
                  2
                </div>
                <h3 className="font-extrabold text-base text-ink">Vet Requests with Trust Scores</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Review borrower profiles, verified student IDs, and past rental reviews before accepting. Chat directly with the renter to finalize handover logistics.
                </p>
                <div className="pt-2 text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <span>Full owner control</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-5 rounded-2xl bg-canvas border border-divider space-y-3 relative group hover:border-purple-400 transition-all">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-black flex items-center justify-center text-sm shadow-xs">
                  3
                </div>
                <h3 className="font-extrabold text-base text-ink">Earn Passive Cash & Status</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Collect rental cash securely while keeping 100% gear ownership. Top lenders who actively provide equipment earn permanent spots on the Top 10 Leaderboard!
                </p>
                <div className="pt-2 text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <span>Become a Top 10 Lender</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

            </div>

            {/* Bottom Notice */}
            <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-ink font-medium">
                <span className="text-base">🛡️</span>
                <span>Your gear is protected: Every booking records item handover condition and contact verification.</span>
              </div>
              <button
                onClick={() => {
                  if (!isAuthenticated && onOpenAuth) {
                    onOpenAuth();
                  } else if (onOpenDropGear) {
                    onOpenDropGear();
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shrink-0 cursor-pointer shadow-xs hover:scale-105 transition-all"
              >
                List Your First Gear
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: TRUST & REVIEWS CRUCIAL RULE (User Rule: Best reviews get top 10) */}
        {howItWorksTab === 'trust' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Pillar 1 */}
              <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-black flex items-center justify-center text-sm shadow-xs">
                  🌟
                </div>
                <h3 className="font-extrabold text-base text-ink">Reviews Rule Over Volume</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  <strong>Quality beats quantity:</strong> Even if you only share gear occasionally, if you have flawless 5.0 reviews and a stellar Trust Score, you will rank directly in our Top 10 Community Champions!
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="p-5 rounded-2xl bg-canvas border border-divider space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-black flex items-center justify-center text-sm shadow-xs">
                  🛡️
                </div>
                <h3 className="font-extrabold text-base text-ink">Dynamic Trust Score (0-100)</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Calculated automatically from verified phone numbers, student/work identification, prompt on-time return rates, and positive post-rental peer reviews.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="p-5 rounded-2xl bg-canvas border border-divider space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-black flex items-center justify-center text-sm shadow-xs">
                  🎁
                </div>
                <h3 className="font-extrabold text-base text-ink">Gift Economy & Free Shares</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Believe in anti-ownership? Members who share tools, books, and tents for free borrowing (₹0/day) earn dedicated recognition in our Free Sharers Leaderboard!
                </p>
              </div>

            </div>

            {/* Anti Ownership Pledge Box */}
            <div className="p-5 rounded-2xl bg-canvas border border-divider flex items-center gap-4">
              <Quote className="w-8 h-8 text-brand shrink-0 opacity-80" />
              <p className="text-xs sm:text-sm text-ink-secondary italic">
                "Ownership is an outdated burden. Access is freedom. By sharing what we have, we spend less, waste less, and create stronger, more connected neighborhoods."
              </p>
            </div>
          </div>
        )}

        {/* Link to Community Hall of Fame if enabled */}
        {showCommunityLink && onViewCommunity && (
          <div className="pt-2 flex items-center justify-between border-t border-divider text-xs">
            <div className="flex items-center gap-2 text-ink-secondary font-medium">
              <Users className="w-4 h-4 text-brand" />
              <span>Want to see India's top lenders, borrowers, and 5-star neighbors?</span>
            </div>
            <button
              onClick={onViewCommunity}
              className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Explore Top 10 Community Champions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

      </div>
    </section>
  );
};
