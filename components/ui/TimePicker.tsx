"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, X } from "lucide-react";

/* ─── Constants ─────────────────────────────────────────────────────────── */
const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")); // 00,05,10…55

const ITEM_H = 36; // px — height of each hour/minute button

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function to12h(hh: string, mm: string): string {
  const h   = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${mm} ${ampm}`;
}

/** Round raw minutes string to nearest 5-minute slot */
function roundMinutes(raw: string): string {
  const n = Math.round(parseInt(raw || "0", 10) / 5) * 5;
  return String(Math.min(n, 55)).padStart(2, "0");
}

/* ─── Props ─────────────────────────────────────────────────────────────── */
interface TimePickerProps {
  /** Controlled value — "HH:mm" string or "" */
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export default function TimePicker({
  value,
  onChange,
  placeholder = "Select time",
  className = "",
}: TimePickerProps) {
  const parts = value ? value.split(":") : [];
  const initHH = parts[0]?.padStart(2, "0") ?? "09";
  const initMM = roundMinutes(parts[1] ?? "00");

  const [open, setOpen] = useState(false);
  const [hh, setHH]     = useState(initHH);
  const [mm, setMM]     = useState(initMM);

  const ref    = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLDivElement>(null);
  const minRef  = useRef<HTMLDivElement>(null);

  /* sync when value prop changes externally */
  useEffect(() => {
    const ps = value ? value.split(":") : [];
    if (ps[0]) setHH(ps[0].padStart(2, "0"));
    if (ps[1]) setMM(roundMinutes(ps[1]));
  }, [value]);

  /* close on outside click */
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  /* scroll selected item into centre when dropdown opens */
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const hIdx = HOURS.indexOf(hh);
      const mIdx = MINUTES.indexOf(mm);
      if (hourRef.current && hIdx >= 0)
        hourRef.current.scrollTop = hIdx * ITEM_H - ITEM_H * 2;
      if (minRef.current && mIdx >= 0)
        minRef.current.scrollTop  = mIdx * ITEM_H - ITEM_H * 2;
    }, 60);
    return () => clearTimeout(t);
  }, [open, hh, mm]);

  const apply = (nextHH: string, nextMM: string) => {
    setHH(nextHH);
    setMM(nextMM);
    onChange(`${nextHH}:${nextMM}`);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const displayValue = value ? to12h(hh, mm) : "";

  return (
    <div ref={ref} className={`relative ${className}`}>

      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2.5 border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white
                   hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20 transition text-left"
      >
        <Clock size={14} className="text-slate-400 shrink-0" />
        <span className={`flex-1 ${displayValue ? "text-slate-900" : "text-slate-400"}`}>
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

      {/* ── Dropdown ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 w-56"
          >
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Select time
            </p>

            <div className="flex gap-2">
              {/* ── Hour column ── */}
              <div className="flex-1 flex flex-col">
                <p className="text-[10px] font-semibold text-slate-400 text-center mb-1.5 uppercase">
                  Hour
                </p>
                <div
                  ref={hourRef}
                  className="h-36 overflow-y-auto scrollbar-hide rounded-xl border border-slate-100 bg-slate-50 p-1 space-y-0.5"
                >
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => apply(h, mm)}
                      className={[
                        "w-full rounded-lg text-sm font-medium transition",
                        `h-[${ITEM_H}px] py-1.5`,
                        h === hh
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-white hover:shadow-sm",
                      ].join(" ")}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Separator */}
              <div className="flex items-center justify-center pt-6">
                <span className="text-lg font-bold text-slate-400">:</span>
              </div>

              {/* ── Minute column ── */}
              <div className="flex-1 flex flex-col">
                <p className="text-[10px] font-semibold text-slate-400 text-center mb-1.5 uppercase">
                  Min
                </p>
                <div
                  ref={minRef}
                  className="h-36 overflow-y-auto scrollbar-hide rounded-xl border border-slate-100 bg-slate-50 p-1 space-y-0.5"
                >
                  {MINUTES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => apply(hh, m)}
                      className={[
                        "w-full rounded-lg text-sm font-medium transition",
                        `h-[${ITEM_H}px] py-1.5`,
                        m === mm
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-white hover:shadow-sm",
                      ].join(" ")}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live preview + Done */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">
                {to12h(hh, mm)}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold px-3 py-1.5 bg-slate-900 text-white rounded-lg
                           hover:bg-slate-700 transition"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
