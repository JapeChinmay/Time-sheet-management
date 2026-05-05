"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, CalendarDays,
  MessageSquare, X, Check, Banknote, AlertTriangle, Info, UserCog,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { TablePageSkeleton } from "@/components/ui/skeletons";

/* ── types ── */
type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";
type LeaveType =
  | "SICK" | "CASUAL" | "EARNED" | "UNPAID"
  | "MATERNITY" | "PATERNITY" | "COMPENSATORY";

type LeaveApproval = {
  id: number;
  approverId: number;
  approver: { id: number; name: string; role?: string };
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
  EARNED: "bg-emerald-100 text-emerald-700", UNPAID: "bg-amber-100 text-amber-800 border border-amber-300",
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

function approvalBadge(a: LeaveApproval, isHR = false) {
  return (
    <span
      key={a.id}
      title={a.reviewNote ? `"${a.reviewNote}"` : a.status}
      className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
        a.status === "APPROVED"
          ? "bg-green-50 text-green-700 border-green-200"
          : a.status === "REJECTED"
          ? "bg-red-50 text-red-600 border-red-200"
          : isHR
          ? "bg-pink-50 text-pink-600 border-pink-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
      }`}
    >
      {a.status === "APPROVED" ? <CheckCircle2 size={9} /> : a.status === "REJECTED" ? <XCircle size={9} /> : isHR ? <UserCog size={9} /> : <Clock size={9} />}
      {a.approver?.name ?? `#${a.approverId}`}
    </span>
  );
}

