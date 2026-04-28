"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Users, Clock, Calendar, User, Briefcase,
  AlertCircle, Pencil, X, Check, UserPlus, MapPin, Building2,
  Sun, Coffee, ListTodo, Plus, Trash2, CheckCircle2, Circle,
} from "lucide-react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";
import Combobox from "@/components/ui/Combobox";

type UserOption = { id: number; name: string; email: string; role: string; designation?: string };
type Member = UserOption;
type TimesheetEntry = { id: number; date: string; hours: number; description?: string; status: string; user?: { name: string } };
type TaskItem = {
  id: number;
  name: string;
  status: "ACTIVE" | "COMPLETED";
  projectId: number;
  createdAt: string;
  assignees?: UserOption[];
};

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
  /* new fields */
  startDate?: string | null;
  endDate?: string | null;
  sourceCompany?: string | null;
  clientName?: string | null;
  projectType?: string | null;
  shiftType?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  breakTime?: number | null;
  location?: string | null;
};

const PROJECT_TYPES = ["FIXED", "TIME_AND_MATERIAL", "RETAINER", "INTERNAL"] as const;
const SHIFT_TYPES   = ["MORNING", "AFTERNOON", "NIGHT", "FLEXIBLE"] as const;

const PT_LABELS: Record<string, string> = {
  FIXED: "Fixed Price", TIME_AND_MATERIAL: "Time & Material",
  RETAINER: "Retainer", INTERNAL: "Internal",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
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

  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [showPmModal, setShowPmModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskAssignModal, setTaskAssignModal] = useState<TaskItem | null>(null);

  const isAdmin = callerRole === "ADMIN" || callerRole === "SUPERADMIN";

  const loadProject = useCallback(async () => {
    const [proj, ts, taskRes] = await Promise.all([
      apiFetch(`/projects/${id}?join=projectManager&join=members&join=createdBy`),
      apiFetch(`/timesheets?filter=projectId||$eq||${id}&join=user&sort=date,DESC&limit=20`),
      apiFetch(`/tasks?filter=projectId||$eq||${id}&join=assignees&limit=100`),
    ]);
    setProject(proj);
    setTimesheets(Array.isArray(ts) ? ts : ts.data ?? []);
    setTasks(Array.isArray(taskRes) ? taskRes : taskRes.data ?? []);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setCallerRole(getCallerRole());
    loadProject()
      .catch((err) => setError(err.message ?? "Failed to load project."))
      .finally(() => setLoading(false));
  }, [id, loadProject]);

  const ensureUsers = async () => {
    if (allUsers.length) return;
    try {
      const res = await apiFetch("/users?limit=200");
      setAllUsers(Array.isArray(res) ? res : res.data ?? []);
    } catch (e) { console.error(e); }
  };

  const openPmModal      = async () => { await ensureUsers(); setShowPmModal(true); };
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
  const fmtDate = (d?: string | null) =>
    d ? format(new Date(d), "dd MMM yyyy") : "—";
  const fmtTime = (t?: string | null) => {
    if (!t) return "—";
    const [h, m] = t.split(":");
    const hour = parseInt(h, 10);
    return `${hour % 12 || 12}:${m} ${hour < 12 ? "AM" : "PM"}`;
  };

  return (
    <div className="space-y-6 max-w-5xl">
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
              {project.projectType && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                  {PT_LABELS[project.projectType] ?? project.projectType}
                </span>
              )}
            </div>
            {project.description && <p className="text-slate-500 mt-2 max-w-xl">{project.description}</p>}
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-600"
            >
              <Pencil size={13} /> Edit Details
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoCard icon={<Clock size={16} />}     label="Total Hours" value={`${totalHours}h`} />
        <InfoCard icon={<Users size={16} />}     label="Members"     value={String(project.members?.length ?? 0)} />
        <InfoCard icon={<Briefcase size={16} />} label="Timesheets"  value={String(timesheets.length)} />
        <InfoCard icon={<Calendar size={16} />}  label="Created"     value={project.createdAt ? format(new Date(project.createdAt), "MMM d, yyyy") : "—"} />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-1 space-y-5">

          {/* Project Info */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Project Info</p>

            <InfoRow label="Client" value={project.clientName} />
            <InfoRow label="Company" value={project.sourceCompany} />
            <InfoRow label="Location" value={project.location} icon={<MapPin size={12} />} />
            <InfoRow label="Start Date" value={fmtDate(project.startDate)} icon={<Calendar size={12} />} />
            <InfoRow label="End Date"   value={fmtDate(project.endDate)}   icon={<Calendar size={12} />} />

            {/* Shift block */}
            {(project.shiftType || project.shiftStartTime || project.shiftEndTime || project.breakTime != null) && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Shift</p>
                {project.shiftType && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-700">
                    <Sun size={12} className="text-amber-500" />
                    <span>{project.shiftType.charAt(0) + project.shiftType.slice(1).toLowerCase()}</span>
                  </div>
                )}
                {(project.shiftStartTime || project.shiftEndTime) && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-700">
                    <Clock size={12} className="text-slate-400" />
                    <span>{fmtTime(project.shiftStartTime)} – {fmtTime(project.shiftEndTime)}</span>
                  </div>
                )}
                {project.breakTime != null && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-700">
                    <Coffee size={12} className="text-slate-400" />
                    <span>Break: {project.breakTime} min</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Project Manager */}
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

          {/* Team Members */}
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
          {/* Tasks */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo size={13} className="text-slate-400" />
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tasks</p>
              </div>
              {isAdmin && (
                <button onClick={() => setShowAddTaskModal(true)}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  <Plus size={12} /> Add Task
                </button>
              )}
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-400 px-5 py-4">
                {isAdmin ? "Click Add Task to create tasks for this project." : "No tasks yet."}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {tasks.map((t) => {
                  const done = t.status === "COMPLETED";
                  return (
                    <div key={t.id} className={`px-5 py-3 flex items-center gap-3 ${done ? "opacity-60" : ""}`}>
                      {/* Status toggle (admin only) */}
                      {isAdmin ? (
                        <button
                          title={done ? "Mark Active" : "Mark Completed"}
                          onClick={async () => {
                            await apiFetch(`/tasks/${t.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({ status: done ? "ACTIVE" : "COMPLETED" }),
                            });
                            await loadProject();
                          }}
                          className="flex-shrink-0 hover:scale-110 transition"
                        >
                          {done
                            ? <CheckCircle2 size={16} className="text-green-500" />
                            : <Circle size={16} className="text-slate-300 hover:text-slate-400" />}
                        </button>
                      ) : (
                        <span className="flex-shrink-0">
                          {done ? <CheckCircle2 size={16} className="text-green-400" /> : <Circle size={16} className="text-slate-300" />}
                        </span>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${done ? "line-through text-slate-400" : "text-slate-900"}`}>{t.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {t.assignees?.length
                            ? `${t.assignees.map((a) => a.name).join(", ")}`
                            : "No assignees"}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => { ensureUsers(); setTaskAssignModal(t); }}
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                            Assign
                          </button>
                          <button onClick={async () => {
                            await apiFetch(`/tasks/${t.id}`, { method: "DELETE" });
                            await loadProject();
                          }} className="text-slate-300 hover:text-red-400 transition">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
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

      {/* Modals */}
      <AnimatePresence>
        {showPmModal && (
          <PmModal project={project} users={allUsers}
            onClose={() => setShowPmModal(false)}
            onSaved={async () => { setShowPmModal(false); await loadProject(); }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showMembersModal && (
          <MembersModal project={project} users={allUsers}
            onClose={() => setShowMembersModal(false)}
            onSaved={async () => { setShowMembersModal(false); await loadProject(); }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showEditModal && (
          <EditDetailsModal project={project}
            onClose={() => setShowEditModal(false)}
            onSaved={async () => { setShowEditModal(false); await loadProject(); }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAddTaskModal && (
          <AddTaskModal projectId={project.id}
            onClose={() => setShowAddTaskModal(false)}
            onSaved={async () => { setShowAddTaskModal(false); await loadProject(); }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {taskAssignModal && (
          <TaskAssignModal
            task={taskAssignModal}
            users={allUsers}
            onClose={() => setTaskAssignModal(null)}
            onSaved={async () => { setTaskAssignModal(null); await loadProject(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────
   Add Task Modal
───────────────────────────────────────── */
function AddTaskModal({ projectId, onClose, onSaved }: {
  projectId: number; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName]       = useState("");
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");

  const save = async () => {
    if (!name.trim()) { setErr("Task name is required."); return; }
    setSaving(true); setErr("");
    try {
      await apiFetch("/tasks", { method: "POST", body: JSON.stringify({ name: name.trim(), projectId }) });
      onSaved();
    } catch (e: any) { setErr(e.message ?? "Failed to create task."); setSaving(false); }
  };

  return (
    <Backdrop onClose={onClose}>
      <ModalBox>
        <ModalHeader title="Add Task" onClose={onClose} />
        <div className="px-6 py-4 space-y-3">
          <Field label="Task Name *">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="e.g. Implement login flow"
              className={INPUT} />
          </Field>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <ModalFooter onCancel={onClose} onSave={save} saving={saving} saveLabel="Create Task" />
      </ModalBox>
    </Backdrop>
  );
}

/* ─────────────────────────────────────────
   Task Assign Modal
───────────────────────────────────────── */
function TaskAssignModal({ task, users, onClose, onSaved }: {
  task: TaskItem; users: UserOption[]; onClose: () => void; onSaved: () => void;
}) {
  const currentIds = new Set((task.assignees ?? []).map((a) => a.id));
  const [selected, setSelected] = useState<Set<number>>(new Set(currentIds));
  const [search, setSearch]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );
  const toggle = (id: number) =>
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const save = async () => {
    setSaving(true); setErr("");
    try {
      const toAdd    = [...selected].filter((id) => !currentIds.has(id));
      const toRemove = [...currentIds].filter((id) => !selected.has(id));
      await Promise.all([
        ...toAdd.map((userId)    => apiFetch(`/tasks/${task.id}/assignees`, { method: "POST",   body: JSON.stringify({ userId }) })),
        ...toRemove.map((userId) => apiFetch(`/tasks/${task.id}/assignees/${userId}`, { method: "DELETE" })),
      ]);
      onSaved();
    } catch (e: any) { setErr(e.message ?? "Failed to update."); setSaving(false); }
  };

  return (
    <Backdrop onClose={onClose}>
      <ModalBox wide>
        <ModalHeader title={`Assign — ${task.name}`} onClose={onClose} />
        <div className="px-6 py-4 space-y-3">
          <input autoFocus placeholder="Search users…" value={search}
            onChange={(e) => setSearch(e.target.value)} className={INPUT} />
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
            {filtered.map((u) => {
              const checked = selected.has(u.id);
              return (
                <button key={u.id} onClick={() => toggle(u.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left ${checked ? "bg-indigo-50" : ""}`}>
                  <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${checked ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
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
          <p className="text-xs text-slate-400">{selected.size} assignee{selected.size !== 1 ? "s" : ""} selected</p>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <ModalFooter onCancel={onClose} onSave={save} saving={saving} saveLabel="Save Assignees" />
      </ModalBox>
    </Backdrop>
  );
}

/* ─────────────────────────────────────────
   Edit Details Modal
───────────────────────────────────────── */
function EditDetailsModal({ project, onClose, onSaved }: {
  project: Project; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name:           project.name ?? "",
    description:    project.description ?? "",
    status:         project.status ?? "ACTIVE",
    startDate:      project.startDate ?? "",
    endDate:        project.endDate ?? "",
    sourceCompany:  project.sourceCompany ?? "",
    clientName:     project.clientName ?? "",
    projectType:    project.projectType ?? "",
    shiftType:      project.shiftType ?? "",
    shiftStartTime: project.shiftStartTime?.slice(0, 5) ?? "",
    shiftEndTime:   project.shiftEndTime?.slice(0, 5) ?? "",
    breakTime:      project.breakTime != null ? String(project.breakTime) : "",
    location:       project.location ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setField = (k: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [k]: val }));

  const save = async () => {
    if (!form.name.trim()) { setErr("Project name is required."); return; }
    setSaving(true);
    setErr("");
    try {
      const body: Record<string, any> = {
        name:          form.name.trim(),
        description:   form.description.trim() || null,
        status:        form.status,
        startDate:     form.startDate || null,
        endDate:       form.endDate || null,
        sourceCompany: form.sourceCompany.trim() || null,
        clientName:    form.clientName.trim() || null,
        projectType:   form.projectType || null,
        shiftType:     form.shiftType || null,
        shiftStartTime: form.shiftStartTime || null,
        shiftEndTime:   form.shiftEndTime || null,
        breakTime:      form.breakTime !== "" ? Number(form.breakTime) : null,
        location:       form.location.trim() || null,
      };
      await apiFetch(`/projects/${project.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onSaved();
    } catch (e: any) {
      setErr(e.message ?? "Failed to save.");
      setSaving(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-xl flex flex-col max-h-[90vh]"
      >
        <ModalHeader title="Edit Project Details" onClose={onClose} />

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          <Section title="Basic Info">
            <Field label="Project Name *">
              <input value={form.name} onChange={set("name")} className={INPUT} />
            </Field>
            <Field label="Description">
              <textarea rows={2} value={form.description} onChange={set("description")}
                className={`${INPUT} resize-none`} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <Combobox value={form.status} onChange={setField("status")}
                  options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
              </Field>
              <Field label="Project Type">
                <Combobox value={form.projectType} onChange={setField("projectType")} placeholder="— None —"
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
                <input type="date" value={form.startDate} onChange={set("startDate")} className={INPUT} />
              </Field>
              <Field label="End Date">
                <input type="date" value={form.endDate} onChange={set("endDate")} className={INPUT} />
              </Field>
            </div>
          </Section>

          <Section title="Shift">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Shift Type">
                <Combobox value={form.shiftType} onChange={setField("shiftType")} placeholder="— None —"
                  options={[{ value: "", label: "None" }, ...SHIFT_TYPES.map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() }))]} />
              </Field>
              <Field label="Break Time (min)">
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

          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        <ModalFooter onCancel={onClose} onSave={save} saving={saving} saveLabel="Save Changes" />
      </motion.div>
    </Backdrop>
  );
}

/* ─────────────────────────────────────────
   PM Modal
───────────────────────────────────────── */
function PmModal({ project, users, onClose, onSaved }: {
  project: Project; users: UserOption[]; onClose: () => void; onSaved: () => void;
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
    setSaving(true); setErr("");
    try {
      await apiFetch(`/projects/${project.id}`, {
        method: "PATCH", body: JSON.stringify({ projectManagerId: selectedId }),
      });
      onSaved();
    } catch (e: any) { setErr(e.message ?? "Failed to update."); setSaving(false); }
  };

  return (
    <Backdrop onClose={onClose}>
      <ModalBox>
        <ModalHeader title="Change Project Manager" onClose={onClose} />
        <div className="px-6 py-4 space-y-3">
          <input autoFocus placeholder="Search by name or email…" value={search}
            onChange={(e) => setSearch(e.target.value)} className={INPUT} />
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
            <button onClick={() => setSelectedId(null)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left ${selectedId === null ? "bg-indigo-50" : ""}`}>
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <X size={14} className="text-slate-400" />
              </div>
              <span className="text-sm text-slate-500 italic">None — remove PM</span>
              {selectedId === null && <Check size={14} className="ml-auto text-indigo-600" />}
            </button>
            {filtered.map((u) => (
              <button key={u.id} onClick={() => setSelectedId(u.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left ${selectedId === u.id ? "bg-indigo-50" : ""}`}>
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
   Members Modal
───────────────────────────────────────── */
function MembersModal({ project, users, onClose, onSaved }: {
  project: Project; users: UserOption[]; onClose: () => void; onSaved: () => void;
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
    setSaving(true); setErr("");
    try {
      const toAdd    = [...selected].filter((id) => !currentIds.has(id));
      const toRemove = [...currentIds].filter((id) => !selected.has(id));
      await Promise.all([
        ...toAdd.map((userId)    => apiFetch(`/projects/${project.id}/members`, { method: "POST", body: JSON.stringify({ userId }) })),
        ...toRemove.map((userId) => apiFetch(`/projects/${project.id}/members/${userId}`, { method: "DELETE" })),
      ]);
      onSaved();
    } catch (e: any) { setErr(e.message ?? "Failed to update members."); setSaving(false); }
  };

  const selectedList = users.filter((u) => selected.has(u.id));

  return (
    <Backdrop onClose={onClose}>
      <ModalBox wide>
        <ModalHeader title="Manage Team Members" onClose={onClose} />
        <div className="px-6 py-4 space-y-4">
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
          <input autoFocus placeholder="Search users…" value={search}
            onChange={(e) => setSearch(e.target.value)} className={INPUT} />
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
            {filtered.map((u) => {
              const checked = selected.has(u.id);
              return (
                <button key={u.id} onClick={() => toggle(u.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left ${checked ? "bg-indigo-50" : ""}`}>
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

function InfoRow({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="text-slate-400 mt-0.5 flex-shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-sm text-slate-700 break-words">{value}</p>
      </div>
    </div>
  );
}

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
    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saving, saveLabel = "Save" }: {
  onCancel: () => void; onSave: () => void; saving: boolean; saveLabel?: string;
}) {
  return (
    <div className="px-6 pb-5 pt-3 border-t border-slate-100 flex gap-3 flex-shrink-0">
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
