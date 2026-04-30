"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Clock, Briefcase, CheckCircle2, XCircle,
  AlertCircle, TrendingUp, LogIn, Globe, Monitor, Calendar, Pencil, X, Check,
  KeyRound, Eye, EyeOff,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import {
  format, startOfWeek, addDays, subWeeks, isSameDay,
  parseISO, getDay,
} from "date-fns";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";
import Combobox from "@/components/ui/Combobox";
import { parseUTC } from "@/lib/date";

/* ─── types ─── */
type UserDetail = {
  id: number; name: string; email: string; role: string;
  status: string; designation?: string; module?: string | null;
  leavePolicyId?: number | null;
  leavePolicy?: { id: number; name: string; monthlyQuota: number } | null;
  manager?: { name: string };
  gender?: string | null;
  daysOff?: string[] | null;
};

const GENDER_OPTIONS = [
  { value: "",       label: "— Not specified —" },
  { value: "MALE",   label: "Male"              },
  { value: "FEMALE", label: "Female"            },
  { value: "OTHER",  label: "Other"             },
];

const ALL_WEEKDAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"] as const;
const WEEKDAY_SHORT: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu",
  FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

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
const MODULE_LABEL: Record<string, string> = Object.fromEntries(
  SAP_MODULES.map((m) => [m.value, m.label])
);
type Timesheet = {
  id: number; date: string; hours: number; status: string;
  description?: string; projectId: number;
  project?: { name: string };
};
type LoginLog = {
  id: number; timestamp: string; browser?: string; system?: string;
  location?: { longitude: number; latitude: number } | null;
};

/* ─── helpers ─── */
const norm = (r: any): any[] => Array.isArray(r) ? r : r?.data ?? r?.items ?? [];

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-slate-800 text-white",
  ADMIN:      "bg-slate-200 text-slate-700",
  MANAGER:    "bg-teal-100 text-teal-700",
  HR:         "bg-pink-100 text-pink-700",
  INTERNAL:   "bg-indigo-100 text-indigo-700",
  EXTERNAL:   "bg-violet-100 text-violet-700",
  INTERN:     "bg-orange-100 text-orange-700",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING:  "bg-amber-50  text-amber-700  border-amber-200",
  APPROVED: "bg-green-50  text-green-700  border-green-200",
  REJECTED: "bg-red-50    text-red-600    border-red-200",
};

function weeksAgo(n: number) {
  const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
  return subWeeks(ws, n);
}

