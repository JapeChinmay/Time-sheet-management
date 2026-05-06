"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, Circle, Clock, PauseCircle, AlertTriangle,
  Folder, Users, Calendar, Forward, Trash2, Save, Pencil, X,
  Banknote, Timer,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { parseUTC, fmtDateTime, fmtDateOnly } from "@/lib/date";
import Combobox from "@/components/ui/Combobox";

/* ─── types ─── */
type TaskStatus = "CREATED" | "ASSIGNED" | "WORK_IN_PROGRESS" | "ON_HOLD" | "EXTERNAL_DEPENDENCY" | "COMPLETED";

type Task = {
  id: number;
  name: string;
  description?: string | null;
  status: TaskStatus;
  module?: string | null;
  billable: boolean;
  durationUnit?: "HOUR" | "DAY" | null;
  durationValue?: number | null;
  projectId: number;
  createdAt: string;
  project?: { id: number; name: string; projectManagerId?: number | null };
  assignees?: { id: number; name: string; email: string; role: string; designation?: string }[];
  assigner?: { id: number; name: string } | null;
  forwardedFrom?: { id: number; name: string } | null;
  forwardedTo?: { id: number; name: string } | null;
  statusLogs?: {
    id: number; changedAt: string; fromStatus: string | null; toStatus: string;
    description: string | null; changedBy?: { id: number; name: string } | null;
  }[];
  forwardLogs?: {
    id: number; forwardedAt: string; fromModule: string | null; toModule: string | null;
    fromUser?: { id: number; name: string } | null; toUser?: { id: number; name: string } | null;
  }[];
};

