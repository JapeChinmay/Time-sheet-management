"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, CalendarDays, Clock, CheckCircle2, XCircle,
  AlertCircle, Trash2, ChevronDown, Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { LeavesSkeleton } from "@/components/ui/skeletons";
import DatePicker from "@/components/ui/DatePicker";

/* ── types ── */
type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";
type LeaveType =
  | "SICK" | "CASUAL" | "EARNED" | "UNPAID"
  | "MATERNITY" | "PATERNITY" | "COMPENSATORY";

type LeaveApproval = {
  id: number;
  approverId: number;
  approver: { id: number; name: string };
  status: LeaveStatus;
  reviewNote: string | null;
};

type Quota = {
  hasPolicy: boolean;
  policyName?: string;
  monthlyQuota?: number;
  usedThisMonth?: number;
  remainingThisMonth?: number;
  allowedLeaveTypes?: LeaveType[];
};

type Leave = {
  id: number;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: { name: string } | null;
  reviewNote?: string | null;
  approvals?: LeaveApproval[];
  createdAt: string;
};

/* ── constants ── */
const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "SICK",         label: "Sick Leave"        },
  { value: "CASUAL",       label: "Casual Leave"      },
  { value: "EARNED",       label: "Earned Leave"      },
  { value: "UNPAID",       label: "Unpaid Leave"      },
  { value: "MATERNITY",    label: "Maternity Leave"   },
  { value: "PATERNITY",    label: "Paternity Leave"   },
  { value: "COMPENSATORY", label: "Compensatory Leave"},
];

const TYPE_COLORS: Record<LeaveType, string> = {
  SICK:         "bg-rose-100 text-rose-700",
  CASUAL:       "bg-blue-100 text-blue-700",
  EARNED:       "bg-emerald-100 text-emerald-700",
  UNPAID:       "bg-slate-100 text-slate-600",
  MATERNITY:    "bg-pink-100 text-pink-700",
  PATERNITY:    "bg-indigo-100 text-indigo-700",
  COMPENSATORY: "bg-amber-100 text-amber-700",
};

const STATUS_STYLES: Record<LeaveStatus, { pill: string; icon: React.ReactNode; label: string }> = {
  PENDING:  { pill: "bg-amber-50 text-amber-700 border-amber-200",  icon: <Clock size={12} />,        label: "Pending"  },
  APPROVED: { pill: "bg-green-50 text-green-700 border-green-200",  icon: <CheckCircle2 size={12} />, label: "Approved" },
  REJECTED: { pill: "bg-red-50   text-red-600   border-red-200",    icon: <XCircle size={12} />,      label: "Rejected" },
};

const EMPTY_FORM = { type: "CASUAL" as LeaveType, startDate: "", endDate: "", reason: "" };

