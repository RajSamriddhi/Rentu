import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  MessageSquare, 
  Check, 
  X, 
  KeyRound, 
  Copy, 
  CheckCircle2, 
  AlertCircle,
  Package,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Star,
  Loader2
} from 'lucide-react';
import { Booking } from '../lib/types';
import { useAuth } from '../lib/authContext';

export interface BookingScheduleCalendarProps {
  bookings: Booking[];
  onOpenChat?: (bookingId: string) => void;
  onStatusUpdate?: (bookingId: string, status: 'ACCEPTED' | 'REJECTED') => Promise<void>;
  onVerifyPickup?: (bookingId: string, code: string) => Promise<void>;
  onVerifyReturn?: (bookingId: string, code: string) => Promise<void>;
  onOpenReview?: (booking: Booking) => void;
  initialDate?: string;
}

// Format YYYY-MM-DD from Date safely in local time
export const formatYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Safe date range parser: cleans ISO timestamps like '2026-11-01T18:30:00.000Z' to '2026-11-01'
export const cleanYMD = (d: string | undefined): string => {
  if (!d) return '';
  return d.slice(0, 10);
};

// Friendly human format (e.g., '1 Nov 2026')
export const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const clean = cleanYMD(dateStr);
  const parts = clean.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[(m || 1) - 1]} ${y}`;
};

export const BookingScheduleCalendar: React.FC<BookingScheduleCalendarProps> = ({
  bookings = [],
  onOpenChat,
  onStatusUpdate,
  onVerifyPickup,
  onVerifyReturn,
  onOpenReview,
  initialDate,
}) => {
  const { user } = useAuth();

  const todayStr = useMemo(() => formatYMD(new Date()), []);

  // Selected date state defaults to initialDate or today
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDate) return cleanYMD(initialDate);
    return todayStr;
  });

  // Calendar month state
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    if (initialDate) {
      const parts = cleanYMD(initialDate).split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0])) {
        return new Date(parts[0], parts[1] - 1, 1);
      }
    }
    return new Date();
  });

  // Code verification states
  const [pickupCodeInput, setPickupCodeInput] = useState<Record<string, string>>({});
  const [returnCodeInput, setReturnCodeInput] = useState<Record<string, string>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Month navigation
  const prevMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const now = new Date();
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayStr);
  };

  // Status mapping config for all 4 stages
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          stage: 'Stage 1',
          name: 'Pending',
          badgeText: 'Stage 1: Pending Proposal',
          chipBg: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 hover:border-amber-500/60',
          dotBg: 'bg-amber-500',
          icon: '⏳',
        };
      case 'ACCEPTED':
        return {
          stage: 'Stage 2',
          name: 'Accepted',
          badgeText: 'Stage 2: Accepted Meetup',
          chipBg: 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30 hover:border-blue-500/60',
          dotBg: 'bg-blue-500',
          icon: '🤝',
        };
      case 'HANDED_OVER':
        return {
          stage: 'Stage 3',
          name: 'Received',
          badgeText: 'Stage 3: Received (In Use)',
          chipBg: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 hover:border-emerald-500/60',
          dotBg: 'bg-emerald-500',
          icon: '📦',
        };
      case 'COMPLETED':
        return {
          stage: 'Stage 4',
          name: 'Rec Back',
          badgeText: 'Stage 4: Received Back',
          chipBg: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30 hover:border-purple-500/60',
          dotBg: 'bg-purple-500',
          icon: '✅',
        };
      case 'REJECTED':
      case 'CANCELLED':
      default:
        return {
          stage: 'Closed',
          name: status.toLowerCase(),
          badgeText: status,
          chipBg: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700',
          dotBg: 'bg-zinc-400',
          icon: '⚪',
        };
    }
  };

  // Get all active/pending bookings touching a specific date
  const getBookingsForDate = (dateStr: string) => {
    return bookings.filter((b) => {
      if (b.status === 'REJECTED' || b.status === 'CANCELLED') return false;
      const bStart = cleanYMD(b.start_date);
      const bEnd = cleanYMD(b.end_date || b.start_date);
      return bStart && bEnd && dateStr >= bStart && dateStr <= bEnd;
    });
  };

  // Generate calendar days for the current month
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      bookings: Booking[];
    }> = [];

    // Empty slots before 1st day of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dateStr: '',
        dayNum: 0,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        bookings: [],
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = formatYMD(d);
      const dayBookings = getBookingsForDate(dateStr);
      days.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        bookings: dayBookings,
      });
    }

    return days;
  }, [calendarMonth, bookings, selectedDate, todayStr]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Selected date handoffs list
  const selectedHandoffs = useMemo(() => {
    return getBookingsForDate(selectedDate);
  }, [selectedDate, bookings]);

  return (
    <div className="space-y-6">
      
      {/* Calendar Card Container */}
      <div className="bg-white dark:bg-[#171821] border border-divider rounded-3xl p-4 sm:p-6 shadow-sm">
        
        {/* Month Header Navigation & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-divider">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <CalendarIcon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-ink font-display">
                {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </h2>
              <p className="text-xs text-ink-secondary">
                Track all rentals across Pending, Accepted, Received & Rec Back
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 rounded-xl border border-divider hover:bg-canvas text-xs font-bold text-ink cursor-pointer transition-colors shadow-2xs"
            >
              Today
            </button>
            <div className="flex items-center gap-1 bg-canvas border border-divider rounded-xl p-0.5">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-surface text-ink-secondary hover:text-ink cursor-pointer transition-colors"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-surface text-ink-secondary hover:text-ink cursor-pointer transition-colors"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 4 STAGES STATUS LEGEND */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-5 text-xs font-bold py-3.5 border-b border-divider/60">
          <span className="text-[10px] font-black uppercase text-ink-muted tracking-wider">Statuses:</span>
          
          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-amber-800 dark:text-amber-300 text-[11px] font-extrabold">Stage 1: Pending</span>
          </div>

          <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-blue-800 dark:text-blue-300 text-[11px] font-extrabold">Stage 2: Accepted</span>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold">Stage 3: Received (In Use)</span>
          </div>

          <div className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-purple-800 dark:text-purple-300 text-[11px] font-extrabold">Stage 4: Rec Back (Completed)</span>
          </div>
        </div>

        {/* Calendar Weekday Names */}
        <div className="grid grid-cols-7 gap-1 pt-4 pb-2 text-center text-[11px] font-black uppercase tracking-wider text-ink-muted">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Calendar Month Days Grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {calendarDays.map((d, index) => {
            if (!d.isCurrentMonth) {
              return (
                <div
                  key={`empty-${index}`}
                  className="min-h-[72px] sm:min-h-[92px] rounded-2xl bg-canvas/40 border border-transparent"
                />
              );
            }

            return (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => setSelectedDate(d.dateStr)}
                className={`min-h-[72px] sm:min-h-[92px] p-1.5 sm:p-2 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between border relative overflow-hidden group ${
                  d.isSelected
                    ? 'border-brand ring-2 ring-brand/30 bg-brand-soft/20 dark:bg-brand/10 shadow-sm'
                    : d.isToday
                    ? 'border-brand/50 bg-canvas hover:border-brand shadow-xs'
                    : d.bookings.length > 0
                    ? 'border-divider bg-surface hover:border-zinc-400 dark:hover:border-zinc-600 shadow-2xs'
                    : 'border-divider/50 bg-canvas/30 hover:bg-canvas hover:border-divider'
                }`}
              >
                {/* Day Number and Today Indicator */}
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs font-black ${
                    d.isSelected ? 'text-brand' : d.isToday ? 'text-brand font-extrabold' : 'text-ink'
                  }`}>
                    {d.dayNum}
                  </span>

                  {d.isToday && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-brand text-white shrink-0">
                      Today
                    </span>
                  )}
                </div>

                {/* Event Chips inside the day */}
                <div className="space-y-1 w-full mt-1">
                  {d.bookings.slice(0, 2).map((b) => {
                    const cfg = getStatusConfig(b.status);
                    const bStart = cleanYMD(b.start_date);
                    const bEnd = cleanYMD(b.end_date || b.start_date);
                    
                    let prefix = cfg.icon;
                    if (d.dateStr === bStart) {
                      prefix = `${cfg.icon} Pickup:`;
                    } else if (d.dateStr === bEnd) {
                      prefix = `${cfg.icon} Return:`;
                    } else {
                      prefix = `${cfg.icon} Active:`;
                    }

                    return (
                      <div
                        key={b.id}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border truncate w-full flex items-center gap-1 transition-transform group-hover:scale-[1.02] ${cfg.chipBg}`}
                        title={`${cfg.badgeText}: ${b.item_title}`}
                      >
                        <span className="truncate">
                          {prefix} {b.item_title}
                        </span>
                      </div>
                    );
                  })}

                  {d.bookings.length > 2 && (
                    <div className="text-[9px] font-black text-ink-muted text-center">
                      +{d.bookings.length - 2} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: SCHEDULED HANDOFFS FOR SELECTED DATE                           */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        
        {/* Section Header */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-ink font-display flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-brand" />
              <span>Scheduled Handoffs for {formatDisplayDate(selectedDate)}</span>
              {selectedDate === todayStr && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-brand text-white">
                  Today
                </span>
              )}
            </h3>
            <p className="text-xs text-ink-secondary">
              Review and manage bookings active or requiring meetup on this date
            </p>
          </div>

          <span className="text-xs font-bold text-ink-secondary bg-canvas px-3 py-1 rounded-full border border-divider">
            {selectedHandoffs.length} {selectedHandoffs.length === 1 ? 'booking' : 'bookings'}
          </span>
        </div>

        {/* Selected Handoffs List */}
        {selectedHandoffs.length === 0 ? (
          <div className="p-8 sm:p-10 text-center bg-white dark:bg-[#171821] border border-divider rounded-3xl space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-soft/50 text-brand flex items-center justify-center mx-auto mb-2">
              <CalendarIcon className="w-6 h-6 stroke-[1.8]" />
            </div>
            <p className="text-sm font-bold text-ink">
              No handoffs scheduled on {formatDisplayDate(selectedDate)}
            </p>
            <p className="text-xs text-ink-secondary max-w-md mx-auto">
              Select any highlighted day on the calendar above to view its ongoing rentals, deliveries, and return collections.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedHandoffs.map((booking) => {
              const isLender = booking.lender_id === user?.id || (user as any)?.firebase_uid === booking.lender_id;
              const otherPartyName = isLender ? (booking.borrower_name || 'Renter') : (booking.lender_name || 'Owner');
              const otherPartyAvatar = isLender ? booking.borrower_avatar : booking.lender_avatar;
              const cfg = getStatusConfig(booking.status);
              const bStart = cleanYMD(booking.start_date);
              const bEnd = cleanYMD(booking.end_date || booking.start_date);

              return (
                <div
                  key={booking.id}
                  className="bg-white dark:bg-[#171821] border border-divider rounded-3xl p-5 sm:p-6 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all space-y-4"
                >
                  {/* Top Row: Item Image + Title + Status + Price */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <img
                        src={booking.item_images?.[0] || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80'}
                        alt={booking.item_title}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-divider shrink-0 shadow-xs"
                      />

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-base sm:text-lg text-ink font-display">
                            {booking.item_title}
                          </h4>

                          {/* 4 STAGE STATUS BADGE */}
                          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${cfg.chipBg}`}>
                            {cfg.icon} {cfg.badgeText}
                          </span>

                          <span className="text-[10px] font-bold text-ink-muted bg-canvas border border-divider px-2 py-0.5 rounded-full">
                            {isLender ? 'You are Lending' : 'You are Borrowing'}
                          </span>
                        </div>

                        {/* Dates & Pricing */}
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-secondary">
                          <span className="flex items-center gap-1 text-ink">
                            <Clock className="w-3.5 h-3.5 text-brand" />
                            <span>{formatDisplayDate(bStart)} → {formatDisplayDate(bEnd)} ({booking.duration_days} days)</span>
                          </span>
                          <span>•</span>
                          <span className="font-extrabold text-ink font-display">
                            {Number(booking.total_price) === 0 ? 'Free (Borrow)' : `₹${Number(booking.total_price)}`}
                          </span>
                        </div>

                        {/* Counterparty info */}
                        <div className="flex items-center gap-2 text-xs text-ink-secondary font-medium pt-0.5">
                          <img
                            src={otherPartyAvatar || (otherPartyName ? `https://ui-avatars.com/api/?name=${encodeURIComponent(otherPartyName)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')}
                            alt={otherPartyName}
                            className="w-5 h-5 rounded-full object-cover border border-divider"
                          />
                          <span>{isLender ? 'Renter: ' : 'Owner: '}</span>
                          <strong className="text-ink">{otherPartyName}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Chat Action */}
                    {onOpenChat && (
                      <button
                        type="button"
                        onClick={() => onOpenChat(booking.id)}
                        className="btn-secondary text-xs px-4 py-2 font-bold cursor-pointer inline-flex items-center gap-1.5 w-full sm:w-auto justify-center hover:border-brand hover:text-brand transition-colors shrink-0"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-brand" />
                        <span>Chat with {otherPartyName}</span>
                      </button>
                    )}
                  </div>

                  {/* Logistics info */}
                  <div className="p-3 bg-canvas rounded-2xl border border-divider text-xs text-ink-secondary grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="flex items-start gap-2">
                      <span className="text-base shrink-0 mt-0.5">🚗</span>
                      <div>
                        <div className="font-bold text-ink">
                          {booking.requires_delivery ? 'Lender Drop-off Delivery' : 'Renter Self-Pickup'}
                        </div>
                        <div className="text-[11px] text-ink-secondary">
                          {booking.requires_delivery
                            ? 'Owner delivers gear directly to the renter'
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
                  {/* ACTIONS FOR STAGE 1: PENDING                             */}
                  {/* ======================================================== */}
                  {booking.status === 'PENDING' && (
                    <div className="pt-2 border-t border-divider flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-xs text-ink-secondary">
                        {isLender
                          ? 'Review proposal dates & times above. You can accept or decline.'
                          : 'Waiting for gear owner to accept your rental proposal.'}
                      </div>

                      {isLender && onStatusUpdate && (
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            disabled={actionLoadingId === booking.id}
                            onClick={async () => {
                              setActionLoadingId(booking.id);
                              await onStatusUpdate(booking.id, 'REJECTED');
                              setActionLoadingId(null);
                            }}
                            className="btn-secondary text-xs px-4 py-2 text-rose-500 hover:border-rose-500 font-bold cursor-pointer"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            disabled={actionLoadingId === booking.id}
                            onClick={async () => {
                              setActionLoadingId(booking.id);
                              await onStatusUpdate(booking.id, 'ACCEPTED');
                              setActionLoadingId(null);
                            }}
                            className="btn-primary text-xs px-6 py-2 shadow-pink font-bold cursor-pointer inline-flex items-center gap-1.5"
                          >
                            {actionLoadingId === booking.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            )}
                            <span>Accept Proposal</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* ACTIONS FOR STAGE 2: ACCEPTED                            */}
                  {/* ======================================================== */}
                  {booking.status === 'ACCEPTED' && (
                    <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-blue-600" />
                          <h5 className="text-xs font-black uppercase tracking-wider text-ink">
                            Stage 2: Meet & Exchange 6-Digit Handover Code
                          </h5>
                        </div>
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                          Agreed meetup time
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* Renter's View: Show the Pickup Code */}
                        {!isLender ? (
                          <div className="p-3 bg-surface rounded-xl border border-blue-500/30 space-y-1.5">
                            <div className="text-[10px] font-black uppercase text-ink-muted">
                              Your 6-Digit Pickup Code (Give this to owner)
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xl sm:text-2xl font-black text-brand tracking-widest">
                                {booking.pickup_code || '------'}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(booking.pickup_code || '', booking.id)}
                                className="p-1.5 rounded-lg hover:bg-canvas text-ink-secondary hover:text-ink cursor-pointer transition-colors"
                              >
                                {copiedId === booking.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Lender's View: Input Renter's Code to Verify Handover */
                          onVerifyPickup && (
                            <div className="space-y-1.5">
                              <div className="text-[10px] font-black uppercase text-ink-muted">
                                Enter Renter's 6-Digit Code
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  maxLength={6}
                                  placeholder="e.g. 582194"
                                  value={pickupCodeInput[booking.id] || ''}
                                  onChange={(e) => setPickupCodeInput((prev) => ({ ...prev, [booking.id]: e.target.value.replace(/\D/g, '') }))}
                                  className="w-36 bg-surface border border-divider rounded-xl px-3 py-2 text-center text-sm font-black tracking-widest font-mono text-ink focus:outline-none focus:border-brand"
                                />
                                <button
                                  type="button"
                                  disabled={verifyingId === booking.id}
                                  onClick={async () => {
                                    const code = pickupCodeInput[booking.id]?.trim();
                                    if (code) {
                                      setVerifyingId(booking.id);
                                      await onVerifyPickup(booking.id, code);
                                      setVerifyingId(null);
                                    }
                                  }}
                                  className="btn-primary text-xs px-4 py-2 font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-pink shrink-0"
                                >
                                  {verifyingId === booking.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                  <span>Verify Handover</span>
                                </button>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* ACTIONS FOR STAGE 3: RECEIVED (IN USE)                   */}
                  {/* ======================================================== */}
                  {booking.status === 'HANDED_OVER' && (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <h5 className="text-xs font-black uppercase tracking-wider text-ink">
                            Stage 3: Product In Use — Return Handover
                          </h5>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          Due: {formatDisplayDate(bEnd)} {booking.end_time || '18:00'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* Lender's View: Show the Return Code */}
                        {isLender ? (
                          <div className="p-3 bg-surface rounded-xl border border-emerald-500/30 space-y-1.5">
                            <div className="text-[10px] font-black uppercase text-ink-muted">
                              Your 6-Digit Return Code (Give to renter upon return)
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xl sm:text-2xl font-black text-emerald-600 tracking-widest">
                                {booking.return_code || '------'}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(booking.return_code || '', booking.id)}
                                className="p-1.5 rounded-lg hover:bg-canvas text-ink-secondary hover:text-ink cursor-pointer transition-colors"
                              >
                                {copiedId === booking.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Renter's View: Input Lender's Return Code to Complete */
                          onVerifyReturn && (
                            <div className="space-y-1.5">
                              <div className="text-[10px] font-black uppercase text-ink-muted">
                                Enter Owner's 6-Digit Return Code
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  maxLength={6}
                                  placeholder="e.g. 749210"
                                  value={returnCodeInput[booking.id] || ''}
                                  onChange={(e) => setReturnCodeInput((prev) => ({ ...prev, [booking.id]: e.target.value.replace(/\D/g, '') }))}
                                  className="w-36 bg-surface border border-divider rounded-xl px-3 py-2 text-center text-sm font-black tracking-widest font-mono text-ink focus:outline-none focus:border-brand"
                                />
                                <button
                                  type="button"
                                  disabled={verifyingId === booking.id}
                                  onClick={async () => {
                                    const code = returnCodeInput[booking.id]?.trim();
                                    if (code) {
                                      setVerifyingId(booking.id);
                                      await onVerifyReturn(booking.id, code);
                                      setVerifyingId(null);
                                    }
                                  }}
                                  className="btn-primary text-xs px-4 py-2 font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-pink shrink-0"
                                >
                                  {verifyingId === booking.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                  <span>Complete Return</span>
                                </button>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* ACTIONS FOR STAGE 4: REC BACK (COMPLETED)                */}
                  {/* ======================================================== */}
                  {booking.status === 'COMPLETED' && (
                    <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-black text-purple-700 dark:text-purple-300">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Stage 4: Product Received Back & Rental Completed</span>
                        </div>
                        <p className="text-[11px] text-ink-secondary mt-0.5">
                          Gear has been safely returned. Leave your 3-day feedback and rating to build trust in your neighborhood!
                        </p>
                      </div>

                      {onOpenReview && !booking.user_review_id && (
                        <button
                          type="button"
                          onClick={() => onOpenReview(booking)}
                          className="btn-primary text-xs px-4 py-2 font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-pink shrink-0"
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>Leave Review</span>
                        </button>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
