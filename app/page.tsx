
"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { LiveSnapshot } from "@/components/Livesnapshot";

/* 🔥 Demo Users (safe for landing page) */
const demoUsers = [
  "Aarav Mehta",
  "Priya Sharma",
  "Rahul Verma",
  "Neha Kapoor",
  "Vikram Singh",
];

/* 🔥 Avatar Component */
function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const colors = [
    "bg-slate-900",
    "bg-blue-600",
    "bg-green-600",
    "bg-purple-600",
  ];

  const color = colors[name.length % colors.length];

  return (
    <div
      className={`w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-white text-sm font-medium ${color}`}
    >
      {initials}
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 px-6">

      {/* 🔥 NAV */}
      <div className="max-w-6xl mx-auto flex justify-between items-center py-6">
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
          WorkPulse
        </h1>

        <button
          onClick={() => router.push("/login")}
          className="text-sm px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition"
        >
          Sign in
        </button>
      </div>

      {/* 🔥 HERO */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center mt-10">

        {/* LEFT */}
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-semibold text-slate-900 leading-tight"
          >
            Control your time.
            <br />
            Own your productivity.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 mt-4 text-lg"
          >
            A focused workspace for individuals and teams to track,
            analyze, and improve how they work every day.
          </motion.p>

       

       
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-3 mt-8"
          >
            <div className="flex -space-x-3">
              {demoUsers.map((name, i) => (
                <UserAvatar key={i} name={name} />
              ))}
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Trusted by high-performance teams
              </p>
              <p className="text-xs text-slate-400">
                +12 more active users
              </p>
            </div>
          </motion.div>
        </div>

        {/* RIGHT - DASHBOARD PREVIEW */}
        <motion.div>
          <LiveSnapshot></LiveSnapshot>
    
        </motion.div>
      </div>

      {/* 🔥 FEATURES */}
      <div className="max-w-6xl mx-auto mt-24 grid md:grid-cols-3 gap-6">
        {[
          {
            title: "Smart Tracking",
            desc: "Track time without friction, auto-detect work sessions.",
          },
          {
            title: "Deep Analytics",
            desc: "Understand patterns and eliminate wasted hours.",
          },
          {
            title: "Team Visibility",
            desc: "Know who’s working on what in real time.",
          },
        ].map((f, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -5 }}
            className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-slate-900">
              {f.title}
            </h3>
            <p className="text-sm text-slate-500 mt-2">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* 🔥 CTA */}
      <div className="max-w-6xl mx-auto mt-24 text-center pb-16">
        <h2 className="text-2xl font-semibold text-slate-900">
          Ready to take control?
        </h2>

        <button
          onClick={() => router.push("/login")}
          className="mt-6 px-8 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition"
        >
          Start Now
        </button>
      </div>
    </div>
  );
}