/** Shows per-PM approval dots so the employee can track who has approved. */
function ApprovalProgress({ approvals }: { approvals?: LeaveApproval[] }) {
  if (!approvals || approvals.length === 0) return null;
  const done    = approvals.filter((a) => a.status !== "PENDING").length;
  const total   = approvals.length;
  const allDone = done === total;
  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      <Users size={11} className="text-slate-400 shrink-0" />
      <span className="text-[11px] text-slate-500">
        {allDone
          ? `All ${total} manager${total !== 1 ? "s" : ""} reviewed`
          : `${done}/${total} manager${total !== 1 ? "s" : ""} reviewed`}
      </span>
      <div className="flex items-center gap-1">
        {approvals.map((a) => (
          <span
            key={a.id}
            title={`${a.approver?.name ?? "PM"}: ${a.status}`}
            className={`w-2 h-2 rounded-full ${
              a.status === "APPROVED" ? "bg-green-500"
              : a.status === "REJECTED" ? "bg-red-500"
              : "bg-amber-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function countDays(start: string, end: string) {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function decodeToken() {
  try { return JSON.parse(atob(localStorage.getItem("token")!.split(".")[1])); }
  catch { return { name: "User" }; }
}

const INPUT = "w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white";

/* ════════════════════════════════════════════════════════════════════════ */
export default function LeavesPage() {
  const [leaves, setLeaves]       = useState<Leave[]>([]);
  const [quota, setQuota]         = useState<Quota | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | LeaveStatus>("ALL");

  /* apply modal */
  const [showApply, setShowApply]   = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [applying, setApplying]     = useState(false);
  const [applyErr, setApplyErr]     = useState("");

  /* cancel confirm */
  const [cancelId, setCancelId]     = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const user = typeof window !== "undefined" ? decodeToken() : { name: "" };

  useEffect(() => {
    Promise.all([
      apiFetch("/leaves/mine"),
      apiFetch("/leaves/quota"),
    ])
      .then(([leavesData, quotaData]) => {
        setLeaves(Array.isArray(leavesData) ? leavesData : []);
        setQuota(quotaData as Quota);
      })
      .catch((e) => setError(e.message ?? "Failed to load leaves"))
      .finally(() => setLoading(false));
  }, []);

  const applyLeave = async () => {
    if (!form.startDate) { setApplyErr("Start date is required."); return; }
    if (!form.endDate)   { setApplyErr("End date is required."); return; }
    if (new Date(form.endDate) < new Date(form.startDate)) { setApplyErr("End date must be after start date."); return; }
    if (form.reason.trim().length < 5) { setApplyErr("Reason must be at least 5 characters."); return; }

    setApplying(true); setApplyErr("");
    try {
      const res = await apiFetch("/leaves", {
        method: "POST",
        body: JSON.stringify({ type: form.type, startDate: form.startDate, endDate: form.endDate, reason: form.reason.trim() }),
      });
      setLeaves((prev) => [res, ...prev]);
      setShowApply(false);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      setApplyErr(e.message ?? "Failed to submit leave.");
    } finally {
      setApplying(false);
    }
  };

  const cancelLeave = async () => {
    if (!cancelId) return;
    setCancelling(true);
    try {
      await apiFetch(`/leaves/${cancelId}`, { method: "DELETE" });
      setLeaves((prev) => prev.filter((l) => l.id !== cancelId));
      setCancelId(null);
    } catch (e: any) {
      alert(e.message ?? "Failed to cancel leave.");
    } finally {
      setCancelling(false);
    }
  };

  const filtered = statusFilter === "ALL"
    ? leaves
    : leaves.filter((l) => l.status === statusFilter);

  /* summary counts */
  const pending  = leaves.filter((l) => l.status === "PENDING").length;
  const approved = leaves.filter((l) => l.status === "APPROVED").length;
  const rejected = leaves.filter((l) => l.status === "REJECTED").length;
  const totalDays = leaves
    .filter((l) => l.status === "APPROVED")
    .reduce((s, l) => s + countDays(l.startDate, l.endDate), 0);

  if (loading) return <LeavesSkeleton />;
  if (error)   return <p className="text-red-500 p-4">{error}</p>;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">My Leaves</h1>
          <p className="text-sm text-slate-500 mt-1">Track and manage your leave requests</p>
        </div>
        <button
          onClick={() => { setShowApply(true); setApplyErr(""); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition"
        >
          <Plus size={15} /> Apply for Leave
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Approved Days", value: totalDays, color: "bg-emerald-50 text-emerald-700", icon: <CheckCircle2 size={16} /> },
          { label: "Pending",  value: pending,  color: "bg-amber-50 text-amber-700",   icon: <Clock size={16} /> },
          { label: "Approved", value: approved, color: "bg-green-50 text-green-700",   icon: <CheckCircle2 size={16} /> },
          { label: "Rejected", value: rejected, color: "bg-red-50 text-red-600",       icon: <XCircle size={16} /> },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quota banner ── */}
      {quota?.hasPolicy && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">{quota.policyName}</p>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm text-teal-900">
                  <span className="font-bold">{quota.remainingThisMonth?.toFixed(1)}</span>
                  <span className="text-teal-600"> / {quota.monthlyQuota?.toFixed(1)} days remaining this month</span>
                </span>
                <span className="text-xs text-teal-500">Used: {quota.usedThisMonth?.toFixed(1)} day{quota.usedThisMonth !== 1 ? "s" : ""}</span>
              </div>
            </div>
            {quota.allowedLeaveTypes && quota.allowedLeaveTypes.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {quota.allowedLeaveTypes.map((t) => (
                  <span key={t} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[t] ?? "bg-slate-100 text-slate-600"}`}>
                    {LEAVE_TYPES.find((lt) => lt.value === t)?.label ?? t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {quota && !quota.hasPolicy && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-700">No leave policy assigned to your account. Contact admin to set up your leave policy.</p>
        </div>
      )}

      {/* ── Filter pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => {
          const count = s === "ALL" ? leaves.length
            : leaves.filter((l) => l.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                statusFilter === s
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              <span className={`ml-1.5 text-[10px] ${statusFilter === s ? "text-white/70" : "text-slate-400"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Leave list ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <CalendarDays size={36} className="opacity-30" />
          <p className="text-sm font-medium">No leave requests found</p>
          <button onClick={() => { setShowApply(true); setForm(EMPTY_FORM); }}
            className="text-xs text-indigo-600 hover:underline">Apply for leave</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l, i) => {
            const days = countDays(l.startDate, l.endDate);
            const s    = STATUS_STYLES[l.status];
            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-4"
              >
                {/* Date block */}
                <div className="shrink-0 w-14 text-center bg-slate-50 border border-slate-200 rounded-lg py-2">
                  <p className="text-xs text-slate-400 leading-none">{new Date(l.startDate).toLocaleDateString("en-IN", { month: "short" })}</p>
                  <p className="text-xl font-bold text-slate-900 leading-tight">{new Date(l.startDate).getDate()}</p>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[l.type]}`}>
                      {LEAVE_TYPES.find((t) => t.value === l.type)?.label ?? l.type}
                    </span>
                    <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${s.pill}`}>
                      {s.icon} {s.label}
                    </span>
                    <span className="text-xs text-slate-400">{days} day{days !== 1 ? "s" : ""}</span>
                  </div>

                  <p className="text-xs text-slate-500 mb-0.5">
                    {fmtDate(l.startDate)}
                    {l.startDate !== l.endDate && <> → {fmtDate(l.endDate)}</>}
                  </p>
                  <p className="text-sm text-slate-700 line-clamp-2">{l.reason}</p>

                  {/* Approval progress (only visible while PENDING) */}
                  {l.status === "PENDING" && (
                    <ApprovalProgress approvals={l.approvals} />
                  )}

                  {l.reviewedBy && (
                    <p className="text-xs text-slate-400 mt-1">
                      {l.status === "APPROVED" ? "Approved" : "Rejected"} by {l.reviewedBy.name}
                      {l.reviewNote && <> · <span className="italic">{l.reviewNote}</span></>}
                    </p>
                  )}
                </div>

                {/* Cancel (PENDING only) */}
                {l.status === "PENDING" && (
                  <button
                    onClick={() => setCancelId(l.id)}
                    className="shrink-0 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Cancel request"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Apply Modal ── */}
      <AnimatePresence>
        {showApply && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowApply(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                    <CalendarDays size={14} className="text-white" />
                  </div>
                  <h2 className="font-semibold text-slate-900">Apply for Leave</h2>
                </div>
                <button onClick={() => setShowApply(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

                {/* Leave Type */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Leave Type</label>
                  <div className="relative">
                    <select
                      value={form.type}
                      onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as LeaveType }))}
                      className={INPUT + " appearance-none pr-8"}
                    >
                      {LEAVE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Start Date *</label>
                    <DatePicker
                      value={form.startDate}
                      onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
                      placeholder="Select date"
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">End Date *</label>
                    <DatePicker
                      value={form.endDate}
                      onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
                      placeholder="Select date"
                      min={form.startDate || new Date().toISOString().split("T")[0]}
                    />
                  </div>
                </div>

                {form.startDate && form.endDate && new Date(form.endDate) >= new Date(form.startDate) && (
                  <p className="text-xs text-indigo-600 font-medium -mt-2">
                    {countDays(form.startDate, form.endDate)} day{countDays(form.startDate, form.endDate) !== 1 ? "s" : ""} selected
                  </p>
                )}

                {/* Reason */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Reason *</label>
                  <textarea
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="Briefly describe the reason for your leave…"
                    rows={3}
                    className={INPUT + " resize-none"}
                  />
                  {form.reason.length > 0 && form.reason.length < 5 && (
                    <p className="text-xs text-red-500 mt-1">At least 5 characters required.</p>
                  )}
                </div>

                {applyErr && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{applyErr}</p>
                )}
              </div>

              <div className="px-6 pb-5 pt-3 border-t border-slate-100 flex gap-3 shrink-0">
                <button
                  onClick={applyLeave}
                  disabled={applying}
                  className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {applying
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
                    : <><Plus size={14} /> Submit Request</>
                  }
                </button>
                <button onClick={() => setShowApply(false)}
                  className="flex-1 border border-slate-200 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cancel Confirm Modal ── */}
      <AnimatePresence>
        {cancelId !== null && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setCancelId(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-xl p-6"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle size={20} className="text-red-500" />
                </div>
                <h3 className="font-semibold text-slate-900">Cancel Leave Request</h3>
              </div>
              <p className="text-sm text-slate-500 mb-5">This will permanently withdraw your leave request. This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={cancelLeave}
                  disabled={cancelling}
                  className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 transition disabled:opacity-60"
                >
                  {cancelling ? "Cancelling…" : "Yes, cancel it"}
                </button>
                <button onClick={() => setCancelId(null)}
                  className="flex-1 border border-slate-200 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition">
                  Keep it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
