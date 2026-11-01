import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info, AlertCircle, Clock } from 'lucide-react';

export interface BookedDateRange {
  id?: string;
  start_date: string; // 'YYYY-MM-DD'
  end_date: string;   // 'YYYY-MM-DD'
  status?: string;
}

interface RentalCalendarProps {
  bookedDates: BookedDateRange[];
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  startTime?: string;
  endTime?: string;
  onSelectRange: (start: string, end: string) => void;
  onSelectStartTime?: (time: string) => void;
  onSelectEndTime?: (time: string) => void;
  minDate?: string;
}

// Helper to format Date to 'YYYY-MM-DD' local date string
export const toDateString = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to parse 'YYYY-MM-DD' safely to a Date at local midnight
export const parseDateString = (str: string): Date => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const RentalCalendar: React.FC<RentalCalendarProps> = ({
  bookedDates = [],
  startDate,
  endDate,
  startTime = '10:00',
  endTime = '18:00',
  onSelectRange,
  onSelectStartTime,
  onSelectEndTime,
  minDate,
}) => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayStr = useMemo(() => toDateString(today), [today]);

  // Initial month view defaults to startDate's month or current month
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (startDate) {
      const d = parseDateString(startDate);
      if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [rangeError, setRangeError] = useState<string>('');
  const [isSelectingEnd, setIsSelectingEnd] = useState<boolean>(false);

  // Month navigation
  const prevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setRangeError('');
  };

  const nextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setRangeError('');
  };

  const canGoPrev = useMemo(() => {
    const firstOfCurrent = new Date(today.getFullYear(), today.getMonth(), 1);
    return currentMonth.getTime() > firstOfCurrent.getTime();
  }, [currentMonth, today]);

  // Normalize booked date ranges
  const normalizedBookedRanges = useMemo(() => {
    return (bookedDates || []).map((b) => ({
      start: b.start_date?.slice(0, 10),
      end: (b.end_date || b.start_date)?.slice(0, 10),
    })).filter((b) => b.start && b.end);
  }, [bookedDates]);

  // Check if a specific YYYY-MM-DD is booked
  const isDateBooked = (dateStr: string): boolean => {
    return normalizedBookedRanges.some((range) => {
      return dateStr >= range.start && dateStr <= range.end;
    });
  };

  // Check if any date in a range [startStr, endStr] is booked
  const hasBookedDateInRange = (startStr: string, endStr: string): boolean => {
    return normalizedBookedRanges.some((range) => {
      // Overlap formula: range.start <= endStr && range.end >= startStr
      return range.start <= endStr && range.end >= startStr;
    });
  };

  // Generate calendar grid days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isPast: boolean;
      isBooked: boolean;
      isSelectedStart: boolean;
      isSelectedEnd: boolean;
      isInRange: boolean;
    }> = [];

    // Empty padding slots before the 1st
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dateStr: '',
        dayNum: 0,
        isCurrentMonth: false,
        isPast: true,
        isBooked: false,
        isSelectedStart: false,
        isSelectedEnd: false,
        isInRange: false,
      });
    }

    // Actual month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = toDateString(d);
      const isPast = dateStr < todayStr || (minDate ? dateStr < minDate : false);
      const isBooked = isDateBooked(dateStr);
      const isSelectedStart = startDate === dateStr;
      const isSelectedEnd = endDate === dateStr;
      const isInRange = Boolean(startDate && endDate && dateStr > startDate && dateStr < endDate);

      days.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isPast,
        isBooked,
        isSelectedStart,
        isSelectedEnd,
        isInRange,
      });
    }

    return days;
  }, [currentMonth, todayStr, minDate, startDate, endDate, normalizedBookedRanges]);

  // Handle user clicking on a calendar date
  const handleDateClick = (dateStr: string, isPast: boolean, isBooked: boolean) => {
    if (isPast || isBooked) return;
    setRangeError('');

    if (!isSelectingEnd || !startDate) {
      // Step 1: User picked start date
      onSelectRange(dateStr, dateStr);
      setIsSelectingEnd(true);
    } else {
      // Step 2: User is picking end date
      if (dateStr < startDate) {
        // Clicked a date before current start date, make it the new start date
        onSelectRange(dateStr, dateStr);
        setIsSelectingEnd(true);
      } else {
        // Validate if any date in between is already rented
        if (hasBookedDateInRange(startDate, dateStr)) {
          setRangeError('⚠️ This range crosses dates when the item is already rented. Please pick an uninterrupted available period.');
          return;
        }
        onSelectRange(startDate, dateStr);
        setIsSelectingEnd(false);
      }
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="bg-surface rounded-2xl border border-divider p-4 shadow-xs">
      
      {/* Calendar Header with Month Navigation */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-divider">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-brand" />
          <h4 className="text-xs sm:text-sm font-extrabold text-ink font-display">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h4>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="p-1.5 rounded-lg border border-divider hover:bg-canvas text-ink transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg border border-divider hover:bg-canvas text-ink transition-colors cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w, idx) => (
          <div key={idx} className="text-[10px] font-black uppercase tracking-wider text-ink-secondary py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {calendarDays.map((d, index) => {
          if (!d.isCurrentMonth) {
            return <div key={index} className="h-8" />;
          }

          const isClickable = !d.isPast && !d.isBooked;

          // Styling classes
          let cellStyle = 'bg-canvas text-ink hover:border-brand/60 hover:bg-brand-soft/20';

          if (d.isPast) {
            cellStyle = 'opacity-30 text-ink-secondary cursor-not-allowed bg-transparent';
          } else if (d.isBooked) {
            cellStyle = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/30 line-through cursor-not-allowed';
          } else if (d.isSelectedStart || d.isSelectedEnd) {
            cellStyle = 'bg-brand text-white font-black shadow-xs ring-2 ring-brand/30';
          } else if (d.isInRange) {
            cellStyle = 'bg-brand/15 text-brand font-bold border border-brand/20';
          }

          return (
            <button
              key={d.dateStr}
              type="button"
              onClick={() => handleDateClick(d.dateStr, d.isPast, d.isBooked)}
              disabled={!isClickable}
              title={
                d.isPast
                  ? 'Past date'
                  : d.isBooked
                  ? 'Unavailable — Already rented for these dates'
                  : `Select ${d.dateStr}`
              }
              className={`h-8 sm:h-8.5 rounded-lg text-xs font-semibold flex flex-col items-center justify-center relative transition-all cursor-pointer ${cellStyle}`}
            >
              <span>{d.dayNum}</span>
              {d.isBooked && (
                <span className="w-1 h-1 rounded-full bg-rose-500 absolute bottom-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Inline Range Error if overlapping booked date */}
      {rangeError && (
        <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-start gap-1.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{rangeError}</span>
        </div>
      )}

      {/* Legend & Instructions */}
      <div className="mt-3 pt-2.5 border-t border-divider flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-ink-secondary">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-md bg-canvas border border-divider" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-md bg-rose-500/20 border border-rose-500/40" />
            <span className="text-rose-600 dark:text-rose-400">Rented (Unavailable)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-md bg-brand" />
            <span className="text-ink">Selected</span>
          </div>
        </div>

        {isSelectingEnd && (
          <span className="text-brand font-black animate-pulse">
            👉 Now click return date
          </span>
        )}
      </div>

      {/* Handover & Return Times Section directly inside Calendar */}
      {(onSelectStartTime || onSelectEndTime) && (
        <div className="mt-3.5 pt-3 border-t border-divider grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-2.5 rounded-xl bg-canvas border border-divider">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-ink-secondary mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-brand" />
              <span>Pickup / Start Time</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => onSelectStartTime?.(e.target.value)}
              className="w-full bg-surface border border-divider rounded-lg px-2.5 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand cursor-pointer"
            />
          </div>

          <div className="p-2.5 rounded-xl bg-canvas border border-divider">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-ink-secondary mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-brand" />
              <span>Return / End Time</span>
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => onSelectEndTime?.(e.target.value)}
              className="w-full bg-surface border border-divider rounded-lg px-2.5 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Booked ranges notice banner if any rentals exist */}
      {normalizedBookedRanges.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-divider">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-secondary flex items-center gap-1 mb-1">
            <Info className="w-3 h-3 text-rose-500" />
            <span>Active Rental Schedule</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {normalizedBookedRanges.map((range, i) => (
              <span
                key={i}
                className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              >
                🔒 {range.start} → {range.end} (Rented)
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

