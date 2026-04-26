"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import SmartLoader from "@/components/ui/SmartLoader";
import { useRouter } from "next/navigation";


export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const router = useRouter();


  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await apiFetch("/users"); // 🔥 protected API
        setUsers(data);
      } catch (err: any) {
        setError(err.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

if (loading) {
  const token = localStorage.getItem("token");

  let name = "User";
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      name = payload.name || "User";
    } catch {}
  }

  return <SmartLoader name={name} />
}
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">All Users</h1>

  <div className="space-y-3">
  {users.map((u, i) => (
    <div
      key={i}
      className="p-4 bg-white border rounded shadow-sm"
    >
      <p className="font-medium text-slate-800">{u.name}</p>
      <p className="text-sm text-slate-500">{u.email}</p>
      <p className="text-xs text-slate-400">{u.role}</p>


      <button
        onClick={() => router.push(`/admin/timesheets?userId=${u.id}`)}
        className="text-xs text-blue-600 hover:underline mt-2"
      >
        View Timesheets
      </button>
    </div>
  ))}
</div>
  
    </div>
  );
}