import React, { useState } from 'react';
import { Heart, Star, Check, Package, MapPin } from 'lucide-react';
import { Item } from '../lib/types';
import { useAuth } from '../lib/authContext';
import { getReachDistance } from '../lib/distance';

interface ItemCardProps {
  item: Item;
  onClick: () => void;
  onQuickSnag?: (item: Item) => void;
  onOpenUserProfile?: (userId: string) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onClick, onOpenUserProfile }) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [imageError, setImageError] = useState(false);

  const images = Array.isArray(item.image_urls) ? item.image_urls.filter(Boolean) : [];
  const hasImage = images.length > 0 && Boolean(images[0]);
  const primaryImage = images[0] || '';

  const reachDistanceText = getReachDistance(item, user);

  return (
    <div
      onClick={onClick}
      className="group relative flex cursor-pointer flex-col justify-between rounded-[1.35rem] border border-divider bg-surface p-2.5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-xl hover:shadow-zinc-900/10"
    >
      <div>
        {/* Photo Container */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.05rem] bg-zinc-100 dark:bg-zinc-800">
          {hasImage && !imageError ? (
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

          {/* Floating Favorite Heart Icon */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsLiked(!isLiked);
            }}
            className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/90 shadow-md backdrop-blur-sm transition-transform hover:scale-105 active:scale-90 dark:border-zinc-700 dark:bg-zinc-900/90"
            title="Save to favorites"
          >
            <Heart
              className={`h-4 w-4 transition-colors ${isLiked ? 'fill-brand text-brand' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
            />
          </button>
        </div>

        {/* Content Info matching Screen 2 */}
        <div className="mt-3 px-0.5 pb-0.5">
          <h4 className="line-clamp-1 text-sm font-extrabold text-ink transition-colors group-hover:text-brand sm:text-base">
            {item.title}
          </h4>

          <div className="mt-1 flex items-center justify-between gap-1 flex-wrap">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-base font-black text-ink sm:text-lg">
                ₹{Number(item.price_per_day)}
              </span>
              <span className="text-[11px] text-ink-secondary font-medium">/ day</span>
            </div>

            {item.available_for_borrowing && (
              <span className="text-[10px] font-extrabold text-brand bg-brand-soft px-2 py-0.5 rounded-full border border-brand/20">
                Free Borrowing
              </span>
            )}
          </div>

          {/* Rating & Reach Proximity */}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-secondary">
            {Number(item.owner_rating) > 0 ? (
              <>
                <div className="flex items-center gap-1 font-semibold text-ink">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                  <span>{Number(item.owner_rating).toFixed(1)}</span>
                </div>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
              </>
            ) : null}
            <span className="text-ink-secondary font-medium truncate flex items-center gap-1">
              <MapPin className="w-3 h-3 text-brand shrink-0" />
              <span>{reachDistanceText}</span>
            </span>
          </div>

          {/* Owner info row with clickable avatar */}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-divider pt-2.5 text-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenUserProfile && (item.owner_username || item.owner_id)) {
                  onOpenUserProfile(item.owner_username || item.owner_id);
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

            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/40 dark:text-emerald-400">
              <Check className="w-2.5 h-2.5 stroke-[2.5]" /> Available
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
