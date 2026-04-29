"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Clock, Briefcase, CheckCircle2, XCircle,
  AlertCircle, TrendingUp, LogIn, Globe, Monitor, Calendar, Pencil, X, Check,
} from "lucide-react";
import {
  format, startOfWeek, addDays, subWeeks, isSameDay,
  parseISO, getDay,
} from "date-fns";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";
import Combobox from "@/components/ui/Combobox";
import { parseUTC } from "@/lib/date";

/* ─── types ─── */
type UserDetail = {
  id: number; name: string; email: string; role: string;
  status: string; designation?: string; module?: string | null;
  manager?: { name: string };
};

const SAP_MODULES = [
  { value: "SAP_BTP",  label: "SAP BTP"  },
  { value: "SAP_MM",   label: "SAP MM"   },
  { value: "SAP_FICO", label: "SAP FICO" },
  { value: "SAP_SF",   label: "SAP SF"   },
  { value: "SAP_SD",   label: "SAP SD"   },
  { value: "SAP_HCM",  label: "SAP HCM"  },
  { value: "SAP_ABAP", label: "SAP ABAP" },
  { value: "SAP_PS",   label: "SAP PS"   },
] as const;
const MODULE_LABEL: Record<string, string> = Object.fromEntries(
  SAP_MODULES.map((m) => [m.value, m.label])
);
type Timesheet = {
  id: number; date: string; hours: number; status: string;
  description?: string; projectId: number;
  project?: { name: string };
};
type LoginLog = {
  id: number; timestamp: string; browser?: string; system?: string;
  location?: { longitude: number; latitude: number } | null;
};

/* ─── helpers ─── */
const norm = (r: any): any[] => Array.isArray(r) ? r : r?.data ?? r?.items ?? [];

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-slate-800 text-white",
  ADMIN: "bg-slate-200 text-slate-700",
  INTERNAL: "bg-indigo-100 text-indigo-700",
  EXTERNAL: "bg-violet-100 text-violet-700",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING:  "bg-amber-50  text-amber-700  border-amber-200",
  APPROVED: "bg-green-50  text-green-700  border-green-200",
  REJECTED: "bg-red-50    text-red-600    border-red-200",
};

function weeksAgo(n: number) {
  const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
  return subWeeks(ws, n);
}

