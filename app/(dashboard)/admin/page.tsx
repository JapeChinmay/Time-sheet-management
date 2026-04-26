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
    totalHours: 320, // still mock
    idlePercent: 18,
  });

  const [loading, setLoading] = useState(true);

  const weekly = [120, 150, 180, 140, 200];

  useEffect(() => {
    const loadData = async () => {
      try {
        const usersRes = await apiFetch("/users");
        const projectsRes = await apiFetch("/projects");
        console.log(usersRes);
        console.log(projectsRes);
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

     
        const activeUsers = Math.floor(totalUsers * (0.6 + Math.random() * 0.2));

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


  const insights = {
    users:
      stats.totalUsers > 50
        ? "User base growing fast 🚀"
        : "User growth is steady",

    active:
      stats.activeUsers / (stats.totalUsers || 1) > 0.7
        ? "High engagement 🔥"
        : "Engagement can improve",

    projects:
      stats.totalProjects > 10
        ? "Strong project pipeline"
        : "Fewer active projects",

    hours:
      stats.totalHours > 300
        ? "Excellent productivity"
        : "Scope to improve output",
  };



if (loading) {
  const token = localStorage.getItem("token");

  let name = "User";
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      name = payload.name || "User";
    } catch {}
  }

  return <SmartLoader name={name} />
}

  return (
    <div className="space-y-6">

    
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-800">
          Admin Overview
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          System-wide analytics and activity insights
        </p>
      </div>

     
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.12 } },
        }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <AnimatedCard
          title="Total Users"
          value={`${stats.totalUsers}`}
          alt={insights.users}
        />

        <AnimatedCard
          title="Active Users"
          value={`${stats.activeUsers}`}
          alt={insights.active}
        />

        <AnimatedCard
          title="Projects"
          value={`${stats.totalProjects}`}
          alt={insights.projects}
        />

        <AnimatedCard
          title="Hours Logged"
          value={`${stats.totalHours}h`}
          alt={insights.hours}
        />
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

    
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-700 mb-4">
            Weekly Workload
          </p>

          <div className="flex items-end gap-3 h-36">
            {weekly.map((h, i) => (
              <div key={i} className="flex flex-col items-center w-full">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${h / 2}px` }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="w-7 bg-slate-900 rounded-md"
                />
                <span className="text-xs text-slate-500 mt-1">
                  {["M", "T", "W", "T", "F"][i]}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
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
              className="bg-slate-900 h-full"
            />
          </div>

          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>Productive</span>
            <span>Idle {stats.idlePercent}%</span>
          </div>
        </motion.div>

      </div>

    
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-700 mb-4">
          Audit Trail (Live Activity)
        </p>

        <div className="space-y-2 max-h-44 overflow-hidden">
          <AnimatePresence>
            {[
              "User onboarded",
              "Project updated",
              "Timesheet submitted",
              "Admin changed role",
            ].map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-md border"
              >
                ✔️ {log}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}


function AnimatedCard({
  title,
  value,
  alt,
}: {
  title: string;
  value: string;
  alt: string;
}) {
  const [toggle, setToggle] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setToggle((prev) => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0 },
      }}
      whileHover={{ y: -5, scale: 1.03 }}
      className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm cursor-pointer"
    >
      <p className="text-xs text-slate-500">{title}</p>

      <div className="h-6 mt-1 relative">
        <AnimatePresence mode="wait">
          <motion.p
            key={toggle ? value : alt}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="text-xl font-semibold text-slate-800 absolute"
          >
            {toggle ? value : alt}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}