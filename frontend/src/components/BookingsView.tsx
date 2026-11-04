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
  CalendarCheck2,
  XCircle,
  Ban,
  Upload,
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../lib/api';
import { Booking } from '../lib/types';
import { useAuth } from '../lib/authContext';
import { formatTime12 } from '../lib/formatters';
import { ReviewModal } from './ReviewModal';
import { BookingCard } from './BookingCard';
import { BookingStageModal } from './BookingStageModal';
import { getDayLogisticsStatus, checkIsLender } from '../lib/logistics';

interface BookingsViewProps {
  onOpenChat: (bookingId: string) => void;
  initialTab?: 'ongoing' | 'requests' | 'finished' | 'cancelled';
  initialBookingId?: string | null;
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

export const BookingsView: React.FC<BookingsViewProps> = ({ 
  onOpenChat,
  initialTab = 'ongoing',
  initialBookingId = null,
}) => {
  const { user } = useAuth();
  
  // 4 Primary Sections:
  // 1. 'ongoing' - All ongoing / active bookings (ACCEPTED & HANDED_OVER)
  // 2. 'requests' - All incoming / outgoing booking requests (PENDING)
  // 3. 'finished' - All finished bookings (COMPLETED)
  // 4. 'cancelled' - All cancelled or declined bookings (REJECTED, CANCELLED, DECLINED)
  const [activeTab, setActiveTab] = useState<'ongoing' | 'requests' | 'finished' | 'cancelled'>(initialTab);
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(initialBookingId);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialBookingId) {
      setHighlightedBookingId(initialBookingId);
      const scrollTimer = setTimeout(() => {
        const el = document.getElementById(`booking-${initialBookingId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);

      // Automatically clear highlight after 2.5s so card never stays highlighted or blinks
      const clearTimer = setTimeout(() => {
        setHighlightedBookingId(null);
      }, 2500);

      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [initialBookingId]);
  
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
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);

  // 6-digit verification code input states keyed by booking ID
  const [pickupCodeInput, setPickupCodeInput] = useState<Record<string, string>>({});
  const [returnCodeInput, setReturnCodeInput] = useState<Record<string, string>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Review modal state
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [selectedStageBooking, setSelectedStageBooking] = useState<Booking | null>(null);

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

  const isBookingRequestPassed = (b: Booking): boolean => {
  try {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const endD = (b.end_date || b.start_date || '').slice(0, 10);
    if (endD < todayStr) return true;
    if (endD === todayStr) {
      const endT = (b.end_time || '18:00').slice(0, 5);
      if (endT <= currentHourMin) return true;
    }

    const startD = (b.start_date || '').slice(0, 10);
    if (startD < todayStr) return true;
    if (startD === todayStr) {
      const startT = (b.start_time || '10:00').slice(0, 5);
      if (startT <= currentHourMin) return true;
    }
  } catch {}
  return false;
};

  // Accept or Decline a proposal
  const handleStatusUpdate = async (bookingId: string, status: 'ACCEPTED' | 'REJECTED' | 'CANCELLED') => {
    const b = bookings.find((item) => item.id === bookingId);
    const isProposal = b?.is_proposal || bookingId.startsWith('proposal_');
    const msgId = b?.proposal_message_id || bookingId.replace(/^proposal_/, '');

    if (status === 'ACCEPTED') {
      if (b && isBookingRequestPassed(b)) {
        window.dispatchEvent(new CustomEvent('rentu:toast', {
          detail: {
            type: 'error',
            title: 'Rental Time Passed',
            message: 'This booking request cannot be accepted because its scheduled rental time has already passed. Please message the partner to propose new upcoming dates.',
            duration: 6000,
          }
        }));
        return;
      }
    }

    try {
      if (isProposal) {
        if (status === 'ACCEPTED') {
          const res = await api.acceptProposal(msgId);
          const newBooking = res.booking || {
            ...b,
            id: res.booking?.id || `booking_${Date.now()}`,
            status: 'ACCEPTED'
          };
          setBookings((prev) => [
            newBooking,
            ...prev.filter((item) => item.id !== bookingId && item.proposal_message_id !== msgId)
          ]);

          try {
            confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
          } catch {}

          window.dispatchEvent(new CustomEvent('rentu:toast', {
            detail: {
              type: 'success',
              title: 'Proposal Accepted',
              message: 'Agreement confirmed! Handover is now active in Ongoing Bookings.',
              duration: 5000,
            }
          }));

          setActiveTab('ongoing');
          setSelectedDateFilter(null);
          setHighlightedBookingId(newBooking.id);
          setTimeout(() => {
            const el = document.getElementById(`booking-${newBooking.id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 150);
          return;
        } else {
          await api.declineProposal(msgId);
          setBookings((prev) => prev.filter((item) => item.id !== bookingId && item.proposal_message_id !== msgId));
          window.dispatchEvent(new CustomEvent('rentu:toast', {
            detail: {
              type: 'info',
              title: status === 'CANCELLED' ? 'Proposal Cancelled' : 'Proposal Declined',
              message: 'The proposal has been updated.',
              duration: 4000,
            }
          }));
          return;
        }
      }

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
      window.dispatchEvent(new CustomEvent('rentu:toast', {
        detail: {
          type: 'error',
          title: 'Update Failed',
          message: err.message || 'Failed to update booking status.',
          duration: 5000,
        }
      }));
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

  // Groupings for the 4 distinct sections
  const ongoingList = useMemo(() => {
    return bookings.filter((b) => b.status === 'ACCEPTED' || b.status === 'HANDED_OVER');
  }, [bookings]);

  const requestsList = useMemo(() => {
    return bookings.filter((b) => b.status === 'PENDING');
  }, [bookings]);

  const finishedList = useMemo(() => {
    return bookings.filter((b) => b.status === 'COMPLETED');
  }, [bookings]);

  const cancelledList = useMemo(() => {
    return bookings.filter((b) => b.status === 'REJECTED' || b.status === 'CANCELLED');
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
      setSelectedStageBooking(activeOnDate[0]);

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

  const [ongoingRoleFilter, setOngoingRoleFilter] = useState<'all' | 'lender' | 'renter'>('all');

  // Split ongoing bookings by role: Lender vs Renter
  const ongoingLendingList = useMemo(() => {
    return displayedOngoingList.filter((b) => {
      return Boolean(
        (b.lender_id && (b.lender_id === user?.id || (user as any)?.firebase_uid === b.lender_id)) ||
        (b.lender_name && user?.name && b.lender_name.trim().toLowerCase() === user.name.trim().toLowerCase())
      );
    });
  }, [displayedOngoingList, user]);

  const ongoingRentingList = useMemo(() => {
    return displayedOngoingList.filter((b) => {
      const isLender = Boolean(
        (b.lender_id && (b.lender_id === user?.id || (user as any)?.firebase_uid === b.lender_id)) ||
        (b.lender_name && user?.name && b.lender_name.trim().toLowerCase() === user.name.trim().toLowerCase())
      );
      return !isLender;
    });
  }, [displayedOngoingList, user]);

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
      {/* 1. HEADER (Title & Subtitle)                             */}
      {/* ======================================================== */}
      <div className="pb-6 border-b border-divider">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display flex items-center gap-2.5">
          <span>My Bookings & Handoffs</span>
        </h1>
        <p className="text-xs sm:text-sm text-ink-secondary font-medium mt-1">
          Complete clarity over your active rentals, incoming requests, finished handoffs, and cancelled orders
        </p>
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

                const primaryBooking = hasActive ? day.activeBookings[0] : null;
                const isPrimaryLender = primaryBooking ? checkIsLender(primaryBooking, user) : false;
                const dayStatus = primaryBooking
                  ? getDayLogisticsStatus(day.dateStr, primaryBooking, isPrimaryLender)
                  : null;

                return (
                  <button
                    key={`${day.dateStr}-${idx}`}
                    type="button"
                    onClick={() => handleSelectCalendarDate(day.dateStr, day.activeBookings)}
                    className={`relative min-h-[58px] sm:min-h-[70px] p-1.5 sm:p-2 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-brand ring-2 ring-brand/40 bg-brand/10 shadow-sm'
                        : hasActive && dayStatus
                        ? dayStatus.cellClass
                        : day.isCurrentMonth
                        ? 'border-divider bg-canvas/40 hover:bg-canvas'
                        : 'border-transparent bg-transparent opacity-40 hover:opacity-75'
                    }`}
                    title={
                      hasActive && dayStatus
                        ? `${dayStatus.title} (${day.activeBookings.length} total)`
                        : undefined
                    }
                  >
                    {/* Top Row: Date Number + Logistics indicator dot */}
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs font-bold leading-none ${
                          day.isToday
                            ? 'w-5 h-5 rounded-full bg-ink text-canvas flex items-center justify-center font-black'
                            : hasActive
                            ? 'font-black text-ink'
                            : 'text-ink'
                        }`}
                      >
                        {day.dayNumber}
                      </span>

                      {hasActive && dayStatus && (
                        <span className={`w-2 h-2 rounded-full ${dayStatus.dotColor} animate-pulse shrink-0`} />
                      )}
                    </div>

                    {/* Active Booking snippet or count pill with logistics tag */}
                    {hasActive && dayStatus && primaryBooking ? (
                      <div className="w-full mt-1">
                        <div
                          className={`text-[10px] font-black line-clamp-1 truncate px-1 py-0.5 rounded-md border shadow-2xs ${dayStatus.badgeClass}`}
                          title={`${dayStatus.tag}: ${primaryBooking.item_title}`}
                        >
                          <span className="font-extrabold mr-1">{dayStatus.tag}:</span>
                          <span>{primaryBooking.item_title}</span>
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

            {/* Calendar Legend with Multi-Color Logistics & Filter indicator */}
            <div className="flex items-center justify-between flex-wrap gap-3 pt-4 mt-3 border-t border-divider text-xs text-ink-secondary">
              <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
                <span className="flex items-center gap-1.5 font-semibold text-sky-600 dark:text-sky-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <span>🚚 Deliver</span>
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>🚶 Pick Up</span>
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-purple-600 dark:text-purple-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span>📍 Hub / Owner Loc</span>
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>🎒 In-Use</span>
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-rose-600 dark:text-rose-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>🔄 Return</span>
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-ink">
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
      {/* 3. FOUR MAIN TABS (Ongoing, Requests, Finished, Cancelled) */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        
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

        {/* Tab 4: Cancelled & Declined Bookings */}
        <button
          onClick={() => { setActiveTab('cancelled'); setSelectedDateFilter(null); }}
          className={`p-4 rounded-2xl text-left border transition-all cursor-pointer relative overflow-hidden flex items-center justify-between ${
            activeTab === 'cancelled'
              ? 'bg-surface border-brand ring-2 ring-brand/20 shadow-sm'
              : 'bg-canvas/60 border-divider hover:bg-surface hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-xs font-black uppercase tracking-wider text-ink font-display">
                Cancelled / Declined
              </span>
            </div>
            <p className="text-[11px] text-ink-secondary font-medium mt-0.5">
              Declined proposals & cancelled
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
            activeTab === 'cancelled' ? 'bg-brand text-white' : 'bg-canvas text-ink-secondary border border-divider'
          }`}>
            {cancelledList.length}
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
            <div className="space-y-6">
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
                <div className="space-y-6">
                  {/* Role Sub-Filter Navigation Pills */}
                  <div className="flex items-center gap-2 pb-1 overflow-x-auto scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setOngoingRoleFilter('all')}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs ${
                        ongoingRoleFilter === 'all'
                          ? 'bg-ink text-canvas shadow-xs scale-[1.02]'
                          : 'bg-surface border border-divider text-ink-secondary hover:text-ink hover:border-zinc-400'
                      }`}
                    >
                      <span>All Ongoing</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        ongoingRoleFilter === 'all' ? 'bg-white/20 text-white' : 'bg-canvas text-ink-secondary'
                      }`}>
                        {displayedOngoingList.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOngoingRoleFilter('lender')}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs ${
                        ongoingRoleFilter === 'lender'
                          ? 'bg-purple-600 text-white shadow-xs scale-[1.02]'
                          : 'bg-surface border border-divider text-ink-secondary hover:text-ink hover:border-zinc-400'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Gear I'm Lending (Owner)</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        ongoingRoleFilter === 'lender' ? 'bg-white/20 text-white' : 'bg-canvas text-ink-secondary'
                      }`}>
                        {ongoingLendingList.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOngoingRoleFilter('renter')}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs ${
                        ongoingRoleFilter === 'renter'
                          ? 'bg-brand text-white shadow-xs scale-[1.02]'
                          : 'bg-surface border border-divider text-ink-secondary hover:text-ink hover:border-zinc-400'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Gear I'm Renting (Borrower)</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        ongoingRoleFilter === 'renter' ? 'bg-white/20 text-white' : 'bg-canvas text-ink-secondary'
                      }`}>
                        {ongoingRentingList.length}
                      </span>
                    </button>
                  </div>

                  {/* ======================================================== */}
                  {/* SECTION 1: GEAR I'M LENDING (AS OWNER)                   */}
                  {/* ======================================================== */}
                  {(ongoingRoleFilter === 'all' || ongoingRoleFilter === 'lender') && (
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between pb-2 border-b border-divider">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                            <Upload className="w-4 h-4 stroke-[2.5]" />
                          </div>
                          <div>
                            <h3 className="text-sm sm:text-base font-extrabold text-ink font-display flex items-center gap-2">
                              <span>Gear I'm Lending</span>
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                You are Owner • {ongoingLendingList.length}
                              </span>
                            </h3>
                            <p className="text-[11px] text-ink-secondary">
                              Items you are renting out to neighbors. You verify handover code and collect rental earnings.
                            </p>
                          </div>
                        </div>
                      </div>

                      {ongoingLendingList.length === 0 ? (
                        <div className="p-6 rounded-3xl bg-surface border border-divider text-center space-y-1">
                          <p className="text-xs font-bold text-ink">No gear currently out on rent</p>
                          <p className="text-[11px] text-ink-secondary">
                            When neighbors book your listed gear, active handoffs and return tracking will appear here.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {ongoingLendingList.map((booking) => (
                            <div
                              key={booking.id}
                              id={`booking-${booking.id}`}
                              className={`rounded-3xl transition-all duration-300 ${
                                highlightedBookingId === booking.id ? 'ring-2 ring-brand shadow-pink' : ''
                              }`}
                            >
                              <BookingCard
                                booking={booking}
                                onClick={() => setSelectedStageBooking(booking)}
                                onOpenChat={onOpenChat}
                                onUpdated={(updated) => {
                                  setBookings((prev) =>
                                    prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))
                                  );
                                  if (updated.status === 'COMPLETED') {
                                    setActiveTab('finished');
                                    setReviewBooking(updated);
                                  }
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* SECTION 2: GEAR I'M RENTING (AS BORROWER)                */}
                  {/* ======================================================== */}
                  {(ongoingRoleFilter === 'all' || ongoingRoleFilter === 'renter') && (
                    <div className="space-y-3.5 pt-2">
                      <div className="flex items-center justify-between pb-2 border-b border-divider">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
                            <Download className="w-4 h-4 stroke-[2.5]" />
                          </div>
                          <div>
                            <h3 className="text-sm sm:text-base font-extrabold text-ink font-display flex items-center gap-2">
                              <span>Gear I'm Renting</span>
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
                                You are Renter • {ongoingRentingList.length}
                              </span>
                            </h3>
                            <p className="text-[11px] text-ink-secondary">
                              Items you booked from neighbors. You will show your 6-digit pickup code at meetup time.
                            </p>
                          </div>
                        </div>
                      </div>

                      {ongoingRentingList.length === 0 ? (
                        <div className="p-6 rounded-3xl bg-surface border border-divider text-center space-y-1">
                          <p className="text-xs font-bold text-ink">No gear currently being rented</p>
                          <p className="text-[11px] text-ink-secondary">
                            When you rent cameras, camping gear, tools, or tech, your active orders will appear here.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {ongoingRentingList.map((booking) => (
                            <div
                              key={booking.id}
                              id={`booking-${booking.id}`}
                              className={`rounded-3xl transition-all duration-300 ${
                                highlightedBookingId === booking.id ? 'ring-2 ring-brand shadow-pink' : ''
                              }`}
                            >
                              <BookingCard
                                booking={booking}
                                onClick={() => setSelectedStageBooking(booking)}
                                onOpenChat={onOpenChat}
                                onUpdated={(updated) => {
                                  setBookings((prev) =>
                                    prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))
                                  );
                                  if (updated.status === 'COMPLETED') {
                                    setActiveTab('finished');
                                    setReviewBooking(updated);
                                  }
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                  const isLender = checkIsLender(booking, user);
                  const isRecipient = booking.is_proposal
                    ? (booking.recipient_id === user?.id || booking.recipient_id === (user as any)?.firebase_uid || (!(booking as any).is_offer && isLender))
                    : (booking.lender_id === user?.id || booking.lender_id === (user as any)?.firebase_uid || isLender);

                  const partnerIsBorrower = isLender;
                  const partnerName = partnerIsBorrower
                    ? (booking.borrower_name || 'Borrower')
                    : (booking.lender_name || 'Lender');
                  const partnerAvatar = partnerIsBorrower
                    ? booking.borrower_avatar
                    : booking.lender_avatar;
                  const partnerId = partnerIsBorrower
                    ? booking.borrower_id
                    : booking.lender_id;

                  const isTimePassed = isBookingRequestPassed(booking);

                  return (
                    <div
                      key={booking.id}
                      id={`booking-${booking.id}`}
                      className={`bg-surface border rounded-3xl p-5 sm:p-6 shadow-sm transition-all space-y-4 ${
                        highlightedBookingId === booking.id
                          ? 'border-brand ring-4 ring-brand/60 shadow-pink'
                          : isTimePassed
                          ? 'border-rose-500/30 hover:border-rose-500/60'
                          : 'border-amber-500/30 hover:border-amber-500/60'
                      }`}
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
                              {isTimePassed ? (
                                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                  Time Expired
                                </span>
                              ) : (
                                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                  {booking.is_proposal 
                                    ? (isRecipient ? 'Custom Request' : 'Proposal Sent') 
                                    : (isLender ? 'Incoming Request' : 'Proposal Sent')}
                                </span>
                              )}
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
                              {partnerAvatar && (
                                <img src={partnerAvatar} alt={partnerName} className="w-4 h-4 rounded-full object-cover" />
                              )}
                              <span>{isRecipient ? 'Requested by:' : 'Sent to:'}</span>
                              <strong className="text-ink">{partnerName}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Quick Message action */}
                        <div className="shrink-0 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => onOpenChat(booking.is_proposal ? `dm_${partnerId}` : booking.id)}
                            className="btn-secondary text-xs px-4 py-2 font-bold cursor-pointer inline-flex items-center gap-1.5 w-full sm:w-auto justify-center hover:border-brand hover:text-brand transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-brand" />
                            <span>Message {partnerName}</span>
                          </button>
                        </div>
                      </div>

                      {/* Expired alert if time passed */}
                      {isTimePassed && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2 animate-in fade-in">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>The scheduled rental time for this request ({booking.start_date} at {formatTime12(booking.start_time || '10:00')}) has already passed. It cannot be accepted. Please message {partnerName} to request upcoming dates.</span>
                        </div>
                      )}

                      {/* Requester note if any */}
                      {booking.message && (
                        <div className="p-3 bg-canvas rounded-2xl border border-divider text-xs text-ink-secondary">
                          <span className="font-bold text-ink">Note from {partnerName}: </span>
                          <span>"{booking.message}"</span>
                        </div>
                      )}

                      {/* Logistics Info */}
                      <div className="p-3 bg-canvas/60 rounded-2xl border border-divider text-xs text-ink-secondary flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-brand" />
                          <span>Pickup: {booking.requires_delivery ? 'Owner Delivers' : `Self Pickup (${booking.item_locality || 'Local Hub'})`} at {formatTime12(booking.start_time || '10:00')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>Return: {booking.requires_pickup ? 'Owner Collects' : 'Renter Returns'} at {formatTime12(booking.end_time || '18:00')}</span>
                        </div>
                      </div>

                      {/* Actions: Accept or Reject */}
                      <div className="pt-2 border-t border-divider flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-ink-secondary">
                          {isTimePassed
                            ? 'This request is expired because its scheduled pickup time has passed.'
                            : isRecipient
                            ? 'Accepting this request will immediately activate the booking and schedule it on your calendar.'
                            : `Waiting for ${partnerName} to review and accept your proposal.`}
                        </div>

                        {isRecipient ? (
                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(booking.id, 'REJECTED')}
                              className="btn-secondary text-xs px-4 py-2 text-rose-500 hover:border-rose-500 font-bold cursor-pointer"
                            >
                              {isTimePassed ? 'Dismiss / Decline' : 'Decline'}
                            </button>
                            {isTimePassed ? (
                              <button
                                type="button"
                                disabled
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-zinc-200 dark:bg-zinc-800 text-ink-muted border border-divider opacity-50 cursor-not-allowed inline-flex items-center gap-1.5"
                                title="Scheduled rental time has already passed. Cannot accept."
                              >
                                <span>Time Expired</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStatusUpdate(booking.id, 'ACCEPTED')}
                                className="btn-primary text-xs px-6 py-2 shadow-pink font-bold cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>Accept Request & Book</span>
                              </button>
                            )}
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
                      id={`booking-${booking.id}`}
                      className={`bg-surface border rounded-3xl p-5 sm:p-6 shadow-sm transition-all space-y-4 ${
                        highlightedBookingId === booking.id
                          ? 'border-brand ring-4 ring-brand/60 shadow-pink'
                          : 'border-divider hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
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
                                  {reviewWindow.label}
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
                              <span>{booking.user_review_id ? 'Update Review' : 'Leave Review & Feedback'}</span>
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

          {/* TAB 4: CANCELLED & DECLINED BOOKINGS */}
          {activeTab === 'cancelled' && (
            <div className="space-y-4">
              {cancelledList.length === 0 ? (
                <div className="py-20 text-center bg-surface border border-divider rounded-3xl p-8 max-w-2xl mx-auto space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-2">
                    <XCircle className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <p className="text-base font-bold text-ink">No cancelled or declined bookings</p>
                  <p className="text-xs text-ink-secondary max-w-md mx-auto">
                    Any rental proposals that were declined or bookings cancelled for any reason will be archived here for your records.
                  </p>
                </div>
              ) : (
                cancelledList.map((booking) => {
                  const isLender = booking.lender_id === user?.id;
                  const partnerName = isLender ? (booking.borrower_name || 'Renter') : (booking.lender_name || 'Owner');
                  const isDeclined = booking.status === 'REJECTED';

                  return (
                    <div
                      key={booking.id}
                      id={`booking-${booking.id}`}
                      className={`bg-surface border rounded-3xl p-5 sm:p-6 shadow-sm transition-all space-y-4 ${
                        highlightedBookingId === booking.id
                          ? 'border-brand ring-4 ring-brand/60 shadow-pink'
                          : 'border-divider hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      {/* Top Info */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <img
                            src={booking.item_images?.[0] || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80'}
                            alt={booking.item_title}
                            className="w-16 h-16 rounded-2xl object-cover border border-divider shrink-0 opacity-80 grayscale-[25%]"
                          />

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-extrabold text-base sm:text-lg text-ink tracking-tight font-display">
                                {booking.item_title}
                              </h3>
                              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                isDeclined
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                  : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20'
                              }`}>
                                {isDeclined ? 'Declined Proposal' : 'Cancelled Booking'}
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
                          className="btn-secondary text-xs px-3.5 py-1.5 font-bold cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat History</span>
                        </button>
                      </div>

                      {/* Explanation Note Banner */}
                      <div className="p-3 bg-canvas rounded-2xl border border-divider text-xs text-ink-secondary flex items-center gap-2">
                        <Ban className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>
                          {isDeclined
                            ? `This booking proposal was declined. You can message ${partnerName} in chat to propose alternative dates or items.`
                            : `This booking was cancelled and is no longer active.`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* 5-Stage Booking Process Modal (Meetup QR, Rental Period, Return QR, Payment) */}
      <BookingStageModal
        booking={selectedStageBooking}
        isOpen={Boolean(selectedStageBooking)}
        onClose={() => setSelectedStageBooking(null)}
        onUpdated={(updated) => {
          setBookings((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
          setSelectedStageBooking(updated);
          if (updated.status === 'COMPLETED') {
            setActiveTab('finished');
          }
        }}
        onOpenChat={onOpenChat}
        onLeaveReview={(b) => setReviewBooking(b)}
      />

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
