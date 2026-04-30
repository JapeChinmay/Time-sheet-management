"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Folder, Calendar, Building2, MapPin,
  Search, Users, Briefcase, Clock3,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";
import Combobox from "@/components/ui/Combobox";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";

/* ─── types ─── */
type Member = {
  id: number;
  name: string;
  email?: string;
  role?: string;
  designation?: string;
};

type Project = {
  id: number;
  name: string;
  description?: string | null;
  status: "CREATED" | "ACTIVE" | "INACTIVE" | "COMPLETED";
  clientName?: string | null;
  sourceCompany?: string | null;
  projectType?: string | null;
  shiftType?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  members?: Member[];
  projectManager?: { id: number; name: string; designation?: string } | null;
};

/* ─── Deterministic card colour palette (full Tailwind strings — never dynamic) ─── */
const CARD_PALETTE = [
  { bg: "bg-indigo-50",  border: "border-indigo-200",  icon: "bg-indigo-100  text-indigo-700",  ring: "ring-indigo-200"  },
  { bg: "bg-violet-50",  border: "border-violet-200",  icon: "bg-violet-100  text-violet-700",  ring: "ring-violet-200"  },
  { bg: "bg-sky-50",     border: "border-sky-200",     icon: "bg-sky-100     text-sky-700",     ring: "ring-sky-200"     },
  { bg: "bg-teal-50",    border: "border-teal-200",    icon: "bg-teal-100    text-teal-700",    ring: "ring-teal-200"    },
  { bg: "bg-emerald-50", border: "border-emerald-200", icon: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-200" },
  { bg: "bg-rose-50",    border: "border-rose-200",    icon: "bg-rose-100    text-rose-700",    ring: "ring-rose-200"    },
  { bg: "bg-amber-50",   border: "border-amber-200",   icon: "bg-amber-100   text-amber-700",   ring: "ring-amber-200"   },
  { bg: "bg-fuchsia-50", border: "border-fuchsia-200", icon: "bg-fuchsia-100 text-fuchsia-700", ring: "ring-fuchsia-200" },
  { bg: "bg-orange-50",  border: "border-orange-200",  icon: "bg-orange-100  text-orange-700",  ring: "ring-orange-200"  },
  { bg: "bg-cyan-50",    border: "border-cyan-200",    icon: "bg-cyan-100    text-cyan-700",    ring: "ring-cyan-200"    },
] as const;

/* Avatar colours — one per member slot so each person looks distinct */
const AVATAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-sky-500",     "bg-teal-500",
  "bg-emerald-500","bg-rose-500",   "bg-amber-500",   "bg-fuchsia-500",
  "bg-orange-500", "bg-cyan-500",   "bg-pink-500",    "bg-purple-500",
] as const;

const PT_LABELS: Record<string, string> = {
  IMPLEMENTATION_GREENFIELD:  "Implementation (Greenfield)",
  MIGRATION_BROWNFIELD:       "Migration / System Conversion (Brownfield)",
  ROLLOUT:                    "Rollout",
  SUPPORT_MAINTENANCE:        "Support and Maintenance (AMS)",
  UPGRADE_ENHANCEMENT:        "Upgrade / Enhancement",
  LANDSCAPE_TRANSFORMATION:   "Landscape Transformation (Carve-outs)",
  PROOF_OF_CONCEPT:           "Proof of Concept (PoC) / Prototyping",
  INTEGRATION_INTERFACE:      "Integration / Interface Projects",
  CUSTOM_DEVELOPMENT:         "Custom Development (Side-by-Side Extensibility)",
  DATA_ARCHIVING_CLEANSING:   "Data Archiving & Data Cleansing",
  SECURITY_AUTHORIZATION_GRC: "Security and Authorization (GRC) Projects",
  CLOUD_HOSTING_MIGRATION:    "Cloud Hosting Migration (Lift and Shift)",
};

const SHIFT_TYPES   = ["MORNING", "AFTERNOON", "NIGHT", "FLEXIBLE"] as const;
const PROJECT_TYPES = [
  "IMPLEMENTATION_GREENFIELD",
  "MIGRATION_BROWNFIELD",
  "ROLLOUT",
  "SUPPORT_MAINTENANCE",
  "UPGRADE_ENHANCEMENT",
  "LANDSCAPE_TRANSFORMATION",
  "PROOF_OF_CONCEPT",
  "INTEGRATION_INTERFACE",
  "CUSTOM_DEVELOPMENT",
  "DATA_ARCHIVING_CLEANSING",
  "SECURITY_AUTHORIZATION_GRC",
  "CLOUD_HOSTING_MIGRATION",
] as const;

