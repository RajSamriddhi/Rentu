import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Sparkles, 
  ShieldCheck, 
  Star, 
  Award, 
  HeartHandshake, 
  ArrowRight, 
  Plus, 
  Target, 
  Compass, 
  Crown, 
  Medal, 
  CheckCircle2, 
  TrendingUp, 
  Gift, 
  Package, 
  Calendar, 
  MapPin, 
  MessageSquare,
  HelpCircle,
  ThumbsUp,
  RefreshCw,
  Zap,
  Quote
} from 'lucide-react';
import { api } from '../lib/api';
import { CommunityLeaderboardData, CommunityLeaderboardMember } from '../lib/types';
import { useAuth } from '../lib/authContext';
import { HowItWorksSection } from './HowItWorksSection';

interface CommunityViewProps {
  onOpenDropGear: () => void;
  onOpenDropWish: () => void;
  onExploreGear: () => void;
  onOpenAuth?: () => void;
  onOpenUserProfile?: (userId: string) => void;
}

type LeaderboardCategory = 'top_rated' | 'top_lenders' | 'top_borrowers' | 'top_sharers';

export const CommunityView: React.FC<CommunityViewProps> = ({
  onOpenDropGear,
  onOpenDropWish,
  onExploreGear,
  onOpenAuth,
  onOpenUserProfile,
}) => {
  const { isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState<LeaderboardCategory>('top_rated');
  const [leaderboardData, setLeaderboardData] = useState<CommunityLeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getCommunityLeaderboard();
      setLeaderboardData(data);
    } catch (err: any) {
      console.error('Failed to load community leaderboard:', err);
      setError(err.message || 'Unable to load leaderboard. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getActiveList = (): CommunityLeaderboardMember[] => {
    if (!leaderboardData) return [];
    return leaderboardData[activeCategory] || [];
  };

  const currentList = getActiveList();
  const topThree = currentList.slice(0, 3);
  const remainingMembers = currentList.slice(3, 10);

  const renderCardStats = (member: CommunityLeaderboardMember, isGold = false) => {
    if (activeCategory === 'top_rated') {
      return (
        <div className="pt-2 border-t border-divider grid grid-cols-2 gap-2 text-xs">
          <div className={`p-2.5 rounded-xl bg-canvas ${isGold ? 'border border-amber-300 dark:border-amber-800/40' : ''}`}>
            <div className="text-[10px] text-ink-muted font-bold uppercase">Star Rating</div>
            <div className="font-black text-ink flex items-center gap-1 mt-0.5">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{member.rating.toFixed(2)} ★ ({member.reviews_count} reviews)</span>
            </div>
          </div>
          <div className={`p-2.5 rounded-xl bg-canvas ${isGold ? 'border border-amber-300 dark:border-amber-800/40' : ''}`}>
            <div className="text-[10px] text-ink-muted font-bold uppercase">Trust Score</div>
            <div className="font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{member.trust_score}% Verified</span>
            </div>
          </div>
        </div>
      );
    }
    if (activeCategory === 'top_lenders') {
      return (
        <div className="pt-2 border-t border-divider grid grid-cols-2 gap-2 text-xs">
          <div className={`p-2.5 rounded-xl bg-canvas ${isGold ? 'border border-amber-300 dark:border-amber-800/40' : ''}`}>
            <div className="text-[10px] text-ink-muted font-bold uppercase">Rentals Completed</div>
            <div className="font-black text-ink mt-0.5">
              {member.lent_count} Rentals Lent
            </div>
          </div>
          <div className={`p-2.5 rounded-xl bg-canvas ${isGold ? 'border border-amber-300 dark:border-amber-800/40' : ''}`}>
            <div className="text-[10px] text-ink-muted font-bold uppercase">Gear Closet</div>
            <div className="font-black text-brand mt-0.5">
              {member.items_count} Items Listed
            </div>
          </div>
        </div>
      );
    }
    if (activeCategory === 'top_borrowers') {
      return (
        <div className="pt-2 border-t border-divider grid grid-cols-2 gap-2 text-xs">
          <div className={`p-2.5 rounded-xl bg-canvas ${isGold ? 'border border-amber-300 dark:border-amber-800/40' : ''}`}>
            <div className="text-[10px] text-ink-muted font-bold uppercase">Gear Borrowed</div>
            <div className="font-black text-ink mt-0.5">
              {member.borrowed_count} Rentals
            </div>
          </div>
          <div className={`p-2.5 rounded-xl bg-canvas ${isGold ? 'border border-amber-300 dark:border-amber-800/40' : ''}`}>
            <div className="text-[10px] text-ink-muted font-bold uppercase">Return Rate</div>
            <div className="font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              100% On-Time
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="pt-2 border-t border-divider grid grid-cols-2 gap-2 text-xs">
        <div className={`p-2.5 rounded-xl bg-canvas ${isGold ? 'border border-amber-300 dark:border-amber-800/40' : ''}`}>
          <div className="text-[10px] text-ink-muted font-bold uppercase">Free Shares</div>
          <div className="font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {member.free_items_count} Free Items (₹0)
          </div>
        </div>
        <div className={`p-2.5 rounded-xl bg-canvas ${isGold ? 'border border-amber-300 dark:border-amber-800/40' : ''}`}>
          <div className="text-[10px] text-ink-muted font-bold uppercase">Generosity Score</div>
          <div className="font-black text-ink mt-0.5">
            {member.trust_score}% Karma
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-canvas text-ink pb-20">
      
      {/* 1. COMMUNITY HERO SECTION */}
      <section className="relative overflow-hidden border-b border-divider bg-surface/60 backdrop-blur-md pt-8 sm:pt-14 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8 transition-colors">
        {/* Soft Ambient Background Glows */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand/10 dark:bg-brand/15 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/15 rounded-full blur-3xl pointer-events-none translate-y-1/4" />

        <div className="max-w-6xl mx-auto relative z-10 text-center space-y-4 sm:space-y-6">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-soft border border-brand/20 text-brand text-xs font-black uppercase tracking-wider shadow-xs animate-in fade-in duration-300">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Rentu⁺ Neighborhood Collective</span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-ink font-display leading-[1.1]">
            Borrow. Lend. Share. <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand via-pink-500 to-purple-600">
              Together As A Community.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-ink-secondary font-medium leading-relaxed">
            The anti-ownership peer network where neighbors unlock premium gear, earn passive income, 
            and celebrate the top 10 verified champions across India.
          </p>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onExploreGear}
              className="btn-primary text-xs sm:text-sm font-bold shadow-pink inline-flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Gear Marketplace</span>
            </button>

            <button
              onClick={() => {
                if (!isAuthenticated && onOpenAuth) {
                  onOpenAuth();
                } else {
                  onOpenDropGear();
                }
              }}
              className="btn-secondary text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
            >
              <Plus className="w-4 h-4 text-brand" />
              <span>List Gear for Rent</span>
            </button>

            <button
              onClick={() => {
                if (!isAuthenticated && onOpenAuth) {
                  onOpenAuth();
                } else {
                  onOpenDropWish();
                }
              }}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 inline-flex items-center gap-2 cursor-pointer transition-all"
            >
              <Target className="w-4 h-4" />
              <span>Post a Wish / Request</span>
            </button>
          </div>

          {/* Metric Stats Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto pt-6 text-left">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-surface/80 border border-divider shadow-xs backdrop-blur-xs">
              <div className="text-xl sm:text-2xl font-black text-ink font-display">100%</div>
              <div className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mt-0.5">Peer Verified</div>
              <p className="text-[11px] text-ink-secondary mt-1">Student & Govt ID checked</p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-surface/80 border border-divider shadow-xs backdrop-blur-xs">
              <div className="text-xl sm:text-2xl font-black text-brand font-display">₹50,000</div>
              <div className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mt-0.5">Trust Shield</div>
              <p className="text-[11px] text-ink-secondary mt-1">Peer security deposit protection</p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-surface/80 border border-divider shadow-xs backdrop-blur-xs">
              <div className="text-xl sm:text-2xl font-black text-amber-500 font-display">5.00 ★</div>
              <div className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mt-0.5">Avg Neighbor Score</div>
              <p className="text-[11px] text-ink-secondary mt-1">Flawless 5-star community</p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-surface/80 border border-divider shadow-xs backdrop-blur-xs">
              <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 font-display">Top 10</div>
              <div className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mt-0.5">Community Board</div>
              <p className="text-[11px] text-ink-secondary mt-1">Best reviews get rewarded</p>
            </div>
          </div>

        </div>
      </section>

      {/* 2. HOW IT ALL WORKS SECTION */}
      <HowItWorksSection
        onExploreGear={onExploreGear}
        onOpenDropGear={onOpenDropGear}
        onOpenDropWish={onOpenDropWish}
        onOpenAuth={onOpenAuth}
        showCommunityLink={false}
      />

      {/* 3. COMMUNITY TOP 10 LEADERBOARD */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        
        {/* Leaderboard Header */}
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-xs font-black uppercase tracking-wider">
            <Crown className="w-4 h-4 text-amber-500" />
            <span>Community Hall of Fame</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-ink font-display">
            The Top 10 Community Champions
          </h2>
          <p className="text-xs sm:text-sm text-ink-secondary max-w-2xl mx-auto">
            Honoring our most trusted gear sharers, active borrowers, generous neighbors, and 5-star reviewed creators.
          </p>
        </div>

        {/* 4 Interactive Category Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          
          {/* Tab 1: Top Rated & Best Reviews */}
          <button
            id="tab-top-rated"
            onClick={() => setActiveCategory('top_rated')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeCategory === 'top_rated'
                ? 'bg-amber-500 text-white shadow-md scale-105'
                : 'bg-surface border border-divider text-ink-secondary hover:text-ink hover:bg-canvas'
            }`}
          >
            <Star className="w-4 h-4 fill-current" />
            <span>Best Reviews & Trust Score</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-black">
              Top 10
            </span>
          </button>

          {/* Tab 2: Top Lenders (Renting Out) */}
          <button
            id="tab-top-lenders"
            onClick={() => setActiveCategory('top_lenders')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeCategory === 'top_lenders'
                ? 'bg-brand text-white shadow-pink scale-105'
                : 'bg-surface border border-divider text-ink-secondary hover:text-ink hover:bg-canvas'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Top Lenders (Renting Out)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-black">
              Top 10
            </span>
          </button>

          {/* Tab 3: Top Borrowers */}
          <button
            id="tab-top-borrowers"
            onClick={() => setActiveCategory('top_borrowers')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeCategory === 'top_borrowers'
                ? 'bg-purple-600 text-white shadow-md scale-105'
                : 'bg-surface border border-divider text-ink-secondary hover:text-ink hover:bg-canvas'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Top Borrowers</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-black">
              Top 10
            </span>
          </button>

          {/* Tab 4: Top Free Sharers */}
          <button
            id="tab-top-sharers"
            onClick={() => setActiveCategory('top_sharers')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeCategory === 'top_sharers'
                ? 'bg-emerald-600 text-white shadow-md scale-105'
                : 'bg-surface border border-divider text-ink-secondary hover:text-ink hover:bg-canvas'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>Free Sharers (Borrowing)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-black">
              Top 10
            </span>
          </button>

        </div>

        {/* Category Description Banner */}
        <div className="p-4 rounded-2xl bg-surface border border-divider shadow-xs text-center mb-8 max-w-3xl mx-auto animate-in fade-in duration-200">
          {activeCategory === 'top_rated' && (
            <p className="text-xs text-ink-secondary leading-relaxed">
              ⭐ <strong className="text-ink">Best Reviews & Score Rule:</strong> Ranked strictly by 
              highest rating and trust score. Even if a neighbor has only rented gear a few times, 
              having flawless 5-star reviews and top reputation places them right at the top of the leaderboard!
            </p>
          )}
          {activeCategory === 'top_lenders' && (
            <p className="text-xs text-ink-secondary leading-relaxed">
              🏷️ <strong className="text-ink">Top Gear Lenders:</strong> The generous creators who keep 
              cameras, drones, projectors, and gear in active community circulation, providing neighbors with reliable rentals.
            </p>
          )}
          {activeCategory === 'top_borrowers' && (
            <p className="text-xs text-ink-secondary leading-relaxed">
              🎒 <strong className="text-ink">Circular Borrowers:</strong> Passionate creators and students who 
              frequently borrow gear, care for items meticulously, and boast a 100% on-time return track record.
            </p>
          )}
          {activeCategory === 'top_sharers' && (
            <p className="text-xs text-ink-secondary leading-relaxed">
              🎁 <strong className="text-ink">Gift Economy Champions:</strong> Neighbors who give equipment for 
              free borrowing (₹0/day) or fulfill open wishes freely to support students and neighborhood projects.
            </p>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-16 text-center space-y-4">
            <RefreshCw className="w-8 h-8 text-brand animate-spin mx-auto" />
            <p className="text-xs font-bold text-ink-secondary">Loading community champions...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 text-center space-y-3 max-w-md mx-auto">
            <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={fetchLeaderboard}
              className="btn-secondary text-xs px-4 py-2 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* LEADERBOARD CONTENT */}
        {!isLoading && !error && currentList.length > 0 && (
          <div className="space-y-10">
            
            {/* 3.1 TOP 3 PODIUM DISPLAY */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              
              {/* #2 Silver (Rendered First on Desktop for Olympic Podium effect, or standard order) */}
              {topThree[1] && (
                <div className="p-6 rounded-3xl bg-surface border-2 border-slate-300 dark:border-slate-700 shadow-md flex flex-col justify-between space-y-4 relative overflow-hidden group hover:-translate-y-1 transition-transform">
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black">
                    <Medal className="w-4 h-4 text-slate-400" />
                    <span>#2 Silver</span>
                  </div>

                  <div className="space-y-3 pt-4">
                    <button
                      type="button"
                      onClick={() => onOpenUserProfile && onOpenUserProfile(topThree[1].id)}
                      className="flex items-center gap-3 text-left group/user cursor-pointer"
                      title={`View ${topThree[1].name}'s public profile`}
                    >
                      <div className="relative">
                        <img
                          src={topThree[1].avatar_url}
                          alt={topThree[1].name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-slate-300 dark:border-slate-600 shadow-sm group-hover/user:ring-2 group-hover/user:ring-brand"
                        />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-500 text-white flex items-center justify-center text-xs font-black shadow-xs">
                          2
                        </div>
                      </div>
                      <div>
                        <h4 className="font-extrabold text-base text-ink leading-tight flex items-center gap-1.5 group-hover/user:text-brand">
                          <span>{topThree[1].name}</span>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        </h4>
                        <div className="flex items-center gap-1 text-[11px] text-ink-secondary mt-0.5">
                          <MapPin className="w-3 h-3 text-ink-muted" />
                          <span>{topThree[1].locality || 'Bengaluru'}</span>
                        </div>
                      </div>
                    </button>

                    <p className="text-xs text-ink-secondary line-clamp-2">
                      {topThree[1].bio}
                    </p>

                    {/* Stats & Score */}
                    {renderCardStats(topThree[1])}

                    {/* Highlight Review */}
                    {topThree[1].highlight_review && (
                      <div className="p-3 rounded-xl bg-canvas/80 border border-divider text-[11px] text-ink-secondary italic flex items-start gap-2">
                        <Quote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">"{topThree[1].highlight_review}"</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-divider/60">
                    <div className="flex flex-wrap gap-1.5">
                      {topThree[1].badges.map((b, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {b}
                        </span>
                      ))}
                    </div>
                    {onOpenUserProfile && (
                      <button
                        type="button"
                        onClick={() => onOpenUserProfile(topThree[1].id)}
                        className="text-xs font-extrabold text-brand hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        Profile <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* #1 Gold Champion (Center Stage, Crown, Glowing Accent) */}
              {topThree[0] && (
                <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-amber-500/10 via-surface to-surface border-2 border-amber-400 dark:border-amber-500/80 shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden group hover:-translate-y-1.5 transition-all md:-translate-y-2">
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-black shadow-xs">
                    <Crown className="w-4 h-4 fill-current text-white" />
                    <span>#1 Champion</span>
                  </div>

                  <div className="space-y-3 pt-4">
                    <button
                      type="button"
                      onClick={() => onOpenUserProfile && onOpenUserProfile(topThree[0].id)}
                      className="flex items-center gap-3 text-left group/user cursor-pointer"
                      title={`View ${topThree[0].name}'s public profile`}
                    >
                      <div className="relative">
                        <img
                          src={topThree[0].avatar_url}
                          alt={topThree[0].name}
                          className="w-20 h-20 rounded-full object-cover border-4 border-amber-400 shadow-md ring-4 ring-amber-400/20 group-hover/user:ring-amber-500"
                        />
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black shadow-xs">
                          👑
                        </div>
                      </div>
                      <div>
                        <h4 className="font-extrabold text-lg text-ink leading-tight flex items-center gap-1.5 group-hover/user:text-amber-500">
                          <span>{topThree[0].name}</span>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        </h4>
                        <div className="flex items-center gap-1 text-xs text-ink-secondary mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-semibold">{topThree[0].locality || 'Bengaluru'}</span>
                        </div>
                        <div className="inline-block mt-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider">
                          Community #1 Ranked
                        </div>
                      </div>
                    </button>

                    <p className="text-xs sm:text-sm text-ink-secondary line-clamp-2">
                      {topThree[0].bio}
                    </p>

                    {/* Stats & Score */}
                    {renderCardStats(topThree[0], true)}

                    {/* Highlight Review */}
                    {topThree[0].highlight_review && (
                      <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30 text-xs text-ink-secondary italic flex items-start gap-2">
                        <Quote className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">"{topThree[0].highlight_review}"</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-amber-300/40">
                    <div className="flex flex-wrap gap-1.5">
                      {topThree[0].badges.map((b, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50">
                          {b}
                        </span>
                      ))}
                    </div>
                    {onOpenUserProfile && (
                      <button
                        type="button"
                        onClick={() => onOpenUserProfile(topThree[0].id)}
                        className="text-xs font-black text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        View Profile <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* #3 Bronze */}
              {topThree[2] && (
                <div className="p-6 rounded-3xl bg-surface border-2 border-amber-700/30 dark:border-amber-800/50 shadow-md flex flex-col justify-between space-y-4 relative overflow-hidden group hover:-translate-y-1 transition-transform">
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 text-xs font-black">
                    <Medal className="w-4 h-4 text-amber-700" />
                    <span>#3 Bronze</span>
                  </div>

                  <div className="space-y-3 pt-4">
                    <button
                      type="button"
                      onClick={() => onOpenUserProfile && onOpenUserProfile(topThree[2].id)}
                      className="flex items-center gap-3 text-left group/user cursor-pointer"
                      title={`View ${topThree[2].name}'s public profile`}
                    >
                      <div className="relative">
                        <img
                          src={topThree[2].avatar_url}
                          alt={topThree[2].name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-amber-600/40 shadow-sm group-hover/user:ring-2 group-hover/user:ring-amber-600"
                        />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-700 text-white flex items-center justify-center text-xs font-black shadow-xs">
                          3
                        </div>
                      </div>
                      <div>
                        <h4 className="font-extrabold text-base text-ink leading-tight flex items-center gap-1.5 group-hover/user:text-amber-700">
                          <span>{topThree[2].name}</span>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        </h4>
                        <div className="flex items-center gap-1 text-[11px] text-ink-secondary mt-0.5">
                          <MapPin className="w-3 h-3 text-ink-muted" />
                          <span>{topThree[2].locality || 'Bengaluru'}</span>
                        </div>
                      </div>
                    </button>

                    <p className="text-xs text-ink-secondary line-clamp-2">
                      {topThree[2].bio}
                    </p>

                    {/* Stats & Score */}
                    {renderCardStats(topThree[2])}

                    {/* Highlight Review */}
                    {topThree[2].highlight_review && (
                      <div className="p-3 rounded-xl bg-canvas/80 border border-divider text-[11px] text-ink-secondary italic flex items-start gap-2">
                        <Quote className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">"{topThree[2].highlight_review}"</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-divider/60">
                    <div className="flex flex-wrap gap-1.5">
                      {topThree[2].badges.map((b, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">
                          {b}
                        </span>
                      ))}
                    </div>
                    {onOpenUserProfile && (
                      <button
                        type="button"
                        onClick={() => onOpenUserProfile(topThree[2].id)}
                        className="text-xs font-extrabold text-brand hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        Profile <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* 3.2 RANKS #4 THROUGH #10 LIST */}
            {remainingMembers.length > 0 && (
              <div className="bg-surface rounded-3xl border border-divider overflow-hidden shadow-md">
                
                <div className="px-6 py-4 border-b border-divider bg-canvas/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-brand" />
                    <span className="text-xs font-black uppercase text-ink tracking-wider font-display">
                      Community Champions (Rank #4 to #10)
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-ink-muted">
                    Verified Members & Creators
                  </span>
                </div>

                  <div className="divide-y divide-divider">
                    {remainingMembers.map((member) => (
                      <div 
                        key={member.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-canvas/50 transition-colors"
                      >
                        {/* Left: Rank & Member Identity */}
                        <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
                          {/* Rank Badge */}
                          <div className="w-8 h-8 rounded-full bg-canvas border border-divider font-black text-xs text-ink-secondary flex items-center justify-center shrink-0">
                            #{member.rank}
                          </div>

                          {/* Clickable Profile Identity */}
                          <button
                            type="button"
                            onClick={() => onOpenUserProfile && onOpenUserProfile(member.id)}
                            className="flex items-center gap-3 text-left group/member cursor-pointer min-w-0"
                            title={`View ${member.name}'s public profile`}
                          >
                            <img
                              src={member.avatar_url}
                              alt={member.name}
                              className="w-12 h-12 rounded-full object-cover border border-divider shrink-0 group-hover/member:ring-2 group-hover/member:ring-brand"
                            />

                            {/* Name, Locality, Bio */}
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-sm text-ink group-hover/member:text-brand group-hover/member:underline">{member.name}</span>
                                <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                                  <MapPin className="w-3 h-3" />
                                  <span>{member.locality || 'Bengaluru'}</span>
                                </span>
                              </div>
                              <p className="text-xs text-ink-secondary line-clamp-1 max-w-md">
                                {member.bio}
                              </p>
                              {member.highlight_review && (
                                <p className="text-[11px] text-ink-muted italic line-clamp-1">
                                  "{member.highlight_review}"
                                </p>
                              )}
                            </div>
                          </button>
                        </div>

                        {/* Right: Scores & Metrics */}
                        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                          {/* Trust & Rating */}
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1 text-xs font-black text-ink">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <span>{member.rating.toFixed(2)} ★</span>
                            </div>
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-black mt-0.5">
                              <ShieldCheck className="w-3 h-3" />
                              <span>{member.trust_score}% Trust</span>
                            </div>
                          </div>

                          {/* Metric Badge */}
                          <div className="px-3 py-1.5 rounded-xl bg-canvas border border-divider text-right min-w-[120px]">
                            <div className="text-[9px] font-bold text-ink-muted uppercase tracking-wider">
                              {member.metric_label}
                            </div>
                            <div className="text-xs font-black text-ink truncate">
                              {member.metric_value}
                            </div>
                          </div>

                          {onOpenUserProfile && (
                            <button
                              type="button"
                              onClick={() => onOpenUserProfile(member.id)}
                              className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-brand/10 hover:bg-brand text-brand hover:text-white transition-all cursor-pointer hidden sm:flex items-center gap-1 shrink-0"
                            >
                              <span>Profile</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>

              </div>
            )}

          </div>
        )}

      </section>

      {/* 4. ANTI-OWNERSHIP PLEDGE & GUIDELINES */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="bg-gradient-to-r from-brand/10 via-purple-500/10 to-brand/5 rounded-3xl border border-divider p-6 sm:p-10 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-divider text-xs font-black uppercase text-ink tracking-wider">
            <HeartHandshake className="w-4 h-4 text-brand" />
            <span>Community Guidelines & Anti-Ownership Manifesto</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-black text-ink font-display">
            How To Stay In The Top 10
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-left pt-2">
            <div className="p-4 rounded-2xl bg-surface/90 border border-divider space-y-2">
              <div className="text-lg">⏱️</div>
              <h4 className="font-extrabold text-xs text-ink uppercase">Be Punctual</h4>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Always stick to your agreed calendar handover time. 100% on-time returns elevate your Trust Score.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface/90 border border-divider space-y-2">
              <div className="text-lg">🧼</div>
              <h4 className="font-extrabold text-xs text-ink uppercase">Treat Gear Like Gold</h4>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Return items in clean, pristine condition. Great gear hygiene earns you 5-star reviews from owners.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface/90 border border-divider space-y-2">
              <div className="text-lg">💬</div>
              <h4 className="font-extrabold text-xs text-ink uppercase">Communicate Early</h4>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Coordinate pickup logistics via Rentu chat. Prompt responders get marked as preferred community peers.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface/90 border border-divider space-y-2">
              <div className="text-lg">🎁</div>
              <h4 className="font-extrabold text-xs text-ink uppercase">Give Back & Share</h4>
              <p className="text-xs text-ink-secondary leading-relaxed">
                List idle items or offer free sharing. Helping students and neighbors unlocks our Free Sharers Badge!
              </p>
            </div>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onExploreGear}
              className="btn-primary text-xs shadow-pink cursor-pointer"
            >
              Start Exploring Rentals 🚀
            </button>
            <button
              onClick={() => {
                if (!isAuthenticated && onOpenAuth) {
                  onOpenAuth();
                } else {
                  onOpenDropGear();
                }
              }}
              className="btn-secondary text-xs cursor-pointer"
            >
              List Gear to Join Top 10 🏷️
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};
