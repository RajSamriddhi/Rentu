import React, { useState } from 'react';
import { 
  Plus, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Tv, 
  Tent, 
  Wrench, 
  Shirt, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { CommunityRequest } from '../lib/types';
import { useAuth } from '../lib/authContext';

interface RequestsBoardProps {
  requests: CommunityRequest[];
  isLoading: boolean;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  onOpenDropWish: () => void;
  onClaimRequest: (request: CommunityRequest) => void;
  onOpenAuth?: () => void;
}

export const RequestsBoard: React.FC<RequestsBoardProps> = ({
  requests,
  isLoading,
  selectedCategory,
  setSelectedCategory,
  onOpenDropWish,
  onClaimRequest,
  onOpenAuth,
}) => {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'offers'>('all');

  const categories = [
    'All',
    'Tools & DIY',
    'Electronics & Tech',
    'Camping & Outdoor',
    'Home & Appliances',
    'Clothing & Fits',
    'Books & Media',
    'Sports & Fitness',
    'Other'
  ];

  const getCategoryIcon = (cat: string) => {
    if (cat.includes('Tech') || cat.includes('Elect')) return <Tv className="w-5 h-5 text-purple-600" />;
    if (cat.includes('Camp')) return <Tent className="w-5 h-5 text-emerald-600" />;
    if (cat.includes('Tool')) return <Wrench className="w-5 h-5 text-amber-600" />;
    if (cat.includes('Cloth') || cat.includes('Fit')) return <Shirt className="w-5 h-5 text-pink-600" />;
    return <Sparkles className="w-5 h-5 text-indigo-600" />;
  };

  const getCategoryBg = (cat: string) => {
    if (cat.includes('Tech') || cat.includes('Elect')) return 'bg-purple-100';
    if (cat.includes('Camp')) return 'bg-emerald-100';
    if (cat.includes('Tool')) return 'bg-amber-100';
    if (cat.includes('Cloth') || cat.includes('Fit')) return 'bg-pink-100';
    return 'bg-indigo-100';
  };

  const filteredRequests = (requests || []).filter((r) => {
    if (activeTab === 'my') return r.seeker_id === user?.id;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-150">
      
      {/* Top Header matching Screen 6 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-divider">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            Requests
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary font-medium mt-0.5">
            Community Wanted Board
          </p>
        </div>

        {/* Right CTA matching Screen 6 - ONLY VISIBLE AFTER LOGIN */}
        {isAuthenticated && (
          <button
            onClick={onOpenDropWish}
            className="btn-primary text-xs px-5 py-2.5 shadow-pink cursor-pointer self-start sm:self-auto inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Post a Request</span>
          </button>
        )}
      </div>

      {/* Sub Tabs: All Requests | My Requests | Offers Received */}
      <div className="flex items-center gap-2 pt-4">
        {[
          { key: 'all', label: 'All Requests' },
          { key: 'my', label: 'My Requests' },
          { key: 'offers', label: 'Offers Received' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === tab.key
                ? 'bg-ink text-canvas shadow-xs'
                : 'bg-surface border border-divider text-ink-secondary hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Category Pills matching Screen 6 */}
      <div className="flex items-center gap-2 overflow-x-auto py-4 scrollbar-none">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat || (cat === 'All' && selectedCategory === 'All');
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === 'All' ? 'All' : cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-surface border border-divider text-ink hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
            >
              {cat === 'Electronics & Tech' ? 'Electronics' : cat === 'Camping & Outdoor' ? 'Camping' : cat === 'Home & Appliances' ? 'Home' : cat === 'Clothing & Fits' ? 'Clothing' : cat === 'Books & Media' ? 'Books' : cat === 'Sports & Fitness' ? 'Sports' : cat}
            </button>
          );
        })}
      </div>

      {/* 2-Column Layout matching Screen 6: Left Feed + Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-2">
        
        {/* Left Column: Request Cards (8 cols) */}
        <main className="lg:col-span-8 space-y-4">
          {isLoading ? (
            <div className="py-24 text-center">
              <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold text-ink-secondary">Loading community requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-20 text-center bg-surface border border-divider rounded-2xl p-8">
              <p className="text-base font-bold text-ink">No requests right now.</p>
              <p className="text-xs text-ink-secondary mt-1">Be the first to ask the community for gear you need!</p>
              {isAuthenticated ? (
                <button
                  onClick={onOpenDropWish}
                  className="mt-4 btn-primary text-xs cursor-pointer"
                >
                  Post a Request 🎯
                </button>
              ) : (
                <button
                  onClick={onOpenAuth}
                  className="mt-4 btn-primary text-xs cursor-pointer"
                >
                  Sign in to Post a Request
                </button>
              )}
            </div>
          ) : (
            filteredRequests.map((req) => {
              const isFulfilled = req.status === 'FULFILLED';
              return (
                <div
                  key={req.id}
                  className="bg-surface border border-divider hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  {/* Left Icon + Text info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-2xl ${getCategoryBg(req.category)} flex items-center justify-center shrink-0`}>
                      {getCategoryIcon(req.category)}
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-base text-ink tracking-tight">
                          {req.item_name}
                        </h3>
                        <span className="text-xs font-extrabold text-brand font-display">
                          ₹{Number(req.offered_amount)} budget
                        </span>
                        <span className="text-zinc-300">•</span>
                        <span className="text-xs font-medium text-ink-secondary">
                          {new Date(req.start_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      <p className="text-xs text-ink-secondary line-clamp-2 font-medium">
                        {req.description}
                      </p>

                      <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-ink-secondary">
                        <img
                          src={req.seeker_avatar || (req.seeker_name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(req.seeker_name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')}
                          alt={req.seeker_name}
                          className="w-4 h-4 rounded-full object-cover"
                        />
                        <span>{req.seeker_name}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3 text-brand" />
                          <span>Nearby</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Action + Badge matching Screen 6 */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#EDE9FE] text-[#6D28D9] border border-[#DDD6FE]">
                      {Math.floor(2 + (req.id.charCodeAt(0) % 4))} offers
                    </span>

                    {isFulfilled ? (
                      <span className="text-xs font-bold text-emerald-600 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Fulfilled
                      </span>
                    ) : (
                      <button
                        onClick={() => onClaimRequest(req)}
                        className="px-4 py-2 rounded-full text-xs font-bold bg-brand text-white hover:bg-brand-hover shadow-xs transition-all cursor-pointer"
                      >
                        I Can Lend This
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </main>

        {/* Right Sidebar matching Screen 6 (4 cols) */}
        <aside className="lg:col-span-4 space-y-6">
          
          {/* Callout Box from Screen 6 */}
          <div className="bg-[#FFF5F7] dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900/40 rounded-3xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-white dark:bg-[#1E1F2A] text-brand flex items-center justify-center mx-auto shadow-xs">
              <Sparkles className="w-6 h-6 text-brand" />
            </div>

            <h3 className="text-base font-extrabold text-ink font-display">
              Can't find what you need?
            </h3>
            
            <p className="text-xs text-ink-secondary font-medium leading-relaxed">
              Post a request and let verified owners find it for you.
            </p>

            {isAuthenticated ? (
              <button
                onClick={onOpenDropWish}
                className="btn-primary text-xs w-full py-2.5 cursor-pointer shadow-pink"
              >
                Post a Request
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="btn-primary text-xs w-full py-2.5 cursor-pointer shadow-pink"
              >
                Sign In to Post
              </button>
            )}
          </div>

          {/* Your Recent Requests matching Screen 6 - ONLY VISIBLE AFTER LOGIN */}
          {isAuthenticated && (
            <div className="bg-surface border border-divider rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs font-extrabold text-ink">
                <span>Your recent requests</span>
                <button 
                  onClick={() => setActiveTab('my')}
                  className="text-brand hover:underline font-bold cursor-pointer"
                >
                  View all
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  { title: 'Projector', dates: '12-14 Oct', status: 'Open • 3 offers', color: 'bg-emerald-100 text-emerald-800' },
                  { title: 'Camping Tent', dates: '20-22 Oct', status: 'Open • 1 offer', color: 'bg-emerald-100 text-emerald-800' },
                  { title: 'Lehenga', dates: '23 Oct', status: 'Open • 4 offers', color: 'bg-emerald-100 text-emerald-800' },
                ].map((rec) => (
                  <div key={rec.title} className="p-2.5 rounded-xl bg-canvas border border-divider flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-ink">{rec.title}</div>
                      <div className="text-[11px] text-ink-secondary">{rec.dates}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rec.color}`}>
                      {rec.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </aside>

      </div>

    </div>
  );
};
