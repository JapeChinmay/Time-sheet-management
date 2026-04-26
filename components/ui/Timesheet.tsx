"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";

type Project = {
  id: number;
  name: string;
};

type Row = {
  projectId: number;
  projectName: string;
  hours: number[];
};

export default function Timesheet() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "ACTIVE",
  });

  const [submitting, setSubmitting] = useState(false);

  const days = mode === "WEEKLY" ? 5 : 30;

  // ---------------- LOAD PROJECTS ----------------

  const loadProjects = async () => {
    try {
      const res = await apiFetch("/projects");

      const list = Array.isArray(res) ? res : res.data || [];

      setProjects(list);

      setRows(
        list.map((p: Project) => ({
          projectId: p.id,
          projectName: p.name,
          hours: Array(days).fill(0),
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [mode]);

  // ---------------- UPDATE HOURS ----------------

  const updateHours = (rowIndex: number, dayIndex: number, value: number) => {
    const safe = Math.max(0, value);

    setRows((prev) => {
      const newRows = [...prev];
      newRows[rowIndex].hours[dayIndex] = safe;
      return newRows;
    });
  };

  // ---------------- CREATE PROJECT ----------------

  const createProject = async () => {
    if (!form.name.trim()) return alert("Name required");

    try {
      await apiFetch("/projects", {
        method: "POST",
        body: JSON.stringify(form),
      });

      await loadProjects();
      setShowModal(false);
      setForm({ name: "", description: "", status: "ACTIVE" });

    } catch (err) {
      console.error(err);
    }
  };

  // ---------------- SUBMIT TIMESHEET (🔥 MAIN FIX) ----------------

  const submitTimesheet = async () => {
    try {
      setSubmitting(true);

      const today = new Date();
      const requests: Promise<any>[] = [];

      rows.forEach((row) => {
        row.hours.forEach((h, dayIndex) => {
          if (h > 0) {
            const date = new Date();

            if (mode === "WEEKLY") {
              date.setDate(
                today.getDate() - today.getDay() + dayIndex + 1
              );
            } else {
              date.setDate(dayIndex + 1);
            }

            requests.push(
              apiFetch("/timesheets", {
                method: "POST",
                body: JSON.stringify({
                  projectId: row.projectId,
                  date: date.toISOString().split("T")[0],
                  hours: h,
                  description: `Logged via ${mode} sheet`,
                }),
              })
            );
          }
        });
      });

      await Promise.all(requests);

      alert("Timesheet submitted successfully 🚀");

    } catch (err) {
      console.error(err);
      alert("Failed to submit timesheet");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------- TOTAL ----------------

  const totalRow = (hours: number[]) =>
    hours.reduce((a, b) => a + b, 0);

  // ---------------- USER NAME ----------------

  const getUser = () => {
    try {
      const token = localStorage.getItem("token");
      return JSON.parse(atob(token!.split(".")[1]));
    } catch {
      return { name: "User" };
    }
  };

  if (loading) {
    return <SmartLoader name={getUser().name} />;
  }

  // ---------------- UI ----------------

  return (
    <div className="space-y-5">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Timesheet</h2>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("WEEKLY")}
            className={`px-3 py-1 rounded ${
              mode === "WEEKLY"
                ? "bg-slate-900 text-white"
                : "bg-slate-100"
            }`}
          >
            Weekly
          </button>

          <button
            onClick={() => setMode("MONTHLY")}
            className={`px-3 py-1 rounded ${
              mode === "MONTHLY"
                ? "bg-slate-900 text-white"
                : "bg-slate-100"
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto bg-white border rounded-lg p-4">
        <table className="min-w-[700px] w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Project</th>

              {Array.from({ length: days }).map((_, i) => (
                <th key={i}>{i + 1}</th>
              ))}

              <th>Total</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <motion.tr key={row.projectId} className="border-t">

                <td className="font-medium">{row.projectName}</td>

                {row.hours.map((h, j) => (
                  <td key={j}>
                    <input
                      type="number"
                      min={0}
                      value={h}
                      onChange={(e) =>
                        updateHours(i, j, Number(e.target.value))
                      }
                      className="w-12 text-center border rounded"
                    />
                  </td>
                ))}

                <td className="font-medium">
                  {totalRow(row.hours)}
                </td>

              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ACTIONS */}
      <div className="flex gap-3">

        <button
          onClick={() => setShowModal(true)}
          className="bg-slate-900 text-white px-4 py-2 rounded"
        >
          + Add Project
        </button>

        <button
          onClick={submitTimesheet}
          disabled={submitting}
          className="bg-green-600 text-white px-6 py-2 rounded disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Timesheet"}
        </button>

      </div>

      {/* CREATE PROJECT MODAL */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-6 rounded-xl w-full max-w-md"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              <h3 className="mb-3 font-semibold">Create Project</h3>

              <input
                placeholder="Name"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                className="w-full mb-2 border p-2 rounded"
              />

              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full mb-2 border p-2 rounded"
              />

              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value })
                }
                className="w-full mb-3 border p-2 rounded"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>

              <div className="flex gap-2">
                <button
                  onClick={createProject}
                  className="flex-1 bg-slate-900 text-white py-2 rounded"
                >
                  Create
                </button>

                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 border py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}