"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder, Calendar, Building2, MapPin,
  Search, Users, Clock3, Star,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { fmtDateOnly } from "@/lib/date";
import { ProjectsGridSkeleton } from "@/components/ui/skeletons";

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
  projectManagerId?: number | null;
};

const CARD_PALETTE = [
  { bg: "bg-indigo-100",  border: "border-indigo-300",  icon: "bg-indigo-200  text-indigo-800"  },
  { bg: "bg-violet-100",  border: "border-violet-300",  icon: "bg-violet-200  text-violet-800"  },
  { bg: "bg-sky-100",     border: "border-sky-300",     icon: "bg-sky-200     text-sky-800"     },
  { bg: "bg-teal-100",    border: "border-teal-300",    icon: "bg-teal-200    text-teal-800"    },
  { bg: "bg-emerald-100", border: "border-emerald-300", icon: "bg-emerald-200 text-emerald-800" },
  { bg: "bg-rose-100",    border: "border-rose-300",    icon: "bg-rose-200    text-rose-800"    },
  { bg: "bg-amber-100",   border: "border-amber-300",   icon: "bg-amber-200   text-amber-800"   },
  { bg: "bg-fuchsia-100", border: "border-fuchsia-300", icon: "bg-fuchsia-200 text-fuchsia-800" },
] as const;

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-sky-500",     "bg-teal-500",
  "bg-emerald-500","bg-rose-500",   "bg-amber-500",   "bg-fuchsia-500",
  "bg-orange-500", "bg-cyan-500",   "bg-pink-500",    "bg-purple-500",
] as const;

const PT_LABELS: Record<string, string> = {
  IMPLEMENTATION_GREENFIELD:  "Implementation",
  MIGRATION_BROWNFIELD:       "Migration",
  ROLLOUT:                    "Rollout",
  SUPPORT_MAINTENANCE:        "Support & Maintenance",
  UPGRADE_ENHANCEMENT:        "Upgrade / Enhancement",
  LANDSCAPE_TRANSFORMATION:   "Landscape Transformation",
  PROOF_OF_CONCEPT:           "Proof of Concept",
  INTEGRATION_INTERFACE:      "Integration",
  CUSTOM_DEVELOPMENT:         "Custom Development",
  DATA_ARCHIVING_CLEANSING:   "Data Archiving",
  SECURITY_AUTHORIZATION_GRC: "Security / GRC",
  CLOUD_HOSTING_MIGRATION:    "Cloud Migration",
};

const STATUS_BADGE: Record<string, { cls: string; dot: string; label: string }> = {
  CREATED:   { cls: "bg-blue-50 text-blue-700",    dot: "bg-blue-400",    label: "Created"   },
  ACTIVE:    { cls: "bg-green-100 text-green-700",  dot: "bg-green-500",   label: "Active"    },
  INACTIVE:  { cls: "bg-slate-100 text-slate-500",  dot: "bg-slate-400",   label: "Inactive"  },
  COMPLETED: { cls: "bg-purple-50 text-purple-700", dot: "bg-purple-400",  label: "Completed" },
};

const fmtDate = fmtDateOnly;

