"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Briefcase, CheckCircle2, AlertCircle, TrendingUp,
  ListTodo, Calendar, MapPin, Activity, Target, XCircle,
} from "lucide-react";
import {
  format, startOfWeek, addDays, isSameDay, isAfter, getDay,
} from "date-fns";
import { apiFetch } from "@/lib/api";

/* ─── types ─── */
type Timesheet = {
  id: number;
  date: string;                                   // "YYYY-MM-DD"
  hours: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  projectId: number | null;
  category: "BENCH" | "LEARNING" | null;
  description: string | null;
  project?: { id: number; name: string } | null;
  task?:    { id: number; name: string } | null;
};

type Project = {
  id: number;
  name: string;
  status: string;
  shiftType: string | null;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
};

type Task = {
  id: number;
  name: string;
  projectId: number;
  status: "CREATED" | "ASSIGNED" | "WORK_IN_PROGRESS" | "ON_HOLD" | "EXTERNAL_DEPENDENCY" | "COMPLETED";
  project?: { id: number; name: string } | null;
};

/* ─── helpers ─── */
const norm = (r: any): any[] => Array.isArray(r) ? r : r?.data ?? r?.items ?? [];

/** Parse a "YYYY-MM-DD" calendar string as local midnight (avoids UTC offset shift). */
const localDate = (s: string) => new Date(s + "T00:00:00");

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning ☀️";
  if (h < 17) return "Good afternoon 🌤️";
  if (h < 21) return "Good evening 🌙";
  return "Working late 💻";
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50   text-red-600   border-red-200",
};

const MESSAGES = [
  "Log your hours consistently 📋",
  "Every contribution matters 🎯",
  "Your work shapes the project 🚀",
];

const EXPECTED_TODAY = 8;
const EXPECTED_WEEK  = 40;

