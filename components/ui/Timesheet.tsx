"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  format, startOfWeek, addDays, subDays,
  isSameDay, isAfter, eachDayOfInterval,
  startOfMonth, isSameMonth, addMonths, subMonths,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, ListTodo, Trash2, Clock, Lock, Palmtree } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Combobox from "@/components/ui/Combobox";

type Project = { id: number; name: string };
type Task    = { id: number; name: string; projectId: number };
type EntryStatus = "PENDING" | "APPROVED" | "REJECTED";
type LeaveRange  = { startDate: string; endDate: string; type: string };

function decodeToken() {
  try { return JSON.parse(atob(localStorage.getItem("token")!.split(".")[1])); }
  catch { return null; }
}
type Entry   = {
  id?: number;
  date: Date;
  projectId: number | null;
  projectName: string;
  category?: "BENCH" | "LEARNING";
  taskId?: number; taskName?: string;
  hours: number; description?: string;
  status?: EntryStatus;
};

const SPECIAL: Record<string, { label: string; sentinel: string; emoji: string }> = {
  BENCH:    { label: "Bench",    sentinel: "__bench__",    emoji: "🪑" },
  LEARNING: { label: "Learning", sentinel: "__learning__", emoji: "📚" },
};
const SENTINEL_TO_CATEGORY: Record<string, "BENCH" | "LEARNING"> = {
  __bench__:    "BENCH",
  __learning__: "LEARNING",
};
const isSpecialSentinel = (v: string) => v === "__bench__" || v === "__learning__";
type FormRow = { id?: number; projectId: string; taskId: string; hours: string; description: string; locked?: boolean };

const COLORS = [
  "bg-indigo-50 border-indigo-200 text-indigo-700",
  "bg-violet-50 border-violet-200 text-violet-700",
  "bg-purple-50 border-purple-200 text-purple-700",
  "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700",
  "bg-pink-50 border-pink-200 text-pink-700",
  "bg-rose-50 border-rose-200 text-rose-700",
  "bg-sky-50 border-sky-200 text-sky-700",
  "bg-teal-50 border-teal-200 text-teal-700",
];
const DOT_COLORS = [
  "bg-indigo-400","bg-violet-400","bg-purple-400","bg-fuchsia-400",
  "bg-pink-400","bg-rose-400","bg-sky-400","bg-teal-400",
];

/* ════════════════════════════════════════════════════════════════════════
   WeekPicker — click the week label to jump to any week of any year
   ════════════════════════════════════════════════════════════════════════ */
