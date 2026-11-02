import React from 'react';
import { X, Calendar, MapPin, CheckCircle2, User, Clock, ArrowRight } from 'lucide-react';
import { CommunityRequest } from '../lib/types';
import { useAuth } from '../lib/authContext';
import { formatFullAddress } from '../lib/location';

interface RequestDetailModalProps {
  request: CommunityRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onClaim?: (request: CommunityRequest) => void;
  onOpenAuth?: () => void;
  onOpenUserProfile?: (userId: string) => void;
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  request,
  isOpen,
  onClose,
  onClaim,
  onOpenAuth,
  onOpenUserProfile,
}) => {
  const { user, isAuthenticated } = useAuth();

  if (!isOpen || !request) return null;

  const isFulfilled = request.status === 'FULFILLED';
  const isOwnRequest = user?.id === request.seeker_id;

  const handleClaim = () => {
    if (!isAuthenticated && onOpenAuth) {
      onOpenAuth();
      return;
    }
    if (onClaim) {
      onClaim(request);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        className="relative bg-surface w-full max-w-lg rounded-3xl border border-divider shadow-2xl overflow-hidden my-auto text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Photo or Blank Area matching Product Listing */}
        <div className="relative aspect-[16/9] w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          {request.image_url ? (
            <img
              src={request.image_url}
              alt={request.item_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800/60" />
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md flex items-center justify-center cursor-pointer transition-colors shadow-md"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Status Badge */}
          <div className="absolute top-3 left-3">
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              isFulfilled
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-brand text-white shadow-pink'
            }`}>
              {isFulfilled ? 'Fulfilled Request' : 'Active Gear Request'}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Title & Budget */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-brand tracking-wider">
                {request.category || 'Gear Request'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-ink font-display mt-0.5">
                {request.item_name}
              </h2>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xl sm:text-2xl font-black text-brand font-display">
                ₹{Number(request.offered_amount)}
              </div>
              <div className="text-[10px] font-bold text-ink-secondary">
                Offered Budget
              </div>
            </div>
          </div>

          {/* Description */}
          {request.description && (
            <div className="p-3.5 bg-canvas rounded-2xl border border-divider text-xs text-ink leading-relaxed">
              <span className="font-bold block text-ink-muted mb-1 text-[10px] uppercase">Details from Seeker</span>
              {request.description}
            </div>
          )}

          {/* Dates & Logistics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Timeline */}
            <div className="p-3 bg-canvas rounded-xl border border-divider space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-ink-muted text-[10px] uppercase">
                <Calendar className="w-3.5 h-3.5 text-brand" />
                <span>Needed Timeline</span>
              </div>
              <div className="font-bold text-ink">
                {new Date(request.start_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                {request.end_date ? ` ➔ ${new Date(request.end_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
              </div>
              <div className="text-[11px] text-ink-secondary">
                {request.duration_days} {request.duration_days === 1 ? 'day' : 'days'} duration
              </div>
            </div>

            {/* Handover Location */}
            <div className="p-3 bg-canvas rounded-xl border border-divider space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-ink-muted text-[10px] uppercase">
                <MapPin className="w-3.5 h-3.5 text-brand" />
                <span>Area / Location</span>
              </div>
              <div className="font-bold text-ink truncate">
                {request.locality || 'Bengaluru'}
              </div>
              <div className="text-[11px] text-ink-secondary truncate">
                {request.pickup_type === 'MY_LOCATION'
                  ? 'Deliver to current location'
                  : request.pickup_type === 'CUSTOM_LOCATION'
                  ? `Meet at ${request.pickup_locality || request.locality || 'Custom Spot'}`
                  : "Pickup from Lender's place"}
              </div>
            </div>
          </div>

          {/* Seeker Profile Link */}
          <div className="p-3.5 bg-canvas rounded-2xl border border-divider flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={request.seeker_avatar || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(request.seeker_name || request.seeker_id || 'user')}`}
                alt={request.seeker_name}
                className="w-10 h-10 rounded-full object-cover border border-divider"
              />
              <div>
                <div className="text-xs font-black text-ink">{request.seeker_name || 'Community Neighbor'}</div>
                <div className="text-[10px] text-ink-secondary">{request.locality || 'Bengaluru'}</div>
              </div>
            </div>

            {onOpenUserProfile && request.seeker_id && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenUserProfile(request.seeker_id);
                }}
                className="text-xs font-extrabold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>View Profile</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Action CTA */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-divider">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs px-4 py-2 cursor-pointer font-bold"
            >
              Close
            </button>

            {!isOwnRequest && !isFulfilled && onClaim && (
              <button
                type="button"
                onClick={handleClaim}
                className="btn-primary text-xs px-5 py-2 shadow-pink cursor-pointer font-bold inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>I Can Lend This</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