const EMPTY_FORM = {
  name: "", description: "", status: "CREATED" as "CREATED" | "ACTIVE" | "INACTIVE" | "COMPLETED",
  startDate: "", endDate: "", sourceCompany: "", clientName: "",
  projectType: "", shiftType: "MORNING", shiftStartTime: "09:00", shiftEndTime: "18:00",
  breakTime: "", location: "",
};

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function PMTooltip({
  projectManager,
}: {
  projectManager: { id: number; name: string; designation?: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative flex items-center gap-1.5 flex-shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Avatar */}
        <span className="text-[10px] font-semibold text-slate-500">
    Project Manager
  </span>

      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${
          AVATAR_COLORS[(projectManager.id ?? 0) % AVATAR_COLORS.length]
        }`}
      >
        {projectManager.name[0]?.toUpperCase()}
      </div>

      {/* Name */}
      <span className="text-[11px] text-slate-400 truncate max-w-[90px]">
        {projectManager.name}
      </span>

      {/* Tooltip */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
          >
            <div className="bg-slate-900 text-white rounded-lg px-3 py-2 shadow-xl min-w-max">
              <p className="text-xs font-semibold leading-tight">
                {projectManager.name}
              </p>
              <p className="text-[10px] text-slate-300 mt-0.5">
                {projectManager.designation || "Project Manager"}
              </p>
            </div>

            {/* Arrow */}
            <div className="flex justify-center -mt-1">
              <div className="w-2 h-2 bg-slate-900 rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
export default function ProjectsPage() {
  const router = useRouter();
  const [projects,    setProjects]    = useState<Project[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [showCreate,  setShowCreate]  = useState(false);
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState("");
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [search,      setSearch]      = useState("");
  const [statusFilter,setStatusFilter]= useState<"ALL" | "CREATED" | "ACTIVE" | "INACTIVE" | "COMPLETED">("ALL");

  const loadProjects = async () => {
    try {
      const res = await apiFetch("/projects?join=members&join=projectManager&limit=200");
      setProjects(Array.isArray(res) ? res : res.data ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  /* filtered list */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.clientName ?? "").toLowerCase().includes(q) ||
        (p.sourceCompany ?? "").toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "ALL" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [projects, search, statusFilter]);

  const set      = (k: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  const setField = (k: keyof typeof EMPTY_FORM) => (val: string) =>
    setForm((f) => ({ ...f, [k]: val }));

  const createProject = async () => {
    if (!form.name.trim()) { setCreateError("Project name is required."); return; }
    setCreating(true); setCreateError("");
    try {
      const body: Record<string, any> = { name: form.name.trim() };
      if (form.description.trim())   body.description    = form.description.trim();
      if (form.status)               body.status         = form.status;
      if (form.startDate)            body.startDate      = form.startDate;
      if (form.endDate)              body.endDate        = form.endDate;
      if (form.sourceCompany.trim()) body.sourceCompany  = form.sourceCompany.trim();
      if (form.clientName.trim())    body.clientName     = form.clientName.trim();
      if (form.projectType)          body.projectType    = form.projectType;
      if (form.shiftType)            body.shiftType      = form.shiftType;
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

  const createdCount   = projects.filter(p => p.status === "CREATED").length;
  const activeCount    = projects.filter(p => p.status === "ACTIVE").length;
  const inactiveCount  = projects.filter(p => p.status === "INACTIVE").length;
  const completedCount = projects.filter(p => p.status === "COMPLETED").length;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">
            {projects.length} project{projects.length !== 1 ? "s" : ""} &nbsp;·&nbsp;
            {createdCount > 0 && <span className="text-blue-600 font-medium">{createdCount} created &nbsp;·&nbsp;</span>}
            <span className="text-green-600 font-medium">{activeCount} active</span>
            {inactiveCount > 0 && <span className="text-slate-400"> · {inactiveCount} inactive</span>}
            {completedCount > 0 && <span className="text-purple-600 font-medium"> · {completedCount} completed</span>}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition"
        >
          <Plus size={15} /> New Project
        </button>
      </div>

      {/* ── Search + status filter ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects, clients…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          /> 
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
          {(["ALL", "CREATED", "ACTIVE", "INACTIVE", "COMPLETED"] as const).map((s) => {
            const count =
              s === "ALL"       ? projects.length :
              s === "CREATED"   ? createdCount :
              s === "ACTIVE"    ? activeCount :
              s === "INACTIVE"  ? inactiveCount :
              completedCount;
            const label =
              s === "ALL"       ? "All" :
              s === "CREATED"   ? "Created" :
              s === "ACTIVE"    ? "Active" :
              s === "INACTIVE"  ? "Inactive" :
              "Completed";
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                  statusFilter === s
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Folder size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {search || statusFilter !== "ALL" ? "No projects match your filters" : "No projects yet"}
          </p>
          <p className="text-sm mt-1">
            {search || statusFilter !== "ALL"
              ? "Try adjusting your search or filter."
              : "Create your first project to get started."}
          </p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          <AnimatePresence>
            {filtered.map((p, idx) => {
              const theme = CARD_PALETTE[p.id % CARD_PALETTE.length];
              return (
                <ProjectCard
                  key={p.id}
                  project={p}
                  theme={theme}
                  index={idx}
                  onClick={() => router.push(`/employee/projects/${p.id}`)}
                />
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Create Project Modal ── */}
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
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                    <Briefcase size={14} className="text-white" />
                  </div>
                  <h2 className="font-semibold text-slate-900">New Project</h2>
                </div>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 transition">
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
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
                      <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 cursor-not-allowed">
                        <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
                        <span className="text-sm text-slate-500 font-medium">Created</span>
                        <span className="ml-auto text-[10px] text-slate-400 italic">default</span>
                      </div>
                    </Field>
                    <Field label="Project Type">
                      <Combobox value={form.projectType} onChange={setField("projectType")} placeholder="— Select —"
                        options={[{ value: "", label: "None" }, ...PROJECT_TYPES.map((t) => ({ value: t, label: PT_LABELS[t] }))]} />
                    </Field>
                  </div>
                </Section>

                <Section title="Client & Company">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Client Name">
                      <input value={form.clientName} onChange={set("clientName")} placeholder="John Doe" className={INPUT} />
                    </Field>
                    <Field label="Source Company">
                      <input value={form.sourceCompany} onChange={set("sourceCompany")} placeholder="Acme Corp" className={INPUT} />
                    </Field>
                  </div>
                  <Field label="Location">
                    <input value={form.location} onChange={set("location")} placeholder="Pune, Maharashtra" className={INPUT} />
                  </Field>
                </Section>

                <Section title="Timeline">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Start Date">
                      <DatePicker value={form.startDate} onChange={setField("startDate")} placeholder="Start date" />
                    </Field>
                    <Field label="End Date">
                      <DatePicker value={form.endDate} onChange={setField("endDate")} placeholder="End date" min={form.startDate || undefined} />
                    </Field>
                  </div>
                </Section>

                <Section title="Shift">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Shift Type">
                      <Combobox value={form.shiftType} onChange={setField("shiftType")} placeholder="— Select —"
                        options={[{ value: "", label: "None" }, ...SHIFT_TYPES.map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() }))]} />
                    </Field>
                    <Field label="Break (minutes)">
                      <input type="number" min={0} value={form.breakTime} onChange={set("breakTime")} placeholder="30" className={INPUT} />
                    </Field>
                    <Field label="Shift Start">
                      <TimePicker value={form.shiftStartTime} onChange={setField("shiftStartTime")} placeholder="Start time" />
                    </Field>
                    <Field label="Shift End">
                      <TimePicker value={form.shiftEndTime} onChange={setField("shiftEndTime")} placeholder="End time" />
                    </Field>
                  </div>
                </Section>

                {createError && (
                  <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {createError}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 pt-3 border-t border-slate-100 flex gap-3 flex-shrink-0">
                <button onClick={createProject} disabled={creating}
                  className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
                  {creating
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
                    : <><Plus size={14} /> Create Project</>
                  }
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

/* ════════════════════════════════
   Project Card
════════════════════════════════ */
function ProjectCard({
  project: p, theme, index, onClick,
}: {
  project: Project;
  theme: typeof CARD_PALETTE[number];
  index: number;
  onClick: () => void;
}) {
  const members    = p.members ?? [];
  const visible    = members.slice(0, 4);
  const overflow   = members.length - 4;

  /* shift info label */
  const shiftLabel = p.shiftStartTime && p.shiftEndTime
    ? `${p.shiftStartTime.slice(0, 5)} – ${p.shiftEndTime.slice(0, 5)}`
    : p.shiftType
    ? p.shiftType.charAt(0) + p.shiftType.slice(1).toLowerCase()
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      whileHover={{ y: -5, boxShadow: "0 12px 28px -6px rgba(0,0,0,0.10)" }}
      onClick={onClick}
      className={`relative ${theme.bg} border ${theme.border} rounded-xl p-5 cursor-pointer overflow-hidden group`}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-all duration-300 pointer-events-none rounded-xl" />

      <div className="relative space-y-3.5">

        {/* ── Top row: icon + name + badges ── */}
        <div className="flex items-start gap-3">
          {/* Project initial icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0 ${theme.icon}`}>
            {p.name[0]?.toUpperCase() ?? "P"}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 leading-tight truncate" title={p.name}>
              {p.name}
            </p>
            {/* Badges */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <StatusBadge status={p.status} />
              {p.projectType && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${theme.icon} ${theme.border}`}>
                  {PT_LABELS[p.projectType] ?? p.projectType}
                </span>
              )}
              {shiftLabel && (
                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/70 border border-slate-200 text-slate-500 font-medium">
                  <Clock3 size={9} /> {shiftLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Description ── */}
        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
          {p.description || "No description provided."}
        </p>

        {/* ── Meta info ── */}
        <div className="space-y-1.5">
          {(p.clientName || p.sourceCompany) && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Building2 size={11} className="flex-shrink-0 text-slate-400" />
              <span className="truncate">{p.clientName ?? p.sourceCompany}</span>
              {p.clientName && p.sourceCompany && p.clientName !== p.sourceCompany && (
                <span className="text-slate-300">· {p.sourceCompany}</span>
              )}
            </div>
          )}

          {(p.startDate || p.endDate) && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar size={11} className="flex-shrink-0" />
              <span>
                {p.startDate ? fmtDate(p.startDate) : "—"}
                <span className="mx-1 text-slate-300">→</span>
                {p.endDate ? fmtDate(p.endDate) : "Ongoing"}
              </span>
            </div>
          )}

          {p.location && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin size={11} className="flex-shrink-0" />
              <span className="truncate">{p.location}</span>
            </div>
          )}
        </div>

        {/* ── Divider ── */}
        <div className={`border-t ${theme.border}`} />

        {/* ── Footer: Members + PM ── */}
        <div
          className="flex items-center justify-between gap-2"
          onClick={(e) => e.stopPropagation()} /* prevent card nav when clicking avatars */
        >
          {/* Member avatars */}
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {visible.map((m, i) => (
                <MemberAvatar
                  key={m.id ?? i}
                  member={m}
                  colorCls={AVATAR_COLORS[i % AVATAR_COLORS.length]}
                />
              ))}
              {overflow > 0 && (
                <div className="w-7 h-7 rounded-full bg-white border-2 border-slate-200 text-slate-500 text-[10px] font-semibold flex items-center justify-center z-10">
                  +{overflow}
                </div>
              )}
            </div>

            {members.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Users size={10} />
                {members.length} member{members.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* PM chip */}
      {/* PM chip */}
{p.projectManager ? (
  <PMTooltip projectManager={p.projectManager} />
) : (
  <span className="text-[11px] text-slate-300 italic flex-shrink-0">
    No PM
  </span>
)}
        </div>

      </div>
    </motion.div>
  );
}

/* ════════════════════════════════
   Member Avatar with tooltip
════════════════════════════════ */
function MemberAvatar({ member, colorCls }: { member: Member; colorCls: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative z-10 hover:z-50"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Avatar circle */}
      <div
        className={`w-7 h-7 rounded-full ${colorCls} text-white text-[11px] font-bold flex items-center justify-center border-2 border-white cursor-default select-none transition-transform duration-150 hover:scale-110`}
      >
        {member.name[0]?.toUpperCase() ?? "?"}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
          >
            <div className="bg-slate-900 text-white rounded-lg px-3 py-2 shadow-xl min-w-max">
              <p className="text-xs font-semibold leading-tight">{member.name}</p>
              {(member.designation || member.role) && (
                <p className="text-[10px] text-slate-300 mt-0.5">
                  {member.designation ?? member.role}
                </p>
              )}
            </div>
            {/* Arrow */}
            <div className="flex justify-center -mt-1">
              <div className="w-2 h-2 bg-slate-900 rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── tiny helpers ─── */
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

const STATUS_BADGE_STYLES: Record<string, { cls: string; dot: string; label: string }> = {
  CREATED:   { cls: "bg-blue-50 text-blue-700",    dot: "bg-blue-400",    label: "Created"   },
  ACTIVE:    { cls: "bg-green-100 text-green-700",  dot: "bg-green-500",   label: "Active"    },
  INACTIVE:  { cls: "bg-slate-100 text-slate-500",  dot: "bg-slate-400",   label: "Inactive"  },
  COMPLETED: { cls: "bg-purple-50 text-purple-700", dot: "bg-purple-400",  label: "Completed" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.INACTIVE;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${meta.cls}`}>
      <span className={`w-1 h-1 rounded-full inline-block ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
