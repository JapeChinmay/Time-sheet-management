"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck, Calendar, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Clock, Users, Briefcase,
  RefreshCw, Check, X, AlertCircle, Filter,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, parseISO } from "date-fns";
import { apiFetch } from "@/lib/api";
import Combobox from "@/components/ui/Combobox";
import DatePicker from "@/components/ui/DatePicker";
import SmartLoader from "@/components/ui/SmartLoader";

/* ─── types ─── */
type Project = { id: number; name: string; status: string };
type TsUser  = { id: number; name: string; email: string; role: string };
type TsTask  = { id: number; name: string };
type Entry   = {
  id: number;
  date: string;
  hours: number;
  description?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  projectId: number | null;
  userId: number;
  user?: TsUser;
  project?: { id: number; name: string } | null;
  task?: TsTask | null;
};

type ViewMode = "daily" | "weekly";

/* ─── status helpers ─── */
const STATUS_STYLE: Record<string, string> = {
  PENDING:  "bg-amber-50  text-amber-700  border-amber-200",
  APPROVED: "bg-green-50  text-green-700  border-green-200",
  REJECTED: "bg-red-50    text-red-600    border-red-200",
};

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-slate-800 text-white",
  ADMIN:      "bg-slate-200 text-slate-700",
  MANAGER:    "bg-teal-100 text-teal-700",
  HR:         "bg-pink-100 text-pink-700",
  INTERNAL:   "bg-indigo-100 text-indigo-700",
  EXTERNAL:   "bg-violet-100 text-violet-700",
  INTERN:     "bg-orange-100 text-orange-700",
};

function getUser() {
  try { return JSON.parse(atob(localStorage.getItem("token")!.split(".")[1])); }
  catch { return { name: "Manager" }; }
}

/* ─── date helpers ─── */
function isoDate(d: Date) { return format(d, "yyyy-MM-dd"); }
function weekRange(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return { start, end: endOfWeek(anchor, { weekStartsOn: 1 }) };
}

