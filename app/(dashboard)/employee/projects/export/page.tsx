"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Download, Users, Calendar, Briefcase, Clock,
  RefreshCw, FileText, DollarSign, AlertCircle,
  ChevronDown, ChevronUp, ListTodo, BarChart2, IndianRupee,
  Calculator,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Combobox from "@/components/ui/Combobox";
import DatePicker from "@/components/ui/DatePicker";

/* ─── Types ──────────────────────────────────────────────────────── */
type ProjectOption = { id: number; name: string; status: string };

type ProjectDetail = ProjectOption & {
  billingRate?: number | null;
  billingCurrency?: string | null;
  clientName?: string | null;
  sourceCompany?: string | null;
  members?: { id: number; name: string; email?: string; designation?: string }[];
  projectManager?: { id: number; name: string; designation?: string } | null;
};

type TimesheetEntry = {
  id: number;
  date: string;
  hours: number;
  description?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  projectId?: number;
  project?: { id: number; name: string };
  taskId?: number | null;
  task?: { id: number; name: string } | null;
  userId?: number;
  user?: { id: number; name: string; email?: string } | null;
};

type BillingView = "daily" | "weekly" | "monthly";

/* ─── Constants ───────────────────────────────────────────────────── */
const CURRENCIES = [
  { code: "INR", symbol: "₹",   locale: "en-IN" },
  { code: "USD", symbol: "$",   locale: "en-US" },
  { code: "EUR", symbol: "€",   locale: "de-DE" },
  { code: "GBP", symbol: "£",   locale: "en-GB" },
  { code: "AED", symbol: "د.إ", locale: "ar-AE" },
  { code: "SGD", symbol: "S$",  locale: "en-SG" },
];

const STATUS_PILL: Record<string, string> = {
  PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
};

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-sky-500",    "bg-teal-500",
  "bg-emerald-500","bg-rose-500",   "bg-amber-500",  "bg-fuchsia-500",
  "bg-orange-500", "bg-cyan-500",   "bg-pink-500",   "bg-purple-500",
];

