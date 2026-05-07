"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListTodo, Search, Clock, ChevronRight, Folder,
  CheckCircle2, Circle, Loader2, AlertCircle, Users,
  Plus, X, Check, ChevronDown, Forward, PauseCircle,
  AlertTriangle, Trash2, Calendar, UserCircle2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Combobox from "@/components/ui/Combobox";

/* ─── Types ─── */
type TaskStatus = "CREATED" | "ASSIGNED" | "WORK_IN_PROGRESS" | "ON_HOLD" | "EXTERNAL_DEPENDENCY" | "COMPLETED";
type Assignee = { id: number; name: string; email?: string; role?: string; designation?: string };
type Task = {
  id: number;
  name: string;
  description?: string | null;
  status: TaskStatus;
  billable?: boolean;
  taskType?: "DEDICATED" | "SHARED" | null;
  module?: string | null;
  durationUnit?: "HOUR" | "DAY" | null;
  durationValue?: number | null;
  createdAt: string;
  projectId?: number;
  project?: { id: number; name: string };
  assignees?: Assignee[];
  assigner?: { id: number; name: string } | null;
};
type Project = { id: number; name: string; status: string };
type User = { id: number; name: string; email: string; role: string; designation?: string; module?: string | null };

/* ─── Status meta ─── */
const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  CREATED: { label: "Created", badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  ASSIGNED: { label: "Assigned", badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  WORK_IN_PROGRESS: { label: "In Progress", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  ON_HOLD: { label: "On Hold", badge: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  EXTERNAL_DEPENDENCY: { label: "Ext. Dependency", badge: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  COMPLETED: { label: "Completed", badge: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
};

const ALL_STATUSES: TaskStatus[] = ["CREATED", "ASSIGNED", "WORK_IN_PROGRESS", "ON_HOLD", "EXTERNAL_DEPENDENCY", "COMPLETED"];

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-rose-100 text-rose-700",
  ADMIN: "bg-indigo-100 text-indigo-700",
  MANAGER: "bg-teal-100 text-teal-700",
  HR: "bg-pink-100 text-pink-700",
  INTERNAL: "bg-slate-100 text-slate-600",
  EXTERNAL: "bg-orange-100 text-orange-700",
  INTERN: "bg-amber-100 text-amber-700",
};

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-sky-500", "bg-teal-500",
  "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-fuchsia-500",
];

/* ─── Helpers ─── */
function fmtDuration(unit?: string | null, value?: number | null): string | null {
  if (!unit || value == null) return null;
  if (unit === "HOUR") {
    if (value === 0.5) return "30 mins";
    if (value === 1.5) return "1.5 hrs";
    return `${value} hr${value > 1 ? "s" : ""}`;
  }
  return `${value} day${value > 1 ? "s" : ""}`;
}

function calcOverdue(task: Task): boolean {
  if (task.status === "COMPLETED" || !task.durationUnit || task.durationValue == null) return false;
  const ms = task.durationUnit === "HOUR"
    ? task.durationValue * 3600000
    : task.durationValue * 86400000;
  return Date.now() > new Date(task.createdAt).getTime() + ms;
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === "COMPLETED") return <CheckCircle2 size={18} className="text-green-500" />;
  if (status === "WORK_IN_PROGRESS") return <Clock size={18} className="text-amber-500" />;
  if (status === "ON_HOLD") return <PauseCircle size={18} className="text-orange-500" />;
  if (status === "EXTERNAL_DEPENDENCY") return <AlertTriangle size={18} className="text-red-500" />;
  if (status === "ASSIGNED") return <Circle size={18} className="text-blue-400" />;
  return <Circle size={18} className="text-slate-300" />;
}

/* ─── Inline Status Picker ─── */
function StatusPicker({ taskId, current, onChanged, onForward }: {
  taskId: number;
  current: TaskStatus;
  onChanged: (id: number, next: TaskStatus) => void;
  onForward: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<TaskStatus | null>(null);
  const [note, setNote] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setPending(null); setNote("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const confirm = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      await apiFetch(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: pending, description: note.trim() || null }),
      });
      onChanged(taskId, pending);
      setPending(null); setNote("");
    } catch { }
    finally { setSaving(false); }
  };

  const meta = STATUS_META[current];
  const options = ALL_STATUSES.filter((s) => s !== current && s !== "CREATED");

  return (
    <div ref={ref} className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => { if (!pending) setOpen((p) => !p); }}
        disabled={saving}
        className={`flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-medium border cursor-pointer hover:opacity-80 transition ${meta.badge}`}
      >
        {saving ? <Loader2 size={10} className="animate-spin" /> : <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />}
        {meta.label}
        <ChevronDown size={10} />
      </button>

      <AnimatePresence>
        {open && !pending && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-52 overflow-hidden"
          >
            <p className="text-[10px] text-slate-400 px-4 pt-2.5 pb-1 uppercase tracking-wide font-semibold">Change status to</p>
            {options.map((s) => {
              const m = STATUS_META[s];
              return (
                <button key={s} onClick={() => { setOpen(false); setPending(s); setNote(""); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 transition text-left"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.dot}`} />
                  {m.label}
                </button>
              );
            })}
            <div className="mx-3 my-1 border-t border-slate-100" />
            <button
              onClick={() => { setOpen(false); onForward(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-indigo-50 text-indigo-600 transition text-left"
            >
              <Forward size={13} className="flex-shrink-0" />
              Forward Task
            </button>
          </motion.div>
        )}

        {pending && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-64 p-4 space-y-3"
          >
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${STATUS_META[pending].badge}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${STATUS_META[pending].dot}`} />
              {STATUS_META[pending].label}
            </span>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Reason <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea autoFocus rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Why is the status changing?"
                className="w-full border border-slate-200 px-2.5 py-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={confirm} disabled={saving}
                className="flex-1 bg-slate-900 text-white text-xs py-1.5 rounded-lg font-medium hover:bg-slate-700 transition disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                {saving ? "Saving…" : "Confirm"}
              </button>
              <button onClick={() => { setPending(null); setNote(""); }}
                className="flex-1 border border-slate-200 text-xs py-1.5 rounded-lg hover:bg-slate-50 transition">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function ManagerTasksPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const meId = Number(session?.user?.id ?? 0);
  const callerRole = session?.user?.role ?? "";
  const isAdmin = callerRole === "ADMIN" || callerRole === "SUPERADMIN";

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* filters */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState<number | "ALL">("ALL");

  /* create modal */
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ projectId: "", name: "", description: "", billable: true, durationUnit: "" as "" | "HOUR" | "DAY", durationValue: "", taskType: "DEDICATED" as "DEDICATED" | "SHARED" });
  const [selectedAssignee, setSelectedAssignee] = useState<number | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>([]);
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  /* delete */
  const [deletingId, setDeletingId] = useState<number | null>(null);

  /* forward modal */
  const [fwdTask, setFwdTask]       = useState<Task | null>(null);
  const [fwdAllUsers, setFwdAllUsers] = useState<User[]>([]);
  const [fwdModule, setFwdModule]   = useState("");
  const [fwdUserId, setFwdUserId]   = useState<number | null>(null);
  const [fwdSearch, setFwdSearch]   = useState("");
  const [forwarding, setForwarding] = useState(false);
  const [fwdErr, setFwdErr]         = useState("");

  /* ── Load data ── */
  const load = async (mId: number) => {
    setLoading(true);
    try {
      const projRes = await apiFetch(
        isAdmin ? `/projects?limit=500&sort=name,ASC` : `/projects?filter=projectManagerId||$eq||${mId}&limit=200`
      );
      const pmProjects: Project[] = Array.isArray(projRes) ? projRes : (projRes.data ?? []);
      setProjects(pmProjects);

      if (pmProjects.length === 0) { setTasks([]); setLoading(false); return; }

      const [taskResults, uRes] = await Promise.all([
        Promise.all(
          pmProjects.map((p) =>
            apiFetch(`/tasks/project/${p.id}`)
              .then((r) => (Array.isArray(r) ? r : r.data ?? []) as Task[])
              .catch(() => [] as Task[])
          )
        ),
        apiFetch("/users?limit=200&sort=name,ASC").catch(() => []),
      ]);

      const seen = new Set<number>();
      const all = taskResults.flat().filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id); return true;
      });
      setTasks(all);
      setUsers(Array.isArray(uRes) ? uRes : uRes.data ?? []);
    } catch (e: any) {
      setError(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (meId) load(meId); }, [meId]);

  /* ── Status changed ── */
  const handleStatusChanged = (id: number, next: TaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: next } : t));
  };

  /* ── Delete task ── */
  const deleteTask = async (taskId: number) => {
    setDeletingId(taskId);
    try {
      await apiFetch(`/tasks/${taskId}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch { }
    finally { setDeletingId(null); }
  };

  /* ── Forward task ── */
  const openForward = async (task: Task) => {
    setFwdTask(task);
    setFwdModule("");
    setFwdUserId(null);
    setFwdSearch("");
    setFwdErr("");
    try {
      const uRes = await apiFetch("/users?limit=200&sort=name,ASC");
      setFwdAllUsers(Array.isArray(uRes) ? uRes : uRes.data ?? []);
    } catch { }
  };

  const submitForward = async () => {
    if (!fwdModule) { setFwdErr("Select a module."); return; }
    if (!fwdUserId) { setFwdErr("Select a user."); return; }
    setForwarding(true); setFwdErr("");
    try {
      await apiFetch(`/tasks/${fwdTask!.id}/forward`, {
        method: "POST",
        body: JSON.stringify({ toUserId: fwdUserId }),
      });
      setFwdTask(null);
      await load(meId);
    } catch (e: any) {
      setFwdErr(e.message ?? "Failed to forward task.");
    } finally {
      setForwarding(false);
    }
  };

  /* ── Create task ── */
  const openCreate = () => {
    setCreateForm({ projectId: "", name: "", description: "", billable: true, durationUnit: "", durationValue: "", taskType: "DEDICATED" });
    setSelectedAssignee(null);
    setSelectedAssignees([]);
    setProjectMembers([]);
    setUserSearch("");
    setCreateError("");
    setShowCreate(true);
  };

  const fetchProjectMembers = async (projectId: string) => {
    if (!projectId) { setProjectMembers([]); return; }
    setLoadingMembers(true);
    try {
      const res = await apiFetch(`/projects/${projectId}?join=members`);
      setProjectMembers(Array.isArray(res.members) ? res.members : []);
    } catch {
      setProjectMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const submitCreate = async () => {
    if (!createForm.projectId) { setCreateError("Select a project."); return; }
    if (!createForm.name.trim()) { setCreateError("Enter a task name."); return; }
    setCreating(true); setCreateError("");
    try {
      const body: Record<string, unknown> = {
        name: createForm.name.trim(),
        projectId: Number(createForm.projectId),
        billable: createForm.billable,
        taskType: createForm.taskType,
      };
      if (createForm.description.trim()) body.description = createForm.description.trim();
      if (createForm.durationUnit) body.durationUnit = createForm.durationUnit;
      if (createForm.durationUnit && createForm.durationValue) body.durationValue = Number(createForm.durationValue);

      const task: Task = await apiFetch("/tasks", { method: "POST", body: JSON.stringify(body) });

      const assigneeIds = createForm.taskType === "SHARED" ? selectedAssignees : (selectedAssignee !== null ? [selectedAssignee] : []);

      if (assigneeIds.length > 0) {
        await Promise.all(
          assigneeIds.map((uid) =>
            apiFetch(`/tasks/${task.id}/assignees`, { method: "POST", body: JSON.stringify({ userId: uid }) })
          )
        );
        await apiFetch(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: "ASSIGNED" }) });
      }

      setShowCreate(false);
      await load(meId);
    } catch (e: any) {
      setCreateError(e.message ?? "Failed to create task.");
    } finally {
      setCreating(false);
    }
  };

  /* ── Filtered + grouped ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tasks.filter((t) => {
      const matchSearch = !q || t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        (t.project?.name ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || (statusFilter === "ONGOING" ? t.status !== "COMPLETED" : t.status === statusFilter);
      const matchProject = projectFilter === "ALL" || t.projectId === projectFilter || t.project?.id === projectFilter;
      return matchSearch && matchStatus && matchProject;
    });
  }, [tasks, search, statusFilter, projectFilter]);

  const grouped = useMemo(() => {
    const map = new Map<number, { project: Project; tasks: Task[] }>();
    filtered.forEach((t) => {
      const pid = t.projectId ?? t.project?.id ?? 0;
      if (!map.has(pid)) {
        const proj = projects.find((p) => p.id === pid) ??
          { id: pid, name: t.project?.name ?? `Project #${pid}`, status: "" };
        map.set(pid, { project: proj, tasks: [] });
      }
      map.get(pid)!.tasks.push(t);
    });
    return [...map.values()];
  }, [filtered, projects]);

  /* ── Forward modal derived lists ── */
  const SAP_MODULES = [
    { value: "SAP_BTP", label: "SAP BTP" }, { value: "SAP_MM", label: "SAP MM" },
    { value: "SAP_FICO", label: "SAP FICO" }, { value: "SAP_SF", label: "SAP SF" },
    { value: "SAP_SD", label: "SAP SD" }, { value: "SAP_HCM", label: "SAP HCM" },
    { value: "SAP_ABAP", label: "SAP ABAP" }, { value: "SAP_PS", label: "SAP PS" },
  ] as const;
  const MODULE_LABEL: Record<string, string> = Object.fromEntries(SAP_MODULES.map((m) => [m.value, m.label]));
  const occupiedModules = SAP_MODULES.filter((m) => fwdAllUsers.some((u) => u.module === m.value));
  const fwdModuleUsers = fwdModule ? fwdAllUsers.filter((u) => u.module === fwdModule) : [];
  const fwdFilteredUsers = fwdModuleUsers.filter((u) =>
    !fwdSearch.trim() ||
    u.name.toLowerCase().includes(fwdSearch.toLowerCase()) ||
    (u.designation ?? "").toLowerCase().includes(fwdSearch.toLowerCase())
  );
  const fwdSelectedName = fwdUserId !== null ? fwdAllUsers.find((u) => u.id === fwdUserId)?.name : null;

  /* ── User lists for create modal — project members when project selected ── */
  const memberList = createForm.projectId && projectMembers.length > 0 ? projectMembers : users;
  const filteredUsers = useMemo(() =>
    memberList.filter((u) =>
      !userSearch.trim() ||
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
    ), [memberList, userSearch]);

  /* ── Stats ── */
  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;
  const overdueCount = tasks.filter((t) => calcOverdue(t)).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
      <Loader2 size={20} className="animate-spin" />
      <span className="text-sm">Loading project tasks…</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 p-4 text-red-500">
      <AlertCircle size={16} /> <span className="text-sm">{error}</span>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Project Tasks</h1>
          <p className="text-sm text-slate-500 mt-1">
            {projects.length} project{projects.length !== 1 ? "s" : ""} you manage
            &nbsp;·&nbsp;<span className="text-slate-700 font-medium">{tasks.length} total</span>
            &nbsp;·&nbsp;<span className="text-emerald-600 font-medium">{completedCount} completed</span>
            {overdueCount > 0 && <>&nbsp;·&nbsp;<span className="text-red-500 font-medium">{overdueCount} overdue</span></>}
          </p>
        </div>
        {projects.length > 0 && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition"
          >
            <Plus size={15} /> New Task
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>

        {projects.length > 1 && (
          <div className="w-56">
            <Combobox
              value={projectFilter === "ALL" ? "" : String(projectFilter)}
              onChange={(val) => setProjectFilter(val === "" ? "ALL" : Number(val))}
              placeholder="All Projects"
              searchable
              options={[
                { value: "", label: "All Projects" },
                ...projects.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
            />
          </div>
        )}

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
          {([
            { key: "ONGOING", label: "Ongoing" },
            { key: "ALL", label: "All" },
            { key: "CREATED", label: "Created" },
            { key: "ASSIGNED", label: "Assigned" },
            { key: "WORK_IN_PROGRESS", label: "In Progress" },
            { key: "ON_HOLD", label: "On Hold" },
            { key: "EXTERNAL_DEPENDENCY", label: "Ext. Dep." },
            { key: "COMPLETED", label: "Completed" },
          ] as const).map(({ key, label }) => {
            const count = key === "ALL" ? tasks.length
              : key === "ONGOING" ? tasks.filter((t) => t.status !== "COMPLETED").length
                : tasks.filter((t) => t.status === key).length;
            return (
              <button key={key} onClick={() => setStatusFilter(key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${statusFilter === key ? "bg-white text-slate-900 shadow" : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty states */}
      {projects.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <Folder size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">You are not a project manager of any project</p>
        </div>
      )}
      {projects.length > 0 && filtered.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <ListTodo size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No tasks match filters</p>
        </div>
      )}

      {/* Grouped task list */}
      <div className="space-y-8">
        {grouped.map(({ project, tasks: ptasks }) => (
          <div key={project.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center">
                <Folder size={12} className="text-violet-600" />
              </div>
              <h2 className="text-sm font-semibold text-slate-800">{project.name}</h2>
              <span className="text-xs text-slate-400">{ptasks.length} task{ptasks.length !== 1 ? "s" : ""}</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl">
              <AnimatePresence initial={false}>
                {ptasks.map((task, idx) => {
                  const overdue = calcOverdue(task);
                  const duration = fmtDuration(task.durationUnit, task.durationValue);
                  const assignees = task.assignees ?? [];
                  const visible = assignees.slice(0, 3);
                  const overflow = assignees.length - 3;

                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                      onClick={() => router.push(`/employee/tasks/${task.id}`)}
                      className={`group flex items-start gap-4 px-5 py-4 border-b last:border-0 cursor-pointer transition first:rounded-t-xl last:rounded-b-xl
                        ${overdue ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-slate-50/60"}`}
                    >
                      {/* Status icon */}
                      <div className="shrink-0 mt-1"><StatusIcon status={task.status} /></div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        {/* Top row: name + actions */}
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${task.status === "COMPLETED" ? "line-through text-slate-400" : "text-slate-800"}`}>
                              {task.name}
                            </p>
                            {task.description && (
                              <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{task.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <StatusPicker taskId={task.id} current={task.status} onChanged={handleStatusChanged} onForward={() => openForward(task)} />
                            {(isAdmin || projects.some((p) => p.id === (task.projectId ?? task.project?.id))) && (
                              <button
                                onClick={async (e) => { e.stopPropagation(); if (confirm("Delete this task?")) await deleteTask(task.id); }}
                                disabled={deletingId === task.id}
                                className="p-1 text-slate-300 hover:text-red-500 transition disabled:opacity-40"
                                title="Delete task"
                              >
                                {deletingId === task.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                              </button>
                            )}
                            <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 transition" />
                          </div>
                        </div>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                          {/* Assignees */}
                          {assignees.length > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="flex -space-x-1.5">
                                {visible.map((a, i) => (
                                  <div key={a.id} title={a.name}
                                    className={`w-5 h-5 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} text-white text-[9px] font-bold flex items-center justify-center border border-white`}
                                  >
                                    {a.name[0]?.toUpperCase() ?? "?"}
                                  </div>
                                ))}
                              </div>
                              <span className="text-[11px] text-slate-500">
                                {assignees.slice(0, 2).map(a => a.name.split(" ")[0]).join(", ")}
                                {assignees.length > 2 ? ` +${assignees.length - 2}` : ""}
                              </span>
                            </div>
                          )}

                          {/* Duration */}
                          {duration && (
                            <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full border font-medium
                              ${overdue ? "bg-red-100 text-red-700 border-red-200" : "bg-violet-50 text-violet-700 border-violet-200"}`}>
                              <Clock size={9} />{duration}{overdue && <span className="font-bold">· Overdue</span>}
                            </span>
                          )}

                          {/* Billable */}
                          <span className={`inline-flex text-[11px] px-1.5 py-0.5 rounded-full font-medium
                            ${task.billable !== false ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {task.billable !== false ? "Billable" : "Non-billable"}
                          </span>

                          {/* Task Type */}
                          {task.taskType && (
                            <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium
                              ${task.taskType === "SHARED" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
                              {task.taskType === "SHARED" ? <Users size={9} /> : <UserCircle2 size={9} />}
                              {task.taskType === "SHARED" ? "Shared" : "Dedicated"}
                            </span>
                          )}

                          {/* Module */}
                          {task.module && (
                            <span className="inline-flex text-[11px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
                              {task.module.replace(/_/g, " ")}
                            </span>
                          )}

                          {/* Assigner */}
                          {task.assigner && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                              <UserCircle2 size={10} /> {task.assigner.name}
                            </span>
                          )}

                          {/* Created date */}
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <Calendar size={10} />
                            {new Date(task.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      {/* ══ FORWARD TASK MODAL ══ */}
      <AnimatePresence>
        {fwdTask && (
          <motion.div
            className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setFwdTask(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                    <Forward size={14} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Forward Task</h3>
                    <p className="text-xs text-slate-400 truncate max-w-[240px]">{fwdTask.name}</p>
                  </div>
                </div>
                <button onClick={() => setFwdTask(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                {/* Step 1 — Module */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">1 · Select Module</p>
                  {occupiedModules.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No modules with assigned users found.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {occupiedModules.map((m) => (
                        <button
                          key={m.value}
                          onClick={() => { setFwdModule(m.value); setFwdUserId(null); setFwdSearch(""); }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                            fwdModule === m.value
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step 2 — User */}
                {fwdModule && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                      2 · Select User
                      <span className="ml-2 normal-case font-normal text-slate-400">— {MODULE_LABEL[fwdModule]}</span>
                    </p>

                    {fwdSelectedName && (
                      <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-indigo-800">{fwdSelectedName}</span>
                        <span className="ml-auto text-[10px] text-indigo-500 font-semibold bg-indigo-100 px-2 py-0.5 rounded-full">Selected</span>
                      </div>
                    )}

                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        placeholder="Search users…"
                        value={fwdSearch}
                        onChange={(e) => setFwdSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {fwdSearch && (
                        <button onClick={() => setFwdSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={12} /></button>
                      )}
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {fwdFilteredUsers.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6">
                          {fwdModuleUsers.length === 0 ? `No users in ${MODULE_LABEL[fwdModule]}` : "No users match search"}
                        </p>
                      ) : fwdFilteredUsers.map((u) => {
                        const sel = fwdUserId === u.id;
                        const isCurrent = fwdTask.assignees?.some((a) => a.id === u.id);
                        return (
                          <label
                            key={u.id}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition ${sel ? "bg-indigo-50/60" : ""} ${isCurrent ? "opacity-50 pointer-events-none" : ""}`}
                          >
                            <input type="radio" name="fwd-assignee" checked={sel} onChange={() => setFwdUserId(u.id)}
                              disabled={isCurrent} className="w-4 h-4 text-indigo-600" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {u.name}{isCurrent && <span className="ml-2 text-[10px] text-slate-400">(current assignee)</span>}
                              </p>
                              <p className="text-xs text-slate-400 truncate">{u.designation ?? u.email}</p>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${ROLE_COLORS[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                              {u.role}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {fwdErr && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fwdErr}</p>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 pt-3 flex gap-3 border-t border-slate-100 flex-shrink-0">
                <button
                  onClick={submitForward}
                  disabled={forwarding || !fwdModule || !fwdUserId}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {forwarding
                    ? <><Loader2 size={15} className="animate-spin" /> Forwarding…</>
                    : <><Forward size={15} /> Forward Task</>
                  }
                </button>
                <button onClick={() => setFwdTask(null)} className="flex-1 border border-slate-200 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ CREATE TASK MODAL ══ */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="font-semibold text-slate-900">Create Task</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Add a task to one of your projects</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
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
                    onChange={(val) => {
                      setCreateForm((f) => ({ ...f, projectId: val }));
                      setSelectedAssignee(null);
                      setSelectedAssignees([]);
                      fetchProjectMembers(val);
                    }}
                    placeholder="Select a project…"
                    searchable
                    options={projects.map((p) => ({ value: String(p.id), label: p.name }))}
                  />
                </div>

                {/* Name */}
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
                    className="w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    Description <span className="font-normal normal-case text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="What does this task involve?"
                    value={createForm.description}
                    onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none"
                  />
                </div>

                {/* Task Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Task Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["DEDICATED", "SHARED"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setCreateForm((f) => ({ ...f, taskType: type }));
                          setSelectedAssignee(null);
                          setSelectedAssignees([]);
                        }}
                        className={`py-2.5 rounded-lg border text-xs font-semibold transition flex flex-col items-center gap-1 ${
                          createForm.taskType === type
                            ? type === "DEDICATED"
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        {type === "DEDICATED" ? <UserCircle2 size={16} /> : <Users size={16} />}
                        {type}
                        <span className={`text-[10px] font-normal ${createForm.taskType === type ? "opacity-80" : "text-slate-400"}`}>
                          {type === "DEDICATED" ? "Single assignee" : "Multiple members"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Billable */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Billable</p>
                    <p className="text-xs text-slate-400 mt-0.5">{createForm.billable ? "Billable" : "Non-billable"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateForm((f) => ({ ...f, billable: !f.billable }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${createForm.billable ? "bg-emerald-500" : "bg-slate-200"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${createForm.billable ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Duration</label>
                  <div className="flex gap-2">
                    <Combobox
                      className="w-1/2"
                      value={createForm.durationUnit}
                      onChange={(val) => setCreateForm((f) => ({
                        ...f,
                        durationUnit: val as "" | "HOUR" | "DAY",
                        durationValue: val === "HOUR" ? "0.5" : val === "DAY" ? "1" : "",
                      }))}
                      placeholder="— Unit —"
                      options={[
                        { value: "", label: "— Unit —" },
                        { value: "HOUR", label: "Hour" },
                        { value: "DAY", label: "Day" },
                      ]}
                    />
                    <input
                      type="number"
                      min={createForm.durationUnit === "HOUR" ? 0.5 : 1}
                      max={createForm.durationUnit === "HOUR" ? 24 : undefined}
                      step={createForm.durationUnit === "HOUR" ? 0.5 : 1}
                      disabled={!createForm.durationUnit}
                      value={createForm.durationValue}
                      onChange={(e) => setCreateForm((f) => ({ ...f, durationValue: e.target.value }))}
                      placeholder="0"
                      className="w-1/2 border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Assignee */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      {createForm.taskType === "SHARED" ? "Assign Members" : "Assign To"}
                    </label>
                    {(createForm.taskType === "DEDICATED" ? selectedAssignee !== null : selectedAssignees.length > 0) && (
                      <button
                        onClick={() => { setSelectedAssignee(null); setSelectedAssignees([]); }}
                        className="text-[11px] text-slate-400 hover:text-red-500 flex items-center gap-1 transition"
                      >
                        <X size={11} /> Clear
                      </button>
                    )}
                  </div>

                  {/* Selected preview — SHARED */}
                  {createForm.taskType === "SHARED" && selectedAssignees.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {selectedAssignees.map((uid) => {
                        const u = users.find((u) => u.id === uid);
                        return (
                          <span key={uid} className="flex items-center gap-1 text-xs px-2 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-full font-medium">
                            {u?.name ?? uid}
                            <button onClick={() => setSelectedAssignees((prev) => prev.filter((id) => id !== uid))} className="text-indigo-400 hover:text-red-500">
                              <X size={10} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Selected preview — DEDICATED */}
                  {createForm.taskType === "DEDICATED" && selectedAssignee !== null && (
                    <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-blue-800">
                        {users.find((u) => u.id === selectedAssignee)?.name}
                      </span>
                      <span className="ml-auto text-[10px] text-blue-500 font-semibold bg-blue-100 px-2 py-0.5 rounded-full">ASSIGNED</span>
                    </div>
                  )}

                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      placeholder="Search users…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                    />
                    {userSearch && (
                      <button onClick={() => setUserSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={12} /></button>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {!createForm.projectId ? (
                      <p className="text-sm text-slate-400 text-center py-6">Select a project first</p>
                    ) : loadingMembers ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
                        <Loader2 size={14} className="animate-spin" />
                        <span className="text-sm">Loading members…</span>
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">No members found</p>
                    ) : filteredUsers.map((u) => {
                      const isShared = createForm.taskType === "SHARED";
                      const selected = isShared ? selectedAssignees.includes(u.id) : selectedAssignee === u.id;
                      return (
                        <label key={u.id}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition ${selected ? (isShared ? "bg-indigo-50/60" : "bg-blue-50/60") : ""}`}
                        >
                          {isShared ? (
                            <input type="checkbox" checked={selected}
                              onChange={() => setSelectedAssignees((prev) =>
                                prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                              )}
                              className="w-4 h-4 text-indigo-600 rounded"
                            />
                          ) : (
                            <input type="radio" name="assignee" checked={selected}
                              onChange={() => setSelectedAssignee(u.id)}
                              className="w-4 h-4 text-blue-600"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                            <p className="text-xs text-slate-400 truncate">{u.designation ?? u.email}</p>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${ROLE_COLORS[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                            {u.role}
                          </span>
                        </label>
                      );
                    })}
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