/* ═══════════════════════════════════════════ */
export default function ManagerProjectsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const meId = Number(session?.user?.id ?? 0);

  const [projects,     setProjects]     = useState<Project[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CREATED" | "ACTIVE" | "INACTIVE" | "COMPLETED">("ALL");

  useEffect(() => {
    apiFetch("/projects?join=members&join=projectManager&limit=200")
      .then((res) => setProjects(Array.isArray(res) ? res : res.data ?? []))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  /* projects where I am PM vs where I'm a member */
  const myPMProjects     = useMemo(() => projects.filter((p) => p.projectManagerId === meId), [projects, meId]);
  const memberProjects   = useMemo(() => projects.filter((p) => p.projectManagerId !== meId), [projects, meId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.clientName ?? "").toLowerCase().includes(q) ||
        (p.sourceCompany ?? "").toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [projects, search, statusFilter]);

  if (loading) return <ProjectsGridSkeleton />;
  if (error)   return <p className="text-red-500 p-4">{error}</p>;

  const activeCount    = projects.filter((p) => p.status === "ACTIVE").length;
  const completedCount = projects.filter((p) => p.status === "COMPLETED").length;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">My Projects</h1>
        <p className="text-sm text-slate-500 mt-1">
          {projects.length} project{projects.length !== 1 ? "s" : ""} &nbsp;·&nbsp;
          <span className="text-emerald-600 font-medium">{myPMProjects.length} as PM</span>
          {memberProjects.length > 0 && <span className="text-slate-400"> · {memberProjects.length} as member</span>}
          &nbsp;·&nbsp;
          <span className="text-green-600 font-medium">{activeCount} active</span>
          {completedCount > 0 && <span className="text-purple-600 font-medium"> · {completedCount} completed</span>}
        </p>
      </div>

      {/* ── Search + filter ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
          {(["ALL", "CREATED", "ACTIVE", "INACTIVE", "COMPLETED"] as const).map((s) => {
            const count = s === "ALL" ? projects.length : projects.filter((p) => p.status === s).length;
            const label = s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase();
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
            {search || statusFilter !== "ALL" ? "No projects match filters" : "No projects assigned"}
          </p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <AnimatePresence>
            {filtered.map((p, idx) => {
              const theme = CARD_PALETTE[p.id % CARD_PALETTE.length];
              const isMyPM = p.projectManagerId === meId;
              return (
                <ProjectCard
                  key={p.id}
                  project={p}
                  theme={theme}
                  index={idx}
                  isMyPM={isMyPM}
                  onClick={() => router.push(`/employee/projects/${p.id}`)}
                />
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

/* ── Project Card ── */
function ProjectCard({
  project: p, theme, index, isMyPM, onClick,
}: {
  project: Project;
  theme: typeof CARD_PALETTE[number];
  index: number;
  isMyPM: boolean;
  onClick: () => void;
}) {
  const members  = p.members ?? [];
  const visible  = members.slice(0, 4);
  const overflow = members.length - 4;

  const shiftLabel = p.shiftStartTime && p.shiftEndTime
    ? `${p.shiftStartTime.slice(0, 5)} – ${p.shiftEndTime.slice(0, 5)}`
    : p.shiftType
    ? p.shiftType.charAt(0) + p.shiftType.slice(1).toLowerCase()
    : null;

  const meta = STATUS_BADGE[p.status] ?? STATUS_BADGE.INACTIVE;

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
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-all duration-300 pointer-events-none rounded-xl" />

      <div className="relative space-y-3.5">

        {/* Top row */}
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0 ${theme.icon}`}>
            {p.name[0]?.toUpperCase() ?? "P"}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 leading-tight truncate" title={p.name}>
              {p.name}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {/* Status */}
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${meta.cls}`}>
                <span className={`w-1 h-1 rounded-full inline-block ${meta.dot}`} />
                {meta.label}
              </span>
              {/* PM badge */}
              {isMyPM && (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700">
                  <Star size={8} /> PM
                </span>
              )}
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

        {/* Description */}
        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
          {p.description || "No description provided."}
        </p>

        {/* Meta */}
        <div className="space-y-1.5">
          {(p.clientName || p.sourceCompany) && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Building2 size={11} className="flex-shrink-0 text-slate-400" />
              <span className="truncate">{p.clientName ?? p.sourceCompany}</span>
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

        {/* Divider */}
        <div className={`border-t ${theme.border}`} />

        {/* Footer: members */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {visible.map((m, i) => (
              <MemberAvatar key={m.id ?? i} member={m} colorCls={AVATAR_COLORS[i % AVATAR_COLORS.length]} />
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
      </div>
    </motion.div>
  );
}

/* ── Member Avatar ── */
function MemberAvatar({ member, colorCls }: { member: Member; colorCls: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-10 hover:z-50" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className={`w-7 h-7 rounded-full ${colorCls} text-white text-[11px] font-bold flex items-center justify-center border-2 border-white cursor-default select-none`}>
        {member.name[0]?.toUpperCase() ?? "?"}
      </div>
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
                <p className="text-[10px] text-slate-300 mt-0.5">{member.designation ?? member.role}</p>
              )}
            </div>
            <div className="flex justify-center -mt-1">
              <div className="w-2 h-2 bg-slate-900 rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
