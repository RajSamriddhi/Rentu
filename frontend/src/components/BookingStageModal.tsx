import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Check, 
  Scan, 
  Clock, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Loader2, 
  Camera, 
  Sparkles, 
  MessageSquare, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle, 
  Copy,
  Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Booking } from '../lib/types';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { formatTime12 } from '../lib/formatters';

interface BookingStageModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedBooking: Booking) => void;
  onOpenChat?: (bookingId: string) => void;
  onLeaveReview?: (booking: Booking) => void;
}

function getHandoverWindowStatus(
  dateStr?: string, 
  timeStr?: string, 
  windowMinutes: number = 60
): {
  isAvailable: boolean;
  isBefore: boolean;
  isExpired: boolean;
  scheduledTimeFormatted: string;
  windowEndFormatted: string;
} {
  if (!dateStr) {
    return { isAvailable: true, isBefore: false, isExpired: false, scheduledTimeFormatted: '10:00 AM', windowEndFormatted: '11:00 AM' };
  }
  try {
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    const cleanTime = (timeStr && timeStr.trim()) ? timeStr.slice(0, 5) : '10:00';
    const [h, min] = cleanTime.split(':').map(Number);

    const scheduled = new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0, 0);
    const windowEnd = new Date(scheduled.getTime() + (windowMinutes * 60 * 1000));
    const now = new Date();

    const timeFormatted = scheduled.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const windowEndFormatted = windowEnd.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // The code only unlocks starting at the scheduled time!
    if (now.getTime() < scheduled.getTime()) {
      return {
        isAvailable: false,
        isBefore: true,
        isExpired: false,
        scheduledTimeFormatted: timeFormatted,
        windowEndFormatted: windowEndFormatted,
      };
    }

    // After 1 hour from start time, the window expires
    if (now.getTime() > windowEnd.getTime()) {
      return {
        isAvailable: false,
        isBefore: false,
        isExpired: true,
        scheduledTimeFormatted: timeFormatted,
        windowEndFormatted: windowEndFormatted,
      };
    }

    return {
      isAvailable: true,
      isBefore: false,
      isExpired: false,
      scheduledTimeFormatted: timeFormatted,
      windowEndFormatted: windowEndFormatted,
    };
  } catch {
    return { isAvailable: true, isBefore: false, isExpired: false, scheduledTimeFormatted: '10:00 AM', windowEndFormatted: '11:00 AM' };
  }
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

