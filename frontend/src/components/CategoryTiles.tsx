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
  iconColor: string;
}

export const CATEGORIES: CategoryItem[] = [
  { name: 'Tools & DIY', label: 'Tools & DIY', icon: <Wrench className="w-5 h-5" />, iconColor: 'text-amber-600 dark:text-amber-400' },
  { name: 'Electronics & Tech', label: 'Electronics', icon: <Tv className="w-5 h-5" />, iconColor: 'text-violet-600 dark:text-violet-400' },
  { name: 'Camping & Outdoor', label: 'Camping', icon: <Tent className="w-5 h-5" />, iconColor: 'text-emerald-600 dark:text-emerald-400' },
  { name: 'Home & Appliances', label: 'Home', icon: <Coffee className="w-5 h-5" />, iconColor: 'text-teal-600 dark:text-teal-400' },
  { name: 'Clothing & Fits', label: 'Clothing', icon: <Shirt className="w-5 h-5" />, iconColor: 'text-pink-600 dark:text-pink-400' },
  { name: 'Books & Media', label: 'Books', icon: <BookOpen className="w-5 h-5" />, iconColor: 'text-indigo-600 dark:text-indigo-400' },
  { name: 'Sports & Fitness', label: 'Sports', icon: <Dumbbell className="w-5 h-5" />, iconColor: 'text-orange-600 dark:text-orange-400' },
  { name: 'Other', label: 'Other', icon: <Sparkles className="w-5 h-5" />, iconColor: 'text-purple-600 dark:text-purple-400' },
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
    <div className="py-6 sm:py-8">
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
            className="inline-flex min-h-9 items-center rounded-full px-3 text-xs font-bold text-brand transition-colors hover:bg-brand-soft"
          >
            Show All
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 min-[380px]:grid-cols-4 sm:gap-3 xl:grid-cols-8">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => onSelectCategory(isSelected ? 'All' : cat.name)}
              aria-pressed={isSelected}
              className={`group flex min-h-[5.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-brand/10 border-brand text-brand ring-1 ring-brand/25 shadow-sm'
                  : 'bg-surface border-divider text-ink shadow-sm hover:-translate-y-0.5 hover:border-brand/35 hover:text-brand hover:shadow-md'
              }`}
            >
              <div className={`transition-colors ${isSelected ? 'text-brand' : `${cat.iconColor} group-hover:scale-110`}`}>
                {cat.icon}
              </div>
              <span className="text-[11px] font-bold leading-tight">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
