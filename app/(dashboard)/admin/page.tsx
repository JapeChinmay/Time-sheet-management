"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserCheck, UserX, Briefcase, Clock, TrendingUp,
  Activity, MapPin, Monitor, Globe, LogIn, ChevronRight,
} from "lucide-react";
import { format, startOfWeek, addDays, getDay, isAfter } from "date-fns";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";
import { parseUTC } from "@/lib/date";

/* ─── types ─── */
type User = { id: number; name: string; email: string; role: string; status: string; designation?: string };
type Project = { id: number; name: string; status: string; members?: any[] };
type Timesheet = { id: number; userId: number; projectId: number; hours: number; date: string; user?: { name: string } };
type LoginLog = {
  id: number;
  timestamp: string;
  browser?: string;
  system?: string;
  location?: { longitude: number; latitude: number } | null;
  user?: { name: string; email: string };
};

/* ─── helpers ─── */
const norm = (r: any): any[] => Array.isArray(r) ? r : r?.data ?? r?.items ?? [];

const today = new Date(); today.setHours(0, 0, 0, 0);
const weekStart = startOfWeek(today, { weekStartsOn: 1 });
const weekEnd = addDays(weekStart, 6);

/** Number of weekdays (Mon-Fri) from weekStart up to and including today */
function workdaysSoFar(): number {
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const dow = getDay(d);
    if (dow !== 0 && dow !== 6 && !isAfter(d, today)) count++;
  }
  return count;
}

const EXPECTED_DAILY_HOURS = 8;
const expectedHours = workdaysSoFar() * EXPECTED_DAILY_HOURS;

function idlePercent(logged: number): number {
  if (expectedHours === 0) return 0;
  return Math.max(0, Math.round(((expectedHours - logged) / expectedHours) * 100));
}

function idleColor(pct: number) {
  if (pct >= 80) return "text-red-600 bg-red-50 border-red-200";
  if (pct >= 40) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-green-600 bg-green-50 border-green-200";
}

function hoursBarColor(logged: number) {
  const pct = expectedHours > 0 ? (logged / expectedHours) * 100 : 0;
  if (pct >= 80) return "bg-green-500";
  if (pct >= 40) return "bg-amber-400";
  return "bg-red-400";
}