/* ─── Helpers ─────────────────────────────────────────────────────── */
function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function fmtDateShort(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function fmtMoney(n: number, currencyCode = "INR") {
  const cur = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];
  try {
    return new Intl.NumberFormat(cur.locale, {
      style: "currency", currency: cur.code,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${cur.symbol}${n.toFixed(2)}`;
  }
}

function currencySymbol(code: string) {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

function isoToday()      { return new Date().toISOString().slice(0, 10); }
function isoFirstOfMonth() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), 1).toISOString().slice(0, 10);
}

/** Returns the Monday-start key + display label for a given ISO date string. */
function weekBucket(dateStr: string): { key: string; label: string } {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay(); // 0 = Sun
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d); mon.setDate(d.getDate() + monOffset);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return {
    key:   mon.toISOString().slice(0, 10),
    label: `${fmtDateShort(mon)} – ${fmtDateShort(sun)}`,
  };
}

/** Returns YYYY-MM key + "Month Year" label. */
function monthBucket(dateStr: string): { key: string; label: string } {
  const key = dateStr.slice(0, 7);
  const [y, m] = key.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "long", year: "numeric",
  });
  return { key, label };
}

function csvEscape(v: string | number | null | undefined) {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

/* ═══════════════════════════════════════════════════════════════════
   Main page
═══════════════════════════════════════════════════════════════════ */
export default function ProjectExportPage() {
  const router = useRouter();

  /* ── Projects list ── */
  const [projects,    setProjects]    = useState<ProjectOption[]>([]);
  const [projId,      setProjId]      = useState("");
  const [projDetail,  setProjDetail]  = useState<ProjectDetail | null>(null);
  const [loadingProj, setLoadingProj] = useState(false);

  /* ── User selection ── */
  const [members,         setMembers]         = useState<{ id: number; name: string; email?: string }[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [allSelected,     setAllSelected]     = useState(true);

  /* ── Date range ── */
  const [dateFrom, setDateFrom] = useState(isoFirstOfMonth());
  const [dateTo,   setDateTo]   = useState(isoToday());

  /* ── Raw timesheet data ── */
  const [allEntries,  setAllEntries]  = useState<TimesheetEntry[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataLoaded,  setDataLoaded]  = useState(false);
  const [fetchError,  setFetchError]  = useState("");

  /* ── Billing config ── */
  const [userRates,    setUserRates]    = useState<Record<string, string>>({});   // userId → rate string
  const [billCurrency, setBillCurrency] = useState("INR");
  const [billingView,  setBillingView]  = useState<BillingView>("monthly");
  const [billingOpen,  setBillingOpen]  = useState(true);
  const [summaryOpen,  setSummaryOpen]  = useState(true);

  /* ── Load all projects on mount ── */
  useEffect(() => {
    apiFetch("/projects?limit=500")
      .then((r) => setProjects(Array.isArray(r) ? r : r.data ?? []))
      .catch(() => {});
  }, []);

  /* ── Load project detail + members when project changes ── */
  useEffect(() => {
    if (!projId) {
      setProjDetail(null); setMembers([]); setSelectedUserIds(new Set());
      setAllSelected(true); setAllEntries([]); setDataLoaded(false);
      return;
    }
    setLoadingProj(true);

    (async () => {
      try {
        const r = await apiFetch(`/projects/${projId}?join=members&join=projectManager`);

        /* ── Resolve PM: prefer joined relation, fall back to ID fetch ── */
        let pm: { id: number; name: string; email?: string } | null =
          r.projectManager ?? null;

        if (!pm && r.projectManagerId) {
          try {
            const u = await apiFetch(`/users/${r.projectManagerId}`);
            pm = { id: u.id, name: u.name, email: u.email };
          } catch { /* ignore */ }
        }

        /* Store resolved PM back into detail so billing section can use it */
        const detail: ProjectDetail = pm ? { ...r, projectManager: pm } : r;
        setProjDetail(detail);

        /* ── Build member list, inserting PM at top if not already present ── */
        const base: typeof members = r.members ?? [];
        const memberIds = new Set(base.map((u: any) => u.id));
        const merged = pm && !memberIds.has(pm.id)
          ? [{ id: pm.id, name: pm.name, email: pm.email ?? "" }, ...base]
          : base;

        setMembers(merged);
        setSelectedUserIds(new Set(merged.map((u) => u.id)));
        setAllSelected(true);
        setAllEntries([]); setDataLoaded(false);
      } catch { /* silently fail */ }
      finally { setLoadingProj(false); }
    })();
  }, [projId]);

  /* ── Filtered entries (client-side user filter) ── */
  const entries = useMemo<TimesheetEntry[]>(() => {
    if (allSelected || selectedUserIds.size === 0) return allEntries;
    return allEntries.filter((e) => e.userId != null && selectedUserIds.has(e.userId));
  }, [allEntries, allSelected, selectedUserIds]);

  /* ── Users for billing = project members + PM only (not derived from entries) ── */
  const uniqueUsers = useMemo(() => {
    const pmId = projDetail?.projectManager?.id ?? null;
    const map: Record<string, { id: number; name: string; idx: number; isPM: boolean }> = {};
    let idx = 0;
    members.forEach((m) => {
      map[String(m.id)] = { id: m.id, name: m.name, idx: idx++, isPM: m.id === pmId };
    });
    return Object.values(map).sort((a, b) => a.idx - b.idx);
  }, [members, projDetail]);

  /* ── Initialise blank rate for each new unique user ── */
  useEffect(() => {
    setUserRates((prev) => {
      const next = { ...prev };
      uniqueUsers.forEach((u) => {
        const key = String(u.id);
        if (!(key in next)) next[key] = "";
      });
      return next;
    });
  }, [uniqueUsers]);

  /* ── Per-user billing breakdown ── */
  const billingBreakdown = useMemo(() => {
    return uniqueUsers.map((user) => {
      const key      = String(user.id);
      const rate     = parseFloat(userRates[key] || "0") || 0;
      const userEnts = entries.filter((e) => String(e.userId) === key);

      /* group by period */
      const buckets: Record<string, { label: string; hours: number; sortKey: string }> = {};
      userEnts.forEach((e) => {
        let bKey: string, label: string, sortKey: string;
        if (billingView === "daily") {
          bKey = e.date; label = fmtDate(e.date); sortKey = e.date;
        } else if (billingView === "weekly") {
          const wb = weekBucket(e.date);
          bKey = wb.key; label = wb.label; sortKey = wb.key;
        } else {
          const mb = monthBucket(e.date);
          bKey = mb.key; label = mb.label; sortKey = mb.key;
        }
        if (!buckets[bKey]) buckets[bKey] = { label, hours: 0, sortKey };
        buckets[bKey].hours += e.hours || 0;
      });

      const rows = Object.values(buckets)
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
        .map((r) => ({ ...r, billing: rate > 0 ? r.hours * rate : null }));

      const totalHours   = rows.reduce((s, r) => s + r.hours, 0);
      const totalBilling = rate > 0 ? totalHours * rate : null;

      return { userId: user.id, userName: user.name, isPM: user.isPM, rate, rows, totalHours, totalBilling };
    });
  }, [uniqueUsers, entries, billingView, userRates]);

  /* ── Grand totals across all users ── */
  const grandTotal = useMemo(() => {
    const totalHours   = billingBreakdown.reduce((s, u) => s + u.totalHours, 0);
    const billedUsers  = billingBreakdown.filter((u) => u.totalBilling != null);
    const totalBilling = billedUsers.length > 0
      ? billedUsers.reduce((s, u) => s + (u.totalBilling ?? 0), 0)
      : null;
    return { totalHours, totalBilling };
  }, [billingBreakdown]);

  /* ── Top-level summary (for stat cards) ── */
  const summary = useMemo(() => {
    if (!entries.length) return null;
    const totalH = entries.reduce((s, e) => s + (e.hours || 0), 0);
    const userMap: Record<string, { name: string; hours: number; entries: number }> = {};
    entries.forEach((e) => {
      const k = String(e.userId ?? "?");
      const n = e.user?.name ?? `User ${e.userId}`;
      if (!userMap[k]) userMap[k] = { name: n, hours: 0, entries: 0 };
      userMap[k].hours   += e.hours || 0;
      userMap[k].entries += 1;
    });
    return {
      totalHours: totalH,
      count: entries.length,
      byUser: Object.values(userMap).sort((a, b) => b.hours - a.hours),
    };
  }, [entries]);

  /* ── Load timesheet data ── */
  const loadData = useCallback(async () => {
    if (!projId) return;
    setLoadingData(true); setFetchError("");
    try {
      let url = `/timesheets?filter=projectId||$eq||${projId}`;
      if (dateFrom) url += `&filter=date||$gte||${dateFrom}`;
      if (dateTo)   url += `&filter=date||$lte||${dateTo}`;
      url += `&join=project&join=task&join=user&limit=5000&sort=date,ASC`;
      const res = await apiFetch(url);
      setAllEntries(Array.isArray(res) ? res : res.data ?? []);
      setDataLoaded(true);
    } catch (err: any) {
      setFetchError(err.message ?? "Failed to fetch data.");
    } finally {
      setLoadingData(false);
    }
  }, [projId, dateFrom, dateTo]);

  /* ── User toggles ── */
  const toggleUser = (id: number) => {
    setAllSelected(false);
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (allSelected) { setAllSelected(false); setSelectedUserIds(new Set()); }
    else             { setAllSelected(true);  setSelectedUserIds(new Set(members.map((m) => m.id))); }
  };

  /* ── Quick date range shortcuts ── */
  const setRange = (from: string, to: string) => { setDateFrom(from); setDateTo(to); setDataLoaded(false); };
  const QUICK = [
    { label: "This month",    apply: () => setRange(isoFirstOfMonth(), isoToday()) },
    { label: "Last month",    apply: () => { const t = new Date(); const s = new Date(t.getFullYear(), t.getMonth()-1, 1); const e = new Date(t.getFullYear(), t.getMonth(), 0); setRange(s.toISOString().slice(0,10), e.toISOString().slice(0,10)); } },
    { label: "Last 3 months", apply: () => { const t = new Date(); const s = new Date(t); s.setMonth(s.getMonth()-3); setRange(s.toISOString().slice(0,10), isoToday()); } },
    { label: "This year",     apply: () => setRange(`${new Date().getFullYear()}-01-01`, isoToday()) },
  ];

  /* ── Export CSV ── */
  const exportCsv = () => {
    if (!entries.length) return;
    const sym = currencySymbol(billCurrency);

    /* ── Sheet 1: Timesheet entries ── */
    const timesheetHeaders = ["Date","User","Email","Project","Task","Description","Hours","Status"];
    const timesheetRows    = entries.map((e) => [
      e.date, e.user?.name ?? `User ${e.userId}`, e.user?.email ?? "",
      e.project?.name ?? projDetail?.name ?? "", e.task?.name ?? "",
      e.description ?? "", String(e.hours || 0), e.status ?? "PENDING",
    ]);
    const totalH = entries.reduce((s, e) => s + (e.hours || 0), 0);
    timesheetRows.push(["","","","","","TOTAL", String(totalH), ""]);

    /* ── Sheet 2: Billing breakdown ── */
    const billingHeaders = ["User",`Rate (${sym}/hr)`, "Period", "Hours", `Amount (${billCurrency})`];
    const billingRows: string[][] = [];
    billingBreakdown.forEach((u) => {
      const userLabel = u.isPM ? `${u.userName} (PM)` : u.userName;
      u.rows.forEach((r) => {
        billingRows.push([
          userLabel, u.rate > 0 ? String(u.rate) : "—",
          r.label, String(r.hours),
          r.billing != null ? r.billing.toFixed(2) : "—",
        ]);
      });
      billingRows.push([
        `${userLabel} — TOTAL`, u.rate > 0 ? String(u.rate) : "—",
        "", String(u.totalHours),
        u.totalBilling != null ? u.totalBilling.toFixed(2) : "—",
      ]);
      billingRows.push([]);
    });
    if (grandTotal.totalBilling != null) {
      billingRows.push(["GRAND TOTAL","","", String(grandTotal.totalHours), grandTotal.totalBilling.toFixed(2)]);
    }

    const toCSV = (headers: string[], rows: string[][]) =>
      [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

    const csv = [
      "=== TIMESHEET ENTRIES ===",
      toCSV(timesheetHeaders, timesheetRows),
      "",
      "=== BILLING BREAKDOWN ===",
      toCSV(billingHeaders, billingRows),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    const slug = (projDetail?.name ?? "project").replace(/[^a-zA-Z0-9]+/g, "-");
    a.download = `${slug}-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const checkedCount = allSelected ? members.length : selectedUserIds.size;
  const canLoad      = !!projId && !!dateFrom && !!dateTo;
  const anyRateSet   = Object.values(userRates).some((r) => parseFloat(r) > 0);

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Export Project Report</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Select project · configure per-user billing · export CSV
            </p>
          </div>
        </div>
        <button
          onClick={exportCsv}
          disabled={!dataLoaded || entries.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* ── Sidebar + main ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr] gap-6 items-start">

        {/* ═══ LEFT SIDEBAR ═══ */}
        <div className="space-y-4">

          {/* Step 1 – Project */}
          <FilterCard icon={<Briefcase size={13} className="text-white" />} iconBg="bg-slate-900" title="Project" step="1">
            <Combobox
              value={projId}
              onChange={(v) => { setProjId(v); setDataLoaded(false); }}
              placeholder="Choose a project…"
              searchable
              options={[
                { value: "", label: "— Select project —" },
                ...projects.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
            />
            <AnimatePresence>
              {projDetail && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-3 pt-3 border-t border-slate-100">
                  {(projDetail.clientName || projDetail.sourceCompany) && (
                    <p className="text-[11px] text-slate-400 px-1">
                      {[projDetail.clientName, projDetail.sourceCompany].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </FilterCard>

          {/* Step 2 – Users */}
          <AnimatePresence>
            {projId && (
              <motion.div key="users" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <FilterCard
                  icon={<Users size={13} className="text-white" />} iconBg="bg-violet-600"
                  title="Users" step="2"
                  action={members.length > 0
                    ? <button onClick={toggleAll} className="text-[11px] font-medium text-violet-600 hover:text-violet-800 transition">
                        {allSelected ? "Deselect all" : "Select all"}
                      </button>
                    : null}
                >
                  {loadingProj ? (
                    <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" />)}</div>
                  ) : members.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-3">No members — all user data will be fetched.</p>
                  ) : (
                    <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                      {members.map((m) => {
                        const on  = allSelected || selectedUserIds.has(m.id);
                        const isPm = projDetail?.projectManager != null &&
                                     m.id === (projDetail.projectManager as any).id;
                        return (
                          <button key={m.id} onClick={() => toggleUser(m.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition text-sm ${
                              on ? "bg-violet-50 border border-violet-200 text-violet-900"
                                 : "border border-transparent text-slate-500 hover:bg-slate-50"}`}>
                            <span className={`w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition ${on ? "bg-violet-600 border-violet-600" : "border-slate-300"}`}>
                              {on && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5l2.5 2.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </span>
                            <span className="flex-1 truncate font-medium">{m.name}</span>
                            {isPm && (
                              <span className="text-[10px] font-semibold text-sky-700 bg-sky-100 border border-sky-200 px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
                                PM
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-2 px-1">
                    {checkedCount > 0 ? `${checkedCount} user${checkedCount !== 1 ? "s" : ""} selected` : "All users"}
                  </p>
                </FilterCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 3 – Date Range */}
          <AnimatePresence>
            {projId && (
              <motion.div key="dates" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.04 }}>
                <FilterCard icon={<Calendar size={13} className="text-white" />} iconBg="bg-sky-600" title="Date Range" step="3">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">From</label>
                      <DatePicker value={dateFrom} onChange={(v) => { setDateFrom(v); setDataLoaded(false); }} placeholder="Start date" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">To</label>
                      <DatePicker value={dateTo} onChange={(v) => { setDateTo(v); setDataLoaded(false); }} placeholder="End date" min={dateFrom || undefined} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {QUICK.map((q) => (
                      <button key={q.label} onClick={q.apply}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-700 transition font-medium">
                        {q.label}
                      </button>
                    ))}
                  </div>
                </FilterCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Load Data button */}
          <AnimatePresence>
            {projId && (
              <motion.div key="load-btn" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.08 }}>
                <button onClick={loadData} disabled={!canLoad || loadingData}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {loadingData
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Loading…</>
                    : <><RefreshCw size={14} /> {dataLoaded ? "Reload Data" : "Load Data"}</>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ═══ RIGHT MAIN ═══ */}
        <div className="space-y-4 min-w-0">

          {/* Empty states */}
          {!projId && <EmptyState icon={<FileText size={40} className="text-slate-200" />} title="Select a project to begin" sub="Use the panel on the left to configure your report" />}
          {projId && !dataLoaded && !loadingData && !fetchError && (
            <EmptyState icon={<RefreshCw size={40} className="text-slate-200" />} title="Ready to load" sub='Configure filters and click "Load Data"' />
          )}
          {fetchError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{fetchError}</p>
            </motion.div>
          )}

          {dataLoaded && (
            <>
              {/* ── Stat cards ── */}
              {summary && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Entries"      value={summary.count}           icon={<ListTodo size={14} />}       color="blue"   />
                  <StatCard label="Total Hours"  value={`${summary.totalHours}h`} icon={<Clock size={14} />}          color="violet" />
                  <StatCard
                    label="Total Billing"
                    value={grandTotal.totalBilling != null ? fmtMoney(grandTotal.totalBilling, billCurrency) : "—"}
                    icon={<IndianRupee size={14} />}
                    color={grandTotal.totalBilling != null ? "green" : "slate"}
                    sub={anyRateSet ? `${billCurrency} · per-user rates` : "Set rates below"}
                  />
                  <StatCard label="Contributors" value={summary.byUser.length}   icon={<Users size={14} />}          color="orange" />
                </motion.div>
              )}

              {/* ── Per-user hours breakdown ── */}
              {summary && summary.byUser.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <button onClick={() => setSummaryOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2">
                      <BarChart2 size={14} className="text-slate-400" />
                      <span className="text-sm font-semibold text-slate-700">Hours per user</span>
                    </div>
                    {summaryOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {summaryOpen && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="divide-y divide-slate-50">
                          {summary.byUser.map((u, i) => {
                            const pct = summary.totalHours > 0 ? (u.hours / summary.totalHours) * 100 : 0;
                            return (
                              <div key={i} className="px-4 py-3.5">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} text-white text-[10px] font-bold flex items-center justify-center`}>
                                      {u.name[0]?.toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium text-slate-800">{u.name}</span>
                                    <span className="text-[11px] text-slate-400">{u.entries} entr{u.entries !== 1 ? "ies" : "y"}</span>
                                  </div>
                                  <span className="text-sm font-bold text-slate-700">{u.hours}h</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.55, delay: i * 0.06, ease: "easeOut" }}
                                    className="h-full bg-indigo-500 rounded-full" />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5">{pct.toFixed(1)}% of total</p>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════
                  BILLING SECTION
              ════════════════════════════════════════════════════ */}
              {entries.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden">

                  {/* Section header */}
                  <button onClick={() => setBillingOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-4 py-3.5 border-b border-slate-100 hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center flex-shrink-0">
                        <Calculator size={13} className="text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-slate-800">Billing Configuration</p>
                        <p className="text-[11px] text-slate-400">Set per-user hourly rate · auto-calculates totals</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {anyRateSet && grandTotal.totalBilling != null && (
                        <span className="text-sm font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
                          {fmtMoney(grandTotal.totalBilling, billCurrency)}
                        </span>
                      )}
                      {billingOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {billingOpen && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="p-4 space-y-4">

                          {/* Controls: Currency + View toggle */}
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Currency selector */}
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Currency</label>
                              <select
                                value={billCurrency}
                                onChange={(e) => setBillCurrency(e.target.value)}
                                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                              >
                                {CURRENCIES.map((c) => (
                                  <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                                ))}
                              </select>
                            </div>

                            {/* View toggle */}
                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 ml-auto">
                              {(["daily","weekly","monthly"] as BillingView[]).map((v) => (
                                <button key={v} onClick={() => setBillingView(v)}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition capitalize ${
                                    billingView === v ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Per-user billing cards */}
                          {uniqueUsers.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-6">No users found in the loaded data.</p>
                          ) : (
                            <div className="space-y-4">
                              {billingBreakdown.map((u, ui) => {
                                const sym     = currencySymbol(billCurrency);
                                const rateKey = String(u.userId);
                                return (
                                  <div key={u.userId}
                                    className="border border-slate-200 rounded-xl overflow-hidden">

                                    {/* User header + rate input */}
                                    <div className={`flex items-center justify-between px-4 py-3 ${
                                      u.rate > 0 ? "bg-green-50 border-b border-green-100" : "bg-slate-50 border-b border-slate-100"}`}>
                                      <div className="flex items-center gap-2.5">
                                        <div className={`w-7 h-7 rounded-full ${AVATAR_COLORS[ui % AVATAR_COLORS.length]} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}>
                                          {u.userName[0]?.toUpperCase()}
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-1.5">
                                            <p className="text-sm font-semibold text-slate-800">{u.userName}</p>
                                            {u.isPM && (
                                              <span className="text-[10px] font-semibold text-sky-700 bg-sky-100 border border-sky-200 px-1.5 py-0.5 rounded-full leading-none">
                                                PM
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[11px] text-slate-400">{u.totalHours}h logged</p>
                                        </div>
                                      </div>

                                      {/* Rate input */}
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-slate-500">Rate:</span>
                                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-slate-900">
                                          <span className="px-2.5 py-2 text-sm font-semibold text-slate-500 bg-slate-50 border-r border-slate-200 select-none">
                                            {sym}
                                          </span>
                                          <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={userRates[rateKey] ?? ""}
                                            onChange={(e) =>
                                              setUserRates((prev) => ({ ...prev, [rateKey]: e.target.value }))
                                            }
                                            placeholder="0"
                                            className="w-24 px-2.5 py-2 text-sm focus:outline-none text-right"
                                          />
                                          <span className="px-2.5 py-2 text-xs text-slate-400 bg-slate-50 border-l border-slate-200 select-none whitespace-nowrap">
                                            /hr
                                          </span>
                                        </div>
                                        {u.totalBilling != null && (
                                          <span className="text-sm font-bold text-green-700 bg-green-100 border border-green-200 px-2.5 py-1 rounded-lg whitespace-nowrap">
                                            = {fmtMoney(u.totalBilling, billCurrency)}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Period breakdown table */}
                                    {u.rows.length === 0 ? (
                                      <p className="text-xs text-slate-400 text-center py-4">No entries in this period.</p>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="border-b border-slate-100">
                                              <th className="text-left px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                                                {billingView === "daily" ? "Date" : billingView === "weekly" ? "Week" : "Month"}
                                              </th>
                                              <th className="text-right px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Hours</th>
                                              <th className="text-right px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                                                {u.rate > 0 ? `Amount (${billCurrency})` : "Rate not set"}
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-50">
                                            {u.rows.map((row, ri) => (
                                              <tr key={ri} className="hover:bg-slate-50/50 transition">
                                                <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{row.label}</td>
                                                <td className="px-4 py-2.5 text-xs font-semibold text-slate-800 text-right whitespace-nowrap">
                                                  {row.hours}h
                                                </td>
                                                <td className="px-4 py-2.5 text-xs text-right whitespace-nowrap">
                                                  {row.billing != null ? (
                                                    <span className="font-bold text-green-700">{fmtMoney(row.billing, billCurrency)}</span>
                                                  ) : (
                                                    <span className="text-slate-300">—</span>
                                                  )}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                          <tfoot>
                                            <tr className={`border-t-2 ${u.rate > 0 ? "border-green-200 bg-green-50/60" : "border-slate-200 bg-slate-50"}`}>
                                              <td className="px-4 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wide">Total</td>
                                              <td className="px-4 py-2.5 text-xs font-bold text-slate-900 text-right">{u.totalHours}h</td>
                                              <td className="px-4 py-2.5 text-xs text-right">
                                                {u.totalBilling != null ? (
                                                  <span className="font-bold text-green-800 text-sm">{fmtMoney(u.totalBilling, billCurrency)}</span>
                                                ) : (
                                                  <span className="text-slate-300 text-xs">Enter rate above</span>
                                                )}
                                              </td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Grand Total row */}
                              {uniqueUsers.length > 1 && (
                                <div className="flex items-center justify-between px-5 py-4 bg-slate-900 rounded-xl">
                                  <div className="flex items-center gap-2">
                                    <DollarSign size={16} className="text-slate-400" />
                                    <span className="text-sm font-bold text-white">Grand Total</span>
                                    <span className="text-xs text-slate-400">{uniqueUsers.length} users</span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Hours</p>
                                      <p className="text-base font-bold text-white">{grandTotal.totalHours}h</p>
                                    </div>
                                    {grandTotal.totalBilling != null && (
                                      <div className="text-right">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Billing</p>
                                        <p className="text-base font-bold text-green-400">
                                          {fmtMoney(grandTotal.totalBilling, billCurrency)}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* ── Raw entries table ── */}
              {entries.length === 0 ? (
                <EmptyState icon={<Clock size={40} className="text-slate-200" />}
                  title="No timesheet entries found"
                  sub="Try changing the date range or user selection" />
              ) : (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <ListTodo size={14} className="text-slate-400" />
                    <p className="text-sm font-semibold text-slate-700">
                      Timesheet entries
                      <span className="ml-2 text-slate-400 font-normal">
                        {entries.length} rows · {summary?.totalHours}h
                      </span>
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {["Date","User","Task","Description","Hours","Status"].map((h) => (
                            <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {entries.map((e) => (
                          <tr key={e.id} className="hover:bg-slate-50/60 transition">
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{fmtDate(e.date)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-slate-200 text-[9px] font-bold text-slate-600 flex items-center justify-center flex-shrink-0">
                                  {(e.user?.name ?? "U")[0].toUpperCase()}
                                </div>
                                <span className="text-xs font-medium text-slate-800">{e.user?.name ?? `User ${e.userId}`}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-indigo-600 whitespace-nowrap">
                              {e.task?.name ?? <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px]">
                              <span className="block truncate">{e.description || <span className="text-slate-300">—</span>}</span>
                            </td>
                            <td className="px-4 py-3 text-right text-xs font-bold text-slate-800 whitespace-nowrap">{e.hours}h</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border font-semibold ${STATUS_PILL[e.status ?? "PENDING"]}`}>
                                {e.status ?? "PENDING"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-200">
                          <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wide">Total</td>
                          <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-900">{summary?.totalHours}h</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-components
═══════════════════════════════════════════════════════════════════ */
function FilterCard({
  icon, iconBg, title, step, children, action,
}: {
  icon: React.ReactNode; iconBg: string; title: string; step: string;
  children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded-full">Step {step}</span>
        </div>
        {action}
      </div>
      <div className="px-5 py-4 rounded-b-xl">{children}</div>
    </div>
  );
}

type StatColor = "blue" | "violet" | "green" | "orange" | "slate";
const STAT_COLOR: Record<StatColor, string> = {
  blue:   "bg-blue-50 text-blue-600 border-blue-100",
  violet: "bg-violet-50 text-violet-600 border-violet-100",
  green:  "bg-green-50 text-green-600 border-green-100",
  orange: "bg-orange-50 text-orange-600 border-orange-100",
  slate:  "bg-slate-100 text-slate-400 border-slate-200",
};

function StatCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: React.ReactNode; color: StatColor; sub?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border ${STAT_COLOR[color]} mb-3`}>{icon}</div>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-0.5 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="mb-4 opacity-60">{icon}</div>
      <p className="text-slate-400 font-semibold">{title}</p>
      <p className="text-slate-300 text-sm mt-1">{sub}</p>
    </div>
  );
}
