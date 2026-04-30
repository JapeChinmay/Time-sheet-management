"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDays, addMonths, format, isAfter, isBefore,
  isSameDay, isSameMonth, isValid, startOfMonth,
  startOfWeek, subMonths,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

/* ─── Props ────────────────────────────────────────────────────────────── */
interface DatePickerProps {
  /** Controlled value — "yyyy-MM-dd" string or "" */
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  /** Earliest selectable date as "yyyy-MM-dd" */
  min?: string;
  /** Latest selectable date as "yyyy-MM-dd" */
  max?: string;
  className?: string;
}

const DAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  min,
  max,
  className = "",
}: DatePickerProps) {
  const parseISO = (s: string) => new Date(s + "T00:00:00");

  const selectedDate = value && isValid(parseISO(value)) ? parseISO(value) : null;
  const minDate      = min ? parseISO(min) : null;
  const maxDate      = max ? parseISO(max) : null;

  const [open, setOpen]   = useState(false);
  const [month, setMonth] = useState<Date>(() =>
    startOfMonth(selectedDate ?? new Date())
  );
  const ref = useRef<HTMLDivElement>(null);

  /* sync displayed month when value changes externally */
  useEffect(() => {
    if (selectedDate) setMonth(startOfMonth(selectedDate));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  /* close on outside click */
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  /* build 6×7 calendar grid, Mon-aligned */
  const calStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const days     = Array.from({ length: 42 }, (_, i) => addDays(calStart, i));

  const isDisabled = (d: Date) =>
    (minDate != null && isBefore(d, minDate) && !isSameDay(d, minDate)) ||
    (maxDate != null && isAfter(d, maxDate)  && !isSameDay(d, maxDate));

  const selectDay = (d: Date) => {
    if (isDisabled(d)) return;
    onChange(format(d, "yyyy-MM-dd"));
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const canPrev = !minDate || isAfter(month, startOfMonth(minDate));
  const canNext = !maxDate || isBefore(month, startOfMonth(maxDate));

  const displayValue = selectedDate ? format(selectedDate, "dd MMM yyyy") : "";

  return (
    <div ref={ref} className={`relative ${className}`}>

      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2.5 border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white
                   hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20 transition text-left"
      >
        <Calendar size={14} className="text-slate-400 shrink-0" />
        <span className={`flex-1 truncate ${displayValue ? "text-slate-900" : "text-slate-400"}`}>
          {displayValue || placeholder}
        </span>
        {value && (
          <span
            onClick={clear}
            className="text-slate-300 hover:text-slate-500 transition cursor-pointer shrink-0"
          >
            <X size={13} />
          </span>
        )}
      </button>

      {/* ── Calendar dropdown ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 w-72"
          >
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setMonth((m) => subMonths(m, 1))}
                disabled={!canPrev}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={15} />
              </button>
              <p className="text-sm font-semibold text-slate-800">
                {format(month, "MMMM yyyy")}
              </p>
              <button
                type="button"
                onClick={() => setMonth((m) => addMonths(m, 1))}
                disabled={!canNext}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_HEADERS.map((d) => (
                <span key={d} className="text-center text-[10px] font-semibold text-slate-400 py-0.5">
                  {d}
                </span>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {days.map((day, i) => {
                const inMonth    = isSameMonth(day, month);
                const isSelected = !!selectedDate && isSameDay(day, selectedDate);
                const isToday    = isSameDay(day, new Date());
                const disabled   = isDisabled(day);

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectDay(day)}
                    disabled={disabled}
                    className={[
                      "h-8 w-full rounded-lg text-xs font-medium transition",
                      isSelected                         ? "bg-slate-900 text-white"             : "",
                      !isSelected && isToday             ? "bg-indigo-50 text-indigo-600 font-bold" : "",
                      !isSelected && !isToday && inMonth ? "text-slate-700 hover:bg-slate-100"   : "",
                      !isSelected && !inMonth            ? "text-slate-300"                      : "",
                      disabled                           ? "opacity-30 cursor-not-allowed"       : "",
                    ].join(" ")}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>

            {/* Today shortcut */}
            <button
              type="button"
              onClick={() => selectDay(new Date())}
              disabled={isDisabled(new Date())}
              className="mt-3 w-full text-xs font-medium text-indigo-600 hover:text-indigo-700 py-1.5 rounded-lg
                         hover:bg-indigo-50 transition border border-transparent hover:border-indigo-100
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Today
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
