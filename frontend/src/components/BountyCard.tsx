import React from 'react';
import { Target, Calendar, Clock, MapPin, CheckCircle2, User, Zap } from 'lucide-react';
import { CommunityRequest } from '../lib/types';

interface BountyCardProps {
  bounty: CommunityRequest;
  onClaim: (bounty: CommunityRequest) => void;
  isOwner?: boolean;
  onOpenUserProfile?: (userId: string) => void;
}

export const BountyCard: React.FC<BountyCardProps> = ({ bounty, onClaim, isOwner, onOpenUserProfile }) => {
  const isFulfilled = bounty.status === 'FULFILLED';

  return (
    <div className={`bg-surface border ${
      isFulfilled ? 'border-divider bg-canvas/60' : 'border-divider hover:border-brand hover:shadow-hard'
    } rounded-3xl p-5 transition-all flex flex-col justify-between`}>
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-brand-soft text-brand flex items-center justify-center font-black text-sm border border-brand/30">
              🎯
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-ink bg-category-tech px-2.5 py-0.5 rounded-full border border-ink/20">
              {bounty.category}
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs text-ink-secondary font-bold">Willing to Pay: </span>
            <span className="text-base font-black text-brand font-display">
              ₹{Number(bounty.offered_amount)}
            </span>
          </div>
        </div>

        {/* Item Name */}
        <h3 className="text-base sm:text-lg font-black text-ink tracking-tight mb-1">
          {bounty.item_name}
        </h3>

        {/* Description */}
        <p className="text-xs sm:text-sm text-ink-secondary font-medium mb-4 line-clamp-2">
          {bounty.description}
        </p>

        {/* Requirements Strip */}
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-ink mb-4 p-3 rounded-2xl bg-canvas border border-divider">
          <div className="flex items-center gap-1.5 text-ink-secondary">
            <Calendar className="w-3.5 h-3.5 text-brand" />
            <span className="text-ink">Needed: {new Date(bounty.start_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="flex items-center gap-1.5 text-ink-secondary">
            <Clock className="w-3.5 h-3.5 text-brand" />
            <span className="text-ink">Duration: {bounty.duration_days} {bounty.duration_days === 1 ? 'day' : 'days'}</span>
          </div>
          <div className="col-span-2 flex items-center gap-1.5 text-ink-secondary truncate">
            <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
            <span className="text-ink truncate">Locality: {bounty.locality || 'Nearby'}</span>
          </div>
          {(bounty.pickup_type || bounty.return_type) && (
            <div className="col-span-2 pt-2 border-t border-divider/60 text-[11px] font-semibold text-ink-secondary flex flex-wrap gap-x-2 gap-y-0.5">
              <span>Pickup: <strong className="text-ink">{bounty.pickup_type === 'MY_LOCATION' ? '📍 Deliver to Me' : bounty.pickup_type === 'CUSTOM_LOCATION' ? `🤝 Meet at ${bounty.pickup_locality || 'Custom Spot'}` : "🚶 Go to Lender"}</strong></span>
              <span>•</span>
              <span>Return: <strong className="text-ink">{bounty.return_type === 'MY_LOCATION' ? '🏠 Collect at Mine' : bounty.return_type === 'CUSTOM_LOCATION' ? `🤝 Meet at ${bounty.return_locality || 'Custom Spot'}` : "🚶 To Lender"}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Seeker Info & CTA */}
      <div className="pt-3 border-t border-divider flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (onOpenUserProfile && bounty.seeker_id) {
              onOpenUserProfile(bounty.seeker_id);
            }
          }}
          className="flex items-center gap-2 truncate group text-left cursor-pointer hover:opacity-90 transition-opacity"
          title={`View ${bounty.seeker_name}'s public profile`}
        >
          <img
            src={bounty.seeker_avatar || (bounty.seeker_name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(bounty.seeker_name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')}
            alt={bounty.seeker_name}
            className="w-7 h-7 rounded-full object-cover border border-ink/20 group-hover:border-brand"
          />
          <div className="truncate">
            <div className="text-xs font-extrabold text-ink truncate group-hover:text-brand">{bounty.seeker_name}</div>
            <div className="text-[10px] text-ink-secondary font-medium">Verified Renter</div>
          </div>
        </button>

        {isFulfilled ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-full border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> Fulfilled
          </span>
        ) : (
          <button
            onClick={() => onClaim(bounty)}
            className="bg-brand-soft hover:bg-brand text-brand hover:text-white font-extrabold text-xs px-4 py-2 rounded-full border border-brand/30 hover:border-ink shadow-xs hover:shadow-hard-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>I Can Rent This Out</span>
          </button>
        )}
      </div>
    </div>
  );
};
