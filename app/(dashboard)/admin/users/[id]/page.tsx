"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import SmartLoader from "@/components/ui/SmartLoader";

type Project = {
  id: number;
  name: string;
};


type Timesheet = {
  id: number;
  userId: number;
  projectId: number;
  date: string;
  hours: number;
  status?: string;
};
function UserAvatar({
  name,
  avatar,
}: {
  name: string;
  avatar?: string;
}) {
  if (avatar) {
    return (
      <img
        src={avatar}
        className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border border-slate-200"
      />
    );
  }

  const initials = name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const colors = [
    "bg-slate-900",
    "bg-blue-600",
    "bg-green-600",
    "bg-purple-600",
  ];

  const color = colors[name?.length % colors.length];

  return (
    <div
      className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white font-semibold ${color}`}
    >
      {initials}
    </div>
  );
}

export default function UserDetailPage() {
  const params = useParams();

  const userId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : "";

  const [user, setUser] = useState<any>(null);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [assignLoading, setAssignLoading] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [showAssign, setShowAssign] = useState(false);

  const getUser = () => {
    try {
      const token = localStorage.getItem("token");
      return JSON.parse(atob(token!.split(".")[1]));
    } catch {
      return { role: "" };
    }
  };

  const currentUser = getUser();

  const isAdmin =
    currentUser.role === "ADMIN" ||
    currentUser.role === "SUPERADMIN";

  useEffect(() => {
    const load = async () => {
      try {
        const userData = await apiFetch(`/users/${userId}`);

        const tsData = await apiFetch(`/timesheets?userId=${userId}`);
        const tsList  : Timesheet[]= Array.isArray(tsData)
          ? tsData
          : tsData.data || [];

        setUser(userData);
        setTimesheets(tsList);

        const uniqueProjectIds: number[] = [
          ...new Set(tsList.map((t: any) => Number(t.projectId))),
        ];

        const projectResults: Project[] = await Promise.all(
          uniqueProjectIds.map((pid) =>
            apiFetch(`/projects/${pid}`).then((res: any) => ({
              id: pid,
              name: res?.name || "Unknown Project",
            }))
          )
        );

        const map: Record<number, string> = {};
        projectResults.forEach((p) => {
          map[p.id] = p.name;
        });

        setProjectsMap(map);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) load();
  }, [userId]);

  if (loading || assignLoading)
    return <SmartLoader name={user?.name || "User"} />;

  if (!user) return <p className="p-6">User not found</p>;

  const totalHours = timesheets.reduce((sum, t) => sum + t.hours, 0);

  return (
    <div className="space-y-8 p-4 md:p-6">

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <UserAvatar name={user.name} avatar={user.avatar} />

          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
              {user.name}
            </h1>
            <p className="text-sm text-slate-500">{user.email}</p>
            <p className="text-xs text-slate-400 mt-1">
              Role: {user.role}
            </p>
          </div>

          <div className="hidden md:block text-right">
            <p className="text-xs text-slate-400">Total Hours</p>
            <p className="text-lg font-semibold text-slate-900">
              {totalHours}h
            </p>
          </div>
        </div>
      </div>

      {timesheets.length === 0 && isAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
          <p className="text-sm text-slate-500 mb-4">
            No projects assigned to this user
          </p>

          <button
            onClick={async () => {
              try {
                setAssignLoading(true);
                setShowAssign(true);

                const res = await apiFetch("/projects");
                const list = Array.isArray(res) ? res : res.data || [];

                setAvailableProjects(list);
              } catch (err) {
                console.error(err);
              } finally {
                setAssignLoading(false);
              }
            }}
            className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm"
          >
            Assign Project
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {timesheets.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-800">
              {projectsMap[t.projectId] || "Loading..."}
            </p>

            <p className="text-xs text-slate-500">
              {new Date(t.date).toLocaleDateString()}
            </p>

            <p className="text-lg font-semibold text-slate-900">
              {t.hours}h
            </p>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showAssign && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white p-6 rounded-xl w-full max-w-md"
            >
              <h3 className="text-lg font-semibold mb-4">
                Assign Project
              </h3>

              <div className="space-y-2 max-h-60 overflow-auto">
                {availableProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      const assignments: Record<string, number[]> =
                        JSON.parse(
                          localStorage.getItem("projectAssignments") ||
                            "{}"
                        );

                      if (!assignments[userId]) {
                        assignments[userId] = [];
                      }

                      if (!assignments[userId].includes(p.id)) {
                        assignments[userId].push(p.id);
                      }

                      localStorage.setItem(
                        "projectAssignments",
                        JSON.stringify(assignments)
                      );

                      setShowAssign(false);
                      location.reload();
                    }}
                    className="w-full text-left px-3 py-2 border rounded-md hover:bg-slate-50"
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowAssign(false)}
                className="mt-4 w-full border py-2 rounded-md"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}