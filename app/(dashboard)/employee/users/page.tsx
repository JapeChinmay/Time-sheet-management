"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

type User = {
  id: number;
  name: string;
  email: string;
  role: string;

  // 🔥 dummy enrichment (until backend supports)
  lastActive?: string;
  project?: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const router = useRouter();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await apiFetch("/users");

        const list = Array.isArray(data) ? data : data.data || [];

        // 🔥 enrich users with dummy project + activity
        const enriched = list.map((u: any, i: number) => ({
          ...u,
          project:
            i % 3 === 0
              ? "Website Redesign"
              : i % 3 === 1
              ? "Internal Tooling"
              : null,

          // simulate last active (0 → 10 days)
          lastActive: new Date(
            Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000
          ).toISOString(),
        }));

        setUsers(enriched);

      } catch (err: any) {
        setError(err.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
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

      {/* 🔥 HEADER */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
          Users
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor user activity and project engagement
        </p>
      </div>

      {/* 🔥 GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

        {users.map((u, i) => {
          const last = new Date(u.lastActive || "").getTime();
          const diffDays =
            (Date.now() - last) / (1000 * 60 * 60 * 24);

          // 🔥 color logic
          let borderColor = "border-slate-200";
          let badge = "bg-green-100 text-green-700";
          let statusText = "Active";

          if (!u.project) {
            badge = "bg-slate-200 text-slate-600";
            statusText = "Unassigned";
          }

          if (diffDays > 2 && diffDays <= 7) {
            borderColor = "border-yellow-300";
            badge = "bg-yellow-100 text-yellow-700";
            statusText = "Idle";
          }

          if (diffDays > 7) {
            borderColor = "border-red-300";
            badge = "bg-red-100 text-red-700";
            statusText = "Inactive";
          }

          return (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -5 }}
              className={`relative bg-white border ${borderColor} rounded-xl p-5 shadow-sm`}
            >
              {/* gradient layer */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-60 pointer-events-none rounded-xl" />

              <div className="relative space-y-3">

                {/* 🔥 NAME */}
                <div className="flex justify-between items-center">
                  <p className="font-semibold text-slate-900">
                    {u.name}
                  </p>

                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${badge}`}
                  >
                    {statusText}
                  </span>
                </div>

                {/* EMAIL */}
                <p className="text-sm text-slate-500">
                  {u.email}
                </p>

                {/* ROLE */}
                <p className="text-xs text-slate-400">
                  Role: {u.role}
                </p>

                {/* PROJECT */}
                <div className="text-sm">
                  <span className="text-slate-400">
                    Active Project:
                  </span>{" "}
                  <span className="font-medium text-slate-700">
                    {u.project || "None"}
                  </span>
                </div>

                {/* LAST ACTIVE */}
                <p className="text-xs text-slate-400">
                  Last Active:{" "}
                  {new Date(u.lastActive || "").toLocaleDateString()}
                </p>

                {/* ACTION */}
                <button
                  onClick={() =>
                    router.push(`/admin/timesheets?userId=${u.id}`)
                  }
                  className="text-xs text-slate-900 font-medium hover:underline mt-2"
                >
                  View Timesheets →
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}