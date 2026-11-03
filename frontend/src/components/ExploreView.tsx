import React, { useState, useEffect } from 'react';
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
  Target,
  X
} from 'lucide-react';
import { Item, CommunityRequest } from '../lib/types';
import { ItemCard } from './ItemCard';
import { RequestCard } from './RequestCard';
import { RequestDetailModal } from './RequestDetailModal';
import { useAuth } from '../lib/authContext';
import { getReachDistance, getReachDistanceKm } from '../lib/distance';

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
  onOpenUserProfile?: (userId: string) => void;
  searchQuery?: string;
  onOpenChatWithUser?: (userId: string, userName: string, avatarUrl?: string) => void;
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
  onOpenUserProfile,
  searchQuery,
  onOpenChatWithUser,
}) => {
  const { user, isAuthenticated } = useAuth();

  // Active view toggle: 'items' or 'requests' on the SAME single page!
  const [activeView, setActiveView] = useState<'items' | 'requests'>(initialSubView);

  // Requests sub-filter tab
  const [requestSubTab, setRequestSubTab] = useState<'all' | 'my'>('all');
  const [selectedRequest, setSelectedRequest] = useState<CommunityRequest | null>(null);


  // Sidebar Filters State for Items
  const [maxPrice, setMaxPrice] = useState<number>(5000);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<'All' | 'Rent' | 'Borrow'>('All');
  const [selectedCondition, setSelectedCondition] = useState<string>('Any');
  const [selectedPerks, setSelectedPerks] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'relevance' | 'distance' | 'price_low' | 'price_high'>('relevance');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);
  const [showDesktopFilters, setShowDesktopFilters] = useState<boolean>(true);

  // Active filter count
  const activeFiltersCount = 
    (selectedType !== 'All' ? 1 : 0) +
    (maxPrice < 5000 ? 1 : 0) +
    (radiusKm !== null && radiusKm < 50 ? 1 : 0) +
    (selectedCondition !== 'Any' ? 1 : 0) +
    selectedPerks.length +
    (selectedCategory !== 'All' ? 1 : 0);

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
    const price = Number(item.price_per_day);
    if (maxPrice < 5000 && price > maxPrice) return false;
    if (selectedType === 'Rent' && price <= 0) return false;
    if (selectedType === 'Borrow' && price > 0) return false;
    if (selectedCondition !== 'Any') {
      const itemCond = (item.condition || '').toLowerCase();
      if (!itemCond.includes(selectedCondition.toLowerCase())) return false;
    }
    if (selectedPerks.includes('available') && item.status && item.status !== 'AVAILABLE') {
      return false;
    }
    if (selectedPerks.includes('delivery') && !item.offers_delivery) {
      return false;
    }
    if (radiusKm !== null && radiusKm > 0 && radiusKm < 50) {
      const distanceKm = getReachDistanceKm(item, user);
      if (distanceKm > radiusKm) return false;
    }
    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'price_low') return Number(a.price_per_day) - Number(b.price_per_day);
    if (sortBy === 'price_high') return Number(b.price_per_day) - Number(a.price_per_day);
    if (sortBy === 'distance') {
      return getReachDistanceKm(a, user) - getReachDistanceKm(b, user);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Filter requests
  const filteredRequests = (requests || []).filter((r) => {
    if (requestSubTab === 'my') return r.seeker_id === user?.id;
    return true;
  });

  const myRequests = (requests || []).filter((r) => r.seeker_id === user?.id);

  const handleResetFilters = () => {
    setMaxPrice(5000);
    setRadiusKm(null);
    setSelectedType('All');
    setSelectedCondition('Any');
    setSelectedPerks([]);
    setSelectedCategory('All');
    setSortBy('relevance');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-in fade-in duration-150 sm:px-6 sm:py-9 lg:px-8">
      
      {/* Header Bar: Renamed Page Title + Subtitle + In-Page [Items | Requests] Segmented Switcher */}
      <div className="flex flex-col justify-between gap-4 rounded-[1.75rem] border border-divider bg-surface px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:px-7 sm:py-6">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand">
            <Sparkles className="h-3 w-3" /> People over things
          </span>
          <h1 className="mt-1 font-display text-2xl font-black tracking-tight text-ink sm:text-3xl">
            Find your next good thing
          </h1>
          <p className="mt-1 text-xs font-medium text-ink-secondary sm:text-sm">
            Borrow from your community. Pass along what you have.
          </p>
        </div>

        {/* View Toggle: Items | Requests (Switches inline on the same page!) */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="flex w-full items-center rounded-2xl border border-divider bg-canvas p-1 sm:w-auto sm:rounded-full">
              <button
                onClick={() => setActiveView('items')}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-all sm:flex-none sm:px-4 sm:py-1.5 ${
                  activeView === 'items'
                    ? 'bg-surface text-ink shadow-sm ring-1 ring-divider'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                <Package className="h-3.5 w-3.5" />
                <span>Gear <span className="ml-1 opacity-70">{(items || []).length}</span></span>
              </button>

              <button
                onClick={() => setActiveView('requests')}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-all sm:flex-none sm:px-4 sm:py-1.5 ${
                  activeView === 'requests'
                    ? 'bg-surface text-ink shadow-sm ring-1 ring-divider'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                <Target className="h-3.5 w-3.5" />
                <span>Wanted <span className="ml-1 opacity-70">{(requests || []).length}</span></span>
              </button>
            </div>
          <button
            type="button"
            onClick={isAuthenticated ? onOpenDropGear : onOpenAuth}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-brand px-4 text-xs font-extrabold text-white shadow-md shadow-brand/20 transition-all hover:-translate-y-0.5 hover:bg-brand-hover"
          >
            <Plus className="h-4 w-4" /> List gear
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
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-ink text-canvas shadow-md shadow-ink/10'
                  : 'bg-surface border border-divider text-ink-secondary hover:border-brand/40 hover:text-brand'
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
          
          {/* Top Control Bar: Filter Toggle + Active Tags + Sort */}
          <div className="flex flex-col gap-3 pt-2 pb-4 border-b border-divider mb-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Toggle Filter Sidebar Button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowDesktopFilters(!showDesktopFilters);
                    setShowMobileFilters(!showMobileFilters);
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    activeFiltersCount > 0
                      ? 'bg-brand-soft border-brand/30 text-brand shadow-xs'
                      : 'bg-surface border-divider text-ink hover:border-zinc-400'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{showDesktopFilters ? 'Hide Filters' : 'Show Filters'}</span>
                  <span className="sm:hidden">Filters</span>
                  {activeFiltersCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                {/* Items Counter */}
                <span className="text-xs text-ink-secondary font-medium">
                  Showing <strong className="text-ink font-bold">{sortedItems.length}</strong> {sortedItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Sort by dropdown */}
              <div className="flex items-center gap-2 text-xs text-ink-secondary">
                <span className="hidden sm:inline">Sort by:</span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="bg-surface border border-divider hover:border-zinc-400 rounded-xl px-3 py-1.5 pr-7 text-xs font-bold text-ink outline-none cursor-pointer appearance-none transition-colors"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="distance">Nearest First</option>
                    <option value="price_low">Price: Low to High</option>
                    <option value="price_high">Price: High to Low</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-ink-secondary absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Active Filter Pills Row (Instant clear on single click) */}
            {activeFiltersCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1 animate-in fade-in duration-150">
                <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Active:</span>

                {selectedType !== 'All' && (
                  <button
                    type="button"
                    onClick={() => setSelectedType('All')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-brand-soft text-brand border border-brand/20 hover:bg-brand/20 transition-all cursor-pointer"
                  >
                    <span>{selectedType === 'Rent' ? 'Rent Only' : 'Free Borrow Only'}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}

                {maxPrice < 5000 && (
                  <button
                    type="button"
                    onClick={() => setMaxPrice(5000)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-brand-soft text-brand border border-brand/20 hover:bg-brand/20 transition-all cursor-pointer"
                  >
                    <span>Up to ₹{maxPrice}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}

                {radiusKm !== null && radiusKm < 50 && (
                  <button
                    type="button"
                    onClick={() => setRadiusKm(null)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-brand-soft text-brand border border-brand/20 hover:bg-brand/20 transition-all cursor-pointer"
                  >
                    <span>Within {radiusKm} km</span>
                    <X className="w-3 h-3" />
                  </button>
                )}

                {selectedPerks.map((perkId) => {
                  const perkLabel = perkId === 'available' ? 'Available Now' : 'Offers Delivery';
                  return (
                    <button
                      key={perkId}
                      type="button"
                      onClick={() => setSelectedPerks((prev) => prev.filter((p) => p !== perkId))}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-brand-soft text-brand border border-brand/20 hover:bg-brand/20 transition-all cursor-pointer"
                    >
                      <span>{perkLabel}</span>
                      <X className="w-3 h-3" />
                    </button>
                  );
                })}

                {selectedCondition !== 'Any' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCondition('Any')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-brand-soft text-brand border border-brand/20 hover:bg-brand/20 transition-all cursor-pointer"
                  >
                    <span>{selectedCondition}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}

                {selectedCategory !== 'All' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('All')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-surface text-ink border border-divider hover:border-ink transition-all cursor-pointer"
                  >
                    <span>{selectedCategory}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-bold text-brand hover:underline cursor-pointer ml-1 inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              </div>
            )}
          </div>

          {/* 2-Column Main Layout: Left Sidebar Filters + Right Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Filter Sidebar */}
            <aside
              className={`space-y-5 ${
                showDesktopFilters ? 'lg:col-span-3' : 'hidden'
              } ${showMobileFilters ? 'block' : 'hidden lg:block'}`}
            >
              <div className="bg-surface border border-divider rounded-2xl p-4 sm:p-5 shadow-xs space-y-5">
                
                {/* Filter Sidebar Header */}
                <div className="flex items-center justify-between pb-3 border-b border-divider">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-brand" />
                    <span className="font-extrabold text-xs uppercase tracking-wider text-ink font-display">Filters</span>
                    {activeFiltersCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-brand text-white">
                        {activeFiltersCount}
                      </span>
                    )}
                  </div>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-xs font-bold text-brand hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {/* 1. Listing Type (Segmented Pills) */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                    Listing Type
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-surface-muted dark:bg-zinc-900 rounded-xl border border-divider">
                    {[
                      { label: 'All', value: 'All' },
                      { label: 'Rent (₹)', value: 'Rent' },
                      { label: 'Free (₹0)', value: 'Borrow' },
                    ].map((tab) => {
                      const isSel = selectedType === tab.value;
                      return (
                        <button
                          key={tab.value}
                          type="button"
                          onClick={() => setSelectedType(tab.value as any)}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                            isSel
                              ? 'bg-surface text-brand shadow-xs border border-brand/20 font-black'
                              : 'text-ink-secondary hover:text-ink'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Distance Radius (Quick presets + Scroller) */}
                <div className="pt-4 border-t border-divider space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-ink">
                    <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Distance Radius</span>
                    <span className="text-brand font-black">
                      {radiusKm === null || radiusKm >= 50 ? 'Any Distance' : `Within ${radiusKm} km`}
                    </span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: 'Any', val: null },
                      { label: '5 km', val: 5 },
                      { label: '10 km', val: 10 },
                      { label: '25 km', val: 25 },
                    ].map((preset) => {
                      const isSel = radiusKm === preset.val || (preset.val === null && (radiusKm === null || radiusKm >= 50));
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setRadiusKm(preset.val)}
                          className={`py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center border ${
                            isSel
                              ? 'bg-brand text-white border-brand shadow-xs'
                              : 'bg-surface border-divider text-ink hover:border-zinc-400'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Distance Scroller / Range Slider */}
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={radiusKm === null ? 50 : radiusKm}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRadiusKm(val >= 50 ? null : val);
                    }}
                    className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#E11D74]"
                  />
                  <div className="flex items-center justify-between text-[10px] text-ink-secondary font-semibold">
                    <span>1 km</span>
                    <span>25 km</span>
                    <span>50+ km (Any)</span>
                  </div>
                </div>

                {/* 3. Price per day (Quick presets + Slider) */}
                <div className="pt-4 border-t border-divider space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-ink">
                    <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Price per day</span>
                    <span className="text-brand font-black">
                      {maxPrice >= 5000 ? 'Any Price (₹0–5k+)' : `₹0 – ₹${maxPrice}`}
                    </span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: 'Any', val: 5000 },
                      { label: '< ₹200', val: 200 },
                      { label: '₹500', val: 500 },
                      { label: '₹1.5k', val: 1500 },
                    ].map((preset) => {
                      const isSel = maxPrice === preset.val;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setMaxPrice(preset.val)}
                          className={`py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center border ${
                            isSel
                              ? 'bg-brand text-white border-brand shadow-xs'
                              : 'bg-surface border-divider text-ink hover:border-zinc-400'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="50"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#E11D74]"
                  />
                  <div className="flex items-center justify-between text-[10px] text-ink-secondary font-semibold">
                    <span>₹0 (Free)</span>
                    <span>₹2,500</span>
                    <span>₹5,000+</span>
                  </div>
                </div>

                {/* 4. Availability & Delivery Perks (Multi-Select) */}
                <div className="pt-4 border-t border-divider space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                      Availability & Perks
                    </label>
                    {selectedPerks.length > 0 && (
                      <span className="text-[11px] font-bold text-brand">
                        {selectedPerks.length} selected
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {/* All Items Option */}
                    <button
                      type="button"
                      onClick={() => setSelectedPerks([])}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left flex items-center justify-between border ${
                        selectedPerks.length === 0
                          ? 'bg-brand/10 border-brand text-brand shadow-xs'
                          : 'bg-surface border-divider text-ink hover:border-zinc-400'
                      }`}
                    >
                      <span>All Items</span>
                      {selectedPerks.length === 0 && <Check className="w-3.5 h-3.5 text-brand" />}
                    </button>

                    {/* Multi-Select Perk Options */}
                    {[
                      { id: 'available', label: 'Available Now' },
                      { id: 'delivery', label: 'Offers Owner Delivery' },
                    ].map((perk) => {
                      const isSel = selectedPerks.includes(perk.id);
                      return (
                        <button
                          key={perk.id}
                          type="button"
                          onClick={() => {
                            setSelectedPerks((prev) =>
                              prev.includes(perk.id)
                                ? prev.filter((p) => p !== perk.id)
                                : [...prev, perk.id]
                            );
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left flex items-center justify-between border ${
                            isSel
                              ? 'bg-brand/10 border-brand text-brand shadow-xs font-black'
                              : 'bg-surface border-divider text-ink hover:border-zinc-400'
                          }`}
                        >
                          <span>{perk.label}</span>
                          {isSel && <Check className="w-3.5 h-3.5 text-brand" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Item Condition */}
                <div className="pt-4 border-t border-divider space-y-2">
                  <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                    Condition
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {['Any', 'Like new', 'Good', 'Fair'].map((cond) => {
                      const isSel = selectedCondition === cond;
                      return (
                        <button
                          key={cond}
                          type="button"
                          onClick={() => setSelectedCondition(cond)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center border ${
                            isSel
                              ? 'bg-brand text-white border-brand shadow-xs'
                              : 'bg-surface border-divider text-ink hover:border-zinc-400 dark:hover:border-zinc-600'
                          }`}
                        >
                          {cond}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reset Filters CTA */}
                {activeFiltersCount > 0 && (
                  <div className="pt-3 border-t border-divider">
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="w-full py-2 rounded-xl text-xs font-bold bg-surface border border-divider text-brand hover:bg-brand-soft hover:border-brand/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset All Filters</span>
                    </button>
                  </div>
                )}

              </div>
            </aside>

            {/* Right Main Grid */}
            <main className={`${showDesktopFilters ? 'lg:col-span-9' : 'lg:col-span-12'} transition-all`}>
              
              {/* Items Grid */}
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
                        List an Item
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
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                  {sortedItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onClick={() => onSelectItem(item)}
                      onOpenUserProfile={onOpenUserProfile}
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
                      Post a Request
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRequests.map((req) => (
                    <RequestCard
                      key={req.id}
                      request={req}
                      onClick={() => setSelectedRequest(req)}
                      onClaim={(r) => onClaimRequest(r)}
                      onOpenUserProfile={onOpenUserProfile}
                    />
                  ))}
                </div>
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

      {/* Request Details Modal */}
      <RequestDetailModal
        request={selectedRequest}
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        onClaim={(r) => {
          setSelectedRequest(null);
          onClaimRequest(r);
        }}
        onOpenAuth={onOpenAuth}
        onOpenUserProfile={onOpenUserProfile}
        onOpenChatWithUser={onOpenChatWithUser}
      />

    </div>
  );
};
