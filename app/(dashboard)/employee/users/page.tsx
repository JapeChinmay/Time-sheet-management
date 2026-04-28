"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";
import { parseUTC } from "@/lib/date";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

type Project = {
  id: number;
  name: string;
};

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
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

  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, tsRes] = await Promise.all([
          apiFetch("/users"),
          apiFetch("/timesheets"),
        ]);

        const userList: User[] = Array.isArray(usersRes)
          ? usersRes
          : usersRes.data || [];


const tsList: Timesheet[] = Array.isArray(tsRes)
  ? tsRes
  : tsRes.data || [];
     
        const userMap: Record<number, any[]> = {};

        tsList.forEach((t: any) => {
          if (!userMap[t.userId]) userMap[t.userId] = [];
          userMap[t.userId].push(t);
        });

    
        const projectIds: number[] = [
          ...new Set(tsList.map((t: any) => Number(t.projectId))),
        ];

      
        const projectResults: Project[] = await Promise.all(
          projectIds.map((pid: number) =>
            apiFetch(`/projects/${pid}`).then((res: any) => ({
              id: pid,
              name: res?.name || `Project ${pid}`,
            }))
          )
        );

      
        const map: Record<number, string> = Object.fromEntries(
          projectResults.map((p) => [p.id, p.name])
        );

        setProjectsMap(map);

     
        const enriched: User[] = userList.map((u: any) => {
          const userTs = userMap[u.id] || [];

          if (userTs.length === 0) {
            return {
              ...u,
              lastActive: null,
              totalHours: 0,
              projectId: null,
            };
          }

          const sorted = [...userTs].sort(
            (a, b) =>
              new Date(b.date).getTime() -
              new Date(a.date).getTime()
          );

          const lastEntry = sorted[0];

          const totalHours = userTs.reduce(
            (sum, t) => sum + t.hours,
            0
          );

          return {
            ...u,
            lastActive: lastEntry.date,
            projectId: lastEntry.projectId,
            totalHours,
          };
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

  const getUser = () => {
    try {
      const token = localStorage.getItem("token");
      return JSON.parse(atob(token!.split(".")[1]));
    } catch {
      return { name: "User" };
    }
  };

  if (loading) return <SmartLoader name={getUser().name} />;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-6">

    
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
          Users
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Real activity based on timesheets
        </p>
      </div>

   
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

        {users.map((u, i) => {
          const last = u.lastActive
            ? parseUTC(u.lastActive).getTime()
            : 0;

          const diffDays =
            (Date.now() - last) / (1000 * 60 * 60 * 24);

          let badge = "bg-slate-200 text-slate-600";
          let statusText = "No Activity";

          if (u.lastActive) {
            if (diffDays <= 2) {
              badge = "bg-green-100 text-green-700";
              statusText = "Active";
            } else if (diffDays <= 7) {
              badge = "bg-yellow-100 text-yellow-700";
              statusText = "Idle";
            } else {
              badge = "bg-red-100 text-red-700";
              statusText = "Inactive";
            }
          }

          return (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -5, boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}
              onClick={() => router.push(`/admin/users/${u.id}`)}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm cursor-pointer"
            >
              <div className="space-y-3">

                <div className="flex justify-between items-center">
                  <p className="font-semibold text-slate-900">
                    {u.name}
                  </p>

                  <span className={`text-xs px-2 py-1 rounded-full ${badge}`}>
                    {statusText}
                  </span>
                </div>

                <p className="text-sm text-slate-500">
                  {u.email}
                </p>

                <p className="text-xs text-slate-400">
                  Role: {u.role}
                </p>

                <div className="text-sm">
                  <span className="text-slate-400">
                    Active Project:
                  </span>{" "}
                  <span className="font-medium text-slate-700">
                    {u.projectId
                      ? projectsMap[u.projectId]
                      : "None"}
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  Last Active:{" "}
                  {u.lastActive
                    ? parseUTC(u.lastActive).toLocaleDateString()
                    : "Never"}
                </p>

                <p className="text-xs text-slate-400">
                  Total Hours: {u.totalHours || 0}h
                </p>

                <p className="text-xs text-indigo-600 font-medium mt-2">
                  View analytics →
                </p>

              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}