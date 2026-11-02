import React, { useState } from 'react';
import { Calendar, Clock, MapPin, ArrowRight, CheckCircle2, QrCode, CreditCard, Sparkles } from 'lucide-react';
import { Booking } from '../lib/types';
import { useAuth } from '../lib/authContext';

interface BookingCardProps {
  booking: Booking;
  onClick: () => void;
  onOpenChat?: (bookingId: string) => void;
}

// Compute the current 5-stage progress for an ongoing booking
export function getBookingStageInfo(booking: Booking, currentDayStr: string) {
  if (booking.status === 'COMPLETED') {
    return {
      stageNumber: 5,
      stageLabel: 'Completed',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      description: 'Rental finished & verified',
    };
  }

  // Stage 5: Returned, awaiting payment confirmation
  if (booking.returned_at || booking.payment_status === 'SUBMITTED' || booking.payment_status === 'PENDING') {
    return {
      stageNumber: 5,
      stageLabel: 'Stage 5: Payment',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      description: 'Payment settlement',
    };
  }

  // Stage 3 & 4: Handed Over
  if (booking.status === 'HANDED_OVER') {
    const endStr = (booking.end_date || booking.start_date || '').slice(0, 10);
    const isDeadlineReached = endStr && endStr <= currentDayStr;

    if (isDeadlineReached) {
      return {
        stageNumber: 4,
        stageLabel: 'Stage 4: Return QR',
        badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        description: 'Return handover scan',
      };
    }

    return {
      stageNumber: 3,
      stageLabel: 'Stage 3: In-Use',
      badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      description: 'Rental period ongoing',
    };
  }

  // Stage 1 & 2: Accepted
  if (booking.status === 'ACCEPTED') {
    const startStr = (booking.start_date || '').slice(0, 10);
    const isMeetupDay = startStr && startStr <= currentDayStr;

    if (isMeetupDay) {
      return {
        stageNumber: 2,
        stageLabel: 'Stage 2: Pickup QR',
        badgeClass: 'bg-brand-soft text-brand border-brand/20',
        description: 'Meetup & QR handover',
      };
    }

    return {
      stageNumber: 1,
      stageLabel: 'Stage 1: Accepted',
      badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      description: 'Proposal accepted',
    };
  }

  return {
    stageNumber: 1,
    stageLabel: 'Proposal Pending',
    badgeClass: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
    description: 'Awaiting confirmation',
  };
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking, onClick, onOpenChat }) => {
  const { user } = useAuth();
  const [imageError, setImageError] = useState(false);

  const isLender = booking.lender_id === user?.id;
  const otherPartyName = isLender ? (booking.borrower_name || 'Borrower') : (booking.lender_name || 'Owner');
  const otherPartyAvatar = isLender ? booking.borrower_avatar : booking.lender_avatar;
  const otherPartyRole = isLender ? 'Renter' : 'Lender / Owner';

  const today = new Date();
  const currentDayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const stage = getBookingStageInfo(booking, currentDayStr);

  const primaryImage = booking.item_images?.[0];
  const hasImage = Boolean(primaryImage) && !imageError;

  return (
    <div
      onClick={onClick}
      className="group relative bg-surface border border-divider hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-2.5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* Photo Container matching Product Listing (aspect-[4/3]) */}
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

          {/* Floating Stage Badge on Photo */}
          <div className="absolute top-2 left-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-xs border ${stage.badgeClass}`}>
              {stage.stageLabel}
            </span>
          </div>

          {/* Role Indicator Pill */}
          <div className="absolute top-2 right-2">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-black/60 text-white backdrop-blur-sm border border-white/20">
              {isLender ? 'You are Lending' : 'You are Renting'}
            </span>
          </div>

          {/* Status overlay if completed */}
          {booking.status === 'COMPLETED' && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
              <span className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Finished
              </span>
            </div>
          )}
        </div>

        {/* Content Info matching Product Listing */}
        <div className="mt-2.5 px-0.5">
          <h4 className="font-bold text-ink text-sm sm:text-base line-clamp-1 group-hover:text-brand transition-colors">
            {booking.item_title || 'Rented Product'}
          </h4>

          {/* Price & Duration */}
          <div className="mt-1 flex items-center justify-between gap-1 flex-wrap">
            <div className="flex items-baseline gap-1">
              <span className="text-sm sm:text-base font-extrabold text-ink font-display">
                {Number(booking.total_price) === 0 ? 'Free' : `₹${Number(booking.total_price)}`}
              </span>
              <span className="text-[11px] text-ink-secondary font-medium">
                {booking.duration_days} {booking.duration_days === 1 ? 'day' : 'days'}
              </span>
            </div>

            <span className="text-[10px] font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-full border border-brand/20">
              {stage.description}
            </span>
          </div>

          {/* Dates */}
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-secondary font-medium">
            <Calendar className="w-3.5 h-3.5 text-brand shrink-0" />
            <span className="truncate">
              {booking.start_date?.slice(0, 10)} {booking.end_date ? `➔ ${booking.end_date.slice(0, 10)}` : ''}
            </span>
          </div>

          {/* Other Party Info */}
          <div className="mt-2.5 pt-2 border-t border-divider flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 truncate">
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

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-brand text-white group-hover:bg-brand-hover shadow-pink transition-all">
              <span>View Stage</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

