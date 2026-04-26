"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";

/* 🔥 helper */
const normalize = (res: any) =>
  Array.isArray(res)
    ? res
    : res?.data || res?.items || res?.results || [];

/* 🔥 FIX: Normalize logs */
function normalizeLogs(rawLogs: any[]) {
  return rawLogs.map((log) => {
    // Convert LOGIN → SESSION-like structure
    if (log.type === "LOGIN") {
      return {
        type: "SESSION",
        email: log.email,
        loginTime: log.time,
        loginLocation: log.location,
        logoutTime: null,
        logoutLocation: null,
        duration: "Active",
      };
    }

    return log;
  });
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalProjects: 0,
    totalHours: 0,
    idlePercent: 0,
  });

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [weekly, setWeekly] = useState<number[]>([0, 0, 0, 0, 0]);

  const [statsLoading, setStatsLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setStatsLoading(true);

      const [usersRes, projectsRes] = await Promise.all([
        apiFetch("/users"),
        apiFetch("/projects"),
      ]);

      const users = normalize(usersRes);
      const projects = normalize(projectsRes);

      /* 🔥 Load + normalize logs */
      const rawLogs = JSON.parse(
        localStorage.getItem("userLogs") || "[]"
      );

      const normalizedLogs = normalizeLogs(rawLogs);
      const reversedLogs = [...normalizedLogs].reverse();

      setAuditLogs(reversedLogs);

      /* 🔥 Metrics */
      const totalUsers = users.length;
      const totalProjects = projects.length;

      const activeUsers = reversedLogs.filter(
        (l) => !l.logoutTime
      ).length;

      const totalHours = reversedLogs.reduce(
        (sum, l) =>
          sum +
          (typeof l.duration === "number"
            ? l.duration
            : 2),
        0
      );

      const idlePercent =
        totalUsers === 0
          ? 0
          : Math.round(
              ((totalUsers - activeUsers) / totalUsers) * 100
            );

      /* 🔥 Weekly */
      const week = [0, 0, 0, 0, 0];

      reversedLogs.forEach((log) => {
        const date = new Date(log.loginTime);
        const day = date.getDay();

        if (day >= 1 && day <= 5) {
          week[day - 1] += 1;
        }
      });

      setWeekly(week);

      setStats({
        totalUsers,
        activeUsers,
        totalProjects,
        totalHours,
        idlePercent,
      });

    } catch (err) {
      console.error("Dashboard API error:", err);
    } finally {
      setStatsLoading(false);
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
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

      {/* 🔥 HEADER */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
          Admin Overview
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          System-wide analytics and activity insights
        </p>
      </div>

      {/* 🔥 STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Total Users" value={stats.totalUsers} />
        <StatCard title="Active Users" value={stats.activeUsers} />
        <StatCard title="Projects" value={stats.totalProjects} />
        <StatCard title="Hours Logged" value={`${stats.totalHours}h`} />
      </div>

      {/* 🔥 AUDIT TRAIL */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-700 mb-4">
          Audit Trail
        </p>

        {logsLoading ? (
          <p className="text-sm text-slate-400">Loading logs...</p>
        ) : auditLogs.length === 0 ? (
          <p className="text-sm text-slate-400">
            No activity yet
          </p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-auto">

            <AnimatePresence>
              {auditLogs.map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="relative bg-slate-50 border rounded-lg p-4 text-sm"
                >
                  <div className="absolute left-[-8px] top-4 w-3 h-3 bg-slate-900 rounded-full" />

                  <p className="font-medium text-slate-800">
                    {log.email}
                  </p>

                  <div className="text-xs text-slate-500 space-y-1 mt-1">

                    {/* LOGIN */}
                    <p>
                      🟢{" "}
                      {log.loginTime
                        ? new Date(log.loginTime).toLocaleString()
                        : "Unknown"}
                    </p>
                    <p>📍 {log.loginLocation || "Unknown"}</p>

                    {/* LOGOUT */}
                    {log.logoutTime ? (
                      <>
                        <p>
                          🔴{" "}
                          {new Date(log.logoutTime).toLocaleString()}
                        </p>
                        <p>📍 {log.logoutLocation}</p>
                      </>
                    ) : (
                      <p className="text-green-600 font-medium">
                        ● Active session
                      </p>
                    )}

                    {/* DURATION */}
                    <p className="text-slate-400">
                      ⏱ {log.duration || "Ongoing"}
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

/* 🔥 CARD */
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