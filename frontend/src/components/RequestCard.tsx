import React, { useState } from 'react';
import { Heart, MapPin, CheckCircle2, ArrowRight } from 'lucide-react';
import { CommunityRequest } from '../lib/types';
import { useAuth } from '../lib/authContext';
import { getReachDistance } from '../lib/distance';

interface RequestCardProps {
  request: CommunityRequest;
  onClick?: () => void;
  onClaim?: (request: CommunityRequest) => void;
  onEdit?: (request: CommunityRequest) => void;
  onOpenUserProfile?: (userId: string) => void;
}

export const RequestCard: React.FC<RequestCardProps> = ({
  request,
  onClick,
  onClaim,
  onEdit,
  onOpenUserProfile,
}) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [imageError, setImageError] = useState(false);

  const hasImage = Boolean(request.image_url) && !imageError;
  const isFulfilled = request.status === 'FULFILLED';
  const isCancelled = request.status === 'CANCELLED';
  const isOwnRequest = user?.id === request.seeker_id;
  const reachDistanceText = getReachDistance(request, user);

  const isTimePassed = (() => {
    if (!request.start_date) return false;
    try {
      const sDate = request.start_date.split('T')[0];
      const sTime = request.start_time ? request.start_time.slice(0, 5) : '10:00';
      const [y, m, d] = sDate.split('-').map(Number);
      const [h, min] = sTime.split(':').map(Number);
      const startMs = new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0, 0).getTime();
      return Date.now() > startMs;
    } catch {
      return false;
    }
  })();

  const isExpiredOrCancelled = isCancelled || (!isFulfilled && isTimePassed);

  return (
    <div
      onClick={onClick}
      className="group relative bg-surface border border-divider hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-2.5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* Photo Container: exactly like Product Listing. If no picture provided, leave space blank */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
          {hasImage && request.image_url ? (
            <img
              src={request.image_url}
              alt={request.item_name}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            /* Blank space when no image is provided */
            <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800/60" />
          )}

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

          {/* Status Tag Overlay if Fulfilled or Expired */}
          {isFulfilled && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
              <span className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Fulfilled
              </span>
            </div>
          )}
          {isExpiredOrCancelled && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
              <span className="bg-zinc-800 text-zinc-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border border-zinc-600">
                Cancelled (Time Passed)
              </span>
            </div>
          )}
        </div>

        {/* Content Info matching Product Listing */}
        <div className="mt-2.5 px-0.5">
          <h4 className="font-bold text-ink text-sm sm:text-base line-clamp-1 group-hover:text-brand transition-colors">
            {request.item_name}
          </h4>

          <div className="mt-1 flex items-center justify-between gap-1 flex-wrap">
            <div className="flex items-baseline gap-1">
              <span className="text-sm sm:text-base font-extrabold text-ink font-display">
                ₹{Number(request.offered_amount)}
              </span>
              <span className="text-[11px] text-ink-secondary font-medium">budget</span>
            </div>

            {isExpiredOrCancelled ? (
              <span className="text-[10px] font-extrabold text-zinc-500 bg-zinc-500/10 px-2 py-0.5 rounded-full border border-zinc-500/20">
                Cancelled (Expired)
              </span>
            ) : (
              <span className="text-[10px] font-extrabold text-brand bg-brand-soft px-2 py-0.5 rounded-full border border-brand/20">
                Active Request
              </span>
            )}
          </div>

          {/* Proximity Distance */}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-secondary">
            <span className="text-ink-secondary font-medium truncate flex items-center gap-1">
              <MapPin className="w-3 h-3 text-brand shrink-0" />
              <span>{reachDistanceText}</span>
            </span>
          </div>

          {/* Seeker info row with clickable avatar */}
          <div className="mt-2.5 pt-2 border-t border-divider flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenUserProfile && (request.seeker_username || request.seeker_id)) {
                  onOpenUserProfile(request.seeker_username || request.seeker_id);
                }
              }}
              className="flex items-center gap-1.5 hover:text-brand transition-colors cursor-pointer text-left truncate group/owner"
              title={`View ${request.seeker_name || 'seeker'}'s profile`}
            >
              <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0 border border-zinc-300 dark:border-zinc-600">
                <img
                  src={request.seeker_avatar || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(request.seeker_name || request.seeker_id || 'user')}`}
                  alt={request.seeker_name || 'Seeker'}
                  className="w-full h-full object-cover group-hover/owner:scale-110 transition-transform"
                />
              </div>
              <span className="text-[11px] font-bold text-ink-secondary group-hover/owner:text-brand truncate max-w-[90px]">
                {request.seeker_name || 'Neighbor'}
              </span>
            </button>

            {onEdit ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(request);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-canvas border border-divider hover:border-brand text-ink hover:text-brand transition-colors cursor-pointer"
              >
                Edit
              </button>
            ) : isFulfilled ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                Fulfilled
              </span>
            ) : isExpiredOrCancelled ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                Cancelled
              </span>
            ) : isOwnRequest ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                My Request
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onClick) onClick();
                }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-extrabold bg-surface border border-divider hover:border-brand hover:text-brand text-ink shadow-xs transition-all cursor-pointer active:scale-95 group/btn"
              >
                <span>See More</span>
                <ArrowRight className="w-3 h-3 text-brand group-hover/btn:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
