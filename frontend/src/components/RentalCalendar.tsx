import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info, AlertCircle, Clock, Lock, ArrowRight } from 'lucide-react';

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
  const startInputRef = React.useRef<HTMLInputElement>(null);
  const endInputRef = React.useRef<HTMLInputElement>(null);
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
          setRangeError('This range crosses dates when the item is already rented. Please pick an uninterrupted available period.');
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
          <span className="text-brand font-bold inline-flex items-center gap-1">
            <ArrowRight className="w-3.5 h-3.5" /> Select return date
          </span>
        )}
      </div>

      {/* Handover & Return Times Section directly inside Calendar */}
      {(onSelectStartTime || onSelectEndTime) && (() => {
        const isStartToday = startDate === todayStr;
        const isEndToday = endDate === todayStr;
        const now = new Date();
        const currentHourNum = now.getHours();
        const currentMinNum = now.getMinutes();
        const currentTimeStr = `${String(currentHourNum).padStart(2, '0')}:${String(currentMinNum).padStart(2, '0')}`;

        const isStartTimePassedToday = isStartToday && startTime <= currentTimeStr;
        const isEndTimePassedToday = isEndToday && endTime <= currentTimeStr;
        const isEndTimeBeforeStartTime = startDate === endDate && endTime <= startTime;

        return (
          <div className="mt-3.5 pt-3 border-t border-divider space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Pickup / Start Time */}
              <div className={`p-3 rounded-2xl bg-canvas border space-y-2 shadow-2xs transition-colors ${
                isStartTimePassedToday ? 'border-rose-500/40 bg-rose-500/5' : 'border-divider'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-secondary flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand" />
                    <span>Pickup / Start Time</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        startInputRef.current?.showPicker?.();
                      } catch {}
                      startInputRef.current?.focus();
                    }}
                    className="text-[10px] font-extrabold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <CalendarIcon className="w-3 h-3 text-brand" />
                    <span>Select Time</span>
                  </button>
                </div>

                <div className="relative flex items-center">
                  <input
                    ref={startInputRef}
                    type="time"
                    value={startTime}
                    min={isStartToday ? currentTimeStr : undefined}
                    onChange={(e) => onSelectStartTime?.(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch {}
                    }}
                    className={`w-full bg-surface border rounded-xl pl-3 pr-10 py-2 text-xs font-black text-ink outline-none focus:border-brand cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-100 ${
                      isStartTimePassedToday ? 'border-rose-500 text-rose-500' : 'border-divider'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        startInputRef.current?.showPicker?.();
                      } catch {}
                      startInputRef.current?.focus();
                    }}
                    className="absolute right-2 p-1 rounded-lg hover:bg-brand/10 text-brand transition-colors cursor-pointer"
                    title="Open calendar time picker"
                  >
                    <CalendarIcon className="w-4 h-4 text-brand" />
                  </button>
                </div>

                {/* Validation alert if past time today */}
                {isStartTimePassedToday && (
                  <div className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>Time has already passed today. Pick an upcoming time.</span>
                  </div>
                )}

                {/* Quick Time Pills */}
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[9px] font-bold text-ink-muted uppercase tracking-wider mr-0.5">Presets:</span>
                  {[
                    { time: '09:00', label: '9 AM' },
                    { time: '10:00', label: '10 AM' },
                    { time: '12:00', label: '12 PM' },
                    { time: '16:00', label: '4 PM' },
                    { time: '18:00', label: '6 PM' },
                  ].map(({ time, label }) => {
                    const isPast = isStartToday && time <= currentTimeStr;
                    return (
                      <button
                        key={time}
                        type="button"
                        disabled={isPast}
                        onClick={() => !isPast && onSelectStartTime?.(time)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border transition-all ${
                          isPast
                            ? 'opacity-30 cursor-not-allowed bg-canvas border-divider text-ink-muted line-through'
                            : startTime === time
                            ? 'bg-brand text-white border-brand shadow-xs cursor-pointer'
                            : 'bg-surface border-divider text-ink-secondary hover:text-ink hover:border-brand/40 cursor-pointer'
                        }`}
                        title={isPast ? 'This time has already passed today' : undefined}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Return / End Time */}
              <div className={`p-3 rounded-2xl bg-canvas border space-y-2 shadow-2xs transition-colors ${
                (isEndTimePassedToday || isEndTimeBeforeStartTime) ? 'border-rose-500/40 bg-rose-500/5' : 'border-divider'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-secondary flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand" />
                    <span>Return / End Time</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        endInputRef.current?.showPicker?.();
                      } catch {}
                      endInputRef.current?.focus();
                    }}
                    className="text-[10px] font-extrabold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <CalendarIcon className="w-3 h-3 text-brand" />
                    <span>Select Time</span>
                  </button>
                </div>

                <div className="relative flex items-center">
                  <input
                    ref={endInputRef}
                    type="time"
                    value={endTime}
                    min={isEndToday ? currentTimeStr : (startDate === endDate ? startTime : undefined)}
                    onChange={(e) => onSelectEndTime?.(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch {}
                    }}
                    className={`w-full bg-surface border rounded-xl pl-3 pr-10 py-2 text-xs font-black text-ink outline-none focus:border-brand cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-100 ${
                      (isEndTimePassedToday || isEndTimeBeforeStartTime) ? 'border-rose-500 text-rose-500' : 'border-divider'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        endInputRef.current?.showPicker?.();
                      } catch {}
                      endInputRef.current?.focus();
                    }}
                    className="absolute right-2 p-1 rounded-lg hover:bg-brand/10 text-brand transition-colors cursor-pointer"
                    title="Open calendar time picker"
                  >
                    <CalendarIcon className="w-4 h-4 text-brand" />
                  </button>
                </div>

                {/* Validation alert */}
                {isEndTimePassedToday ? (
                  <div className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>Return time has already passed today.</span>
                  </div>
                ) : isEndTimeBeforeStartTime ? (
                  <div className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>Return time must be after pickup time.</span>
                  </div>
                ) : null}

                {/* Quick Time Pills */}
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[9px] font-bold text-ink-muted uppercase tracking-wider mr-0.5">Presets:</span>
                  {[
                    { time: '11:00', label: '11 AM' },
                    { time: '14:00', label: '2 PM' },
                    { time: '18:00', label: '6 PM' },
                    { time: '20:00', label: '8 PM' },
                    { time: '21:30', label: '9:30 PM' },
                  ].map(({ time, label }) => {
                    const isPast = (isEndToday && time <= currentTimeStr) || (startDate === endDate && time <= startTime);
                    return (
                      <button
                        key={time}
                        type="button"
                        disabled={isPast}
                        onClick={() => !isPast && onSelectEndTime?.(time)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border transition-all ${
                          isPast
                            ? 'opacity-30 cursor-not-allowed bg-canvas border-divider text-ink-muted line-through'
                            : endTime === time
                            ? 'bg-brand text-white border-brand shadow-xs cursor-pointer'
                            : 'bg-surface border-divider text-ink-secondary hover:text-ink hover:border-brand/40 cursor-pointer'
                        }`}
                        title={isPast ? (startDate === endDate && time <= startTime ? 'Must be after pickup time' : 'This time has already passed today') : undefined}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              >
                <Lock className="w-2.5 h-2.5" /> {range.start} → {range.end} (Rented)
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

