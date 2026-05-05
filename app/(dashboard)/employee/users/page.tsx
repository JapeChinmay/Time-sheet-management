"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import { TablePageSkeleton } from "@/components/ui/skeletons";
import { parseUTC } from "@/lib/date";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Eye, EyeOff, UserPlus, Search, Users } from "lucide-react";
import Combobox from "@/components/ui/Combobox";
import DatePicker from "@/components/ui/DatePicker";

type Project = {
  id: number;
  name: string;
};

const MODULE_LABEL: Record<string, string> = {
  SAP_BTP: "SAP BTP", SAP_MM: "SAP MM", SAP_FICO: "SAP FICO",
  SAP_SF: "SAP SF", SAP_SD: "SAP SD", SAP_HCM: "SAP HCM",
  SAP_ABAP: "SAP ABAP", SAP_PS: "SAP PS",
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
];

const ROLES_ALL       = ["SUPERADMIN", "ADMIN", "MANAGER", "HR", "INTERNAL", "EXTERNAL", "INTERN"];
const ROLES_FOR_ADMIN = ["MANAGER", "HR", "INTERNAL", "EXTERNAL", "INTERN"];
const ACTIVITY_LEVELS = ["Active", "Idle", "Inactive", "No Activity"] as const;
type ActivityLevel = typeof ACTIVITY_LEVELS[number];

function getActivity(u: User): ActivityLevel {
  if (!u.lastActive) return "No Activity";
  const diffDays = (Date.now() - new Date(u.lastActive).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 2) return "Active";
  if (diffDays <= 7) return "Idle";
  return "Inactive";
}

const ACTIVITY_BADGE: Record<ActivityLevel, string> = {
  "Active":      "bg-green-100 text-green-700",
  "Idle":        "bg-yellow-100 text-yellow-700",
  "Inactive":    "bg-red-100 text-red-700",
  "No Activity": "bg-slate-200 text-slate-600",
};

const ROLE_PILL: Record<string, string> = {
  SUPERADMIN: "bg-slate-800 text-white",
  ADMIN:      "bg-slate-200 text-slate-700",
  MANAGER:    "bg-teal-100 text-teal-700",
  HR:         "bg-pink-100 text-pink-700",
  INTERNAL:   "bg-indigo-100 text-indigo-700",
  EXTERNAL:   "bg-violet-100 text-violet-700",
  INTERN:     "bg-orange-100 text-orange-700",
};

const ALL_WEEKDAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"] as const;
const WEEKDAY_SHORT: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu",
  FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

const GENDER_OPTIONS = [
  { value: "",       label: "— Not specified —" },
  { value: "MALE",   label: "Male"              },
  { value: "FEMALE", label: "Female"            },
  { value: "OTHER",  label: "Other"             },
];

const EMPTY_CREATE = {
  name: "", email: "", password: "", role: "INTERNAL", designation: "", module: "", leavePolicyId: "",
  gender: "", hrId: "", birthdate: "",
  daysOff: ["SATURDAY", "SUNDAY"] as string[],
};


const INPUT = "w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white";

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  module?: string | null;
  lastActive?: string | null;
  projectId?: number | null;
  totalHours?: number;
};

   type Timesheet = {
  userId: number;
  projectId: number;
  date: string;
  hours: number;
};


