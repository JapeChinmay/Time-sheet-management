"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setRole(payload.role);
      } catch {}
    }
  }, []);

  return (
    <div className="flex min-h-screen">

      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white p-5">
        <h2 className="text-base font-semibold mb-6">ChronoTrack</h2>

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

 
      <div className="flex-1 bg-slate-50 p-6">
        {children}
      </div>
    </div>
  );
}