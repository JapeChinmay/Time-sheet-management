"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, CalendarDays,
  MessageSquare, X, Check, Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";

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
  createdAt: string;
};

type Leave = {
  id: number;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  user?: { id: number; name: string; email: string; designation?: string | null };
  reviewedBy?: { name: string } | null;
  reviewNote?: string | null;
  approvals?: LeaveApproval[];
  createdAt: string;
};

/* ── constants ── */
const TYPE_LABEL: Record<LeaveType, string> = {
  SICK: "Sick", CASUAL: "Casual", EARNED: "Earned", UNPAID: "Unpaid",
  MATERNITY: "Maternity", PATERNITY: "Paternity", COMPENSATORY: "Compensatory",
};

const TYPE_COLORS: Record<LeaveType, string> = {
  SICK: "bg-rose-100 text-rose-700", CASUAL: "bg-blue-100 text-blue-700",
  EARNED: "bg-emerald-100 text-emerald-700", UNPAID: "bg-slate-100 text-slate-600",
  MATERNITY: "bg-pink-100 text-pink-700", PATERNITY: "bg-indigo-100 text-indigo-700",
  COMPENSATORY: "bg-amber-100 text-amber-700",
};

const STATUS_STYLES: Record<LeaveStatus, { pill: string; label: string }> = {
  PENDING:  { pill: "bg-amber-50 text-amber-700 border-amber-200",  label: "Pending"  },
  APPROVED: { pill: "bg-green-50 text-green-700 border-green-200",  label: "Approved" },
  REJECTED: { pill: "bg-red-50   text-red-600   border-red-200",    label: "Rejected" },
};

