"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Pencil, Trash2, ShieldCheck, ChevronDown, AlertCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { LeavePoliciesSkeleton } from "@/components/ui/skeletons";

/* ── types ── */
type LeaveType =
  | "SICK" | "CASUAL" | "EARNED" | "UNPAID"
  | "MATERNITY" | "PATERNITY" | "COMPENSATORY";

type Policy = {
  id: number;
  name: string;
  description: string | null;
  monthlyQuota: number;
  allowedLeaveTypes: LeaveType[];
  createdAt: string;
};

/* ── constants ── */
const ALL_LEAVE_TYPES: { value: LeaveType; label: string; gender?: string }[] = [
  { value: "SICK",         label: "Sick Leave"         },
  { value: "CASUAL",       label: "Casual Leave"       },
  { value: "EARNED",       label: "Earned Leave"       },
  { value: "UNPAID",       label: "Unpaid Leave"       },
  { value: "MATERNITY",    label: "Maternity Leave",  gender: "♀ Female" },
  { value: "PATERNITY",    label: "Paternity Leave",  gender: "♂ Male"   },
  { value: "COMPENSATORY", label: "Compensatory Leave" },
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

const EMPTY_FORM = {
  name: "", description: "", monthlyQuota: "1.5",
  allowedLeaveTypes: [] as LeaveType[],
};

const INPUT = "w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white";

/* ════════════════════════════════════════════════════════════════════════ */
export default function LeavePoliciesPage() {
  const [policies, setPolicies]   = useState<Policy[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Policy | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formErr, setFormErr]     = useState("");

  const [deleteId, setDeleteId]   = useState<number | null>(null);
  const [deleting, setDeleting]   = useState(false);

  useEffect(() => {
    apiFetch("/leave-policies")
      .then((d) => setPolicies(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message ?? "Failed to load policies"))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErr("");
    setShowForm(true);
  };

  const openEdit = (p: Policy) => {
    setEditing(p);
    setForm({
      name:              p.name,
      description:       p.description ?? "",
      monthlyQuota:      String(p.monthlyQuota),
      allowedLeaveTypes: [...p.allowedLeaveTypes],
    });
    setFormErr("");
    setShowForm(true);
  };

  const toggleType = (t: LeaveType) => {
    setForm((f) => ({
      ...f,
      allowedLeaveTypes: f.allowedLeaveTypes.includes(t)
        ? f.allowedLeaveTypes.filter((x) => x !== t)
        : [...f.allowedLeaveTypes, t],
    }));
  };

  const savePolicy = async () => {
    if (!form.name.trim())              { setFormErr("Policy name is required."); return; }
    if (!form.monthlyQuota || isNaN(parseFloat(form.monthlyQuota))) { setFormErr("Valid monthly quota is required."); return; }
    if (form.allowedLeaveTypes.length === 0) { setFormErr("Select at least one leave type."); return; }

    setSaving(true); setFormErr("");
    try {
      const body = {
        name:              form.name.trim(),
        description:       form.description.trim() || null,
        monthlyQuota:      parseFloat(form.monthlyQuota),
        allowedLeaveTypes: form.allowedLeaveTypes,
      };
      if (editing) {
        const updated = await apiFetch(`/leave-policies/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
        setPolicies((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      } else {
        const created = await apiFetch("/leave-policies", { method: "POST", body: JSON.stringify(body) });
        setPolicies((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch (e: any) {
      setFormErr(e.message ?? "Failed to save policy.");
    } finally {
      setSaving(false);
    }
  };

  const deletePolicy = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiFetch(`/leave-policies/${deleteId}`, { method: "DELETE" });
      setPolicies((prev) => prev.filter((p) => p.id !== deleteId));
      setDeleteId(null);
    } catch (e: any) {
      alert(e.message ?? "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LeavePoliciesSkeleton />;
  if (error)   return <p className="text-red-500 p-4">{error}</p>;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Leave Policies</h1>
          <p className="text-sm text-slate-500 mt-1">Define leave groups, quotas, and allowed leave types per group</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition"
        >
          <Plus size={15} /> New Policy
        </button>
      </div>

      {/* ── Policy cards ── */}
      {policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <ShieldCheck size={36} className="opacity-30" />
          <p className="text-sm font-medium">No leave policies yet</p>
          <button onClick={openCreate} className="text-xs text-indigo-600 hover:underline">Create your first policy</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {policies.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                    <ShieldCheck size={14} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                    {p.description && <p className="text-xs text-slate-400 truncate">{p.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteId(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Quota */}
              <div className="bg-slate-50 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">Monthly Quota</span>
                <span className="text-sm font-bold text-slate-900">{p.monthlyQuota} day{p.monthlyQuota !== 1 ? "s" : ""}</span>
              </div>

              {/* Allowed leave types */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Allowed Leave Types</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.allowedLeaveTypes.map((t) => (
                    <span key={t} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[t]}`}>
                      {ALL_LEAVE_TYPES.find((x) => x.value === t)?.label ?? t}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                    <ShieldCheck size={14} className="text-white" />
                  </div>
                  <h2 className="font-semibold text-slate-900">{editing ? "Edit Policy" : "New Leave Policy"}</h2>
                </div>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Policy Name *</label>
                  <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Female Employee Policy" className={INPUT} />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Description <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description of this policy" className={INPUT} />
                </div>

                {/* Monthly Quota */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Monthly Quota (days) *</label>
                  <input
                    type="number" step="0.5" min="0" max="31"
                    value={form.monthlyQuota}
                    onChange={(e) => setForm((f) => ({ ...f, monthlyQuota: e.target.value }))}
                    placeholder="e.g. 1.5"
                    className={INPUT}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Leave days an employee earns per calendar month (e.g. 1.5 = 18 days/year)</p>
                </div>

                {/* Allowed leave types */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">Allowed Leave Types * <span className="text-slate-400 font-normal">({form.allowedLeaveTypes.length} selected)</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_LEAVE_TYPES.map((t) => {
                      const checked = form.allowedLeaveTypes.includes(t.value);
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => toggleType(t.value)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs font-medium transition ${
                            checked
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 text-slate-600 hover:border-slate-400"
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${checked ? "border-white bg-white" : "border-slate-400"}`}>
                            {checked && <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                          </div>
                          <span className="truncate">{t.label}</span>
                          {t.gender && <span className="text-[9px] opacity-70 shrink-0">{t.gender}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {formErr && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formErr}</p>
                )}
              </div>

              <div className="px-6 pb-5 pt-3 border-t border-slate-100 flex gap-3 shrink-0">
                <button onClick={savePolicy} disabled={saving}
                  className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : editing ? "Save Changes" : "Create Policy"}
                </button>
                <button onClick={() => setShowForm(false)} className="flex-1 border border-slate-200 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete confirm ── */}
      <AnimatePresence>
        {deleteId !== null && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setDeleteId(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-xl p-6"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle size={20} className="text-red-500" />
                </div>
                <h3 className="font-semibold text-slate-900">Delete Policy</h3>
              </div>
              <p className="text-sm text-slate-500 mb-5">This policy will be removed. Users assigned to it will have no policy. This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={deletePolicy} disabled={deleting}
                  className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 transition disabled:opacity-60">
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button onClick={() => setDeleteId(null)} className="flex-1 border border-slate-200 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
