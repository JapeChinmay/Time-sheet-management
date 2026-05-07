"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder, Calendar, Building2, MapPin,
  Search, Users, Clock3, Star, X, Plus, Trash2,
  Loader2, Check, UserPlus, Sliders,
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

type Responsibility = {
  userId: number;
  name: string;
  email: string;
  role: string;
  responsibility: number | null;
};

type AllUser = { id: number; name: string; email: string; role: string; designation?: string };

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

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-rose-100 text-rose-700",
  ADMIN: "bg-indigo-100 text-indigo-700",
  MANAGER: "bg-teal-100 text-teal-700",
  HR: "bg-pink-100 text-pink-700",
  INTERNAL: "bg-slate-100 text-slate-600",
  EXTERNAL: "bg-orange-100 text-orange-700",
  INTERN: "bg-amber-100 text-amber-700",
};

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
  const meId       = Number(session?.user?.id ?? 0);
  const callerRole = session?.user?.role ?? "";
  const isAdmin    = callerRole === "ADMIN" || callerRole === "SUPERADMIN";

  const [projects,     setProjects]     = useState<Project[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CREATED" | "ACTIVE" | "INACTIVE" | "COMPLETED">("ALL");

  /* member management modal */
  const [mgmtProject,    setMgmtProject]    = useState<Project | null>(null);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [allUsers,       setAllUsers]       = useState<AllUser[]>([]);
  const [userSearch,     setUserSearch]     = useState("");
  const [addingUserId,   setAddingUserId]   = useState<number | null>(null);
  const [removingId,     setRemovingId]     = useState<number | null>(null);
  const [savingResp,     setSavingResp]     = useState(false);
  const [mgmtLoading,    setMgmtLoading]    = useState(false);
  const [mgmtErr,        setMgmtErr]        = useState("");
  const [mgmtOk,         setMgmtOk]         = useState("");
  /* local edits to responsibility % */
  const [respEdits, setRespEdits] = useState<Record<number, string>>({});

  const loadProjects = () => {
    const url = isAdmin
      ? "/projects?join=members&join=projectManager&limit=200"
      : `/projects?filter=projectManagerId||$eq||${meId}&join=members&join=projectManager&limit=200`;
    return apiFetch(url)
      .then((res) => setProjects(Array.isArray(res) ? res : res.data ?? []))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (meId || isAdmin) loadProjects(); }, [meId, isAdmin]);

  /* open member management panel */
  const openMgmt = async (p: Project) => {
    setMgmtProject(p);
    setMgmtErr("");
    setMgmtOk("");
    setUserSearch("");
    setRespEdits({});
    setMgmtLoading(true);
    try {
      const [resp, uRes] = await Promise.all([
        apiFetch(`/projects/${p.id}/members/responsibilities`),
        apiFetch("/users?limit=300&sort=name,ASC"),
      ]);
      setResponsibilities(Array.isArray(resp) ? resp : []);
      setAllUsers(Array.isArray(uRes) ? uRes : uRes.data ?? []);
      const edits: Record<number, string> = {};
      (Array.isArray(resp) ? resp : []).forEach((r: Responsibility) => {
        edits[r.userId] = r.responsibility != null ? String(r.responsibility) : "";
      });
      setRespEdits(edits);
    } catch (e: any) {
      setMgmtErr(e.message ?? "Failed to load members");
    } finally {
      setMgmtLoading(false);
    }
  };

  const addMember = async (userId: number) => {
    if (!mgmtProject) return;
    setAddingUserId(userId);
    setMgmtErr("");
    try {
      await apiFetch(`/projects/${mgmtProject.id}/members`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      const resp = await apiFetch(`/projects/${mgmtProject.id}/members/responsibilities`);
      const list: Responsibility[] = Array.isArray(resp) ? resp : [];
      setResponsibilities(list);
      const edits: Record<number, string> = { ...respEdits };
      list.forEach((r) => { if (!(r.userId in edits)) edits[r.userId] = ""; });
      setRespEdits(edits);
      await loadProjects();
    } catch (e: any) {
      setMgmtErr(e.message ?? "Failed to add member");
    } finally {
      setAddingUserId(null);
    }
  };

  const removeMember = async (userId: number) => {
    if (!mgmtProject) return;
    setRemovingId(userId);
    setMgmtErr("");
    try {
      await apiFetch(`/projects/${mgmtProject.id}/members/${userId}`, { method: "DELETE" });
      setResponsibilities((prev) => prev.filter((r) => r.userId !== userId));
      setRespEdits((prev) => { const e = { ...prev }; delete e[userId]; return e; });
      await loadProjects();
    } catch (e: any) {
      setMgmtErr(e.message ?? "Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  const saveResponsibilities = async () => {
    if (!mgmtProject) return;
    setSavingResp(true);
    setMgmtErr("");
    setMgmtOk("");
    try {
      const items = responsibilities.map((r) => ({
        userId: r.userId,
        responsibility: respEdits[r.userId] !== "" ? Number(respEdits[r.userId]) : null,
      })).filter((i) => i.responsibility !== null) as { userId: number; responsibility: number }[];

      await apiFetch(`/projects/${mgmtProject.id}/members/responsibilities`, {
        method: "PATCH",
        body: JSON.stringify({ items }),
      });
      setMgmtOk("Saved!");
      setTimeout(() => setMgmtOk(""), 2000);
    } catch (e: any) {
      setMgmtErr(e.message ?? "Failed to save");
    } finally {
      setSavingResp(false);
    }
  };

  /* projects where I am PM vs where I'm a member */
  const myPMProjects   = useMemo(() => projects.filter((p) => p.projectManagerId === meId), [projects, meId]);
  const memberProjects = useMemo(() => projects.filter((p) => p.projectManagerId !== meId), [projects, meId]);

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

  /* users not yet in the project */
  const memberIds    = new Set(responsibilities.map((r) => r.userId));
  const addableUsers = allUsers.filter(
    (u) => !memberIds.has(u.id) &&
      (!userSearch.trim() ||
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()))
  );

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
              const isMyPM    = Number(p.projectManagerId) === meId;
              const canManage = isMyPM || isAdmin;
              return (
                <ProjectCard
                  key={p.id}
                  project={p}
                  theme={theme}
                  index={idx}
                  isMyPM={isMyPM}
                  onClick={() => router.push(`/employee/projects/${p.id}`)}
                  onManageMembers={canManage ? (e) => { e.stopPropagation(); openMgmt(p); } : undefined}
                />
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ══ MEMBER MANAGEMENT MODAL ══ */}
      <AnimatePresence>
        {mgmtProject && (
          <motion.div
            className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setMgmtProject(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                    <Users size={14} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Manage Members</h3>
                    <p className="text-xs text-slate-400 truncate max-w-[260px]">{mgmtProject.name}</p>
                  </div>
                </div>
                <button onClick={() => setMgmtProject(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {mgmtLoading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
                    <Loader2 size={18} className="animate-spin" /> Loading…
                  </div>
                ) : (
                  <>
                    {/* ── Current members ── */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                          <Sliders size={12} /> Current Members &amp; Allocation
                        </p>
                        <span className="text-[11px] text-slate-400">{responsibilities.length} member{responsibilities.length !== 1 ? "s" : ""}</span>
                      </div>

                      {responsibilities.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-xl">
                          No members yet. Add someone below.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {responsibilities.map((r, i) => (
                            <div key={r.userId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className={`w-8 h-8 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0`}>
                                {r.name[0]?.toUpperCase() ?? "?"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{r.name}</p>
                                <p className="text-xs text-slate-400 truncate">{r.email}</p>
                              </div>
                              {/* Allocation % input */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={5}
                                  value={respEdits[r.userId] ?? ""}
                                  onChange={(e) => setRespEdits((prev) => ({ ...prev, [r.userId]: e.target.value }))}
                                  placeholder="—"
                                  className="w-16 border border-slate-200 px-2 py-1 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-violet-500/30 bg-white"
                                />
                                <span className="text-xs text-slate-400">%</span>
                              </div>
                              <button
                                onClick={() => removeMember(r.userId)}
                                disabled={removingId === r.userId}
                                className="p-1.5 text-slate-300 hover:text-red-500 transition disabled:opacity-40 flex-shrink-0"
                                title="Remove member"
                              >
                                {removingId === r.userId
                                  ? <Loader2 size={13} className="animate-spin" />
                                  : <Trash2 size={13} />
                                }
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {responsibilities.length > 0 && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={saveResponsibilities}
                            disabled={savingResp}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 transition disabled:opacity-50"
                          >
                            {savingResp
                              ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
                              : mgmtOk
                              ? <><Check size={12} /> Saved!</>
                              : <><Check size={12} /> Save Allocation</>
                            }
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ── Add members ── */}
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <UserPlus size={12} /> Add Member
                      </p>
                      <div className="relative mb-2">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          placeholder="Search users…"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                        />
                        {userSearch && (
                          <button onClick={() => setUserSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto">
                        {addableUsers.length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-6">
                            {userSearch ? "No users match search" : "All users already added"}
                          </p>
                        ) : addableUsers.map((u) => (
                          <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                              {u.name[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                              <p className="text-xs text-slate-400 truncate">{u.designation ?? u.email}</p>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${ROLE_COLORS[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                              {u.role}
                            </span>
                            <button
                              onClick={() => addMember(u.id)}
                              disabled={addingUserId === u.id}
                              className="flex items-center gap-1 px-2.5 py-1 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 transition disabled:opacity-50 flex-shrink-0"
                            >
                              {addingUserId === u.id
                                ? <Loader2 size={11} className="animate-spin" />
                                : <Plus size={11} />
                              }
                              Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {mgmtErr && (
                      <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{mgmtErr}</p>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 pt-3 border-t border-slate-100 flex-shrink-0">
                <button
                  onClick={() => setMgmtProject(null)}
                  className="w-full border border-slate-200 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Project Card ── */
function ProjectCard({
  project: p, theme, index, isMyPM, onClick, onManageMembers,
}: {
  project: Project;
  theme: typeof CARD_PALETTE[number];
  index: number;
  isMyPM: boolean;
  onClick: () => void;
  onManageMembers?: (e: React.MouseEvent) => void;
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

        {/* Footer: members + manage button */}
        <div className="flex items-center justify-between gap-2">
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

          {/* Manage members button — PM only */}
          {onManageMembers && (
            <button
              onClick={onManageMembers}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-white/70 border border-slate-200 text-violet-700 font-medium hover:bg-violet-50 hover:border-violet-300 transition flex-shrink-0"
            >
              <UserPlus size={11} /> Manage
            </button>
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