export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* filters */
  const [search, setSearch]               = useState("");
  const [roleFilter, setRoleFilter]       = useState("ALL");
  const [activityFilter, setActivityFilter] = useState("ALL");
  const [moduleFilter, setModuleFilter]   = useState("");

  /* leave policies (for create-user selector) */
  const [policies, setPolicies] = useState<{ id: number; name: string }[]>([]);

  /* HR users (for create-user selector) */
  const [hrUsers, setHrUsers] = useState<{ id: number; name: string }[]>([]);

  /* create-user modal */
  const [showCreate, setShowCreate]   = useState(false);
  const [createForm, setCreateForm]   = useState(EMPTY_CREATE);
  const [showPwd, setShowPwd]         = useState(false);
  const [creating, setCreating]       = useState(false);
  const [createErr, setCreateErr]     = useState("");

  const { data: session } = useSession();
  const callerRole  = session?.user?.role ?? "";
  const isAdmin     = callerRole === "ADMIN" || callerRole === "SUPERADMIN";
  const isSuperAdmin = callerRole === "SUPERADMIN";
  const availableRoles = isSuperAdmin ? ROLES_ALL : ROLES_FOR_ADMIN;

  const router = useRouter();

  useEffect(() => {
    apiFetch("/leave-policies")
      .then((d) => setPolicies(Array.isArray(d) ? d : []))
      .catch(() => {});
    apiFetch("/users?filter=role||$eq||HR&limit=100&sort=name,ASC")
      .then((d) => setHrUsers(Array.isArray(d) ? d : d?.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        /* ── 1. Users (required) ── */
        const usersRes = await apiFetch("/users");
        const userList: User[] = Array.isArray(usersRes) ? usersRes : usersRes.data || [];

        /* ── 2. Timesheets (optional — some roles may not have access) ── */
        let tsList: Timesheet[] = [];
        try {
          const tsRes = await apiFetch("/timesheets");
          tsList = Array.isArray(tsRes) ? tsRes : tsRes.data || [];
        } catch {
          /* Silently skip — activity / hours enrichment won't be available */
        }

        /* ── 3. Build user → timesheet map ── */
        const userMap: Record<number, any[]> = {};
        tsList.forEach((t: any) => {
          if (!userMap[t.userId]) userMap[t.userId] = [];
          userMap[t.userId].push(t);
        });

        /* ── 4. Resolve project names (best-effort) ── */
        const projectIds: number[] = [
          ...new Set(
            tsList
              .map((t: any) => t.projectId)
              .filter((pid: any) => pid != null && pid !== 0)
              .map((pid: any) => Number(pid))
          ),
        ];

        if (projectIds.length > 0) {
          const projectResults: Project[] = await Promise.allSettled(
            projectIds.map((pid: number) =>
              apiFetch(`/projects/${pid}`).then((res: any) => ({
                id: pid,
                name: res?.name || `Project ${pid}`,
              }))
            )
          ).then((results) =>
            results
              .filter((r) => r.status === "fulfilled")
              .map((r: any) => r.value)
          );
          setProjectsMap(
            Object.fromEntries(projectResults.map((p) => [p.id, p.name]))
          );
        }

        /* ── 5. Enrich user list ── */
        const enriched: User[] = userList.map((u: any) => {
          const userTs = userMap[u.id] || [];
          if (userTs.length === 0) {
            return { ...u, lastActive: null, totalHours: 0, projectId: null };
          }
          const sorted = [...userTs].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          const lastEntry = sorted[0];
          const totalHours = userTs.reduce((sum, t) => sum + t.hours, 0);
          return { ...u, lastActive: lastEntry.date, projectId: lastEntry.projectId, totalHours };
        });

        setUsers(enriched);

      } catch (err: any) {
        setError(err.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);


  const createUser = async () => {
    if (!createForm.name.trim())  { setCreateErr("Name is required."); return; }
    if (!createForm.email.trim()) { setCreateErr("Email is required."); return; }
    if (createForm.password.length < 6) { setCreateErr("Password must be at least 6 characters."); return; }
    setCreating(true); setCreateErr("");
    try {
      const body: Record<string, any> = {
        name:     createForm.name.trim(),
        email:    createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role:     createForm.role || "INTERNAL",
      };
      if (createForm.designation.trim()) body.designation = createForm.designation.trim();
      if (createForm.module) body.module = createForm.module;
      if (createForm.leavePolicyId) body.leavePolicyId = parseInt(createForm.leavePolicyId);
      if (createForm.gender) body.gender = createForm.gender;
      if (createForm.hrId) body.hrId = parseInt(createForm.hrId);
      if (createForm.birthdate) body.birthdate = createForm.birthdate;
      body.daysOff = createForm.daysOff;
      await apiFetch("/users", { method: "POST", body: JSON.stringify(body) });
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
      setShowPwd(false);
      /* refresh list */
      const res = await apiFetch("/users");
      setUsers(Array.isArray(res) ? res : res.data ?? []);
    } catch (e: any) {
      setCreateErr(e.message ?? "Failed to create user.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <TablePageSkeleton />;
  if (error) return <p className="text-red-500">{error}</p>;

  /* ── derived filters ── */
  const filtered = users.filter((u) => {
    if (search) {
      const q = search.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    }
    if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
    if (activityFilter !== "ALL" && getActivity(u) !== activityFilter) return false;
    if (moduleFilter && u.module !== moduleFilter) return false;
    return true;
  });

  const countRole     = (r: string) => r === "ALL" ? users.length : users.filter((u) => u.role === r).length;
  const countActivity = (a: string) => a === "ALL" ? users.length : users.filter((u) => getActivity(u) === a).length;
  const hasFilters    = search || roleFilter !== "ALL" || activityFilter !== "ALL" || moduleFilter;
  const clearFilters  = () => { setSearch(""); setRoleFilter("ALL"); setActivityFilter("ALL"); setModuleFilter(""); };

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-1">Real activity based on timesheets</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowCreate(true); setCreateErr(""); setCreateForm(EMPTY_CREATE); }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition"
          >
            <Plus size={15} /> New User
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">

        {/* Search + Module */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="w-44">
            <Combobox
              value={moduleFilter}
              onChange={setModuleFilter}
              placeholder="All modules"
              options={[{ value: "", label: "All modules" }, ...SAP_MODULES]}
            />
          </div>
        </div>

        {/* Role pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-14 flex-shrink-0">Role</span>
          {["ALL", ...ROLES_ALL].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`text-xs px-3 py-1 rounded-full border font-medium transition ${
                roleFilter === r
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {r === "ALL" ? "All" : r.charAt(0) + r.slice(1).toLowerCase()}
              <span className={`ml-1.5 text-[10px] ${roleFilter === r ? "text-white/70" : "text-slate-400"}`}>
                {countRole(r)}
              </span>
            </button>
          ))}
        </div>

        {/* Activity pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-14 flex-shrink-0">Activity</span>
          {(["ALL", ...ACTIVITY_LEVELS] as const).map((a) => (
            <button
              key={a}
              onClick={() => setActivityFilter(a)}
              className={`text-xs px-3 py-1 rounded-full border font-medium transition ${
                activityFilter === a
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {a === "ALL" ? "All" : a}
              <span className={`ml-1.5 text-[10px] ${activityFilter === a ? "text-white/70" : "text-slate-400"}`}>
                {countActivity(a)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Results bar ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-800">{filtered.length}</span> of <span className="font-semibold text-slate-800">{users.length}</span> users
        </p>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50"
          >
            <X size={11} /> Clear filters
          </button>
        )}
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Users size={36} className="opacity-30" />
            <p className="text-sm font-medium">No users match your filters</p>
            <button onClick={clearFilters} className="text-xs text-indigo-600 hover:underline">Clear filters</button>
          </div>
        )}

        {filtered.map((u, i) => {
          const activity = getActivity(u);
          const badge    = ACTIVITY_BADGE[activity];

          return (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -5, boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}
              onClick={() => router.push(`/admin/users/${u.id}`)}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm cursor-pointer"
            >
              <div className="space-y-3">

                <div className="flex justify-between items-center gap-2">
                  <p className="font-semibold text-slate-900 truncate">{u.name}</p>
                  <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${badge}`}>{activity}</span>
                </div>

                <p className="text-sm text-slate-500 truncate">{u.email}</p>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_PILL[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                    {u.role}
                  </span>
                  {u.module && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                      {MODULE_LABEL[u.module] ?? u.module}
                    </span>
                  )}
                </div>

                <div className="text-sm">
                  <span className="text-slate-400">Active Project: </span>
                  <span className="font-medium text-slate-700">
                    {u.projectId ? projectsMap[u.projectId] ?? "—" : "None"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Last active: {u.lastActive ? parseUTC(u.lastActive).toLocaleDateString() : "Never"}</span>
                  <span className="font-medium text-slate-600">{u.totalHours || 0}h total</span>
                </div>

                <p className="text-xs text-indigo-600 font-medium">View analytics →</p>

              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Create User Modal ── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                    <UserPlus size={14} className="text-white" />
                  </div>
                  <h2 className="font-semibold text-slate-900">New User</h2>
                </div>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 transition">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name *</label>
                  <input
                    autoFocus
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. John Doe"
                    className={INPUT}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="john@company.com"
                    className={INPUT}
                  />
                </div>

                {/* Designation */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Designation <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input
                    value={createForm.designation}
                    onChange={(e) => setCreateForm((f) => ({ ...f, designation: e.target.value }))}
                    placeholder="e.g. Senior SAP Consultant"
                    className={INPUT}
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Gender <span className="text-slate-400 font-normal">(optional)</span></label>
                  <Combobox
                    value={createForm.gender}
                    onChange={(val) => setCreateForm((f) => ({ ...f, gender: val }))}
                    placeholder="— Not specified —"
                    options={GENDER_OPTIONS}
                  />
                </div>

                {/* Birthdate */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Date of Birth <span className="text-slate-400 font-normal">(optional)</span></label>
                  <DatePicker
                    value={createForm.birthdate}
                    onChange={(val) => setCreateForm((f) => ({ ...f, birthdate: val }))}
                    placeholder="Select date of birth"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Password *</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={createForm.password}
                      onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Min. 6 characters"
                      className={`${INPUT} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {createForm.password.length > 0 && createForm.password.length < 6 && (
                    <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters.</p>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Role</label>
                  <Combobox
                    value={createForm.role}
                    onChange={(val) => setCreateForm((f) => ({ ...f, role: val }))}
                    options={availableRoles.map((r) => ({ value: r, label: r.charAt(0) + r.slice(1).toLowerCase() }))}
                  />
                </div>

                {/* SAP Module */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">SAP Module <span className="text-slate-400 font-normal">(optional)</span></label>
                  <Combobox
                    value={createForm.module}
                    onChange={(val) => setCreateForm((f) => ({ ...f, module: val }))}
                    placeholder="— None —"
                    options={[{ value: "", label: "None" }, ...SAP_MODULES]}
                  />
                </div>

                {/* Leave Policy */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Leave Policy <span className="text-slate-400 font-normal">(optional)</span></label>
                  <Combobox
                    value={createForm.leavePolicyId}
                    onChange={(val) => setCreateForm((f) => ({ ...f, leavePolicyId: val }))}
                    placeholder="— No policy —"
                    options={[
                      { value: "", label: "No policy" },
                      ...policies.map((p) => ({ value: String(p.id), label: p.name })),
                    ]}
                  />
                </div>

                {/* HR */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">HR <span className="text-slate-400 font-normal">(optional)</span></label>
                  <Combobox
                    value={createForm.hrId}
                    onChange={(val) => setCreateForm((f) => ({ ...f, hrId: val }))}
                    placeholder="— No HR assigned —"
                    searchable
                    options={[
                      { value: "", label: "No HR assigned" },
                      ...hrUsers.map((u) => ({ value: String(u.id), label: u.name })),
                    ]}
                  />
                </div>

                {/* Days Off */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Days Off
                    <span className="ml-1 font-normal text-slate-400">({createForm.daysOff.length} selected)</span>
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {ALL_WEEKDAYS.map((day) => {
                      const active = createForm.daysOff.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() =>
                            setCreateForm((f) => ({
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

                {createErr && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createErr}</p>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 pt-3 border-t border-slate-100 flex gap-3 flex-shrink-0">
                <button
                  onClick={createUser}
                  disabled={creating}
                  className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {creating
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
                    : <><UserPlus size={14} /> Create User</>
                  }
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border border-slate-200 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition"
                >
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