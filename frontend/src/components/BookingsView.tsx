import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
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
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  CalendarCheck2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../lib/api';
import { Booking } from '../lib/types';
import { useAuth } from '../lib/authContext';
import { ReviewModal } from './ReviewModal';

interface BookingsViewProps {
  onOpenChat: (bookingId: string) => void;
}

// Date string normalization ('YYYY-MM-DD')
const normalizeDateStr = (d?: string | null): string => {
  if (!d) return '';
  return d.slice(0, 10);
};

// Check if a calendar day falls inside a booking's active date range
const isDateWithinRange = (targetDate: string, startStr?: string | null, endStr?: string | null): boolean => {
  const target = normalizeDateStr(targetDate);
  const start = normalizeDateStr(startStr);
  const end = normalizeDateStr(endStr) || start;
  if (!target || !start) return false;
  return target >= start && target <= end;
};

// Safe date formatter for friendly labels
const formatFriendlyDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export const BookingsView: React.FC<BookingsViewProps> = ({ onOpenChat }) => {
  const { user } = useAuth();
  
  // 3 Primary Sections requested by user:
  // 1. 'ongoing' - All ongoing / active bookings (ACCEPTED & HANDED_OVER)
  // 2. 'requests' - All incoming / outgoing booking requests (PENDING)
  // 3. 'finished' - All finished bookings (COMPLETED & history)
  const [activeTab, setActiveTab] = useState<'ongoing' | 'requests' | 'finished'>('ongoing');
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calendar State
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayStr = useMemo(() => {
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [today]);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);

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

  // Accept or Decline a proposal
  const handleStatusUpdate = async (bookingId: string, status: 'ACCEPTED' | 'REJECTED' | 'CANCELLED') => {
    try {
      const updated = await api.updateBookingStatus(bookingId, status);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...updated, status } : b))
      );

      if (status === 'ACCEPTED') {
        try {
          confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
        } catch {}
        // Automatically switch to Ongoing tab and highlight this newly active booking
        setActiveTab('ongoing');
        setSelectedDateFilter(null);
        setHighlightedBookingId(bookingId);
        setTimeout(() => {
          const el = document.getElementById(`booking-${bookingId}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update booking status.');
    }
  };

  // Step 1 of Verification: Handover code confirmation
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
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch {}
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...updated, status: 'HANDED_OVER' } : b))
      );
      setPickupCodeInput((prev) => ({ ...prev, [bookingId]: '' }));
    } catch (err: any) {
      setActionError((prev) => ({ ...prev, [bookingId]: err.message || 'Incorrect verification code.' }));
    } finally {
      setVerifyingId(null);
    }
  };

  // Step 2 of Verification: Return code confirmation (Completes the rental)
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
      try {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      } catch {}
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...updated, status: 'COMPLETED' } : b))
      );
      setReturnCodeInput((prev) => ({ ...prev, [bookingId]: '' }));
      // Advance to finished tab & prompt review
      setActiveTab('finished');
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

  // Groupings for the 3 distinct sections
  const ongoingList = useMemo(() => {
    return bookings.filter((b) => b.status === 'ACCEPTED' || b.status === 'HANDED_OVER');
  }, [bookings]);

  const requestsList = useMemo(() => {
    return bookings.filter((b) => b.status === 'PENDING');
  }, [bookings]);

  const finishedList = useMemo(() => {
    return bookings.filter((b) => ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(b.status));
  }, [bookings]);

  // Map of date strings -> ongoing bookings for fast calendar lookup
  const activeBookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of ongoingList) {
      const start = normalizeDateStr(b.start_date);
      const end = normalizeDateStr(b.end_date) || start;
      if (!start) continue;

      const [sy, sm, sd] = start.split('-').map(Number);
      const [ey, em, ed] = end.split('-').map(Number);
      const curr = new Date(sy, (sm || 1) - 1, sd || 1);
      const stop = new Date(ey, (em || 1) - 1, ed || 1);

      // Guard against corrupted date ranges exceeding 90 days
      let count = 0;
      while (curr <= stop && count < 90) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        const ds = `${y}-${m}-${d}`;

        const existing = map.get(ds) || [];
        existing.push(b);
        map.set(ds, existing);

        curr.setDate(curr.getDate() + 1);
        count++;
      }
    }
    return map;
  }, [ongoingList]);

  // Handlers for month navigation in Calendar
  const prevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const goToToday = () => {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  // Compute month calendar grid days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      activeBookings: Booking[];
    }> = [];

    // Prefix empty/prev month days
    for (let i = 0; i < firstDayIndex; i++) {
      const prevDate = new Date(year, month, -firstDayIndex + i + 1);
      const py = prevDate.getFullYear();
      const pm = String(prevDate.getMonth() + 1).padStart(2, '0');
      const pd = String(prevDate.getDate()).padStart(2, '0');
      const pstr = `${py}-${pm}-${pd}`;
      days.push({
        dateStr: pstr,
        dayNumber: prevDate.getDate(),
        isCurrentMonth: false,
        isToday: pstr === todayStr,
        activeBookings: activeBookingsByDate.get(pstr) || [],
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const cmStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr: cmStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: cmStr === todayStr,
        activeBookings: activeBookingsByDate.get(cmStr) || [],
      });
    }

    // Trailing padding to fill complete grid row
    const remainder = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainder; i++) {
      const nextDate = new Date(year, month + 1, i);
      const ny = nextDate.getFullYear();
      const nm = String(nextDate.getMonth() + 1).padStart(2, '0');
      const nd = String(nextDate.getDate()).padStart(2, '0');
      const nstr = `${ny}-${nm}-${nd}`;
      days.push({
        dateStr: nstr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: nstr === todayStr,
        activeBookings: activeBookingsByDate.get(nstr) || [],
      });
    }

    return days;
  }, [currentMonth, activeBookingsByDate, todayStr]);

  // Click a calendar date -> navigate to Ongoing section and highlight the booking
  const handleSelectCalendarDate = (dateStr: string, activeOnDate: Booking[]) => {
    if (activeOnDate.length > 0) {
      setActiveTab('ongoing');
      setSelectedDateFilter(dateStr);
      setHighlightedBookingId(activeOnDate[0].id);

      setTimeout(() => {
        const el = document.getElementById(`booking-${activeOnDate[0].id}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } else {
      setSelectedDateFilter(dateStr);
    }
  };

  // Filtered ongoing list if date filter is active
  const displayedOngoingList = useMemo(() => {
    if (!selectedDateFilter) return ongoingList;
    return ongoingList.filter((b) => isDateWithinRange(selectedDateFilter, b.start_date, b.end_date));
  }, [ongoingList, selectedDateFilter]);

  // Helper to check 3-day review window for finished bookings
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

  const currentMonthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-150 space-y-6">
      
      {/* ======================================================== */}
      {/* 1. HEADER & SUMMARY BAR                                  */}
      {/* ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-divider">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display flex items-center gap-2.5">
            <span>My Bookings & Handoffs</span>
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary font-medium mt-1">
            Complete clarity over your active rentals, incoming requests, and finished handoffs
          </p>
        </div>

        {/* Quick Summary Badges */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={() => { setActiveTab('ongoing'); setSelectedDateFilter(null); }}
            className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'ongoing'
                ? 'bg-brand text-white border-brand shadow-sm'
                : 'bg-surface hover:bg-canvas border-divider text-ink'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Ongoing:</span>
            <span className="font-mono font-black">{ongoingList.length}</span>
          </button>

          <button
            onClick={() => { setActiveTab('requests'); setSelectedDateFilter(null); }}
            className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'requests'
                ? 'bg-brand text-white border-brand shadow-sm'
                : 'bg-surface hover:bg-canvas border-divider text-ink'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Requests:</span>
            <span className="font-mono font-black">{requestsList.length}</span>
          </button>

          <button
            onClick={() => { setActiveTab('finished'); setSelectedDateFilter(null); }}
            className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'finished'
                ? 'bg-brand text-white border-brand shadow-sm'
                : 'bg-surface hover:bg-canvas border-divider text-ink'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span>Finished:</span>
            <span className="font-mono font-black">{finishedList.length}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. INTERACTIVE ACTIVE RENTAL CALENDAR                     */}
      {/* ======================================================== */}
      <div className="bg-surface border border-divider rounded-3xl p-5 sm:p-6 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-divider">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
              <CalendarCheck2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-ink font-display flex items-center gap-2">
                <span>Active Rental Schedule & Calendar</span>
                {ongoingList.length > 0 && (
                  <span className="text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {ongoingList.length} Active {ongoingList.length === 1 ? 'Order' : 'Orders'}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-ink-secondary">
                Click any highlighted date to jump directly to the active order details
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToToday}
              className="px-2.5 py-1 rounded-xl text-xs font-bold border border-divider hover:bg-canvas text-ink transition-colors cursor-pointer"
            >
              Today
            </button>
            <div className="flex items-center gap-1 bg-canvas p-1 rounded-xl border border-divider">
              <button
                type="button"
                onClick={prevMonth}
                className="w-7 h-7 rounded-lg hover:bg-surface flex items-center justify-center text-ink cursor-pointer transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-ink px-2 min-w-[120px] text-center">
                {currentMonthLabel}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="w-7 h-7 rounded-lg hover:bg-surface flex items-center justify-center text-ink cursor-pointer transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
              className="text-xs font-bold text-ink-secondary hover:text-ink px-2 py-1 rounded-lg hover:bg-canvas transition-colors ml-1"
            >
              {isCalendarExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        {isCalendarExpanded && (
          <div className="pt-4">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[11px] font-bold text-ink-secondary mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {calendarDays.map((day, idx) => {
                const hasActive = day.activeBookings.length > 0;
                const isSelected = selectedDateFilter === day.dateStr;

                return (
                  <button
                    key={`${day.dateStr}-${idx}`}
                    type="button"
                    onClick={() => handleSelectCalendarDate(day.dateStr, day.activeBookings)}
                    className={`relative min-h-[58px] sm:min-h-[70px] p-1.5 sm:p-2 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-brand ring-2 ring-brand/40 bg-brand/10 shadow-sm'
                        : hasActive
                        ? 'border-pink-500/40 bg-pink-500/10 hover:bg-pink-500/20'
                        : day.isCurrentMonth
                        ? 'border-divider bg-canvas/40 hover:bg-canvas'
                        : 'border-transparent bg-transparent opacity-40 hover:opacity-75'
                    }`}
                    title={
                      hasActive
                        ? `Active rental on this date: ${day.activeBookings.map((b) => b.item_title).join(', ')}`
                        : undefined
                    }
                  >
                    {/* Top Row: Date Number + Today indicator */}
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs font-bold leading-none ${
                          day.isToday
                            ? 'w-5 h-5 rounded-full bg-ink text-canvas flex items-center justify-center font-black'
                            : hasActive
                            ? 'text-brand font-black'
                            : 'text-ink'
                        }`}
                      >
                        {day.dayNumber}
                      </span>

                      {hasActive && (
                        <span className="w-2 h-2 rounded-full bg-brand animate-pulse shrink-0" />
                      )}
                    </div>

                    {/* Active Booking snippet or count pill */}
                    {hasActive ? (
                      <div className="w-full mt-1">
                        <div className="text-[10px] font-black text-brand line-clamp-1 truncate bg-white/70 dark:bg-black/40 px-1 py-0.5 rounded-md border border-brand/20">
                          {day.activeBookings[0].item_title}
                        </div>
                        {day.activeBookings.length > 1 && (
                          <span className="text-[9px] font-black text-ink-secondary block mt-0.5">
                            +{day.activeBookings.length - 1} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="h-4" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Calendar Legend & Filter indicator */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-4 mt-3 border-t border-divider text-xs text-ink-secondary">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                  <span>Active Rental Date</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-ink" />
                  <span>Today</span>
                </span>
              </div>

              {selectedDateFilter && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink">
                    Filtered by date: {formatFriendlyDate(selectedDateFilter)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDateFilter(null)}
                    className="text-xs font-bold text-brand hover:underline cursor-pointer"
                  >
                    Clear filter
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. THREE MAIN TABS (Ongoing, Requests, Finished)         */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        
        {/* Tab 1: Ongoing Bookings */}
        <button
          onClick={() => { setActiveTab('ongoing'); }}
          className={`p-4 rounded-2xl text-left border transition-all cursor-pointer relative overflow-hidden flex items-center justify-between ${
            activeTab === 'ongoing'
              ? 'bg-surface border-brand ring-2 ring-brand/20 shadow-sm'
              : 'bg-canvas/60 border-divider hover:bg-surface hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-ink font-display">
                Ongoing Bookings
              </span>
            </div>
            <p className="text-[11px] text-ink-secondary font-medium mt-0.5">
              Active handoffs & in-use rentals
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
            activeTab === 'ongoing' ? 'bg-brand text-white' : 'bg-canvas text-ink-secondary border border-divider'
          }`}>
            {ongoingList.length}
          </span>
        </button>

        {/* Tab 2: Booking Requests */}
        <button
          onClick={() => { setActiveTab('requests'); setSelectedDateFilter(null); }}
          className={`p-4 rounded-2xl text-left border transition-all cursor-pointer relative overflow-hidden flex items-center justify-between ${
            activeTab === 'requests'
              ? 'bg-surface border-brand ring-2 ring-brand/20 shadow-sm'
              : 'bg-canvas/60 border-divider hover:bg-surface hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-black uppercase tracking-wider text-ink font-display">
                Booking Requests
              </span>
            </div>
            <p className="text-[11px] text-ink-secondary font-medium mt-0.5">
              Proposals to accept or decline
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
            activeTab === 'requests' ? 'bg-brand text-white' : 'bg-canvas text-ink-secondary border border-divider'
          }`}>
            {requestsList.length}
          </span>
        </button>

        {/* Tab 3: Finished Bookings */}
        <button
          onClick={() => { setActiveTab('finished'); setSelectedDateFilter(null); }}
          className={`p-4 rounded-2xl text-left border transition-all cursor-pointer relative overflow-hidden flex items-center justify-between ${
            activeTab === 'finished'
              ? 'bg-surface border-brand ring-2 ring-brand/20 shadow-sm'
              : 'bg-canvas/60 border-divider hover:bg-surface hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs font-black uppercase tracking-wider text-ink font-display">
                Finished Bookings
              </span>
            </div>
            <p className="text-[11px] text-ink-secondary font-medium mt-0.5">
              Completed exchanges & reviews
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
            activeTab === 'finished' ? 'bg-brand text-white' : 'bg-canvas text-ink-secondary border border-divider'
          }`}>
            {finishedList.length}
          </span>
        </button>

      </div>

      {/* Active Date Filter Banner if filtered from calendar */}
      {selectedDateFilter && activeTab === 'ongoing' && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-brand/10 border border-brand/20 text-xs font-bold text-brand animate-in fade-in">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span>
              Showing active bookings for {formatFriendlyDate(selectedDateFilter)} ({displayedOngoingList.length} found)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDateFilter(null)}
            className="px-2.5 py-1 rounded-lg bg-surface text-ink hover:text-brand text-xs font-bold border border-divider shadow-2xs transition-colors cursor-pointer"
          >
            Show All Ongoing
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. TAB CONTENTS & BOOKING CARDS                          */}
      {/* ======================================================== */}
      {isLoading ? (
        <div className="py-24 text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-ink-secondary">Loading rental handoffs...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: ONGOING BOOKINGS */}
          {activeTab === 'ongoing' && (
            <div className="space-y-4">
              {displayedOngoingList.length === 0 ? (
                <div className="py-20 text-center bg-surface border border-divider rounded-3xl p-8 max-w-2xl mx-auto space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto mb-2">
                    <Package className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <p className="text-base font-bold text-ink">
                    {selectedDateFilter
                      ? `No active rentals scheduled for ${formatFriendlyDate(selectedDateFilter)}`
                      : 'No ongoing rentals right now'}
                  </p>
                  <p className="text-xs text-ink-secondary max-w-md mx-auto">
                    When you accept a booking request or an order is confirmed, all its meetup, handover, and return details with live codes will be right here.
                  </p>
                  {selectedDateFilter && (
                    <button
                      type="button"
                      onClick={() => setSelectedDateFilter(null)}
                      className="btn-primary text-xs px-4 py-2 mt-2 font-bold cursor-pointer"
                    >
                      View All Ongoing
                    </button>
                  )}
                </div>
              ) : (
                displayedOngoingList.map((booking) => {
                  const isLender = booking.lender_id === user?.id;
                  const otherPartyName = isLender ? (booking.borrower_name || 'Borrower') : (booking.lender_name || 'Lender');
                  const otherPartyAvatar = isLender ? booking.borrower_avatar : booking.lender_avatar;
                  const isHighlighted = highlightedBookingId === booking.id;

                  return (
                    <div
                      key={booking.id}
                      id={`booking-${booking.id}`}
                      className={`bg-surface border rounded-3xl p-5 sm:p-6 shadow-sm transition-all space-y-4 relative ${
                        isHighlighted
                          ? 'border-brand ring-2 ring-brand/40 bg-brand/5'
                          : 'border-divider hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      {/* Top Header: Gear info + Status Pill + Direct Message */}
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
                                booking.status === 'ACCEPTED'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {booking.status === 'ACCEPTED' ? '● Handover & Meetup Stage' : '● Currently In Use'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-secondary">
                              <span className="flex items-center gap-1 text-ink">
                                <CalendarIcon className="w-3.5 h-3.5 text-brand" />
                                <span>{booking.start_date} → {booking.end_date || booking.start_date} ({booking.duration_days} days)</span>
                              </span>
                              <span>•</span>
                              <span className="font-extrabold text-ink font-display">
                                {Number(booking.total_price) === 0 ? 'Free (Borrow)' : `₹${Number(booking.total_price)}`}
                              </span>
                            </div>

                            <div className="text-xs text-ink-secondary font-medium flex items-center gap-1.5">
                              {otherPartyAvatar && (
                                <img src={otherPartyAvatar} alt={otherPartyName} className="w-4 h-4 rounded-full object-cover" />
                              )}
                              <span>{isLender ? 'Lending to:' : 'Renting from:'}</span>
                              <strong className="text-ink">{otherPartyName}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Direct Message button */}
                        <div className="shrink-0 w-full sm:w-auto flex sm:flex-col items-end gap-2">
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

                      {/* Handoff & Pickup Logistics Details */}
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
                            <div className="text-[10px] text-ink-secondary font-medium mt-0.5">
                              Pickup Time: {booking.start_time || '10:00'}
                            </div>
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
                            <div className="text-[10px] text-ink-secondary font-medium mt-0.5">
                              Return Due: {booking.end_date || booking.start_date} at {booking.end_time || '18:00'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 6-DIGIT CODE SECTION: HANDOVER CODE (If ACCEPTED) */}
                      {booking.status === 'ACCEPTED' && (
                        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <KeyRound className="w-4 h-4 text-blue-600" />
                              <h4 className="text-xs font-black uppercase tracking-wider text-ink font-display">
                                Handover Verification (Meetup Phase)
                              </h4>
                            </div>
                            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                              Exchange 6-digit code at meetup
                            </span>
                          </div>

                          <p className="text-xs text-ink-secondary leading-relaxed">
                            {isLender
                              ? `When you hand over ${booking.item_title} to ${otherPartyName}, enter their 6-digit code below to confirm they accepted the product, or give them your code.`
                              : `When receiving ${booking.item_title} from ${otherPartyName}, give them your 6-digit code shown below, or enter their code to verify.`}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
                            {/* Your Handover Code Display */}
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
                                      <span className="text-[11px]">Copy Code</span>
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

                      {/* 6-DIGIT CODE SECTION: RETURN CODE (If HANDED_OVER) */}
                      {booking.status === 'HANDED_OVER' && (
                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-emerald-600" />
                              <h4 className="text-xs font-black uppercase tracking-wider text-ink font-display">
                                Gear Currently In Use • Return Due on {booking.end_date || booking.start_date}
                              </h4>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              Handed over on {booking.handed_over_at ? new Date(booking.handed_over_at).toLocaleDateString() : 'Active'}
                            </span>
                          </div>

                          <p className="text-xs text-ink-secondary leading-relaxed">
                            {isLender
                              ? `When ${otherPartyName} returns your item, enter their 6-digit return code below to complete the rental.`
                              : `When returning the product to ${otherPartyName}, give them the 6-digit return code shown below, or enter their code.`}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
                            {/* Return Code Display */}
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
                                      <span className="text-[11px]">Copy Code</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Return Code Input & Verification */}
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

                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: BOOKING REQUESTS (Accept / Decline) */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              {requestsList.length === 0 ? (
                <div className="py-20 text-center bg-surface border border-divider rounded-3xl p-8 max-w-2xl mx-auto space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <p className="text-base font-bold text-ink">No pending booking requests right now</p>
                  <p className="text-xs text-ink-secondary max-w-md mx-auto">
                    When neighbors request to rent your gear or you send out rental proposals, they will appear here for review, chat, and instant approval.
                  </p>
                </div>
              ) : (
                requestsList.map((booking) => {
                  const isLender = booking.lender_id === user?.id;
                  const requesterName = isLender ? (booking.borrower_name || 'Neighbor') : (booking.lender_name || 'Owner');
                  const requesterAvatar = isLender ? booking.borrower_avatar : booking.lender_avatar;

                  return (
                    <div
                      key={booking.id}
                      className="bg-surface border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-sm hover:border-amber-500/60 transition-all space-y-4"
                    >
                      {/* Top Row: Item Details & Requester */}
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
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                {isLender ? 'Incoming Request' : 'Proposal Sent'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-secondary">
                              <span className="flex items-center gap-1 text-ink">
                                <CalendarIcon className="w-3.5 h-3.5 text-brand" />
                                <span>{booking.start_date} → {booking.end_date || booking.start_date} ({booking.duration_days} days)</span>
                              </span>
                              <span>•</span>
                              <span className="font-extrabold text-ink font-display">
                                Total: {Number(booking.total_price) === 0 ? 'Free' : `₹${Number(booking.total_price)}`}
                              </span>
                            </div>

                            <div className="text-xs text-ink-secondary font-medium flex items-center gap-1.5">
                              {requesterAvatar && (
                                <img src={requesterAvatar} alt={requesterName} className="w-4 h-4 rounded-full object-cover" />
                              )}
                              <span>{isLender ? 'Requested by:' : 'Sent to:'}</span>
                              <strong className="text-ink">{requesterName}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Quick Message action */}
                        <div className="shrink-0 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => onOpenChat(booking.id)}
                            className="btn-secondary text-xs px-4 py-2 font-bold cursor-pointer inline-flex items-center gap-1.5 w-full sm:w-auto justify-center hover:border-brand hover:text-brand transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-brand" />
                            <span>Message {requesterName}</span>
                          </button>
                        </div>
                      </div>

                      {/* Requester note if any */}
                      {booking.message && (
                        <div className="p-3 bg-canvas rounded-2xl border border-divider text-xs text-ink-secondary">
                          <span className="font-bold text-ink">Note from {requesterName}: </span>
                          <span>"{booking.message}"</span>
                        </div>
                      )}

                      {/* Logistics Info */}
                      <div className="p-3 bg-canvas/60 rounded-2xl border border-divider text-xs text-ink-secondary flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-brand" />
                          <span>Pickup: {booking.requires_delivery ? 'Owner Delivers' : `Self Pickup (${booking.item_locality || 'Local Hub'})`} at {booking.start_time || '10:00'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>Return: {booking.requires_pickup ? 'Owner Collects' : 'Renter Returns'} at {booking.end_time || '18:00'}</span>
                        </div>
                      </div>

                      {/* Actions: Accept or Reject (If Lender) */}
                      <div className="pt-2 border-t border-divider flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-ink-secondary">
                          {isLender
                            ? 'Accepting this request will immediately activate the booking and schedule it on your calendar.'
                            : 'Waiting for the equipment owner to review and accept your proposal.'}
                        </div>

                        {isLender ? (
                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(booking.id, 'REJECTED')}
                              className="btn-secondary text-xs px-4 py-2 text-rose-500 hover:border-rose-500 font-bold cursor-pointer"
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(booking.id, 'ACCEPTED')}
                              className="btn-primary text-xs px-6 py-2 shadow-pink font-bold cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Accept Booking</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStatusUpdate(booking.id, 'CANCELLED')}
                            className="text-xs text-rose-500 font-bold hover:underline cursor-pointer"
                          >
                            Cancel Proposal
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: FINISHED BOOKINGS */}
          {activeTab === 'finished' && (
            <div className="space-y-4">
              {finishedList.length === 0 ? (
                <div className="py-20 text-center bg-surface border border-divider rounded-3xl p-8 max-w-2xl mx-auto space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <p className="text-base font-bold text-ink">No finished bookings yet</p>
                  <p className="text-xs text-ink-secondary max-w-md mx-auto">
                    All completed rentals, verified returns, and past handoffs will be saved here along with reviews and trust scores.
                  </p>
                </div>
              ) : (
                finishedList.map((booking) => {
                  const isLender = booking.lender_id === user?.id;
                  const partnerName = isLender ? (booking.borrower_name || 'Borrower') : (booking.lender_name || 'Lender');
                  const reviewWindow = getReviewTimeRemaining(booking);

                  return (
                    <div
                      key={booking.id}
                      className="bg-surface border border-divider rounded-3xl p-5 sm:p-6 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all space-y-4"
                    >
                      {/* Top Info */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <img
                            src={booking.item_images?.[0] || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80'}
                            alt={booking.item_title}
                            className="w-16 h-16 rounded-2xl object-cover border border-divider shrink-0 opacity-90"
                          />

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-extrabold text-base sm:text-lg text-ink tracking-tight font-display">
                                {booking.item_title}
                              </h3>
                              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                booking.status === 'COMPLETED'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                              }`}>
                                {booking.status === 'COMPLETED' ? 'Completed & Returned' : booking.status}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-secondary">
                              <span>{booking.start_date} → {booking.end_date || booking.start_date}</span>
                              <span>•</span>
                              <span>₹{Number(booking.total_price)}</span>
                              <span>•</span>
                              <span>{isLender ? `Renter: ${partnerName}` : `Owner: ${partnerName}`}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenChat(booking.id)}
                          className="btn-secondary text-xs px-3.5 py-1.5 font-bold cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat History</span>
                        </button>
                      </div>

                      {/* Review Section (If COMPLETED) */}
                      {booking.status === 'COMPLETED' && (
                        <div className="p-4 rounded-2xl bg-canvas border border-divider flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
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
                              <div className="space-y-0.5">
                                <span className="font-bold text-ink">3-Day Peer Review Window Active</span>
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                                  ⏳ {reviewWindow.label}
                                </p>
                              </div>
                            ) : (
                              <span className="text-ink-secondary font-medium">Review window completed</span>
                            )}
                          </div>

                          {reviewWindow.isOpen && (
                            <button
                              type="button"
                              onClick={() => setReviewBooking(booking)}
                              className="btn-primary text-xs px-4 py-2 font-bold shadow-pink cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                            >
                              <Star className="w-3.5 h-3.5 fill-white text-white" />
                              <span>{booking.user_review_id ? 'Update Review ⭐' : 'Leave Review & Feedback ⭐'}</span>
                            </button>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })
              )}
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
