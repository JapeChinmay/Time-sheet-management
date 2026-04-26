"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";

type Project = {
  id: number;
  name: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";

  // 🔥 future ready
  team?: { name: string }[];
  lead?: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "ACTIVE",
  });

  const loadProjects = async () => {
    try {
      const res = await apiFetch("/projects");
      const list = Array.isArray(res) ? res : res.data || [];

      // 🔥 inject dummy team for UI (until backend ready)
      const enhanced = list.map((p: any) => ({
        ...p,
        team: [
          { name: "Rahul" },
          { name: "Anita" },
          { name: "Arjun" },
        ],
        lead: "Team Lead",
      }));

      setProjects(enhanced);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const openProject = async (id: number) => {
    try {
      setModalLoading(true);
      const data = await apiFetch(`/projects/${id}`);

      setSelected(data);
      setForm({
        name: data.name || "",
        description: data.description || "",
        status: data.status || "ACTIVE",
      });

    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  const updateProject = async () => {
    if (!selected) return;

    try {
      await apiFetch(`/projects/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });

      await loadProjects();
      setSelected(null);

    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  const getUser = () => {
    try {
      const token = localStorage.getItem("token");
      return JSON.parse(atob(token!.split(".")[1]));
    } catch {
      return { name: "User" };
    }
  };

  if (loading) return <SmartLoader name={getUser().name} />;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-6">

      {/* 🔥 HEADER */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
          Projects
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage and monitor all active initiatives
        </p>
      </div>

      {/* 🔥 GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

        {projects.map((p) => (
          <motion.div
            key={p.id}
            whileHover={{ y: -5 }}
            onClick={() => openProject(p.id)}
            className="relative bg-white border border-slate-200 rounded-xl p-5 shadow-sm cursor-pointer overflow-hidden"
          >
            {/* subtle gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-60 pointer-events-none" />

            {/* content */}
            <div className="relative space-y-3">

              {/* TITLE */}
              <div className="flex justify-between items-center">
                <p className="font-semibold text-slate-900">
                  {p.name}
                </p>

                <StatusBadge status={p.status} />
              </div>

              {/* DESCRIPTION */}
              <p className="text-sm text-slate-500 line-clamp-2">
                {p.description || "No description provided"}
              </p>

              {/* TEAM */}
              <div className="flex items-center justify-between pt-2">

                {/* avatars */}
                <div className="flex -space-x-2">
                  {p.team?.slice(0, 3).map((t, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center border-2 border-white"
                    >
                      {t.name[0]}
                    </div>
                  ))}

                  {p.team && p.team.length > 3 && (
                    <div className="w-7 h-7 rounded-full bg-slate-200 text-xs flex items-center justify-center">
                      +{p.team.length - 3}
                    </div>
                  )}
                </div>

                {/* lead */}
                <p className="text-xs text-slate-400">
                  Lead: {p.lead || "—"}
                </p>
              </div>

            </div>
          </motion.div>
        ))}
      </div>

      {/* 🔥 MODAL */}
      <AnimatePresence>
        {selected && (
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
              {modalLoading ? (
                <SmartLoader name={getUser().name} />
              ) : (
                <>
                  <h2 className="text-lg font-semibold mb-4 text-slate-900">
                    Edit Project
                  </h2>

                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    className="w-full mb-3 px-3 py-2 border rounded-md"
                  />

                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        description: e.target.value,
                      })
                    }
                    className="w-full mb-3 px-3 py-2 border rounded-md"
                  />

                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as any,
                      })
                    }
                    className="w-full mb-4 px-3 py-2 border rounded-md"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>

                  <div className="flex gap-3">
                    <button
                      onClick={updateProject}
                      className="flex-1 bg-slate-900 text-white py-2 rounded-md"
                    >
                      Save
                    </button>

                    <button
                      onClick={() => setSelected(null)}
                      className="flex-1 border py-2 rounded-md"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

/* 🔥 STATUS */
function StatusBadge({ status }: { status: string }) {
  const base =
    "text-xs px-2 py-1 rounded-full font-medium";

  if (status === "ACTIVE") {
    return (
      <span className={`${base} bg-green-100 text-green-700`}>
        Active
      </span>
    );
  }

  return (
    <span className={`${base} bg-gray-200 text-gray-700`}>
      Inactive
    </span>
  );
}