/* ── Approval chain badge strip ── */
function ApprovalChain({ approvals }: { approvals?: LeaveApproval[] }) {
  if (!approvals || approvals.length === 0) return null;

  const isHRApproval = (a: LeaveApproval) => a.approver?.role === "HR";
  const hrList   = approvals.filter(isHRApproval);
  const mgmtList = approvals.filter((a) => !isHRApproval(a));

  return (
    <div className="mt-2.5 space-y-1.5">
      {mgmtList.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-16 shrink-0">
            Manager
          </span>
          <div className="flex flex-wrap gap-1">
            {mgmtList.map((a) => approvalBadge(a, false))}
          </div>
        </div>
      )}
      {hrList.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-pink-500 uppercase tracking-wide w-16 shrink-0 flex items-center gap-1">
            <UserCog size={10} /> HR
          </span>
          <div className="flex flex-wrap gap-1">
            {hrList.map((a) => approvalBadge(a, true))}
          </div>
        </div>
      )}
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

  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);

  const filtered = (statusFilter === "ALL" ? leaves : leaves.filter((l) => l.status === statusFilter))
    .filter((l) => !showUnpaidOnly || l.type === "UNPAID");

  const pending       = leaves.filter((l) => l.status === "PENDING").length;
  const approved      = leaves.filter((l) => l.status === "APPROVED").length;
  const rejected      = leaves.filter((l) => l.status === "REJECTED").length;
  const unpaidPending = leaves.filter((l) => l.type === "UNPAID" && l.status === "PENDING").length;

  if (loading) return <TablePageSkeleton />;
  if (error)   return <p className="text-red-500 p-4">{error}</p>;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Leave Approval</h1>
        <p className="text-sm text-slate-500 mt-1">Review and manage team leave requests</p>
      </div>

      {/* ── Summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Pending Review",  value: pending,       color: "bg-amber-50 text-amber-700",  icon: <Clock size={16} /> },
          { label: "Approved",        value: approved,      color: "bg-green-50 text-green-700",  icon: <CheckCircle2 size={16} /> },
          { label: "Rejected",        value: rejected,      color: "bg-red-50 text-red-600",      icon: <XCircle size={16} /> },
          { label: "Unpaid Pending",  value: unpaidPending, color: "bg-amber-100 text-amber-800", icon: <Banknote size={16} /> },
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

        {/* Unpaid-only toggle */}
        <div className="ml-auto">
          <button
            onClick={() => setShowUnpaidOnly((p) => !p)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition ${
              showUnpaidOnly
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-amber-700 border-amber-300 hover:border-amber-500"
            }`}
          >
            <Banknote size={12} />
            Unpaid Only
            {unpaidPending > 0 && !showUnpaidOnly && (
              <span className="bg-amber-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unpaidPending}</span>
            )}
          </button>
        </div>
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
            const days       = countDays(l.startDate, l.endDate);
            const s          = STATUS_STYLES[l.status];
            const canAct     = myApprovalPending(l);
            const isUnpaid   = l.type === "UNPAID";
            const myApproval = l.approvals?.find((a) => a.approverId === me.sub);

            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`rounded-xl p-5 flex items-start gap-4 border ${
                  isUnpaid
                    ? "bg-amber-50/60 border-amber-200 border-l-4 border-l-amber-400"
                    : "bg-white border-slate-200"
                }`}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full text-white text-sm font-bold flex items-center justify-center shrink-0 ${
                  isUnpaid ? "bg-amber-600" : "bg-slate-900"
                }`}>
                  {l.user?.name?.[0]?.toUpperCase() ?? "?"}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-slate-900">{l.user?.name ?? "Unknown"}</p>
                    {l.user?.designation && (
                      <span className="text-xs text-slate-400">{l.user.designation}</span>
                    )}
                    {/* Unpaid payroll flag */}
                    {isUnpaid && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                        <Banknote size={10} /> Salary Deduction
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[l.type]}`}>
                      {isUnpaid ? "⚠ Unpaid Leave" : TYPE_LABEL[l.type]}
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

                  {/* Unpaid context note */}
                  {isUnpaid && (
                    <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-100 border border-amber-200 rounded-lg px-3 py-2">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                      <span>
                        This leave was submitted as <strong>unpaid</strong> — the employee&apos;s paid quota was exceeded.
                        Approving will result in a <strong>{days}-day salary deduction</strong>.
                      </span>
                    </div>
                  )}

                  {/* Approval chain */}
                  {l.approvals && l.approvals.length > 0 && (
                    <ApprovalChain approvals={l.approvals} />
                  )}

                  {/* Final reviewer note */}
                  {l.reviewedBy && l.status !== "PENDING" && (
                    <p className="text-xs text-slate-400 mt-1.5">
                      {l.status === "APPROVED" ? "Approved" : "Rejected"} by {l.reviewedBy.name}
                      {l.reviewNote && <> · <span className="italic">{l.reviewNote}</span></>}
                    </p>
                  )}

                  {/* My already-submitted decision */}
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
                    className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition text-white ${
                      isUnpaid
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-slate-900 hover:bg-slate-700"
                    }`}
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
              className={`w-full max-w-md shadow-xl rounded-2xl flex flex-col max-h-[90vh] border ${
                reviewing.type === "UNPAID"
                  ? "bg-white border-amber-200"
                  : "bg-white border-slate-200"
              }`}
            >
              {/* ── Header ── */}
              <div className={`px-6 py-5 border-b shrink-0 flex items-center justify-between rounded-t-2xl ${
                reviewing.type === "UNPAID"
                  ? "bg-amber-50 border-amber-200"
                  : "border-slate-100"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    reviewing.type === "UNPAID" ? "bg-amber-600" : "bg-slate-900"
                  }`}>
                    {reviewing.type === "UNPAID"
                      ? <Banknote size={16} className="text-white" />
                      : <MessageSquare size={15} className="text-white" />}
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      {reviewing.type === "UNPAID" ? "Unpaid Leave Review" : "Review Leave Request"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {reviewing.user?.name}
                      {reviewing.user?.designation && (
                        <span className="text-slate-300"> · {reviewing.user.designation}</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setReviewing(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* ── Scrollable body ── */}
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

                {/* Unpaid payroll warning banner */}
                {reviewing.type === "UNPAID" && (() => {
                  const days = countDays(reviewing.startDate, reviewing.endDate);
                  return (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
                      {/* Banner top strip */}
                      <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-100 border-b border-amber-200">
                        <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                        <p className="text-sm font-semibold text-amber-800">Payroll Impact — Salary Deduction</p>
                      </div>
                      <div className="px-4 py-3 space-y-2.5">
                        {/* Deduction callout */}
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-amber-700">Days without pay</p>
                          <span className="text-sm font-bold text-amber-800 bg-amber-200 border border-amber-300 px-2.5 py-0.5 rounded-full">
                            {days} day{days !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <p className="text-xs text-amber-700 leading-relaxed">
                          The employee&apos;s <strong>paid quota was exhausted</strong> before this leave was applied for.
                          These days fall outside the leave policy and will <strong>not be compensated</strong>.
                        </p>
                        <div className="flex items-start gap-1.5 pt-1 border-t border-amber-200">
                          <Info size={11} className="text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-amber-600">
                            Approving this will trigger a <strong>{days}-day salary deduction</strong>. Please ensure payroll is notified before approving.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Leave summary card */}
                <div className={`rounded-xl p-4 space-y-2.5 ${
                  reviewing.type === "UNPAID"
                    ? "bg-amber-50 border border-amber-200"
                    : "bg-slate-50 border border-slate-100"
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${TYPE_COLORS[reviewing.type]}`}>
                      {reviewing.type === "UNPAID" ? "⚠ Unpaid Leave" : TYPE_LABEL[reviewing.type]}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <CalendarDays size={12} />
                      <span>
                        {fmtDate(reviewing.startDate)}
                        {reviewing.startDate !== reviewing.endDate && <> → {fmtDate(reviewing.endDate)}</>}
                      </span>
                      <span className="text-slate-400">
                        · {countDays(reviewing.startDate, reviewing.endDate)} day{countDays(reviewing.startDate, reviewing.endDate) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{reviewing.reason}</p>
                </div>

                {/* Approval chain */}
                {reviewing.approvals && reviewing.approvals.length > 0 && (() => {
                  const isHRApproval = (a: LeaveApproval) => a.approver?.role === "HR";
                  const isUnpaidModal = reviewing.type === "UNPAID";
                  const groups = [
                    { label: "Manager", items: reviewing.approvals!.filter((a) => !isHRApproval(a)), isHR: false },
                    { label: "HR",      items: reviewing.approvals!.filter(isHRApproval),             isHR: true  },
                  ].filter((g) => g.items.length > 0);

                  return (
                    <div className={`rounded-xl px-4 py-3 space-y-2.5 border ${
                      isUnpaidModal
                        ? "bg-amber-50/60 border-amber-200"
                        : "bg-blue-50 border-blue-200"
                    }`}>
                      <p className={`text-xs font-semibold ${isUnpaidModal ? "text-amber-700" : "text-blue-700"}`}>
                        Approval chain
                      </p>
                      {groups.map((g) => (
                        <div key={g.label}>
                          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1 ${
                            g.isHR ? "text-pink-500" : "text-slate-500"
                          }`}>
                            {g.isHR && <UserCog size={10} />}
                            {g.label}
                          </p>
                          <div className="space-y-1.5">
                            {g.items.map((a) => (
                              <div
                                key={a.id}
                                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border ${
                                  g.isHR
                                    ? "bg-pink-50 border-pink-100"
                                    : "bg-white border-slate-100"
                                }`}
                              >
                                {a.status === "APPROVED"
                                  ? <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                                  : a.status === "REJECTED"
                                  ? <XCircle size={13} className="text-red-500 shrink-0" />
                                  : g.isHR
                                  ? <UserCog size={13} className="text-pink-400 shrink-0" />
                                  : <Clock size={13} className="text-amber-500 shrink-0" />}
                                <span className={`text-xs flex-1 ${a.approverId === me.sub ? "font-semibold text-slate-800" : g.isHR ? "text-pink-700" : "text-slate-600"}`}>
                                  {a.approver?.name ?? `#${a.approverId}`}
                                  {a.approverId === me.sub && (
                                    <span className="text-slate-400 font-normal"> (you)</span>
                                  )}
                                </span>
                                {g.isHR && a.status === "PENDING" && (
                                  <span className="text-[9px] font-semibold bg-pink-100 text-pink-600 border border-pink-200 px-1.5 py-0.5 rounded-full mr-1">
                                    HR
                                  </span>
                                )}
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  a.status === "APPROVED"
                                    ? "bg-green-100 text-green-700"
                                    : a.status === "REJECTED"
                                    ? "bg-red-100 text-red-600"
                                    : g.isHR
                                    ? "bg-pink-100 text-pink-600"
                                    : "bg-amber-100 text-amber-700"
                                }`}>
                                  {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Review note input */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Review Note <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder={
                      reviewing.type === "UNPAID"
                        ? "e.g. Approved — payroll team notified…"
                        : "Add a comment for the employee…"
                    }
                    rows={2}
                    className={`w-full border px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 bg-white resize-none ${
                      reviewing.type === "UNPAID"
                        ? "border-amber-200 focus:ring-amber-400/30"
                        : "border-slate-200 focus:ring-slate-900/20"
                    }`}
                  />
                </div>

                {reviewErr && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{reviewErr}</p>
                )}
              </div>

              {/* ── Footer ── */}
              <div className={`px-6 py-4 border-t shrink-0 space-y-3 rounded-b-2xl ${
                reviewing.type === "UNPAID" ? "bg-amber-50 border-amber-200" : "border-slate-100"
              }`}>
                {reviewing.type === "UNPAID" && (
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-700 font-medium">
                    <AlertTriangle size={11} />
                    Approving confirms a salary deduction for {countDays(reviewing.startDate, reviewing.endDate)} day{countDays(reviewing.startDate, reviewing.endDate) !== 1 ? "s" : ""}
                  </div>
                )}
                <div className="flex gap-2.5">
                  <button
                    onClick={() => submitReview("APPROVED")}
                    disabled={saving}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2 text-white ${
                      reviewing.type === "UNPAID"
                        ? "bg-amber-600 hover:bg-amber-700 active:bg-amber-800"
                        : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                    }`}
                  >
                    {saving
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : reviewing.type === "UNPAID"
                      ? <><Banknote size={14} /> Approve </>
                      : <><Check size={14} /> Approve</>
                    }
                  </button>
                  <button
                    onClick={() => submitReview("REJECTED")}
                    disabled={saving}
                    className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600 active:bg-red-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {saving
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><XCircle size={14} /> Reject</>
                    }
                  </button>
                  <button
                    onClick={() => setReviewing(null)}
                    className="px-4 border border-slate-200 rounded-xl text-sm hover:bg-slate-100 transition text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
