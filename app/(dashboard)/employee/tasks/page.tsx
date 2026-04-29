"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListTodo, CheckCircle2, Circle, Folder, Users,
  Calendar, Search, X, ChevronRight, Plus, Loader2,
  Clock, PauseCircle, AlertTriangle, ChevronDown,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";
import Combobox from "@/components/ui/Combobox";
import { parseUTC, fmtDate } from "@/lib/date";

/* ─── types ─── */
type TaskStatus =
  | "CREATED"
  | "ASSIGNED"
  | "WORK_IN_PROGRESS"
  | "ON_HOLD"
  | "EXTERNAL_DEPENDENCY"
  | "COMPLETED";

type Assignee = { id: number; name: string; email: string; role: string; designation?: string };
type Task = {
  id: number;
  name: string;
  status: TaskStatus;
  module?: string | null;
  projectId: number;
  createdAt: string;
  project?: { id: number; name: string };
  assignees?: Assignee[];
};
type Project = { id: number; name: string };
type User    = { id: number; name: string; email: string; role: string; designation?: string; module?: string | null };

/* ─── status meta ─── */
type StatusMeta = { label: string; badge: string; dot: string };
const STATUS_META: Record<TaskStatus, StatusMeta> = {
  CREATED:             { label: "Created",             badge: "bg-slate-100 text-slate-600 border-slate-200",   dot: "bg-slate-400"  },
  ASSIGNED:            { label: "Assigned",            badge: "bg-blue-50 text-blue-700 border-blue-200",       dot: "bg-blue-500"   },
  WORK_IN_PROGRESS:    { label: "In Progress",         badge: "bg-amber-50 text-amber-700 border-amber-200",    dot: "bg-amber-500"  },
  ON_HOLD:             { label: "On Hold",             badge: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  EXTERNAL_DEPENDENCY: { label: "Ext. Dependency",     badge: "bg-red-50 text-red-700 border-red-200",          dot: "bg-red-500"    },
  COMPLETED:           { label: "Completed",           badge: "bg-green-50 text-green-700 border-green-200",    dot: "bg-green-500"  },
};

const ALL_STATUSES: TaskStatus[] = [
  "CREATED", "ASSIGNED", "WORK_IN_PROGRESS", "ON_HOLD", "EXTERNAL_DEPENDENCY", "COMPLETED",
];

/* ─── SAP modules ─── */
const SAP_MODULES = [
  { value: "SAP_BTP",  label: "SAP BTP"  },
  { value: "SAP_MM",   label: "SAP MM"   },
  { value: "SAP_FICO", label: "SAP FICO" },
  { value: "SAP_SF",   label: "SAP SF"   },
  { value: "SAP_SD",   label: "SAP SD"   },
  { value: "SAP_HCM",  label: "SAP HCM"  },
  { value: "SAP_ABAP", label: "SAP ABAP" },
  { value: "SAP_PS",   label: "SAP PS"   },
] as const;
const MODULE_LABEL: Record<string, string> = Object.fromEntries(SAP_MODULES.map((m) => [m.value, m.label]));

type Filter = "ALL" | TaskStatus;

function getCallerRole(): string {
  try { return JSON.parse(atob(localStorage.getItem("token")!.split(".")[1])).role ?? ""; }
  catch { return ""; }
}
function getUser() {
  try { return JSON.parse(atob(localStorage.getItem("token")!.split(".")[1])); }
  catch { return { name: "User" }; }
}

/* ─── status icon helper ─── */
function StatusIcon({ status, size = 20 }: { status: TaskStatus; size?: number }) {
  if (status === "COMPLETED")           return <CheckCircle2 size={size} className="text-green-500" />;
  if (status === "WORK_IN_PROGRESS")    return <Clock        size={size} className="text-amber-500" />;
  if (status === "ON_HOLD")             return <PauseCircle  size={size} className="text-orange-500" />;
  if (status === "EXTERNAL_DEPENDENCY") return <AlertTriangle size={size} className="text-red-500" />;
  if (status === "ASSIGNED")            return <Circle       size={size} className="text-blue-400" />;
  return                                       <Circle       size={size} className="text-slate-300" />;
}

/* ─── inline status picker (admin only) ─── */
function StatusPicker({
  taskId,
  current,
  onChanged,
}: {
  taskId: number;
  current: TaskStatus;
  onChanged: (id: number, next: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const choose = async (next: TaskStatus) => {
    if (next === current) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    try {
      await apiFetch(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      onChanged(taskId, next);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const meta = STATUS_META[current];

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={saving}
        className={`flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-medium border cursor-pointer hover:opacity-80 transition ${meta.badge}`}
      >
        {saving
          ? <Loader2 size={10} className="animate-spin" />
          : <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        }
        {meta.label}
        <ChevronDown size={10} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1     }}
            exit={{ opacity: 0,  y: 4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden w-52"
          >
            {ALL_STATUSES.map((s) => {
              const m = STATUS_META[s];
              return (
                <button
                  key={s}
                  onClick={() => choose(s)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 transition text-left ${s === current ? "bg-slate-50 font-semibold" : ""}`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.dot}`} />
                  {m.label}
                  {s === current && <span className="ml-auto text-[10px] text-slate-400">current</span>}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<Filter>("ALL");
  const [search, setSearch]     = useState("");
  const [callerRole, setCallerRole] = useState("");

  /* create task modal */
  const [showCreate, setShowCreate]   = useState(false);
  const [projects, setProjects]       = useState<Project[]>([]);
  const [users, setUsers]             = useState<User[]>([]);
  const [createForm, setCreateForm]   = useState({ projectId: "", name: "", module: "" });
  const [selectedAssignees, setSelectedAssignees] = useState<Set<number>>(new Set());
  const [userSearch, setUserSearch]   = useState("");
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState("");

  const isAdmin = callerRole === "ADMIN" || callerRole === "SUPERADMIN";

  const loadTasks = async () => {
    try {
      const res = await apiFetch("/tasks?join=project&join=assignees&limit=500&sort=createdAt,DESC");
      setTasks(Array.isArray(res) ? res : res.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    setCallerRole(getCallerRole());
    loadTasks();
  }, []);

  /* status changed via picker */
  const handleStatusChanged = (id: number, next: TaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: next } : t));
  };

  /* ── Create task helpers ── */
  const openCreateModal = async () => {
    setCreateForm({ projectId: "", name: "", module: "" });
    setSelectedAssignees(new Set());
    setUserSearch("");
    setCreateError("");
    try {
      const [pRes, uRes] = await Promise.all([
        apiFetch("/projects?limit=200&sort=name,ASC"),
        apiFetch("/users?limit=200&sort=name,ASC"),
      ]);
      setProjects(Array.isArray(pRes) ? pRes : pRes.data ?? []);
      setUsers(Array.isArray(uRes) ? uRes : uRes.data ?? []);
    } catch (e) { console.error(e); }
    setShowCreate(true);
  };

  const toggleAssignee = (userId: number) => {
    setSelectedAssignees((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const submitCreate = async () => {
    if (!createForm.projectId) { setCreateError("Please select a project."); return; }
    if (!createForm.name.trim()) { setCreateError("Please enter a task name."); return; }
    setCreating(true);
    setCreateError("");
    try {
      const body: Record<string, unknown> = {
        name: createForm.name.trim(),
        projectId: Number(createForm.projectId),
      };
      if (createForm.module) body.module = createForm.module;
      const task: Task = await apiFetch("/tasks", { method: "POST", body: JSON.stringify(body) });
      await Promise.all(
        [...selectedAssignees].map((userId) =>
          apiFetch(`/tasks/${task.id}/assignees`, { method: "POST", body: JSON.stringify({ userId }) })
        )
      );
      setShowCreate(false);
      await loadTasks();
    } catch (err: unknown) {
      setCreateError((err as { message?: string }).message ?? "Failed to create task.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <SmartLoader name={getUser().name} />;

  /* ── derived counts ── */
  const countByStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s).length;
  const openCnt      = tasks.filter((t) => t.status !== "COMPLETED").length;
  const completedCnt = countByStatus("COMPLETED");
  const totalCnt     = tasks.length;
  const pct          = totalCnt > 0 ? Math.round((completedCnt / totalCnt) * 100) : 0;

  const filtered = tasks.filter((t) => {
    if (filter !== "ALL" && t.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.project?.name.toLowerCase().includes(q) ||
        t.assignees?.some((a) => a.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const moduleFilteredUsers = createForm.module
    ? users.filter((u) => u.module === createForm.module)
    : users;
  const filteredUsers = moduleFilteredUsers.filter(
    (u) => !userSearch.trim() ||
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const ROLE_COLORS: Record<string, string> = {
    SUPERADMIN: "bg-rose-100 text-rose-700",
    ADMIN:      "bg-indigo-100 text-indigo-700",
    INTERNAL:   "bg-slate-100 text-slate-600",
    EXTERNAL:   "bg-orange-100 text-orange-700",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500 mt-1">All tasks across your projects</p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition"
          >
            <Plus size={15} /> New Task
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total"       value={totalCnt}     colorClass="bg-slate-100 text-slate-600"    icon={<ListTodo   size={15} />} />
        <SummaryCard label="Open"        value={openCnt}      colorClass="bg-indigo-100 text-indigo-600"  icon={<Circle     size={15} />} />
        <SummaryCard label="In Progress" value={countByStatus("WORK_IN_PROGRESS")} colorClass="bg-amber-100 text-amber-700" icon={<Clock size={15} />} />
        <SummaryCard label="Completed"   value={completedCnt} colorClass="bg-green-100 text-green-600"    icon={<CheckCircle2 size={15} />} />
      </div>

      {/* Progress bar */}
      {totalCnt > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">Overall completion</p>
            <p className="text-sm font-bold text-slate-900">{pct}%</p>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div className="h-full bg-green-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{completedCnt} of {totalCnt} tasks completed</p>
        </div>
      )}

      {/* Status filter tabs + search */}
      <div className="space-y-3">
        {/* Scrollable status pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {(["ALL", ...ALL_STATUSES] as Filter[]).map((f) => {
            const cnt = f === "ALL" ? totalCnt : countByStatus(f as TaskStatus);
            const meta = f !== "ALL" ? STATUS_META[f as TaskStatus] : null;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  filter === f
                    ? "bg-slate-900 text-white border-slate-900 shadow"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {meta && filter !== f && (
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                )}
                {f === "ALL" ? "All" : STATUS_META[f as TaskStatus].label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  filter === f ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, projects, assignees…"
            className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <ListTodo size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No tasks found</p>
          <p className="text-sm mt-1">Try a different filter or search term.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <AnimatePresence initial={false}>
            {filtered.map((task, i) => {
              const done = task.status === "COMPLETED";
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2) }}
                  className={`flex items-start gap-4 px-5 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition group ${done ? "opacity-60" : ""}`}
                >
                  {/* Status icon */}
                  <div className="mt-0.5 flex-shrink-0">
                    <StatusIcon status={task.status} size={19} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium text-slate-900 ${done ? "line-through text-slate-400" : ""}`}>
                      {task.name}
                    </p>

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {task.project && (
                        <span
                          onClick={() => router.push(`/employee/projects/${task.projectId}`)}
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:underline cursor-pointer"
                        >
                          <Folder size={11} /> {task.project.name}
                        </span>
                      )}

                      {task.module && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                          {MODULE_LABEL[task.module] ?? task.module}
                        </span>
                      )}

                      {(task.assignees?.length ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Users size={11} />
                          {task.assignees!.map((a) => a.name).join(", ")}
                        </span>
                      )}

                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Calendar size={11} />
                        {fmtDate(parseUTC(task.createdAt))}
                      </span>
                    </div>
                  </div>

                  {/* Status picker (admin) or static badge (others) */}
                  {isAdmin ? (
                    <StatusPicker
                      taskId={task.id}
                      current={task.status}
                      onChanged={handleStatusChanged}
                    />
                  ) : (
                    <span className={`flex-shrink-0 flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${STATUS_META[task.status].badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[task.status].dot}`} />
                      {STATUS_META[task.status].label}
                    </span>
                  )}

                  <button
                    onClick={() => router.push(`/employee/projects/${task.projectId}`)}
                    className="flex-shrink-0 text-slate-300 hover:text-slate-500 transition mt-0.5"
                    title="Open project"
                  >
                    <ChevronRight size={16} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ══════ CREATE TASK MODAL ══════ */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="font-semibold text-slate-900">Create Task</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Add a new task and assign team members</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                {/* Project */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    Project <span className="text-red-400">*</span>
                  </label>
                  <Combobox
                    value={createForm.projectId}
                    onChange={(val) => setCreateForm((f) => ({ ...f, projectId: val }))}
                    placeholder="Select a project…"
                    searchable
                    options={projects.map((p) => ({ value: String(p.id), label: p.name }))}
                  />
                </div>

                {/* Task name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    Task Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Implement login flow"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && submitCreate()}
                    className="w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                {/* SAP Module */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    SAP Module
                  </label>
                  <Combobox
                    value={createForm.module}
                    onChange={(val) => {
                      setCreateForm((f) => ({ ...f, module: val }));
                      setSelectedAssignees(new Set());
                    }}
                    placeholder="— Select module (optional) —"
                    searchable
                    options={[
                      { value: "", label: "No module" },
                      ...SAP_MODULES.map((m) => ({ value: m.value, label: m.label })),
                    ]}
                  />
                </div>

                {/* Assignees */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    Assign To
                    {selectedAssignees.size > 0 && (
                      <span className="ml-2 normal-case font-medium text-indigo-600">{selectedAssignees.size} selected</span>
                    )}
                    {createForm.module && (
                      <span className="ml-2 normal-case font-normal text-slate-400">
                        — filtered by {MODULE_LABEL[createForm.module]}
                        {moduleFilteredUsers.length === 0 && " (no members)"}
                      </span>
                    )}
                  </label>

                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      placeholder="Search users…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    {userSearch && (
                      <button onClick={() => setUserSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">
                        {createForm.module && moduleFilteredUsers.length === 0
                          ? `No users assigned to ${MODULE_LABEL[createForm.module]} yet`
                          : "No users found"}
                      </p>
                    ) : (
                      filteredUsers.map((u) => {
                        const checked = selectedAssignees.has(u.id);
                        return (
                          <label
                            key={u.id}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition ${checked ? "bg-indigo-50/60" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAssignee(u.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                              <p className="text-xs text-slate-400 truncate">{u.email}</p>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${ROLE_COLORS[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                              {u.role}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {createError && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 pt-3 flex gap-3 border-t border-slate-100 flex-shrink-0">
                <button
                  onClick={submitCreate}
                  disabled={creating}
                  className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {creating ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : <><Plus size={15} /> Create Task</>}
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

function SummaryCard({ icon, label, value, colorClass }: {
  icon: React.ReactNode; label: string; value: number; colorClass: string;
}) {
  return (
    <motion.div whileHover={{ y: -2 }}
      className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
      </div>
    </motion.div>
  );
}
