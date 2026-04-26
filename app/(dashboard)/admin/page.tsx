"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalProjects: 0,
    totalHours: 320,
    idlePercent: 18,
  });

  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const weekly = [120, 150, 180, 140, 200];

  useEffect(() => {
    const loadData = async () => {
      try {
        const usersRes = await apiFetch("/users");
        const projectsRes = await apiFetch("/projects");

        const logs =
          JSON.parse(localStorage.getItem("userLogs") || "[]");

        setAuditLogs([...logs].reverse());

        const totalUsers = Array.isArray(usersRes)
          ? usersRes.length
          : usersRes?.total ??
            usersRes?.count ??
            usersRes?.data?.length ??
            0;

        const totalProjects = Array.isArray(projectsRes)
          ? projectsRes.length
          : projectsRes?.total ??
            projectsRes?.count ??
            projectsRes?.data?.length ??
            0;

        const activeUsers = Math.floor(
          totalUsers * (0.6 + Math.random() * 0.2)
        );

        setStats((prev) => ({
          ...prev,
          totalUsers,
          activeUsers,
          totalProjects,
        }));

      } catch (err) {
        console.error("Dashboard API error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const getUser = () => {
    try {
      const token = localStorage.getItem("token");
      return JSON.parse(atob(token!.split(".")[1]));
    } catch {
      return { name: "User" };
    }
  };

  if (loading) return <SmartLoader name={getUser().name} />;

  return (
    <div className="space-y-8">

      {/* 🔥 HEADER */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          Admin Overview
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          System-wide analytics and activity insights
        </p>
      </div>

      {/* 🔥 STATS */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } },
        }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        <StatCard title="Total Users" value={stats.totalUsers} />
        <StatCard title="Active Users" value={stats.activeUsers} />
        <StatCard title="Projects" value={stats.totalProjects} />
        <StatCard title="Hours Logged" value={`${stats.totalHours}h`} />
      </motion.div>

      {/* 🔥 CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Workload */}
        <motion.div
          whileHover={{ y: -3 }}
          className="relative bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-60 pointer-events-none rounded-xl" />

          <p className="text-sm font-medium text-slate-700 mb-4 relative">
            Weekly Workload
          </p>

          <div className="flex items-end gap-4 h-36 relative">
            {weekly.map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h / 2}px` }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="flex flex-col items-center w-full"
              >
                <div className="w-7 rounded-md bg-gradient-to-t from-slate-900 to-slate-600" />
                <span className="text-xs text-slate-400 mt-1">
                  {["M", "T", "W", "T", "F"][i]}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Productivity */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-700 mb-4">
            Productivity Overview
          </p>

          <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${100 - stats.idlePercent}%` }}
              transition={{ duration: 0.8 }}
              className="bg-gradient-to-r from-slate-900 to-slate-600 h-full"
            />
          </div>

          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>Productive</span>
            <span>Idle {stats.idlePercent}%</span>
          </div>
        </motion.div>
      </div>

      {/* 🔥 AUDIT TRAIL */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-700 mb-4">
          Audit Trail
        </p>

        <div className="space-y-3 max-h-64 overflow-auto">

          <AnimatePresence>
            {auditLogs.map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative bg-slate-50 border rounded-lg p-4 text-sm"
              >
                {/* timeline dot */}
                <div className="absolute left-[-8px] top-4 w-3 h-3 bg-slate-900 rounded-full" />

                <p className="font-medium text-slate-800">
                  {log.email}
                </p>

                {log.type === "SESSION" && (
                  <div className="text-xs text-slate-500 space-y-1 mt-1">
                    <p>
                      🟢 {new Date(log.loginTime).toLocaleString()}
                    </p>
                    <p>📍 {log.loginLocation}</p>

                    <p>
                      🔴 {new Date(log.logoutTime).toLocaleString()}
                    </p>
                    <p>📍 {log.logoutLocation}</p>

                    <p className="text-slate-400">
                      ⏱ {log.duration}
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

        </div>
      </div>

    </div>
  );
}

/* 🔥 STAT CARD */
function StatCard({ title, value }: any) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 },
      }}
      whileHover={{ y: -5, scale: 1.02 }}
      className="relative bg-white border border-slate-200 rounded-xl p-5 shadow-sm overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-60" />

      <p className="text-xs text-slate-500">{title}</p>
      <p className="text-xl font-semibold text-slate-900 mt-1">
        {value}
      </p>
    </motion.div>
  );
}