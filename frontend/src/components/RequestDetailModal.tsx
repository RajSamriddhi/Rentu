import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  MapPin, 
  CheckCircle2, 
  User, 
  Clock, 
  ArrowRight, 
  MessageSquare, 
  Sparkles, 
  Truck, 
  Package, 
  ShieldCheck,
  Loader2,
  Star,
  RotateCcw,
  Check
} from 'lucide-react';
import { CommunityRequest } from '../lib/types';
import { useAuth } from '../lib/authContext';
import { formatTime12 } from '../lib/formatters';

interface RequestDetailModalProps {
  request: CommunityRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onClaim?: (request: CommunityRequest) => void;
  onOpenAuth?: () => void;
  onOpenUserProfile?: (userId: string) => void;
  onOpenChatWithUser?: (userId: string, userName: string, avatarUrl?: string) => void;
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  request,
  isOpen,
  onClose,
  onClaim,
  onOpenAuth,
  onOpenUserProfile,
  onOpenChatWithUser,
}) => {
  const { user, isAuthenticated } = useAuth();
  const [isLending, setIsLending] = useState(false);

  if (!isOpen || !request) return null;

  const isFulfilled = request.status === 'FULFILLED';
  const isOwnRequest = user?.id === request.seeker_id;

  const handleClaim = async () => {
    if (!isAuthenticated && onOpenAuth) {
      onOpenAuth();
      return;
    }
    if (onClaim) {
      setIsLending(true);
      try {
        await onClaim(request);
      } finally {
        setIsLending(false);
      }
    }
  };

  const handleConnect = () => {
    if (!isAuthenticated && onOpenAuth) {
      onOpenAuth();
      return;
    }
    if (onOpenChatWithUser && request.seeker_id) {
      onClose();
      onOpenChatWithUser(
        request.seeker_id,
        request.seeker_name || 'Community Neighbor',
        request.seeker_avatar
      );
    }
  };

  // Format dates and times nicely
  const formatDateStr = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatTimeStr = (timeStr?: string) => {
    return formatTime12(timeStr);
  };

  // Build full destination address
  const fullDestinationAddress = [
    request.address_text,
    request.locality,
    request.pincode,
  ].filter(Boolean).join(', ');

  const willPickup = request.will_pickup !== false;
  const willDropBack = request.will_drop_back !== false;
  const deliveryFee = Number(request.delivery_fee || 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        className="relative bg-surface w-full max-w-xl rounded-3xl border border-divider shadow-2xl overflow-hidden my-auto text-ink flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Photo or Clean Placeholder */}
        <div className="relative aspect-[16/9] w-full bg-zinc-100 dark:bg-zinc-800 shrink-0 overflow-hidden">
          {request.image_url ? (
            <img
              src={request.image_url}
              alt={request.item_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand/10 via-brand/5 to-transparent flex items-center justify-center">
              <div className="text-center p-4">
                <Package className="w-12 h-12 text-brand/40 mx-auto mb-2" />
                <span className="text-xs font-bold text-ink-secondary">No reference picture attached</span>
              </div>
            </div>
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

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Title & Budget */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-brand tracking-wider bg-brand-soft px-2.5 py-0.5 rounded-full border border-brand/20">
                {request.category || 'Gear Request'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-ink font-display mt-1.5 leading-tight">
                {request.item_name}
              </h2>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xl sm:text-2xl font-black text-brand font-display">
                ₹{Number(request.offered_amount)}
              </div>
              <div className="text-[10px] font-bold text-ink-secondary uppercase tracking-wider">
                Offered Budget ({request.duration_days}d)
              </div>
            </div>
          </div>

          {/* Full Description from Seeker */}
          {request.description && (
            <div className="p-4 bg-canvas rounded-2xl border border-divider space-y-1">
              <span className="font-extrabold block text-ink-secondary text-[10px] uppercase tracking-wider">
                Details from Seeker
              </span>
              <p className="text-xs text-ink leading-relaxed font-medium">
                {request.description}
              </p>
            </div>
          )}

          {/* 1. Needed Schedule & Timeline */}
          <div className="p-4 bg-canvas rounded-2xl border border-divider space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-ink flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-brand" />
                <span>Rental Timeline</span>
              </span>
              <span className="text-[11px] font-black text-brand bg-brand-soft px-2.5 py-0.5 rounded-full border border-brand/20">
                {request.duration_days} {request.duration_days === 1 ? 'Day' : 'Days'} Duration
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-surface rounded-xl border border-divider/60 space-y-1">
                <div className="text-[10px] font-bold uppercase text-ink-secondary flex items-center gap-1">
                  <Clock className="w-3 h-3 text-brand" />
                  <span>Needed From (Start)</span>
                </div>
                <div className="font-extrabold text-ink text-xs">
                  {formatDateStr(request.start_date)}
                </div>
                {request.start_time && (
                  <div className="text-[11px] text-brand font-bold">
                    Meetup Time: {formatTimeStr(request.start_time)}
                  </div>
                )}
              </div>

              <div className="p-3 bg-surface rounded-xl border border-divider/60 space-y-1">
                <div className="text-[10px] font-bold uppercase text-ink-secondary flex items-center gap-1">
                  <Clock className="w-3 h-3 text-brand" />
                  <span>Return By (End)</span>
                </div>
                <div className="font-extrabold text-ink text-xs">
                  {formatDateStr(request.end_date || request.start_date)}
                </div>
                {request.end_time && (
                  <div className="text-[11px] text-ink-secondary font-bold">
                    Return Time: {formatTimeStr(request.end_time)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Pickup & Return Logistics (Toggles & Extra Fees) */}
          <div className="p-4 bg-canvas rounded-2xl border border-divider space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-ink flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-brand" />
              <span>Pickup & Return Preferences</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Pickup preference */}
              <div className="p-3 bg-surface rounded-xl border border-divider/60 space-y-1">
                <span className="text-[10px] font-bold uppercase text-ink-secondary block">
                  Pickup Handover
                </span>
                <div className="font-bold text-ink flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-brand shrink-0" />
                  <span>{willPickup ? 'Renter Self-Pickup' : 'Delivery Requested'}</span>
                </div>
                <p className="text-[11px] text-ink-secondary leading-relaxed">
                  {willPickup 
                    ? "Renter will travel and pick up from the lender's location."
                    : `Asking lender to deliver to their address (${deliveryFee > 0 ? `+₹${deliveryFee} extra fee offered` : 'free delivery requested'}).`}
                </p>
              </div>

              {/* Return preference */}
              <div className="p-3 bg-surface rounded-xl border border-divider/60 space-y-1">
                <span className="text-[10px] font-bold uppercase text-ink-secondary block">
                  Return Handover
                </span>
                <div className="font-bold text-ink flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-brand shrink-0" />
                  <span>{willDropBack ? 'Renter Self-Return' : 'Pickup Collection Requested'}</span>
                </div>
                <p className="text-[11px] text-ink-secondary leading-relaxed">
                  {willDropBack
                    ? "Renter will drop and return the gear back to the lender."
                    : `Asking lender to collect from their address (${deliveryFee > 0 ? `+₹${deliveryFee} extra fee offered` : 'free pickup requested'}).`}
                </p>
              </div>
            </div>
          </div>

          {/* 3. Destination Location (Where seeker wants the item to be at) */}
          <div className="p-4 bg-canvas rounded-2xl border border-divider space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-ink flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-brand" />
              <span>Destination Location</span>
            </span>

            <div className="p-3 bg-surface rounded-xl border border-divider/60 flex items-start gap-2.5 text-xs">
              <MapPin className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-ink leading-snug">
                  {fullDestinationAddress || request.locality || 'Bangalore, Karnataka'}
                </div>
                {request.pincode && (
                  <div className="text-[11px] text-ink-secondary mt-0.5">
                    PIN / Postal Code: {request.pincode}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. Seeker Profile Card */}
          <div className="p-4 bg-canvas rounded-2xl border border-divider flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={request.seeker_avatar || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(request.seeker_name || request.seeker_id || 'user')}`}
                alt={request.seeker_name || 'Seeker'}
                className="w-11 h-11 rounded-full object-cover border border-divider shrink-0 shadow-xs"
              />
              <div>
                <div className="text-xs font-black text-ink">{request.seeker_name || 'Community Neighbor'}</div>
                <div className="text-[11px] text-ink-secondary">{request.locality || 'Bengaluru'}</div>
                <div className="text-[10px] font-bold text-amber-500 mt-0.5 flex items-center gap-1">
                  {(request as any).seeker_rating && Number((request as any).seeker_rating) > 0 ? (
                    <>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{Number((request as any).seeker_rating).toFixed(1)}</span>
                      <span className="text-ink-secondary font-medium">•</span>
                    </>
                  ) : null}
                  <span className="text-ink-secondary font-medium">Verified Seeker</span>
                </div>
              </div>
            </div>

            {onOpenUserProfile && request.seeker_id && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenUserProfile(request.seeker_username || request.seeker_id);
                }}
                className="btn-secondary text-xs px-3.5 py-1.5 rounded-full font-bold cursor-pointer inline-flex items-center gap-1"
              >
                <span>View Profile</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="p-4 border-t border-divider bg-surface shrink-0 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs px-4 py-2.5 cursor-pointer font-bold rounded-xl"
          >
            Close
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Connect / Message Seeker Button */}
            {!isOwnRequest && onOpenChatWithUser && (
              <button
                type="button"
                onClick={handleConnect}
                className="btn-secondary text-xs px-4 py-2.5 rounded-xl font-bold cursor-pointer inline-flex items-center gap-1.5 hover:border-brand hover:text-brand transition-colors"
                title="Open direct message with requester"
              >
                <MessageSquare className="w-3.5 h-3.5 text-brand" />
                <span>Connect with Requester</span>
              </button>
            )}

            {/* I Can Lend This CTA */}
            {!isOwnRequest && !isFulfilled && onClaim && (
              <button
                type="button"
                disabled={isLending}
                onClick={handleClaim}
                className="btn-primary text-xs px-5 py-2.5 rounded-xl shadow-pink cursor-pointer font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isLending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Offer...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>I Can Lend This</span>
                  </>
                )}
              </button>
            )}

            {isOwnRequest && (
              <span className="text-xs font-bold text-ink-secondary py-2 px-3 bg-canvas rounded-xl border border-divider">
                Your Request
              </span>
            )}

            {isFulfilled && !isOwnRequest && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 py-2 px-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <Check className="w-3.5 h-3.5" /> Request Fulfilled
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
