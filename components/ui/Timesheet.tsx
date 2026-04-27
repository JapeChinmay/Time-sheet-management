"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  getDay,
  isAfter,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";

type Project = {
  id: number;
  name: string;
};

type Entry = {
  date: Date;
  projectId: number;
  projectName: string;
  hours: number;
};

const COLORS = [
  "bg-indigo-50 border-indigo-200",
  "bg-violet-50 border-violet-200",
  "bg-purple-50 border-purple-200",
  "bg-fuchsia-50 border-fuchsia-200",
  "bg-pink-50 border-pink-200",
  "bg-rose-50 border-rose-200",
  "bg-slate-50 border-slate-200",
  "bg-gray-50 border-gray-200",
  "bg-zinc-50 border-zinc-200",
];

export default function Timesheet() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [formRows, setFormRows] = useState([
    { projectId: "", hours: "" },
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  const days = Array.from({ length: 7 }).map((_, i) =>
    addDays(weekStart, i)
  );

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const res = await apiFetch("/projects");
      const list = Array.isArray(res) ? res : res.data || [];
      setProjects(list);
    } catch (e) {
      console.error(e);
    }
  };

  const isFutureDay = (date: Date) => isAfter(date, today);

  const openModal = (date: Date) => {
    if (isFutureDay(date)) return;

    setSelectedDate(date);

    const existing = entries.filter((e) =>
      isSameDay(e.date, date)
    );

    setFormRows(
      existing.length
        ? existing.map((e) => ({
            projectId: String(e.projectId),
            hours: String(e.hours),
          }))
        : [{ projectId: "", hours: "" }]
    );

    setShowModal(true);
  };

  const addRow = () => {
    setFormRows((prev) => [...prev, { projectId: "", hours: "" }]);
  };

  const removeRow = (index: number) => {
    setFormRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (
    index: number,
    field: "projectId" | "hours",
    value: string
  ) => {
    setFormRows((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const saveEntries = () => {
    if (!selectedDate) return;

    const newEntries: Entry[] = formRows
      .map((row) => {
        const project = projects.find(
          (p) => p.id === Number(row.projectId)
        );

        const hours = Number(row.hours);

        if (!project || !hours || hours <= 0) return null;

        return {
          date: selectedDate,
          projectId: project.id,
          projectName: project.name,
          hours,
        };
      })
      .filter(Boolean) as Entry[];

    const remaining = entries.filter(
      (e) => !isSameDay(e.date, selectedDate)
    );

    setEntries([...remaining, ...newEntries]);
    setShowModal(false);
  };

  const getEntriesForDay = (date: Date) =>
    entries.filter((e) => isSameDay(e.date, date));

  const getTotalHours = (date: Date) =>
    getEntriesForDay(date).reduce((sum, e) => sum + e.hours, 0);

  const getColor = (index: number) =>
    COLORS[index % COLORS.length];

  const isFriday = getDay(today) === 5;

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Timesheet
        </h1>
        <p className="text-sm text-slate-500">
          Weekly work tracking
        </p>
      </div>

      <div className="grid grid-cols-7 gap-4">
        {days.map((day, idx) => {
          const dayEntries = getEntriesForDay(day);
          const total = getTotalHours(day);
          const isFuture = isFutureDay(day);

          return (
            <motion.div
              key={day.toISOString()}
              whileHover={!isFuture ? { y: -3 } : {}}
              onClick={() => openModal(day)}
              className={`border rounded-xl p-3 min-h-[150px] transition ${
                isFuture
                  ? "bg-slate-100 border-slate-200 cursor-not-allowed opacity-60"
                  : dayEntries.length
                  ? getColor(idx)
                  : "bg-white border-slate-200 cursor-pointer hover:shadow-sm"
              }`}
            >
              <p className="text-xs text-slate-500">
                {format(day, "EEE")}
              </p>

              <p className="text-lg font-semibold">
                {format(day, "d")}
              </p>

              <div className="mt-2 space-y-1">
                {dayEntries.map((e, i) => (
                  <div
                    key={i}
                    className="text-xs bg-white/70 px-2 py-1 rounded border"
                  >
                    {e.projectName} • {e.hours}h
                  </div>
                ))}
              </div>

              {total > 0 && (
                <p className="text-xs mt-2 font-medium">
                  Total: {total}h
                </p>
              )}

              {isFuture && (
                <p className="text-[10px] mt-3 text-slate-400">
                  Locked
                </p>
              )}

              {!isFuture && dayEntries.length === 0 && (
                <p className="text-[10px] mt-3 text-red-500">
                  Missing log
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="flex gap-3">
        {isFriday ? (
          <button className="px-4 py-2 bg-slate-900 text-white rounded-md">
            Submit Week
          </button>
        ) : (
          <button className="px-4 py-2 bg-slate-900 text-white rounded-md">
            Submit Today
          </button>
        )}
      </div>

      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showModal && (
              <motion.div
                className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  className="bg-white w-full max-w-lg rounded-2xl shadow-xl border p-6 space-y-5"
                >
                  <div className="flex justify-between">
                    <h3 className="text-lg font-semibold">
                      Edit Logs
                    </h3>
                    <button onClick={() => setShowModal(false)}>
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-auto">
                    {formRows.map((row, i) => (
                      <div key={i} className="flex gap-2">
                        <select
                          value={row.projectId}
                          onChange={(e) =>
                            updateRow(i, "projectId", e.target.value)
                          }
                          className="flex-1 border px-3 py-2 rounded-md"
                        >
                          <option value="">Project</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          value={row.hours}
                          onChange={(e) =>
                            updateRow(i, "hours", e.target.value)
                          }
                          className="w-20 border px-2 py-2 rounded-md"
                        />

                        <button onClick={() => removeRow(i)}>✕</button>
                      </div>
                    ))}
                  </div>

                  <button onClick={addRow} className="text-blue-600 text-sm">
                    + Add project
                  </button>

                  <div className="flex gap-3">
                    <button
                      onClick={saveEntries}
                      className="flex-1 bg-slate-900 text-white py-2 rounded-md"
                    >
                      Save
                    </button>

                    <button
                      onClick={() => setShowModal(false)}
                      className="flex-1 border py-2 rounded-md"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}