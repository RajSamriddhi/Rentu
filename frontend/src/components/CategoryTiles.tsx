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
  bg: string;
  borderColor: string;
  iconColor: string;
  darkBg: string;
  darkBorder: string;
  darkIcon: string;
}

export const CATEGORIES: CategoryItem[] = [
  { 
    name: 'Tools & DIY', 
    label: 'Tools & DIY', 
    icon: <Wrench className="w-6 h-6" />, 
    bg: 'bg-[#FEF9C3]', 
    borderColor: 'border-[#FEF08A]',
    iconColor: 'text-[#854D0E]',
    darkBg: 'dark:bg-amber-950/30',
    darkBorder: 'dark:border-amber-800/40',
    darkIcon: 'dark:text-amber-400'
  },
  { 
    name: 'Electronics & Tech', 
    label: 'Electronics', 
    icon: <Tv className="w-6 h-6" />, 
    bg: 'bg-[#EDE9FE]', 
    borderColor: 'border-[#DDD6FE]',
    iconColor: 'text-[#6D28D9]',
    darkBg: 'dark:bg-purple-950/30',
    darkBorder: 'dark:border-purple-800/40',
    darkIcon: 'dark:text-purple-300'
  },
  { 
    name: 'Camping & Outdoor', 
    label: 'Camping', 
    icon: <Tent className="w-6 h-6" />, 
    bg: 'bg-[#DCFCE7]', 
    borderColor: 'border-[#BBF7D0]',
    iconColor: 'text-[#15803D]',
    darkBg: 'dark:bg-emerald-950/30',
    darkBorder: 'dark:border-emerald-800/40',
    darkIcon: 'dark:text-emerald-400'
  },
  { 
    name: 'Home & Appliances', 
    label: 'Home & Appliances', 
    icon: <Coffee className="w-6 h-6" />, 
    bg: 'bg-[#CCFBF1]', 
    borderColor: 'border-[#99F6E4]',
    iconColor: 'text-[#0F766E]',
    darkBg: 'dark:bg-teal-950/30',
    darkBorder: 'dark:border-teal-800/40',
    darkIcon: 'dark:text-teal-300'
  },
  { 
    name: 'Clothing & Fits', 
    label: 'Clothing & Accessories', 
    icon: <Shirt className="w-6 h-6" />, 
    bg: 'bg-[#FCE7F3]', 
    borderColor: 'border-[#FBCFE8]',
    iconColor: 'text-[#BE185D]',
    darkBg: 'dark:bg-pink-950/30',
    darkBorder: 'dark:border-pink-800/40',
    darkIcon: 'dark:text-pink-300'
  },
  { 
    name: 'Books & Media', 
    label: 'Books & Media', 
    icon: <BookOpen className="w-6 h-6" />, 
    bg: 'bg-[#E0E7FF]', 
    borderColor: 'border-[#C7D2FE]',
    iconColor: 'text-[#4338CA]',
    darkBg: 'dark:bg-indigo-950/30',
    darkBorder: 'dark:border-indigo-800/40',
    darkIcon: 'dark:text-indigo-300'
  },
  { 
    name: 'Sports & Fitness', 
    label: 'Sports', 
    icon: <Dumbbell className="w-6 h-6" />, 
    bg: 'bg-[#FFEDD5]', 
    borderColor: 'border-[#FED7AA]',
    iconColor: 'text-[#C2410C]',
    darkBg: 'dark:bg-orange-950/30',
    darkBorder: 'dark:border-orange-800/40',
    darkIcon: 'dark:text-orange-300'
  },
  { 
    name: 'Other', 
    label: 'Other', 
    icon: <Sparkles className="w-6 h-6" />, 
    bg: 'bg-[#F3E8FF]', 
    borderColor: 'border-[#E9D5FF]',
    iconColor: 'text-[#7E22CE]',
    darkBg: 'dark:bg-violet-950/30',
    darkBorder: 'dark:border-violet-800/40',
    darkIcon: 'dark:text-violet-300'
  },
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
          <h3 className="text-xl font-extrabold text-ink tracking-tight font-display">
            Browse by Category
          </h3>
          <p className="text-xs text-ink-secondary font-medium">
            Explore everyday items shared by trusted neighbors in your community
          </p>
        </div>
        {selectedCategory !== 'All' && (
          <button
            onClick={() => onSelectCategory('All')}
            className="text-xs font-bold text-brand hover:underline cursor-pointer"
          >
            Reset to All Categories ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 sm:gap-4">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => onSelectCategory(isSelected ? 'All' : cat.name)}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl text-center cursor-pointer transition-all duration-200 border ${cat.bg} ${cat.darkBg} ${
                isSelected
                  ? 'border-brand ring-2 ring-brand scale-105 shadow-md'
                  : `${cat.borderColor} ${cat.darkBorder} hover:scale-105 hover:shadow-sm`
              }`}
            >
              <div className={`mb-2 ${cat.iconColor} ${cat.darkIcon}`}>
                {cat.icon}
              </div>
              <span className="text-[11px] font-bold text-ink leading-tight line-clamp-2">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
