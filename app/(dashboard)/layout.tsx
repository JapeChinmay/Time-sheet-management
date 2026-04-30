"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

import {
  LayoutDashboard,
  Clock,
  Folder,
  Users,
  Shield,
  LogOut,
  Menu,
  X,
  ListTodo,
  ScrollText,
  ClipboardCheck,
  Bug,
  Bell,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Search,
  Loader2,
  FolderOpen,
  ListChecks,
  User2,
  BugPlay,
  PartyPopper,
  Sparkles,
  Calendar,
  KeyRound,
  Eye,
  EyeOff,
  Palmtree,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface JwtPayload {
  sub: number;
  id?: number;
  email: string;
  name: string;
  role: string;
}

interface BugNotification {
  id: number;
  title: string;
  description: string;
  status: "UNRESOLVED" | "RESOLVED";
  createdAt: string;
  updatedAt: string;
  reportedBy?: { name: string };
}

interface SearchResults {
  projects: { id: number; name: string; clientName: string | null; status: string }[];
  tasks: { id: number; name: string; status: string; projectId: number }[];
  users: { id: number; name: string; email: string; role: string; designation: string | null }[];
  bugReports: { id: number; title: string; status: string }[];
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function decodeJwt(): JwtPayload | null {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    return JSON.parse(atob(token.split(".")[1])) as JwtPayload;
  } catch {
    return null;
  }
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const ROLE_COLOR: Record<string, string> = {
  SUPERADMIN: "bg-violet-600",
  ADMIN: "bg-blue-600",
  INTERNAL: "bg-emerald-600",
  EXTERNAL: "bg-amber-500",
};

const ROLE_BADGE: Record<string, string> = {
  SUPERADMIN: "bg-violet-100 text-violet-700",
  ADMIN: "bg-blue-100 text-blue-700",
  INTERNAL: "bg-emerald-100 text-emerald-700",
  EXTERNAL: "bg-amber-100 text-amber-700",
};

const PAGE_TITLES: Record<string, string> = {
  "/employee": "Dashboard",
  "/employee/timesheet": "Timesheet",
  "/employee/projects": "Projects",
  "/employee/tasks": "Tasks",
  "/employee/users": "Users",
  "/admin": "Admin Overview",
  "/admin/audit-logs": "Activity Logs",
  "/admin/timesheets": "Timesheet Approval",
  "/manager/timesheets": "Timesheet Approval",
  "/manager/leaves":        "Leave Approval",
  "/employee/leaves":       "My Leaves",
  "/admin/leave-policies":  "Leave Policies",
  "/support/report-bug":    "Report Bug",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/employee/projects/")) return "Project Details";
  if (pathname.startsWith("/admin/users/")) return "User Details";
  return "WorkPulse";
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

const STATUS_DOT: Record<string, string> = {
  ACTIVE: "bg-emerald-400",
  INACTIVE: "bg-slate-300",
  CREATED: "bg-slate-400",
  ASSIGNED: "bg-blue-400",
  WORK_IN_PROGRESS: "bg-amber-400",
  ON_HOLD: "bg-rose-400",
  UNRESOLVED: "bg-rose-400",
  RESOLVED: "bg-emerald-400",
};

/* ─── useDebounce ──────────────────────────────────────────────────────── */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ─── localStorage helpers ────────────────────────────────────────────── */
function getSeenResolvedIds(userId: number): Set<number> {
  try {
    const raw = localStorage.getItem(`wp_seen_resolved_${userId}`);
    return raw ? new Set<number>(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenResolvedIds(userId: number, ids: number[]) {
  try {
    // merge with existing so we never "unsee" something
    const existing = getSeenResolvedIds(userId);
    ids.forEach((id) => existing.add(id));
    localStorage.setItem(
      `wp_seen_resolved_${userId}`,
      JSON.stringify([...existing]),
    );
  } catch { }
}

/* ════════════════════════════════════════════════════════════════════════
   ResolvedBugsModal
   ════════════════════════════════════════════════════════════════════════ */
function ResolvedBugsModal({
  bugs,
  onDismiss,
}: {
  bugs: BugNotification[];
  onDismiss: () => void;
}) {
  const [idx, setIdx] = useState(0);          // which bug is shown (carousel)
  const current = bugs[idx];
  const total = bugs.length;

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 26 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* ── Coloured header band ── */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 pt-7 pb-8 text-white relative overflow-hidden">
          {/* decorative sparkle circles */}
          <span className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
          <span className="absolute bottom-2 left-2 w-12 h-12 rounded-full bg-white/10" />

          <div className="relative flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <PartyPopper size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100 mb-1">
                Bug Resolved
              </p>
              <h2 className="text-xl font-bold leading-snug">
                {total === 1
                  ? "Your bug has been fixed!"
                  : `${total} bugs resolved since your last visit`}
              </h2>
              <p className="text-sm text-emerald-100 mt-1">
                The team has addressed{" "}
                {total === 1 ? "an issue" : "some issues"} you reported.
              </p>
            </div>
          </div>

          {/* Carousel dots (only when > 1 bug) */}
          {total > 1 && (
            <div className="relative flex items-center justify-center gap-1.5 mt-5">
              {bugs.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-white w-4" : "bg-white/40"
                    }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Bug detail card ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            className="px-6 py-5 space-y-3"
          >
            {/* Title */}
            <div className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-sm font-semibold text-slate-800 leading-snug">
                {current.title}
              </p>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 ml-6">
              {current.description}
            </p>

            {/* Meta row */}
            <div className="ml-6 flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                Resolved {fmtDate(current.updatedAt)}
              </span>
              {current.reportedBy && (
                <span className="flex items-center gap-1">
                  <Sparkles size={11} className="text-emerald-400" />
                  Reported by {current.reportedBy.name}
                </span>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── Footer actions ── */}
        <div className="px-6 pb-6 flex items-center gap-3">
          {/* Prev / Next when multiple bugs */}
          {total > 1 && (
            <div className="flex gap-2 mr-auto">
              <button
                onClick={() => setIdx((p) => Math.max(0, p - 1))}
                disabled={idx === 0}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500
                           hover:bg-slate-50 disabled:opacity-30 transition"
              >
                ← Prev
              </button>
              <button
                onClick={() => setIdx((p) => Math.min(total - 1, p + 1))}
                disabled={idx === total - 1}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500
                           hover:bg-slate-50 disabled:opacity-30 transition"
              >
                Next →
              </button>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onDismiss}
            className="ml-auto flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700
                       text-white text-sm font-medium px-5 py-2.5 rounded-xl transition"
          >
            <CheckCircle2 size={15} />
            Got it, thanks!
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   GlobalSearch component
   ════════════════════════════════════════════════════════════════════════ */
function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQ = useDebounce(query, 300);

  /* fetch on debounced query change */
  useEffect(() => {
    if (debouncedQ.trim().length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }
    setLoading(true);
    apiFetch(`/search?q=${encodeURIComponent(debouncedQ.trim())}`)
      .then((data: SearchResults) => {
        setResults(data);
        setOpen(true);
      })
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, [debouncedQ]);

  /* close on outside click */
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const totalHits =
    (results?.projects.length ?? 0) +
    (results?.tasks.length ?? 0) +
    (results?.users.length ?? 0) +
    (results?.bugReports.length ?? 0);

  const navigate = (href: string) => {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(href);
  };

  return (
    <div ref={wrapRef} className="relative flex-1 max-w-sm">
      {/* Input */}
      <div className="relative flex items-center">
        <Search
          size={14}
          className="absolute left-3 text-slate-400 pointer-events-none"
        />
        {loading && (
          <Loader2
            size={13}
            className="absolute right-3 text-slate-400 animate-spin pointer-events-none"
          />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results && totalHits > 0) setOpen(true); }}
          placeholder="Search projects, tasks, users…"
          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-700
                     placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-300
                     focus:bg-white transition"
        />
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {open && results && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-10 w-full min-w-[340px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50"
          >
            {totalHits === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                <Search size={20} strokeWidth={1.5} />
                <p className="text-sm">No results for &ldquo;{query}&rdquo;</p>
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-50">

                {/* Projects */}
                {results.projects.length > 0 && (
                  <SearchSection title="Projects" icon={<FolderOpen size={12} />}>
                    {results.projects.map((p) => (
                      <SearchRow
                        key={`proj-${p.id}`}
                        icon={<FolderOpen size={13} className="text-blue-500" />}
                        title={p.name}
                        subtitle={p.clientName ?? `#${p.id}`}
                        dot={STATUS_DOT[p.status]}
                        onClick={() => navigate(`/employee/projects/${p.id}`)}
                      />
                    ))}
                  </SearchSection>
                )}

                {/* Tasks */}
                {results.tasks.length > 0 && (
                  <SearchSection title="Tasks" icon={<ListChecks size={12} />}>
                    {results.tasks.map((t) => (
                      <SearchRow
                        key={`task-${t.id}`}
                        icon={<ListChecks size={13} className="text-amber-500" />}
                        title={t.name}
                        subtitle={t.status.replace(/_/g, " ")}
                        dot={STATUS_DOT[t.status]}
                        onClick={() => navigate(`/employee/tasks`)}
                      />
                    ))}
                  </SearchSection>
                )}

                {/* Users */}
                {results.users.length > 0 && (
                  <SearchSection title="Users" icon={<User2 size={12} />}>
                    {results.users.map((u) => (
                      <SearchRow
                        key={`user-${u.id}`}
                        icon={<User2 size={13} className="text-violet-500" />}
                        title={u.name}
                        subtitle={u.email}
                        badge={u.role}
                        onClick={() => navigate(`/admin/users/${u.id}`)}
                      />
                    ))}
                  </SearchSection>
                )}

                {/* Bug Reports */}
                {results.bugReports.length > 0 && (
                  <SearchSection title="Bug Reports" icon={<BugPlay size={12} />}>
                    {results.bugReports.map((b) => (
                      <SearchRow
                        key={`bug-${b.id}`}
                        icon={<BugPlay size={13} className="text-rose-500" />}
                        title={b.title}
                        subtitle={b.status}
                        dot={STATUS_DOT[b.status]}
                        onClick={() => navigate(`/support/report-bug`)}
                      />
                    ))}
                  </SearchSection>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                {totalHits} result{totalHits !== 1 ? "s" : ""}
              </span>
              <span className="text-[10px] text-slate-400">
                Press <kbd className="bg-slate-100 rounded px-1 py-0.5 font-mono">Esc</kbd> to close
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Search sub-components ──────────────────────────────────────────── */
function SearchSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
        <span className="text-slate-400">{icon}</span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function SearchRow({
  icon,
  title,
  subtitle,
  dot,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  dot?: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition text-left"
    >
      <span className="shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate">{title}</p>
        <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
      </div>
      {dot && (
        <span className={`shrink-0 w-2 h-2 rounded-full ${dot}`} />
      )}
      {badge && (
        <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
          {badge}
        </span>
      )}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   TopBar
   ════════════════════════════════════════════════════════════════════════ */
function TopBar({
  user,
  isAdmin,
  onLogout,
}: {
  user: JwtPayload | null;
  isAdmin: boolean;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  /* ── Notifications ── */
  const [notes, setNotes] = useState<BugNotification[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);

  /* ── Profile ── */
  const [profOpen, setProfOpen] = useState(false);
  const profRef = useRef<HTMLDivElement>(null);

  /* ── Change password modal ── */
  const [showPwdModal, setShowPwdModal]   = useState(false);
  const [currentPwd, setCurrentPwd]       = useState("");
  const [newPwd, setNewPwd]               = useState("");
  const [confirmPwd, setConfirmPwd]       = useState("");
  const [showCurPwd, setShowCurPwd]       = useState(false);
  const [showNewPwd, setShowNewPwd]       = useState(false);
  const [showConfPwd, setShowConfPwd]     = useState(false);
  const [savingPwd, setSavingPwd]         = useState(false);
  const [pwdErr, setPwdErr]               = useState("");
  const [pwdSuccess, setPwdSuccess]       = useState(false);

  const openPwdModal = () => {
    setProfOpen(false);
    setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    setShowCurPwd(false); setShowNewPwd(false); setShowConfPwd(false);
    setPwdErr(""); setPwdSuccess(false);
    setShowPwdModal(true);
  };

  const changePassword = async () => {
    setPwdErr("");
    if (!currentPwd)           { setPwdErr("Current password is required."); return; }
    if (newPwd.length < 6)     { setPwdErr("New password must be at least 6 characters."); return; }
    if (newPwd !== confirmPwd) { setPwdErr("Passwords do not match."); return; }
    if (newPwd === currentPwd) { setPwdErr("New password must differ from the current one."); return; }
    setSavingPwd(true);
    try {
      const userId = user?.sub ?? (user as any)?.id;
      await apiFetch(`/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: currentPwd, password: newPwd }),
      });
      setPwdSuccess(true);
      setTimeout(() => { setShowPwdModal(false); setPwdSuccess(false); }, 1400);
    } catch (e: any) {
      setPwdErr(e.message ?? "Failed to update password.");
    } finally {
      setSavingPwd(false);
    }
  };

  /* fetch notifications */
  useEffect(() => {
    apiFetch("/bug-reports")
      .then((data: BugNotification[]) => {
        const list = Array.isArray(data) ? data : [];
        setNotes(list.filter((n) => n.status === "UNRESOLVED").slice(0, 15));
      })
      .catch(() => { });
  }, []);

  /* outside-click */
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (notesRef.current && !notesRef.current.contains(e.target as Node))
        setNotesOpen(false);
      if (profRef.current && !profRef.current.contains(e.target as Node))
        setProfOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const unreadCount = notes.length;

  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-14 flex items-center px-5 gap-4 shadow-sm">

      {/* Page title — hidden on small screens to give search room */}
      <h2 className="hidden lg:block text-sm font-semibold text-slate-800 whitespace-nowrap shrink-0">
        {pageTitle}
      </h2>

      {/* Divider */}
      <div className="hidden lg:block w-px h-5 bg-slate-200 shrink-0" />

      {/* ── Global Search ── */}
      <GlobalSearch />

      {/* Right-side actions */}
      <div className="flex items-center gap-1 shrink-0 ml-auto">

        {/* ── Notification bell ── */}
        <div className="relative" ref={notesRef}>
          <button
            onClick={() => { setNotesOpen((p) => !p); setProfOpen(false); }}
            className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notesOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-11 w-80 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <span className="text-sm font-semibold text-slate-800">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-xs bg-rose-100 text-rose-600 rounded-full px-2 py-0.5 font-medium">
                      {unreadCount} unresolved
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                  {notes.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                      <CheckCircle2 size={22} strokeWidth={1.5} />
                      <p className="text-sm">No new notifications</p>
                    </div>
                  ) : (
                    notes.map((n) => (
                      <Link
                        key={n.id}
                        href="/support/report-bug"
                        onClick={() => setNotesOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition"
                      >
                        <span className="mt-0.5 shrink-0 w-2 h-2 rounded-full bg-rose-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">{n.title}</p>
                          {isAdmin && n.reportedBy && (
                            <p className="text-xs text-slate-400 truncate">by {n.reportedBy.name}</p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-0.5">{fmtRelative(n.createdAt)}</p>
                        </div>
                        <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                      </Link>
                    ))
                  )}
                </div>

                <div className="border-t border-slate-100 px-4 py-2.5">
                  <Link
                    href="/support/report-bug"
                    onClick={() => setNotesOpen(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 transition"
                  >
                    View all bug reports →
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── User profile ── */}
        <div className="relative" ref={profRef}>
          <button
            onClick={() => { setProfOpen((p) => !p); setNotesOpen(false); }}
            className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-lg hover:bg-slate-100 transition"
          >
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0
                ${ROLE_COLOR[user.role] ?? "bg-slate-600"}`}
            >
              {initials(user.name)}
            </span>
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-xs font-semibold text-slate-800 max-w-[100px] truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400">{user.role}</p>
            </div>
            <ChevronDown
              size={13}
              className={`text-slate-400 transition-transform duration-200 ${profOpen ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
            {profOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-11 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0
                      ${ROLE_COLOR[user.role] ?? "bg-slate-600"}`}
                  >
                    {initials(user.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    <span
                      className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                        ${ROLE_BADGE[user.role] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {user.role}
                    </span>
                  </div>
                </div>

                <div className="py-1.5">
                  <button
                    onClick={openPwdModal}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition"
                  >
                    <KeyRound size={15} className="text-slate-400" />
                    Change Password
                  </button>
                  <div className="mx-4 my-1 border-t border-slate-100" />
                  <button
                    onClick={() => { setProfOpen(false); onLogout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
              transition={{ duration: 0.18 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-xl"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                    <KeyRound size={14} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900 text-sm">Change Password</h2>
                    <p className="text-xs text-slate-400">{user?.name}</p>
                  </div>
                </div>
                <button onClick={() => setShowPwdModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">

                {/* Current password */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Current Password</label>
                  <div className="relative">
                    <input
                      autoFocus
                      type={showCurPwd ? "text" : "password"}
                      value={currentPwd}
                      onChange={(e) => setCurrentPwd(e.target.value)}
                      placeholder="Your current password"
                      className="w-full border border-slate-200 px-3 py-2.5 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
                    />
                    <button type="button" onClick={() => setShowCurPwd((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                      {showCurPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

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
                    />
                    <button type="button" onClick={() => setShowNewPwd((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                      {showNewPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {newPwd.length > 0 && newPwd.length < 6 && (
                    <p className="text-xs text-red-500 mt-1">At least 6 characters required.</p>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfPwd ? "text" : "password"}
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full border border-slate-200 px-3 py-2.5 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
                    />
                    <button type="button" onClick={() => setShowConfPwd((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
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
                  disabled={savingPwd || !currentPwd || newPwd.length < 6 || newPwd !== confirmPwd}
                  className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
    </header>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Dashboard Layout
   ════════════════════════════════════════════════════════════════════════ */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<JwtPayload | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [isPM, setIsPM] = useState(false);
  const [open, setOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  /* ── Resolved-bug login modal ── */
  const [resolvedBugs, setResolvedBugs] = useState<BugNotification[]>([]);
  const [showResolvedModal, setShowResolvedModal] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  useEffect(() => {
    const payload = decodeJwt();
    if (payload) {
      setUser(payload);
      setUserId(payload.sub ?? payload.id ?? null);
    }
  }, []);

  /* ── Check for newly resolved bugs on login ── */
  useEffect(() => {
    if (!userId) return;
    apiFetch("/bug-reports")
      .then((data: BugNotification[]) => {
        const list = Array.isArray(data) ? data : [];
        const seen = getSeenResolvedIds(userId);
        const newlyResolved = list.filter(
          (b) => b.status === "RESOLVED" && !seen.has(b.id),
        );
        if (newlyResolved.length > 0) {
          setResolvedBugs(newlyResolved);
          setShowResolvedModal(true);
        }
      })
      .catch(() => { });
  }, [userId]);

  const dismissResolvedModal = () => {
    if (userId) saveSeenResolvedIds(userId, resolvedBugs.map((b) => b.id));
    setShowResolvedModal(false);
  };

  useEffect(() => {
    if (!userId) return;
    apiFetch(`/projects?filter=projectManagerId||$eq||${userId}&limit=1`)
      .then((res) => {
        const data = Array.isArray(res) ? res : res.data ?? [];
        setIsPM(data.length > 0);
      })
      .catch(() => { });
  }, [userId]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  const isActive = (path: string) => pathname === path;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">

      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed top-4 left-4 z-50 bg-white border p-2 rounded-md shadow"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* ── Mobile backdrop — tap outside to close ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="md:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <motion.div
        initial={{ x: -250 }}
        animate={{ x: open || (typeof window !== "undefined" && window.innerWidth >= 768) ? 0 : -250 }}
        className="fixed md:sticky md:top-0 z-40 w-64 h-screen overflow-y-auto shrink-0 bg-white border-r border-slate-200 p-5 flex flex-col"
      >
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800 tracking-tight">WorkPulse</h2>
          <p className="text-xs text-slate-400">Workforce Intelligence</p>
        </div>

        <nav className="space-y-1 text-sm">
          <SidebarItem icon={<LayoutDashboard size={16} />} label="Dashboard"  href="/employee"           active={isActive("/employee")}                        onClose={() => setOpen(false)} />
          <SidebarItem icon={<Clock size={16} />}           label="Timesheet"  href="/employee/timesheet"  active={isActive("/employee/timesheet")}              onClose={() => setOpen(false)} />
          <SidebarItem icon={<Folder size={16} />}          label="Projects"   href="/employee/projects"   active={isActive("/employee/projects")}               onClose={() => setOpen(false)} />
          <SidebarItem icon={<ListTodo size={16} />}        label="Tasks"      href="/employee/tasks"      active={pathname.startsWith("/employee/tasks")}       onClose={() => setOpen(false)} />
          <SidebarItem icon={<Palmtree size={16} />}        label="Leaves"     href="/employee/leaves"     active={pathname.startsWith("/employee/leaves")}      onClose={() => setOpen(false)} />

          {isPM && (
            <>
              <div className="border-t border-slate-200 my-3" />
              <p className="text-xs text-slate-400 uppercase px-2">Manager</p>
              <SidebarItem icon={<ClipboardCheck size={16} />} label="Timesheet Approval" href="/manager/timesheets" active={pathname.startsWith("/manager/timesheets")} onClose={() => setOpen(false)} />
              <SidebarItem icon={<Palmtree size={16} />}        label="Leave Approval"    href="/manager/leaves"     active={pathname.startsWith("/manager/leaves")}     onClose={() => setOpen(false)} />
            </>
          )}

          {isAdmin && (
            <>
              <div className="border-t border-slate-200 my-3" />
              <p className="text-xs text-slate-400 uppercase px-2">Admin</p>
              <SidebarItem icon={<Shield size={16} />}         label="Admin Overview"     href="/admin"              active={isActive("/admin")}                          onClose={() => setOpen(false)} />
              <SidebarItem icon={<Users size={16} />}          label="Users"              href="/employee/users"     active={isActive("/employee/users")}                 onClose={() => setOpen(false)} />
              <SidebarItem icon={<ClipboardCheck size={16} />} label="Timesheet Approval" href="/manager/timesheets" active={pathname.startsWith("/manager/timesheets")}  onClose={() => setOpen(false)} />
              <SidebarItem icon={<Palmtree size={16} />}        label="Leave Approval"    href="/manager/leaves"     active={pathname.startsWith("/manager/leaves")}      onClose={() => setOpen(false)} />
              <SidebarItem icon={<ScrollText size={16} />}     label="Leave Policies"     href="/admin/leave-policies" active={pathname.startsWith("/admin/leave-policies")} onClose={() => setOpen(false)} />
              <SidebarItem icon={<ScrollText size={16} />}     label="Activity Logs"      href="/admin/audit-logs"   active={pathname.startsWith("/admin/audit-logs")}    onClose={() => setOpen(false)} />
            </>
          )}

          <div className="border-t border-slate-200 my-3" />
          <p className="text-xs text-slate-400 uppercase px-2">Support</p>
          <SidebarItem icon={<Bug size={16} />} label="Report Bug" href="/support/report-bug" active={pathname.startsWith("/support/report-bug")} onClose={() => setOpen(false)} />
        </nav>

        {/* <div className="mt-auto pt-6 border-t border-slate-200">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition"
          >
            <LogOut size={16} />
            Logout
          </motion.button>
          <p className="text-xs text-slate-400 mt-4">v1.0 WorkPulse</p>
        </div> */}
      </motion.div>

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden md:ml-0">
        <TopBar user={user} isAdmin={isAdmin} onLogout={() => setShowLogoutModal(true)} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>

      {/* ── Resolved-bug login modal ── */}
      <AnimatePresence>
        {showResolvedModal && resolvedBugs.length > 0 && (
          <ResolvedBugsModal
            bugs={resolvedBugs}
            onDismiss={dismissResolvedModal}
          />
        )}
      </AnimatePresence>

      {/* ── Logout modal ── */}
      <AnimatePresence>
        {showLogoutModal && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-slate-200 rounded-xl p-6 w-full max-w-sm shadow-lg"
            >
              <h3 className="text-lg font-semibold text-slate-900">Confirm Logout</h3>
              <p className="text-sm text-slate-500 mt-2">
                Are you sure you want to log out of your session?
              </p>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 border border-slate-200 py-2 rounded-md text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 bg-red-500 text-white py-2 rounded-md text-sm hover:bg-red-600"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── SidebarItem ─────────────────────────────────────────────────────── */
function SidebarItem({
  icon, label, href, active, onClose,
}: {
  icon: React.ReactNode; label: string; href: string; active: boolean; onClose?: () => void;
}) {
  return (
    <Link href={href} onClick={onClose}>
      <motion.div
        whileHover={{ x: 3 }}
        className={`relative flex items-center gap-3 px-3 py-2 rounded-md transition
          ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
      >
        {active && (
          <motion.div
            layoutId="active-pill"
            className="absolute left-0 top-0 h-full w-1 bg-white rounded-r"
          />
        )}
        {icon}
        <span className="font-medium">{label}</span>
      </motion.div>
    </Link>
  );
}