/* ═══════════════════════════════════════════
   Main component
═══════════════════════════════════════════ */
export default function DashboardClient({ name }: { name: string }) {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [projects,   setProjects]   = useState<Project[]>([]);
  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loginInfo,  setLoginInfo]  = useState<any>(null);
  const [msgIdx,     setMsgIdx]     = useState(0);

  /* ── date anchors (stable across renders) ── */
  const today      = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayStr   = useMemo(() => format(today, "yyyy-MM-dd"), [today]);
  const weekStart  = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), [today]);
  const weekStartStr = useMemo(() => format(weekStart, "yyyy-MM-dd"), [weekStart]);
  const weekEndStr   = useMemo(() => format(addDays(weekStart, 6), "yyyy-MM-dd"), [weekStart]);

  /* ── fetch ── */
  useEffect(() => {
    const stored = localStorage.getItem("loginInfo");
    if (stored) setLoginInfo(JSON.parse(stored));

    Promise.all([
      apiFetch("/timesheets?join=project&join=task&limit=500&sort=date,DESC"),
      apiFetch("/projects?limit=100"),
      apiFetch("/tasks?join=project&limit=100"),
    ])
      .then(([tsRes, projRes, taskRes]) => {
        setTimesheets(norm(tsRes));
        setProjects(norm(projRes));
        setTasks(norm(taskRes));
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    const t = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 3_000);
    return () => clearInterval(t);
  }, []);

  /* ── derived stats ── */
  const todayHours = useMemo(
    () => timesheets.filter(t => t.date === todayStr).reduce((s, t) => s + t.hours, 0),
    [timesheets, todayStr],
  );

  const weekTimesheets = useMemo(
    () => timesheets.filter(t => t.date >= weekStartStr && t.date <= weekEndStr),
    [timesheets, weekStartStr, weekEndStr],
  );
  const weekHours = useMemo(() => weekTimesheets.reduce((s, t) => s + t.hours, 0), [weekTimesheets]);

  const pendingCount  = useMemo(() => timesheets.filter(t => t.status === "PENDING").length,  [timesheets]);
  const rejectedCount = useMemo(() => timesheets.filter(t => t.status === "REJECTED").length, [timesheets]);

  const activeProjects = useMemo(() => projects.filter(p => p.status === "ACTIVE"),     [projects]);
  const activeTasks    = useMemo(() => tasks.filter(t => t.status !== "COMPLETED"),       [tasks]);
  const totalHoursAll  = useMemo(() => timesheets.reduce((s, t) => s + t.hours, 0),      [timesheets]);

  /* ── weekly bar data (Mon → Sun) ── */
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d       = addDays(weekStart, i);
      const ds      = format(d, "yyyy-MM-dd");
      const hours   = timesheets.filter(t => t.date === ds).reduce((s, t) => s + t.hours, 0);
      const dow     = getDay(d);
      return {
        d,
        label:     format(d, "EEE"),
        dayNum:    format(d, "d"),
        hours,
        isWeekend: dow === 0 || dow === 6,
        isToday:   isSameDay(d, today),
        isPast:    !isSameDay(d, today) && !isAfter(d, today),
        isFuture:  isAfter(d, today),
      };
    }),
    [weekStart, today, timesheets],
  );
  const maxDayHours = Math.max(...weekDays.map(d => d.hours), 1);

  /* ── all-time contribution by project / category ── */
  const projectBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; hours: number }>();
    timesheets.forEach(t => {
      const key  = t.category ? `cat:${t.category}` : `proj:${t.projectId}`;
      const name = t.category === "BENCH"    ? "🪑 Bench"
                 : t.category === "LEARNING" ? "📚 Learning"
                 : (t.project?.name ?? `Project ${t.projectId}`);
      map.set(key, { name, hours: (map.get(key)?.hours ?? 0) + t.hours });
    });
    return [...map.values()].sort((a, b) => b.hours - a.hours).slice(0, 6);
  }, [timesheets]);
  const maxProjHours = Math.max(...projectBreakdown.map(p => p.hours), 1);

  /* ── recent entries ── */
  const recentEntries = useMemo(() => timesheets.slice(0, 6), [timesheets]);

  /* ── pending / rejected entries ── */
  const pendingEntries  = useMemo(() => timesheets.filter(t => t.status === "PENDING").slice(0, 5),  [timesheets]);
  const rejectedEntries = useMemo(() => timesheets.filter(t => t.status === "REJECTED").slice(0, 3), [timesheets]);

  /* ── loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  /* ── workdays elapsed this week (Mon-Fri only, up to today) ── */
  const workdaysSoFar = weekDays.filter(d => !d.isWeekend && (d.isToday || d.isPast)).length;
  const missedDays    = weekDays.filter(d => !d.isWeekend && d.isPast && d.hours === 0).length;

  return (
    <div className="space-y-6">

      {/* ══ Header ══ */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          {getGreeting()}, {name}
        </h1>

        <div className="flex flex-wrap items-center gap-3">
          {loginInfo && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="font-medium text-slate-700">Active session</span>
              {loginInfo.location && (
                <>
                  <MapPin size={10} className="text-slate-400" />
                  <span className="text-slate-500">{loginInfo.location}</span>
                </>
              )}
            </motion.div>
          )}

          {/* Rotating motivational message */}
          <div className="relative h-5 overflow-hidden min-w-[220px]">
            <AnimatePresence mode="wait">
              <motion.p
                key={msgIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-sm text-slate-400 absolute whitespace-nowrap"
              >
                {MESSAGES[msgIdx]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ══ Stat cards ══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today */}
        <StatCard
          icon={<Clock size={16} />}
          iconCls={todayHours >= EXPECTED_TODAY ? "bg-green-100 text-green-600" : "bg-indigo-100 text-indigo-600"}
          label="Today"
          value={`${todayHours}h`}
          sub={`of ${EXPECTED_TODAY}h target`}
          progress={Math.min((todayHours / EXPECTED_TODAY) * 100, 100)}
          progressCls={todayHours >= EXPECTED_TODAY ? "bg-green-500" : todayHours > 0 ? "bg-indigo-500" : "bg-slate-200"}
          badge={todayHours === 0 ? { label: "Nothing logged", cls: "bg-red-50 text-red-600" } : null}
        />

        {/* This week */}
        <StatCard
          icon={<TrendingUp size={16} />}
          iconCls="bg-violet-100 text-violet-600"
          label="This Week"
          value={`${weekHours}h`}
          sub={`of ${EXPECTED_WEEK}h · ${workdaysSoFar} day${workdaysSoFar !== 1 ? "s" : ""} worked`}
          progress={Math.min((weekHours / EXPECTED_WEEK) * 100, 100)}
          progressCls={weekHours >= EXPECTED_WEEK ? "bg-green-500" : weekHours > 0 ? "bg-violet-500" : "bg-slate-200"}
          badge={missedDays > 0 ? { label: `${missedDays} day${missedDays > 1 ? "s" : ""} missed`, cls: "bg-orange-50 text-orange-600" } : null}
        />

        {/* Projects */}
        <StatCard
          icon={<Briefcase size={16} />}
          iconCls="bg-sky-100 text-sky-600"
          label="Active Projects"
          value={String(activeProjects.length)}
          sub={`${activeTasks.length} task${activeTasks.length !== 1 ? "s" : ""} assigned · ${totalHoursAll}h total`}
        />

        {/* Approvals */}
        <StatCard
          icon={pendingCount > 0 ? <AlertCircle size={16} /> : rejectedCount > 0 ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          iconCls={pendingCount > 0 ? "bg-amber-100 text-amber-600" : rejectedCount > 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}
          label="Pending Approval"
          value={String(pendingCount)}
          sub={pendingCount === 1 ? "entry awaiting review" : "entries awaiting review"}
          badge={rejectedCount > 0 ? { label: `${rejectedCount} rejected`, cls: "bg-red-50 text-red-600" } : null}
        />
      </div>

      {/* ══ Weekly activity + Contribution ══ */}
      <div className="grid lg:grid-cols-5 gap-6">

        {/* Weekly bar chart */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Weekly Activity</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
              {weekHours}h / {EXPECTED_WEEK}h
            </span>
          </div>

          <div className="flex items-end gap-1.5 h-32">
            {weekDays.map((d, i) => {
              const barH   = d.isFuture ? 0 : Math.max(d.hours > 0 ? 6 : 0, (d.hours / maxDayHours) * 100);
              const barCls = d.isToday   ? "bg-slate-900"
                           : d.isWeekend ? "bg-slate-200"
                           : d.isPast && d.hours === 0 ? "bg-red-200"
                           : "bg-indigo-400";
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.label} · ${d.hours}h`}>
                  <span className="text-[10px] text-slate-400 font-medium h-4">
                    {d.hours > 0 ? `${d.hours}h` : ""}
                  </span>
                  <div className="w-full relative" style={{ height: 72 }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${barH}%` }}
                      transition={{ duration: 0.5, delay: i * 0.06 }}
                      className={`absolute bottom-0 w-full rounded-t-md ${barCls}`}
                    />
                    {d.isPast && !d.isWeekend && d.hours === 0 && (
                      <div className="absolute bottom-0 w-full h-0.5 rounded bg-red-300" />
                    )}
                  </div>
                  <span className={`text-[10px] font-medium mt-0.5 ${d.isToday ? "text-slate-900" : "text-slate-400"}`}>
                    {d.label}
                  </span>
                  <span className="text-[9px] text-slate-300">{d.dayNum}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 flex-wrap">
            <LegendDot cls="bg-slate-900"  label="Today" />
            <LegendDot cls="bg-indigo-400" label="Logged" />
            <LegendDot cls="bg-red-200"    label="Missing" />
            <LegendDot cls="bg-slate-200"  label="Weekend" />
          </div>
        </div>

        {/* All-time contribution by project */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-900">Your Contribution</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {totalHoursAll}h logged across all projects
            </p>
          </div>

          {projectBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 text-slate-300">
              <Activity size={28} className="mb-2" />
              <p className="text-xs text-slate-400">No entries logged yet</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {projectBreakdown.map((p, i) => {
                const pct = totalHoursAll > 0 ? Math.round((p.hours / totalHoursAll) * 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-slate-700 truncate max-w-[150px]" title={p.name}>
                        {p.name}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] text-slate-400">{pct}%</span>
                        <span className="text-xs font-semibold text-slate-800">{p.hours}h</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(p.hours / maxProjHours) * 100}%` }}
                        transition={{ duration: 0.6, delay: i * 0.08 }}
                        className="h-full rounded-full bg-indigo-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ Alerts: Pending & Rejected ══ */}
      {(pendingEntries.length > 0 || rejectedEntries.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Pending approvals */}
          {pendingEntries.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-600" />
                <p className="text-sm font-semibold text-amber-800">Awaiting Approval</p>
                <span className="ml-auto text-xs text-amber-600 font-medium">{pendingCount} entr{pendingCount === 1 ? "y" : "ies"}</span>
              </div>
              <div className="divide-y divide-amber-100">
                {pendingEntries.map((t) => {
                  const label = t.category === "BENCH"    ? "🪑 Bench"
                              : t.category === "LEARNING" ? "📚 Learning"
                              : (t.project?.name ?? `Project ${t.projectId}`);
                  return (
                    <div key={t.id} className="px-5 py-2.5 flex items-center gap-3">
                      <div className="text-center w-8 flex-shrink-0">
                        <p className="text-sm font-bold text-amber-900 leading-none">{format(localDate(t.date), "d")}</p>
                        <p className="text-[10px] text-amber-500">{format(localDate(t.date), "MMM")}</p>
                      </div>
                      <p className="flex-1 text-xs font-medium text-amber-800 truncate">{label}</p>
                      <span className="text-xs font-semibold text-amber-700">{t.hours}h</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rejected entries */}
          {rejectedEntries.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-red-200 flex items-center gap-2">
                <XCircle size={14} className="text-red-600" />
                <p className="text-sm font-semibold text-red-800">Rejected — Action Needed</p>
                <span className="ml-auto text-xs text-red-600 font-medium">{rejectedCount} entr{rejectedCount === 1 ? "y" : "ies"}</span>
              </div>
              <div className="divide-y divide-red-100">
                {rejectedEntries.map((t) => {
                  const label = t.category === "BENCH"    ? "🪑 Bench"
                              : t.category === "LEARNING" ? "📚 Learning"
                              : (t.project?.name ?? `Project ${t.projectId}`);
                  return (
                    <div key={t.id} className="px-5 py-2.5 flex items-center gap-3">
                      <div className="text-center w-8 flex-shrink-0">
                        <p className="text-sm font-bold text-red-900 leading-none">{format(localDate(t.date), "d")}</p>
                        <p className="text-[10px] text-red-400">{format(localDate(t.date), "MMM")}</p>
                      </div>
                      <p className="flex-1 text-xs font-medium text-red-800 truncate">{label}</p>
                      <span className="text-xs font-semibold text-red-700">{t.hours}h</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Assigned Tasks + Recent Entries ══ */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Assigned tasks */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <ListTodo size={15} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-900">Assigned Tasks</p>
            <span className="ml-auto text-xs text-slate-400">
              {activeTasks.length} open · {tasks.filter(t => t.status === "COMPLETED").length} done
            </span>
          </div>

          {activeTasks.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle2 size={24} className="mx-auto mb-2 text-green-400" />
              <p className="text-sm text-slate-500 font-medium">All caught up!</p>
              <p className="text-xs text-slate-400 mt-0.5">No active tasks assigned to you.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {activeTasks.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  className="px-5 py-3 flex items-center gap-3"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                    {t.project && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{t.project.name}</p>
                    )}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium flex-shrink-0">
                    Active
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Recent timesheet entries */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Calendar size={15} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-900">Recent Entries</p>
            <span className="ml-auto text-xs text-slate-400">Last {recentEntries.length}</span>
          </div>

          {recentEntries.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Target size={24} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-500 font-medium">No entries yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Head to Timesheet to log your first hours.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {recentEntries.map((t, i) => {
                const label = t.category === "BENCH"    ? "🪑 Bench"
                            : t.category === "LEARNING" ? "📚 Learning"
                            : (t.project?.name ?? `Project ${t.projectId}`);
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: 4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3) }}
                    className="px-5 py-3 flex items-center gap-3"
                  >
                    <div className="text-center w-9 flex-shrink-0">
                      <p className="text-base font-bold text-slate-900 leading-none">
                        {format(localDate(t.date), "d")}
                      </p>
                      <p className="text-[10px] text-slate-400">{format(localDate(t.date), "MMM")}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{label}</p>
                      {t.task && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{t.task.name}</p>
                      )}
                      {t.description && !t.task && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{t.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-slate-700">{t.hours}h</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${STATUS_STYLES[t.status]}`}>
                        {t.status}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

/* ─── Sub-components ─── */

function StatCard({
  icon, iconCls, label, value, sub, progress, progressCls, badge,
}: {
  icon:        React.ReactNode;
  iconCls?:    string;
  label:       string;
  value:       string;
  sub:         string;
  progress?:   number;
  progressCls?: string;
  badge?:      { label: string; cls: string } | null;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 200 }}
      className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconCls ?? "bg-slate-100 text-slate-600"}`}>
          {icon}
        </div>
        {badge && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
            {badge.label}
          </span>
        )}
      </div>

      <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>

      {progress !== undefined && (
        <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8 }}
            className={`h-full rounded-full ${progressCls ?? "bg-indigo-500"}`}
          />
        </div>
      )}

      <p className="text-[11px] text-slate-400 mt-1">{sub}</p>
    </motion.div>
  );
}

function LegendDot({ cls, label }: { cls: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-sm ${cls}`} />
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
}
