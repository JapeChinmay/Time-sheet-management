"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  format,
  startOfWeek,
  addDays,
  subDays,
  isSameDay,
  getDay,
  isAfter,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, Send, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Project = { id: number; name: string };
type Entry = { date: Date; projectId: number; projectName: string; hours: number; description?: string };
type SubmitState = "idle" | "loading" | "success" | "error";

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
  "bg-indigo-400", "bg-violet-400", "bg-purple-400",
  "bg-fuchsia-400", "bg-pink-400", "bg-rose-400",
  "bg-sky-400", "bg-teal-400",
];

export default function Timesheet() {
  const [view, setView] = useState<"weekly" | "daily">("weekly");
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dailyDate, setDailyDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formRows, setFormRows] = useState([{ projectId: "", hours: "", description: "" }]);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMsg, setSubmitMsg] = useState("");

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const isFutureDay = (date: Date) => isAfter(date, today);
  const isFriday = getDay(today) === 5;

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

  /** Fetch persisted timesheet entries for the 7-day week containing `ws` (Monday). */
  const loadEntriesForWeek = async (ws: Date) => {
    try {
      const weekEnd = addDays(ws, 6);
      const res = await apiFetch(
        `/timesheets?filter=date||$gte||${format(ws, "yyyy-MM-dd")}&filter=date||$lte||${format(weekEnd, "yyyy-MM-dd")}&join=project&limit=200`
      );
      const list: any[] = Array.isArray(res) ? res : res.data ?? [];
      const fetched: Entry[] = list.map((t) => ({
        date: new Date(t.date + "T00:00:00"), // keep as local date, avoid UTC shift
        projectId: t.projectId,
        projectName: t.project?.name ?? `Project ${t.projectId}`,
        hours: t.hours,
        description: t.description ?? undefined,
      }));
      // Replace only entries that fall within this week range; keep other weeks intact
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
  const getTotalHours = (date: Date) => getEntriesForDay(date).reduce((s, e) => s + e.hours, 0);
  const getColor = (index: number) => COLORS[index % COLORS.length];
  const getDotColor = (index: number) => DOT_COLORS[index % DOT_COLORS.length];

  const openModal = (date: Date) => {
    if (isFutureDay(date)) return;
    setSelectedDate(date);
    const existing = getEntriesForDay(date);
    setFormRows(
      existing.length
        ? existing.map((e) => ({ projectId: String(e.projectId), hours: String(e.hours), description: e.description ?? "" }))
        : [{ projectId: "", hours: "", description: "" }]
    );
    setShowModal(true);
  };

  const addRow = () => setFormRows((p) => [...p, { projectId: "", hours: "", description: "" }]);
  const removeRow = (i: number) => setFormRows((p) => p.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: "projectId" | "hours" | "description", value: string) =>
    setFormRows((p) => { const u = [...p]; u[i][field] = value; return u; });

  const saveEntries = () => {
    if (!selectedDate) return;
    const newEntries: Entry[] = formRows
      .map((row) => {
        const project = projects.find((p) => p.id === Number(row.projectId));
        const hours = Number(row.hours);
        if (!project || !hours || hours <= 0) return null;
        return { date: selectedDate, projectId: project.id, projectName: project.name, hours, description: row.description };
      })
      .filter(Boolean) as Entry[];
    setEntries([...entries.filter((e) => !isSameDay(e.date, selectedDate!)), ...newEntries]);
    setShowModal(false);
  };

  const postEntries = async (toSubmit: Entry[]) => {
    if (!toSubmit.length) { setSubmitMsg("No entries to submit."); setSubmitState("error"); return; }
    setSubmitState("loading");
    try {
      await Promise.all(
        toSubmit.map((e) =>
          apiFetch("/timesheets", {
            method: "POST",
            body: JSON.stringify({
              projectId: e.projectId,
              date: format(e.date, "yyyy-MM-dd"),
              hours: e.hours,
              description: e.description || undefined,
            }),
          })
        )
      );
      setSubmitState("success");
      setSubmitMsg(`${toSubmit.length} entr${toSubmit.length > 1 ? "ies" : "y"} submitted.`);
      // Re-sync from server so the UI shows persisted data
      const submittedWeekStart = startOfWeek(toSubmit[0].date, { weekStartsOn: 1 });
      await loadEntriesForWeek(submittedWeekStart);
      setTimeout(() => setSubmitState("idle"), 3000);
    } catch (err: any) {
      setSubmitState("error");
      setSubmitMsg(err.message ?? "Submission failed.");
      setTimeout(() => setSubmitState("idle"), 3000);
    }
  };

  const submitDay = () => postEntries(getEntriesForDay(view === "daily" ? dailyDate : today));
  const submitWeek = () => postEntries(days.flatMap(getEntriesForDay));

  /* ───────── Daily navigation ───────── */
  const navigateTo = (next: Date) => {
    next.setHours(0, 0, 0, 0);
    setDailyDate(next);
    const nextWeekStart = startOfWeek(next, { weekStartsOn: 1 });
    // Fetch if we've never loaded this week yet
    const alreadyLoaded = entries.some((e) => isWithinWeek(e.date, nextWeekStart));
    if (!alreadyLoaded) loadEntriesForWeek(nextWeekStart);
  };

  const goBack = () => navigateTo(subDays(dailyDate, 1));
  const goForward = () => {
    const d = addDays(dailyDate, 1);
    if (!isAfter(d, today)) navigateTo(d);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Timesheet</h1>
          <p className="text-sm text-slate-500">Track your work hours</p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {(["weekly", "daily"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                view === v ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════ WEEKLY VIEW ══════════════ */}
      <AnimatePresence mode="wait">
        {view === "weekly" && (
          <motion.div key="weekly" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="grid grid-cols-7 gap-3">
              {days.map((day, idx) => {
                const dayEntries = getEntriesForDay(day);
                const total = getTotalHours(day);
                const isFuture = isFutureDay(day);
                const isToday = isSameDay(day, today);

                return (
                  <motion.div
                    key={day.toISOString()}
                    whileHover={!isFuture ? { y: -3 } : {}}
                    onClick={() => openModal(day)}
                    className={`border rounded-xl p-3 min-h-[160px] transition select-none ${
                      isFuture
                        ? "bg-slate-50 border-slate-200 cursor-not-allowed opacity-50"
                        : isToday
                        ? "bg-slate-900 border-slate-800 cursor-pointer text-white"
                        : dayEntries.length
                        ? "bg-white border-slate-200 cursor-pointer shadow-sm"
                        : "bg-white border-slate-200 cursor-pointer hover:shadow-sm"
                    }`}
                  >
                    <p className={`text-xs ${isToday ? "text-slate-300" : "text-slate-400"}`}>{format(day, "EEE")}</p>
                    <p className={`text-xl font-bold mt-0.5 ${isToday ? "text-white" : "text-slate-900"}`}>{format(day, "d")}</p>

                    <div className="mt-3 space-y-1">
                      {dayEntries.map((e, i) => (
                        <div key={i} className={`text-[10px] px-2 py-1 rounded-md border font-medium truncate ${isToday ? "bg-white/10 border-white/20 text-white" : getColor(i)}`}>
                          {e.projectName} · {e.hours}h
                        </div>
                      ))}
                    </div>

                    {total > 0 && (
                      <p className={`text-xs mt-2 font-semibold ${isToday ? "text-slate-300" : "text-slate-600"}`}>{total}h</p>
                    )}
                    {!isFuture && dayEntries.length === 0 && (
                      <p className="text-[10px] mt-3 text-red-400">Missing log</p>
                    )}
                    {isFuture && <p className={`text-[10px] mt-3 ${isToday ? "text-slate-400" : "text-slate-300"}`}>Locked</p>}
                  </motion.div>
                );
              })}
            </div>

            {/* Weekly summary bar */}
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
              <SubmitButton state={submitState} msg={submitMsg} onSubmit={isFriday ? submitWeek : submitDay} label={isFriday ? "Submit Week" : "Submit Today"} />
            </div>
          </motion.div>
        )}

        {/* ══════════════ DAILY VIEW ══════════════ */}
        {view === "daily" && (
          <motion.div key="daily" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            {/* Day navigator */}
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-4">
              <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-slate-100 transition"><ChevronLeft size={18} /></button>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wide">{format(dailyDate, "EEEE")}</p>
                <p className="text-3xl font-bold text-slate-900">{format(dailyDate, "d")}</p>
                <p className="text-sm text-slate-400">{format(dailyDate, "MMMM yyyy")}</p>
              </div>
              <button
                onClick={goForward}
                disabled={isSameDay(dailyDate, today)}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Entries for the day */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Work Entries</p>
                  <p className="text-xs text-slate-400">{getTotalHours(dailyDate)}h logged</p>
                </div>
                {!isFutureDay(dailyDate) && (
                  <button
                    onClick={() => openModal(dailyDate)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 transition"
                  >
                    <Plus size={14} /> Edit
                  </button>
                )}
              </div>

              {getEntriesForDay(dailyDate).length === 0 ? (
                <div className="px-5 py-10 text-center">
                  {isFutureDay(dailyDate) ? (
                    <p className="text-slate-400 text-sm">This day is locked.</p>
                  ) : (
                    <>
                      <p className="text-slate-500 font-medium">No entries yet</p>
                      <p className="text-slate-400 text-xs mt-1">Click Edit to log your work.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {getEntriesForDay(dailyDate).map((e, i) => (
                    <div key={i} className="px-5 py-4 flex items-center gap-4">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getDotColor(i)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{e.projectName}</p>
                        {e.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{e.description}</p>}
                      </div>
                      <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${getColor(i)}`}>{e.hours}h</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            {!isFutureDay(dailyDate) && (
              <div className="flex justify-end">
                <SubmitButton state={submitState} msg={submitMsg} onSubmit={submitDay} label="Submit Day" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════ MODAL ══════════════ */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showModal && selectedDate && (
              <motion.div
                className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  initial={{ scale: 0.95, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 10 }}
                  className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
                >
                  <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">Log Work</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{format(selectedDate, "EEEE, MMMM d yyyy")}</p>
                    </div>
                    <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
                  </div>

                  <div className="px-6 py-4 space-y-3 max-h-[340px] overflow-auto">
                    {formRows.map((row, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-2">
                          <select
                            value={row.projectId}
                            onChange={(e) => updateRow(i, "projectId", e.target.value)}
                            className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                          >
                            <option value="">Select project…</option>
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <input
                            placeholder="Description (optional)"
                            value={row.description}
                            onChange={(e) => updateRow(i, "description", e.target.value)}
                            className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                        </div>
                        <input
                          type="number"
                          min="0.5"
                          max="24"
                          step="0.5"
                          placeholder="Hrs"
                          value={row.hours}
                          onChange={(e) => updateRow(i, "hours", e.target.value)}
                          className="w-20 border border-slate-200 px-2 py-2 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                        <button onClick={() => removeRow(i)} className="mt-2 text-slate-300 hover:text-red-400 transition text-lg leading-none">✕</button>
                      </div>
                    ))}
                  </div>

                  <div className="px-6 pb-5 space-y-3">
                    <button onClick={addRow} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                      <Plus size={14} /> Add project
                    </button>
                    <div className="flex gap-3 pt-1">
                      <button onClick={saveEntries} className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition">
                        Save
                      </button>
                      <button onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition">
                        Cancel
                      </button>
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

function SubmitButton({ state, msg, onSubmit, label }: { state: SubmitState; msg: string; onSubmit: () => void; label: string }) {
  if (state === "success") {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">
        <CheckCircle2 size={15} /> {msg}
      </div>
    );
  }
  if (state === "error") {
    return <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm">{msg}</div>;
  }
  return (
    <button
      onClick={onSubmit}
      disabled={state === "loading"}
      className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-60"
    >
      <Send size={14} />
      {state === "loading" ? "Submitting…" : label}
    </button>
  );
}
