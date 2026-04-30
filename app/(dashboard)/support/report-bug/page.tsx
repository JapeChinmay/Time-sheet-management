"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bug,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
  ListFilter,
  Search,
  FileText,
  User2,
  Calendar,
  Inbox,
  ShieldCheck,
  PenLine,
  CircleDot,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

/* ─── Types ──────────────────────────────────────────────────────────── */
type BugStatus = "UNRESOLVED" | "RESOLVED";
type ActiveTab = "report" | "list";
type FilterStatus = "ALL" | BugStatus;

interface BugReport {
  id: number;
  title: string;
  description: string;
  status: BugStatus;
  reportedById: number;
  reportedBy?: { id: number; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function getUser(): { role: string; name: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const payload = JSON.parse(atob(localStorage.getItem("token")!.split(".")[1]));
    return { role: payload.role, name: payload.name };
  } catch {
    return null;
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/* ─── Stat Card ──────────────────────────────────────────────────────── */
function StatCard({
  label,
  count,
  icon,
  accent,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3.5 shadow-sm ${accent}`}>
      <div className="w-9 h-9 rounded-lg bg-current/10 flex items-center justify-center shrink-0 opacity-80">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800 leading-none">{count}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* ─── Bug Card ───────────────────────────────────────────────────────── */
function BugCard({
  report,
  index,
  isAdmin,
  onStatusChange,
  onDelete,
}: {
  report: BugReport;
  index: number;
  isAdmin: boolean;
  onStatusChange: (id: number, status: BugStatus) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const resolved = report.status === "RESOLVED";

  const toggle = async () => {
    setBusy(true);
    await onStatusChange(report.id, resolved ? "UNRESOLVED" : "RESOLVED");
    setBusy(false);
  };

  const del = async () => {
    if (!confirm("Delete this bug report? This cannot be undone.")) return;
    setBusy(true);
    await onDelete(report.id);
    setBusy(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className="group bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Accent strip */}
      <div className={`h-1 w-full ${resolved ? "bg-gradient-to-r from-emerald-400 to-teal-400" : "bg-gradient-to-r from-rose-400 to-orange-400"}`} />

      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start gap-4">
          {/* Reporter avatar */}
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${resolved ? "bg-emerald-500" : "bg-rose-500"}`}>
            {report.reportedBy ? initials(report.reportedBy.name) : <Bug size={14} />}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    #{report.id}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                    ${resolved
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${resolved ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`} />
                    {resolved ? "Resolved" : "Unresolved"}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-800 mt-1.5 leading-snug">
                  {report.title}
                </h3>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {report.reportedBy && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <User2 size={11} />
                  {report.reportedBy.name}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Calendar size={11} />
                {fmtDate(report.createdAt)}
              </span>
              <span className="text-xs text-slate-400">{fmtRelative(report.createdAt)}</span>
              {resolved && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 size={11} />
                  Fixed {fmtDate(report.updatedAt)}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && (
              <>
                <button
                  onClick={toggle}
                  disabled={busy}
                  title={resolved ? "Reopen" : "Mark Resolved"}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition
                    ${resolved
                      ? "border-orange-200 text-orange-600 hover:bg-orange-50"
                      : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}
                >
                  {busy
                    ? <Loader2 size={12} className="animate-spin" />
                    : resolved
                      ? <><RefreshCw size={12} />Reopen</>
                      : <><CheckCircle2 size={12} />Resolve</>
                  }
                </button>
                <button
                  onClick={del}
                  disabled={busy}
                  title="Delete"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
            <button
              onClick={() => setExpanded((p) => !p)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition"
              title={expanded ? "Collapse" : "View description"}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Expandable description */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText size={12} className="text-slate-400" />
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Description
                  </span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl px-4 py-3">
                  {report.description}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ─── Empty State ────────────────────────────────────────────────────── */
function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Inbox size={28} className="text-slate-400" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-semibold text-slate-600">{message}</p>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">{sub}</p>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function ReportBugPage() {
  const [user, setUser]   = useState<{ role: string; name: string } | null>(null);
  const isAdmin           = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  /* Tab */
  const [tab, setTab] = useState<ActiveTab>("report");

  /* Form */
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [submitError, setSubmitError]   = useState("");

  /* List */
  const [reports, setReports]     = useState<BugReport[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [searchQ, setSearchQ]     = useState("");

  const unresolved = reports.filter((r) => r.status === "UNRESOLVED");
  const resolved   = reports.filter((r) => r.status === "RESOLVED");

  const filtered = reports.filter((r) => {
    const matchStatus = filterStatus === "ALL" || r.status === filterStatus;
    const q = searchQ.toLowerCase();
    const matchSearch =
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.reportedBy?.name.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  useEffect(() => { setUser(getUser()); }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const data = await apiFetch("/bug-reports");
      setReports(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setFetchError(err.message ?? "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setSubmitStatus("idle");
    setSubmitError("");
    try {
      const created: BugReport = await apiFetch("/bug-reports", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      });
      setReports((prev) => [created, ...prev]);
      setSubmitStatus("success");
      setTitle("");
      setDescription("");
    } catch (err: any) {
      setSubmitError(err.message ?? "Something went wrong.");
      setSubmitStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: number, status: BugStatus) => {
    try {
      const updated: BugReport = await apiFetch(`/bug-reports/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err: any) {
      alert(err.message ?? "Failed to update status.");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/bug-reports/${id}`, { method: "DELETE" });
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      alert(err.message ?? "Failed to delete report.");
    }
  };

  const descProgress = Math.round((description.length / 2000) * 100);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl px-6 py-7 text-white shadow-lg">
        {/* Decorative blobs */}
        <span className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-rose-500/10 blur-2xl pointer-events-none" />
        <span className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />

        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
              <Bug size={22} className="text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Bug Reports</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {isAdmin
                  ? "Track, manage, and resolve issues across the system."
                  : "Submit an issue and track its resolution status."}
              </p>
            </div>
          </div>

          {/* Stats pills */}
          {!loading && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-xl px-3 py-2">
                <CircleDot size={13} className="text-slate-300" />
                <span className="text-xs text-slate-300 font-medium">{reports.length} Total</span>
              </div>
              <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/30 rounded-xl px-3 py-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                <span className="text-xs text-rose-300 font-medium">{unresolved.length} Open</span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl px-3 py-2">
                <CheckCircle2 size={12} className="text-emerald-400" />
                <span className="text-xs text-emerald-300 font-medium">{resolved.length} Fixed</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
        {(
          [
            { key: "report", label: "New Report", icon: <PenLine size={14} /> },
            { key: "list",   label: `Bug Reports${reports.length ? ` (${reports.length})` : ""}`, icon: <ListFilter size={14} /> },
          ] as const
        ).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition
              ${tab === key ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          >
            {tab === key && (
              <motion.div
                layoutId="tab-bg"
                className="absolute inset-0 bg-white rounded-lg shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {icon}
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">

        {/* ─ Report form ─ */}
        {tab === "report" && (
          <motion.div
            key="report"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
          >
            <div className="grid md:grid-cols-5 gap-5">

              {/* Form */}
              <div className="md:col-span-3 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {/* Card header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                  <PenLine size={15} className="text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-700">Describe the Issue</h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                  {/* Title field */}
                  <div className="space-y-1.5">
                    <label htmlFor="bug-title" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      <span className="w-4 h-4 rounded bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-[9px]">1</span>
                      Bug Title
                      <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="bug-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Timesheet fails to save on Fridays"
                      maxLength={120}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 bg-slate-50
                                 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 focus:bg-white transition"
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-400">Keep it short and descriptive</span>
                      <span className={`text-[11px] font-medium transition ${title.length > 100 ? "text-orange-500" : "text-slate-400"}`}>
                        {title.length}/120
                      </span>
                    </div>
                  </div>

                  {/* Description field */}
                  <div className="space-y-1.5">
                    <label htmlFor="bug-description" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      <span className="w-4 h-4 rounded bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-[9px]">2</span>
                      Description
                      <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      id="bug-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                     placeholder={`Tell us what went wrong in simple words.

What were you trying to do?
What happened instead?

If possible, mention:
• Where you were in the app (page/section)
• What you clicked or did
• What you expected to happen

Example:
"I was adding my timesheet for Monday, but after saving it disappeared."`}
                      rows={8}
                      maxLength={2000}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 bg-slate-50
                                 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 focus:bg-white transition resize-none"
                    />
                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full transition-colors ${
                            descProgress > 90 ? "bg-orange-400" : "bg-rose-400"
                          }`}
                          style={{ width: `${descProgress}%` }}
                        />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[11px] text-slate-400">Include steps to reproduce</span>
                        <span className={`text-[11px] font-medium ${descProgress > 90 ? "text-orange-500" : "text-slate-400"}`}>
                          {description.length}/2000
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Feedback banners */}
                  <AnimatePresence mode="wait">
                    {submitStatus === "success" && (
                      <motion.div
                        key="ok"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm"
                      >
                        <CheckCircle2 size={16} className="shrink-0" />
                        <div>
                          <p className="font-semibold">Report submitted!</p>
                          <p className="text-xs text-emerald-600 mt-0.5">We'll look into it shortly. Thank you!</p>
                        </div>
                      </motion.div>
                    )}
                    {submitStatus === "error" && (
                      <motion.div
                        key="err"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm"
                      >
                        <AlertCircle size={16} className="shrink-0" />
                        <div>
                          <p className="font-semibold">Submission failed</p>
                          <p className="text-xs text-rose-600 mt-0.5">{submitError || "Please try again."}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit */}
                  <motion.button
                    type="submit"
                    disabled={submitting || !title.trim() || !description.trim()}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition
                               bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600
                               text-white shadow-md shadow-rose-500/20
                               disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <><Loader2 size={15} className="animate-spin" />Submitting…</>
                    ) : (
                      <><Send size={15} />Submit Bug Report</>
                    )}
                  </motion.button>
                </form>
              </div>

              {/* Tips sidebar */}
              <div className="md:col-span-2 space-y-4">
                {/* Writing tips */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={14} className="text-amber-500" />
                    <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wide">Writing Tips</h3>
                  </div>
                  <ul className="space-y-2.5 text-xs text-amber-800">
                    {[
                      "Be specific about what steps triggered the bug",
                      "Describe what you expected vs what happened",
                      "Mention the page or feature where it occurred",
                      "Note any error messages you saw",
                    ].map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 w-4 h-4 rounded bg-amber-200 text-amber-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                          {i + 1}
                        </span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Quick stats */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Your Reports</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-rose-600">{unresolved.length}</p>
                      <p className="text-[10px] text-rose-500 font-medium mt-0.5">Open</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-emerald-600">{resolved.length}</p>
                      <p className="text-[10px] text-emerald-500 font-medium mt-0.5">Resolved</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setTab("list")}
                    className="w-full text-xs text-slate-500 hover:text-slate-800 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                  >
                    View all reports →
                  </button>
                </div>

                {/* Support note */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-2.5">
                  <ShieldCheck size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-500 leading-relaxed">
                    For urgent or production-critical issues, contact your system administrator directly.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─ Bug list ─ */}
        {tab === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search bug reports…"
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 text-sm text-slate-700
                             placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition"
                />
              </div>

              {/* Status filters */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                {(["ALL", "UNRESOLVED", "RESOLVED"] as FilterStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`relative px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap
                      ${filterStatus === s ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {filterStatus === s && (
                      <motion.div
                        layoutId="filter-bg"
                        className="absolute inset-0 bg-white rounded-lg shadow-sm"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative">
                      {s === "ALL" ? `All (${reports.length})` : s === "UNRESOLVED" ? `Open (${unresolved.length})` : `Fixed (${resolved.length})`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* List body */}
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Loading reports…</span>
              </div>
            ) : fetchError ? (
              <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-4 text-sm">
                <AlertCircle size={16} className="shrink-0" />
                <div>
                  <p className="font-semibold">Failed to load</p>
                  <p className="text-xs text-rose-600 mt-0.5">{fetchError}</p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                message={searchQ ? "No matching reports found" : "No reports here yet"}
                sub={
                  searchQ
                    ? "Try a different search term or clear the filter."
                    : filterStatus === "RESOLVED"
                    ? "Resolved bugs will appear here once an admin marks them fixed."
                    : "No open bugs right now — great work!"
                }
              />
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {filtered.map((r, i) => (
                    <BugCard
                      key={r.id}
                      report={r}
                      index={i}
                      isAdmin={isAdmin}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
                <p className="text-xs text-slate-400 text-center pt-2">
                  Showing {filtered.length} of {reports.length} report{reports.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
