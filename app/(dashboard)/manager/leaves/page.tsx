"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, Users, CalendarDays,
  MessageSquare, X, Check, ChevronDown,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";

/* ── types ── */
type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";
type LeaveType =
  | "SICK" | "CASUAL" | "EARNED" | "UNPAID"
  | "MATERNITY" | "PATERNITY" | "COMPENSATORY";

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
  createdAt: string;
};

/* ── constants ── */
const TYPE_LABEL: Record<LeaveType, string> = {
  SICK:         "Sick",
  CASUAL:       "Casual",
  EARNED:       "Earned",
  UNPAID:       "Unpaid",
  MATERNITY:    "Maternity",
  PATERNITY:    "Paternity",
  COMPENSATORY: "Compensatory",
};

const TYPE_COLORS: Record<LeaveType, string> = {
  SICK:         "bg-rose-100 text-rose-700",
  CASUAL:       "bg-blue-100 text-blue-700",
  EARNED:       "bg-emerald-100 text-emerald-700",
  UNPAID:       "bg-slate-100 text-slate-600",
  MATERNITY:    "bg-pink-100 text-pink-700",
  PATERNITY:    "bg-indigo-100 text-indigo-700",
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

function decodeToken() {
  try { return JSON.parse(atob(localStorage.getItem("token")!.split(".")[1])); }
  catch { return { name: "Manager" }; }
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function LeaveApprovalPage() {
  const [leaves, setLeaves]           = useState<Leave[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | LeaveStatus>("PENDING");

  /* review modal */
  const [reviewing, setReviewing]     = useState<Leave | null>(null);
  const [reviewNote, setReviewNote]   = useState("");
  const [saving, setSaving]           = useState(false);
  const [reviewErr, setReviewErr]     = useState("");

  const user = typeof window !== "undefined" ? decodeToken() : { name: "" };

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

  const filtered = statusFilter === "ALL"
    ? leaves
    : leaves.filter((l) => l.status === statusFilter);

  const pending  = leaves.filter((l) => l.status === "PENDING").length;
  const approved = leaves.filter((l) => l.status === "APPROVED").length;
  const rejected = leaves.filter((l) => l.status === "REJECTED").length;

  if (loading) return <SmartLoader name={user.name} />;
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
            const days = countDays(l.startDate, l.endDate);
            const s    = STATUS_STYLES[l.status];
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

                  {l.reviewedBy && (
                    <p className="text-xs text-slate-400 mt-1.5">
                      {l.status === "APPROVED" ? "Approved" : "Rejected"} by {l.reviewedBy.name}
                      {l.reviewNote && <> · <span className="italic">{l.reviewNote}</span></>}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {l.status === "PENDING" && (
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

              {/* Footer — two action buttons */}
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
