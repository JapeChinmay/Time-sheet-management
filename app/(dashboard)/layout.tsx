"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setRole(payload.role);
      } catch {}
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.clear();

  

    router.push("/login");
  };

  return (
    <div className="flex min-h-screen">

    
      <div className="w-64 bg-slate-900 text-white p-5 flex flex-col justify-between">

        <div>
          <h2 className="text-base font-semibold mb-6">WorkPulse</h2>

          <nav className="space-y-2 text-sm">

            <Link href="/employee" className="block text-slate-300 hover:text-white">
              Dashboard
            </Link>

            <Link href="/employee/timesheet" className="block text-slate-300 hover:text-white">
              Timesheet
            </Link>

            <Link href="/employee/projects" className="block text-slate-300 hover:text-white">
              Projects
            </Link>

          
            {(role === "ADMIN" || role === "SUPERADMIN") && (
              <>
                <div className="border-t border-slate-700 my-3" />

                <p className="text-xs text-slate-400 uppercase">Admin</p>

                <Link href="/admin" className="block text-slate-300 hover:text-white">
                  Admin Overview
                </Link>

                <Link href="/employee/users" className="block text-slate-300 hover:text-white">
                  Users
                </Link>
              </>
            )}
          </nav>
        </div>

     
        <div className="pt-6 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-red-400 hover:text-red-300 transition"
          >
            Logout
          </button>
        </div>

      </div>

  \
      <div className="flex-1 bg-slate-50 p-6">
        {children}
      </div>
    </div>
  );
}