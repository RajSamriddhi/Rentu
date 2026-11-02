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
  scheduledTimeFormatted: string;
  windowEndFormatted: string;
} {
  if (!dateStr) {
    return { isAvailable: true, isBefore: false, scheduledTimeFormatted: '10:00 AM', windowEndFormatted: '11:00 AM' };
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
        scheduledTimeFormatted: timeFormatted,
        windowEndFormatted: windowEndFormatted,
      };
    }

    return {
      isAvailable: true,
      isBefore: false,
      scheduledTimeFormatted: timeFormatted,
      windowEndFormatted: windowEndFormatted,
    };
  } catch {
    return { isAvailable: true, isBefore: false, scheduledTimeFormatted: '10:00 AM', windowEndFormatted: '11:00 AM' };
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
    }
  }, [booking?.id, isOpen]);

  if (!isOpen || !booking) return null;

  const isLender = booking.lender_id === user?.id;
  const isBorrower = booking.borrower_id === user?.id;
  const otherPartyName = isLender ? (booking.borrower_name || 'Renter') : (booking.lender_name || 'Lender / Owner');

  const today = new Date();
  const currentDayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const pickupWindow = getHandoverWindowStatus(booking.start_date, booking.start_time || '10:00', 60);
  const returnWindow = getHandoverWindowStatus(booking.end_date || booking.start_date, booking.end_time || '18:00', 60);

  // Sequential 5-Stage computation
  let currentStage = 2; // Default for active ongoing booking awaiting pickup
  if (booking.status === 'COMPLETED') {
    currentStage = 5;
  } else if (booking.returned_at) {
    currentStage = 5;
  } else if (booking.status === 'HANDED_OVER') {
    const endStr = (booking.end_date || booking.start_date || '').slice(0, 10);
    const isDeadlineReached = endStr && endStr <= currentDayStr;
    currentStage = (isDeadlineReached || isReturnActive || returnWindow.isAvailable) ? 4 : 3;
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
    const code = overrideCode || pickupCodeInput.trim() || booking.pickup_code;
    if (!code) {
      setErrorMessage('Please enter the 6-digit pickup handover code.');
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
    const code = overrideCode || returnCodeInput.trim() || booking.return_code;
    if (!code) {
      setErrorMessage('Please enter the 6-digit return handover code.');
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
                    {formatFriendlyDate(booking.start_date)} {booking.start_time ? `• ${booking.start_time}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold text-ink-secondary/70 uppercase tracking-wider block">Ends</span>
                  <span className="font-bold text-ink">
                    {formatFriendlyDate(booking.end_date || booking.start_date)} {booking.end_time ? `• ${booking.end_time}` : ''}
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
                  {pickupWindow.isAvailable ? (
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
                  {!pickupWindow.isAvailable
                    ? `Pickup Handover Opens at ${pickupWindow.scheduledTimeFormatted}`
                    : isBorrower
                    ? 'Give your 6-digit pickup code to the owner'
                    : 'Enter the pickup code received from the renter'}
                </h4>
                <p className="text-xs text-ink-secondary max-w-md mx-auto">
                  {!pickupWindow.isAvailable
                    ? `Pickup code and verification unlock strictly at ${pickupWindow.scheduledTimeFormatted} on ${formatFriendlyDate(booking.start_date)}.`
                    : isBorrower
                    ? `Share this code with ${otherPartyName} when you meet to collect the gear.`
                    : `Enter the 6-digit pickup code received from ${otherPartyName} to complete pickup handover.`}
                </p>
              </div>

              {/* TIMING WINDOW LOCK: If scheduled pickup time has not arrived yet */}
              {!pickupWindow.isAvailable ? (
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
                        placeholder={booking.pickup_code || '6-digit code'}
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
              </div>

              {/* Active countdown card */}
              <div className="p-5 rounded-2xl bg-canvas border border-divider space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-brand" />
                    <span>Return Deadline:</span>
                  </span>
                  <span className="text-xs font-black text-brand font-display">
                    {booking.end_date || booking.start_date} ({booking.end_time || '18:00'})
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

              {/* Action Button to advance to return handover */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsReturnActive(true)}
                  className="w-full btn-primary text-xs py-2.5 font-bold shadow-pink cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <span>Ready to Return? Open Return Handover (Stage 4)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STAGE 4: RETURN HANDOVER (RENTER CODE, OWNER INPUT)      */}
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
                    : isBorrower
                    ? 'Give your 6-digit return code to the owner'
                    : 'Enter the return code received from the renter'}
                </h4>
                <p className="text-xs text-ink-secondary max-w-md mx-auto">
                  {!returnWindow.isAvailable
                    ? `Return code and verification unlock strictly at ${returnWindow.scheduledTimeFormatted} on ${formatFriendlyDate(booking.end_date || booking.start_date)}.`
                    : isBorrower
                    ? `Give this return code to ${otherPartyName} once you hand back the gear in good condition.`
                    : `Inspect the gear first, then enter the 6-digit return code given by ${otherPartyName}.`}
                </p>
              </div>

              {/* TIMING WINDOW LOCK: If scheduled return time has not arrived yet */}
              {!returnWindow.isAvailable ? (
                isBorrower ? (
                  /* Renter View when return locked */
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
                        Your 6-digit return handover code will be visible starting at <span className="font-bold text-ink">{returnWindow.scheduledTimeFormatted}</span> on <span className="font-bold text-ink">{formatFriendlyDate(booking.end_date || booking.start_date)}</span>.
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
                      <span>Return the gear to {otherPartyName} at the scheduled time to complete return.</span>
                    </div>
                  </div>
                ) : (
                  /* Owner View when return locked */
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
                        Return code entry and inspection verification will unlock at <span className="font-bold text-ink">{returnWindow.scheduledTimeFormatted}</span> on <span className="font-bold text-ink">{formatFriendlyDate(booking.end_date || booking.start_date)}</span>.
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
              ) : isBorrower ? (
                /* RENTER (BORROWER) VIEW: SHOWS RETURN CODE */
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
                        {booking.return_code || '654321'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(booking.return_code || '654321')}
                        className="p-2.5 rounded-xl bg-surface border border-divider text-ink-secondary hover:text-brand transition-colors cursor-pointer"
                        title="Copy return code"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    {isCopied && <span className="text-[10px] font-bold text-emerald-500 block">Copied to clipboard</span>}
                  </div>

                  <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] font-medium text-purple-700 dark:text-purple-300">
                    Hand this code to {otherPartyName} upon completing gear inspection.
                  </div>
                </div>
              ) : (
                /* OWNER (LENDER) VIEW: INPUT CODE FROM RENTER */
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
                        placeholder={booking.return_code || '6-digit return code'}
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
                      Check that the product is returned safely, then enter the code given by {otherPartyName}.
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
                        <span>{isCameraActive ? 'Close Camera' : 'Scan Return QR Code'}</span>
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
          {/* STAGE 5: TAKE THE PAYMENT FROM THE RENTER                */}
          {/* ======================================================== */}
          {currentStage === 5 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center space-y-1">
                <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  Stage 5: Final Settlement
                </span>
                <h4 className="text-base font-extrabold text-ink font-display">
                  {booking.status === 'COMPLETED'
                    ? 'Rental Process Completed'
                    : 'Take the payment from the renter'}
                </h4>
                <p className="text-xs text-ink-secondary max-w-md mx-auto">
                  {booking.status === 'COMPLETED'
                    ? 'All stages verified, return completed, and payment confirmed!'
                    : isLender
                    ? `Have you received the payment of ₹${Number(booking.total_price)} from ${otherPartyName}?`
                    : `Please pay ₹${Number(booking.total_price)} to ${otherPartyName}. The rental will finish once ${otherPartyName} confirms receiving the payment.`}
                </p>
              </div>

              {/* Total Rental Amount Card */}
              <div className="p-5 rounded-2xl bg-canvas border border-divider text-center space-y-1.5 max-w-sm mx-auto shadow-xs">
                <span className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider block">
                  Total Rental Amount
                </span>
                <div className="text-3xl font-black text-ink font-display">
                  {Number(booking.total_price) === 0 ? 'Free (Community Borrow)' : `₹${Number(booking.total_price)}`}
                </div>
                <div className="text-[11px] text-ink-secondary">
                  {booking.duration_days} {booking.duration_days === 1 ? 'day' : 'days'} rental
                </div>
              </div>

              {booking.status === 'COMPLETED' ? (
                /* 100% COMPLETED CELEBRATION */
                <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3 max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <h4 className="text-base font-extrabold text-emerald-800 dark:text-emerald-200 font-display">
                    Process 100% Completed!
                  </h4>
                  <p className="text-xs text-ink-secondary">
                    This booking has moved to your Finished Bookings section. Both of you can now review each other for the next 3 days.
                  </p>
                  {onLeaveReview && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onLeaveReview(booking);
                      }}
                      className="btn-primary text-xs px-5 py-2.5 font-bold shadow-pink cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Rate & Review Neighbor</span>
                    </button>
                  )}
                </div>
              ) : isLender ? (
                /* OWNER (LENDER) VIEW: CONFIRM RECEIPT OF PAYMENT */
                <div className="space-y-4 max-w-md mx-auto text-center">
                  <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1.5">
                    <span className="text-xs font-bold text-ink block">
                      Confirm Payment Received
                    </span>
                    <p className="text-xs text-ink-secondary">
                      Once you click confirm below, the rental process completes for both sides and moves directly to Finished Bookings.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmPayment}
                    disabled={isVerifying}
                    className="w-full btn-primary text-xs py-3.5 font-bold shadow-pink cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                    )}
                    <span>Confirm Yes, I have received the payment (₹{Number(booking.total_price)})</span>
                  </button>
                </div>
              ) : (
                /* RENTER (BORROWER) VIEW: AWAITING CONFIRMATION */
                <div className="space-y-3 max-w-md mx-auto text-center">
                  <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-2">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300 block">
                      Payment Settlement in Progress
                    </span>
                    <p className="text-xs text-ink-secondary">
                      Please hand over or transfer ₹{Number(booking.total_price)} directly to {otherPartyName}. Once {otherPartyName} confirms receiving it, this booking will be finalized.
                    </p>
                    <span className="text-[11px] font-bold text-amber-600 bg-amber-500/20 px-3 py-1 rounded-full inline-block mt-1">
                      Awaiting confirmation from owner
                    </span>
                  </div>
                </div>
              )}
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
    </div>
  );
};
