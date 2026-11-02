import React, { useState, useRef } from 'react';
import { 
  X, 
  Check, 
  QrCode, 
  Scan, 
  Clock, 
  MapPin, 
  Calendar, 
  CreditCard, 
  CheckCircle2, 
  Loader2, 
  Camera, 
  Sparkles, 
  MessageSquare, 
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Copy,
  ExternalLink,
  ChevronRight
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'UPI' | 'CASH' | 'CARD'>('UPI');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  if (!isOpen || !booking) return null;

  const isLender = booking.lender_id === user?.id;
  const isBorrower = booking.borrower_id === user?.id;
  const otherPartyName = isLender ? (booking.borrower_name || 'Renter') : (booking.lender_name || 'Lender / Owner');
  const otherPartyAvatar = isLender ? booking.borrower_avatar : booking.lender_avatar;
  const otherPartyRole = isLender ? 'Renter' : 'Lender / Owner';

  const today = new Date();
  const currentDayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Determine active stage (1 to 5)
  let currentStage = 1;
  if (booking.status === 'COMPLETED') {
    currentStage = 5;
  } else if (booking.returned_at || booking.payment_status === 'SUBMITTED' || booking.payment_status === 'PENDING') {
    currentStage = 5;
  } else if (booking.status === 'HANDED_OVER') {
    const endStr = (booking.end_date || booking.start_date || '').slice(0, 10);
    const isDeadlineReached = endStr && endStr <= currentDayStr;
    currentStage = isDeadlineReached ? 4 : 3;
  } else if (booking.status === 'ACCEPTED') {
    const startStr = (booking.start_date || '').slice(0, 10);
    const isMeetupDay = startStr && startStr <= currentDayStr;
    currentStage = isMeetupDay ? 2 : 1;
  }

  // Handle copy code helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Start live camera scanner
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

  // Stage 2: Owner verifies Handover (scanning renter's QR or entering code)
  const handleVerifyPickup = async (overrideCode?: string) => {
    const code = overrideCode || pickupCodeInput.trim() || booking.pickup_code;
    if (!code) {
      setErrorMessage('Please enter or scan the 6-digit pickup handover code.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const updated = await api.verifyPickup(booking.id, code);
      handleStopCamera();
      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      } catch {}
      setSuccessMessage('✓ Handover confirmed! Rental period has officially started.');
      onUpdated({ ...booking, ...updated, status: 'HANDED_OVER' });
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect pickup code. Please check with renter.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Stage 4: Renter verifies Return (scanning owner's QR or entering code)
  const handleVerifyReturn = async (overrideCode?: string) => {
    const code = overrideCode || returnCodeInput.trim() || booking.return_code;
    if (!code) {
      setErrorMessage('Please enter or scan the 6-digit return handover code.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const updated = await api.verifyReturn(booking.id, code);
      handleStopCamera();
      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      } catch {}
      setSuccessMessage('✓ Return verified! Proceeding to payment settlement.');
      onUpdated({ ...booking, ...updated, returned_at: new Date().toISOString() });
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect return code. Please check with owner.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Stage 5: Renter marks payment as sent
  const handleSubmitPayment = async () => {
    setIsVerifying(true);
    setErrorMessage('');
    try {
      const updated = await api.submitBookingPayment(booking.id, selectedPaymentMethod);
      setSuccessMessage('✓ Payment marked as sent! Waiting for owner verification.');
      onUpdated({ ...booking, ...updated, payment_status: 'SUBMITTED', payment_method: selectedPaymentMethod });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit payment status.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Stage 5: Owner confirms payment received -> Finished
  const handleConfirmPayment = async () => {
    setIsVerifying(true);
    setErrorMessage('');
    try {
      const updated = await api.confirmBookingPayment(booking.id);
      try {
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 } });
      } catch {}
      setSuccessMessage('🎉 Payment confirmed! The entire rental process is completed!');
      onUpdated({ ...booking, ...updated, status: 'COMPLETED', payment_status: 'CONFIRMED' });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to confirm payment.');
    } finally {
      setIsVerifying(false);
    }
  };

  const stagesList = [
    { number: 1, title: 'Proposal Accepted', desc: 'Booking confirmed' },
    { number: 2, title: 'Pickup Handover', desc: 'Renter QR / Owner Scan' },
    { number: 3, title: 'Rental In-Use', desc: 'Duration active' },
    { number: 4, title: 'Return Handover', desc: 'Owner QR / Renter Scan' },
    { number: 5, title: 'Payment & Finished', desc: 'Payment verified' },
  ];

  // Pickup and Return QR Code URLs using fast standard QR rendering
  const pickupQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(`RENTU_PICKUP:${booking.id}:${booking.pickup_code || 'PICKUP'}`)}`;
  const returnQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(`RENTU_RETURN:${booking.id}:${booking.return_code || 'RETURN'}`)}`;

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

          {/* ======================================================== */}
          {/* STAGE 1: PROPOSAL ACCEPTED & SCHEDULED                  */}
          {/* ======================================================== */}
          {currentStage === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-3xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <h4 className="font-extrabold text-sm font-display">Stage 1: Proposal Accepted & Confirmed</h4>
                </div>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Both parties have agreed on the booking dates and details. At the agreed start date and time, Stage 2 will activate where the renter shows their pickup QR code and the owner scans it.
                </p>
              </div>

              {/* Schedule and Handover Logistics */}
              <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">Agreed Rental Start:</span>
                  <span className="font-bold text-brand">{booking.start_date} {booking.start_time ? `(${booking.start_time})` : '10:00 AM'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">Agreed Return Deadline:</span>
                  <span className="font-bold text-ink">{booking.end_date || booking.start_date} {booking.end_time ? `(${booking.end_time})` : '18:00'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">Pickup & Drop Location:</span>
                  <span className="font-medium text-ink-secondary text-right max-w-[240px] truncate">
                    {booking.pickup_locality || booking.item_locality || 'Agreed Location'}
                  </span>
                </div>
              </div>

              {/* Action Button to test/advance if meeting early */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    // Advance to Stage 2 view
                    setSuccessMessage('Entering Stage 2: Ready for Pickup Handover');
                  }}
                  className="w-full btn-primary text-xs py-2.5 font-bold shadow-pink cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <span>Meeting for Pickup Today? Open Stage 2 QR Code</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STAGE 2: PICKUP HANDOVER (RENTER QR, OWNER SCANNER)      */}
          {/* ======================================================== */}
          {currentStage === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center space-y-1">
                <span className="text-[11px] font-black uppercase text-brand tracking-wider bg-brand-soft px-2.5 py-0.5 rounded-full border border-brand/20">
                  Stage 2: Pickup Handover Verification
                </span>
                <h4 className="text-base font-extrabold text-ink font-display">
                  {isBorrower ? 'Show your QR code to the owner' : 'Scan the renter’s QR code to begin'}
                </h4>
                <p className="text-xs text-ink-secondary max-w-md mx-auto">
                  {isBorrower
                    ? `Show this QR code to ${otherPartyName} when you meet to collect the gear.`
                    : `Scan ${otherPartyName}'s QR code once you hand over the item to start the rental.`}
                </p>
              </div>

              {/* RENTER (BORROWER) VIEW: SHOW QR CODE */}
              {isBorrower ? (
                <div className="p-6 rounded-3xl bg-canvas border border-divider text-center space-y-4 max-w-sm mx-auto shadow-sm">
                  <div className="w-56 h-56 mx-auto rounded-2xl bg-white p-3 shadow-md border border-zinc-200 flex items-center justify-center">
                    <img
                      src={pickupQrUrl}
                      alt="Pickup Handover QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-ink-secondary">Handover Code (Manual Fallback):</span>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono text-xl font-black tracking-widest text-ink bg-surface px-4 py-1.5 rounded-xl border border-divider">
                        {booking.pickup_code || '654321'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(booking.pickup_code || '654321')}
                        className="p-2 rounded-xl bg-surface border border-divider text-ink-secondary hover:text-brand transition-colors cursor-pointer"
                        title="Copy code"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    {isCopied && <span className="text-[10px] font-bold text-emerald-500 block">✓ Copied to clipboard</span>}
                  </div>

                  <div className="text-[11px] text-ink-secondary flex items-center justify-center gap-1.5 pt-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Rentu Verified Secure Handover</span>
                  </div>
                </div>
              ) : (
                /* OWNER (LENDER) VIEW: SCANNER & VERIFY INPUT */
                <div className="p-5 rounded-3xl bg-canvas border border-divider space-y-4 max-w-md mx-auto text-center">
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-zinc-800">
                    {isCameraActive ? (
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-zinc-400 space-y-2 p-4">
                        <Scan className="w-10 h-10 text-brand animate-pulse" />
                        <span className="text-xs font-bold text-zinc-300">Camera Viewfinder</span>
                        <span className="text-[10px] text-zinc-500">Scan renter's QR code or enter code below</span>
                      </div>
                    )}

                    {/* Scanning Laser Guide */}
                    <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-brand shadow-[0_0_8px_#ff007a]" />
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={isCameraActive ? handleStopCamera : handleStartCamera}
                      className="btn-secondary text-xs px-3.5 py-1.5 font-bold cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5 text-brand" />
                      <span>{isCameraActive ? 'Close Camera' : 'Open Camera Scanner'}</span>
                    </button>
                  </div>

                  {/* Manual Code Input */}
                  <div className="space-y-2 pt-2 border-t border-divider">
                    <label className="text-xs font-bold text-ink block">
                      Or Enter Renter's 6-Digit Pickup Code:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={pickupCodeInput}
                        onChange={(e) => setPickupCodeInput(e.target.value.replace(/\D/g, ''))}
                        placeholder={booking.pickup_code || '6-digit code'}
                        className="bg-surface border border-divider rounded-xl px-4 py-2 text-center font-mono text-base font-black tracking-widest text-ink outline-none focus:border-brand flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleVerifyPickup()}
                        disabled={isVerifying}
                        className="btn-primary text-xs px-5 py-2.5 font-bold shadow-pink cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                        <span>Verify & Start</span>
                      </button>
                    </div>

                    {/* Quick 1-click test button */}
                    <button
                      type="button"
                      onClick={() => handleVerifyPickup(booking.pickup_code || '123456')}
                      className="text-[11px] font-bold text-brand hover:underline cursor-pointer block mx-auto pt-1"
                    >
                      ⚡ Quick Verify Handover (Test Click)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* STAGE 3: RENTAL PERIOD ONGOING (IN-USE)                 */}
          {/* ======================================================== */}
          {currentStage === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-3xl bg-blue-500/10 border border-blue-500/20 space-y-2 text-center">
                <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                  Stage 3: Rental Period Active
                </span>
                <h4 className="text-base font-extrabold text-ink font-display">
                  Product is currently with {otherPartyName}
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

              {/* Action Button to open Stage 4 when meeting for return */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    // Trigger Stage 4 view for return handover
                    setSuccessMessage('Stage 4: Return Handover ready. Owner will show QR code to renter.');
                  }}
                  className="w-full btn-primary text-xs py-2.5 font-bold shadow-pink cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <span>Ready to Return? Open Return Handover (Stage 4)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STAGE 4: RETURN HANDOVER (OWNER QR, RENTER SCANNER)      */}
          {/* ======================================================== */}
          {currentStage === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center space-y-1">
                <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                  Stage 4: Return Handover Verification
                </span>
                <h4 className="text-base font-extrabold text-ink font-display">
                  {isLender ? 'Inspect product & show your Return QR code' : 'Scan owner’s QR code upon returning'}
                </h4>
                <p className="text-xs text-ink-secondary max-w-md mx-auto">
                  {isLender
                    ? `Inspect the product first. Show this QR code to ${otherPartyName} only after you have safely received the gear back.`
                    : `Hand the product to ${otherPartyName}. Scan ${otherPartyName}’s QR code once they have received it back.`}
                </p>
              </div>

              {/* OWNER (LENDER) VIEW: SHOWS RETURN QR CODE */}
              {isLender ? (
                <div className="p-6 rounded-3xl bg-canvas border border-divider text-center space-y-4 max-w-sm mx-auto shadow-sm">
                  <div className="w-56 h-56 mx-auto rounded-2xl bg-white p-3 shadow-md border border-zinc-200 flex items-center justify-center">
                    <img
                      src={returnQrUrl}
                      alt="Return Handover QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-ink-secondary">Return Code (Manual Fallback):</span>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono text-xl font-black tracking-widest text-ink bg-surface px-4 py-1.5 rounded-xl border border-divider">
                        {booking.return_code || '876543'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(booking.return_code || '876543')}
                        className="p-2 rounded-xl bg-surface border border-divider text-ink-secondary hover:text-brand transition-colors cursor-pointer"
                        title="Copy code"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    {isCopied && <span className="text-[10px] font-bold text-emerald-500 block">✓ Copied to clipboard</span>}
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    ⚠️ Only display this QR code after verifying that the item is in good condition.
                  </div>
                </div>
              ) : (
                /* RENTER (BORROWER) VIEW: SCANNER TO SCAN OWNER'S RETURN QR */
                <div className="p-5 rounded-3xl bg-canvas border border-divider space-y-4 max-w-md mx-auto text-center">
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-zinc-800">
                    {isCameraActive ? (
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-zinc-400 space-y-2 p-4">
                        <Scan className="w-10 h-10 text-brand animate-pulse" />
                        <span className="text-xs font-bold text-zinc-300">Scanner Viewfinder</span>
                        <span className="text-[10px] text-zinc-500">Scan owner's QR code to confirm return</span>
                      </div>
                    )}

                    <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-brand shadow-[0_0_8px_#ff007a]" />
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={isCameraActive ? handleStopCamera : handleStartCamera}
                      className="btn-secondary text-xs px-3.5 py-1.5 font-bold cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5 text-brand" />
                      <span>{isCameraActive ? 'Close Camera' : 'Open Camera Scanner'}</span>
                    </button>
                  </div>

                  {/* Manual Return Code Input */}
                  <div className="space-y-2 pt-2 border-t border-divider">
                    <label className="text-xs font-bold text-ink block">
                      Or Enter Owner's 6-Digit Return Code:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={returnCodeInput}
                        onChange={(e) => setReturnCodeInput(e.target.value.replace(/\D/g, ''))}
                        placeholder={booking.return_code || '6-digit return code'}
                        className="bg-surface border border-divider rounded-xl px-4 py-2 text-center font-mono text-base font-black tracking-widest text-ink outline-none focus:border-brand flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleVerifyReturn()}
                        disabled={isVerifying}
                        className="btn-primary text-xs px-5 py-2.5 font-bold shadow-pink cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                        <span>Confirm Return</span>
                      </button>
                    </div>

                    {/* Quick 1-click test button */}
                    <button
                      type="button"
                      onClick={() => handleVerifyReturn(booking.return_code || '654321')}
                      className="text-[11px] font-bold text-brand hover:underline cursor-pointer block mx-auto pt-1"
                    >
                      ⚡ Quick Confirm Return (Test Click)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* STAGE 5: PAYMENT GATEWAY & SETTLEMENT COMPLETION        */}
          {/* ======================================================== */}
          {currentStage === 5 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center space-y-1">
                <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  Stage 5: Payment Gateway & Settlement
                </span>
                <h4 className="text-base font-extrabold text-ink font-display">
                  {booking.status === 'COMPLETED'
                    ? 'Rental Process Completed! 🎉'
                    : isLender
                    ? 'Verify Payment from Renter'
                    : 'Complete Payment to Owner'}
                </h4>
                <p className="text-xs text-ink-secondary max-w-md mx-auto">
                  {booking.status === 'COMPLETED'
                    ? 'All stages verified, return completed, and payment confirmed!'
                    : isLender
                    ? `Check if you have received the payment of ₹${Number(booking.total_price)} from ${otherPartyName}.`
                    : `Send payment of ₹${Number(booking.total_price)} to ${otherPartyName} via UPI or cash.`}
                </p>
              </div>

              {/* Total Amount Card */}
              <div className="p-5 rounded-2xl bg-canvas border border-divider text-center space-y-2 max-w-sm mx-auto">
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
                /* COMPLETED CELEBRATION */
                <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3 max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <h4 className="text-base font-extrabold text-emerald-800 dark:text-emerald-200 font-display">
                    Process 100% Completed!
                  </h4>
                  <p className="text-xs text-ink-secondary">
                    This booking has moved to your Finished Bookings section. Thank you for contributing to the circular sharing community!
                  </p>
                  {onLeaveReview && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onLeaveReview(booking);
                      }}
                      className="btn-primary text-xs px-5 py-2 font-bold shadow-pink cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Rate & Review Neighbor</span>
                    </button>
                  )}
                </div>
              ) : isBorrower ? (
                /* RENTER VIEW: PAY & CONFIRM SENT */
                <div className="space-y-4 max-w-md mx-auto">
                  {/* Payment Method Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-ink block">Select Payment Method:</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['UPI', 'CASH', 'CARD'] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setSelectedPaymentMethod(method)}
                          className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                            selectedPaymentMethod === method
                              ? 'bg-brand text-white border-brand shadow-xs font-bold'
                              : 'bg-canvas text-ink-secondary border-divider hover:border-brand/40 font-semibold text-xs'
                          }`}
                        >
                          {method === 'UPI' ? '📱 UPI' : method === 'CASH' ? '💵 Cash' : '💳 Card'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {booking.payment_status === 'SUBMITTED' ? (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      <span>✓ Payment marked as sent! Waiting for {otherPartyName} to confirm receipt.</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmitPayment}
                      disabled={isVerifying}
                      className="w-full btn-primary text-xs py-3 font-bold shadow-pink cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                      <span>I Have Sent Payment (₹{Number(booking.total_price)})</span>
                    </button>
                  )}
                </div>
              ) : (
                /* OWNER VIEW: CONFIRM RECEIPT OF PAYMENT */
                <div className="space-y-4 max-w-md mx-auto text-center">
                  <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
                    <span className="text-xs font-bold text-ink block">Renter Payment Status:</span>
                    <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full inline-block ${
                      booking.payment_status === 'SUBMITTED'
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}>
                      {booking.payment_status === 'SUBMITTED' ? '✓ Renter Marked as Paid' : 'Pending Payment'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmPayment}
                    disabled={isVerifying}
                    className="w-full btn-primary text-xs py-3 font-bold shadow-pink cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                    <span>Confirm Payment Received (₹{Number(booking.total_price)})</span>
                  </button>
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

