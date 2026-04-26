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

  // 🔥 LOAD PROJECTS
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

  // 🔥 UPDATE HOURS
  const updateHours = (rowIndex: number, dayIndex: number, value: number) => {
    const safe = Math.max(0, value);

    setRows((prev) => {
      const newRows = [...prev];
      newRows[rowIndex].hours[dayIndex] = safe;
      return newRows;
    });
  };

  // 🔥 CREATE PROJECT
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

  // 🔥 SUBMIT TIMESHEET
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
                  description: `Logged via ${mode}`,
                }),
              })
            );
          }
        });
      });

      await Promise.all(requests);

      alert("Timesheet submitted 🚀");

    } catch (err) {
      console.error(err);
      alert("Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const totalRow = (hours: number[]) =>
    hours.reduce((a, b) => a + b, 0);

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

    function isAdminUser(role: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

    const user = getUser();
   
const isAdmin = isAdminUser(user.role);
  

  return (
    <div className="space-y-6">

      {/* 🔥 HEADER */}
      <div className="flex flex-col md:flex-row md:justify-between gap-4">

        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Timesheet
          </h2>
          <p className="text-sm text-slate-500">
            Track your daily work hours efficiently
          </p>
        </div>

        {/* MODE SWITCH */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          {["WEEKLY", "MONTHLY"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m as any)}
              className={`px-4 py-1.5 text-sm rounded-md transition
              ${
                mode === m
                  ? "bg-white shadow text-slate-900"
                  : "text-slate-500"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* 🔥 TABLE */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-x-auto"
      >
        <table className="min-w-[800px] w-full text-sm">

          <thead className="border-b text-slate-500">
            <tr>
              <th className="text-left py-2">Project</th>

              {Array.from({ length: days }).map((_, i) => (
                <th key={i}>
                  {mode === "WEEKLY"
                    ? ["M", "T", "W", "T", "F"][i]
                    : i + 1}
                </th>
              ))}

              <th>Total</th>
            </tr>
          </thead>

          <tbody>
            <AnimatePresence>
              {rows.map((row, i) => (
                <motion.tr
                  key={row.projectId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-t hover:bg-slate-50"
                >
                  <td className="font-medium py-2 text-slate-800">
                    {row.projectName}
                  </td>

                  {row.hours.map((h, j) => (
                    <td key={j}>
                      <motion.input
                        whileFocus={{ scale: 1.05 }}
                        type="number"
                        min={0}
                        value={h}
                        onChange={(e) =>
                          updateHours(i, j, Number(e.target.value))
                        }
                        className="w-12 text-center border border-slate-200 rounded-md focus:ring-2 focus:ring-slate-900/10"
                      />
                    </td>
                  ))}

                  <td className="font-semibold">
                    {totalRow(row.hours)}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </motion.div>

      {/* 🔥 ACTIONS */}
      <div className="flex gap-3 flex-wrap">

     {isAdmin && (
  <motion.button
    whileHover={{ scale: 1.03 }}
    whileTap={{ scale: 0.97 }}
    onClick={() => setShowModal(true)}
    className="px-4 py-2 border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-sm"
  >
    + Add Project
  </motion.button>
)}

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={submitTimesheet}
          disabled={submitting}
          className="px-6 py-2 bg-slate-900 text-white rounded-md text-sm disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Timesheet"}
        </motion.button>
      </div>

      {/* 🔥 MODAL */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-xl p-6 w-full max-w-md shadow-lg"
            >
              <h3 className="text-lg font-semibold mb-4">
                Create Project
              </h3>

              <input
                placeholder="Project Name"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                className="w-full mb-3 px-3 py-2 border rounded-md"
              />

              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full mb-3 px-3 py-2 border rounded-md"
              />

              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value })
                }
                className="w-full mb-4 px-3 py-2 border rounded-md"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>

              <div className="flex gap-3">
                <button
                  onClick={createProject}
                  className="flex-1 bg-slate-900 text-white py-2 rounded-md"
                >
                  Create
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
      </AnimatePresence>

    </div>
  );
}