import React, { useState } from 'react';
import { Check, Heart, Package, Star } from 'lucide-react';
import { Item } from '../lib/types';

interface ItemCardProps {
  item: Item;
  onClick: () => void;
  onQuickSnag?: (item: Item) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onClick }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [imageError, setImageError] = useState(false);

  const images = Array.isArray(item.image_urls) ? item.image_urls.filter(Boolean) : [];
  const primaryImage = images[0] || '';
  const hasImage = Boolean(primaryImage) && !imageError;
  const isAvailable = item.status === 'AVAILABLE';

  return (
    <div
      onClick={onClick}
      className="group relative flex cursor-pointer flex-col justify-between rounded-[1.35rem] border border-divider bg-surface p-2.5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-xl hover:shadow-zinc-900/10"
    >
      <div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.05rem] bg-zinc-100 dark:bg-zinc-800">
          {hasImage ? (
            <img
              src={primaryImage}
              alt={item.title}
              onError={() => setImageError(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_25%_20%,rgba(225,29,116,0.17),transparent_42%),linear-gradient(135deg,#f4f1f6,#e9e7ee)] text-zinc-500 dark:bg-[radial-gradient(circle_at_25%_20%,rgba(225,29,116,0.2),transparent_42%),linear-gradient(135deg,#252531,#1b1b25)] dark:text-zinc-300">
              <Package className="h-9 w-9 stroke-[1.4]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em]">Gear in circulation</span>
            </div>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsLiked(!isLiked);
            }}
            className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/90 shadow-md backdrop-blur-sm transition-transform hover:scale-105 active:scale-90 dark:border-zinc-700 dark:bg-zinc-900/90"
            title="Save to favorites"
            aria-label={isLiked ? 'Remove from favorites' : 'Save to favorites'}
          >
            <Heart className={`h-4 w-4 transition-colors ${isLiked ? 'fill-brand text-brand' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}`} />
          </button>

          {!isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
              <span className="rounded-full bg-ink px-3 py-1 text-[11px] font-bold text-white">Currently rented</span>
            </div>
          )}
        </div>

        <div className="mt-3 px-0.5 pb-0.5">
          <h4 className="line-clamp-1 text-sm font-extrabold text-ink transition-colors group-hover:text-brand sm:text-base">
            {item.title}
          </h4>

          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-display text-base font-black text-ink sm:text-lg">₹{Number(item.price_per_day)}</span>
            <span className="text-[11px] font-medium text-ink-secondary">/ day</span>
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-secondary">
            {Number(item.owner_rating) > 0 && (
              <>
                <span className="flex items-center gap-1 font-semibold text-ink">
                  <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                  {Number(item.owner_rating).toFixed(1)}
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
              </>
            )}
            <span className="truncate">{item.distance_meters ? `${(item.distance_meters / 1000).toFixed(1)} km` : (item.locality || 'Nearby')}</span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-divider pt-2.5">
            <span className="truncate text-[11px] font-bold text-ink-secondary">{item.owner_name || 'Community lender'}</span>
            {isAvailable ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Check className="h-3 w-3 stroke-[2.5]" /> Available
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">Rented out</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
