import React, { useState, useEffect } from 'react';
import { X, Star, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
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

function formatFriendlyDate(dateStr?: string): string {
  if (!dateStr) return '';
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
          year: 'numeric',
        });
      }
    }
  } catch {}
  return dateStr;
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

  if (!isOpen || !booking) return null;

  const targetPersonName = isLender 
    ? (booking.borrower_name || 'Renter') 
    : (booking.lender_name || 'Gear Owner');

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
        {/* Minimalist Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider bg-surface">
          <div>
            <h3 className="text-base sm:text-lg font-black text-ink font-display">
              Leave a Review
            </h3>
            <p className="text-xs text-ink-secondary mt-0.5">
              Reviewing <strong className="text-ink font-bold">{targetPersonName}</strong>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold animate-in fade-in">
              {errorMsg}
            </div>
          )}

          {/* Clean Item Context Snippet */}
          <div className="p-3 bg-canvas rounded-2xl border border-divider flex items-center gap-3">
            <img
              src={booking.item_images?.[0] || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80'}
              alt={booking.item_title}
              className="w-11 h-11 rounded-xl object-cover border border-divider shrink-0"
            />
            <div className="space-y-0.5 min-w-0 flex-1">
              <h4 className="text-xs font-extrabold text-ink truncate">{booking.item_title}</h4>
              <p className="text-[11px] text-ink-secondary">
                {formatFriendlyDate(booking.start_date)} • Completed Handover
              </p>
            </div>
          </div>

          {/* Star Rating Selector */}
          <div className="text-center space-y-2 py-3 bg-canvas/40 rounded-2xl border border-divider">
            <p className="text-xs font-bold text-ink">
              {isLender 
                ? `How was ${targetPersonName}'s handling of your gear?` 
                : `How was your rental experience with ${targetPersonName}?`}
            </p>

            <div className="flex items-center justify-center gap-2 pt-0.5">
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
                      className={`w-8 h-8 transition-colors ${
                        active
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-zinc-300 dark:text-zinc-700'
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
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-ink">
              Add a note <span className="text-ink-secondary font-normal">(Optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={isLender 
                ? `e.g. Prompt return, took great care of the gear!` 
                : `e.g. Gear was in excellent condition, smooth handoff!`}
              rows={3}
              className="w-full bg-canvas border border-divider rounded-2xl p-3 text-xs font-medium text-ink outline-none focus:border-brand resize-none placeholder:text-ink-secondary/50"
            />
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
