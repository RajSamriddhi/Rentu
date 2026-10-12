import React, { useState } from 'react';
import { SlidersHorizontal, ChevronDown, Check, RotateCcw } from 'lucide-react';
import { Item } from '../lib/types';
import { ItemCard } from './ItemCard';

interface ExploreViewProps {
  items: Item[];
  isLoading: boolean;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  selectedLocality: string;
  onSelectItem: (item: Item) => void;
  onToggleToRequests: () => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  items,
  isLoading,
  selectedCategory,
  setSelectedCategory,
  selectedLocality,
  onSelectItem,
  onToggleToRequests,
}) => {
  // Sidebar Filters State matching Screen 2
  const [maxPrice, setMaxPrice] = useState<number>(2000);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [selectedType, setSelectedType] = useState<'Rent' | 'Borrow' | 'Both'>('Both');
  const [selectedCondition, setSelectedCondition] = useState<string>('Any');
  const [sortBy, setSortBy] = useState<'relevance' | 'price_low' | 'price_high'>('relevance');

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

  // Filter items based on sidebar state
  const filteredItems = items.filter((item) => {
    if (Number(item.price_per_day) > maxPrice) return false;
    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'price_low') return Number(a.price_per_day) - Number(b.price_per_day);
    if (sortBy === 'price_high') return Number(b.price_per_day) - Number(a.price_per_day);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleResetFilters = () => {
    setMaxPrice(2000);
    setRadiusKm(5);
    setSelectedType('Both');
    setSelectedCondition('Any');
    setSelectedCategory('All');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-150">
      
      {/* Header Bar: Title + Subtitle + [Items | Requests] Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-divider">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            Explore
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary font-medium mt-0.5">
            Everyday items. Real people. Your community in <span className="font-bold text-ink">{selectedLocality}</span>.
          </p>
        </div>

        {/* View Toggle: Items | Requests */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full border border-zinc-200 dark:border-zinc-700 self-start sm:self-auto">
          <button
            className="px-4 py-1.5 rounded-full text-xs font-bold bg-surface text-ink shadow-xs"
          >
            Items
          </button>
          <button
            onClick={onToggleToRequests}
            className="px-4 py-1.5 rounded-full text-xs font-bold text-ink-secondary hover:text-ink transition-colors cursor-pointer"
          >
            Requests
          </button>
        </div>
      </div>

      {/* Horizontal Category Filter Pills matching Screen 2 */}
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

      {/* 2-Column Main Layout: Left Sidebar Filters + Right Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
        
        {/* Left Filter Sidebar matching Screen 2 */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="bg-surface border border-divider rounded-2xl p-5 shadow-xs space-y-5">
            
            {/* Location matching Screen 2 (City dropdown + Distance dropdown) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-ink">Location</label>
              
              <div className="relative">
                <select
                  disabled
                  value={selectedLocality}
                  className="w-full appearance-none bg-canvas border border-divider rounded-xl px-3 py-2 text-xs font-bold text-ink cursor-default"
                >
                  <option value={selectedLocality}>{selectedLocality}</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] uppercase font-black text-brand bg-brand-soft px-1.5 py-0.5 rounded">
                  Your City
                </div>
              </div>

              <div className="relative">
                <select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-full appearance-none bg-surface border border-divider hover:border-zinc-300 dark:hover:border-zinc-600 rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none cursor-pointer transition-colors"
                >
                  <option value={2}>2 km</option>
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={15}>15 km</option>
                  <option value={25}>25 km</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Price per day matching Screen 2 */}
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

            {/* Availability matching Screen 2 */}
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

            {/* Type matching Screen 2 */}
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

            {/* Condition matching Screen 2 */}
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
                Reset filters
              </button>
            </div>

          </div>
        </aside>

        {/* Right Main Grid matching Screen 2 */}
        <main className="lg:col-span-9">
          
          {/* Sort bar */}
          <div className="flex items-center justify-between pb-4 text-xs font-medium text-ink-secondary">
            <span>
              Showing <span className="font-bold text-ink">{sortedItems.length}</span> rentals in {selectedLocality}
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
              <p className="text-xs font-bold text-ink-secondary">Loading rentals...</p>
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="py-20 text-center bg-surface border border-divider rounded-2xl p-8">
              <p className="text-base font-bold text-ink">No rentals match your filters in {selectedLocality}.</p>
              <p className="text-xs text-ink-secondary mt-1">Try widening your price range or resetting filters.</p>
              <button
                onClick={handleResetFilters}
                className="mt-4 btn-primary text-xs cursor-pointer"
              >
                Reset All Filters
              </button>
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
  );
};
