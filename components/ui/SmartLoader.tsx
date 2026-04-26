"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SmartLoader({ name }: { name: string }) {
  const [index, setIndex] = useState(0);

  const messages = [
    `Hang tight ${name}, fetching your data...`,
    `Crunching numbers for you 📊`,
    `Almost there... optimizing insights`,
    `Preparing your dashboard 🚀`,
    `Good things take a second 😉`,
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">

      
      <motion.div
        className="w-14 h-14 border-4 border-slate-300 border-t-slate-900 rounded-full"
        animate={{ rotate: 360 }}
        transition={{
          repeat: Infinity,
          duration: 1,
          ease: "linear",
        }}
      />


      <div className="h-6 text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={messages[index]}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="text-sm text-slate-600"
          >
            {messages[index]}
          </motion.p>
        </AnimatePresence>
      </div>

      
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-slate-400 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              repeat: Infinity,
              duration: 1.2,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
}