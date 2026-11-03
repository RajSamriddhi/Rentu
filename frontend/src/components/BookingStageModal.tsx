import React, { useState, useRef, useEffect, useMemo } from 'react';
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

/**
 * Return Handover has NO time limit once the return time starts.
 * Whenever the lender gives the code to the renter and the renter inputs it, it always works.
 */
function getReturnHandoverStatus(
  dateStr?: string, 
  timeStr?: string
): {
  isAvailable: boolean;
  isBefore: boolean;
  scheduledTimeFormatted: string;
} {
  if (!dateStr) {
    return { isAvailable: true, isBefore: false, scheduledTimeFormatted: '06:00 PM' };
  }
  try {
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    const cleanTime = (timeStr && timeStr.trim()) ? timeStr.slice(0, 5) : '18:00';
    const [h, min] = cleanTime.split(':').map(Number);

    const scheduled = new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0, 0);
    const now = new Date();
    const timeFormatted = formatTime12(cleanTime);

    // If current time is strictly before the scheduled return time
    if (now.getTime() < scheduled.getTime()) {
      return {
        isAvailable: false,
        isBefore: true,
        scheduledTimeFormatted: timeFormatted,
      };
    }

    // Once return time arrives (e.g. 3:00 PM), there is NO expiration / NO time limit.
    return {
      isAvailable: true,
      isBefore: false,
      scheduledTimeFormatted: timeFormatted,
    };
  } catch {
    return { isAvailable: true, isBefore: false, scheduledTimeFormatted: '06:00 PM' };
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
  const [showQrModal, setShowQrModal] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Live real-time tick every second when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

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
      setShowQrModal(false);
    }
  }, [booking?.id, isOpen]);

  // Live pickup window calculations with countdown timer
  const pickupTiming = useMemo(() => {
    if (!booking?.start_date) {
      return {
        isAvailable: true,
        isBefore: false,
        isExpired: false,
        scheduledFormatted: '10:00 AM',
        windowEndFormatted: '11:00 AM',
        secondsUntilStart: 0,
        secondsRemaining: 0,
        countdownUntilStart: '0m 00s',
        countdownRemaining: '0m 00s',
      };
    }
    try {
      const [y, m, d] = booking.start_date.slice(0, 10).split('-').map(Number);
      const cleanTime = (booking.start_time && booking.start_time.trim()) ? booking.start_time.slice(0, 5) : '10:00';
      const [h, min] = cleanTime.split(':').map(Number);
      const scheduled = new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0, 0);
      const windowEnd = new Date(scheduled.getTime() + 60 * 60 * 1000); // 1-hour window
      const nowMs = now.getTime();
      const schedMs = scheduled.getTime();
      const endMs = windowEnd.getTime();

      const isBefore = nowMs < schedMs;
      const isExpired = nowMs >= endMs;
      const isAvailable = !isBefore && !isExpired;

      const secondsUntilStart = Math.max(0, Math.floor((schedMs - nowMs) / 1000));
      const secondsRemaining = Math.max(0, Math.floor((endMs - nowMs) / 1000));

      const formatTimer = (totalSec: number) => {
        const hours = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        if (hours > 0) {
          return `${hours}h ${pad(mins)}m ${pad(secs)}s`;
        }
        return `${mins}m ${pad(secs)}s`;
      };

      const scheduledFormatted = formatTime12(cleanTime);
      const endClean = `${String(windowEnd.getHours()).padStart(2, '0')}:${String(windowEnd.getMinutes()).padStart(2, '0')}`;
      const windowEndFormatted = formatTime12(endClean);

      return {
        isAvailable,
        isBefore,
        isExpired,
        scheduledFormatted,
        windowEndFormatted,
        secondsUntilStart,
        secondsRemaining,
        countdownUntilStart: formatTimer(secondsUntilStart),
        countdownRemaining: formatTimer(secondsRemaining),
      };
    } catch {
      return {
        isAvailable: true,
        isBefore: false,
        isExpired: false,
        scheduledFormatted: '10:00 AM',
        windowEndFormatted: '11:00 AM',
        secondsUntilStart: 0,
        secondsRemaining: 0,
        countdownUntilStart: '0m 00s',
        countdownRemaining: '0m 00s',
      };
    }
  }, [booking?.start_date, booking?.start_time, now]);

  // Auto-cancellation effect: If the pickup handover code was not provided within 1 hour of the start time
  useEffect(() => {
    if (booking && booking.status === 'ACCEPTED' && pickupTiming.isExpired && !booking.handed_over_at) {
      api.updateBookingStatus(booking.id, 'CANCELLED')
        .then((updated) => {
          onUpdated({ ...booking, ...updated, status: 'CANCELLED' });
        })
        .catch(() => {});
    }
  }, [booking?.id, booking?.status, pickupTiming.isExpired]);

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

  const returnWindow = getReturnHandoverStatus(booking.end_date || booking.start_date, booking.end_time || '18:00');

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

        {/* 5-Stage Visual Stepper (Mobile Optimized: no horizontal overflow) */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-divider bg-canvas/40 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center justify-between w-full min-w-0 gap-0.5 sm:gap-1">
            {stagesList.map((st, i) => {
              const isPast = currentStage > st.number;
              const isCurrent = currentStage === st.number;
              const shortTitles = ['Accepted', 'Pickup', 'In-Use', 'Return', 'Finish'];
              const displayTitle = shortTitles[i] || st.title;

              return (
                <div key={st.number} className="flex items-center flex-1 last:flex-none min-w-0">
                  <div className="flex flex-col items-center text-center mx-auto min-w-0">
                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black transition-all shrink-0 ${
                      isPast
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : isCurrent
                        ? 'bg-brand text-white ring-2 sm:ring-4 ring-brand/20 shadow-pink'
                        : 'bg-canvas border border-divider text-ink-secondary/70'
                    }`}>
                      {isPast ? <Check className="w-3 h-3 stroke-[3]" /> : st.number}
                    </div>
                    <span className={`text-[9px] sm:text-[10px] font-bold mt-1 tracking-tight truncate max-w-[55px] sm:max-w-none ${
                      isCurrent ? 'text-brand font-black' : isPast ? 'text-ink' : 'text-ink-secondary'
                    }`}>
                      <span className="sm:hidden">{displayTitle}</span>
                      <span className="hidden sm:inline">{st.title}</span>
                    </span>
                  </div>

                  {i < stagesList.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 sm:mx-2 transition-all min-w-[8px] ${
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
              {pickupTiming.isExpired ? (
                /* EXPIRED */
                <div className="p-6 rounded-3xl bg-red-500/10 border border-red-500/20 text-center space-y-3 max-w-md mx-auto shadow-xs">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/20 text-red-500 flex items-center justify-center">
                    <Clock className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-black text-red-500 font-display">
                      Handover Window Expired
                    </h4>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      The 1-hour pickup window ({pickupTiming.scheduledFormatted} – {pickupTiming.windowEndFormatted}) has passed without code verification. This booking has been automatically cancelled.
                    </p>
                  </div>
                </div>
              ) : pickupTiming.isBefore ? (
                /* LOCKED (Meetup time not arrived yet) */
                <div className="p-6 rounded-3xl bg-canvas border border-divider text-center space-y-4 max-w-md mx-auto shadow-xs">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shadow-xs">
                    <Lock className="w-7 h-7 stroke-[2]" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-black">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Opens in {pickupTiming.countdownUntilStart}</span>
                    </div>

                    <h4 className="text-lg font-black text-ink font-display pt-1">
                      Pickup Handover Opens at {pickupTiming.scheduledFormatted}
                    </h4>

                    <p className="text-xs text-ink-secondary max-w-sm mx-auto leading-relaxed">
                      {isBorrower
                        ? `Meet ${otherPartyName} at the scheduled time. Your 6-digit pickup code will unlock here at ${pickupTiming.scheduledFormatted}.`
                        : `Meet ${otherPartyName} at the scheduled time. Code entry will unlock here at ${pickupTiming.scheduledFormatted} to verify handover.`}
                    </p>
                  </div>

                  <div className="p-3.5 bg-surface rounded-2xl border border-divider text-xs space-y-1.5 text-left">
                    <div className="flex items-center justify-between font-medium text-ink-secondary">
                      <span>1-Hour Verification Window:</span>
                      <span className="font-bold text-ink">{pickupTiming.scheduledFormatted} – {pickupTiming.windowEndFormatted}</span>
                    </div>
                    {(booking.pickup_locality || booking.item_locality) && (
                      <div className="flex items-center justify-between font-medium text-ink-secondary">
                        <span>Pickup Location:</span>
                        <span className="font-bold text-ink truncate max-w-[200px]">
                          {booking.pickup_locality || booking.item_locality}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : isBorrower ? (
                /* ACTIVE - RENTER VIEW: SHOWS CODE TO OWNER */
                <div className="p-6 rounded-3xl bg-canvas border border-divider text-center space-y-4 max-w-md mx-auto shadow-xs">
                  {/* Live Countdown Timer */}
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-xs font-black shadow-xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{pickupTiming.countdownRemaining} left to complete handover</span>
                  </div>

                  <div>
                    <h4 className="text-lg font-black text-ink font-display">
                      Show this code to {otherPartyName}
                    </h4>
                    <p className="text-xs text-ink-secondary max-w-xs mx-auto mt-0.5">
                      Share this 6-digit code upon receiving the gear to verify handover.
                    </p>
                  </div>

                  {/* 6-Digit Code */}
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-3xl font-black tracking-widest text-brand bg-surface px-6 py-3 rounded-2xl border border-brand/30 shadow-pink">
                      {booking.pickup_code || '123456'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(booking.pickup_code || '123456')}
                      className="p-3.5 rounded-2xl bg-surface border border-divider text-ink-secondary hover:text-brand transition-colors cursor-pointer"
                      title="Copy pickup code"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  {isCopied && <span className="text-[11px] font-bold text-emerald-500 block">Copied to clipboard!</span>}

                  {/* QR Option Toggle */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowQrModal(!showQrModal)}
                      className="text-xs font-bold text-ink-secondary hover:text-brand inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Scan className="w-3.5 h-3.5" />
                      <span>{showQrModal ? 'Hide QR Code' : 'Or show QR code'}</span>
                    </button>

                    {showQrModal && (
                      <div className="w-48 h-48 mx-auto mt-3 rounded-2xl bg-white p-2.5 shadow-md border border-zinc-200 flex items-center justify-center animate-in zoom-in-95">
                        <img src={pickupQrUrl} alt="Pickup Handover QR" className="w-full h-full object-contain" />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ACTIVE - OWNER VIEW: INPUT CODE FROM RENTER */
                <div className="p-6 rounded-3xl bg-canvas border border-divider text-center space-y-4 max-w-md mx-auto shadow-xs">
                  {/* Live Countdown Timer */}
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-xs font-black shadow-xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{pickupTiming.countdownRemaining} left to enter code</span>
                  </div>

                  <div>
                    <h4 className="text-lg font-black text-ink font-display">
                      Enter pickup code from {otherPartyName}
                    </h4>
                    <p className="text-xs text-ink-secondary max-w-xs mx-auto mt-0.5">
                      Ask {otherPartyName} for their 6-digit code shown on their Rentu screen.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 max-w-sm mx-auto">
                    <input
                      type="text"
                      maxLength={6}
                      value={pickupCodeInput}
                      onChange={(e) => setPickupCodeInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit code"
                      className="bg-surface border border-divider rounded-2xl px-4 py-3 text-center font-mono text-xl font-black tracking-widest text-ink outline-none focus:border-brand flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyPickup()}
                      disabled={isVerifying || pickupCodeInput.length !== 6}
                      className="btn-primary text-xs px-5 py-3.5 font-bold shadow-pink cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                    >
                      {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                      <span>Confirm</span>
                    </button>
                  </div>

                  {/* Camera Scanner Alternative */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={isCameraActive ? handleStopCamera : handleStartCamera}
                      className="text-xs font-bold text-ink-secondary hover:text-brand inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-brand" />
                      <span>{isCameraActive ? 'Close Camera' : 'Or scan renter QR code'}</span>
                    </button>

                    {isCameraActive && (
                      <div className="mt-3 relative aspect-video w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-zinc-800">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-brand shadow-[0_0_8px_#ff007a]" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cancellation Option for Stage 2 */}
              {!pickupTiming.isExpired && (
                <div className="pt-2 flex items-center justify-between text-xs text-ink-secondary max-w-md mx-auto">
                  <span>Need to cancel before pickup?</span>
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={isCancelling}
                    className="text-red-500 hover:text-red-600 hover:underline font-bold cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <span>Cancel Request</span>
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
              {!returnWindow.isAvailable ? (
                /* LOCKED (Return time has not arrived yet) */
                <div className="p-6 rounded-3xl bg-canvas border border-divider text-center space-y-4 max-w-md mx-auto shadow-xs">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shadow-xs">
                    <Lock className="w-7 h-7 stroke-[2]" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-xs font-black">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Starts at {returnWindow.scheduledTimeFormatted}</span>
                    </div>

                    <h4 className="text-lg font-black text-ink font-display pt-1">
                      Return Handover Opens at {returnWindow.scheduledTimeFormatted}
                    </h4>

                    <p className="text-xs text-ink-secondary max-w-sm mx-auto leading-relaxed">
                      {isLender
                        ? `Meet ${otherPartyName} at the scheduled time. Your 6-digit return code and QR will unlock here at ${returnWindow.scheduledTimeFormatted}.`
                        : `Meet ${otherPartyName} at the scheduled time. Code entry will unlock here at ${returnWindow.scheduledTimeFormatted} to verify return.`}
                    </p>
                  </div>

                  <div className="p-3.5 bg-surface rounded-2xl border border-divider text-xs space-y-1.5 text-left">
                    <div className="flex items-center justify-between font-medium text-ink-secondary">
                      <span>Scheduled Return Time:</span>
                      <span className="font-bold text-ink">Starts at {returnWindow.scheduledTimeFormatted} (No time limit)</span>
                    </div>
                    {(booking.return_locality || booking.item_locality) && (
                      <div className="flex items-center justify-between font-medium text-ink-secondary">
                        <span>Return Location:</span>
                        <span className="font-bold text-ink truncate max-w-[200px]">
                          {booking.return_locality || booking.item_locality}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : isLender ? (
                /* ACTIVE - OWNER (LENDER) VIEW: PROVIDES CODE OR QR TO RENTER */
                <div className="p-6 rounded-3xl bg-canvas border border-divider text-center space-y-4 max-w-md mx-auto shadow-xs">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/25 text-xs font-black shadow-xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                    </span>
                    <span>Return Handover Active • No Time Limit</span>
                  </div>

                  <div>
                    <h4 className="text-lg font-black text-ink font-display">
                      Show this return code to {otherPartyName}
                    </h4>
                    <p className="text-xs text-ink-secondary max-w-xs mx-auto mt-0.5">
                      Once you have received your product back in good condition, show this code to {otherPartyName}.
                    </p>
                  </div>

                  {/* 6-Digit Code */}
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-3xl font-black tracking-widest text-purple-600 dark:text-purple-400 bg-surface px-6 py-3 rounded-2xl border border-purple-500/30 shadow-xs">
                      {booking.return_code || '------'}
                    </span>
                    {booking.return_code && (
                      <button
                        type="button"
                        onClick={() => handleCopy(booking.return_code || '')}
                        className="p-3.5 rounded-2xl bg-surface border border-divider text-ink-secondary hover:text-brand transition-colors cursor-pointer"
                        title="Copy return code"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {isCopied && <span className="text-[11px] font-bold text-emerald-500 block">Copied to clipboard!</span>}

                  {/* Return QR Code */}
                  <div className="w-44 h-44 mx-auto rounded-2xl bg-white p-2.5 shadow-md border border-zinc-200 flex items-center justify-center">
                    <img
                      src={returnQrUrl}
                      alt="Return Handover QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ) : (
                /* ACTIVE - RENTER VIEW: INPUTS CODE RECEIVED FROM LENDER / SCANS QR */
                <div className="p-6 rounded-3xl bg-canvas border border-divider text-center space-y-4 max-w-md mx-auto shadow-xs">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/25 text-xs font-black shadow-xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                    </span>
                    <span>Return Handover Active • No Time Limit</span>
                  </div>

                  <div>
                    <h4 className="text-lg font-black text-ink font-display">
                      Enter return code from {otherPartyName}
                    </h4>
                    <p className="text-xs text-ink-secondary max-w-xs mx-auto mt-0.5">
                      Hand back the product to {otherPartyName} and enter their 6-digit return code below.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 max-w-sm mx-auto">
                    <input
                      type="text"
                      maxLength={6}
                      value={returnCodeInput}
                      onChange={(e) => setReturnCodeInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit return code"
                      className="bg-surface border border-divider rounded-2xl px-4 py-3 text-center font-mono text-xl font-black tracking-widest text-ink outline-none focus:border-brand flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyReturn()}
                      disabled={isVerifying || returnCodeInput.length !== 6}
                      className="btn-primary text-xs px-5 py-3.5 font-bold shadow-pink cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                    >
                      {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                      <span>Confirm Return</span>
                    </button>
                  </div>

                  {/* Camera Scanner Alternative */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={isCameraActive ? handleStopCamera : handleStartCamera}
                      className="text-xs font-bold text-ink-secondary hover:text-brand inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-brand" />
                      <span>{isCameraActive ? 'Close Camera' : 'Or scan owner QR code'}</span>
                    </button>

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
