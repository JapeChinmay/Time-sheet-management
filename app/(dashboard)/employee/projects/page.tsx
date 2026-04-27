"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Folder } from "lucide-react";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";

type Project = {
  id: number;
  name: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
  members?: { name: string }[];
  projectManager?: { name: string };
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState({ name: "", description: "" });

  const loadProjects = async () => {
    try {
      const res = await apiFetch("/projects?join=members&join=projectManager");
      setProjects(Array.isArray(res) ? res : res.data ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  const createProject = async () => {
    if (!form.name.trim()) { setCreateError("Project name is required."); return; }
    setCreating(true);
    setCreateError("");
    try {
      await apiFetch("/projects", {
        method: "POST",
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || undefined }),
      });
      setForm({ name: "", description: "" });
      setShowCreate(false);
      await loadProjects();
    } catch (err: any) {
      setCreateError(err.message ?? "Failed to create project.");
    } finally {
      setCreating(false);
    }
  };

  const getUser = () => {
    try { return JSON.parse(atob(localStorage.getItem("token")!.split(".")[1])); }
    catch { return { name: "User" }; }
  };

  if (loading) return <SmartLoader name={getUser().name} />;
  if (error) return <p className="text-red-500 p-4">{error}</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and monitor all active initiatives</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition"
        >
          <Plus size={15} /> New Project
        </button>
      </div>

      {/* Grid */}
      {projects.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Folder size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No projects yet</p>
          <p className="text-sm mt-1">Create your first project to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {projects.map((p) => (
            <motion.div
              key={p.id}
              whileHover={{ y: -4, boxShadow: "0 8px 24px -4px rgba(0,0,0,0.08)" }}
              onClick={() => router.push(`/employee/projects/${p.id}`)}
              className="relative bg-white border border-slate-200 rounded-xl p-5 cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-60 pointer-events-none" />
              <div className="relative space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <p className="font-semibold text-slate-900 leading-snug">{p.name}</p>
                  <StatusBadge status={p.status} />
                </div>

                <p className="text-sm text-slate-500 line-clamp-2">
                  {p.description || "No description provided"}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex -space-x-2">
                    {(p.members ?? []).slice(0, 4).map((m, i) => (
                      <div key={i} className="w-7 h-7 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center border-2 border-white font-medium">
                        {m.name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    ))}
                    {(p.members?.length ?? 0) > 4 && (
                      <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-xs flex items-center justify-center border-2 border-white">
                        +{p.members!.length - 4}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate max-w-[120px]">
                    {p.projectManager ? `PM: ${p.projectManager.name}` : "No PM assigned"}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">New Project</h2>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 transition">
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Project Name *</label>
                  <input
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && createProject()}
                    placeholder="e.g. SAP BTP Migration"
                    className="w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Brief overview of the project…"
                    className="w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                {createError && <p className="text-red-500 text-xs">{createError}</p>}
              </div>

              <div className="px-6 pb-5 flex gap-3">
                <button
                  onClick={createProject}
                  disabled={creating}
                  className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-60"
                >
                  {creating ? "Creating…" : "Create Project"}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border border-slate-200 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition"
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

function StatusBadge({ status }: { status: string }) {
  return status === "ACTIVE"
    ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 flex-shrink-0">Active</span>
    : <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500 flex-shrink-0">Inactive</span>;
}
