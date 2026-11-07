import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, Clock, ArrowRight, ChevronDown, X } from 'lucide-react';

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
import { formatTime12 } from '../lib/formatters';
export { formatTime12 };

interface TimePickerCardProps {
  label: string;
  time: string;
  onSelectTime?: (time: string) => void;
  availableSlots: string[];
  presets: { time: string; label: string }[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  isError?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
}

const TimePickerCard: React.FC<TimePickerCardProps> = ({
  label,
  time,
  onSelectTime,
  availableSlots,
  presets,
  isOpen,
  onToggleOpen,
  onClose,
  isError,
  errorMessage,
  emptyMessage,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');

  // Dynamically calculate whether to open above or below based on available space
  useEffect(() => {
    if (!isOpen) return;

    const updatePlacement = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      // Find closest scrollable ancestor container (e.g. modal body)
      let scrollParent: HTMLElement | null = containerRef.current.parentElement;
      while (scrollParent && scrollParent !== document.body) {
        const style = window.getComputedStyle(scrollParent);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') break;
        scrollParent = scrollParent.parentElement;
      }

      const parentRect = scrollParent
        ? scrollParent.getBoundingClientRect()
        : { top: 0, bottom: window.innerHeight };

      // Space available above trigger card (within viewport AND scroll parent)
      const spaceAboveViewport = rect.top;
      const spaceAboveParent = rect.top - parentRect.top;
      const spaceAbove = Math.min(spaceAboveViewport, spaceAboveParent);

      // Space available below trigger card (within viewport AND scroll parent)
      const spaceBelowViewport = window.innerHeight - rect.bottom;
      const spaceBelowParent = parentRect.bottom - rect.bottom;
      const spaceBelow = Math.min(spaceBelowViewport, spaceBelowParent);

      const requiredHeight = 230;

      // Open ABOVE whenever sufficient space is available; otherwise intelligently open below
      if (spaceAbove >= requiredHeight) {
        setPlacement('top');
      } else if (spaceBelow >= requiredHeight) {
        setPlacement('bottom');
      } else {
        setPlacement(spaceAbove >= spaceBelow ? 'top' : 'bottom');
      }
    };

    updatePlacement();

    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);

    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [isOpen]);

  // Handle outside click and Escape key to close the overlay popover
  useEffect(() => {
    if (!isOpen) return;

    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Only show presets that are currently available/valid
  const activePresets = presets.filter((p) => availableSlots.includes(p.time));

  return (
    <div
      ref={containerRef}
      className={`relative p-3 rounded-2xl bg-canvas border space-y-2 shadow-2xs transition-colors ${
        isOpen ? 'z-40' : 'z-10'
      } ${
        isError ? 'border-rose-500/40 bg-rose-500/5' : 'border-divider'
      }`}
    >
      {/* Card Header without Select Time button */}
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-secondary flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#E91E78]" />
          <span>{label}</span>
        </label>
      </div>

      {/* Main Trigger Box with Select Time / Close replacing Change */}
      <div
        onClick={onToggleOpen}
        className={`w-full bg-surface dark:bg-[#1A1A24] border rounded-xl px-3 py-2.5 flex items-center justify-between cursor-pointer transition-all shadow-2xs hover:border-[#E91E78] select-none group ${
          isError ? 'border-rose-500 text-rose-500' : 'border-divider dark:border-[#2A2A38] text-ink'
        }`}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#E91E78] shrink-0" />
          <span className="text-xs font-black">{formatTime12(time)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#E91E78] group-hover:text-[#C2185B] transition-colors">
          <span>{isOpen ? 'Close' : 'Select Time'}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#E91E78]' : 'text-[#E91E78]'}`}
          />
        </div>
      </div>

      {/* Validation Alert */}
      {isError && errorMessage && (
        <div className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Clean Presets without passed times */}
      {activePresets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <span className="text-[9px] font-bold text-ink-muted uppercase tracking-wider mr-0.5">Presets:</span>
          {activePresets.map(({ time: pTime, label: pLabel }) => {
            const isSelected = time === pTime;
            return (
              <button
                key={pTime}
                type="button"
                onClick={() => {
                  onSelectTime?.(pTime);
                  if (isOpen) onClose();
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#E91E78] text-white border-[#E91E78] shadow-xs'
                    : 'bg-surface dark:bg-[#1C1C26] border-divider dark:border-[#2C2C3A] text-ink-secondary dark:text-zinc-300 hover:text-ink dark:hover:text-white hover:border-[#E91E78]/40'
                }`}
              >
                {pLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* Custom Floating Dropdown Popover - Theme Aware (Light: Pure White, Dark: #17171F) */}
      {isOpen && (
        <div
          className={`absolute ${
            placement === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'
          } left-0 right-0 z-50 bg-white dark:bg-[#17171F] border border-zinc-200/90 dark:border-[#2A2A38] rounded-[16px] p-3 shadow-xl shadow-black/8 dark:shadow-2xl dark:shadow-black/60 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150 ease-out`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-zinc-100 dark:border-[#262734] text-xs">
            <div className="flex items-center gap-1.5 font-bold text-zinc-800 dark:text-white">
              <Clock className="w-3.5 h-3.5 text-[#E91E78]" />
              <span>Select {label} Time</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-6 h-6 rounded-full hover:bg-zinc-100 dark:hover:bg-[#22222C] text-zinc-400 hover:text-zinc-700 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {availableSlots.length === 0 ? (
            <div className="py-5 px-3 text-center text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {emptyMessage || 'No available slots for this date.'}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 max-h-48 sm:max-h-52 overflow-y-auto overscroll-contain pr-1">
              {availableSlots.map((slot) => {
                const isSelected = slot === time;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTime?.(slot);
                      onClose();
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-bold text-center transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#E91E78] text-white border-[#E91E78] shadow-sm font-black scale-[1.02]'
                        : 'bg-zinc-50 dark:bg-[#22222C] text-zinc-700 dark:text-zinc-200 border-zinc-200/80 dark:border-[#2E2E3C] hover:bg-pink-50/70 hover:border-[#E91E78]/50 hover:text-[#E91E78] dark:hover:bg-[#2C2C38] dark:hover:border-zinc-600 dark:hover:text-white'
                    }`}
                  >
                    {formatTime12(slot)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  const [isStartPickerOpen, setIsStartPickerOpen] = useState(false);
  const [isEndPickerOpen, setIsEndPickerOpen] = useState(false);
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

  // Normalize booked date ranges - only include active or future rentals with valid YYYY-MM-DD format
  const normalizedBookedRanges = useMemo(() => {
    return (bookedDates || [])
      .map((b) => ({
        start: String(b?.start_date || '').slice(0, 10),
        end: String(b?.end_date || b?.start_date || '').slice(0, 10),
      }))
      .filter((b) => {
        return (
          b.start.length === 10 &&
          b.end.length === 10 &&
          /^\d{4}-\d{2}-\d{2}$/.test(b.start) &&
          /^\d{4}-\d{2}-\d{2}$/.test(b.end) &&
          b.end >= todayStr &&
          b.start <= b.end
        );
      });
  }, [bookedDates, todayStr]);

  // Check if a specific YYYY-MM-DD is booked
  const isDateBooked = (dateStr: string): boolean => {
    if (!dateStr || dateStr.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    return normalizedBookedRanges.some((range) => {
      return dateStr >= range.start && dateStr <= range.end;
    });
  };

  // Check if any date in a range [startStr, endStr] is booked
  const hasBookedDateInRange = (startStr: string, endStr: string): boolean => {
    if (!startStr || !endStr) return false;
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

        // Available pickup slots: strictly upcoming if today
        const availableStartSlots = TIME_SLOTS.filter((t) => {
          if (isStartToday) {
            return t > currentTimeStr;
          }
          return true;
        });

        // Available return slots: strictly upcoming if today AND strictly after pickup time if same day
        const availableEndSlots = TIME_SLOTS.filter((t) => {
          if (isEndToday && t <= currentTimeStr) return false;
          if (startDate === endDate && t <= startTime) return false;
          return true;
        });

        const isStartTimePassedToday = isStartToday && startTime <= currentTimeStr;
        const isEndTimePassedToday = isEndToday && endTime <= currentTimeStr;
        const isEndTimeBeforeStartTime = startDate === endDate && endTime <= startTime;

        const startPresets = [
          { time: '09:00', label: '9 AM' },
          { time: '10:00', label: '10 AM' },
          { time: '12:00', label: '12 PM' },
          { time: '14:00', label: '2 PM' },
          { time: '16:00', label: '4 PM' },
          { time: '18:00', label: '6 PM' },
          { time: '20:00', label: '8 PM' },
        ];

        const endPresets = [
          { time: '11:00', label: '11 AM' },
          { time: '14:00', label: '2 PM' },
          { time: '16:00', label: '4 PM' },
          { time: '18:00', label: '6 PM' },
          { time: '20:00', label: '8 PM' },
          { time: '21:30', label: '9:30 PM' },
        ];

        return (
          <div className="mt-3.5 pt-3 border-t border-divider space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Pickup */}
              <TimePickerCard
                label="Pickup"
                time={startTime}
                onSelectTime={onSelectStartTime}
                availableSlots={availableStartSlots}
                presets={startPresets}
                isOpen={isStartPickerOpen}
                onToggleOpen={() => {
                  setIsStartPickerOpen((prev) => !prev);
                  setIsEndPickerOpen(false);
                }}
                onClose={() => setIsStartPickerOpen(false)}
                isError={isStartTimePassedToday}
                errorMessage="Time has already passed today. Pick an upcoming time."
                emptyMessage="All pickup slots for today have passed. Please select a future date on the calendar."
              />

              {/* Return */}
              <TimePickerCard
                label="Return"
                time={endTime}
                onSelectTime={onSelectEndTime}
                availableSlots={availableEndSlots}
                presets={endPresets}
                isOpen={isEndPickerOpen}
                onToggleOpen={() => {
                  setIsEndPickerOpen((prev) => !prev);
                  setIsStartPickerOpen(false);
                }}
                onClose={() => setIsEndPickerOpen(false)}
                isError={isEndTimePassedToday || isEndTimeBeforeStartTime}
                errorMessage={
                  isEndTimePassedToday
                    ? 'Return time has already passed today.'
                    : isEndTimeBeforeStartTime
                    ? 'Return time must be after pickup time.'
                    : undefined
                }
                emptyMessage={
                  startDate === endDate
                    ? 'No return slots remaining after pickup time today. Select a later return date.'
                    : 'No available return slots for this date.'
                }
              />
            </div>
          </div>
        );
      })()}

    </div>
  );
};

