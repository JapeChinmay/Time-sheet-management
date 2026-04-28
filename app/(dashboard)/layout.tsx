"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
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
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
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
    localStorage.clear();
    router.push("/login");
  };

  const isActive = (path: string) => pathname === path;

  return (
    <div className="flex min-h-screen bg-slate-50">

   
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed top-4 left-4 z-50 bg-white border p-2 rounded-md shadow"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

    
      <motion.div
        initial={{ x: -250 }}
        animate={{ x: open || window.innerWidth >= 768 ? 0 : -250 }}
        className="fixed md:static z-40 w-64 h-full bg-white border-r border-slate-200 p-5 flex flex-col"
      >
      
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800 tracking-tight">
            WorkPulse
          </h2>
          <p className="text-xs text-slate-400">
            Workforce Intelligence
          </p>
        </div>

      
         <nav className="space-y-1 text-sm">

          <SidebarItem
            icon={<LayoutDashboard size={16} />}
            label="Dashboard"
            href="/employee"
            active={isActive("/employee")}
          />

          <SidebarItem
            icon={<Clock size={16} />}
            label="Timesheet"
            href="/employee/timesheet"
            active={isActive("/employee/timesheet")}
          />

          <SidebarItem
            icon={<Folder size={16} />}
            label="Projects"
            href="/employee/projects"
            active={isActive("/employee/projects")}
          />

          <SidebarItem
            icon={<ListTodo size={16} />}
            label="Tasks"
            href="/employee/tasks"
            active={pathname.startsWith("/employee/tasks")}
          />

          {(role === "ADMIN" || role === "SUPERADMIN") && (
            <>
              <div className="border-t border-slate-200 my-3" />

              <p className="text-xs text-slate-400 uppercase px-2">
                Admin
              </p>

              <SidebarItem
                icon={<Shield size={16} />}
                label="Admin Overview"
                href="/admin"
                active={isActive("/admin")}
              />

              <SidebarItem
                icon={<Users size={16} />}
                label="Users"
                href="/employee/users"
                active={isActive("/employee/users")}
              />

              <SidebarItem
                icon={<ScrollText size={16} />}
                label="Activity Logs"
                href="/admin/audit-logs"
                active={pathname.startsWith("/admin/audit-logs")}
              />
            </>
          )}
        </nav>

      
        <div className="mt-auto pt-6 border-t border-slate-200">

        <motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.97 }}
  onClick={() => setShowLogoutModal(true)}
  className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition"
>
  <LogOut size={16} />
  Logout
</motion.button>

          <p className="text-xs text-slate-400 mt-4">
            v1.0 WorkPulse
          </p>
        </div>
      </motion.div>

 
      <div className="flex-1 p-6 md:ml-0">
        {children}
      </div>

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
        <h3 className="text-lg font-semibold text-slate-900">
          Confirm Logout
        </h3>

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


function SidebarItem({
  icon,
  label,
  href,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ x: 3 }}
        className={`relative flex items-center gap-3 px-3 py-2 rounded-md transition
        ${
          active
            ? "bg-slate-900 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
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