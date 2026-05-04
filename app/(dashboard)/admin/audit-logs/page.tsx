"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScrollText, Clock, Folder, ListTodo,
  Plus, Pencil, Trash2, ChevronLeft, ChevronRight, SlidersHorizontal, X,
} from "lucide-react";
import { addDays, format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { TablePageSkeleton } from "@/components/ui/skeletons";
import Combobox from "@/components/ui/Combobox";
import DatePicker from "@/components/ui/DatePicker";
import { parseUTC, fmtDateTime, timeAgo } from "@/lib/date";

type AuditEntity = "TIMESHEET" | "PROJECT" | "TASK";
type AuditAction = "CREATE" | "UPDATE" | "DELETE";

type Log = {
  id: number;
  entity: AuditEntity;
  entityId: number;
  entityName: string | null;
  action: AuditAction;
  userId: number;
  createdAt: string;
  user?: { id: number; name: string; email: string; role: string };
};

type ApiResponse = {
  data: Log[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type Filters = {
  entity:   AuditEntity | "";
  action:   AuditAction | "";
  userId:   string;
  dateFrom: string;
  dateTo:   string;
};

const EMPTY_FILTERS: Filters = { entity: "", action: "", userId: "", dateFrom: "", dateTo: "" };

const ENTITY_OPTIONS = [
  { value: "",           label: "All Entities"  },
  { value: "TIMESHEET",  label: "Timesheets"    },
  { value: "PROJECT",    label: "Projects"      },
  { value: "TASK",       label: "Tasks"         },
];

const ACTION_OPTIONS = [
  { value: "",        label: "All Actions" },
  { value: "CREATE",  label: "Create"      },
  { value: "UPDATE",  label: "Update"      },
  { value: "DELETE",  label: "Delete"      },
];

const ENTITY_META: Record<AuditEntity, { icon: React.ReactNode; bg: string; text: string; label: string }> = {
  TIMESHEET: { icon: <Clock size={12} />,    bg: "bg-sky-100",    text: "text-sky-700",    label: "Timesheet" },
  PROJECT:   { icon: <Folder size={12} />,   bg: "bg-violet-100", text: "text-violet-700", label: "Project"   },
  TASK:      { icon: <ListTodo size={12} />, bg: "bg-amber-100",  text: "text-amber-700",  label: "Task"      },
};

const ACTION_META: Record<AuditAction, { icon: React.ReactNode; bg: string; text: string }> = {
  CREATE: { icon: <Plus   size={12} />, bg: "bg-green-100", text: "text-green-700" },
  UPDATE: { icon: <Pencil size={12} />, bg: "bg-blue-100",  text: "text-blue-700"  },
  DELETE: { icon: <Trash2 size={12} />, bg: "bg-red-100",   text: "text-red-600"   },
};

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-rose-100 text-rose-700",
  ADMIN:      "bg-indigo-100 text-indigo-700",
  MANAGER:    "bg-teal-100 text-teal-700",
  HR:         "bg-pink-100 text-pink-700",
  INTERNAL:   "bg-slate-100 text-slate-600",
  EXTERNAL:   "bg-orange-100 text-orange-700",
  INTERN:     "bg-amber-100 text-amber-700",
};

function activeFilterCount(f: Filters) {
  return [f.entity, f.action, f.userId, f.dateFrom, f.dateTo].filter(Boolean).length;
}

export default function AuditLogsPage() {
  const [logs, setLogs]         = useState<Log[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filters, setFilters]   = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]       = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [users, setUsers]       = useState<{ id: number; name: string }[]>([]);
  const [, setTick] = useState(0);  // forces re-render every minute so "X ago" stays live
  const LIMIT = 50;

  const load = async (p: number, f: Filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (f.entity)   params.set("entity",   f.entity);
      if (f.action)   params.set("action",   f.action);
      if (f.userId)   params.set("userId",   f.userId);
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      /* dateTo: add 1 day so the selected date is inclusive */
      if (f.dateTo)   params.set("dateTo",   format(addDays(new Date(f.dateTo), 1), "yyyy-MM-dd"));
      const res: ApiResponse = await apiFetch(`/audit-logs?${params}`);
      setLogs(res.data ?? []);
      setTotal(res.total ?? 0);
      setTotalPages(res.totalPages ?? 1);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load(1, EMPTY_FILTERS);
    apiFetch("/users?limit=200&sort=name,ASC")
      .then((res: any) => setUsers(Array.isArray(res) ? res : res.data ?? []))
      .catch(() => {});

    /* re-render every 60 s so "X ago" text stays accurate */
    const tick = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(tick);
  }, []);

  const applyFilters = (f: Filters) => {
    setFilters(f);
    setPage(1);
    load(1, f);
  };

  const clearFilters = () => applyFilters(EMPTY_FILTERS);

  const changePage = (p: number) => {
    setPage(p);
    load(p, filters);
  };

  const setF = (k: keyof Filters) => (val: string) =>
    setFilters((prev) => ({ ...prev, [k]: val }));

  const activeCnt = activeFilterCount(filters);

  if (loading && logs.length === 0) return <TablePageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 flex items-center gap-2">
            <ScrollText size={24} className="text-slate-500" />
            Activity Logs
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Audit trail — {total} {activeCnt > 0 ? "filtered" : "total"} entries
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeCnt > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition"
            >
              <X size={13} /> Clear filters
            </button>
          )}
          <button
            onClick={() => load(page, filters)}
            disabled={loading}
            title="Reload latest activity"
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition disabled:opacity-40"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-slate-400" : "text-slate-500"} />
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition ${
              showFilters || activeCnt > 0
                ? "bg-slate-900 text-white border-slate-900"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeCnt > 0 && (
              <span className="ml-1 bg-white text-slate-900 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {activeCnt}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Filter by</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">

                {/* Entity */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Entity type</label>
                  <Combobox value={filters.entity} onChange={setF("entity")} options={ENTITY_OPTIONS} />
                </div>

                {/* Action */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Action</label>
                  <Combobox value={filters.action} onChange={setF("action")} options={ACTION_OPTIONS} />
                </div>

                {/* User */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Performed by</label>
                  <Combobox
                    value={filters.userId}
                    onChange={setF("userId")}
                    placeholder="All users"
                    searchable
                    options={[
                      { value: "", label: "All users" },
                      ...users.map((u) => ({ value: String(u.id), label: u.name })),
                    ]}
                  />
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Date from</label>
                  <DatePicker
                    value={filters.dateFrom}
                    onChange={setF("dateFrom")}
                    placeholder="From date"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Date to</label>
                  <DatePicker
                    value={filters.dateTo}
                    onChange={setF("dateTo")}
                    placeholder="To date"
                    min={filters.dateFrom || undefined}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => applyFilters(filters)}
                  className="px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition"
                >
                  Apply Filters
                </button>
                {activeCnt > 0 && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 border border-slate-200 text-sm rounded-lg hover:bg-slate-50 transition text-slate-600"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active filter chips */}
      {activeCnt > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">Active:</span>
          {filters.entity && (
            <FilterChip label={`Entity: ${filters.entity}`} onRemove={() => applyFilters({ ...filters, entity: "" })} />
          )}
          {filters.action && (
            <FilterChip label={`Action: ${filters.action}`} onRemove={() => applyFilters({ ...filters, action: "" })} />
          )}
          {filters.userId && (
            <FilterChip
              label={`User: ${users.find((u) => String(u.id) === filters.userId)?.name ?? `#${filters.userId}`}`}
              onRemove={() => applyFilters({ ...filters, userId: "" })}
            />
          )}
          {filters.dateFrom && (
            <FilterChip label={`From: ${filters.dateFrom}`} onRemove={() => applyFilters({ ...filters, dateFrom: "" })} />
          )}
          {filters.dateTo && (
            <FilterChip label={`To: ${filters.dateTo}`} onRemove={() => applyFilters({ ...filters, dateTo: "" })} />
          )}
        </div>
      )}

      {/* Log list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <ScrollText size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No activity logs found</p>
          <p className="text-sm mt-1">
            {activeCnt > 0 ? "Try adjusting your filters." : "Actions will appear here as users create, update, or delete records."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <AnimatePresence initial={false}>
            {logs.map((log, i) => {
              const em = ENTITY_META[log.entity];
              const am = ACTION_META[log.action];
              const roleColor = ROLE_COLORS[log.user?.role ?? ""] ?? "bg-slate-100 text-slate-600";
              /* "about X ago" = formatDistanceToNow(createdAt, { addSuffix: true })
                 It computes the difference between NOW (client local time) and the UTC
                 timestamp returned by the server, so it always reflects real elapsed time. */
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.015, 0.15) }}
                  className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition"
                >
                  {/* Entity badge */}
                  <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${em.bg} ${em.text} flex-shrink-0`}>
                    {em.icon} {em.label}
                  </span>

                  {/* Action badge */}
                  <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${am.bg} ${am.text} flex-shrink-0`}>
                    {am.icon} {log.action}
                  </span>

                  {/* Entity name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {log.entityName ?? `#${log.entityId}`}
                    </p>
                    {log.entityName && (
                      <p className="text-[11px] text-slate-400">ID #{log.entityId}</p>
                    )}
                  </div>

                  {/* Who did it */}
                  <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium text-slate-800 truncate max-w-[120px]">
                        {log.user?.name ?? `User #${log.userId}`}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate max-w-[120px]">
                        {log.user?.email}
                      </p>
                    </div>
                    {log.user?.role && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${roleColor}`}>
                        {log.user.role}
                      </span>
                    )}
                  </div>

                  {/* Timestamp — relative + absolute in browser local timezone */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-500">
                      {timeAgo(parseUTC(log.createdAt))}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {fmtDateTime(parseUTC(log.createdAt))}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages} &nbsp;·&nbsp; {total} entries
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => changePage(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
              const p = page <= 3 ? idx + 1 : page - 2 + idx;
              if (p < 1 || p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => changePage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                    p === page
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => changePage(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 pl-2.5 pr-1 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-700">
      {label}
      <button
        onClick={onRemove}
        className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-300 transition ml-0.5"
      >
        <X size={10} />
      </button>
    </span>
  );
}
