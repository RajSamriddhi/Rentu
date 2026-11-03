import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  QrCode,
  MessageSquare,
  Package
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
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      description: 'Finished & verified',
    };
  }

  // Stage 5: Returned by renter, now owner takes payment from renter
  if (booking.returned_at) {
    return {
      stageNumber: 5,
      stageLabel: 'Stage 5: Payment',
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
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
        stageLabel: 'Stage 4: Return',
        badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
        description: 'Ready for return code',
      };
    }

    return {
      stageNumber: 3,
      stageLabel: 'Stage 3: In-Use',
      badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
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
        stageLabel: 'Stage 2: Pickup Ready',
        badgeClass: 'bg-brand/15 text-brand border-brand/30',
        description: 'Verify pickup code',
      };
    }

    return {
      stageNumber: 1,
      stageLabel: 'Stage 1: Scheduled',
      badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      description: `Pickup at ${formatTime12(booking.start_time || '10:00')}`,
    };
  }

  return {
    stageNumber: 1,
    stageLabel: 'Pending',
    badgeClass: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/30',
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
  onOpenChat,
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
  const otherPartyId = isLender ? booking.borrower_id : booking.lender_id;

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
      className="group relative bg-surface border border-divider hover:border-brand/40 rounded-3xl p-4 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3"
    >
      <div className="space-y-3">
        {/* Photo Container with readable Role & Stage Badges */}
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-divider/50">
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
              <QrCode className="w-10 h-10 text-ink-secondary/30" />
            </div>
          )}

          {/* Floating Role & Status Badges */}
          <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1.5 pointer-events-none">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm border ${
              isLender
                ? 'bg-purple-950/85 text-purple-300 border-purple-500/40'
                : 'bg-black/85 text-pink-300 border-brand/40'
            }`}>
              {isLender ? '📤 Lending (Owner)' : '📥 Renting (Borrower)'}
            </span>

            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm border ${stage.badgeClass}`}>
              {stage.stageLabel}
            </span>
          </div>

          {booking.status === 'COMPLETED' && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center">
              <span className="bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-md">
                <CheckCircle2 className="w-4 h-4" /> Finished
              </span>
            </div>
          )}
        </div>

        {/* Content Info: Title & Price */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-extrabold text-ink text-base sm:text-lg capitalize line-clamp-1 group-hover:text-brand transition-colors font-display">
              {booking.item_title || 'Rented Item'}
            </h4>
            <div className="text-right shrink-0">
              <span className="text-base sm:text-lg font-black text-ink font-display">
                {Number(booking.total_price) === 0 ? 'Free' : `₹${Number(booking.total_price)}`}
              </span>
              <span className="text-[11px] text-ink-secondary ml-1 font-medium">
                ({durationLabel})
              </span>
            </div>
          </div>
        </div>

        {/* Dedicated Readable Schedule Box (Never Truncates!) */}
        <div className="p-3 bg-canvas/80 rounded-2xl border border-divider text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-ink-secondary flex items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-brand" />
              <span>Pickup:</span>
            </span>
            <span className="font-bold text-ink truncate text-right">
              {formatFriendlyDate(booking.start_date)} at {formatTime12(booking.start_time || '10:00')}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-divider/60">
            <span className="text-[11px] font-semibold text-ink-secondary flex items-center gap-1.5 shrink-0">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span>Return:</span>
            </span>
            <span className="font-bold text-ink truncate text-right">
              {formatFriendlyDate(booking.end_date || booking.start_date)} at {formatTime12(booking.end_time || '18:00')}
            </span>
          </div>
        </div>
      </div>

      {/* Footer: Partner Info & Quick Action */}
      <div className="pt-2.5 border-t border-divider flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={otherPartyAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherPartyName)}&background=0F172A&color=fff&bold=true`}
            alt={otherPartyName}
            className="w-7 h-7 rounded-full object-cover border border-divider shrink-0 shadow-2xs"
          />
          <div className="min-w-0">
            <span className="text-[9px] uppercase font-bold text-ink-muted block leading-none">
              {isLender ? 'Rented by' : 'Lender'}
            </span>
            <span className="text-xs font-bold text-ink truncate block">
              {otherPartyName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenChat && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChat(booking.is_proposal ? `dm_${otherPartyId}` : booking.id);
              }}
              className="p-2 rounded-xl border border-divider hover:border-brand hover:text-brand bg-surface text-ink-secondary transition-colors cursor-pointer"
              title={`Message ${otherPartyName}`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="btn-primary text-xs px-3.5 py-1.5 font-bold shadow-pink rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>Timeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
