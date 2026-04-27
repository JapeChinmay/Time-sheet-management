"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Users, Clock, Calendar, User, Briefcase,
  AlertCircle, Pencil, X, Check, UserPlus, ChevronDown, Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";

type UserOption = { id: number; name: string; email: string; role: string; designation?: string };
type Member = UserOption;
type TimesheetEntry = { id: number; date: string; hours: number; description?: string; status: string; user?: { name: string } };
type Project = {
  id: number;
  name: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  projectManagerId?: number | null;
  projectManager?: UserOption;
  createdBy?: { name: string };
  members?: Member[];
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

const ROLE_COLORS: Record<string, string> = {
  INTERNAL: "bg-indigo-50 text-indigo-700",
  EXTERNAL: "bg-violet-50 text-violet-700",
  ADMIN: "bg-slate-100 text-slate-700",
  SUPERADMIN: "bg-slate-800 text-white",
};

function getCallerRole(): string {
  try { return JSON.parse(atob(localStorage.getItem("token")!.split(".")[1])).role ?? ""; }
  catch { return ""; }
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [callerRole, setCallerRole] = useState("");

  /* admin-only state */
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [showPmModal, setShowPmModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);

  const isAdmin = callerRole === "ADMIN" || callerRole === "SUPERADMIN";

  const loadProject = useCallback(async () => {
    const [proj, ts] = await Promise.all([
      apiFetch(`/projects/${id}?join=projectManager&join=members&join=createdBy`),
      apiFetch(`/timesheets?filter=projectId||$eq||${id}&join=user&sort=date,DESC&limit=20`),
    ]);
    setProject(proj);
    setTimesheets(Array.isArray(ts) ? ts : ts.data ?? []);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const role = getCallerRole();
    setCallerRole(role);
    loadProject()
      .catch((err) => setError(err.message ?? "Failed to load project."))
      .finally(() => setLoading(false));
  }, [id, loadProject]);

  /* load all users only when an admin opens an edit modal */
  const ensureUsers = async () => {
    if (allUsers.length) return;
    try {
      const res = await apiFetch("/users?limit=200");
      setAllUsers(Array.isArray(res) ? res : res.data ?? []);
    } catch (e) { console.error(e); }
  };

  const openPmModal = async () => { await ensureUsers(); setShowPmModal(true); };
  const openMembersModal = async () => { await ensureUsers(); setShowMembersModal(true); };

  if (loading) return <Loader />;
  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-red-400" />
        <p className="font-medium">{error || "Project not found."}</p>
        <button onClick={() => router.back()} className="text-sm text-indigo-600 hover:underline">Go back</button>
      </div>
    );
  }

  const totalHours = timesheets.reduce((s, t) => s + t.hours, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + header */}
      <div>
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition mb-4">
          <ArrowLeft size={15} /> Back to Projects
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            {project.description && <p className="text-slate-500 mt-2 max-w-xl">{project.description}</p>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoCard icon={<Clock size={16} />} label="Total Hours" value={`${totalHours}h`} />
        <InfoCard icon={<Users size={16} />} label="Members" value={String(project.members?.length ?? 0)} />
        <InfoCard icon={<Briefcase size={16} />} label="Timesheets" value={String(timesheets.length)} />
        <InfoCard icon={<Calendar size={16} />} label="Created" value={project.createdAt ? format(new Date(project.createdAt), "MMM d, yyyy") : "—"} />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-1 space-y-5">

          {/* Project Manager card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Project Manager</p>
              {isAdmin && (
                <button onClick={openPmModal} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  <Pencil size={11} /> Change
                </button>
              )}
            </div>
            {project.projectManager ? (
              <div className="flex items-center gap-3">
                <Avatar name={project.projectManager.name} size="md" dark />
                <div>
                  <p className="font-medium text-slate-900 text-sm">{project.projectManager.name}</p>
                  <p className="text-xs text-slate-400">{project.projectManager.designation ?? project.projectManager.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">{isAdmin ? "Click Change to assign." : "Not assigned"}</p>
            )}
          </div>

          {/* Created by */}
          {project.createdBy && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Created By</p>
              <div className="flex items-center gap-2">
                <User size={14} className="text-slate-400" />
                <p className="text-sm text-slate-700">{project.createdBy.name}</p>
              </div>
            </div>
          )}

          {/* Team Members card */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Team Members</p>
              {isAdmin && (
                <button onClick={openMembersModal} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  <UserPlus size={12} /> Manage
                </button>
              )}
            </div>
            {!project.members?.length ? (
              <p className="text-sm text-slate-400 px-5 py-4">{isAdmin ? "Click Manage to add members." : "No members assigned."}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {project.members.map((m) => (
                  <div key={m.id} className="px-5 py-3 flex items-center gap-3">
                    <Avatar name={m.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{m.name}</p>
                      {m.designation && <p className="text-xs text-slate-400 truncate">{m.designation}</p>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[m.role] ?? "bg-slate-100 text-slate-600"}`}>
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: timesheets */}
        <div className="md:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Recent Timesheet Entries</p>
            </div>
            {timesheets.length === 0 ? (
              <div className="px-5 py-12 text-center text-slate-400">
                <Clock size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No timesheet entries yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {timesheets.map((t) => (
                  <div key={t.id} className="px-5 py-3.5 flex items-center gap-4">
                    <div className="flex-shrink-0 text-center w-10">
                      <p className="text-lg font-bold text-slate-900 leading-none">{format(new Date(t.date), "d")}</p>
                      <p className="text-[10px] text-slate-400">{format(new Date(t.date), "MMM")}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{t.user?.name ?? "—"}</p>
                      {t.description && <p className="text-xs text-slate-400 truncate mt-0.5">{t.description}</p>}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_COLORS[t.status] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>
                      {t.status}
                    </span>
                    <span className="text-sm font-semibold text-slate-700 w-10 text-right">{t.hours}h</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── PM Modal ── */}
      <AnimatePresence>
        {showPmModal && (
          <PmModal
            project={project}
            users={allUsers}
            onClose={() => setShowPmModal(false)}
            onSaved={async () => { setShowPmModal(false); await loadProject(); }}
          />
        )}
      </AnimatePresence>

      {/* ── Members Modal ── */}
      <AnimatePresence>
        {showMembersModal && (
          <MembersModal
            project={project}
            users={allUsers}
            onClose={() => setShowMembersModal(false)}
            onSaved={async () => { setShowMembersModal(false); await loadProject(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────
   PM Modal — select one user as PM
───────────────────────────────────────── */
function PmModal({ project, users, onClose, onSaved }: {
  project: Project;
  users: UserOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(project.projectManager?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      await apiFetch(`/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ projectManagerId: selectedId }),
      });
      onSaved();
    } catch (e: any) {
      setErr(e.message ?? "Failed to update.");
      setSaving(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <ModalBox>
        <ModalHeader title="Change Project Manager" onClose={onClose} />
        <div className="px-6 py-4 space-y-3">
          <input
            autoFocus
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
            {/* None option */}
            <button
              onClick={() => setSelectedId(null)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left ${selectedId === null ? "bg-indigo-50" : ""}`}
            >
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <X size={14} className="text-slate-400" />
              </div>
              <span className="text-sm text-slate-500 italic">None — remove PM</span>
              {selectedId === null && <Check size={14} className="ml-auto text-indigo-600" />}
            </button>
            {filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedId(u.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left ${selectedId === u.id ? "bg-indigo-50" : ""}`}
              >
                <Avatar name={u.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                  <p className="text-xs text-slate-400 truncate">{u.designation ?? u.email}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_COLORS[u.role] ?? "bg-slate-100 text-slate-600"}`}>{u.role}</span>
                {selectedId === u.id && <Check size={14} className="ml-2 text-indigo-600 flex-shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">No users found.</p>}
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <ModalFooter onCancel={onClose} onSave={save} saving={saving} />
      </ModalBox>
    </Backdrop>
  );
}

/* ─────────────────────────────────────────
   Members Modal — add / remove members
───────────────────────────────────────── */
function MembersModal({ project, users, onClose, onSaved }: {
  project: Project;
  users: UserOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const currentIds = new Set((project.members ?? []).map((m) => m.id));
  const [selected, setSelected] = useState<Set<number>>(new Set(currentIds));
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: number) =>
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      /* members to add = in selected but not in current */
      const toAdd = [...selected].filter((id) => !currentIds.has(id));
      /* members to remove = in current but not in selected */
      const toRemove = [...currentIds].filter((id) => !selected.has(id));

      await Promise.all([
        ...toAdd.map((userId) =>
          apiFetch(`/projects/${project.id}/members`, {
            method: "POST",
            body: JSON.stringify({ userId }),
          })
        ),
        ...toRemove.map((userId) =>
          apiFetch(`/projects/${project.id}/members/${userId}`, { method: "DELETE" })
        ),
      ]);
      onSaved();
    } catch (e: any) {
      setErr(e.message ?? "Failed to update members.");
      setSaving(false);
    }
  };

  const selectedList = users.filter((u) => selected.has(u.id));

  return (
    <Backdrop onClose={onClose}>
      <ModalBox wide>
        <ModalHeader title="Manage Team Members" onClose={onClose} />
        <div className="px-6 py-4 space-y-4">
          {/* Selected chips */}
          {selectedList.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedList.map((u) => (
                <span key={u.id} className="flex items-center gap-1.5 pl-2 pr-1 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-700">
                  {u.name}
                  <button onClick={() => toggle(u.id)} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-300 transition">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <input
            autoFocus
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
            {filtered.map((u) => {
              const checked = selected.has(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggle(u.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left ${checked ? "bg-indigo-50" : ""}`}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition ${checked ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
                    {checked && <Check size={10} className="text-white" />}
                  </div>
                  <Avatar name={u.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                    <p className="text-xs text-slate-400 truncate">{u.designation ?? u.email}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_COLORS[u.role] ?? "bg-slate-100 text-slate-600"}`}>{u.role}</span>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">No users found.</p>}
          </div>

          <p className="text-xs text-slate-400">{selected.size} member{selected.size !== 1 ? "s" : ""} selected</p>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <ModalFooter onCancel={onClose} onSave={save} saving={saving} saveLabel="Save Members" />
      </ModalBox>
    </Backdrop>
  );
}

/* ─────────────────────────────────────────
   Shared primitives
───────────────────────────────────────── */
function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </motion.div>
  );
}

function ModalBox({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
      className={`bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden w-full ${wide ? "max-w-lg" : "max-w-md"}`}
    >
      {children}
    </motion.div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saving, saveLabel = "Save" }: {
  onCancel: () => void; onSave: () => void; saving: boolean; saveLabel?: string;
}) {
  return (
    <div className="px-6 pb-5 flex gap-3">
      <button onClick={onSave} disabled={saving}
        className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-60">
        {saving ? "Saving…" : saveLabel}
      </button>
      <button onClick={onCancel} className="flex-1 border border-slate-200 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition">
        Cancel
      </button>
    </div>
  );
}

function Avatar({ name, size, dark }: { name: string; size: "sm" | "md"; dark?: boolean }) {
  const sz = size === "md" ? "w-9 h-9 text-sm" : "w-8 h-8 text-xs";
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${dark ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div key={i} className="w-2 h-2 bg-slate-400 rounded-full"
            animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
        ))}
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
      <div className="text-slate-400">{icon}</div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return status === "ACTIVE"
    ? <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Active</span>
    : <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">Inactive</span>;
}
