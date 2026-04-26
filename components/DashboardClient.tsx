"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function DashboardClient({ name }: { name: string }) {
  const [index, setIndex] = useState(0);

  const messages = [
    "You're doing great today 🚀",
    "Keep your focus sharp",
    "Consistency beats intensity",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const stats = {
    todayHours: 6,
    weeklyHours: 32,
    idleHours: 1,
  };

  const idlePercent = Math.round((stats.idleHours / stats.todayHours) * 100);
  const weeklyData = [6, 7, 5, 8, 6];

  return (
    <div className="space-y-6">

  
      <div>
        <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-slate-800">
          Welcome, {name}
        </h1>

        <div className="h-5 mt-1 relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={messages[index]}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4 }}
              className="text-sm text-slate-500 absolute"
            >
              {messages[index]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

   
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        <AnimatedCard title="Hours Today" value={`${stats.todayHours}h`} alt="Focus time improving" />
        <AnimatedCard title="Weekly Hours" value={`${stats.weeklyHours}h`} alt="On track this week" />
        <AnimatedCard title="Idle %" value={`${idlePercent}%`} alt="Try reducing idle time" />

      </div>

 
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-700 mb-4">
            Weekly Activity
          </p>

          <div className="flex items-end gap-3 h-32">
            {weeklyData.map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h * 10}px` }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="flex flex-col items-center w-full"
              >
                <div className="w-6 bg-slate-900 rounded" />
                <span className="text-xs text-slate-500 mt-1">
                  {["M", "T", "W", "T", "F"][i]}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

      
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-700 mb-4">
            Productivity Split
          </p>

          <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${100 - idlePercent}%` }}
              transition={{ duration: 0.8 }}
              className="bg-slate-900 h-full"
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
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 200 }}
      className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm cursor-pointer"
    >
      <p className="text-xs text-slate-500">{title}</p>

      <div className="h-6 mt-1 relative">
        <AnimatePresence mode="wait">
          <motion.p
            key={toggle ? value : alt}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className="text-xl font-medium text-slate-800 absolute"
          >
            {toggle ? value : alt}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}