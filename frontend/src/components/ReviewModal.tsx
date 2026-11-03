import React, { useState, useEffect } from 'react';
import { X, Star, Loader2, Sparkles, CheckCircle2, Package, UserCheck, Clock, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Booking } from '../lib/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/authContext';

interface ReviewModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  booking,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [reviewType, setReviewType] = useState<'OWNER_RENTAL' | 'RENTER' | 'COMMUNITY_LENDER'>('RENTER');

  // Safely compute roles unconditionally
  const isLender = Boolean(
    booking && (
      (booking.lender_id && (booking.lender_id === user?.id || (user?.firebase_uid && booking.lender_id === user.firebase_uid))) ||
      (booking.lender_name && user?.name && booking.lender_name.trim().toLowerCase() === user.name.trim().toLowerCase())
    )
  );

  const isFreeItem = Boolean(
    booking && (Number(booking.total_price) <= 0 || (booking as any).price_per_day === 0)
  );

  // Sync state whenever modal opens or booking changes
  useEffect(() => {
    if (isOpen && booking) {
      const computedType: 'OWNER_RENTAL' | 'RENTER' | 'COMMUNITY_LENDER' = isLender 
        ? 'RENTER' 
        : (isFreeItem ? 'COMMUNITY_LENDER' : 'OWNER_RENTAL');

      setReviewType(computedType);
      setRating(booking.user_rating ? Math.round(Number(booking.user_rating)) : 5);
      setComment(booking.user_comment || '');
      setErrorMsg('');
      setIsSubmitting(false);
    }
  }, [isOpen, booking?.id, isLender, isFreeItem]);

  // Hook rules preserved: Early return is strictly placed AFTER all hooks
  if (!isOpen || !booking) return null;

  const targetPersonName = isLender 
    ? (booking.borrower_name || 'Renter') 
    : (booking.lender_name || 'Gear Owner');

  const targetRoleTitle = isLender ? 'Renter' : (isFreeItem ? 'Community Lender' : 'Gear Owner');

  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Exceptional!'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setErrorMsg('Please select a rating between 1 and 5 stars.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await api.submitReview(booking.id, rating, comment.trim(), reviewType);
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {
        // Confetti visual extra only
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to submit review:', err);
      setErrorMsg(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        className="relative bg-surface w-full max-w-md rounded-3xl border border-divider shadow-2xl overflow-hidden my-auto text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider bg-surface">
          <div>
            <h3 className="text-base sm:text-lg font-black text-ink font-display flex items-center gap-2">
              <span>Review & Verified Trust</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </h3>
            <p className="text-xs text-ink-secondary mt-0.5">
              Reviewing <strong className="text-ink font-bold">{targetPersonName}</strong> ({targetRoleTitle})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-canvas text-ink-secondary hover:text-ink transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold animate-in fade-in">
              {errorMsg}
            </div>
          )}

          {/* Review Type Badge & Guidance */}
          <div className="p-3.5 bg-canvas rounded-2xl border border-divider space-y-2">
            <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">
              Feedback Role
            </div>
            <div className="flex items-center gap-2">
              {reviewType === 'OWNER_RENTAL' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Package className="w-3.5 h-3.5" /> Gear Owner Review (Paid Rental)
                </span>
              )}
              {reviewType === 'COMMUNITY_LENDER' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                  <Sparkles className="w-3.5 h-3.5" /> Community Lender Review (Free Community Gear)
                </span>
              )}
              {reviewType === 'RENTER' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <UserCheck className="w-3.5 h-3.5" /> Renter Review (Gear Care & Return)
                </span>
              )}
            </div>
            <p className="text-[11px] text-ink-secondary leading-relaxed">
              {reviewType === 'OWNER_RENTAL' && `Reviewing owner ${targetPersonName} for equipment condition, communication, and handoff experience.`}
              {reviewType === 'COMMUNITY_LENDER' && `Reviewing neighbor ${targetPersonName} who generously lent this gear completely free to the community.`}
              {reviewType === 'RENTER' && `Reviewing renter ${targetPersonName} for prompt return, respectful equipment handling, and smooth handoff.`}
            </p>
          </div>

          {/* Item Context Card */}
          <div className="p-3 bg-canvas rounded-2xl border border-divider flex items-center gap-3">
            <img
              src={booking.item_images?.[0] || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80'}
              alt={booking.item_title}
              className="w-12 h-12 rounded-xl object-cover border border-divider shrink-0"
            />
            <div className="space-y-0.5 min-w-0 flex-1">
              <h4 className="text-xs font-extrabold text-ink truncate">{booking.item_title}</h4>
              <p className="text-[11px] text-ink-secondary font-medium">
                {booking.start_date} → {booking.end_date || booking.start_date} • Completed Handover
              </p>
            </div>
          </div>

          {/* Star Rating Selector */}
          <div className="text-center space-y-2 py-2">
            <label className="block text-xs font-bold text-ink uppercase tracking-wider">
              {isLender 
                ? `How was ${targetPersonName}'s handling of your gear?` 
                : `How was your rental experience with ${targetPersonName}?`}
            </label>

            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-125 active:scale-95 cursor-pointer"
                  >
                    <Star
                      className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                        active
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-zinc-300 dark:text-zinc-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="text-xs font-black text-brand h-4">
              {ratingLabels[hoverRating || rating] || ''}
            </div>
          </div>

          {/* Written Feedback Comment */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Feedback Comment <span className="text-ink-secondary font-normal">(Optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={isLender 
                ? `Share how prompt, careful, and communicative ${targetPersonName} was with your ${booking.item_title}...` 
                : `Share how clean, accurate, and ready the gear was when handed over by ${targetPersonName}...`}
              rows={3}
              className="w-full bg-canvas border border-divider rounded-xl p-3 text-xs font-medium text-ink outline-none focus:border-brand resize-none"
            />
          </div>

          <div className="text-[10px] text-ink-secondary flex items-center justify-between">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3 text-ink-muted" /> 3-day peer review window
            </span>
            <span>Updates Community Trust Rating</span>
          </div>

          {/* Submit CTA */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-divider">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary text-xs px-4 py-2 cursor-pointer font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary text-xs px-5 py-2 shadow-pink cursor-pointer inline-flex items-center gap-1.5 font-bold disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{booking.user_review_id ? 'Update Review' : 'Submit Review'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
