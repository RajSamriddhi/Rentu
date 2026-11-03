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

// Generate time slots every 30 minutes from 06:00 to 23:30
export const TIME_SLOTS: string[] = [];
for (let h = 6; h <= 23; h++) {
  const hh = String(h).padStart(2, '0');
  TIME_SLOTS.push(`${hh}:00`);
  TIME_SLOTS.push(`${hh}:30`);
}

// Friendly 12-hour formatter (e.g. '02:00 PM')
export const formatTime12 = (timeStr?: string): string => {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${m} ${period}`;
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
  const startSelectRef = React.useRef<HTMLSelectElement>(null);
  const endSelectRef = React.useRef<HTMLSelectElement>(null);
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

  // Auto-advance start time if it has already passed today
  React.useEffect(() => {
    if (!onSelectStartTime) return;
    const now = new Date();
    const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (startDate === todayStr && startTime <= currentHourMin) {
      const nextAvailable = TIME_SLOTS.find((s) => s > currentHourMin);
      if (nextAvailable) {
        onSelectStartTime(nextAvailable);
      }
    }
  }, [startDate, todayStr, startTime, onSelectStartTime]);

  // Auto-advance end time if it has already passed today or is before/equal to start time
  React.useEffect(() => {
    if (!onSelectEndTime) return;
    const now = new Date();
    const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const isPastToday = endDate === todayStr && endTime <= currentHourMin;
    const isBeforeStart = startDate === endDate && endTime <= startTime;
    if (isPastToday || isBeforeStart) {
      const minSlot = startDate === endDate ? startTime : (endDate === todayStr ? currentHourMin : '00:00');
      const nextAvailable = TIME_SLOTS.find((s) => s > minSlot);
      if (nextAvailable) {
        onSelectEndTime(nextAvailable);
      }
    }
  }, [startDate, endDate, todayStr, startTime, endTime, onSelectEndTime]);

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

        const allStartSlots = Array.from(new Set([...TIME_SLOTS, startTime].filter(Boolean))).sort();
        const allEndSlots = Array.from(new Set([...TIME_SLOTS, endTime].filter(Boolean))).sort();

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
                      startSelectRef.current?.focus();
                      try {
                        startSelectRef.current?.showPicker?.();
                      } catch {}
                    }}
                    className="text-[10px] font-extrabold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <CalendarIcon className="w-3 h-3 text-brand" />
                    <span>Select Time</span>
                  </button>
                </div>

                <div className="relative flex items-center">
                  <select
                    ref={startSelectRef}
                    value={startTime}
                    onChange={(e) => onSelectStartTime?.(e.target.value)}
                    className={`w-full bg-surface border rounded-xl pl-3 pr-10 py-2.5 text-xs font-black text-ink outline-none focus:border-brand cursor-pointer appearance-none transition-all shadow-2xs ${
                      isStartTimePassedToday ? 'border-rose-500 text-rose-500' : 'border-divider'
                    }`}
                  >
                    {allStartSlots.map((t) => {
                      const isPast = isStartToday && t <= currentTimeStr;
                      return (
                        <option
                          key={t}
                          value={t}
                          disabled={isPast}
                          className={isPast ? 'text-zinc-500 bg-zinc-900 line-through' : 'text-ink bg-surface font-semibold'}
                        >
                          {formatTime12(t)} {isPast ? '(Passed)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute right-3 pointer-events-none text-brand">
                    <Clock className="w-4 h-4" />
                  </div>
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
                            ? 'opacity-30 cursor-not-allowed bg-zinc-800/40 border-zinc-700/40 text-zinc-500 line-through pointer-events-none'
                            : startTime === time
                            ? 'bg-brand text-white border-brand shadow-xs cursor-pointer'
                            : 'bg-surface border-divider text-ink-secondary hover:text-ink hover:border-brand/40 cursor-pointer'
                        }`}
                        title={isPast ? 'This time has already passed today' : undefined}
                      >
                        {label} {isPast ? '(Passed)' : ''}
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
                      endSelectRef.current?.focus();
                      try {
                        endSelectRef.current?.showPicker?.();
                      } catch {}
                    }}
                    className="text-[10px] font-extrabold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <CalendarIcon className="w-3 h-3 text-brand" />
                    <span>Select Time</span>
                  </button>
                </div>

                <div className="relative flex items-center">
                  <select
                    ref={endSelectRef}
                    value={endTime}
                    onChange={(e) => onSelectEndTime?.(e.target.value)}
                    className={`w-full bg-surface border rounded-xl pl-3 pr-10 py-2.5 text-xs font-black text-ink outline-none focus:border-brand cursor-pointer appearance-none transition-all shadow-2xs ${
                      (isEndTimePassedToday || isEndTimeBeforeStartTime) ? 'border-rose-500 text-rose-500' : 'border-divider'
                    }`}
                  >
                    {allEndSlots.map((t) => {
                      const isPastToday = isEndToday && t <= currentTimeStr;
                      const isBeforeStart = startDate === endDate && t <= startTime;
                      const isEndDisabled = isPastToday || isBeforeStart;
                      return (
                        <option
                          key={t}
                          value={t}
                          disabled={isEndDisabled}
                          className={isEndDisabled ? 'text-zinc-500 bg-zinc-900 line-through' : 'text-ink bg-surface font-semibold'}
                        >
                          {formatTime12(t)} {isPastToday ? '(Passed)' : isBeforeStart ? '(Before pickup)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute right-3 pointer-events-none text-brand">
                    <Clock className="w-4 h-4" />
                  </div>
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
                            ? 'opacity-30 cursor-not-allowed bg-zinc-800/40 border-zinc-700/40 text-zinc-500 line-through pointer-events-none'
                            : endTime === time
                            ? 'bg-brand text-white border-brand shadow-xs cursor-pointer'
                            : 'bg-surface border-divider text-ink-secondary hover:text-ink hover:border-brand/40 cursor-pointer'
                        }`}
                        title={isPast ? (startDate === endDate && time <= startTime ? 'Must be after pickup time' : 'This time has already passed today') : undefined}
                      >
                        {label} {isPast ? '(Passed)' : ''}
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