/* ─── component ─── */
export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* module inline edit */
  const [editingModule, setEditingModule] = useState(false);
  const [moduleVal, setModuleVal] = useState("");
  const [savingModule, setSavingModule] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch(`/users/${id}?join=manager`),
      apiFetch(`/timesheets?filter=userId||$eq||${id}&join=project&sort=date,DESC&limit=300`),
      apiFetch(`/user-logs?filter=userId||$eq||${id}&sort=timestamp,DESC&limit=20`),
    ])
      .then(([u, ts, lg]) => {
        setUser(u);
        setModuleVal(u.module ?? "");
        setTimesheets(norm(ts));
        setLogs(norm(lg));
      })
      .catch((e) => setError(e.message ?? "Failed to load user."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SmartLoader name="Loading…" />;
  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-red-400" />
        <p className="font-medium">{error || "User not found."}</p>
        <button onClick={() => router.back()} className="text-sm text-indigo-600 hover:underline">Go back</button>
      </div>
    );
  }

  /* ── derived ── */
  const totalHours = timesheets.reduce((s, t) => s + t.hours, 0);

  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekHours = timesheets
    .filter((t) => parseISO(t.date) >= thisWeekStart)
    .reduce((s, t) => s + t.hours, 0);

  const approved = timesheets.filter((t) => t.status === "APPROVED").length;
  const pending  = timesheets.filter((t) => t.status === "PENDING").length;
  const rejected = timesheets.filter((t) => t.status === "REJECTED").length;
  const approvalRate = timesheets.length
    ? Math.round((approved / timesheets.length) * 100) : 0;

  /* Hours per project */
  const projectMap = new Map<number, { name: string; hours: number }>();
  timesheets.forEach((t) => {
    const existing = projectMap.get(t.projectId);
    projectMap.set(t.projectId, {
      name: t.project?.name ?? `Project ${t.projectId}`,
      hours: (existing?.hours ?? 0) + t.hours,
    });
  });
  const projectBreakdown = [...projectMap.values()].sort((a, b) => b.hours - a.hours);
  const maxProjectHours = Math.max(...projectBreakdown.map((p) => p.hours), 1);

  /* Weekly chart — last 8 weeks */
  const weeklyData = Array.from({ length: 8 }).map((_, i) => {
    const ws = weeksAgo(7 - i);
    const we = addDays(ws, 6);
    const hours = timesheets
      .filter((t) => { const d = parseISO(t.date); return d >= ws && d <= we; })
      .reduce((s, t) => s + t.hours, 0);
    return { label: format(ws, "MMM d"), hours };
  });
  const maxWeekHours = Math.max(...weeklyData.map((w) => w.hours), 1);

  /* Last-30-days heatmap */
  const heatmapDays = Array.from({ length: 35 }).map((_, i) => {
    const d = addDays(addDays(new Date(), -34), i);
    d.setHours(0, 0, 0, 0);
    const hours = timesheets
      .filter((t) => isSameDay(parseISO(t.date), d))
      .reduce((s, t) => s + t.hours, 0);
    const dow = getDay(d);
    return { date: d, hours, isWeekend: dow === 0 || dow === 6 };
  });

  function heatColor(h: number, weekend: boolean) {
    if (weekend) return "bg-slate-50 border-slate-100";
    if (h === 0) return "bg-slate-100 border-slate-200";
    if (h < 4)  return "bg-indigo-100 border-indigo-200";
    if (h < 8)  return "bg-indigo-300 border-indigo-400";
    return "bg-indigo-500 border-indigo-600";
  }

  const workdaysWithEntries = timesheets.filter((t) => {
    const dow = getDay(parseISO(t.date));
    return dow !== 0 && dow !== 6;
  }).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition">
        <ArrowLeft size={15} /> Back
      </button>

      {/* ── Profile card ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-5 flex-wrap">
        <div className="w-14 h-14 rounded-full bg-slate-900 text-white text-xl flex items-center justify-center font-bold flex-shrink-0">
          {user.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">{user.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? "bg-slate-100 text-slate-600"}`}>{user.role}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${user.status === "ACTIVE" ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
              {user.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{user.email}</p>
          {user.designation && <p className="text-xs text-slate-400 mt-0.5">{user.designation}</p>}
          {user.manager && <p className="text-xs text-slate-400 mt-0.5">Manager: {user.manager.name}</p>}

          {/* SAP Module */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {!editingModule ? (
              <>
                {user.module ? (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                    {MODULE_LABEL[user.module] ?? user.module}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 italic">No SAP module assigned</span>
                )}
                <button
                  onClick={() => { setModuleVal(user.module ?? ""); setEditingModule(true); }}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                >
                  <Pencil size={11} /> Edit module
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-40">
                  <Combobox
                    value={moduleVal}
                    onChange={setModuleVal}
                    placeholder="— No module —"
                    options={[
                      { value: "", label: "No module" },
                      ...SAP_MODULES.map((m) => ({ value: m.value, label: m.label })),
                    ]}
                  />
                </div>
                <button
                  disabled={savingModule}
                  onClick={async () => {
                    setSavingModule(true);
                    try {
                      const updated = await apiFetch(`/users/${id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ module: moduleVal || null }),
                      });
                      setUser((u) => u ? { ...u, module: updated.module } : u);
                      setEditingModule(false);
                    } finally { setSavingModule(false); }
                  }}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-60"
                >
                  <Check size={11} /> {savingModule ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setEditingModule(false)}
                  className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Key metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard icon={<Clock size={16} />} label="Total Hours" value={`${totalHours}h`} color="indigo" />
        <MetricCard icon={<TrendingUp size={16} />} label="This Week" value={`${thisWeekHours}h`} color="violet" />
        <MetricCard icon={<CheckCircle2 size={16} />} label="Approval Rate" value={`${approvalRate}%`} color={approvalRate >= 70 ? "green" : "amber"} />
        <MetricCard icon={<Briefcase size={16} />} label="Projects" value={String(projectBreakdown.length)} color="slate" />
      </div>

      {/* ── Weekly bar chart ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-slate-900 mb-4">Weekly Hours — Last 8 Weeks</p>
        <div className="flex items-end gap-2 h-28">
          {weeklyData.map((w, i) => {
            const heightPct = (w.hours / maxWeekHours) * 100;
            const isCurrentWeek = i === 7;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500 font-medium">{w.hours > 0 ? `${w.hours}h` : ""}</span>
                <div className="w-full relative" style={{ height: "72px" }}>
                  <motion.div
                    className={`absolute bottom-0 w-full rounded-t-md ${isCurrentWeek ? "bg-slate-900" : "bg-indigo-400"}`}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(heightPct, w.hours > 0 ? 4 : 0)}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                  />
                  {w.hours === 0 && <div className="absolute bottom-0 w-full h-1 rounded bg-slate-100" />}
                </div>
                <span className="text-[9px] text-slate-400 text-center leading-tight">{w.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Activity heatmap ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-900">Daily Activity — Last 5 Weeks</p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <div className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" /> None
            <div className="w-3 h-3 rounded-sm bg-indigo-100 border border-indigo-200" /> &lt;4h
            <div className="w-3 h-3 rounded-sm bg-indigo-300 border border-indigo-400" /> 4–8h
            <div className="w-3 h-3 rounded-sm bg-indigo-500 border border-indigo-600" /> 8h+
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["M","T","W","T","F","S","S"].map((d, i) => (
            <p key={i} className="text-[9px] text-slate-400 text-center pb-1">{d}</p>
          ))}
          {/* Re-order: heatmapDays starts from whatever day; shift so Mon is first column */}
          {heatmapDays.map((d, i) => (
            <div
              key={i}
              title={`${format(d.date, "MMM d")}: ${d.hours}h`}
              className={`aspect-square rounded-sm border text-[0px] ${heatColor(d.hours, d.isWeekend)}`}
            />
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* ── Project breakdown + status ── */}
        <div className="md:col-span-2 space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Hours by Project</p>
            </div>
            {projectBreakdown.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">No project data.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {projectBreakdown.map((p, i) => (
                  <div key={i} className="px-5 py-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-slate-800 truncate max-w-[140px]">{p.name}</p>
                      <span className="text-xs font-semibold text-slate-700">{p.hours}h</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-indigo-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(p.hours / maxProjectHours) * 100}%` }}
                        transition={{ duration: 0.5, delay: i * 0.07 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <p className="text-sm font-semibold text-slate-900">Submission Status</p>
            {[
              { label: "Approved", count: approved, icon: <CheckCircle2 size={14} className="text-green-500" />, bar: "bg-green-400" },
              { label: "Pending",  count: pending,  icon: <AlertCircle  size={14} className="text-amber-500" />, bar: "bg-amber-400" },
              { label: "Rejected", count: rejected, icon: <XCircle      size={14} className="text-red-400"   />, bar: "bg-red-400"   },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">{s.icon}<span className="text-xs text-slate-600">{s.label}</span></div>
                  <span className="text-xs font-semibold text-slate-700">{s.count}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${s.bar}`}
                    initial={{ width: 0 }}
                    animate={{ width: timesheets.length ? `${(s.count / timesheets.length) * 100}%` : "0%" }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            ))}
            <p className="text-[11px] text-slate-400 pt-1">{timesheets.length} total entries · {workdaysWithEntries} workdays logged</p>
          </div>
        </div>

        {/* ── Recent timesheets ── */}
        <div className="md:col-span-3 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Recent Entries</p>
            <span className="text-xs text-slate-400">{timesheets.length} total</span>
          </div>
          {timesheets.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-400">
              <Calendar size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No timesheet entries.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {timesheets.slice(0, 50).map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  className="px-5 py-3.5 flex items-center gap-4"
                >
                  <div className="flex-shrink-0 text-center w-10">
                    <p className="text-base font-bold text-slate-900 leading-none">{format(parseISO(t.date), "d")}</p>
                    <p className="text-[10px] text-slate-400">{format(parseISO(t.date), "MMM")}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.project?.name ?? `Project ${t.projectId}`}</p>
                    {t.description && <p className="text-xs text-slate-400 truncate mt-0.5">{t.description}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${STATUS_STYLES[t.status] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>
                    {t.status}
                  </span>
                  <span className="text-sm font-semibold text-slate-700 w-9 text-right flex-shrink-0">{t.hours}h</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Login history ── */}
      {logs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <LogIn size={14} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-900">Login History</p>
            <span className="text-xs text-slate-400 ml-auto">Last {logs.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {logs.map((l, i) => (
              <div key={l.id ?? i} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-shrink-0 text-center w-10">
                  <p className="text-base font-bold text-slate-900 leading-none">{format(parseUTC(l.timestamp), "d")}</p>
                  <p className="text-[10px] text-slate-400">{format(parseUTC(l.timestamp), "MMM")}</p>
                </div>
                <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5">
                  {l.browser && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Globe size={11} className="text-slate-300" /> {l.browser}
                    </span>
                  )}
                  {l.system && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Monitor size={11} className="text-slate-300" /> {l.system}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 flex-shrink-0">{format(parseUTC(l.timestamp), "HH:mm")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const COLORS: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    violet: "bg-violet-50 text-violet-600",
    green:  "bg-green-50  text-green-600",
    amber:  "bg-amber-50  text-amber-600",
    slate:  "bg-slate-100 text-slate-600",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${COLORS[color] ?? COLORS.slate}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}