/* ─── main component ─── */
export default function PMTimesheetApprovalPage() {
  const [view, setView]           = useState<ViewMode>("daily");
  const [dayDate, setDayDate]     = useState(new Date());
  const [weekAnchor, setWeekAnchor] = useState(new Date());

  const [projects, setProjects]   = useState<Project[]>([]);
  const [entries, setEntries]     = useState<Entry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notPM, setNotPM]         = useState(false);

  /* filter by project */
  const [filterProject, setFilterProject] = useState("");

  /* per-entry action state */
  const [acting, setActing]       = useState<Record<number, boolean>>({});
  const [bulkActing, setBulkActing] = useState(false);

  /* ── load ── */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      let dateFrom: string, dateTo: string;
      if (view === "daily") {
        dateFrom = dateTo = isoDate(dayDate);
      } else {
        const { start, end } = weekRange(weekAnchor);
        dateFrom = isoDate(start);
        dateTo   = isoDate(end);
      }

      const params = new URLSearchParams({ dateFrom, dateTo });
      if (filterProject) params.set("projectId", filterProject);

      const res = await apiFetch(`/timesheets/manager/view?${params}`);
      if (!res.projects || res.projects.length === 0) {
        setNotPM(true);
      } else {
        setNotPM(false);
        setProjects(res.projects);
        setEntries(res.timesheets);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [view, dayDate, weekAnchor, filterProject]);

  useEffect(() => { load(); }, [load]);

  /* ── approve / reject single entry ── */
  const updateStatus = async (id: number, status: "APPROVED" | "REJECTED") => {
    setActing((prev) => ({ ...prev, [id]: true }));
    try {
      await apiFetch(`/timesheets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setEntries((prev) => prev.map((e) => e.id === id ? { ...e, status } : e));
    } catch (err: any) {
      alert(err.message ?? "Failed to update");
    } finally {
      setActing((prev) => ({ ...prev, [id]: false }));
    }
  };

  /* ── bulk approve all pending ── */
  const approveAll = async (ids: number[]) => {
    if (!ids.length) return;
    setBulkActing(true);
    try {
      await Promise.all(ids.map((id) =>
        apiFetch(`/timesheets/${id}`, { method: "PATCH", body: JSON.stringify({ status: "APPROVED" }) })
      ));
      setEntries((prev) => prev.map((e) => ids.includes(e.id) ? { ...e, status: "APPROVED" } : e));
    } catch (err: any) {
      alert(err.message ?? "Bulk approve failed");
    } finally {
      setBulkActing(false);
    }
  };

  /* ── derived stats ── */
  const pending  = entries.filter((e) => e.status === "PENDING").length;
  const approved = entries.filter((e) => e.status === "APPROVED").length;
  const rejected = entries.filter((e) => e.status === "REJECTED").length;
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);

  /* ── group entries by projectId then by date (for weekly) ── */
  const byProject = entries.reduce<Record<number, Entry[]>>((acc, e) => {
    const pid = e.projectId ?? 0;
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(e);
    return acc;
  }, {});

  if (loading) return <SmartLoader name={getUser().name} />;

  /* ── not a PM ── */
  if (notPM) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-400">
        <AlertCircle size={40} className="text-amber-400" />
        <p className="text-lg font-semibold text-slate-700">No managed projects</p>
        <p className="text-sm text-center max-w-xs">
          You are not assigned as the project manager for any project yet.
          Ask an admin to assign you as a project manager.
        </p>
      </div>
    );
  }

  /* ── week days for weekly view header ── */
  const { start: wStart, end: wEnd } = weekRange(weekAnchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(wStart, i));

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardCheck size={26} className="text-indigo-500" />
            Timesheet Approval
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and approve time entries for your projects
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-sm px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-500"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<Clock size={15} />}        label="Total Hours"  value={`${totalHours}h`}  color="slate" />
        <StatCard icon={<AlertCircle size={15} />}  label="Pending"      value={pending}            color="amber" />
        <StatCard icon={<CheckCircle2 size={15} />} label="Approved"     value={approved}           color="green" />
        <StatCard icon={<XCircle size={15} />}      label="Rejected"     value={rejected}           color="red" />
      </div>

      {/* ── Controls bar ── */}
      <div className="flex items-center gap-3 flex-wrap">

        {/* View toggle */}
        <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1 flex-shrink-0">
          {(["daily", "weekly"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                view === v ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Date / week navigator */}
        {view === "daily" ? (
          <div className="flex items-center gap-1">
            <button onClick={() => setDayDate((d) => addDays(d, -1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
              <ChevronLeft size={16} />
            </button>
            <DatePicker
              value={isoDate(dayDate)}
              onChange={(val) => setDayDate(val ? parseISO(val) : new Date())}
              placeholder="Pick date"
            />
            <button onClick={() => setDayDate((d) => addDays(d, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekAnchor((d) => subWeeks(d, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[160px] text-center">
              {format(wStart, "MMM d")} – {format(wEnd, "MMM d, yyyy")}
            </span>
            <button onClick={() => setWeekAnchor((d) => addWeeks(d, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Project filter */}
        {projects.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-slate-400 flex-shrink-0" />
            <Combobox
              value={filterProject}
              onChange={setFilterProject}
              placeholder="All projects"
              options={[
                { value: "", label: "All projects" },
                ...projects.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
              className="w-48"
            />
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {entries.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl py-20 text-center text-slate-400">
          <Calendar size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-600">No timesheet entries</p>
          <p className="text-sm mt-1">
            {view === "daily"
              ? `No entries submitted for ${format(dayDate, "EEEE, MMM d")}`
              : `No entries submitted for the week of ${format(wStart, "MMM d")}`}
          </p>
        </div>
      )}

      {/* ── Per-project sections ── */}
      {Object.entries(byProject).map(([pidStr, projectEntries]) => {
        const pid = Number(pidStr);
        const proj = projects.find((p) => p.id === pid);
        const pendingIds = projectEntries.filter((e) => e.status === "PENDING").map((e) => e.id);
        const projHours  = projectEntries.reduce((s, e) => s + e.hours, 0);

        return (
          <div key={pid} className="bg-white border border-slate-200 rounded-xl overflow-hidden">

            {/* Project header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Briefcase size={14} className="text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">
                    {proj?.name ?? `Project ${pid}`}
                  </p>
                  <p className="text-xs text-slate-400">
                    {projHours}h total · {projectEntries.filter((e) => e.status === "PENDING").length} pending
                  </p>
                </div>
              </div>
              {pendingIds.length > 0 && (
                <button
                  onClick={() => approveAll(pendingIds)}
                  disabled={bulkActing}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-60 font-medium"
                >
                  <Check size={12} />
                  {bulkActing ? "Approving…" : `Approve all (${pendingIds.length})`}
                </button>
              )}
            </div>

            {/* Weekly grouped-by-date header */}
            {view === "weekly" && (
              <WeeklyGrouped
                entries={projectEntries}
                weekDays={weekDays}
                acting={acting}
                onApprove={(id) => updateStatus(id, "APPROVED")}
                onReject={(id) => updateStatus(id, "REJECTED")}
              />
            )}

            {/* Daily flat list */}
            {view === "daily" && (
              <div className="divide-y divide-slate-100">
                {projectEntries.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-400 text-center">No entries for this day.</p>
                ) : (
                  projectEntries.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      acting={!!acting[e.id]}
                      onApprove={() => updateStatus(e.id, "APPROVED")}
                      onReject={() => updateStatus(e.id, "REJECTED")}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────
   Weekly grouped-by-date sub-view
───────────────────────────────────────── */
function WeeklyGrouped({ entries, weekDays, acting, onApprove, onReject }: {
  entries: Entry[];
  weekDays: Date[];
  acting: Record<number, boolean>;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  return (
    <div>
      {weekDays.map((day) => {
        const dayStr  = format(day, "yyyy-MM-dd");
        const dayEntries = entries.filter((e) => e.date === dayStr);
        const dayHours   = dayEntries.reduce((s, e) => s + e.hours, 0);
        const isWeekend  = [0, 6].includes(day.getDay());

        return (
          <div key={dayStr}>
            {/* Day sub-header */}
            <div className={`px-5 py-2 flex items-center justify-between border-b border-slate-100 ${isWeekend ? "bg-slate-50" : "bg-slate-50/40"}`}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {format(day, "EEE, MMM d")}
                </span>
                {isWeekend && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded">Weekend</span>
                )}
              </div>
              {dayHours > 0 && (
                <span className="text-xs font-semibold text-slate-600">{dayHours}h</span>
              )}
            </div>

            {dayEntries.length === 0 ? (
              <div className="px-5 py-2.5 text-xs text-slate-400 italic">No entries</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {dayEntries.map((e) => (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    acting={!!acting[e.id]}
                    onApprove={() => onApprove(e.id)}
                    onReject={() => onReject(e.id)}
                    compact
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────
   Single timesheet entry row
───────────────────────────────────────── */
function EntryRow({ entry, acting, onApprove, onReject, compact }: {
  entry: Entry;
  acting: boolean;
  onApprove: () => void;
  onReject: () => void;
  compact?: boolean;
}) {
  const isPending  = entry.status === "PENDING";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`px-5 flex items-center gap-4 hover:bg-slate-50/60 transition ${compact ? "py-2.5" : "py-4"}`}
    >
      {/* User avatar */}
      <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-semibold flex-shrink-0">
        {entry.user?.name?.[0]?.toUpperCase() ?? "?"}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-slate-900 truncate">{entry.user?.name ?? "Unknown"}</p>
          {entry.user?.role && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_COLORS[entry.user.role] ?? "bg-slate-100 text-slate-600"}`}>
              {entry.user.role}
            </span>
          )}
        </div>
        {entry.task && (
          <p className="text-xs text-slate-500 truncate mt-0.5">Task: {entry.task.name}</p>
        )}
        {entry.description && (
          <p className="text-xs text-slate-400 truncate mt-0.5">{entry.description}</p>
        )}
      </div>

      {/* Date (only for daily view, where compact=false) */}
      {!compact && (
        <span className="text-xs text-slate-400 flex-shrink-0 hidden sm:block">
          {format(parseISO(entry.date), "MMM d")}
        </span>
      )}

      {/* Hours */}
      <span className="text-sm font-bold text-slate-700 flex-shrink-0 w-10 text-right">
        {entry.hours}h
      </span>

      {/* Status badge */}
      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${STATUS_STYLE[entry.status]}`}>
        {entry.status}
      </span>

      {/* Actions — only for PENDING */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {acting ? (
          <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-indigo-500 animate-spin" />
        ) : isPending ? (
          <>
            <button
              onClick={onApprove}
              title="Approve"
              className="w-7 h-7 rounded-full bg-green-100 text-green-700 hover:bg-green-200 flex items-center justify-center transition"
            >
              <Check size={13} />
            </button>
            <button
              onClick={onReject}
              title="Reject"
              className="w-7 h-7 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          /* Undo: re-set to pending if already approved/rejected */
          <button
            onClick={() => {
              /* No undo API in spec; just visual — call approve/reject inverse */
            }}
            className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 flex items-center justify-center transition opacity-0 group-hover:opacity-100"
            title="Already processed"
          >
            <Check size={11} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   Stat card
───────────────────────────────────────── */
function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number;
  color: "slate" | "amber" | "green" | "red";
}) {
  const colors = {
    slate: "bg-slate-100 text-slate-600",
    amber: "bg-amber-100 text-amber-600",
    green: "bg-green-100 text-green-600",
    red:   "bg-red-100   text-red-600",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}
