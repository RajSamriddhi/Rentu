import React, { useState } from 'react';
import { Heart, Star, Check } from 'lucide-react';
import { Item } from '../lib/types';

interface ItemCardProps {
  item: Item;
  onClick: () => void;
  onQuickSnag?: (item: Item) => void;
  onOpenUserProfile?: (userId: string) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onClick, onOpenUserProfile }) => {
  const [isLiked, setIsLiked] = useState(false);

  const images = Array.isArray(item.image_urls) ? item.image_urls : [];
  const primaryImage = images[0] || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80';

  const isAvailable = item.status === 'AVAILABLE';

  return (
    <div
      onClick={onClick}
      className="group relative bg-surface border border-divider hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-2.5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* Photo Container */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
          <img
            src={primaryImage}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />

          {/* Floating Favorite Heart Icon */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsLiked(!isLiked);
            }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shadow-xs transition-transform active:scale-90 hover:bg-white dark:hover:bg-zinc-800"
            title="Save to favorites"
          >
            <Heart
              className={`w-3.5 h-3.5 transition-colors ${
                isLiked ? 'fill-brand text-brand' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            />
          </button>

          {/* Status Tag Overlay if Rented */}
          {!isAvailable && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
              <span className="bg-ink text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                Currently Rented
              </span>
            </div>
          )}
        </div>

        {/* Content Info matching Screen 2 */}
        <div className="mt-2.5 px-0.5">
          <h4 className="font-bold text-ink text-sm sm:text-base line-clamp-1 group-hover:text-brand transition-colors">
            {item.title}
          </h4>

          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-sm sm:text-base font-extrabold text-ink font-display">
              ₹{Number(item.price_per_day)}
            </span>
            <span className="text-[11px] text-ink-secondary font-medium">/ day</span>
          </div>

          {/* Rating & Distance */}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-secondary">
            {item.owner_rating ? (
              <>
                <div className="flex items-center gap-1 font-semibold text-ink">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                  <span>{Number(item.owner_rating).toFixed(1)}</span>
                </div>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
              </>
            ) : null}
            <span className="text-ink-secondary truncate">
              {item.distance_meters ? `${(item.distance_meters / 1000).toFixed(1)} km` : (item.locality || 'Nearby')}
            </span>
          </div>

          {/* Owner info row with clickable avatar */}
          <div className="mt-2.5 pt-2 border-t border-divider flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenUserProfile && item.owner_id) {
                  onOpenUserProfile(item.owner_id);
                }
              }}
              className="flex items-center gap-1.5 hover:text-brand transition-colors cursor-pointer text-left truncate group/owner"
              title={`View ${item.owner_name || 'owner'}'s profile`}
            >
              <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0 border border-zinc-300 dark:border-zinc-600">
                <img
                  src={item.owner_avatar || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(item.owner_name || item.owner_id || 'user')}`}
                  alt={item.owner_name || 'Owner'}
                  className="w-full h-full object-cover group-hover/owner:scale-110 transition-transform"
                />
              </div>
              <span className="text-[11px] font-bold text-ink-secondary group-hover/owner:text-brand truncate">
                {item.owner_name || 'Neighbor'}
              </span>
            </button>

            {isAvailable ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/40 dark:text-emerald-400">
                <Check className="w-2.5 h-2.5 stroke-[2.5]" /> Available
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                Rented
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
