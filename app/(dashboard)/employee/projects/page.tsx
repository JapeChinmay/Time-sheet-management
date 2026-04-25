"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Project = {
  id: number; // ✅ added
  name: string;
  status: "Active" | "Completed" | "On Hold";
  leader: string;
  completion: number;
  contribution: number;
};

export default function ProjectsPage() {
  const [openId, setOpenId] = useState<number | null>(null); // ✅ changed

  const projects: Project[] = [
    {
      id: 1,
      name: "Project A",
      status: "Active",
      leader: "Rahul Sharma",
      completion: 70,
      contribution: 12,
    },
    {
      id: 2,
      name: "Project B",
      status: "Completed",
      leader: "Anita Verma",
      completion: 100,
      contribution: 20,
    },
  ];

  const toggle = (id: number) => {
    setOpenId(openId === id ? null : id); // ✅ only one open
  };

  return (
    <div>
      <h1 className="text-2xl font-medium text-slate-800 mb-5">
        Your Projects
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <motion.div
            key={p.id}
            layout
            whileHover={{ y: -3 }}
            className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm cursor-pointer"
            onClick={() => toggle(p.id)}
          >
            {/* Top Row */}
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-slate-800">
                {p.name}
              </p>

              <div className="flex items-center gap-2">
                <StatusBadge status={p.status} />

                {/* 🔥 Chevron animation */}
                <motion.span
                  animate={{ rotate: openId === p.id ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-xs text-slate-400"
                >
                  ▼
                </motion.span>
              </div>
            </div>

            {/* Expandable Section */}
            <AnimatePresence>
              {openId === p.id && (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35 }}
                  className="overflow-hidden mt-3"
                >
                  <div className="space-y-3 text-sm text-slate-600">

                    {/* Leader */}
                    <p>
                      <span className="text-slate-500">Team Lead:</span>{" "}
                      {p.leader}
                    </p>

                    {/* Completion */}
                    <div>
                      <p className="text-xs text-slate-500 mb-1">
                        Completion
                      </p>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${p.completion}%` }}
                          transition={{ duration: 0.6 }}
                          className="bg-slate-900 h-2 rounded-full"
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {p.completion}%
                      </p>
                    </div>

                    {/* Contribution */}
                    <div>
                      <p className="text-xs text-slate-500">
                        Your Contribution
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {p.contribution} hours logged
                      </p>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* Status Badge */
function StatusBadge({ status }: { status: string }) {
  const base = "text-xs px-2 py-1 rounded-full font-medium";

  if (status === "Active")
    return (
      <span className={`${base} bg-green-100 text-green-700`}>
        Active
      </span>
    );

  if (status === "Completed")
    return (
      <span className={`${base} bg-blue-100 text-blue-700`}>
        Completed
      </span>
    );

  return (
    <span className={`${base} bg-yellow-100 text-yellow-700`}>
      On Hold
    </span>
  );
}