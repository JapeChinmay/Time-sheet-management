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
      setProjects(list);
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


  if (loading) {
    return <SmartLoader name={getUser().name} />;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">
        Your Projects
      </h1>

    
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <motion.div
            key={p.id}
            whileHover={{ y: -3 }}
            onClick={() => openProject(p.id)}
            className="bg-white border rounded-lg p-4 shadow-sm cursor-pointer"
          >
            <p className="font-medium">{p.name}</p>
            <StatusBadge status={p.status} />
          </motion.div>
        ))}
      </div>

 
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-6 rounded-xl w-full max-w-md"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              {modalLoading ? (
                <SmartLoader name={getUser().name} />
              ) : (
                <>
                  <h2 className="text-lg font-semibold mb-4">
                    Edit Project
                  </h2>

                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    className="w-full mb-2 border p-2 rounded"
                  />

                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        description: e.target.value,
                      })
                    }
                    className="w-full mb-2 border p-2 rounded"
                  />

                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as any,
                      })
                    }
                    className="w-full mb-4 border p-2 rounded"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>

                  <div className="flex gap-2">
                    <button
                      onClick={updateProject}
                      className="flex-1 bg-slate-900 text-white py-2 rounded"
                    >
                      Save
                    </button>

                    <button
                      onClick={() => setSelected(null)}
                      className="flex-1 border py-2 rounded"
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


function StatusBadge({ status }: { status: string }) {
  const base = "text-xs px-2 py-1 rounded-full font-medium ml-2";

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