/* ─── component ─── */
export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* edit profile modal */
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm]           = useState({ name: "", designation: "", module: "", leavePolicyId: "", gender: "", daysOff: ["SATURDAY", "SUNDAY"] as string[] });
  const [savingEdit, setSavingEdit]       = useState(false);
  const [editErr, setEditErr]             = useState("");

  /* leave policies */
  const [policies, setPolicies] = useState<{ id: number; name: string }[]>([]);

  /* password change */
  const [showPwdModal, setShowPwdModal]   = useState(false);
  const [newPwd, setNewPwd]               = useState("");
  const [confirmPwd, setConfirmPwd]       = useState("");
  const [showNewPwd, setShowNewPwd]       = useState(false);
  const [showConfPwd, setShowConfPwd]     = useState(false);
  const [savingPwd, setSavingPwd]         = useState(false);
  const [pwdErr, setPwdErr]               = useState("");
  const [pwdSuccess, setPwdSuccess]       = useState(false);

  /* caller role (for showing password change button) */
  const callerRole = (() => {
    try { return JSON.parse(atob(localStorage.getItem("token")!.split(".")[1])).role ?? ""; }
    catch { return ""; }
  })();
  const isAdmin = callerRole === "ADMIN" || callerRole === "SUPERADMIN";

  useEffect(() => {
    apiFetch("/leave-policies")
      .then((d) => setPolicies(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch(`/users/${id}?join=manager`),
      apiFetch(`/timesheets?filter=userId||$eq||${id}&join=project&sort=date,DESC&limit=300`),
      apiFetch(`/user-logs?filter=userId||$eq||${id}&sort=timestamp,DESC&limit=20`),
    ])
      .then(([u, ts, lg]) => {
        setUser(u);
        setTimesheets(norm(ts));
        setLogs(norm(lg));
      })
      .catch((e) => setError(e.message ?? "Failed to load user."))
      .finally(() => setLoading(false));
  }, [id]);

  const changePassword = async () => {
    setPwdErr("");
    if (newPwd.length < 6)        { setPwdErr("Password must be at least 6 characters."); return; }
    if (newPwd !== confirmPwd)    { setPwdErr("Passwords do not match."); return; }
    setSavingPwd(true);
    try {
      await apiFetch(`/users/${id}`, { method: "PATCH", body: JSON.stringify({ password: newPwd }) });
      setPwdSuccess(true);
      setNewPwd(""); setConfirmPwd("");
      setTimeout(() => { setShowPwdModal(false); setPwdSuccess(false); }, 1200);
    } catch (e: any) {
      setPwdErr(e.message ?? "Failed to update password.");
    } finally {
      setSavingPwd(false);
    }
  };

  const saveProfile = async () => {
    setEditErr("");
    if (!editForm.name.trim()) { setEditErr("Name is required."); return; }
    setSavingEdit(true);
    try {
      const updated = await apiFetch(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name:          editForm.name.trim(),
          designation:   editForm.designation.trim() || null,
          module:        editForm.module || null,
          leavePolicyId: editForm.leavePolicyId ? parseInt(editForm.leavePolicyId) : null,
          gender:        editForm.gender || null,
          daysOff:       editForm.daysOff,
        }),
      });
      setUser((u) => u ? { ...u, name: updated.name, designation: updated.designation, module: updated.module, leavePolicyId: updated.leavePolicyId, leavePolicy: updated.leavePolicy, gender: updated.gender, daysOff: updated.daysOff } : u);
      setShowEditModal(false);
    } catch (e: any) {
      setEditErr(e.message ?? "Failed to update profile.");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) return <SmartLoader name="Loading…" />;
  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-red-400" />
        <p className="font-medium">{error || "User not found."}</p>
        <button onClick={() => router.back()} className="text-sm text-indigo-600 hover:underline">Go back</button>
      </div>
    );
  }

  /* ── derived ── */
  const totalHours = timesheets.reduce((s, t) => s + t.hours, 0);

  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekHours = timesheets
    .filter((t) => parseISO(t.date) >= thisWeekStart)
    .reduce((s, t) => s + t.hours, 0);

  const approved = timesheets.filter((t) => t.status === "APPROVED").length;
  const pending  = timesheets.filter((t) => t.status === "PENDING").length;
  const rejected = timesheets.filter((t) => t.status === "REJECTED").length;
  const approvalRate = timesheets.length
    ? Math.round((approved / timesheets.length) * 100) : 0;

  /* Hours per project */
  const projectMap = new Map<number, { name: string; hours: number }>();
  timesheets.forEach((t) => {
    const existing = projectMap.get(t.projectId);
    projectMap.set(t.projectId, {
      name: t.project?.name ?? `Project ${t.projectId}`,
      hours: (existing?.hours ?? 0) + t.hours,
    });
  });
  const projectBreakdown = [...projectMap.values()].sort((a, b) => b.hours - a.hours);
  const maxProjectHours = Math.max(...projectBreakdown.map((p) => p.hours), 1);

  /* Weekly chart — last 8 weeks */
  const weeklyData = Array.from({ length: 8 }).map((_, i) => {
    const ws = weeksAgo(7 - i);
    const we = addDays(ws, 6);
    const hours = timesheets
      .filter((t) => { const d = parseISO(t.date); return d >= ws && d <= we; })
      .reduce((s, t) => s + t.hours, 0);
    return { label: format(ws, "MMM d"), hours };
  });
  const maxWeekHours = Math.max(...weeklyData.map((w) => w.hours), 1);

  /* Last-30-days heatmap */
  const heatmapDays = Array.from({ length: 35 }).map((_, i) => {
    const d = addDays(addDays(new Date(), -34), i);
    d.setHours(0, 0, 0, 0);
    const hours = timesheets
      .filter((t) => isSameDay(parseISO(t.date), d))
      .reduce((s, t) => s + t.hours, 0);
    const dow = getDay(d);
    return { date: d, hours, isWeekend: dow === 0 || dow === 6 };
  });

  function heatColor(h: number, weekend: boolean) {
    if (weekend) return "bg-slate-50 border-slate-100";
    if (h === 0) return "bg-slate-100 border-slate-200";
    if (h < 4)  return "bg-indigo-100 border-indigo-200";
    if (h < 8)  return "bg-indigo-300 border-indigo-400";
    return "bg-indigo-500 border-indigo-600";
  }

  const workdaysWithEntries = timesheets.filter((t) => {
    const dow = getDay(parseISO(t.date));
    return dow !== 0 && dow !== 6;
  }).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition">
        <ArrowLeft size={15} /> Back
      </button>

      {/* ── Profile card ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-5 flex-wrap">
        <div className="w-14 h-14 rounded-full bg-slate-900 text-white text-xl flex items-center justify-center font-bold flex-shrink-0">
          {user.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">{user.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? "bg-slate-100 text-slate-600"}`}>{user.role}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${user.status === "ACTIVE" ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
              {user.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{user.email}</p>
          {user.designation && <p className="text-xs text-slate-400 mt-0.5">{user.designation}</p>}
          {user.manager && <p className="text-xs text-slate-400 mt-0.5">Manager: {user.manager.name}</p>}

          {/* SAP Module + Leave Policy */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {user.module ? (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                {MODULE_LABEL[user.module] ?? user.module}
              </span>
            ) : (
              <span className="text-xs text-slate-400 italic">No SAP module assigned</span>
            )}
            {user.leavePolicy ? (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
                {user.leavePolicy.name} ({user.leavePolicy.monthlyQuota}/mo)
              </span>
            ) : (
              <span className="text-xs text-slate-400 italic">No leave policy</span>
            )}
          </div>

          {/* Admin actions */}
          {isAdmin && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4">
              <button
                onClick={() => {
                  setEditForm({ name: user.name, designation: user.designation ?? "", module: user.module ?? "", leavePolicyId: user.leavePolicyId ? String(user.leavePolicyId) : "", gender: user.gender ?? "", daysOff: user.daysOff ?? ["SATURDAY", "SUNDAY"] });
                  setEditErr("");
                  setShowEditModal(true);
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition"
              >
                <Pencil size={12} /> Edit Profile
              </button>
              <button
                onClick={() => { setShowPwdModal(true); setPwdErr(""); setPwdSuccess(false); setNewPwd(""); setConfirmPwd(""); }}
                className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 transition"
              >
                <KeyRound size={12} /> Change Password
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Change Password Modal ── */}
      <AnimatePresence>
        {showPwdModal && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowPwdModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-xl"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center">
                    <KeyRound size={14} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900 text-sm">Change Password</h2>
                    <p className="text-xs text-slate-400">{user.name}</p>
                  </div>
                </div>
                <button onClick={() => setShowPwdModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                {/* New password */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPwd ? "text" : "password"}
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full border border-slate-200 px-3 py-2.5 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showNewPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {newPwd.length > 0 && newPwd.length < 6 && (
                    <p className="text-xs text-red-500 mt-1">At least 6 characters required.</p>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfPwd ? "text" : "password"}
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full border border-slate-200 px-3 py-2.5 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfPwd((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showConfPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {confirmPwd.length > 0 && newPwd !== confirmPwd && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                  )}
                </div>

                {pwdErr && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{pwdErr}</p>
                )}
                {pwdSuccess && (
                  <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Password updated successfully!
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 flex gap-3">
                <button
                  onClick={changePassword}
                  disabled={savingPwd || newPwd.length < 6 || newPwd !== confirmPwd}
                  className="flex-1 bg-rose-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-rose-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingPwd
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                    : <><KeyRound size={14} /> Update Password</>
                  }
                </button>
                <button
                  onClick={() => setShowPwdModal(false)}
                  className="flex-1 border border-slate-200 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit Profile Modal ── */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-xl"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                    <Pencil size={14} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900 text-sm">Edit Profile</h2>
                    <p className="text-xs text-slate-400">{user.name}</p>
                  </div>
                </div>
                <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name *</label>
                  <input
                    autoFocus
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. John Doe"
                    className="w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
                  />
                </div>

                {/* Designation */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Designation <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input
                    value={editForm.designation}
                    onChange={(e) => setEditForm((f) => ({ ...f, designation: e.target.value }))}
                    placeholder="e.g. Senior SAP Consultant"
                    className="w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
                  />
                </div>

                {/* SAP Module */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">SAP Module <span className="text-slate-400 font-normal">(optional)</span></label>
                  <Combobox
                    value={editForm.module}
                    onChange={(val) => setEditForm((f) => ({ ...f, module: val }))}
                    placeholder="— No module —"
                    options={[
                      { value: "", label: "No module" },
                      ...SAP_MODULES.map((m) => ({ value: m.value, label: m.label })),
                    ]}
                  />
                </div>

                {/* Leave Policy */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Leave Policy <span className="text-slate-400 font-normal">(optional)</span></label>
                  <Combobox
                    value={editForm.leavePolicyId}
                    onChange={(val) => setEditForm((f) => ({ ...f, leavePolicyId: val }))}
                    placeholder="— No policy —"
                    options={[
                      { value: "", label: "No policy" },
                      ...policies.map((p) => ({ value: String(p.id), label: p.name })),
                    ]}
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Gender <span className="text-slate-400 font-normal">(optional)</span></label>
                  <Combobox
                    value={editForm.gender}
                    onChange={(val) => setEditForm((f) => ({ ...f, gender: val }))}
                    placeholder="— Not specified —"
                    options={GENDER_OPTIONS}
                  />
                </div>

                {/* Days Off */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Days Off
                    <span className="ml-1 font-normal text-slate-400">({editForm.daysOff.length} selected)</span>
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {ALL_WEEKDAYS.map((day) => {
                      const active = editForm.daysOff.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() =>
                            setEditForm((f) => ({
                              ...f,
                              daysOff: active
                                ? f.daysOff.filter((d) => d !== day)
                                : [...f.daysOff, day],
                            }))
                          }
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                            active
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                          }`}
                        >
                          {WEEKDAY_SHORT[day]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {editErr && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editErr}</p>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 flex gap-3">
                <button
                  onClick={saveProfile}
                  disabled={savingEdit || !editForm.name.trim()}
                  className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingEdit
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                    : <><Check size={14} /> Save Changes</>
                  }
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 border border-slate-200 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Key metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard icon={<Clock size={16} />} label="Total Hours" value={`${totalHours}h`} color="indigo" />
        <MetricCard icon={<TrendingUp size={16} />} label="This Week" value={`${thisWeekHours}h`} color="violet" />
        <MetricCard icon={<CheckCircle2 size={16} />} label="Approval Rate" value={`${approvalRate}%`} color={approvalRate >= 70 ? "green" : "amber"} />
        <MetricCard icon={<Briefcase size={16} />} label="Projects" value={String(projectBreakdown.length)} color="slate" />
      </div>

      {/* ── Weekly bar chart ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-slate-900 mb-4">Weekly Hours — Last 8 Weeks</p>
        <div className="flex items-end gap-2 h-28">
          {weeklyData.map((w, i) => {
            const heightPct = (w.hours / maxWeekHours) * 100;
            const isCurrentWeek = i === 7;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500 font-medium">{w.hours > 0 ? `${w.hours}h` : ""}</span>
                <div className="w-full relative" style={{ height: "72px" }}>
                  <motion.div
                    className={`absolute bottom-0 w-full rounded-t-md ${isCurrentWeek ? "bg-slate-900" : "bg-indigo-400"}`}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(heightPct, w.hours > 0 ? 4 : 0)}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                  />
                  {w.hours === 0 && <div className="absolute bottom-0 w-full h-1 rounded bg-slate-100" />}
                </div>
                <span className="text-[9px] text-slate-400 text-center leading-tight">{w.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Activity heatmap ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-900">Daily Activity — Last 5 Weeks</p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <div className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" /> None
            <div className="w-3 h-3 rounded-sm bg-indigo-100 border border-indigo-200" /> &lt;4h
            <div className="w-3 h-3 rounded-sm bg-indigo-300 border border-indigo-400" /> 4–8h
            <div className="w-3 h-3 rounded-sm bg-indigo-500 border border-indigo-600" /> 8h+
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["M","T","W","T","F","S","S"].map((d, i) => (
            <p key={i} className="text-[9px] text-slate-400 text-center pb-1">{d}</p>
          ))}
          {/* Re-order: heatmapDays starts from whatever day; shift so Mon is first column */}
          {heatmapDays.map((d, i) => (
            <div
              key={i}
              title={`${format(d.date, "MMM d")}: ${d.hours}h`}
              className={`aspect-square rounded-sm border text-[0px] ${heatColor(d.hours, d.isWeekend)}`}
            />
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* ── Project breakdown + status ── */}
        <div className="md:col-span-2 space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Hours by Project</p>
            </div>
            {projectBreakdown.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">No project data.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {projectBreakdown.map((p, i) => (
                  <div key={i} className="px-5 py-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-slate-800 truncate max-w-[140px]">{p.name}</p>
                      <span className="text-xs font-semibold text-slate-700">{p.hours}h</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-indigo-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(p.hours / maxProjectHours) * 100}%` }}
                        transition={{ duration: 0.5, delay: i * 0.07 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <p className="text-sm font-semibold text-slate-900">Submission Status</p>
            {[
              { label: "Approved", count: approved, icon: <CheckCircle2 size={14} className="text-green-500" />, bar: "bg-green-400" },
              { label: "Pending",  count: pending,  icon: <AlertCircle  size={14} className="text-amber-500" />, bar: "bg-amber-400" },
              { label: "Rejected", count: rejected, icon: <XCircle      size={14} className="text-red-400"   />, bar: "bg-red-400"   },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">{s.icon}<span className="text-xs text-slate-600">{s.label}</span></div>
                  <span className="text-xs font-semibold text-slate-700">{s.count}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${s.bar}`}
                    initial={{ width: 0 }}
                    animate={{ width: timesheets.length ? `${(s.count / timesheets.length) * 100}%` : "0%" }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            ))}
            <p className="text-[11px] text-slate-400 pt-1">{timesheets.length} total entries · {workdaysWithEntries} workdays logged</p>
          </div>
        </div>

        {/* ── Recent timesheets ── */}
        <div className="md:col-span-3 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Recent Entries</p>
            <span className="text-xs text-slate-400">{timesheets.length} total</span>
          </div>
          {timesheets.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-400">
              <Calendar size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No timesheet entries.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {timesheets.slice(0, 50).map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  className="px-5 py-3.5 flex items-center gap-4"
                >
                  <div className="flex-shrink-0 text-center w-10">
                    <p className="text-base font-bold text-slate-900 leading-none">{format(parseISO(t.date), "d")}</p>
                    <p className="text-[10px] text-slate-400">{format(parseISO(t.date), "MMM")}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.project?.name ?? `Project ${t.projectId}`}</p>
                    {t.description && <p className="text-xs text-slate-400 truncate mt-0.5">{t.description}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${STATUS_STYLES[t.status] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>
                    {t.status}
                  </span>
                  <span className="text-sm font-semibold text-slate-700 w-9 text-right flex-shrink-0">{t.hours}h</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Login history ── */}
      {logs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <LogIn size={14} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-900">Login History</p>
            <span className="text-xs text-slate-400 ml-auto">Last {logs.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {logs.map((l, i) => (
              <div key={l.id ?? i} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-shrink-0 text-center w-10">
                  <p className="text-base font-bold text-slate-900 leading-none">{format(parseUTC(l.timestamp), "d")}</p>
                  <p className="text-[10px] text-slate-400">{format(parseUTC(l.timestamp), "MMM")}</p>
                </div>
                <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5">
                  {l.browser && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Globe size={11} className="text-slate-300" /> {l.browser}
                    </span>
                  )}
                  {l.system && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Monitor size={11} className="text-slate-300" /> {l.system}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 flex-shrink-0">{format(parseUTC(l.timestamp), "HH:mm")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const COLORS: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    violet: "bg-violet-50 text-violet-600",
    green:  "bg-green-50  text-green-600",
    amber:  "bg-amber-50  text-amber-600",
    slate:  "bg-slate-100 text-slate-600",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${COLORS[color] ?? COLORS.slate}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}
