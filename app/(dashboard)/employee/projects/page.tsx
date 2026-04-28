"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Folder, Calendar, Building2, MapPin } from "lucide-react";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";
import Combobox from "@/components/ui/Combobox";

type Project = {
  id: number;
  name: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
  clientName?: string | null;
  sourceCompany?: string | null;
  projectType?: string | null;
  shiftType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  members?: { name: string }[];
  projectManager?: { name: string };
};

const PROJECT_TYPES = ["FIXED", "TIME_AND_MATERIAL", "RETAINER", "INTERNAL"] as const;
const SHIFT_TYPES   = ["MORNING", "AFTERNOON", "NIGHT", "FLEXIBLE"] as const;

const PT_LABELS: Record<string, string> = {
  FIXED: "Fixed Price",
  TIME_AND_MATERIAL: "T&M",
  RETAINER: "Retainer",
  INTERNAL: "Internal",
};

const EMPTY_FORM = {
  name: "", description: "", status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  startDate: "", endDate: "", sourceCompany: "", clientName: "",
  projectType: "", shiftType: "", shiftStartTime: "", shiftEndTime: "",
  breakTime: "", location: "",
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

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

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setField = (k: keyof typeof EMPTY_FORM) => (val: string) =>
    setForm((f) => ({ ...f, [k]: val }));

  const createProject = async () => {
    if (!form.name.trim()) { setCreateError("Project name is required."); return; }
    setCreating(true);
    setCreateError("");
    try {
      const body: Record<string, any> = { name: form.name.trim() };
      if (form.description.trim())   body.description   = form.description.trim();
      if (form.status)               body.status        = form.status;
      if (form.startDate)            body.startDate     = form.startDate;
      if (form.endDate)              body.endDate       = form.endDate;
      if (form.sourceCompany.trim()) body.sourceCompany = form.sourceCompany.trim();
      if (form.clientName.trim())    body.clientName    = form.clientName.trim();
      if (form.projectType)          body.projectType   = form.projectType;
      if (form.shiftType)            body.shiftType     = form.shiftType;
      if (form.shiftStartTime)       body.shiftStartTime = form.shiftStartTime;
      if (form.shiftEndTime)         body.shiftEndTime   = form.shiftEndTime;
      if (form.breakTime !== "")     body.breakTime      = Number(form.breakTime);
      if (form.location.trim())      body.location       = form.location.trim();

      await apiFetch("/projects", { method: "POST", body: JSON.stringify(body) });
      setForm(EMPTY_FORM);
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
  if (error)   return <p className="text-red-500 p-4">{error}</p>;

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
                {/* Name + status */}
                <div className="flex justify-between items-start gap-2">
                  <p className="font-semibold text-slate-900 leading-snug">{p.name}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {p.projectType && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                        {PT_LABELS[p.projectType] ?? p.projectType}
                      </span>
                    )}
                    <StatusBadge status={p.status} />
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-500 line-clamp-2">
                  {p.description || "No description provided"}
                </p>

                {/* Client / company */}
                {(p.clientName || p.sourceCompany) && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Building2 size={11} className="flex-shrink-0" />
                    <span className="truncate">{p.clientName ?? p.sourceCompany}</span>
                  </div>
                )}

                {/* Dates */}
                {(p.startDate || p.endDate) && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar size={11} className="flex-shrink-0" />
                    <span>
                      {p.startDate ? new Date(p.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      {" → "}
                      {p.endDate   ? new Date(p.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Ongoing"}
                    </span>
                  </div>
                )}

                {/* Location */}
                {p.location && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <MapPin size={11} className="flex-shrink-0" />
                    <span className="truncate">{p.location}</span>
                  </div>
                )}

                {/* Members + PM */}
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
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-xl flex flex-col max-h-[90vh]"
            >
              {/* Modal header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <h2 className="font-semibold text-slate-900">New Project</h2>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 transition">
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

                {/* Basic info */}
                <Section title="Basic Info">
                  <Field label="Project Name *">
                    <input autoFocus value={form.name} onChange={set("name")}
                      placeholder="e.g. SAP BTP Migration"
                      className={INPUT} />
                  </Field>
                  <Field label="Description">
                    <textarea rows={2} value={form.description} onChange={set("description")}
                      placeholder="Brief overview…"
                      className={`${INPUT} resize-none`} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Status">
                      <Combobox value={form.status} onChange={setField("status")}
                        options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
                    </Field>
                    <Field label="Project Type">
                      <Combobox value={form.projectType} onChange={setField("projectType")} placeholder="— Select —"
                        options={[{ value: "", label: "None" }, ...PROJECT_TYPES.map((t) => ({ value: t, label: PT_LABELS[t] }))]} />
                    </Field>
                  </div>
                </Section>

                {/* Client / Company */}
                <Section title="Client & Company">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Client Name">
                      <input value={form.clientName} onChange={set("clientName")}
                        placeholder="John Doe" className={INPUT} />
                    </Field>
                    <Field label="Source Company">
                      <input value={form.sourceCompany} onChange={set("sourceCompany")}
                        placeholder="Acme Corp" className={INPUT} />
                    </Field>
                  </div>
                  <Field label="Location">
                    <input value={form.location} onChange={set("location")}
                      placeholder="Pune, Maharashtra" className={INPUT} />
                  </Field>
                </Section>

                {/* Timeline */}
                <Section title="Timeline">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Start Date">
                      <input type="date" value={form.startDate} onChange={set("startDate")} className={INPUT} />
                    </Field>
                    <Field label="End Date">
                      <input type="date" value={form.endDate} onChange={set("endDate")} className={INPUT} />
                    </Field>
                  </div>
                </Section>

                {/* Shift */}
                <Section title="Shift">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Shift Type">
                      <Combobox value={form.shiftType} onChange={setField("shiftType")} placeholder="— Select —"
                        options={[{ value: "", label: "None" }, ...SHIFT_TYPES.map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() }))]} />
                    </Field>
                    <Field label="Break Time (minutes)">
                      <input type="number" min={0} value={form.breakTime} onChange={set("breakTime")}
                        placeholder="30" className={INPUT} />
                    </Field>
                    <Field label="Shift Start">
                      <input type="time" value={form.shiftStartTime} onChange={set("shiftStartTime")} className={INPUT} />
                    </Field>
                    <Field label="Shift End">
                      <input type="time" value={form.shiftEndTime} onChange={set("shiftEndTime")} className={INPUT} />
                    </Field>
                  </div>
                </Section>

                {createError && <p className="text-red-500 text-xs">{createError}</p>}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 pt-3 border-t border-slate-100 flex gap-3 flex-shrink-0">
                <button onClick={createProject} disabled={creating}
                  className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-60">
                  {creating ? "Creating…" : "Create Project"}
                </button>
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 border border-slate-200 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition">
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

/* ── helpers ── */
const INPUT = "w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return status === "ACTIVE"
    ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 flex-shrink-0">Active</span>
    : <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500 flex-shrink-0">Inactive</span>;
}
