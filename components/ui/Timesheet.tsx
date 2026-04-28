"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  format, startOfWeek, addDays, subDays,
  isSameDay, getDay, isAfter,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, ListTodo, Trash2, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Combobox from "@/components/ui/Combobox";

type Project = { id: number; name: string };
type Task    = { id: number; name: string; projectId: number };
type Entry   = {
  id?: number;
  date: Date;
  projectId: number | null;
  projectName: string;
  category?: "BENCH" | "LEARNING";
  taskId?: number; taskName?: string;
  hours: number; description?: string;
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
type FormRow = { id?: number; projectId: string; taskId: string; hours: string; description: string };

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

export default function Timesheet() {
  const [view, setView] = useState<"weekly" | "daily">("weekly");
  const [projects, setProjects]   = useState<Project[]>([]);
  const [entries, setEntries]     = useState<Entry[]>([]);
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

  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days      = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const isFutureDay = (d: Date) => isAfter(d, today);

  useEffect(() => {
    loadProjects();
    loadEntriesForWeek(weekStart);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProjects = async () => {
    try {
      const res = await apiFetch("/projects");
      setProjects(Array.isArray(res) ? res : res.data ?? []);
    } catch (e) { console.error(e); }
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

  const getEntriesForDay = (date: Date) => entries.filter((e) => isSameDay(e.date, date));
  const getTotalHours    = (date: Date) => getEntriesForDay(date).reduce((s, e) => s + e.hours, 0);
  const getColor         = (i: number) => COLORS[i % COLORS.length];
  const getDotColor      = (i: number) => DOT_COLORS[i % DOT_COLORS.length];

  const openModal = (date: Date) => {
    if (isFutureDay(date)) return;
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
            <div className="grid grid-cols-7 gap-3">
              {days.map((day) => {
                const dayEntries = getEntriesForDay(day);
                const total      = getTotalHours(day);
                const isFuture   = isFutureDay(day);
                const isToday    = isSameDay(day, today);
                return (
                  <motion.div
                    key={day.toISOString()}
                    whileHover={!isFuture ? { y: -3 } : {}}
                    onClick={() => openModal(day)}
                    className={`border rounded-xl p-3 min-h-[160px] transition select-none ${
                      isFuture  ? "bg-slate-50 border-slate-200 cursor-not-allowed opacity-50"
                      : isToday ? "bg-slate-900 border-slate-800 cursor-pointer text-white"
                      : dayEntries.length ? "bg-white border-slate-200 cursor-pointer shadow-sm"
                      : "bg-white border-slate-200 cursor-pointer hover:shadow-sm"
                    }`}
                  >
                    <p className={`text-xs ${isToday ? "text-slate-300" : "text-slate-400"}`}>{format(day, "EEE")}</p>
                    <p className={`text-xl font-bold mt-0.5 ${isToday ? "text-white" : "text-slate-900"}`}>{format(day, "d")}</p>
                    <div className="mt-3 space-y-1">
                      {dayEntries.map((e, i) => (
                        <div key={i} className={`text-[10px] px-2 py-1 rounded-md border font-medium truncate ${isToday ? "bg-white/10 border-white/20 text-white" : getColor(i)}`}>
                          {e.projectName}{e.taskName ? ` · ${e.taskName}` : ""} · {e.hours}h
                        </div>
                      ))}
                    </div>
                    {total > 0 && <p className={`text-xs mt-2 font-semibold ${isToday ? "text-slate-300" : "text-slate-600"}`}>{total}h</p>}
                    {!isFuture && dayEntries.length === 0 && <p className="text-[10px] mt-3 text-red-400">Missing log</p>}
                    {isFuture && <p className={`text-[10px] mt-3 ${isToday ? "text-slate-400" : "text-slate-300"}`}>Locked</p>}
                  </motion.div>
                );
              })}
            </div>

            {/* Weekly summary */}
            <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
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
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Work Entries</p>
                  <p className="text-xs text-slate-400">{getTotalHours(dailyDate)}h logged</p>
                </div>
                {!isFutureDay(dailyDate) && (
                  <button onClick={() => openModal(dailyDate)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 transition">
                    <Plus size={14} /> Edit
                  </button>
                )}
              </div>

              {getEntriesForDay(dailyDate).length === 0 ? (
                <div className="px-5 py-10 text-center">
                  {isFutureDay(dailyDate)
                    ? <p className="text-slate-400 text-sm">This day is locked.</p>
                    : <><p className="text-slate-500 font-medium">No entries yet</p><p className="text-slate-400 text-xs mt-1">Click Edit to log your work.</p></>}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {getEntriesForDay(dailyDate).map((e, i) => (
                    <div key={i} className="px-5 py-4 flex items-center gap-4 group">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getDotColor(i)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{e.projectName}</p>
                        {e.taskName && (
                          <p className="flex items-center gap-1 text-xs text-indigo-600 mt-0.5">
                            <ListTodo size={10} /> {e.taskName}
                          </p>
                        )}
                        {e.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{e.description}</p>}
                      </div>
                      <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${getColor(i)}`}>{e.hours}h</span>
                      <button
                        onClick={() => deleteEntry(e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-400 transition rounded-lg hover:bg-red-50"
                        title="Delete entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
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
                      const tasks   = taskOptions[i] ?? [];
                      const isExisting = !!row.id;
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