const locationCache = new Map<string, string>();
async function resolveLocation(lat: number, lng: number): Promise<string> {
  const key = `${lat},${lng}`;
  if (locationCache.has(key)) return locationCache.get(key)!;
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "User-Agent": "timesheet-app" } }
    );
    const d = await r.json();
    const a = d.address ?? {};
    const parts = [
      a.road,
      a.neighbourhood || a.suburb,
      a.city || a.town || a.village,
      a.state,
      a.country,
    ].filter(Boolean);
    const loc = parts.length > 0 ? parts.join(", ") : d.display_name || "Unknown";
    locationCache.set(key, loc);
    return loc;
  } catch { return "Unknown"; }
}

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-slate-800 text-white",
  ADMIN: "bg-slate-200 text-slate-700",
  MANAGER:  "bg-teal-100 text-teal-700",
  HR:       "bg-pink-100 text-pink-700",
  INTERNAL: "bg-indigo-100 text-indigo-700",
  EXTERNAL: "bg-violet-100 text-violet-700",
  INTERN:   "bg-orange-100 text-orange-700",
};

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [resolvedLogs, setResolvedLogs] = useState<(LoginLog & { locationName: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [uRes, pRes, tsRes, logRes] = await Promise.all([
        apiFetch("/users?limit=200"),
        apiFetch("/projects?limit=200&join=members"),
        apiFetch(
          `/timesheets?filter=date||$gte||${format(weekStart, "yyyy-MM-dd")}&filter=date||$lte||${format(weekEnd, "yyyy-MM-dd")}&join=user&limit=500`
        ),
        apiFetch("/user-logs?join=user&sort=timestamp,DESC&limit=50"),
      ]);
      setUsers(norm(uRes));
      setProjects(norm(pRes));
      setTimesheets(norm(tsRes));
      const rawLogs: LoginLog[] = norm(logRes);
      setLogs(rawLogs);

      // Resolve locations in background
      const resolved = await Promise.all(
        rawLogs.map(async (l) => ({
          ...l,
          locationName:
            l.location?.latitude && l.location?.longitude
              ? await resolveLocation(l.location.latitude, l.location.longitude)
              : "Unknown",
        }))
      );
      setResolvedLogs(resolved);
    } catch (e) {
      console.error("Dashboard error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getUser = () => {
    try { return JSON.parse(atob(localStorage.getItem("token")!.split(".")[1])); }
    catch { return { name: "Admin" }; }
  };

  if (loading) return <SmartLoader name={getUser().name} />;

  /* ── derived stats ── */
  const activeUsers = users.filter((u) => u.status === "ACTIVE");
  const inactiveUsers = users.filter((u) => u.status === "INACTIVE");
  const activeProjects = projects.filter((p) => p.status === "ACTIVE" || p.status === "CREATED");
  const weeklyHours = timesheets.reduce((s, t) => s + t.hours, 0);

  // Hours per user this week
  const hoursPerUser = new Map<number, number>();
  timesheets.forEach((t) => {
    hoursPerUser.set(t.userId, (hoursPerUser.get(t.userId) ?? 0) + t.hours);
  });

  // Hours per project this week
  const hoursPerProject = new Map<number, number>();
  timesheets.forEach((t) => {
    hoursPerProject.set(t.projectId, (hoursPerProject.get(t.projectId) ?? 0) + t.hours);
  });

  const idleUsers = activeUsers.filter((u) => (hoursPerUser.get(u.id) ?? 0) === 0).length;
  const avgHours = activeUsers.length ? Math.round((weeklyHours / activeUsers.length) * 10) / 10 : 0;

  // Last login per user
  const lastLoginPerUser = new Map<number, string>();
  logs.forEach((l) => {
    if (l.user && !lastLoginPerUser.has((l as any).userId)) {
      lastLoginPerUser.set((l as any).userId, l.timestamp);
    }
  });

  const topProjects = [...projects]
    .map((p) => ({ ...p, hours: hoursPerProject.get(p.id) ?? 0 }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 6);

  const maxProjectHours = Math.max(...topProjects.map((p) => p.hours), 1);

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Admin Overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          Week of {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={<Users size={16} />} label="Total Users" value={users.length} color="slate" />
        <StatCard icon={<UserCheck size={16} />} label="Active" value={activeUsers.length} color="green" />
        <StatCard icon={<UserX size={16} />} label="Inactive" value={inactiveUsers.length} color="red" />
        <StatCard icon={<Briefcase size={16} />} label="Active Projects" value={activeProjects.length} color="indigo" />
        <StatCard icon={<Clock size={16} />} label="Hours This Week" value={`${weeklyHours}h`} color="violet" />
        <StatCard icon={<Activity size={16} />} label="Idle Users" value={idleUsers} color={idleUsers > 0 ? "amber" : "green"} />
      </div>

      {/* ── Main grid ── */}
      <div className="grid lg:grid-cols-5 gap-6">

        {/* User Activity Table (3/5) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900 text-sm">User Activity</p>
              <p className="text-xs text-slate-400 mt-0.5">Hours logged vs. expected ({expectedHours}h) this week</p>
            </div>
            <span className="text-xs text-slate-400">{format(today, "EEE, MMM d")}</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {activeUsers.length === 0 && (
              <p className="px-5 py-6 text-sm text-slate-400">No active users.</p>
            )}
            {activeUsers.map((u) => {
              const logged = hoursPerUser.get(u.id) ?? 0;
              const idle = idlePercent(logged);
              const barPct = expectedHours > 0 ? Math.min(100, (logged / expectedHours) * 100) : 0;
              const lastLogin = lastLoginPerUser.get(u.id);

              return (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => router.push(`/admin/users/${u.id}`)}
                  className="px-5 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors duration-150"
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-semibold flex-shrink-0">
                    {u.name[0].toUpperCase()}
                  </div>

                  {/* Name + designation */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_COLORS[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                        {u.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{u.designation ?? u.email}</p>
                    {/* Hours bar */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${hoursBarColor(logged)}`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 flex-shrink-0">{logged}h</span>
                    </div>
                  </div>

                  {/* Idle badge + chevron */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${idleColor(idle)}`}>
                      {idle === 0 ? "On track" : `${idle}% idle`}
                    </span>
                    {lastLogin && (
                      <p className="text-[10px] text-slate-400">
                        {format(parseUTC(lastLogin), "MMM d, HH:mm")}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                </motion.div>
              );
            })}

            {/* Inactive users section */}
            {inactiveUsers.length > 0 && (
              <>
                <div className="px-5 py-2 bg-slate-50">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Inactive</p>
                </div>
                {inactiveUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => router.push(`/admin/users/${u.id}`)}
                    className="px-5 py-3 flex items-center gap-3 opacity-50 cursor-pointer hover:bg-slate-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 text-xs flex items-center justify-center font-semibold flex-shrink-0">
                      {u.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-600 truncate">{u.name}</p>
                      <p className="text-xs text-slate-400 truncate">{u.designation ?? u.email}</p>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Inactive</span>
                    <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Project Activity (2/5) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="font-semibold text-slate-900 text-sm">Project Activity</p>
            <p className="text-xs text-slate-400 mt-0.5">Hours logged this week</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {topProjects.length === 0 && (
              <p className="px-5 py-6 text-sm text-slate-400">No project data.</p>
            )}
            {topProjects.map((p) => {
              const barPct = (p.hours / maxProjectHours) * 100;
              return (
                <div key={p.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-slate-800 truncate max-w-[160px]">{p.name}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        p.status === "ACTIVE"    ? "bg-green-100 text-green-700"  :
                        p.status === "CREATED"   ? "bg-blue-50 text-blue-700"     :
                        p.status === "COMPLETED" ? "bg-purple-50 text-purple-700" :
                        "bg-slate-100 text-slate-500"
                      }`}>
                        {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">{p.hours}h</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ duration: 0.6, delay: 0.1 }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {(p.members?.length ?? 0)} member{p.members?.length !== 1 ? "s" : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Summary row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Avg hours / active user"
          value={`${avgHours}h`}
          sub={`of ${expectedHours}h expected`}
          icon={<TrendingUp size={18} />}
          good={avgHours >= expectedHours * 0.8}
        />
        <SummaryCard
          label="Submission rate"
          value={activeUsers.length ? `${Math.round((activeUsers.filter((u) => (hoursPerUser.get(u.id) ?? 0) > 0).length / activeUsers.length) * 100)}%` : "—"}
          sub="users who logged hours this week"
          icon={<Activity size={18} />}
          good={activeUsers.length > 0 && activeUsers.filter((u) => (hoursPerUser.get(u.id) ?? 0) > 0).length / activeUsers.length >= 0.7}
        />
        <SummaryCard
          label="Fully idle users"
          value={String(idleUsers)}
          sub="no hours logged this week"
          icon={<UserX size={18} />}
          good={idleUsers === 0}
        />
      </div>

      {/* ── Login Audit Trail ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogIn size={15} className="text-slate-400" />
            <p className="font-semibold text-slate-900 text-sm">Login Audit Trail</p>
          </div>
          <span className="text-xs text-slate-400">Last {resolvedLogs.length} events</span>
        </div>

        {resolvedLogs.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No login events found.</p>
        ) : (
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            <AnimatePresence>
              {resolvedLogs.map((log, i) => (
                <motion.div
                  key={log.id ?? i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="px-5 py-3.5 flex items-center gap-4"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs flex items-center justify-center font-semibold flex-shrink-0">
                    {(log.user?.name ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{log.user?.name ?? log.user?.email ?? "Unknown"}</p>
                    <p className="flex items-start gap-1 text-[11px] text-slate-400 mt-0.5">
                      <MapPin size={10} className="mt-0.5 flex-shrink-0" />
                      <span>{log.locationName}</span>
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {log.browser && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Globe size={10} /> {log.browser}
                        </span>
                      )}
                      {log.system && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Monitor size={10} /> {log.system}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 flex-shrink-0 text-right">
                    {format(parseUTC(log.timestamp), "MMM d")}<br />
                    {format(parseUTC(log.timestamp), "HH:mm")}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

const STAT_COLORS: Record<string, string> = {
  slate:  "bg-slate-100 text-slate-600",
  green:  "bg-green-100 text-green-600",
  red:    "bg-red-100 text-red-500",
  indigo: "bg-indigo-100 text-indigo-600",
  violet: "bg-violet-100 text-violet-600",
  amber:  "bg-amber-100 text-amber-600",
};

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${STAT_COLORS[color] ?? STAT_COLORS.slate}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, icon, good }: { label: string; value: string; sub: string; icon: React.ReactNode; good: boolean }) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-4 ${good ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${good ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
