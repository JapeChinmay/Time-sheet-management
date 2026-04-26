"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function DashboardClient({ name }: { name: string }) {
  const [index, setIndex] = useState(0);
  const [loginInfo, setLoginInfo] = useState<any>(null);

  const messages = [
    "You're doing great today 🚀",
    "Keep your focus sharp",
    "Consistency beats intensity",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 3000);

    const data = localStorage.getItem("loginInfo");
    if (data) setLoginInfo(JSON.parse(data));

    return () => clearInterval(interval);
  }, []);

  const stats = {
    todayHours: 6,
    weeklyHours: 32,
    idleHours: 1,
  };

  const idlePercent = Math.round(
    (stats.idleHours / stats.todayHours) * 100
  );

  const weeklyData = [6, 7, 5, 8, 6];

  const getGreeting = (timeString?: string) => {
  const date = timeString ? new Date(timeString) : new Date();
  const hour = date.getHours();

  if (hour < 12) return "Good morning ☀️";
  if (hour < 17) return "Good afternoon 🌤️";
  if (hour < 21) return "Good evening 🌙";
  return "Working late 💻";
};

  return (
    <div className="space-y-8">

      {/* 🔥 HEADER */}
      <div className="space-y-2">
     <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
  {getGreeting(loginInfo?.time)}, {name}
</h1>

        {/* 🔥 login card */}
        {loginInfo && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex flex-col gap-2 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-xl px-4 py-3 shadow-sm"
          >
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-medium text-slate-700">
                Active session
              </span>
              <span>
                {new Date(loginInfo.time).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>📍</span>
              <span className="font-medium text-slate-700">
                {loginInfo.location}
              </span>
            </div>
          </motion.div>
        )}

        {/* rotating message */}
        <div className="h-5 relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={messages[index]}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="text-sm text-slate-500 absolute"
            >
              {messages[index]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* 🔥 STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatedCard
          title="Hours Today"
          value={`${stats.todayHours}h`}
          alt="Focus improving"
        />
        <AnimatedCard
          title="Weekly Hours"
          value={`${stats.weeklyHours}h`}
          alt="On track"
        />
        <AnimatedCard
          title="Idle %"
          value={`${idlePercent}%`}
          alt="Reduce idle"
        />
      </div>

      {/* 🔥 ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 📊 Weekly Activity */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-700 mb-4">
            Weekly Activity
          </p>

          <div className="flex items-end gap-4 h-36">
            {weeklyData.map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h * 10}px` }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="flex flex-col items-center w-full"
              >
                <div className="w-7 rounded-md bg-gradient-to-t from-slate-900 to-slate-600 shadow-sm" />
                <span className="text-xs text-slate-400 mt-1">
                  {["M", "T", "W", "T", "F"][i]}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ⚡ Productivity */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-700 mb-4">
            Productivity
          </p>

          <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${100 - idlePercent}%` }}
              transition={{ duration: 0.8 }}
              className="bg-gradient-to-r from-slate-900 to-slate-600 h-full"
            />
          </div>

          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>Productive</span>
            <span>Idle {idlePercent}%</span>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

/* 🔥 PREMIUM CARD */
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
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 180 }}
      className="relative bg-white border border-slate-200 rounded-xl p-5 shadow-sm overflow-hidden"
    >
      {/* subtle gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-60 pointer-events-none" />

      <p className="text-xs text-slate-500">{title}</p>

      <div className="h-6 mt-2 relative">
        <AnimatePresence mode="wait">
          <motion.p
            key={toggle ? value : alt}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="text-xl font-semibold text-slate-900 absolute"
          >
            {toggle ? value : alt}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}