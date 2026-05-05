"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";

export type ComboOption = { value: string; label: string };
export type ComboGroup  = { label: string; options: ComboOption[] };

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Flat list of options — mutually exclusive with `groups` */
  options?: ComboOption[];
  /** Grouped options with section headers */
  groups?: ComboGroup[];
  placeholder?: string;
  /** Show a search input inside the dropdown */
  searchable?: boolean;
  className?: string;
  disabled?: boolean;
};

const PANEL_MAX_HEIGHT = 280; // rough max panel height used to decide flip direction

export default function Combobox({
  value,
  onChange,
  options,
  groups,
  placeholder = "Select…",
  searchable = false,
  className = "",
  disabled = false,
}: Props) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [panel, setPanel]     = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

  /* all options flattened for lookup */
  const flat: ComboOption[] = groups
    ? groups.flatMap((g) => g.options)
    : (options ?? []);

  const selectedLabel = flat.find((o) => o.value === value)?.label ?? "";

  /* close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* auto-focus search */
  useEffect(() => {
    if (open && searchable) {
      const t = setTimeout(() => searchRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open, searchable]);

  const handleToggle = () => {
    if (disabled) return;
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow < PANEL_MAX_HEIGHT ? r.top - PANEL_MAX_HEIGHT - 4 : r.bottom + 4;
      setPanel({ top, left: r.left, width: r.width });
    }
    setOpen((p) => !p);
    setQuery("");
  };

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery("");
  };

  const filterOpts = (opts: ComboOption[]) =>
    query ? opts.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : opts;

  const renderOption = (o: ComboOption) => {
    const isSel   = o.value === value;
    const isEmpty = o.value === "";
    return (
      <button
        key={`${o.value}__${o.label}`}
        type="button"
        onMouseDown={(e) => e.preventDefault()} // prevent blur before click
        onClick={() => select(o.value)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg transition ${
          isSel   ? "bg-slate-900 text-white"
          : isEmpty ? "text-slate-400 italic hover:bg-slate-50"
          :           "text-slate-700 hover:bg-slate-100"
        }`}
      >
        <span className="flex-1 truncate">{o.label}</span>
        {isSel && <Check size={13} className="flex-shrink-0" />}
      </button>
    );
  };

  const renderContent = () => {
    if (groups) {
      const filtered = groups
        .map((g) => ({ ...g, options: filterOpts(g.options) }))
        .filter((g) => g.options.length > 0);
      if (!filtered.length) return <Empty />;
      return filtered.map((g) => (
        <div key={g.label}>
          <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 select-none">
            {g.label}
          </p>
          {g.options.map(renderOption)}
        </div>
      ));
    }
    const filtered = filterOpts(flat);
    if (!filtered.length) return <Empty />;
    return filtered.map(renderOption);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-sm bg-white text-left transition focus:outline-none focus:ring-2 focus:ring-slate-900 ${
          open
            ? "border-slate-400 ring-2 ring-slate-900"
            : "border-slate-200 hover:border-slate-300"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${
          !selectedLabel ? "text-slate-400" : "text-slate-900"
        }`}
      >
        <span className="flex-1 truncate">{selectedLabel || placeholder}</span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel — rendered via portal to document.body so it escapes
          any overflow:hidden parent AND any CSS-transform containing block
          (e.g. Framer Motion scale animations on modals). */}
      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              style={{ position: "fixed", top: panel.top, left: panel.left, width: panel.width }}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
            >
              {/* Search */}
              {searchable && (
                <div className="p-2 border-b border-slate-100">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && (setOpen(false), setQuery(""))}
                      placeholder="Search…"
                      className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
              )}
              {/* Options */}
              <div className="max-h-56 overflow-y-auto p-1">
                {renderContent()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-slate-400 text-center py-4">No results</p>;
}