export const BookingStageModal: React.FC<BookingStageModalProps> = ({
  booking,
  isOpen,
  onClose,
  onUpdated,
  onOpenChat,
  onLeaveReview,
}) => {
  const { user } = useAuth();

  const [pickupCodeInput, setPickupCodeInput] = useState('');
  const [returnCodeInput, setReturnCodeInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isReturnActive, setIsReturnActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Reset transient errors/state when modal opens for a booking
    if (booking) {
      setErrorMessage('');
      setSuccessMessage('');
      setPickupCodeInput('');
      setReturnCodeInput('');
      setIsReturnActive(false);
      setShowCancelConfirm(false);
      setIsCancelling(false);
    }
  }, [booking?.id, isOpen]);

  const pickupWindow = getHandoverWindowStatus(booking?.start_date, booking?.start_time || '10:00', 60);

  // Auto-cancellation effect: If the pickup handover code was not provided within 1 hour of the start time
  useEffect(() => {
    if (booking && booking.status === 'ACCEPTED' && pickupWindow.isExpired && !booking.handed_over_at) {
      api.updateBookingStatus(booking.id, 'CANCELLED')
        .then((updated) => {
          onUpdated({ ...booking, ...updated, status: 'CANCELLED' });
        })
        .catch(() => {});
    }
  }, [booking?.id, booking?.status, pickupWindow.isExpired]);

  const handleCancelBooking = async () => {
    if (!booking) return;
    setIsCancelling(true);
    setErrorMessage('');
    try {
      const updated = await api.updateBookingStatus(booking.id, 'CANCELLED');
      setShowCancelConfirm(false);
      onUpdated({ ...booking, ...updated, status: 'CANCELLED' });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to cancel rental request.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (!isOpen || !booking) return null;

  const isLender = booking.lender_id === user?.id;
  const isBorrower = booking.borrower_id === user?.id;
  const otherPartyName = isLender ? (booking.borrower_name || 'Renter') : (booking.lender_name || 'Lender / Owner');

  const today = new Date();
  const currentDayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const returnWindow = getHandoverWindowStatus(booking.end_date || booking.start_date, booking.end_time || '18:00', 60);

  // Sequential 5-Stage computation
  let currentStage = 2; // Default for active ongoing booking awaiting pickup
  if (booking.status === 'COMPLETED' || booking.returned_at) {
    currentStage = 5;
  } else if (booking.status === 'HANDED_OVER') {
    // Stage 3 (Rental In-Use) remains ACTIVE while the return time has not arrived yet.
    // When scheduled return time arrives, it advances to Stage 4 (Return Handover).
    currentStage = (returnWindow.isBefore && !isReturnActive) ? 3 : 4;
  } else if (booking.status === 'ACCEPTED') {
    currentStage = 2;
  } else {
    currentStage = 1;
  }

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleStartCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
    }
  };

  const handleStopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Stage 2: Pickup Handover Verification
  const handleVerifyPickup = async (overrideCode?: string) => {
    const code = (overrideCode || pickupCodeInput).trim();
    if (!code) {
      setErrorMessage('Please enter the 6-digit pickup handover code received from the renter.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const updated = await api.verifyPickup(booking.id, code);
      handleStopCamera();
      try {
        confetti({ particleCount: 65, spread: 60, origin: { y: 0.6 } });
      } catch {}
      setSuccessMessage('Pickup handover confirmed. Rental period is now in use.');
      onUpdated({ ...booking, ...updated, status: 'HANDED_OVER', handed_over_at: new Date().toISOString() });
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect pickup code. Please check with the renter.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Stage 4: Return Handover Verification
  const handleVerifyReturn = async (overrideCode?: string) => {
    const code = (overrideCode || returnCodeInput).trim();
    if (!code) {
      setErrorMessage('Please enter the 6-digit return handover code received from the renter.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const updated = await api.verifyReturn(booking.id, code);
      handleStopCamera();
      try {
        confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
      } catch {}
      setSuccessMessage('Return handover verified. Proceeding to final payment settlement.');
      onUpdated({ ...booking, ...updated, returned_at: new Date().toISOString() });
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect return code. Please check with the other party.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Stage 5: Lender confirms receiving payment -> Booking completes
  const handleConfirmPayment = async () => {
    setIsVerifying(true);
    setErrorMessage('');
    try {
      const updated = await api.confirmBookingPayment(booking.id);
      try {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      } catch {}
      setSuccessMessage('Payment confirmed. The rental is completed.');
      onUpdated({ ...booking, ...updated, status: 'COMPLETED', payment_status: 'CONFIRMED' });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to confirm payment.');
    } finally {
      setIsVerifying(false);
    }
  };

  const stagesList = [
    { number: 1, title: 'Proposal Accepted', desc: 'Booking confirmed' },
    { number: 2, title: 'Pickup Handover', desc: 'Code exchange' },
    { number: 3, title: 'Rental In-Use', desc: 'Gear in use' },
    { number: 4, title: 'Return Handover', desc: 'Return code exchange' },
    { number: 5, title: 'Payment & Finish', desc: 'Take payment & finish' },
  ];

  // Fast standard QR rendering for pickup and return
  const pickupQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(`RENTU_PICKUP:${booking.id}:${booking.pickup_code || '123456'}`)}`;
  const returnQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(`RENTU_RETURN:${booking.id}:${booking.return_code || '654321'}`)}`;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div 
        className="bg-surface border border-divider rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-divider flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-3">
            <img
              src={booking.item_images?.[0] || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80'}
              alt={booking.item_title}
              className="w-10 h-10 rounded-xl object-cover border border-divider shadow-xs shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-ink text-sm sm:text-base font-display line-clamp-1">
                  {booking.item_title}
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-soft text-brand border border-brand/20">
                  Stage {currentStage} of 5
                </span>
              </div>
              <p className="text-[11px] text-ink-secondary">
                {isLender ? `Renting out to ${otherPartyName}` : `Renting from ${otherPartyName}`} • ₹{Number(booking.total_price)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenChat && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenChat(booking.id);
                }}
                className="p-2 rounded-full hover:bg-canvas text-ink-secondary hover:text-brand transition-colors cursor-pointer"
                title={`Chat with ${otherPartyName}`}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                handleStopCamera();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-canvas hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center text-ink-secondary transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 5-Stage Visual Stepper */}
        <div className="px-6 py-3 border-b border-divider bg-canvas/40 overflow-x-auto shrink-0">
          <div className="flex items-center justify-between min-w-[500px]">
            {stagesList.map((st, i) => {
              const isPast = currentStage > st.number;
              const isCurrent = currentStage === st.number;

              return (
                <div key={st.number} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center text-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      isPast
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : isCurrent
                        ? 'bg-brand text-white ring-4 ring-brand/20 shadow-pink'
                        : 'bg-canvas border border-divider text-ink-secondary/70'
                    }`}>
                      {isPast ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : st.number}
                    </div>
                    <span className={`text-[10px] font-bold mt-1 whitespace-nowrap ${
                      isCurrent ? 'text-brand font-black' : isPast ? 'text-ink' : 'text-ink-secondary'
                    }`}>
                      {st.title}
                    </span>
                  </div>

                  {i < stagesList.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-2 transition-all ${
                      currentStage > st.number ? 'bg-emerald-600' : 'bg-divider'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-600 dark:text-red-400 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Rental Period & Product Overview (Prominently visible across all stages) */}
          <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-2.5 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-divider/60">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand shrink-0" />
                <span className="font-extrabold text-ink">Rental Duration:</span>
                <span className="font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-md text-[11px] border border-brand/20">
                  {booking.duration_days || 1} {(booking.duration_days || 1) === 1 ? 'day' : 'days'}
                </span>
              </div>
              <span className="font-extrabold text-ink font-display">
                Total: {Number(booking.total_price) === 0 ? 'Free' : `₹${Number(booking.total_price)}`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
              <div className="flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold text-ink-secondary/70 uppercase tracking-wider block">Starts</span>
                  <span className="font-bold text-ink">
                    {formatFriendlyDate(booking.start_date)} {booking.start_time ? `• ${formatTime12(booking.start_time)}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold text-ink-secondary/70 uppercase tracking-wider block">Ends</span>
                  <span className="font-bold text-ink">
                    {formatFriendlyDate(booking.end_date || booking.start_date)} {booking.end_time ? `• ${formatTime12(booking.end_time)}` : ''}
                  </span>
                </div>
              </div>
            </div>

            {(booking.pickup_locality || booking.item_locality) && (
              <div className="pt-2 border-t border-divider/60 flex items-center gap-1.5 text-ink-secondary text-[11px]">
                <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                <span className="truncate">
                  Location: <span className="font-bold text-ink">{booking.pickup_locality || booking.item_locality}</span>
                </span>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* STAGE 1: PROPOSAL ACCEPTED (Already Completed)           */}
          {/* ======================================================== */}
          {currentStage === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-3xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <h4 className="font-extrabold text-sm font-display">Stage 1: Proposal Accepted & Confirmed</h4>
                </div>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Both parties have agreed on the booking dates and details. At the agreed start date and time, Stage 2 will activate where the renter shows their pickup code and the owner confirms it.
                </p>
              </div>

              {/* Cancellation Option for Stage 1 */}
              <div className="pt-3 border-t border-divider flex items-center justify-between bg-canvas/40 p-3 rounded-2xl">
                <span className="text-[11px] text-ink-secondary">Need to cancel before pickup?</span>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={isCancelling}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  <span>Cancel Request</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STAGE 2: PICKUP HANDOVER (RENTER CODE, OWNER INPUT)      */}
          {/* ======================================================== */}
          {currentStage === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-2 flex-wrap mb-1">
                  <span className="text-[11px] font-black uppercase text-brand tracking-wider bg-brand-soft px-2.5 py-0.5 rounded-full border border-brand/20">
                    Stage 2: Pickup Handover Verification
                  </span>
                  {pickupWindow.isExpired ? (
                    <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      1-Hour Window Expired (Auto-Cancelled)
                    </span>
                  ) : pickupWindow.isAvailable ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      1-Hour Window Active • {pickupWindow.scheduledTimeFormatted} - {pickupWindow.windowEndFormatted}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Locked Until {pickupWindow.scheduledTimeFormatted}
                    </span>
                  )}
                </div>
                <h4 className="text-base font-extrabold text-ink font-display">
                  {pickupWindow.isExpired
                    ? '1-Hour Pickup Window Expired'
                    : !pickupWindow.isAvailable
                    ? `Pickup Handover Opens at ${pickupWindow.scheduledTimeFormatted}`
                    : isBorrower
                    ? 'Give your 6-digit pickup code to the owner'
                    : 'Enter the pickup code received from the renter'}
                </h4>
                <p className="text-xs text-ink-secondary max-w-md mx-auto">
                  {pickupWindow.isExpired
                    ? 'The pickup code was not verified within 1 hour of the scheduled start time. This request has automatically cancelled.'
                    : !pickupWindow.isAvailable
                    ? `Pickup code and verification unlock strictly at ${pickupWindow.scheduledTimeFormatted} on ${formatFriendlyDate(booking.start_date)}.`
                    : isBorrower
                    ? `Share this code with ${otherPartyName} when you meet to collect the gear.`
                    : `Enter the 6-digit pickup code received from ${otherPartyName} to complete pickup handover.`}
                </p>
              </div>

              {/* TIMING WINDOW LOCK / EXPIRED: If expired or scheduled pickup time has not arrived yet */}
              {pickupWindow.isExpired ? (
                <div className="p-6 rounded-3xl bg-red-500/10 border border-red-500/20 text-center space-y-3 max-w-md mx-auto shadow-sm animate-in fade-in">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/20 text-red-500 flex items-center justify-center">
                    <Clock className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-extrabold text-red-500 font-display">
                      Handover Window Expired
                    </h4>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      The pickup handover code was not provided within 1 hour of the starting time ({pickupWindow.scheduledTimeFormatted} – {pickupWindow.windowEndFormatted}). This rental request has been automatically cancelled.
                    </p>
                  </div>
                </div>
              ) : !pickupWindow.isAvailable ? (
                isBorrower ? (
                  /* Renter View when locked */
                  <div className="p-6 rounded-3xl bg-canvas border border-divider text-center space-y-4 max-w-sm mx-auto shadow-sm">
                    <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shadow-xs">
                      <Lock className="w-9 h-9 stroke-[2]" />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                        Pickup Code Locked
                      </span>
                      <h4 className="text-base font-extrabold text-ink font-display">
                        Reveals at {pickupWindow.scheduledTimeFormatted}
                      </h4>
                      <p className="text-xs text-ink-secondary leading-relaxed">
                        Your 6-digit pickup handover code will be visible starting at <span className="font-bold text-ink">{pickupWindow.scheduledTimeFormatted}</span> on <span className="font-bold text-ink">{formatFriendlyDate(booking.start_date)}</span>.
                      </p>
                    </div>

                    <div className="p-3.5 bg-surface rounded-2xl border border-divider text-xs text-ink-secondary space-y-1.5 text-left">
                      <div className="flex items-center justify-between font-medium">
                        <span>1-Hour Pickup Window:</span>
                        <span className="font-bold text-brand">{pickupWindow.scheduledTimeFormatted} – {pickupWindow.windowEndFormatted}</span>
                      </div>
                      <div className="flex items-center justify-between font-medium">
                        <span>Pickup Location:</span>
                        <span className="font-bold text-ink truncate max-w-[170px]">
                          {booking.pickup_locality || booking.item_locality || 'Designated place'}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-ink-secondary flex items-center justify-center gap-1.5 pt-1">
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Meet {otherPartyName} at the scheduled time to complete handover.</span>
                    </div>
                  </div>
                ) : (
                  /* Owner View when locked */
                  <div className="p-6 rounded-3xl bg-canvas border border-divider space-y-4 max-w-md mx-auto text-center shadow-sm">
                    <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shadow-xs">
                      <Lock className="w-9 h-9 stroke-[2]" />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                        Pickup Verification Locked
                      </span>
                      <h4 className="text-base font-extrabold text-ink font-display">
                        Opens at {pickupWindow.scheduledTimeFormatted}
                      </h4>
                      <p className="text-xs text-ink-secondary leading-relaxed">
                        Pickup code entry and QR verification will unlock at <span className="font-bold text-ink">{pickupWindow.scheduledTimeFormatted}</span> on <span className="font-bold text-ink">{formatFriendlyDate(booking.start_date)}</span>.
                      </p>
                    </div>

                    <div className="p-3.5 bg-surface rounded-2xl border border-divider text-xs text-ink-secondary space-y-1.5 text-left">
                      <div className="flex items-center justify-between font-medium">
                        <span>1-Hour Verification Window:</span>
                        <span className="font-bold text-brand">{pickupWindow.scheduledTimeFormatted} – {pickupWindow.windowEndFormatted}</span>
                      </div>
                      <div className="flex items-center justify-between font-medium">
                        <span>Pickup Location:</span>
                        <span className="font-bold text-ink truncate max-w-[200px]">
                          {booking.pickup_locality || booking.item_locality || 'Designated place'}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>Verification opens when the scheduled meetup time arrives in the present.</span>
                    </div>
                  </div>
                )
              ) : isBorrower ? (
                /* RENTER (BORROWER) VIEW: SHOWS PICKUP CODE */
                <div className="p-6 rounded-3xl bg-canvas border border-divider text-center space-y-4 max-w-sm mx-auto shadow-sm">
                  <div className="w-52 h-52 mx-auto rounded-2xl bg-white p-3 shadow-md border border-zinc-200 flex items-center justify-center">
                    <img
                      src={pickupQrUrl}
                      alt="Pickup Handover QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-ink-secondary block">
                      Your 6-Digit Pickup Code:
                    </span>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono text-2xl font-black tracking-widest text-brand bg-surface px-5 py-2 rounded-xl border border-brand/30 shadow-xs">
                        {booking.pickup_code || '123456'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(booking.pickup_code || '123456')}
                        className="p-2.5 rounded-xl bg-surface border border-divider text-ink-secondary hover:text-brand transition-colors cursor-pointer"
                        title="Copy code"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    {isCopied && <span className="text-[10px] font-bold text-emerald-500 block">Copied to clipboard</span>}
                  </div>

                  <div className="text-[11px] text-ink-secondary flex items-center justify-center gap-1.5 pt-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Give this code to {otherPartyName} upon receiving the item</span>
                  </div>
                </div>
              ) : (
                /* OWNER (LENDER) VIEW: INPUT CODE FROM RENTER */
                <div className="p-5 rounded-3xl bg-canvas border border-divider space-y-4 max-w-md mx-auto text-center">
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-ink block">
                      Enter 6-Digit Pickup Code received from {otherPartyName}:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={pickupCodeInput}
                        onChange={(e) => setPickupCodeInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 6-digit code"
                        className="bg-surface border border-divider rounded-xl px-4 py-2.5 text-center font-mono text-lg font-black tracking-widest text-ink outline-none focus:border-brand flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleVerifyPickup()}
                        disabled={isVerifying}
                        className="btn-primary text-xs px-5 py-3 font-bold shadow-pink cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                      >
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                        <span>Confirm Pickup</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-ink-secondary pt-1">
                      Ask {otherPartyName} to check their ongoing bookings page for their 6-digit pickup code.
                    </p>
                  </div>

                  {/* Camera Scanner Alternative */}
                  <div className="pt-2 border-t border-divider">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={isCameraActive ? handleStopCamera : handleStartCamera}
                        className="btn-secondary text-xs px-3.5 py-1.5 font-bold cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5 text-brand" />
                        <span>{isCameraActive ? 'Close Camera' : 'Scan Renter QR Code'}</span>
                      </button>
                    </div>

                    {isCameraActive && (
                      <div className="mt-3 relative aspect-video w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-zinc-800">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-brand shadow-[0_0_8px_#ff007a]" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cancellation Option for Stage 2: Both renter and lender can cancel before pickup handover verification */}
              {!pickupWindow.isExpired && (
                <div className="pt-3 border-t border-divider flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-canvas/40 p-3.5 rounded-2xl">
                  <div className="text-[11px] text-ink-secondary text-center sm:text-left">
                    Need to cancel this rental request before pickup handover?
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={isCancelling}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                  >
                    {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    <span>Cancel Rental Request</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* STAGE 3: RENTAL IN-USE                                  */}
          {/* ======================================================== */}
          {currentStage === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-3xl bg-blue-500/10 border border-blue-500/20 space-y-2 text-center">
                <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                  Stage 3: Rental Period Active
                </span>
                <h4 className="text-base font-extrabold text-ink font-display">
                  Product is currently with {isLender ? (booking.borrower_name || 'Renter') : 'you'}
                </h4>
                <p className="text-xs text-ink-secondary max-w-md mx-auto">
                  {isBorrower
                    ? 'Enjoy using the gear! Make sure to treat it with care and return it before the deadline.'
                    : `Gear handed over successfully. ${otherPartyName} is using it until the return deadline.`}
                </p>
                <div className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1.5 pt-1 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Pickup handover verified. Rental in progress from Stage 3 to Stage 5.</span>
                </div>
              </div>

              {/* Active countdown card */}
              <div className="p-5 rounded-2xl bg-canvas border border-divider space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-brand" />
                    <span>Return Deadline:</span>
                  </span>
                  <span className="text-xs font-black text-brand font-display">
                    {formatFriendlyDate(booking.end_date || booking.start_date)} ({formatTime12(booking.end_time || '18:00')})
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-divider">
                  <span className="font-bold text-ink flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-brand" />
                    <span>Return Location:</span>
                  </span>
                  <span className="font-medium text-ink-secondary text-right truncate max-w-[220px]">
                    {booking.return_locality || booking.item_locality || 'Agreed Location'}
                  </span>
                </div>
              </div>

              {/* Action Button to advance to return handover early */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsReturnActive(true)}
                  className="w-full btn-secondary text-xs py-2.5 font-bold cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <span>Ready to Return? Open Return Handover (Stage 4)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STAGE 4: RETURN HANDOVER (LENDER GIVES CODE/QR TO RENTER) */}
          {/* ======================================================== */}
          {currentStage === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                    Stage 4: Return Handover Verification
                  </span>
                  {returnWindow.isAvailable ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      1-Hour Window Active • {returnWindow.scheduledTimeFormatted} - {returnWindow.windowEndFormatted}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20 inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Locked Until {returnWindow.scheduledTimeFormatted}
                    </span>
                  )}
                </div>
                <h4 className="text-base font-extrabold text-ink font-display">
                  {!returnWindow.isAvailable
                    ? `Return Handover Opens at ${returnWindow.scheduledTimeFormatted}`
                    : isLender
                    ? `Give the return code or QR to ${otherPartyName}`
                    : `Enter the return code received from ${otherPartyName}`}
                </h4>
                <p className="text-xs text-ink-secondary max-w-md mx-auto">
                  {!returnWindow.isAvailable
                    ? `Return code and verification unlock strictly at ${returnWindow.scheduledTimeFormatted} on ${formatFriendlyDate(booking.end_date || booking.start_date)}.`
                    : isLender
                    ? `Show this return code or QR to ${otherPartyName} once you have picked back your gear in good condition.`
                    : `Enter the 6-digit return code or scan the QR code received from ${otherPartyName} to confirm return.`}
                </p>
              </div>

              {/* TIMING WINDOW LOCK: If scheduled return time has not arrived yet */}
              {!returnWindow.isAvailable ? (
                isLender ? (
                  /* Owner View when return locked */
                  <div className="p-6 rounded-3xl bg-canvas border border-divider text-center space-y-4 max-w-sm mx-auto shadow-sm">
                    <div className="w-20 h-20 mx-auto rounded-3xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shadow-xs">
                      <Lock className="w-9 h-9 stroke-[2]" />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                        Return Code Locked
                      </span>
                      <h4 className="text-base font-extrabold text-ink font-display">
                        Reveals at {returnWindow.scheduledTimeFormatted}
                      </h4>
                      <p className="text-xs text-ink-secondary leading-relaxed">
                        Your 6-digit return code and QR will be visible starting at <span className="font-bold text-ink">{returnWindow.scheduledTimeFormatted}</span> on <span className="font-bold text-ink">{formatFriendlyDate(booking.end_date || booking.start_date)}</span>.
                      </p>
                    </div>

                    <div className="p-3.5 bg-surface rounded-2xl border border-divider text-xs text-ink-secondary space-y-1.5 text-left">
                      <div className="flex items-center justify-between font-medium">
                        <span>1-Hour Return Window:</span>
                        <span className="font-bold text-brand">{returnWindow.scheduledTimeFormatted} – {returnWindow.windowEndFormatted}</span>
                      </div>
                      <div className="flex items-center justify-between font-medium">
                        <span>Return Location:</span>
                        <span className="font-bold text-ink truncate max-w-[170px]">
                          {booking.return_locality || booking.item_locality || 'Designated place'}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-ink-secondary flex items-center justify-center gap-1.5 pt-1">
                      <Clock className="w-4 h-4 text-purple-500 shrink-0" />
                      <span>Pick back the gear from {otherPartyName} at the scheduled time to complete return.</span>
                    </div>
                  </div>
                ) : (
                  /* Renter View when return locked */
                  <div className="p-6 rounded-3xl bg-canvas border border-divider space-y-4 max-w-md mx-auto text-center shadow-sm">
                    <div className="w-20 h-20 mx-auto rounded-3xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shadow-xs">
                      <Lock className="w-9 h-9 stroke-[2]" />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                        Return Verification Locked
                      </span>
                      <h4 className="text-base font-extrabold text-ink font-display">
                        Opens at {returnWindow.scheduledTimeFormatted}
                      </h4>
                      <p className="text-xs text-ink-secondary leading-relaxed">
                        Return code entry and QR verification will unlock at <span className="font-bold text-ink">{returnWindow.scheduledTimeFormatted}</span> on <span className="font-bold text-ink">{formatFriendlyDate(booking.end_date || booking.start_date)}</span>.
                      </p>
                    </div>

                    <div className="p-3.5 bg-surface rounded-2xl border border-divider text-xs text-ink-secondary space-y-1.5 text-left">
                      <div className="flex items-center justify-between font-medium">
                        <span>1-Hour Verification Window:</span>
                        <span className="font-bold text-brand">{returnWindow.scheduledTimeFormatted} – {returnWindow.windowEndFormatted}</span>
                      </div>
                      <div className="flex items-center justify-between font-medium">
                        <span>Return Location:</span>
                        <span className="font-bold text-ink truncate max-w-[200px]">
                          {booking.return_locality || booking.item_locality || 'Designated place'}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>Verification opens when the return handover time arrives in the present.</span>
                    </div>
                  </div>
                )
              ) : isLender ? (
                /* OWNER (LENDER) VIEW: PROVIDES CODE OR QR TO RENTER */
                <div className="p-6 rounded-3xl bg-canvas border border-divider text-center space-y-4 max-w-sm mx-auto shadow-sm">
                  <div className="w-52 h-52 mx-auto rounded-2xl bg-white p-3 shadow-md border border-zinc-200 flex items-center justify-center">
                    <img
                      src={returnQrUrl}
                      alt="Return Handover QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-ink-secondary block">
                      Your 6-Digit Return Code:
                    </span>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono text-2xl font-black tracking-widest text-purple-600 dark:text-purple-400 bg-surface px-5 py-2 rounded-xl border border-purple-500/30 shadow-xs">
                        {booking.return_code || '------'}
                      </span>
                      {booking.return_code && (
                        <button
                          type="button"
                          onClick={() => handleCopy(booking.return_code || '')}
                          className="p-2.5 rounded-xl bg-surface border border-divider text-ink-secondary hover:text-brand transition-colors cursor-pointer"
                          title="Copy return code"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {isCopied && <span className="text-[10px] font-bold text-emerald-500 block">Copied to clipboard</span>}
                  </div>

                  <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] font-medium text-purple-700 dark:text-purple-300">
                    Show this code or QR to {otherPartyName} once you have picked back your product in good condition.
                  </div>
                </div>
              ) : (
                /* RENTER (BORROWER) VIEW: INPUTS CODE RECEIVED FROM LENDER / SCANS QR */
                <div className="p-5 rounded-3xl bg-canvas border border-divider space-y-4 max-w-md mx-auto text-center">
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-ink block">
                      Enter 6-Digit Return Code received from {otherPartyName}:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={returnCodeInput}
                        onChange={(e) => setReturnCodeInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 6-digit code"
                        className="bg-surface border border-divider rounded-xl px-4 py-2.5 text-center font-mono text-lg font-black tracking-widest text-ink outline-none focus:border-brand flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleVerifyReturn()}
                        disabled={isVerifying}
                        className="btn-primary text-xs px-5 py-3 font-bold shadow-pink cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                      >
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                        <span>Confirm Return</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-ink-secondary pt-1">
                      Ask {otherPartyName} for their 6-digit return code or scan their QR code to verify return.
                    </p>
                  </div>

                  {/* Camera Scanner Alternative */}
                  <div className="pt-2 border-t border-divider">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={isCameraActive ? handleStopCamera : handleStartCamera}
                        className="btn-secondary text-xs px-3.5 py-1.5 font-bold cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5 text-brand" />
                        <span>{isCameraActive ? 'Close Camera' : 'Scan Lender QR Code'}</span>
                      </button>
                    </div>

                    {isCameraActive && (
                      <div className="mt-3 relative aspect-video w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-zinc-800">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-brand shadow-[0_0_8px_#ff007a]" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* STAGE 5: PAYMENT & FINISH                                */}
          {/* ======================================================== */}
          {currentStage === 5 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center space-y-1">
                <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  Stage 5: Payment & Finish
                </span>
                <h4 className="text-base font-extrabold text-ink font-display">
                  {isLender
                    ? `Collect your money from ${otherPartyName} and complete the process`
                    : `Give ₹${Number(booking.total_price)} to ${otherPartyName} and finish the payment`}
                </h4>
                <p className="text-xs text-ink-secondary max-w-md mx-auto">
                  {isLender
                    ? `Product return has been verified. Collect ₹${Number(booking.total_price)} directly from ${otherPartyName} to complete the rental process.`
                    : `Product return has been verified. Give ₹${Number(booking.total_price)} directly to ${otherPartyName} to finish the payment.`}
                </p>
              </div>

              {/* Total Rental Amount Card */}
              <div className="p-5 rounded-2xl bg-canvas border border-divider text-center space-y-1.5 max-w-sm mx-auto shadow-xs">
                <span className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider block">
                  {isLender ? 'Amount to Collect' : 'Amount to Pay'}
                </span>
                <div className="text-3xl font-black text-ink font-display">
                  {Number(booking.total_price) === 0 ? 'Free (Community Borrow)' : `₹${Number(booking.total_price)}`}
                </div>
                <div className="text-[11px] text-ink-secondary">
                  {booking.duration_days} {booking.duration_days === 1 ? 'day' : 'days'} rental
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2 max-w-md mx-auto">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <h5 className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200 font-display">
                  Return Verified Successfully
                </h5>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  {isLender
                    ? `The product has been picked back and verified. Collect ₹${Number(booking.total_price)} directly from ${otherPartyName} to complete the process.`
                    : `The product has been returned and verified. Hand over ₹${Number(booking.total_price)} directly to ${otherPartyName} to finish the payment.`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-divider bg-surface shrink-0 flex items-center justify-between text-xs text-ink-secondary">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink">Booking ID:</span>
            <span className="font-mono text-[11px]">{booking.id.slice(0, 8)}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              handleStopCamera();
              onClose();
            }}
            className="btn-secondary text-xs px-4 py-1.5 font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Dialog for Cancellation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface border border-divider rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-ink">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-ink font-display">
                  Cancel Rental Request?
                </h4>
                <p className="text-[11px] text-ink-secondary">
                  Release booking before pickup handover
                </p>
              </div>
            </div>

            <p className="text-xs text-ink-secondary leading-relaxed">
              Are you sure you want to cancel this rental request for <strong className="text-ink">{booking.item_title}</strong>? The product will be released and {otherPartyName} will be notified immediately.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                disabled={isCancelling}
                className="btn-secondary text-xs px-4 py-2 font-bold cursor-pointer"
              >
                Keep Rental
              </button>
              <button
                type="button"
                onClick={handleCancelBooking}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              >
                {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Yes, Cancel Rental</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
