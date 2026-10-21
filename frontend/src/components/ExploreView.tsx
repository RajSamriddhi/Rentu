import React, { useState } from 'react';
import { 
  SlidersHorizontal, 
  ChevronDown, 
  Check, 
  RotateCcw,
  Plus, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Tv, 
  Tent, 
  Wrench, 
  Shirt, 
  Sparkles,
  ArrowRight,
  Package,
  Target
} from 'lucide-react';
import { Item, CommunityRequest } from '../lib/types';
import { ItemCard } from './ItemCard';
import { useAuth } from '../lib/authContext';

interface ExploreViewProps {
  items: Item[];
  requests: CommunityRequest[];
  isLoading: boolean;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  onSelectItem: (item: Item) => void;
  onOpenDropWish: () => void;
  onOpenDropGear: () => void;
  onClaimRequest: (request: CommunityRequest) => void;
  onOpenAuth: () => void;
  initialSubView?: 'items' | 'requests';
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  items,
  requests,
  isLoading,
  selectedCategory,
  setSelectedCategory,
  onSelectItem,
  onOpenDropWish,
  onOpenDropGear,
  onClaimRequest,
  onOpenAuth,
  initialSubView = 'items',
}) => {
  const { user, isAuthenticated } = useAuth();

  // Active view toggle: 'items' or 'requests' on the SAME single page!
  const [activeView, setActiveView] = useState<'items' | 'requests'>(initialSubView);

  // Requests sub-filter tab
  const [requestSubTab, setRequestSubTab] = useState<'all' | 'my'>('all');

  // Sidebar Filters State for Items
  const [maxPrice, setMaxPrice] = useState<number>(2000);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [selectedType, setSelectedType] = useState<'Rent' | 'Borrow' | 'Both'>('Both');
  const [selectedCondition, setSelectedCondition] = useState<string>('Any');
  const [sortBy, setSortBy] = useState<'relevance' | 'price_low' | 'price_high'>('relevance');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

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

  // Helper icons and colors for requests
  const getCategoryIcon = (cat: string) => {
    if (cat.includes('Tech') || cat.includes('Elect')) return <Tv className="w-5 h-5 text-purple-600" />;
    if (cat.includes('Camp')) return <Tent className="w-5 h-5 text-emerald-600" />;
    if (cat.includes('Tool')) return <Wrench className="w-5 h-5 text-amber-600" />;
    if (cat.includes('Cloth') || cat.includes('Fit')) return <Shirt className="w-5 h-5 text-pink-600" />;
    return <Sparkles className="w-5 h-5 text-indigo-600" />;
  };

  const getCategoryBg = (cat: string) => {
    if (cat.includes('Tech') || cat.includes('Elect')) return 'bg-purple-100 dark:bg-purple-950/40';
    if (cat.includes('Camp')) return 'bg-emerald-100 dark:bg-emerald-950/40';
    if (cat.includes('Tool')) return 'bg-amber-100 dark:bg-amber-950/40';
    if (cat.includes('Cloth') || cat.includes('Fit')) return 'bg-pink-100 dark:bg-pink-950/40';
    return 'bg-indigo-100 dark:bg-indigo-950/40';
  };

  // Filter items based on sidebar state
  const filteredItems = (items || []).filter((item) => {
    if (Number(item.price_per_day) > maxPrice) return false;
    if (selectedType === 'Rent' && Number(item.price_per_day) <= 0) return false;
    if (selectedType === 'Borrow' && Number(item.price_per_day) > 0) return false;
    if (selectedCondition !== 'Any' && item.condition && item.condition !== selectedCondition) return false;
    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'price_low') return Number(a.price_per_day) - Number(b.price_per_day);
    if (sortBy === 'price_high') return Number(b.price_per_day) - Number(a.price_per_day);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Filter requests
  const filteredRequests = (requests || []).filter((r) => {
    if (requestSubTab === 'my') return r.seeker_id === user?.id;
    return true;
  });

  const myRequests = (requests || []).filter((r) => r.seeker_id === user?.id);

  const handleResetFilters = () => {
    setMaxPrice(2000);
    setRadiusKm(5);
    setSelectedType('Both');
    setSelectedCondition('Any');
    setSelectedCategory('All');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-150">
      
      {/* Header Bar: Renamed Page Title + Subtitle + In-Page [Items | Requests] Segmented Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-divider">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            Marketplace
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary font-medium mt-0.5">
            Everyday items and community requests. Real people. Shared near you.
          </p>
        </div>

        {/* View Toggle: Items | Requests (Switches inline on the same page!) */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full border border-zinc-200 dark:border-zinc-700 self-start sm:self-auto">
          <button
            onClick={() => setActiveView('items')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'items'
                ? 'bg-surface text-ink shadow-xs'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Items ({(items || []).length})</span>
          </button>

          <button
            onClick={() => setActiveView('requests')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'requests'
                ? 'bg-surface text-ink shadow-xs'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Requests ({(requests || []).length})</span>
          </button>
        </div>
      </div>

      {/* Horizontal Category Filter Pills (Shared across both Items and Requests) */}
      <div className="flex items-center gap-2 overflow-x-auto py-4 scrollbar-none">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat || (cat === 'All' && selectedCategory === 'All');
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === 'All' ? 'All' : cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-ink text-canvas shadow-xs'
                  : 'bg-surface border border-divider text-ink hover:border-zinc-400 dark:hover:border-zinc-600'
              }`}
            >
              {cat === 'Electronics & Tech' ? 'Electronics' : cat === 'Camping & Outdoor' ? 'Camping' : cat === 'Home & Appliances' ? 'Home' : cat === 'Clothing & Fits' ? 'Clothing' : cat === 'Books & Media' ? 'Books' : cat === 'Sports & Fitness' ? 'Sports' : cat}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: PRODUCTS / GEAR LISTINGS                                          */}
      {/* ========================================================================= */}
      {activeView === 'items' && (
        <div className="animate-in fade-in duration-200">
          {/* Mobile Filter Toggle Button */}
          <div className="lg:hidden mt-2 mb-4">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="w-full flex items-center justify-between bg-surface border border-divider rounded-2xl px-4 py-2.5 text-xs font-bold text-ink cursor-pointer hover:bg-canvas transition-colors shadow-xs"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-brand" />
                <span>Filters & Distance</span>
              </span>
              <span className="text-xs font-extrabold text-brand bg-brand-soft px-2 py-0.5 rounded-full">
                {showMobileFilters ? 'Hide ▲' : 'Show Filters ▼'}
              </span>
            </button>
          </div>

          {/* 2-Column Main Layout: Left Sidebar Filters + Right Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-2">
            
            {/* Left Filter Sidebar */}
            <aside className={`lg:col-span-3 space-y-6 ${showMobileFilters ? 'block' : 'hidden lg:block'}`}>
              <div className="bg-surface border border-divider rounded-2xl p-5 shadow-xs space-y-5">
                
                {/* Distance Radius */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-ink">Distance Radius</label>
                  
                  <div className="relative">
                    <select
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(Number(e.target.value))}
                      className="w-full appearance-none bg-surface border border-divider hover:border-zinc-300 dark:hover:border-zinc-600 rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none cursor-pointer transition-colors"
                    >
                      <option value={2}>Within 2 km</option>
                      <option value={5}>Within 5 km</option>
                      <option value={10}>Within 10 km</option>
                      <option value={15}>Within 15 km</option>
                      <option value={25}>Within 25 km</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Price per day */}
                <div className="pt-4 border-t border-divider">
                  <div className="flex items-center justify-between text-xs font-bold text-ink mb-2">
                    <span>Price per day</span>
                    <span className="text-brand font-semibold">₹0 – ₹{maxPrice}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="2000"
                    step="50"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-[#E11D74]"
                  />
                  <div className="flex items-center justify-between text-[11px] text-ink-secondary mt-1 font-medium">
                    <span>₹0</span>
                    <span>₹2000</span>
                  </div>
                </div>

                {/* Availability */}
                <div className="pt-4 border-t border-divider space-y-2">
                  <label className="block text-xs font-bold text-ink mb-2">Availability</label>
                  {[
                    { label: 'Available now', value: 'now' },
                    { label: 'This weekend', value: 'weekend' },
                    { label: 'Custom dates', value: 'custom' },
                  ].map((avail, idx) => (
                    <label key={avail.value} className="flex items-center gap-2.5 text-xs font-medium text-ink cursor-pointer group">
                      <input
                        type="radio"
                        name="availabilityOption"
                        defaultChecked={idx === 0}
                        className="w-3.5 h-3.5 text-brand accent-brand cursor-pointer"
                      />
                      <span className="group-hover:text-brand transition-colors">{avail.label}</span>
                    </label>
                  ))}
                </div>

                {/* Type */}
                <div className="pt-4 border-t border-divider space-y-2">
                  <label className="block text-xs font-bold text-ink mb-2">Type</label>
                  {(['Rent', 'Borrow (Free)', 'Both'] as const).map((type) => {
                    const isSelected = selectedType === (type.startsWith('Rent') ? 'Rent' : type.startsWith('Borrow') ? 'Borrow' : 'Both');
                    return (
                      <label key={type} className="flex items-center gap-2.5 text-xs font-medium text-ink cursor-pointer group">
                        <input
                          type="radio"
                          name="listingType"
                          checked={isSelected}
                          onChange={() => setSelectedType(type.startsWith('Rent') ? 'Rent' : type.startsWith('Borrow') ? 'Borrow' : 'Both')}
                          className="w-3.5 h-3.5 text-brand accent-brand cursor-pointer"
                        />
                        <span className="group-hover:text-brand transition-colors">{type}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Condition */}
                <div className="pt-4 border-t border-divider space-y-2">
                  <label className="block text-xs font-bold text-ink mb-2">Condition</label>
                  {['Any', 'Like new', 'Good', 'Fair'].map((cond) => (
                    <label key={cond} className="flex items-center gap-2.5 text-xs font-medium text-ink cursor-pointer group">
                      <input
                        type="radio"
                        name="itemCondition"
                        checked={selectedCondition === cond}
                        onChange={() => setSelectedCondition(cond)}
                        className="w-3.5 h-3.5 text-brand accent-brand cursor-pointer"
                      />
                      <span className="group-hover:text-brand transition-colors">{cond}</span>
                    </label>
                  ))}
                </div>

                {/* Reset Filters Link */}
                <div className="pt-4 border-t border-divider text-left">
                  <button
                    onClick={handleResetFilters}
                    className="text-xs font-bold text-brand hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset filters</span>
                  </button>
                </div>

              </div>
            </aside>

            {/* Right Main Grid */}
            <main className="lg:col-span-9">
              
              {/* Sort bar */}
              <div className="flex items-center justify-between pb-4 text-xs font-medium text-ink-secondary">
                <span>
                  Showing <span className="font-bold text-ink">{sortedItems.length}</span> items
                </span>

                <div className="flex items-center gap-2">
                  <span>Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="bg-surface border border-divider rounded-lg px-2.5 py-1 text-xs font-bold text-ink outline-none cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-600"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="price_low">Price: Low to High</option>
                    <option value="price_high">Price: High to Low</option>
                  </select>
                </div>
              </div>

              {/* Items Grid (4 columns) */}
              {isLoading ? (
                <div className="py-24 text-center">
                  <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs font-bold text-ink-secondary">Loading items...</p>
                </div>
              ) : sortedItems.length === 0 ? (
                <div className="py-20 text-center bg-surface border border-divider rounded-2xl p-8">
                  <p className="text-base font-bold text-ink">No items match your filters.</p>
                  <p className="text-xs text-ink-secondary mt-1">Try widening your price range or resetting filters.</p>
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                      onClick={handleResetFilters}
                      className="btn-secondary text-xs cursor-pointer font-bold px-4 py-2"
                    >
                      Reset All Filters
                    </button>
                    {isAuthenticated ? (
                      <button
                        onClick={onOpenDropGear}
                        className="btn-primary text-xs cursor-pointer font-bold px-4 py-2 shadow-pink"
                      >
                        List an Item 💸
                      </button>
                    ) : (
                      <button
                        onClick={onOpenAuth}
                        className="btn-primary text-xs cursor-pointer font-bold px-4 py-2 shadow-pink"
                      >
                        Sign In to List
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {sortedItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onClick={() => onSelectItem(item)}
                    />
                  ))}
                </div>
              )}

            </main>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: COMMUNITY WANTED REQUESTS (Shows right here on the same page!)   */}
      {/* ========================================================================= */}
      {activeView === 'requests' && (
        <div className="animate-in fade-in duration-200 space-y-6">
          
          {/* Sub Header Bar with Tabs & Post CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRequestSubTab('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  requestSubTab === 'all'
                    ? 'bg-ink text-canvas shadow-xs'
                    : 'bg-surface border border-divider text-ink-secondary hover:text-ink'
                }`}
              >
                All Requests ({(requests || []).length})
              </button>

              {isAuthenticated && (
                <button
                  onClick={() => setRequestSubTab('my')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    requestSubTab === 'my'
                      ? 'bg-ink text-canvas shadow-xs'
                      : 'bg-surface border border-divider text-ink-secondary hover:text-ink'
                  }`}
                >
                  My Requests ({myRequests.length})
                </button>
              )}
            </div>

            {/* Post Request Button */}
            {isAuthenticated ? (
              <button
                onClick={onOpenDropWish}
                className="btn-primary text-xs px-4 py-2 shadow-pink cursor-pointer self-start sm:self-auto inline-flex items-center gap-1.5 font-bold"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Post a Request</span>
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="btn-primary text-xs px-4 py-2 shadow-pink cursor-pointer self-start sm:self-auto inline-flex items-center gap-1.5 font-bold"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Sign In to Post</span>
              </button>
            )}
          </div>

          {/* 2-Column Requests Layout: Left Feed (8 cols) + Right Sidebar (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Request Cards (8 cols) */}
            <main className="lg:col-span-8 space-y-4">
              {isLoading ? (
                <div className="py-24 text-center">
                  <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs font-bold text-ink-secondary">Loading community requests...</p>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="py-20 text-center bg-surface border border-divider rounded-2xl p-8">
                  <p className="text-base font-bold text-ink">No requests in this category right now.</p>
                  <p className="text-xs text-ink-secondary mt-1">Be the first to ask the community for gear you need!</p>
                  {isAuthenticated ? (
                    <button
                      onClick={onOpenDropWish}
                      className="mt-4 btn-primary text-xs cursor-pointer font-bold px-5 py-2 shadow-pink"
                    >
                      Post a Request 🎯
                    </button>
                  ) : (
                    <button
                      onClick={onOpenAuth}
                      className="mt-4 btn-primary text-xs cursor-pointer font-bold px-5 py-2 shadow-pink"
                    >
                      Sign In to Post
                    </button>
                  )}
                </div>
              ) : (
                filteredRequests.map((req) => {
                  const isFulfilled = req.status === 'FULFILLED';
                  return (
                    <div
                      key={req.id}
                      className="bg-surface border border-divider hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-4 sm:p-5 shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      {/* Left Icon or Attached Photo + Text info */}
                      <div className="flex items-start gap-4 flex-1">
                        {req.image_url ? (
                          <img
                            src={req.image_url}
                            alt={req.item_name}
                            className="w-14 h-14 rounded-2xl object-cover border border-divider shrink-0 shadow-xs"
                          />
                        ) : (
                          <div className={`w-12 h-12 rounded-2xl ${getCategoryBg(req.category)} flex items-center justify-center shrink-0`}>
                            {getCategoryIcon(req.category)}
                          </div>
                        )}

                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-extrabold text-base text-ink tracking-tight">
                              {req.item_name}
                            </h3>
                            <span className="text-xs font-extrabold text-brand font-display bg-brand-soft/60 px-2 py-0.5 rounded-md">
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
                            <span>{req.seeker_name || 'Neighbor'}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-brand" />
                              <span>{req.locality || 'Nearby'}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action + Badge */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#EDE9FE] dark:bg-purple-950/40 text-[#6D28D9] dark:text-purple-300 border border-[#DDD6FE] dark:border-purple-800/40">
                          Active Request
                        </span>

                        {isFulfilled ? (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Fulfilled
                          </span>
                        ) : (
                          <button
                            onClick={() => onClaimRequest(req)}
                            className="px-4 py-2 rounded-full text-xs font-bold bg-brand text-white hover:bg-brand-hover shadow-xs transition-all cursor-pointer active:scale-95"
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

            {/* Right Sidebar (4 cols) */}
            <aside className="lg:col-span-4 space-y-6">
              
              {/* Callout Box */}
              <div className="bg-[#FFF5F7] dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900/40 rounded-3xl p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-white dark:bg-[#1E1F2A] text-brand flex items-center justify-center mx-auto shadow-xs">
                  <Sparkles className="w-6 h-6 text-brand" />
                </div>

                <h3 className="text-base font-extrabold text-ink font-display">
                  Can't find what you need?
                </h3>
                
                <p className="text-xs text-ink-secondary font-medium leading-relaxed">
                  Post a request and let verified lenders in your community find it for you.
                </p>

                {isAuthenticated ? (
                  <button
                    onClick={onOpenDropWish}
                    className="btn-primary text-xs w-full py-2.5 cursor-pointer shadow-pink font-bold"
                  >
                    Post a Request
                  </button>
                ) : (
                  <button
                    onClick={onOpenAuth}
                    className="btn-primary text-xs w-full py-2.5 cursor-pointer shadow-pink font-bold"
                  >
                    Sign In to Post
                  </button>
                )}
              </div>

              {/* Your Recent Requests (Real data for authenticated user, no hardcoded mock data) */}
              {isAuthenticated && myRequests.length > 0 && (
                <div className="bg-surface border border-divider rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between text-xs font-extrabold text-ink">
                    <span>Your active requests</span>
                    <button 
                      onClick={() => setRequestSubTab('my')}
                      className="text-brand hover:underline font-bold cursor-pointer"
                    >
                      View all ({myRequests.length})
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {myRequests.slice(0, 3).map((myReq) => (
                      <div key={myReq.id} className="p-2.5 rounded-xl bg-canvas border border-divider flex items-center justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-ink truncate">{myReq.item_name}</div>
                          <div className="text-[11px] text-ink-secondary">
                            {new Date(myReq.start_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          myReq.status === 'FULFILLED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-brand-soft text-brand'
                        }`}>
                          {myReq.status === 'FULFILLED' ? 'Fulfilled' : `₹${myReq.offered_amount}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </aside>

          </div>
        </div>
      )}

    </div>
  );
};
