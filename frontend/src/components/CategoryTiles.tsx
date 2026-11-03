import React from 'react';
import { 
  Wrench, 
  Tv, 
  Tent, 
  Coffee, 
  Shirt, 
  BookOpen, 
  Dumbbell, 
  Sparkles 
} from 'lucide-react';

export interface CategoryItem {
  name: string;
  label: string;
  icon: React.ReactNode;
}

export const CATEGORIES: CategoryItem[] = [
  { name: 'Tools & DIY', label: 'Tools & DIY', icon: <Wrench className="w-5 h-5" /> },
  { name: 'Electronics & Tech', label: 'Electronics', icon: <Tv className="w-5 h-5" /> },
  { name: 'Camping & Outdoor', label: 'Camping', icon: <Tent className="w-5 h-5" /> },
  { name: 'Home & Appliances', label: 'Home', icon: <Coffee className="w-5 h-5" /> },
  { name: 'Clothing & Fits', label: 'Clothing', icon: <Shirt className="w-5 h-5" /> },
  { name: 'Books & Media', label: 'Books', icon: <BookOpen className="w-5 h-5" /> },
  { name: 'Sports & Fitness', label: 'Sports', icon: <Dumbbell className="w-5 h-5" /> },
  { name: 'Other', label: 'Other', icon: <Sparkles className="w-5 h-5" /> },
];

interface CategoryTilesProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}

export const CategoryTiles: React.FC<CategoryTilesProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg sm:text-xl font-black text-ink tracking-tight font-display">
            Browse Categories
          </h3>
          <p className="text-xs text-ink-secondary">
            Explore everyday gear shared by neighbors in your area
          </p>
        </div>
        {selectedCategory !== 'All' && (
          <button
            onClick={() => onSelectCategory('All')}
            className="text-xs font-bold text-brand hover:underline cursor-pointer"
          >
            Show All
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5 sm:gap-3">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => onSelectCategory(isSelected ? 'All' : cat.name)}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl text-center cursor-pointer transition-all duration-150 border ${
                isSelected
                  ? 'bg-brand/10 border-brand text-brand ring-1 ring-brand/30 shadow-xs'
                  : 'bg-surface border-divider hover:border-zinc-300 dark:hover:border-zinc-700 text-ink hover:text-brand shadow-xs'
              }`}
            >
              <div className={`mb-1.5 transition-colors ${isSelected ? 'text-brand' : 'text-ink-secondary group-hover:text-brand'}`}>
                {cat.icon}
              </div>
              <span className="text-[11px] font-bold leading-tight truncate max-w-full">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