function countDays(start: string, end: string) {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function decodeToken(): { name: string; sub: number } {
  try {
    const p = JSON.parse(atob(localStorage.getItem("token")!.split(".")[1]));
    return { name: p.name ?? "Manager", sub: p.sub ?? p.id ?? 0 };
  } catch {
    return { name: "Manager", sub: 0 };
  }
}

/* ── Approval chain badge strip ── */
function ApprovalChain({ approvals }: { approvals?: LeaveApproval[] }) {
  if (!approvals || approvals.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      <Users size={11} className="text-slate-400 shrink-0" />
      {approvals.map((a) => (
        <span
          key={a.id}
          title={`${a.approver?.name}: ${a.status}${a.reviewNote ? ` — "${a.reviewNote}"` : ""}`}
          className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
            a.status === "APPROVED"
              ? "bg-green-50 text-green-700 border-green-200"
              : a.status === "REJECTED"
              ? "bg-red-50 text-red-600 border-red-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
        >
          {a.status === "APPROVED" ? <CheckCircle2 size={9} /> : a.status === "REJECTED" ? <XCircle size={9} /> : <Clock size={9} />}
          {a.approver?.name ?? `PM #${a.approverId}`}
        </span>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function LeaveApprovalPage() {
  const [leaves, setLeaves]             = useState<Leave[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | LeaveStatus>("PENDING");

  /* review modal */
  const [reviewing, setReviewing]   = useState<Leave | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving]         = useState(false);
  const [reviewErr, setReviewErr]   = useState("");

  const me = typeof window !== "undefined" ? decodeToken() : { name: "", sub: 0 };

  useEffect(() => {
    apiFetch("/leaves")
      .then((data) => setLeaves(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message ?? "Failed to load leaves"))
      .finally(() => setLoading(false));
  }, []);

  const submitReview = async (status: "APPROVED" | "REJECTED") => {
    if (!reviewing) return;
    setSaving(true); setReviewErr("");
    try {
      const updated = await apiFetch(`/leaves/${reviewing.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ status, reviewNote: reviewNote.trim() || undefined }),
      });
      setLeaves((prev) => prev.map((l) => l.id === updated.id ? updated : l));
      setReviewing(null);
      setReviewNote("");
    } catch (e: any) {
      setReviewErr(e.message ?? "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  /** Whether the current user still has a PENDING approval on this leave. */
  const myApprovalPending = (leave: Leave) => {
    /* Leave must be in PENDING state — never show Review on an already-decided leave */
    if (leave.status !== "PENDING") return false;
    if (!leave.approvals || leave.approvals.length === 0) {
      /* No approval records (admin-only leave or legacy data) — reviewable */
      return true;
    }
    const mine = leave.approvals.find((a) => a.approverId === me.sub);
    /* If no record exists for me yet, still allow (backfill will create it) */
    if (!mine) return true;
    return mine.status === "PENDING";
  };

  const filtered = statusFilter === "ALL" ? leaves : leaves.filter((l) => l.status === statusFilter);

  const pending  = leaves.filter((l) => l.status === "PENDING").length;
  const approved = leaves.filter((l) => l.status === "APPROVED").length;
  const rejected = leaves.filter((l) => l.status === "REJECTED").length;

  if (loading) return <SmartLoader name={me.name} />;
  if (error)   return <p className="text-red-500 p-4">{error}</p>;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Leave Approval</h1>
        <p className="text-sm text-slate-500 mt-1">Review and manage team leave requests</p>
      </div>

      {/* ── Summary ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending Review", value: pending,  color: "bg-amber-50 text-amber-700",  icon: <Clock size={16} /> },
          { label: "Approved",       value: approved, color: "bg-green-50 text-green-700",  icon: <CheckCircle2 size={16} /> },
          { label: "Rejected",       value: rejected, color: "bg-red-50 text-red-600",      icon: <XCircle size={16} /> },
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

      {/* ── Filter pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => {
          const count = s === "ALL" ? leaves.length : leaves.filter((l) => l.status === s).length;
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

      {/* ── Leave cards ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <CalendarDays size={36} className="opacity-30" />
          <p className="text-sm font-medium">No {statusFilter !== "ALL" ? statusFilter.toLowerCase() : ""} leave requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l, i) => {
            const days    = countDays(l.startDate, l.endDate);
            const s       = STATUS_STYLES[l.status];
            const canAct  = myApprovalPending(l);
            /* find MY approval row */
            const myApproval = l.approvals?.find((a) => a.approverId === me.sub);

            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-4"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-slate-900 text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {l.user?.name?.[0]?.toUpperCase() ?? "?"}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-slate-900">{l.user?.name ?? "Unknown"}</p>
                    {l.user?.designation && (
                      <span className="text-xs text-slate-400">{l.user.designation}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[l.type]}`}>
                      {TYPE_LABEL[l.type]}
                    </span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${s.pill}`}>
                      {s.label}
                    </span>
                    <span className="text-xs text-slate-500">
                      {fmtDate(l.startDate)}{l.startDate !== l.endDate && <> → {fmtDate(l.endDate)}</>}
                    </span>
                    <span className="text-xs text-slate-400">{days} day{days !== 1 ? "s" : ""}</span>
                  </div>

                  <p className="text-sm text-slate-600 line-clamp-2">{l.reason}</p>

                  {/* Approval chain */}
                  {l.approvals && l.approvals.length > 0 && (
                    <ApprovalChain approvals={l.approvals} />
                  )}

                  {/* Final reviewer note (admin override or full chain completed) */}
                  {l.reviewedBy && l.status !== "PENDING" && (
                    <p className="text-xs text-slate-400 mt-1.5">
                      {l.status === "APPROVED" ? "Approved" : "Rejected"} by {l.reviewedBy.name}
                      {l.reviewNote && <> · <span className="italic">{l.reviewNote}</span></>}
                    </p>
                  )}

                  {/* Show my already-submitted decision */}
                  {myApproval && myApproval.status !== "PENDING" && (
                    <p className={`text-xs mt-1.5 font-medium ${myApproval.status === "APPROVED" ? "text-green-600" : "text-red-500"}`}>
                      You {myApproval.status === "APPROVED" ? "approved" : "rejected"} this request
                      {myApproval.reviewNote && <span className="font-normal text-slate-400"> · {myApproval.reviewNote}</span>}
                    </p>
                  )}
                </div>

                {/* Action button */}
                {canAct && (
                  <button
                    onClick={() => { setReviewing(l); setReviewNote(""); setReviewErr(""); }}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition"
                  >
                    <MessageSquare size={13} /> Review
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Review Modal ── */}
      <AnimatePresence>
        {reviewing && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setReviewing(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                    <MessageSquare size={14} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900 text-sm">Review Leave Request</h2>
                    <p className="text-xs text-slate-400">{reviewing.user?.name}</p>
                  </div>
                </div>
                <button onClick={() => setReviewing(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                {/* Summary */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[reviewing.type]}`}>
                      {TYPE_LABEL[reviewing.type]}
                    </span>
                    <span className="text-xs text-slate-500">
                      {countDays(reviewing.startDate, reviewing.endDate)} day{countDays(reviewing.startDate, reviewing.endDate) !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {fmtDate(reviewing.startDate)}{reviewing.startDate !== reviewing.endDate && <> → {fmtDate(reviewing.endDate)}</>}
                  </p>
                  <p className="text-sm text-slate-700">{reviewing.reason}</p>
                </div>

                {/* Other approvers' status (if multi-PM) */}
                {reviewing.approvals && reviewing.approvals.length > 1 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                    <p className="text-xs font-semibold text-blue-700 mb-1.5">Approval chain</p>
                    <div className="space-y-1">
                      {reviewing.approvals.map((a) => (
                        <div key={a.id} className="flex items-center gap-2">
                          {a.status === "APPROVED"  ? <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                           : a.status === "REJECTED" ? <XCircle size={12} className="text-red-500 shrink-0" />
                           : <Clock size={12} className="text-amber-500 shrink-0" />}
                          <span className={`text-xs ${a.approverId === me.sub ? "font-semibold text-slate-800" : "text-slate-600"}`}>
                            {a.approver?.name ?? `PM #${a.approverId}`}
                            {a.approverId === me.sub && " (you)"}
                          </span>
                          <span className={`ml-auto text-[10px] font-medium ${
                            a.status === "APPROVED" ? "text-green-600" : a.status === "REJECTED" ? "text-red-500" : "text-amber-600"
                          }`}>
                            {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Note */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Review Note <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Add a comment for the employee…"
                    rows={2}
                    className="w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white resize-none"
                  />
                </div>

                {reviewErr && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{reviewErr}</p>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 flex gap-3">
                <button
                  onClick={() => submitReview("APPROVED")}
                  disabled={saving}
                  className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Check size={14} /> Approve</>}
                </button>
                <button
                  onClick={() => submitReview("REJECTED")}
                  disabled={saving}
                  className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><XCircle size={14} /> Reject</>}
                </button>
                <button onClick={() => setReviewing(null)}
                  className="px-4 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition">
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
