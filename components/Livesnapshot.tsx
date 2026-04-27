import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function LiveSnapshot() {
  const [stats, setStats] = useState({
    totalUsers: 24,
    activeUsers: 14,
    totalHours: 320,
    idlePercent: 18,
  });

  useEffect(() => {
    const logs = JSON.parse(localStorage.getItem("userLogs") || "[]");

    if (logs.length > 0) {
      const uniqueUsers = new Set(logs.map((l: any) => l.email));

      const totalUsers = uniqueUsers.size;
      const activeUsers = Math.floor(totalUsers * (0.6 + Math.random() * 0.2));
      const idlePercent = Math.floor(10 + Math.random() * 20);

      setStats({
        totalUsers,
        activeUsers,
        totalHours: 300 + Math.floor(Math.random() * 100),
        idlePercent,
      });
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
    >
      <p className="text-sm font-medium text-slate-700 mb-4">
        Live System Snapshot
      </p>

      <div className="space-y-4">

    
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Users</p>
            <p className="font-semibold text-slate-900">
              {stats.totalUsers}
            </p>
          </div>

          <div>
            <p className="text-slate-500">Active</p>
            <p className="font-semibold text-slate-900">
              {stats.activeUsers}
            </p>
          </div>

          <div>
            <p className="text-slate-500">Hours</p>
            <p className="font-semibold text-slate-900">
              {stats.totalHours}h
            </p>
          </div>

          <div>
            <p className="text-slate-500">Idle</p>
            <p className="font-semibold text-slate-900">
              {stats.idlePercent}%
            </p>
          </div>
        </div>

        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${100 - stats.idlePercent}%` }}
            transition={{ duration: 0.8 }}
            className="bg-gradient-to-r from-slate-900 to-slate-600 h-full"
          />
        </div>

        <p className="text-xs text-slate-500">
          Real-time system activity (simulated preview)
        </p>
      </div>
    </motion.div>
  );
}