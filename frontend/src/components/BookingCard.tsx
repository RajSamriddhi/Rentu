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
import { formatTime12 } from '../lib/formatters';

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
      description: 'Finished & verified',
    };
  }

  // Stage 5: Returned by renter, now owner takes payment from renter
  if (booking.returned_at) {
    return {
      stageNumber: 5,
      stageLabel: 'Payment',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      description: 'Take payment',
    };
  }

  // Stage 3 & 4: Handed Over (Rental ongoing or return handover)
  if (booking.status === 'HANDED_OVER') {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const endStr = (booking.end_date || booking.start_date || '').slice(0, 10);
    const endT = (booking.end_time || '18:00').slice(0, 5);
    const currentHMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const isReturnTimeArrived = (endStr < todayStr) || (endStr === todayStr && currentHMin >= endT);

    if (isReturnTimeArrived) {
      return {
        stageNumber: 4,
        stageLabel: 'Return Handover',
        badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        description: 'Ready for return code',
      };
    }

    return {
      stageNumber: 3,
      stageLabel: 'In-Use',
      badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      description: 'Rental in progress',
    };
  }

  // Stage 1 & 2: Proposal has been accepted
  if (booking.status === 'ACCEPTED') {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const startStr = (booking.start_date || '').slice(0, 10);
    const startT = (booking.start_time || '10:00').slice(0, 5);
    const currentHMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const isPickupTimeArrived = (startStr < todayStr) || (startStr === todayStr && currentHMin >= startT);

    if (isPickupTimeArrived) {
      return {
        stageNumber: 2,
        stageLabel: 'Pickup Ready',
        badgeClass: 'bg-brand-soft text-brand border-brand/20',
        description: 'Verify pickup code',
      };
    }

    return {
      stageNumber: 1,
      stageLabel: 'Scheduled',
      badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      description: `Pickup at ${formatTime12(booking.start_time || '10:00')}`,
    };
  }

  return {
    stageNumber: 1,
    stageLabel: 'Pending',
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
          month: 'short',
          day: 'numeric',
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

  const isLender = Boolean(
    booking && (
      (booking.lender_id && (booking.lender_id === user?.id || (user?.firebase_uid && booking.lender_id === user.firebase_uid))) ||
      (booking.lender_name && user?.name && booking.lender_name.trim().toLowerCase() === user.name.trim().toLowerCase())
    )
  );

  const otherPartyName = isLender
    ? (booking.borrower_name || 'Renter')
    : (booking.lender_name || 'Lender / Owner');

  const otherPartyAvatar = isLender ? booking.borrower_avatar : booking.lender_avatar;

  const stage = getBookingStageInfo(booking);

  const images = Array.isArray(booking.item_images) ? booking.item_images.filter(Boolean) : [];
  const primaryImage = images[0] || '';
  const hasImage = Boolean(primaryImage) && !imageError;

  const durationDays = booking.duration_days || 1;
  const durationLabel = `${durationDays} ${durationDays === 1 ? 'day' : 'days'}`;

  return (
    <div
      id={`booking-${booking.id}`}
      onClick={onClick}
      className="group relative bg-surface border border-divider hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-3 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
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

          {/* Clean Floating Badges */}
          <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-1 pointer-events-none">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-black/70 text-white backdrop-blur-xs shadow-xs truncate">
              {isLender ? 'Lending' : 'Renting'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider backdrop-blur-xs shadow-xs border truncate ${stage.badgeClass}`}>
              {stage.stageLabel}
            </span>
          </div>

          {booking.status === 'COMPLETED' && (
            <div className="absolute inset-0 bg-black/30 backdrop-blur-2xs flex items-center justify-center">
              <span className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-md">
                <CheckCircle2 className="w-3.5 h-3.5" /> Finished
              </span>
            </div>
          )}
        </div>

        {/* Content Info */}
        <div className="mt-2.5 px-0.5 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-bold text-ink text-sm sm:text-base line-clamp-1 group-hover:text-brand transition-colors">
              {booking.item_title || 'Rented Item'}
            </h4>
            <span className="text-sm sm:text-base font-extrabold text-ink font-display shrink-0">
              {Number(booking.total_price) === 0 ? 'Free' : `₹${Number(booking.total_price)}`}
            </span>
          </div>

          {/* Clean Schedule Line */}
          <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <Clock className="w-3.5 h-3.5 text-brand shrink-0" />
            <span className="truncate font-medium">
              {formatFriendlyDate(booking.start_date)} {booking.start_time ? `(${formatTime12(booking.start_time)})` : ''} → {formatFriendlyDate(booking.end_date || booking.start_date)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer: Partner Info & View Timeline CTA */}
      <div className="mt-3 pt-2 border-t border-divider flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0 border border-zinc-300 dark:border-zinc-600">
            <img
              src={otherPartyAvatar || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(otherPartyName)}`}
              alt={otherPartyName}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-[11px] font-bold text-ink-secondary truncate max-w-[110px]">
            {otherPartyName}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
        >
          <span>Timeline</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