const STATUS_META: Record<TaskStatus, { label: string; badge: string; dot: string }> = {
  CREATED: { label: "Created", badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  ASSIGNED: { label: "Assigned", badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  WORK_IN_PROGRESS: { label: "In Progress", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  ON_HOLD: { label: "On Hold", badge: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  EXTERNAL_DEPENDENCY: { label: "Ext. Dependency", badge: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  COMPLETED: { label: "Completed", badge: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
};

const ALL_STATUSES: TaskStatus[] = ["CREATED", "ASSIGNED", "WORK_IN_PROGRESS", "ON_HOLD", "EXTERNAL_DEPENDENCY", "COMPLETED"];
const ASSIGNEE_ALLOWED: TaskStatus[] = ["WORK_IN_PROGRESS", "ON_HOLD", "EXTERNAL_DEPENDENCY", "COMPLETED"];

const SAP_MODULES = [
  { value: "", label: "None" },
  { value: "SAP_BTP", label: "SAP BTP" }, { value: "SAP_MM", label: "SAP MM" },
  { value: "SAP_FICO", label: "SAP FICO" }, { value: "SAP_SF", label: "SAP SF" },
  { value: "SAP_SD", label: "SAP SD" }, { value: "SAP_HCM", label: "SAP HCM" },
  { value: "SAP_ABAP", label: "SAP ABAP" }, { value: "SAP_PS", label: "SAP PS" },
];
const MODULE_LABEL: Record<string, string> = Object.fromEntries(SAP_MODULES.slice(1).map((m) => [m.value, m.label]));

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === "COMPLETED") return <CheckCircle2 size={18} className="text-green-500" />;
  if (status === "WORK_IN_PROGRESS") return <Clock size={18} className="text-amber-500" />;
  if (status === "ON_HOLD") return <PauseCircle size={18} className="text-orange-500" />;
  if (status === "EXTERNAL_DEPENDENCY") return <AlertTriangle size={18} className="text-red-500" />;
  if (status === "ASSIGNED") return <Circle size={18} className="text-blue-400" />;
  return <Circle size={18} className="text-slate-300" />;
}

function fmtDuration(unit: string | null | undefined, value: number | null | undefined) {
  if (!unit || value == null) return null;
  if (unit === "HOUR") {
    if (value <= 1) return `${Math.round(value * 60)} mins`;
    return `${value} hrs`;
  }
  return `${value} day${value > 1 ? "s" : ""}`;
}

/* ═══════════════════════════════════════════ */
export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = Number(params.id);
  const { data: session } = useSession();
  const meId = Number(session?.user?.id ?? 0);
  const callerRole = session?.user?.role ?? "";
  const isAdmin = callerRole === "ADMIN" || callerRole === "SUPERADMIN";

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* edit state */
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", module: "", billable: true, durationUnit: "" as "" | "HOUR" | "DAY", durationValue: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  /* status change */
  const [newStatus, setNewStatus] = useState<TaskStatus | "">("");
  const [statusNote, setStatusNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  /* delete */
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiFetch(`/tasks/${taskId}?join=project&join=assignees&join=assigner&join=forwardedFrom&join=forwardedTo&join=forwardLogs&join=forwardLogs.fromUser&join=forwardLogs.toUser&join=statusLogs&join=statusLogs.changedBy`)
      .then((t) => {
        setTask(t);
        setEditForm({
          name: t.name,
          description: t.description ?? "",
          module: t.module ?? "",
          billable: t.billable,
          durationUnit: t.durationUnit ?? "",
          durationValue: t.durationValue != null ? String(t.durationValue) : "",
        });
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading…</div>;
  if (error || !task) return <div className="p-8 text-red-500 text-sm">{error || "Task not found"}</div>;

  const isCreator = task.assigner?.id === meId;
  const isPM = task.project?.projectManagerId === meId;
  const canManage = isAdmin || isCreator || isPM;
  const isAssignee = task.assignees?.some((a) => a.id === meId) ?? false;

  const allowedStatuses = canManage
    ? ALL_STATUSES.filter((s) => s !== task.status && s !== "CREATED")
    : ASSIGNEE_ALLOWED.filter((s) => s !== task.status);

  const meta = STATUS_META[task.status];

  const saveEdit = async () => {
    setSaving(true); setSaveError("");
    try {
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        module: editForm.module || null,
        billable: editForm.billable,
        durationUnit: editForm.durationUnit || null,
        durationValue: editForm.durationUnit && editForm.durationValue ? Number(editForm.durationValue) : null,
      };
      const updated = await apiFetch(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(body) });
      setTask((prev) => ({ ...prev!, ...updated }));
      setEditing(false);
    } catch (e: any) {
      setSaveError(e.message ?? "Save failed");
    } finally { setSaving(false); }
  };

  const changeStatus = async () => {
    if (!newStatus) return;
    setSavingStatus(true);
    try {
      const updated = await apiFetch(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus, description: statusNote.trim() || null }),
      });
      setTask((prev) => prev ? { ...prev, status: updated.status, statusLogs: updated.statusLogs ?? prev.statusLogs } : prev);
      setNewStatus(""); setStatusNote("");
      // reload to get fresh logs
      const fresh = await apiFetch(`/tasks/${taskId}?join=project&join=assignees&join=assigner&join=forwardedFrom&join=forwardedTo&join=forwardLogs&join=forwardLogs.fromUser&join=forwardLogs.toUser&join=statusLogs&join=statusLogs.changedBy`);
      setTask(fresh);
    } catch (e: any) { alert(e.message ?? "Failed"); }
    finally { setSavingStatus(false); }
  };

  const deleteTask = async () => {
    if (!confirm(`Delete "${task.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiFetch(`/tasks/${taskId}`, { method: "DELETE" });
      router.push("/employee/tasks");
    } catch (e: any) { alert(e.message ?? "Delete failed"); setDeleting(false); }
  };

  const sortedStatus = [...(task.statusLogs ?? [])].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
  const sortedFwd = [...(task.forwardLogs ?? [])].sort((a, b) => new Date(a.forwardedAt).getTime() - new Date(b.forwardedAt).getTime());

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition">
        <ArrowLeft size={15} /> Back to Tasks
      </button>

      {/* ── Header card ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-200 rounded-2xl p-6">

        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="mt-0.5"><StatusIcon status={task.status} /></div>
            {editing ? (
              <input
                autoFocus
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="flex-1 text-xl font-semibold text-slate-900 border-b-2 border-slate-900 focus:outline-none bg-transparent"
              />
            ) : (
              <h1 className={`flex-1 text-xl font-semibold text-slate-900`}>
                {task.name}
              </h1>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {canManage && !editing && (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                <Pencil size={13} /> Edit
              </button>
            )}
            {editing && (
              <>
                <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition disabled:opacity-60">
                  {saving ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={13} />}
                  Save
                </button>
                <button onClick={() => { setEditing(false); setSaveError(""); }} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                  <X size={13} /> Cancel
                </button>
              </>
            )}
            {canManage && (
              <button onClick={deleteTask} disabled={deleting} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition disabled:opacity-60">
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </div>

        {saveError && <p className="text-xs text-red-500 mt-2">{saveError}</p>}

        {/* Description */}
        <div className="mt-4">
          {editing ? (
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Task description…"
              className="w-full text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            />
          ) : (
            task.description && <p className="text-sm text-slate-500 leading-relaxed">{task.description}</p>
          )}
        </div>

        {/* Meta grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4">

          {/* Status */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Status</p>
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${meta.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>

          {/* Project */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Project</p>
            {task.project ? (
              <button onClick={() => router.push(`/employee/projects/${task.projectId}`)} className="flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                <Folder size={13} /> {task.project.name}
              </button>
            ) : <span className="text-sm text-slate-400">—</span>}
          </div>

          {/* Billable */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Billable</p>
            {editing ? (
              <button
                type="button"
                onClick={() => setEditForm((f) => ({ ...f, billable: !f.billable }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.billable ? "bg-emerald-500" : "bg-slate-200"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${editForm.billable ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            ) : (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${task.billable ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                <Banknote size={11} /> {task.billable ? "Billable" : "Non-billable"}
              </span>
            )}
          </div>

          {/* Duration */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Duration</p>
            {editing ? (
              <div className="flex gap-2">
                <Combobox
                  className="flex-1"
                  value={editForm.durationUnit}
                  onChange={(v) => setEditForm((f) => ({ ...f, durationUnit: v as "" | "HOUR" | "DAY", durationValue: "" }))}
                  placeholder="Unit"
                  options={[{ value: "", label: "None" }, { value: "HOUR", label: "Hour" }, { value: "DAY", label: "Day" }]}
                />
                <Combobox
                  className="flex-1"
                  value={editForm.durationValue}
                  onChange={(v) => setEditForm((f) => ({ ...f, durationValue: v }))}
                  placeholder="Value"
                  disabled={!editForm.durationUnit}
                  options={[
                    { value: "", label: "—" },
                    ...(editForm.durationUnit === "HOUR"
                      ? [0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 20, 24].map((h) => ({ value: String(h), label: h === 0.5 ? "30 mins" : h === 1.5 ? "1.5 hrs" : `${h} hr${h > 1 ? "s" : ""}` }))
                      : editForm.durationUnit === "DAY"
                        ? [0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 10, 14, 21, 30].map((d) => ({ value: String(d), label: `${d} day${d > 1 ? "s" : ""}` }))
                        : []
                    ),
                  ]}
                />
              </div>
            ) : (
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${task.durationUnit ? "px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200" : "text-slate-400"}`}>
                {task.durationUnit && <Timer size={11} />}
                {fmtDuration(task.durationUnit, task.durationValue) ?? "—"}
              </span>
            )}
          </div>

          {/* Module */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">SAP Module</p>
            {editing ? (
              <Combobox value={editForm.module} onChange={(v) => setEditForm((f) => ({ ...f, module: v }))} placeholder="None" options={SAP_MODULES} />
            ) : (
              <span className="text-sm text-slate-600">{task.module ? (MODULE_LABEL[task.module] ?? task.module) : "—"}</span>
            )}
          </div>

          {/* Created */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Created</p>
            <span className="text-sm text-slate-600">{fmtDateTime(parseUTC(task.createdAt))}</span>
          </div>
        </div>

        {/* Assignees */}
        {(task.assignees?.length ?? 0) > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Assignees</p>
            <div className="flex flex-wrap gap-2">
              {task.assignees!.map((a) => (
                <span key={a.id} className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                  <div className="w-4 h-4 rounded-full bg-slate-400 text-white text-[9px] font-bold flex items-center justify-center">
                    {a.name[0]?.toUpperCase()}
                  </div>
                  {a.name}
                  {a.designation && <span className="text-slate-400">· {a.designation}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Assigner */}
        {task.assigner && (
          <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
            <Users size={11} /> Created by <span className="font-medium text-slate-600">{task.assigner.name}</span>
          </p>
        )}
      </motion.div>


      {/* ── Activity / Logs ── */}
      {sortedStatus.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Activity</p>
          <div className="space-y-4">
            {sortedStatus.map((log, idx) => {
              const toMeta = STATUS_META[log.toStatus as TaskStatus];
              const isForwardEntry = log.description?.startsWith("Forwarded to user");
              const fwdLog = isForwardEntry ? sortedFwd.find((f) => Math.abs(new Date(f.forwardedAt).getTime() - new Date(log.changedAt).getTime()) < 5000) ?? null : null;
              const isLast = idx === sortedStatus.length - 1;
              return (
                <div key={log.id} className="flex gap-3">
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm mt-0.5 flex-shrink-0 ${toMeta?.dot ?? "bg-slate-300"}`} />
                    {!isLast && <div className="w-px flex-1 bg-slate-100 mt-1" />}
                  </div>

                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${toMeta?.badge ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {toMeta?.label ?? log.toStatus}
                      </span>
                      {log.changedBy && (
                        <span className="text-xs text-slate-500">by <span className="font-medium">{log.changedBy.name}</span></span>
                      )}
                      <span className="text-xs text-slate-400 ml-auto">{fmtDateTime(parseUTC(log.changedAt))}</span>
                    </div>

                    {!isForwardEntry && log.description && (
                      <p className="text-xs text-slate-500 italic mt-1">"{log.description}"</p>
                    )}

                    {fwdLog && (
                      <div className="mt-2 flex items-center gap-2 text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg px-3 py-2">
                        <Forward size={11} className="flex-shrink-0" />
                        <span className="font-medium">{fwdLog.fromUser?.name ?? "—"}</span>
                        <span className="text-indigo-400">→</span>
                        <span className="font-medium">{fwdLog.toUser?.name ?? "—"}</span>
                        {fwdLog.toModule && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold text-[10px]">
                            {MODULE_LABEL[fwdLog.toModule] ?? fwdLog.toModule}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