function WeekPicker({
  value,
  maxWeekStart,
  onChange,
}: {
  value: Date;
  maxWeekStart: Date;
  onChange: (ws: Date) => void;
}) {
  const [open, setOpen]               = useState(false);
  const [pickerMonth, setPickerMonth] = useState<Date>(() => startOfMonth(value));
  const ref = useRef<HTMLDivElement>(null);

  /* sync picker month when parent navigates prev/next */
  useEffect(() => { setPickerMonth(startOfMonth(value)); }, [value]);

  /* close on outside click */
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  /* build 6 rows × 7 cols, Mon-aligned */
  const calStart = startOfWeek(startOfMonth(pickerMonth), { weekStartsOn: 1 });
  const weeks: Date[][] = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(calStart, w * 7 + d))
  );

  const isSelectedWeek = (row: Date[]) => isSameDay(row[0], value);
  const isFutureWeek   = (row: Date[]) => isAfter(row[0], maxWeekStart);
  const isOnMaxMonth   = isSameMonth(pickerMonth, maxWeekStart);
  const today          = new Date();

  const selectWeek = (row: Date[]) => {
    if (isFutureWeek(row)) return;
    onChange(row[0]);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* ── Trigger ── */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex flex-col items-center hover:bg-slate-50 rounded-lg px-4 py-1.5 transition group"
      >
        <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition">
          {format(value, "MMM d")} – {format(addDays(value, 6), "MMM d, yyyy")}
        </p>
        {isSameDay(value, maxWeekStart) ? (
          <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full mt-0.5">
            Current week
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 mt-0.5">
            Click to pick a week ▾
          </span>
        )}
      </button>

      {/* ── Dropdown calendar ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 w-72"
          >
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setPickerMonth((m) => subMonths(m, 1))}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500"
              >
                <ChevronLeft size={15} />
              </button>
              <p className="text-sm font-semibold text-slate-800">
                {format(pickerMonth, "MMMM yyyy")}
              </p>
              <button
                onClick={() => setPickerMonth((m) => addMonths(m, 1))}
                disabled={isOnMaxMonth}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <span key={d} className="text-center text-[10px] font-semibold text-slate-400 py-0.5">
                  {d}
                </span>
              ))}
            </div>

            {/* Week rows — each full row is a selectable week */}
            <div className="space-y-0.5">
              {weeks.map((row, wi) => {
                const hasCurrentMonth = row.some((d) => isSameMonth(d, pickerMonth));
                if (!hasCurrentMonth) return null;

                const selected = isSelectedWeek(row);
                const future   = isFutureWeek(row);

                return (
                  <button
                    key={wi}
                    onClick={() => selectWeek(row)}
                    disabled={future}
                    title={future ? "Future week — not available" : `Select week of ${format(row[0], "MMM d")}`}
                    className={`w-full grid grid-cols-7 rounded-lg transition-all
                      ${selected
                        ? "bg-slate-900 shadow-sm"
                        : future
                        ? "opacity-30 cursor-not-allowed"
                        : "hover:bg-indigo-50 cursor-pointer"
                      }`}
                  >
                    {row.map((day, di) => {
                      const inMonth = isSameMonth(day, pickerMonth);
                      const isToday = isSameDay(day, today);
                      return (
                        <span
                          key={di}
                          className={`py-1.5 text-center text-xs rounded-md font-medium
                            ${selected
                              ? "text-white"
                              : !inMonth
                              ? "text-slate-300"
                              : isToday
                              ? "text-indigo-600 font-bold"
                              : "text-slate-700"
                            }`}
                        >
                          {format(day, "d")}
                        </span>
                      );
                    })}
                  </button>
                );
              })}
            </div>

            {/* Jump to current week shortcut */}
            {!isSameDay(value, maxWeekStart) && (
              <button
                onClick={() => { onChange(maxWeekStart); setOpen(false); }}
                className="mt-3 w-full text-xs font-medium text-indigo-600 hover:text-indigo-700 py-1.5 rounded-lg hover:bg-indigo-50 transition border border-transparent hover:border-indigo-100"
              >
                ↩ Jump to current week
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Timesheet() {
  const [view, setView] = useState<"weekly" | "daily">("weekly");
  const [projects, setProjects]         = useState<Project[]>([]);
  const [entries, setEntries]           = useState<Entry[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRange[]>([]);
  const [daysOff, setDaysOff]           = useState<string[]>([]);
  const [dailyDate, setDailyDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal]       = useState(false);
  const [formRows, setFormRows]         = useState<FormRow[]>([{ projectId: "", taskId: "", hours: "", description: "" }]);
  const [removedIds, setRemovedIds]     = useState<number[]>([]);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState("");

  /* task cache: projectId → Task[] (only the caller's assigned tasks) */
  const taskCache = useRef<Record<number, Task[]>>({});
  const [taskOptions, setTaskOptions] = useState<Record<number, Task[]>>({});

  /* snapshot of existing rows at modal-open time, keyed by entry id */
  const originalRowsRef = useRef<Record<number, FormRow>>({});

  const today            = new Date(); today.setHours(0, 0, 0, 0);
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(today, { weekStartsOn: 1 }));
  const days        = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const isFutureDay = (d: Date) => isAfter(d, today);

  const isCurrentWeek = isSameDay(weekStart, currentWeekStart);

  const goToPrevWeek = () => setWeekStart((ws) => subDays(ws, 7));
  const goToNextWeek = () => {
    if (isCurrentWeek) return;
    setWeekStart((ws) => addDays(ws, 7));
  };

  useEffect(() => {
    loadProjects();
    loadLeaves();
    const token = decodeToken();
    if (token?.sub) {
      apiFetch(`/users/${token.sub}`).then((u) => {
        if (Array.isArray(u?.daysOff)) setDaysOff(u.daysOff);
      }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadEntriesForWeek(weekStart); }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Set of "yyyy-MM-dd" strings that are blocked due to an approved leave. */
  const blockedDates = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    for (const leave of approvedLeaves) {
      const days = eachDayOfInterval({
        start: new Date(leave.startDate + "T00:00:00"),
        end:   new Date(leave.endDate   + "T00:00:00"),
      });
      days.forEach((d) => set.add(format(d, "yyyy-MM-dd")));
    }
    return set;
  }, [approvedLeaves]);

  /** Returns the leave info for a given day if it is blocked, or undefined otherwise. */
  const getLeaveForDay = (date: Date): LeaveRange | undefined => {
    const key = format(date, "yyyy-MM-dd");
    if (!blockedDates.has(key)) return undefined;
    return approvedLeaves.find(
      (l) => key >= l.startDate && key <= l.endDate,
    );
  };

  const loadProjects = async () => {
    try {
      const res = await apiFetch("/projects");
      setProjects(Array.isArray(res) ? res : res.data ?? []);
    } catch (e) { console.error(e); }
  };

  const loadLeaves = async () => {
    try {
      const res: any[] = await apiFetch("/leaves/mine");
      const approved = (Array.isArray(res) ? res : []).filter(
        (l) => l.status === "APPROVED",
      ) as LeaveRange[];
      setApprovedLeaves(approved);
    } catch (e) { console.error("Failed to load leaves:", e); }
  };

  const fetchTasksForProject = async (projectId: number): Promise<Task[]> => {
    if (taskCache.current[projectId]) return taskCache.current[projectId];
    try {
      const res = await apiFetch(`/tasks?filter=projectId||$eq||${projectId}&limit=100`);
      const list: Task[] = Array.isArray(res) ? res : res.data ?? [];
      taskCache.current[projectId] = list;
      return list;
    } catch { return []; }
  };

  const loadEntriesForWeek = async (ws: Date) => {
    try {
      const weekEnd = addDays(ws, 6);
      const res = await apiFetch(
        `/timesheets?filter=date||$gte||${format(ws, "yyyy-MM-dd")}&filter=date||$lte||${format(weekEnd, "yyyy-MM-dd")}&join=project&join=task&limit=200`
      );
      const list: any[] = Array.isArray(res) ? res : res.data ?? [];
      const fetched: Entry[] = list.map((t) => {
        const cat: "BENCH" | "LEARNING" | undefined = t.category ?? undefined;
        return {
          id:          t.id,
          date:        new Date(t.date + "T00:00:00"),
          projectId:   t.projectId ?? null,
          projectName: cat
            ? `${SPECIAL[cat].emoji} ${SPECIAL[cat].label}`
            : (t.project?.name ?? `Project ${t.projectId}`),
          category:    cat,
          taskId:      t.taskId   ?? undefined,
          taskName:    t.task?.name ?? undefined,
          hours:       t.hours,
          description: t.description ?? undefined,
          status:      (t.status ?? "PENDING") as EntryStatus,
        };
      });
      setEntries((prev) => [
        ...prev.filter((e) => !isWithinWeek(e.date, ws)),
        ...fetched,
      ]);
    } catch (e) { console.error("Failed to load entries:", e); }
  };

  const isWithinWeek = (date: Date, ws: Date) => {
    const we = addDays(ws, 6);
    return date >= ws && date <= we;
  };

  const getEntriesForDay   = (date: Date) => entries.filter((e) => isSameDay(e.date, date));
  const getTotalHours      = (date: Date) => getEntriesForDay(date).reduce((s, e) => s + e.hours, 0);
  const getColor           = (i: number) => COLORS[i % COLORS.length];
  const getDotColor        = (i: number) => DOT_COLORS[i % DOT_COLORS.length];

  /** True when the date falls on one of the user's configured days off. */
  const isDayOff = (date: Date) => daysOff.includes(format(date, "EEEE").toUpperCase());

  /** True when ALL existing entries for a day are APPROVED (day is fully locked) */
  const isDayFullyLocked   = (date: Date) => {
    const dayEntries = getEntriesForDay(date);
    return dayEntries.length > 0 && dayEntries.every((e) => e.status === "APPROVED");
  };
  /** True when at least one entry for the day is APPROVED */
  const isDayPartiallyLocked = (date: Date) => getEntriesForDay(date).some((e) => e.status === "APPROVED");

  const STATUS_BADGE: Record<EntryStatus, string> = {
    PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
    APPROVED: "bg-green-50 text-green-700 border-green-200",
    REJECTED: "bg-red-50   text-red-600   border-red-200",
  };

  const openModal = (date: Date) => {
    if (isFutureDay(date)) return;
    if (getLeaveForDay(date)) return;   // blocked — on approved leave
    if (isDayOff(date)) return;         // blocked — day off
    setSelectedDate(date);
    setRemovedIds([]);
    setSaveError("");
    const existing = getEntriesForDay(date);
    const rows: FormRow[] = existing.length
      ? existing.map((e) => ({
          id:          e.id,
          projectId:   e.category
            ? SPECIAL[e.category].sentinel
            : String(e.projectId ?? ""),
          taskId:      e.taskId ? String(e.taskId) : "",
          hours:       String(e.hours),
          description: e.description ?? "",
          locked:      e.status === "APPROVED",   // ← lock approved entries
        }))
      : [{ projectId: "", taskId: "", hours: "", description: "" }];
    setFormRows(rows);

    /* snapshot originals so save can diff later */
    const origMap: Record<number, FormRow> = {};
    rows.forEach((r) => { if (r.id) origMap[r.id] = { ...r }; });
    originalRowsRef.current = origMap;

    const opts: Record<number, Task[]> = {};
    Promise.all(
      rows.map(async (r, idx) => {
        if (r.projectId && !isSpecialSentinel(r.projectId)) {
          opts[idx] = await fetchTasksForProject(Number(r.projectId));
        }
      })
    ).then(() => setTaskOptions({ ...opts }));
    setShowModal(true);
  };

  const addRow = () => {
    setFormRows((p) => [...p, { projectId: "", taskId: "", hours: "", description: "" }]);
  };

  const removeRow = (i: number) => {
    const row = formRows[i];
    if (row.locked) return;                        // ← block deleting approved entries
    if (row.id) setRemovedIds((prev) => [...prev, row.id!]);
    setFormRows((p) => p.filter((_, idx) => idx !== i));
    setTaskOptions((prev) => {
      const next: Record<number, Task[]> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < i) next[ki] = v;
        else if (ki > i) next[ki - 1] = v;
      });
      return next;
    });
  };

  const updateRow = async (i: number, field: keyof FormRow, value: string) => {
    setFormRows((p) => {
      const u = [...p];
      u[i] = { ...u[i], [field]: value };
      if (field === "projectId") u[i].taskId = "";
      return u;
    });
    if (field === "projectId") {
      if (value && !isSpecialSentinel(value)) {
        const tasks = await fetchTasksForProject(Number(value));
        setTaskOptions((prev) => ({ ...prev, [i]: tasks }));
      } else {
        setTaskOptions((prev) => { const n = { ...prev }; delete n[i]; return n; });
      }
    }
  };

  const deleteEntry = async (entry: Entry) => {
    if (entry.status === "APPROVED") return;       // ← block deleting approved entries
    if (!entry.id) {
      setEntries((prev) => prev.filter((e) => e !== entry));
      return;
    }
    try {
      await apiFetch(`/timesheets/${entry.id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (e) { console.error(e); }
  };

  const SHIFT_LIMIT = 8;

  const totalModalHours = formRows.reduce((sum, r) => {
    const h = Number(r.hours);
    return sum + (isNaN(h) || h <= 0 ? 0 : h);
  }, 0);

  const rowHasChanged = (row: FormRow): boolean => {
    if (!row.id) return true; // new row always needs POST
    const orig = originalRowsRef.current[row.id];
    if (!orig) return true;
    return (
      orig.projectId   !== row.projectId   ||
      orig.taskId      !== row.taskId      ||
      orig.hours       !== row.hours       ||
      orig.description !== row.description
    );
  };

  const saveEntries = async () => {
    if (!selectedDate) return;
    if (totalModalHours > SHIFT_LIMIT) {
      setSaveError(`Total hours (${totalModalHours}h) exceed the ${SHIFT_LIMIT}-hour shift limit.`);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      // delete removed existing entries
      await Promise.all(removedIds.map((id) => apiFetch(`/timesheets/${id}`, { method: "DELETE" })));

      // patch changed existing rows / post new rows
      await Promise.all(
        formRows.map(async (row) => {
          if (row.locked) return;                  // ← never touch approved entries
          const hours = Number(row.hours);
          if (!row.projectId || !hours || hours <= 0) return;
          if (!rowHasChanged(row)) return; // skip unchanged existing entries

          const special = isSpecialSentinel(row.projectId);
          const project = special ? null : projects.find((p) => p.id === Number(row.projectId));
          if (!special && !project) return; // unknown project — skip

          const payload: any = special
            ? {
                category:    SENTINEL_TO_CATEGORY[row.projectId],
                projectId:   null,
                taskId:      null,
                date:        format(selectedDate, "yyyy-MM-dd"),
                hours,
                description: row.description || undefined,
              }
            : {
                projectId:   project!.id,
                taskId:      row.taskId ? Number(row.taskId) : null,
                date:        format(selectedDate, "yyyy-MM-dd"),
                hours,
                description: row.description || undefined,
              };

          if (row.id) {
            await apiFetch(`/timesheets/${row.id}`, { method: "PATCH", body: JSON.stringify(payload) });
          } else {
            await apiFetch("/timesheets", { method: "POST", body: JSON.stringify(payload) });
          }
        })
      );

      setShowModal(false);
      await loadEntriesForWeek(startOfWeek(selectedDate, { weekStartsOn: 1 }));
    } catch (err: any) {
      setSaveError(err.message ?? "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const navigateTo = (next: Date) => {
    next.setHours(0, 0, 0, 0);
    setDailyDate(next);
    const nextWS = startOfWeek(next, { weekStartsOn: 1 });
    if (!entries.some((e) => isWithinWeek(e.date, nextWS))) loadEntriesForWeek(nextWS);
  };
  const goBack    = () => navigateTo(subDays(dailyDate, 1));
  const goForward = () => { const d = addDays(dailyDate, 1); if (!isAfter(d, today)) navigateTo(d); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Timesheet</h1>
          <p className="text-sm text-slate-500">Track your work hours</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {(["weekly", "daily"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                view === v ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
              }`}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ══════ WEEKLY VIEW ══════ */}
      <AnimatePresence mode="wait">
        {view === "weekly" && (
          <motion.div key="weekly" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>

            {/* ── Week navigation bar ── */}
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4">
              <button
                onClick={goToPrevWeek}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition font-medium"
              >
                <ChevronLeft size={16} />
                Prev week
              </button>

              <WeekPicker
                value={weekStart}
                maxWeekStart={currentWeekStart}
                onChange={setWeekStart}
              />

              <button
                onClick={goToNextWeek}
                disabled={isCurrentWeek}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition font-medium disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next week
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-3">
              {days.map((day) => {
                const dayEntries  = getEntriesForDay(day);
                const total       = getTotalHours(day);
                const isFuture    = isFutureDay(day);
                const isToday     = isSameDay(day, today);
                const fullyLocked = isDayFullyLocked(day);
                const leaveInfo   = getLeaveForDay(day);
                const isOnLeave   = !!leaveInfo;
                const dayOff      = isDayOff(day);
                /* still clickable when partially locked (can view + add new entries) */
                const clickable   = !isFuture && !isOnLeave && !dayOff;

                return (
                  <motion.div
                    key={day.toISOString()}
                    whileHover={clickable ? { y: -3 } : {}}
                    onClick={() => clickable && openModal(day)}
                    className={`border rounded-xl p-3 min-h-[160px] transition select-none relative ${
                      isOnLeave   ? "bg-sky-50 border-sky-200 cursor-not-allowed"
                      : dayOff    ? "bg-slate-100 border-slate-200 cursor-not-allowed"
                      : isFuture  ? "bg-slate-50 border-slate-200 cursor-not-allowed opacity-50"
                      : fullyLocked ? "bg-green-50 border-green-200 cursor-pointer"
                      : isToday   ? "bg-slate-900 border-slate-800 cursor-pointer text-white"
                      : dayEntries.length ? "bg-white border-slate-200 cursor-pointer shadow-sm"
                      : "bg-white border-slate-200 cursor-pointer hover:shadow-sm"
                    }`}
                  >
                    {/* On-leave badge */}
                    {isOnLeave && (
                      <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-sky-100 text-sky-700 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-sky-200">
                        <Palmtree size={8} /> Leave
                      </div>
                    )}

                    {/* Day-off badge */}
                    {dayOff && !isOnLeave && (
                      <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-slate-200 text-slate-500 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-slate-300">
                        Day off
                      </div>
                    )}

                    {/* Fully-locked overlay badge */}
                    {!isOnLeave && fullyLocked && (
                      <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-green-100 text-green-700 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-green-200">
                        <Lock size={8} /> Approved
                      </div>
                    )}

                    <p className={`text-xs ${
                      isOnLeave ? "text-sky-400"
                      : dayOff   ? "text-slate-400"
                      : isToday && !fullyLocked ? "text-slate-300"
                      : fullyLocked ? "text-green-500"
                      : "text-slate-400"
                    }`}>{format(day, "EEE")}</p>

                    <p className={`text-xl font-bold mt-0.5 ${
                      isOnLeave ? "text-sky-700"
                      : dayOff   ? "text-slate-400"
                      : isToday && !fullyLocked ? "text-white"
                      : fullyLocked ? "text-green-800"
                      : "text-slate-900"
                    }`}>{format(day, "d")}</p>

                    {isOnLeave ? (
                      <div className="mt-3">
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-600 bg-sky-100 border border-sky-200 px-2 py-1 rounded-md">
                          <Palmtree size={9} />
                          <span className="truncate">{leaveInfo!.type.replace(/_/g, " ")}</span>
                        </div>
                        <p className="text-[9px] text-sky-400 mt-1.5">No timesheet entry allowed</p>
                      </div>
                    ) : dayOff ? (
                      <div className="mt-3">
                        <p className="text-[10px] text-slate-400">Day off</p>
                      </div>
                    ) : (
                      <>
                        <div className="mt-3 space-y-1">
                          {dayEntries.map((e, i) => (
                            <div key={i} className={`text-[10px] px-2 py-1 rounded-md border font-medium truncate flex items-center gap-1 ${
                              e.status === "APPROVED" ? "bg-green-50 border-green-200 text-green-700"
                              : e.status === "REJECTED" ? "bg-red-50 border-red-200 text-red-600"
                              : isToday ? "bg-white/10 border-white/20 text-white"
                              : getColor(i)
                            }`}>
                              {e.status === "APPROVED" && <Lock size={8} className="flex-shrink-0" />}
                              <span className="truncate">{e.projectName}{e.taskName ? ` · ${e.taskName}` : ""} · {e.hours}h</span>
                            </div>
                          ))}
                        </div>

                        {total > 0 && (
                          <p className={`text-xs mt-2 font-semibold ${
                            fullyLocked ? "text-green-700" : isToday ? "text-slate-300" : "text-slate-600"
                          }`}>{total}h</p>
                        )}
                        {!isFuture && dayEntries.length === 0 && <p className="text-[10px] mt-3 text-red-400">Missing log</p>}
                        {isFuture && <p className={`text-[10px] mt-3 ${isToday ? "text-slate-400" : "text-slate-300"}`}>Locked</p>}
                      </>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Weekly summary */}
            <div key={weekStart.toISOString()} className="mt-4 bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-slate-400">Week total</p>
                  <p className="text-xl font-bold text-slate-900">{days.reduce((s, d) => s + getTotalHours(d), 0)}h</p>
                </div>
                <div className="flex gap-1.5">
                  {days.map((d, i) => {
                    const h = getTotalHours(d);
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className={`w-2 rounded-full transition-all ${h > 0 ? "bg-slate-700" : "bg-slate-200"}`} style={{ height: `${Math.max(8, (h / 10) * 40)}px` }} />
                        <span className="text-[9px] text-slate-400">{format(d, "EEEEE")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════ DAILY VIEW ══════ */}
        {view === "daily" && (
          <motion.div key="daily" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-4">
              <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-slate-100 transition"><ChevronLeft size={18} /></button>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wide">{format(dailyDate, "EEEE")}</p>
                <p className="text-3xl font-bold text-slate-900">{format(dailyDate, "d")}</p>
                <p className="text-sm text-slate-400">{format(dailyDate, "MMMM yyyy")}</p>
              </div>
              <button onClick={goForward} disabled={isSameDay(dailyDate, today)}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* On-leave banner for daily view */}
              {getLeaveForDay(dailyDate) && (
                <div className="flex items-center gap-3 px-5 py-3 bg-sky-50 border-b border-sky-200">
                  <Palmtree size={16} className="text-sky-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-sky-700">On Approved Leave</p>
                    <p className="text-xs text-sky-500">
                      {getLeaveForDay(dailyDate)!.type.replace(/_/g, " ")} leave — timesheet entries are blocked for this day.
                    </p>
                  </div>
                </div>
              )}

              {/* Day-off banner for daily view */}
              {!getLeaveForDay(dailyDate) && isDayOff(dailyDate) && (
                <div className="flex items-center gap-3 px-5 py-3 bg-slate-100 border-b border-slate-200">
                  <div>
                    <p className="text-sm font-semibold text-slate-600">Day Off</p>
                    <p className="text-xs text-slate-400">This is a configured day off — timesheet entries are blocked.</p>
                  </div>
                </div>
              )}

              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Work Entries</p>
                  <p className="text-xs text-slate-400">{getTotalHours(dailyDate)}h logged</p>
                </div>
                {!isFutureDay(dailyDate) && !getLeaveForDay(dailyDate) && !isDayOff(dailyDate) && (
                  /* Show Edit button; if day is fully locked show a read-only indicator instead */
                  isDayFullyLocked(dailyDate) ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200 font-medium">
                      <Lock size={13} /> All Approved
                    </div>
                  ) : (
                    <button onClick={() => openModal(dailyDate)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 transition">
                      <Plus size={14} /> Edit
                    </button>
                  )
                )}
              </div>

              {getEntriesForDay(dailyDate).length === 0 ? (
                <div className="px-5 py-10 text-center">
                  {getLeaveForDay(dailyDate)
                    ? <><Palmtree size={28} className="mx-auto text-sky-300 mb-2" /><p className="text-sky-500 text-sm font-medium">You&apos;re on leave today</p><p className="text-sky-400 text-xs mt-1">Enjoy your time off!</p></>
                    : isDayOff(dailyDate)
                    ? <><p className="text-slate-500 font-medium">Day Off</p><p className="text-slate-400 text-xs mt-1">No timesheet entry allowed on days off.</p></>
                    : isFutureDay(dailyDate)
                    ? <p className="text-slate-400 text-sm">This day is locked.</p>
                    : <><p className="text-slate-500 font-medium">No entries yet</p><p className="text-slate-400 text-xs mt-1">Click Edit to log your work.</p></>}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {getEntriesForDay(dailyDate).map((e, i) => {
                    const isApproved = e.status === "APPROVED";
                    return (
                    <div key={i} className={`px-5 py-4 flex items-center gap-4 group ${isApproved ? "bg-green-50/40" : ""}`}>
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isApproved ? "bg-green-400" : getDotColor(i)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900 truncate">{e.projectName}</p>
                          {isApproved && (
                            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-green-700 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              <Lock size={8} /> Approved
                            </span>
                          )}
                          {e.status === "REJECTED" && (
                            <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              Rejected
                            </span>
                          )}
                        </div>
                        {e.taskName && (
                          <p className="flex items-center gap-1 text-xs text-indigo-600 mt-0.5">
                            <ListTodo size={10} /> {e.taskName}
                          </p>
                        )}
                        {e.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{e.description}</p>}
                      </div>
                      <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${isApproved ? "bg-green-50 border-green-200 text-green-700" : getColor(i)}`}>{e.hours}h</span>
                      {/* Only show delete for non-approved entries */}
                      {!isApproved ? (
                        <button
                          onClick={() => deleteEntry(e)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-400 transition rounded-lg hover:bg-red-50"
                          title="Delete entry"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <div className="w-[30px]" /> /* spacer to keep layout aligned */
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ MODAL ══════ */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showModal && selectedDate && (
              <motion.div
                className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              >
                <motion.div
                  initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                  className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
                >
                  <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">Log Work</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{format(selectedDate, "EEEE, MMMM d yyyy")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Live hours counter */}
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border transition-all ${
                        totalModalHours > SHIFT_LIMIT
                          ? "bg-red-50 border-red-200 text-red-600"
                          : totalModalHours === SHIFT_LIMIT
                          ? "bg-green-50 border-green-200 text-green-700"
                          : "bg-slate-100 border-slate-200 text-slate-600"
                      }`}>
                        <Clock size={13} />
                        {totalModalHours} / {SHIFT_LIMIT}h
                      </div>
                      <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
                    </div>
                  </div>

                  <div className="px-6 py-4 space-y-4 max-h-[400px] overflow-auto">
                    {formRows.map((row, i) => {
                      const tasks      = taskOptions[i] ?? [];
                      const isExisting = !!row.id;

                      /* ── LOCKED (approved) row — read-only display ── */
                      if (row.locked) {
                        const projName = isSpecialSentinel(row.projectId)
                          ? (row.projectId === "__bench__" ? "🪑 Bench" : "📚 Learning")
                          : (projects.find((p) => String(p.id) === row.projectId)?.name ?? row.projectId);
                        const taskName = tasks.find((t) => String(t.id) === row.taskId)?.name;
                        return (
                          <div key={i} className="flex gap-3 items-start rounded-xl p-3 -mx-1 bg-green-50 border border-green-200">
                            <Lock size={14} className="text-green-500 flex-shrink-0 mt-1" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">Approved — read only</span>
                              </div>
                              <p className="text-sm font-medium text-slate-900 truncate">{projName}</p>
                              {taskName && <p className="text-xs text-indigo-600 mt-0.5">{taskName}</p>}
                              {row.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{row.description}</p>}
                            </div>
                            <span className="text-sm font-bold text-green-700 bg-green-100 border border-green-200 px-3 py-1 rounded-full flex-shrink-0">
                              {row.hours}h
                            </span>
                            {/* no delete button for locked rows */}
                          </div>
                        );
                      }

                      /* ── Editable row ── */
                      return (
                        <div key={i} className={`flex gap-2 items-start rounded-xl p-3 -mx-1 ${isExisting ? "bg-slate-50 border border-slate-200" : ""}`}>
                          <div className="flex-1 space-y-2">
                            {isExisting && (
                              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Existing entry</p>
                            )}
                            <Combobox
                              value={row.projectId}
                              onChange={(val) => updateRow(i, "projectId", val)}
                              placeholder="Select project…"
                              searchable
                              groups={[
                                { label: "Special", options: [
                                  { value: "__bench__",    label: "🪑 Bench" },
                                  { value: "__learning__", label: "📚 Learning" },
                                ]},
                                { label: "Projects", options: projects.map((p) => ({ value: String(p.id), label: p.name })) },
                              ]}
                            />

                            {tasks.length > 0 && (
                              <Combobox
                                value={row.taskId}
                                onChange={(val) => updateRow(i, "taskId", val)}
                                options={[
                                  { value: "", label: "No task / general work" },
                                  ...tasks.map((t) => ({ value: String(t.id), label: t.name })),
                                ]}
                              />
                            )}

                            <input placeholder="Description (optional)" value={row.description}
                              onChange={(e) => updateRow(i, "description", e.target.value)}
                              className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                          </div>
                          <input type="number" min="0.5" max="24" step="0.5" placeholder="Hrs"
                            value={row.hours} onChange={(e) => updateRow(i, "hours", e.target.value)}
                            className="w-20 border border-slate-200 px-2 py-2 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-900" />
                          <button
                            onClick={() => removeRow(i)}
                            className="mt-2 text-slate-300 hover:text-red-400 transition"
                            title={isExisting ? "Delete this entry" : "Remove row"}
                          >
                            {isExisting ? <Trash2 size={16} /> : <span className="text-lg leading-none">✕</span>}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-6 pb-5 space-y-3">
                    <button
                      onClick={addRow}
                      disabled={totalModalHours >= SHIFT_LIMIT}
                      className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={14} /> Add entry
                    </button>
                    {totalModalHours > SHIFT_LIMIT && (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 font-medium">
                        Total hours ({totalModalHours}h) exceed the {SHIFT_LIMIT}-hour shift limit. Please reduce before saving.
                      </p>
                    )}
                    {saveError && totalModalHours <= SHIFT_LIMIT && (
                      <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
                    )}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={saveEntries}
                        disabled={saving || totalModalHours > SHIFT_LIMIT}
                        className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {saving ? (
                          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                        ) : (
                          <><CheckCircle2 size={15} /> Save</>
                        )}
                      </button>
                      <button onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition">Cancel</button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
