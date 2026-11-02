import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  QrCode 
} from 'lucide-react';
import { Booking } from '../lib/types';
import { useAuth } from '../lib/authContext';

interface BookingCardProps {
  booking: Booking;
  onClick: () => void;
  onOpenChat?: (bookingId: string) => void;
  onUpdated?: (updated: Booking) => void;
}

// Compute the current 5-stage progress for an ongoing booking
export function getBookingStageInfo(booking: Booking, currentDayStr?: string) {
  if (booking.status === 'COMPLETED') {
    return {
      stageNumber: 5,
      stageLabel: 'Completed',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      description: 'Rental finished & verified',
    };
  }

  // Stage 5: Returned by renter, now owner takes payment from renter
  if (booking.returned_at) {
    return {
      stageNumber: 5,
      stageLabel: 'Stage 5: Payment',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      description: 'Take payment from renter',
    };
  }

  // Stage 3 & 4: Handed Over (Rental ongoing or return handover)
  if (booking.status === 'HANDED_OVER') {
    const endStr = (booking.end_date || booking.start_date || '').slice(0, 10);
    const isDeadlineReached = currentDayStr ? (endStr && endStr <= currentDayStr) : false;

    if (isDeadlineReached) {
      return {
        stageNumber: 4,
        stageLabel: 'Stage 4: Return',
        badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        description: 'Return code exchange',
      };
    }

    return {
      stageNumber: 3,
      stageLabel: 'Stage 3: In-Use',
      badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      description: 'Rental period ongoing',
    };
  }

  // Stage 2: Proposal has been accepted, pickup handover is left
  if (booking.status === 'ACCEPTED') {
    return {
      stageNumber: 2,
      stageLabel: 'Stage 2: Pickup',
      badgeClass: 'bg-brand-soft text-brand border-brand/20',
      description: 'Pickup handover pending',
    };
  }

  return {
    stageNumber: 1,
    stageLabel: 'Stage 1: Pending',
    badgeClass: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
    description: 'Awaiting confirmation',
  };
}

function formatFriendlyDate(dateStr?: string): string {
  if (!dateStr) return 'Not set';
  try {
    const raw = dateStr.slice(0, 10);
    const parts = raw.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
    }
  } catch {}
  return dateStr;
}

export const BookingCard: React.FC<BookingCardProps> = ({ 
  booking, 
  onClick, 
}) => {
  const { user } = useAuth();
  const [imageError, setImageError] = useState(false);

  const isLender = booking.lender_id === user?.id;
  const otherPartyName = isLender ? (booking.borrower_name || 'Renter') : (booking.lender_name || 'Owner');
  const otherPartyAvatar = isLender ? booking.borrower_avatar : booking.lender_avatar;

  const today = new Date();
  const currentDayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const stage = getBookingStageInfo(booking, currentDayStr);

  const primaryImage = booking.item_images?.[0];
  const hasImage = Boolean(primaryImage) && !imageError;
  const durationLabel = booking.duration_days === 1 ? '1 day' : `${booking.duration_days || 1} days`;

  return (
    <div
      onClick={onClick}
      className="group relative bg-surface border border-divider hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-3 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
    >
      <div>
        {/* Photo Container */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
          {hasImage ? (
            <img
              src={primaryImage}
              alt={booking.item_title || 'Booked Gear'}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center">
              <QrCode className="w-8 h-8 text-ink-secondary/40" />
            </div>
          )}

          {/* Floating Badges on Photo: Clean non-colliding header overlay */}
          <div className="absolute top-0 inset-x-0 p-2.5 flex items-center justify-between gap-1.5 pointer-events-none">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-black/75 text-white backdrop-blur-md border border-white/20 truncate max-w-[48%] shadow-xs">
              {isLender ? 'You are Lending' : 'You are Renting'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider backdrop-blur-md shadow-xs border truncate max-w-[50%] ${stage.badgeClass}`}>
              {stage.stageLabel}
            </span>
          </div>

          {/* Status overlay if completed */}
          {booking.status === 'COMPLETED' && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
              <span className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-md">
                <CheckCircle2 className="w-3.5 h-3.5" /> Finished
              </span>
            </div>
          )}
        </div>

        {/* Content Info */}
        <div className="mt-3 px-1 space-y-2.5">
          {/* Product Title and Price */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-extrabold text-ink text-base line-clamp-1 group-hover:text-brand transition-colors">
                {booking.item_title || 'Rented Product'}
              </h4>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${stage.badgeClass}`}>
                {stage.description}
              </span>
            </div>

            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-black text-ink font-display">
                {Number(booking.total_price) === 0 ? 'Free' : `₹${Number(booking.total_price)}`}
              </span>
              <span className="text-xs text-ink-secondary font-medium">
                total • {durationLabel}
              </span>
            </div>
          </div>

          {/* Duration of Whole Renting Period (Start to End) */}
          <div className="p-2.5 rounded-xl bg-canvas border border-divider space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand shrink-0" />
                <span>Rental Period</span>
              </span>
              <span className="font-extrabold text-brand bg-brand-soft px-2 py-0.5 rounded-md text-[10px] border border-brand/20">
                {durationLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-divider/60 text-[11px]">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-ink-secondary/70 block">
                  Starts
                </span>
                <span className="font-bold text-ink block leading-tight truncate">
                  {formatFriendlyDate(booking.start_date)}
                </span>
                {booking.start_time && (
                  <span className="text-[10px] text-ink-secondary flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-brand shrink-0" />
                    <span className="truncate">{booking.start_time}</span>
                  </span>
                )}
              </div>

              <div className="space-y-0.5 min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-ink-secondary/70 block">
                  Ends
                </span>
                <span className="font-bold text-ink block leading-tight truncate">
                  {formatFriendlyDate(booking.end_date || booking.start_date)}
                </span>
                {booking.end_time && (
                  <span className="text-[10px] text-ink-secondary flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-brand shrink-0" />
                    <span className="truncate">{booking.end_time}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Footer: Other Party Info & Prominent View Timeline Button */}
          <div className="pt-2 border-t border-divider flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0 border border-zinc-300 dark:border-zinc-600">
                <img
                  src={otherPartyAvatar || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(otherPartyName)}`}
                  alt={otherPartyName}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[11px] font-bold text-ink-secondary truncate max-w-[100px]">
                {otherPartyName}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-brand text-white hover:bg-brand-hover shadow-pink transition-all shrink-0 cursor-pointer"
            >
              <span>View Timeline</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
