"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";

type Log = {
  name: string;
  loginTime: string;
  loginLocation: string;
  browser: string;
  system: string;
};

const normalize = (res: any) =>
  Array.isArray(res)
    ? res
    : res?.data || res?.items || res?.results || res?.response || [];

/* 🔥 CACHE (CRITICAL) */
const locationCache = new Map<string, string>();

async function getReadableLocation(lat: number, lng: number) {
  const key = `${lat},${lng}`;

  if (locationCache.has(key)) {
    return locationCache.get(key)!;
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      {
        headers: {
          "User-Agent": "timesheet-app",
        },
      }
    );

    const data = await res.json();

    const address = data.address || {};

    const city =
      address.city ||
      address.town ||
      address.village ||
      "";

    const state = address.state || "";
    const country = address.country || "";

    const location =
      [city, state, country].filter(Boolean).join(", ") ||
      "Unknown";

    locationCache.set(key, location);

    return location;

  } catch {
    return "Unknown";
  }
}

/* 🔥 ASYNC NORMALIZATION */
async function normalizeLogs(rawLogs: any[]): Promise<Log[]> {
  return Promise.all(
    rawLogs.map(async (log) => {
      let location = "Unknown";

      if (
        log.location?.latitude &&
        log.location?.longitude
      ) {
        location = await getReadableLocation(
          log.location.latitude,
          log.location.longitude
        );
      }

      return {
        name: log.user?.name || log.user?.email || "Unknown",
        loginTime: log.timestamp,
        loginLocation: location,
        browser: log.browser || "Unknown",
        system: log.system || "Unknown",
      };
    })
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalProjects: 0,
    totalHours: 0,
    idlePercent: 0,
  });

  const [auditLogs, setAuditLogs] = useState<Log[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setStatsLoading(true);
      setLogsLoading(true);

      const [usersRes, projectsRes, logsRes] = await Promise.all([
        apiFetch("/users"),
        apiFetch("/projects"),
        apiFetch("/user-logs?join=user"), // 🔥 FIXED
      ]);

      const users = normalize(usersRes);
      const projects = normalize(projectsRes);

      let rawLogs = normalize(logsRes);

      /* 🔥 SORT LATEST FIRST */
      rawLogs.sort(
        (a: any, b: any) =>
          new Date(b.timestamp).getTime() -
          new Date(a.timestamp).getTime()
      );

      /* 🔥 IMPORTANT: AWAIT */
      const logs = await normalizeLogs(rawLogs);

      setAuditLogs(logs);

      const totalUsers = users.length;
      const totalProjects = projects.length;

      const activeUsers = logs.length;
      const totalHours = logs.length * 2;

      const idlePercent =
        totalUsers === 0
          ? 0
          : Math.round(
              ((totalUsers - activeUsers) / totalUsers) * 100
            );

      setStats({
        totalUsers,
        activeUsers,
        totalProjects,
        totalHours,
        idlePercent,
      });

    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setStatsLoading(false);
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getUser = () => {
    try {
      const token = localStorage.getItem("token");
      return JSON.parse(atob(token!.split(".")[1]));
    } catch {
      return { name: "User" };
    }
  };

  if (statsLoading && logsLoading) {
    return <SmartLoader name={getUser().name} />;
  }

  return (
    <div className="space-y-8">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
          Admin Overview
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time system activity & audit insights
        </p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Total Users" value={stats.totalUsers} />
        <StatCard title="Active Logs" value={stats.activeUsers} />
        <StatCard title="Projects" value={stats.totalProjects} />
        <StatCard title="Activity Units" value={stats.totalHours} />
      </div>

      {/* AUDIT TRAIL */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">

        <div className="flex justify-between items-center mb-4">
          <p className="text-sm font-medium text-slate-700">
            Audit Trail
          </p>
          <span className="text-xs text-slate-400">
            Geo enriched logs
          </span>
        </div>

        {logsLoading ? (
          <p className="text-sm text-slate-400">Loading logs...</p>
        ) : auditLogs.length === 0 ? (
          <p className="text-sm text-slate-400">
            No activity found
          </p>
        ) : (
          <div className="relative pl-6 space-y-4 max-h-72 overflow-auto">

            <div className="absolute left-2 top-0 bottom-0 w-[2px] bg-slate-200" />

            <AnimatePresence>
              {auditLogs.map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="relative bg-slate-50 border rounded-lg p-4 text-sm"
                >
                  <div className="absolute left-[-14px] top-5 w-3 h-3 bg-slate-900 rounded-full" />

                  <p className="font-medium text-slate-800">
                    {log.name}
                  </p>

                  <div className="mt-2 space-y-1 text-xs text-slate-500">

                    <p>
                      🕒 {new Date(log.loginTime).toLocaleString()}
                    </p>

                    <p>📍 {log.loginLocation}</p>

                    <div className="flex gap-3 text-[11px] text-slate-400">
                      <span>🌐 {log.browser}</span>
                      <span>💻 {log.system}</span>
                    </div>

                    <p className="text-green-600 font-medium">
                      ● Login Event
                    </p>

                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value }: any) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
    >
      <p className="text-xs text-slate-500">{title}</p>
      <p className="text-xl font-semibold text-slate-900 mt-1">
        {value}
      </p>
    </motion.div>
  );
}