import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  MessageSquare, 
  Check, 
  X, 
  KeyRound, 
  Star, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Copy, 
  Loader2,
  Package,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../lib/api';
import { Booking } from '../lib/types';
import { useAuth } from '../lib/authContext';
import { ReviewModal } from './ReviewModal';
import { BookingScheduleCalendar, formatDisplayDate, cleanYMD } from './BookingScheduleCalendar';

interface BookingsViewProps {
  onOpenChat: (bookingId: string) => void;
}

export const BookingsView: React.FC<BookingsViewProps> = ({ onOpenChat }) => {
  const { user } = useAuth();
  
  // View mode switcher: 'stages' (4-stage lifecycle cards) vs 'calendar' (interactive monthly calendar)
  const [viewMode, setViewMode] = useState<'stages' | 'calendar'>('stages');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | undefined>(undefined);

  // 4 Lifecycle stages matching exact requirements:
  // 1. Rental Requests (PENDING)
  // 2. Accepted the Product (ACCEPTED - awaiting meetup / pickup verification)
  // 3. Receiving the Product (HANDED_OVER - in use, awaiting return)
  // 4. Receiving Back the Product (COMPLETED - returned, 3-day reviews & feedback)
  const [activeTab, setActiveTab] = useState<'requests' | 'accepted' | 'receiving' | 'completed'>('requests');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 6-digit verification code input states keyed by booking ID
  const [pickupCodeInput, setPickupCodeInput] = useState<Record<string, string>>({});
  const [returnCodeInput, setReturnCodeInput] = useState<Record<string, string>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Review modal state
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);

  useEffect(() => {
    loadBookings();
  }, [user]);

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const data = await api.getBookings();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load bookings:', err);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (bookingId: string, status: 'ACCEPTED' | 'REJECTED') => {
    try {
      const updated = await api.updateBookingStatus(bookingId, status);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...updated, status } : b))
      );
      window.dispatchEvent(new Event('rentu:notifications-updated'));
      if (status === 'ACCEPTED') {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        // Automatically switch to Accepted tab so owner sees the next step
        setActiveTab('accepted');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update booking status.');
    }
  };

  // Step 3 Verification: Renter gives 6-digit code to owner (or counterpart) to confirm Handover
  const handleVerifyPickup = async (bookingId: string) => {
    const code = pickupCodeInput[bookingId]?.trim();
    if (!code || code.length < 4) {
      setActionError((prev) => ({ ...prev, [bookingId]: 'Please enter the 6-digit handover code' }));
      return;
    }

    setVerifyingId(bookingId);
    setActionError((prev) => ({ ...prev, [bookingId]: '' }));

    try {
      const updated = await api.verifyPickup(bookingId, code);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...updated, status: 'HANDED_OVER' } : b))
      );
      window.dispatchEvent(new Event('rentu:notifications-updated'));
      // Advance to stage 3
      setActiveTab('receiving');
    } catch (err: any) {
      setActionError((prev) => ({ ...prev, [bookingId]: err.message || 'Incorrect verification code.' }));
    } finally {
      setVerifyingId(null);
    }
  };

  // Step 4 Verification: Return 6-digit code to complete the process and return product
  const handleVerifyReturn = async (bookingId: string) => {
    const code = returnCodeInput[bookingId]?.trim();
    if (!code || code.length < 4) {
      setActionError((prev) => ({ ...prev, [bookingId]: 'Please enter the 6-digit return code' }));
      return;
    }

    setVerifyingId(bookingId);
    setActionError((prev) => ({ ...prev, [bookingId]: '' }));

    try {
      const updated = await api.verifyReturn(bookingId, code);
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...updated, status: 'COMPLETED' } : b))
      );
      window.dispatchEvent(new Event('rentu:notifications-updated'));
      // Advance to stage 4 & prompt review
      setActiveTab('completed');
      setReviewBooking(updated);
    } catch (err: any) {
      setActionError((prev) => ({ ...prev, [bookingId]: err.message || 'Incorrect return code.' }));
    } finally {
      setVerifyingId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Filtering for the 4 distinct lifecycle stages
  const requestsList = bookings.filter((b) => b.status === 'PENDING');
  const acceptedList = bookings.filter((b) => b.status === 'ACCEPTED');
  const receivingList = bookings.filter((b) => b.status === 'HANDED_OVER');
  const completedList = bookings.filter((b) => ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(b.status));

  const displayedBookings =
    activeTab === 'requests' ? requestsList :
    activeTab === 'accepted' ? acceptedList :
    activeTab === 'receiving' ? receivingList :
    completedList;

  // Helper to check 3-day review window
  const getReviewTimeRemaining = (booking: Booking): { isOpen: boolean; label: string } => {
    if (booking.status !== 'COMPLETED') return { isOpen: false, label: '' };
    const completedAt = new Date(booking.completed_at || booking.created_at);
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const diffMs = (completedAt.getTime() + threeDaysMs) - Date.now();
    
    if (diffMs <= 0) {
      return { isOpen: false, label: 'Review window closed (3 days elapsed)' };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;

    const label = days > 0 ? `${days}d ${remHours}h left to review` : `${hours}h left to review`;
    return { isOpen: true, label };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-150">
      
      {/* Header Bar with View Mode Switcher */}
      <div className="pb-6 border-b border-divider flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            Rental Lifecycle & Handoffs
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary font-medium mt-0.5">
            Four-stage secure peer-to-peer exchange with live 6-digit codes and interactive schedule calendar
          </p>
        </div>

        {/* View Switcher: 4 Stages vs Schedule Calendar */}
        <div className="flex items-center gap-1.5 bg-canvas p-1 rounded-2xl border border-divider self-start md:self-auto shrink-0 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('stages')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'stages'
                ? 'bg-brand text-white shadow-xs'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>4 Stages ({bookings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'calendar'
                ? 'bg-brand text-white shadow-xs'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Schedule Calendar</span>
          </button>
        </div>
      </div>

      {/* CALENDAR VIEW */}
      {viewMode === 'calendar' ? (
        <div className="pt-6">
          <BookingScheduleCalendar
            bookings={bookings}
            onOpenChat={onOpenChat}
            onStatusUpdate={handleStatusUpdate}
            onVerifyPickup={async (id, code) => {
              pickupCodeInput[id] = code;
              await handleVerifyPickup(id);
            }}
            onVerifyReturn={async (id, code) => {
              returnCodeInput[id] = code;
              await handleVerifyReturn(id);
            }}
            onOpenReview={(b) => setReviewBooking(b)}
            initialDate={selectedCalendarDate}
          />
        </div>
      ) : (
        <>
          {/* 4 STAGES TABS ROW */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-6 pb-6">
            {[
              { 
                key: 'requests', 
                stepNum: '1', 
                label: 'Rental Requests', 
                desc: 'Proposals & Pending',
                count: requestsList.length 
              },
              { 
                key: 'accepted', 
                stepNum: '2', 
                label: 'Accepted Meetup', 
                desc: 'Agreed time & place',
                count: acceptedList.length 
              },
              { 
                key: 'receiving', 
                stepNum: '3', 
                label: 'Receiving (In Use)', 
                desc: 'Code verified & active',
                count: receivingList.length 
              },
              { 
                key: 'completed', 
                stepNum: '4', 
                label: 'Received Back', 
                desc: 'Returned & 3-Day Reviews',
                count: completedList.length 
              },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer border relative overflow-hidden ${
                    isActive
                      ? 'bg-surface border-brand ring-2 ring-brand/20 shadow-sm'
                      : 'bg-canvas/60 border-divider hover:bg-surface hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                      isActive ? 'bg-brand text-white' : 'bg-surface text-ink-secondary border border-divider'
                    }`}>
                      Stage {tab.stepNum}
                    </span>

                    {tab.count > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        isActive ? 'bg-brand-soft text-brand' : 'bg-canvas text-ink-secondary'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </div>

                  <div className="font-extrabold text-xs sm:text-sm text-ink mt-2">
                    {tab.label}
                  </div>
                  <div className="text-[10px] text-ink-secondary truncate font-medium">
                    {tab.desc}
                  </div>
                </button>
              );
            })}
          </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="py-24 text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-ink-secondary">Loading rental handoffs...</p>
        </div>
      ) : displayedBookings.length === 0 ? (
        <div className="py-20 text-center bg-surface border border-divider rounded-3xl p-8 max-w-2xl mx-auto space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto mb-2">
            <Package className="w-6 h-6 stroke-[1.8]" />
          </div>
          <p className="text-base font-bold text-ink">
            {activeTab === 'requests' && 'No pending rental requests right now.'}
            {activeTab === 'accepted' && 'No accepted proposals waiting for meetup.'}
            {activeTab === 'receiving' && 'No gear currently received or in use.'}
            {activeTab === 'completed' && 'No completed or returned handoffs yet.'}
          </p>
          <p className="text-xs text-ink-secondary max-w-md mx-auto">
            {activeTab === 'requests' && 'When neighbors request to rent gear or you send a rental proposal, they will appear here for review and chat.'}
            {activeTab === 'accepted' && 'Accepted rentals ready for designated meetup and 6-digit pickup verification appear here.'}
            {activeTab === 'receiving' && 'Active gear in use with the renter appears here until return handover.'}
            {activeTab === 'completed' && 'Finished rentals ready for 3-day reviews and neighbor trust score feedback appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-w-4xl mx-auto">
          {displayedBookings.map((booking) => {
            const isLender = booking.lender_id === user?.id;
            const otherPartyName = isLender ? (booking.borrower_name || 'Borrower') : (booking.lender_name || 'Lender');
            const reviewWindow = getReviewTimeRemaining(booking);

            return (
              <div
                key={booking.id}
                className="bg-surface border border-divider rounded-3xl p-5 sm:p-6 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all space-y-4"
              >
                {/* Top Row: Item Photo + Core Info + Chat Action */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={booking.item_images?.[0] || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80'}
                      alt={booking.item_title}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-divider shrink-0 shadow-xs"
                    />

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-base sm:text-lg text-ink tracking-tight font-display">
                          {booking.item_title}
                        </h3>

                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          booking.status === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                            : booking.status === 'ACCEPTED'
                            ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                            : booking.status === 'HANDED_OVER'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}>
                          {booking.status === 'PENDING' && 'Stage 1: Request Pending'}
                          {booking.status === 'ACCEPTED' && 'Stage 2: Proposal Accepted'}
                          {booking.status === 'HANDED_OVER' && 'Stage 3: Received (In Use)'}
                          {booking.status === 'COMPLETED' && 'Stage 4: Completed'}
                          {booking.status === 'REJECTED' && 'Declined'}
                          {booking.status === 'CANCELLED' && 'Cancelled'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-secondary">
                        <span className="flex items-center gap-1 text-ink">
                          <Calendar className="w-3.5 h-3.5 text-brand" />
                          <span>{formatDisplayDate(cleanYMD(booking.start_date))} → {formatDisplayDate(cleanYMD(booking.end_date || booking.start_date))} ({booking.duration_days} days)</span>
                        </span>
                        <span>•</span>
                        <span className="font-extrabold text-ink font-display">
                          {Number(booking.total_price) === 0 ? 'Free (Borrow)' : `₹${Number(booking.total_price)}`}
                        </span>
                      </div>

                      <div className="text-xs text-ink-secondary font-medium">
                        {isLender ? 'Renter: ' : 'Owner: '}
                        <strong className="text-ink">{otherPartyName}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Quick Chat and Calendar View buttons */}
                  <div className="shrink-0 w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCalendarDate(cleanYMD(booking.start_date));
                        setViewMode('calendar');
                      }}
                      className="btn-secondary text-xs px-3 py-2 font-bold cursor-pointer inline-flex items-center gap-1.5 w-full sm:w-auto justify-center hover:border-brand hover:text-brand transition-colors"
                      title="View on Schedule Calendar"
                    >
                      <Calendar className="w-3.5 h-3.5 text-brand" />
                      <span>View on Calendar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenChat(booking.id)}
                      className="btn-secondary text-xs px-4 py-2 font-bold cursor-pointer inline-flex items-center gap-1.5 w-full sm:w-auto justify-center hover:border-brand hover:text-brand transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-brand" />
                      <span>Message {otherPartyName}</span>
                    </button>
                  </div>
                </div>

                {/* Handover & Return Logistics Details */}
                <div className="p-3 bg-canvas rounded-2xl border border-divider text-xs text-ink-secondary grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0 mt-0.5">🚗</span>
                    <div>
                      <div className="font-bold text-ink">
                        {booking.requires_delivery ? 'Lender Drop-off Delivery' : 'Renter Self-Pickup'}
                        {booking.requires_delivery && Number(booking.delivery_fee) > 0 && (
                          <span className="ml-1 text-[10px] font-extrabold text-brand bg-brand-soft px-1.5 py-0.5 rounded-md">
                            +₹{Number(booking.delivery_fee)}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-ink-secondary">
                        {booking.requires_delivery
                          ? 'Owner will deliver gear to the renter'
                          : `Renter picks up from owner (${booking.item_locality || 'Owner location'})`}
                      </div>
                      <div className="text-[10px] text-ink-secondary font-medium mt-0.5">Time: {booking.start_time || '10:00'}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0 mt-0.5">🔄</span>
                    <div>
                      <div className="font-bold text-ink">
                        {booking.requires_pickup ? 'Lender Collects on Return' : 'Renter Returns to Lender'}
                        {booking.requires_pickup && Number(booking.pickup_fee) > 0 && (
                          <span className="ml-1 text-[10px] font-extrabold text-brand bg-brand-soft px-1.5 py-0.5 rounded-md">
                            +₹{Number(booking.pickup_fee)}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-ink-secondary">
                        {booking.requires_pickup
                          ? 'Owner will collect gear back from renter'
                          : `Renter brings gear back to owner (${booking.item_locality || 'Owner location'})`}
                      </div>
                      <div className="text-[10px] text-ink-secondary font-medium mt-0.5">Time: {booking.end_time || '18:00'}</div>
                    </div>
                  </div>
                </div>

                {/* ======================================================== */}
                {/* STAGE 1: RENTAL REQUEST (Owner Accept / Decline Buttons) */}
                {/* ======================================================== */}
                {booking.status === 'PENDING' && (
                  <div className="pt-2 border-t border-divider flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-ink-secondary">
                      {isLender
                        ? 'Review proposal dates & times above. You can message them directly to change times or accept.'
                        : 'Waiting for gear owner to accept your rental proposal.'}
                    </div>

                    {isLender && (
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                          onClick={() => handleStatusUpdate(booking.id, 'REJECTED')}
                          className="btn-secondary text-xs px-4 py-2 text-rose-500 hover:border-rose-500 font-bold cursor-pointer"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(booking.id, 'ACCEPTED')}
                          className="btn-primary text-xs px-6 py-2 shadow-pink font-bold cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Accept Proposal</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ======================================================== */}
                {/* STAGE 2: ACCEPTED THE PRODUCT & 6-DIGIT PICKUP CODE     */}
                {/* ======================================================== */}
                {booking.status === 'ACCEPTED' && (
                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-ink">
                          Stage 2: Meet & Exchange 6-Digit Handover Code
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                        Meet at designated pickup spot
                      </span>
                    </div>

                    <p className="text-xs text-ink-secondary leading-relaxed">
                      {isLender
                        ? `When you hand over ${booking.item_title} to ${otherPartyName}, enter their 6-digit code below to confirm they accepted the product.`
                        : `When receiving the product from ${otherPartyName}, give them your 6-digit handover code shown below.`}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
                      {/* 6-Digit Code Display */}
                      <div className="p-3 bg-surface rounded-xl border border-blue-500/30 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase text-ink-secondary">
                            6-Digit Handover Code
                          </div>
                          <div className="text-lg sm:text-xl font-mono font-black text-brand tracking-widest mt-0.5">
                            {booking.pickup_code || '------'}
                          </div>
                        </div>

                        {booking.pickup_code && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(booking.pickup_code!, `pickup-${booking.id}`)}
                            className="px-2.5 py-1.5 rounded-lg border border-divider hover:bg-canvas text-xs font-bold text-ink cursor-pointer inline-flex items-center gap-1 transition-colors"
                          >
                            {copiedId === `pickup-${booking.id}` ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-emerald-500 text-[11px]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-brand" />
                                <span className="text-[11px]">Copy</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Code Input & Verification */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="Enter 6-digit code"
                            value={pickupCodeInput[booking.id] || ''}
                            onChange={(e) => setPickupCodeInput((prev) => ({ ...prev, [booking.id]: e.target.value.replace(/\D/g, '') }))}
                            className="flex-1 bg-surface border border-divider rounded-xl px-3 py-2 text-xs font-mono font-black text-ink tracking-wider outline-none focus:border-brand"
                          />
                          <button
                            type="button"
                            onClick={() => handleVerifyPickup(booking.id)}
                            disabled={verifyingId === booking.id || !(pickupCodeInput[booking.id]?.length >= 4)}
                            className="btn-primary text-xs px-4 py-2 font-bold shadow-pink cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                          >
                            {verifyingId === booking.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Confirm Handover</span>
                          </button>
                        </div>

                        {actionError[booking.id] && (
                          <div className="text-[11px] font-bold text-rose-500">
                            {actionError[booking.id]}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* STAGE 3: RECEIVING (IN USE) & 6-DIGIT RETURN CODE        */}
                {/* ======================================================== */}
                {booking.status === 'HANDED_OVER' && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-ink">
                          Stage 3: Gear In Use • Return Due on {booking.end_date || booking.start_date}
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        Received on {booking.handed_over_at ? new Date(booking.handed_over_at).toLocaleDateString() : 'Today'}
                      </span>
                    </div>

                    <p className="text-xs text-ink-secondary leading-relaxed">
                      {isLender
                        ? `When ${otherPartyName} returns your item at the designated place, enter the 6-digit return code they give you to complete the rental.`
                        : `When returning the product to ${otherPartyName}, give them the 6-digit return code shown below.`}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
                      {/* 6-Digit Return Code Display */}
                      <div className="p-3 bg-surface rounded-xl border border-emerald-500/30 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase text-ink-secondary">
                            6-Digit Return Code
                          </div>
                          <div className="text-lg sm:text-xl font-mono font-black text-emerald-600 dark:text-emerald-400 tracking-widest mt-0.5">
                            {booking.return_code || '------'}
                          </div>
                        </div>

                        {booking.return_code && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(booking.return_code!, `return-${booking.id}`)}
                            className="px-2.5 py-1.5 rounded-lg border border-divider hover:bg-canvas text-xs font-bold text-ink cursor-pointer inline-flex items-center gap-1 transition-colors"
                          >
                            {copiedId === `return-${booking.id}` ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-emerald-500 text-[11px]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-[11px]">Copy</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Code Input & Verification */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="Enter 6-digit return code"
                            value={returnCodeInput[booking.id] || ''}
                            onChange={(e) => setReturnCodeInput((prev) => ({ ...prev, [booking.id]: e.target.value.replace(/\D/g, '') }))}
                            className="flex-1 bg-surface border border-divider rounded-xl px-3 py-2 text-xs font-mono font-black text-ink tracking-wider outline-none focus:border-brand"
                          />
                          <button
                            type="button"
                            onClick={() => handleVerifyReturn(booking.id)}
                            disabled={verifyingId === booking.id || !(returnCodeInput[booking.id]?.length >= 4)}
                            className="btn-primary text-xs px-4 py-2 font-bold shadow-pink cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0 bg-emerald-600 hover:bg-emerald-700"
                          >
                            {verifyingId === booking.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Confirm Return 📦</span>
                          </button>
                        </div>

                        {actionError[booking.id] && (
                          <div className="text-[11px] font-bold text-rose-500">
                            {actionError[booking.id]}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* STAGE 4: RECEIVED BACK & REVIEWS (3-DAY WINDOW)         */}
                {/* ======================================================== */}
                {booking.status === 'COMPLETED' && (
                  <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-ink">
                          Stage 4: Rental Completed • Returned Successfully
                        </h4>
                      </div>

                      {reviewWindow.isOpen ? (
                        <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          ⏳ {reviewWindow.label}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-ink-secondary">
                          {reviewWindow.label}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                      <div>
                        {booking.user_review_id ? (
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>You rated {booking.user_rating} / 5 stars</span>
                            {booking.user_comment && (
                              <span className="text-ink-secondary font-medium">"{booking.user_comment}"</span>
                            )}
                          </div>
                        ) : reviewWindow.isOpen ? (
                          <p className="text-xs text-ink-secondary">
                            Both parties can give each other a review & feedback for up to 3 days after returning the product.
                          </p>
                        ) : (
                          <p className="text-xs text-ink-secondary">
                            Feedback window has concluded.
                          </p>
                        )}
                      </div>

                      {reviewWindow.isOpen && (
                        <button
                          type="button"
                          onClick={() => setReviewBooking(booking)}
                          className="btn-primary text-xs px-4 py-2 font-bold shadow-pink cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                        >
                          <Star className="w-3.5 h-3.5 fill-white text-white" />
                          <span>{booking.user_review_id ? 'Update Review ⭐' : 'Give Review & Feedback ⭐'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Review Modal */}
      <ReviewModal
        booking={reviewBooking}
        isOpen={Boolean(reviewBooking)}
        onClose={() => setReviewBooking(null)}
        onSuccess={() => {
          loadBookings();
        }}
      />

    </div>
  );
};
