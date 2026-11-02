import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  ArrowRight, 
  CheckCircle2, 
  QrCode, 
  Copy, 
  Check, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Booking } from '../lib/types';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';

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
        stageLabel: 'Stage 4: Return Handover',
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
      stageLabel: 'Stage 2: Pickup Handover',
      badgeClass: 'bg-brand-soft text-brand border-brand/20',
      description: 'Pickup handover pending',
    };
  }

  return {
    stageNumber: 1,
    stageLabel: 'Proposal Pending',
    badgeClass: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
    description: 'Awaiting confirmation',
  };
}

export const BookingCard: React.FC<BookingCardProps> = ({ 
  booking, 
  onClick, 
  onOpenChat,
  onUpdated 
}) => {
  const { user } = useAuth();
  const [imageError, setImageError] = useState(false);
  const [pickupCodeInput, setPickupCodeInput] = useState('');
  const [returnCodeInput, setReturnCodeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardError, setCardError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isReturnMode, setIsReturnMode] = useState(false);

  const isLender = booking.lender_id === user?.id;
  const isBorrower = booking.borrower_id === user?.id;
  const otherPartyName = isLender ? (booking.borrower_name || 'Renter') : (booking.lender_name || 'Owner');
  const otherPartyAvatar = isLender ? booking.borrower_avatar : booking.lender_avatar;

  const today = new Date();
  const currentDayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const stage = getBookingStageInfo(booking, currentDayStr);
  const currentStageNum = isReturnMode && stage.stageNumber === 3 ? 4 : stage.stageNumber;

  const primaryImage = booking.item_images?.[0];
  const hasImage = Boolean(primaryImage) && !imageError;

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Quick Pickup verification right on ongoing card
  const handleVerifyPickup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const code = pickupCodeInput.trim() || booking.pickup_code;
    if (!code) {
      setCardError('Please enter 6-digit pickup code');
      return;
    }
    setIsSubmitting(true);
    setCardError('');
    try {
      const updated = await api.verifyPickup(booking.id, code);
      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      } catch {}
      if (onUpdated) {
        onUpdated({ ...booking, ...updated, status: 'HANDED_OVER', handed_over_at: new Date().toISOString() });
      }
    } catch (err: any) {
      setCardError(err.message || 'Incorrect pickup code');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Return verification right on ongoing card
  const handleVerifyReturn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const code = returnCodeInput.trim() || booking.return_code;
    if (!code) {
      setCardError('Please enter 6-digit return code');
      return;
    }
    setIsSubmitting(true);
    setCardError('');
    try {
      const updated = await api.verifyReturn(booking.id, code);
      try {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      } catch {}
      if (onUpdated) {
        onUpdated({ ...booking, ...updated, returned_at: new Date().toISOString() });
      }
    } catch (err: any) {
      setCardError(err.message || 'Incorrect return code');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Confirm Payment receipt right on ongoing card
  const handleConfirmPayment = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSubmitting(true);
    setCardError('');
    try {
      const updated = await api.confirmBookingPayment(booking.id);
      try {
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 } });
      } catch {}
      if (onUpdated) {
        onUpdated({ ...booking, ...updated, status: 'COMPLETED', payment_status: 'CONFIRMED' });
      }
    } catch (err: any) {
      setCardError(err.message || 'Failed to confirm payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClick}
      className="group relative bg-surface border border-divider hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-3 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
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

        {/* Content Info */}
        <div className="mt-2.5 px-0.5 space-y-1.5">
          <h4 className="font-bold text-ink text-sm sm:text-base line-clamp-1 group-hover:text-brand transition-colors">
            {booking.item_title || 'Rented Product'}
          </h4>

          {/* Price & Duration */}
          <div className="flex items-center justify-between gap-1 flex-wrap">
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
          <div className="flex items-center gap-1.5 text-xs text-ink-secondary font-medium">
            <Calendar className="w-3.5 h-3.5 text-brand shrink-0" />
            <span className="truncate">
              {booking.start_date?.slice(0, 10)} {booking.end_date ? `➔ ${booking.end_date.slice(0, 10)}` : ''}
            </span>
          </div>

          {/* Error Message if any on action */}
          {cardError && (
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] font-bold text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{cardError}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* DIRECT ONGOING CODE & ACTION SECTION ON THE CARD         */}
          {/* ======================================================== */}
          
          {/* STAGE 2: PICKUP HANDOVER */}
          {currentStageNum === 2 && (
            <div 
              className="mt-2.5 p-2.5 rounded-xl bg-brand/5 border border-brand/20 space-y-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              {isLender ? (
                /* Lender enters Renter's Pickup Code */
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-ink block">
                    Pickup Handover: Enter code from {otherPartyName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      maxLength={6}
                      value={pickupCodeInput}
                      onChange={(e) => setPickupCodeInput(e.target.value.replace(/\D/g, ''))}
                      placeholder={booking.pickup_code || '6-digit code'}
                      className="bg-surface border border-divider rounded-lg px-2.5 py-1 text-center font-mono text-xs font-bold text-ink outline-none focus:border-brand flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyPickup}
                      disabled={isSubmitting}
                      className="btn-primary text-xs px-2.5 py-1 font-bold shadow-pink shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Renter displays Pickup Code to give to owner */
                <div className="text-center space-y-1">
                  <span className="text-[10px] font-bold text-ink-secondary block">
                    Your Pickup Code for {otherPartyName}:
                  </span>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="font-mono text-base font-black text-brand bg-surface px-3 py-0.5 rounded-lg border border-brand/30">
                      {booking.pickup_code || '123456'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopy(e, booking.pickup_code || '123456')}
                      className="p-1 rounded-lg bg-surface border border-divider text-ink-secondary hover:text-brand cursor-pointer"
                      title="Copy code"
                    >
                      {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <span className="text-[9px] text-ink-secondary block">
                    Give this code to owner when receiving gear
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STAGE 3: IN-USE */}
          {currentStageNum === 3 && (
            <div 
              className="mt-2.5 p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center space-y-1"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 block">
                Rental Active • Gear with {booking.borrower_name || 'Renter'}
              </span>
              <button
                type="button"
                onClick={() => setIsReturnMode(true)}
                className="w-full btn-secondary text-[11px] py-1 font-bold cursor-pointer"
              >
                Proceed to Return Handover ➔
              </button>
            </div>
          )}

          {/* STAGE 4: RETURN HANDOVER */}
          {currentStageNum === 4 && (
            <div 
              className="mt-2.5 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              {isLender ? (
                /* Lender enters Renter's Return Code */
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-ink block">
                    Return Handover: Enter code from {otherPartyName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      maxLength={6}
                      value={returnCodeInput}
                      onChange={(e) => setReturnCodeInput(e.target.value.replace(/\D/g, ''))}
                      placeholder={booking.return_code || '6-digit return code'}
                      className="bg-surface border border-divider rounded-lg px-2.5 py-1 text-center font-mono text-xs font-bold text-ink outline-none focus:border-brand flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyReturn}
                      disabled={isSubmitting}
                      className="btn-primary text-xs px-2.5 py-1 font-bold shadow-pink shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Renter displays Return Code to give to owner */
                <div className="text-center space-y-1">
                  <span className="text-[10px] font-bold text-ink-secondary block">
                    Your Return Code for {otherPartyName}:
                  </span>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="font-mono text-base font-black text-purple-600 dark:text-purple-400 bg-surface px-3 py-0.5 rounded-lg border border-purple-500/30">
                      {booking.return_code || '654321'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopy(e, booking.return_code || '654321')}
                      className="p-1 rounded-lg bg-surface border border-divider text-ink-secondary hover:text-brand cursor-pointer"
                      title="Copy return code"
                    >
                      {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <span className="text-[9px] text-ink-secondary block">
                    Give this code to owner when returning gear
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STAGE 5: TAKE PAYMENT FROM RENTER */}
          {currentStageNum === 5 && booking.status !== 'COMPLETED' && (
            <div 
              className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-xs font-black text-amber-700 dark:text-amber-300 block">
                Take the payment from the renter
              </span>
              {isLender ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-ink-secondary">
                    Have you received ₹{Number(booking.total_price)} from {otherPartyName}?
                  </p>
                  <button
                    type="button"
                    onClick={handleConfirmPayment}
                    disabled={isSubmitting}
                    className="w-full btn-primary text-xs py-1.5 font-bold shadow-pink cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                    ) : (
                      `Confirm Yes, I have received payment (₹${Number(booking.total_price)})`
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-[10px] text-ink-secondary">
                    Please pay ₹{Number(booking.total_price)} to {otherPartyName}. Once confirmed, rental will finish.
                  </p>
                  <span className="text-[9px] font-bold text-amber-600 bg-amber-500/20 px-2 py-0.5 rounded-full inline-block">
                    ⏳ Awaiting confirmation from owner
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Other Party Info & View Stage button */}
          <div className="pt-2 border-t border-divider flex items-center justify-between text-xs">
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
              <span>View Timeline</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
