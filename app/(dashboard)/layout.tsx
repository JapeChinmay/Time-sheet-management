import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white p-5">
        <h2 className="text-base font-semibold mb-6">ChronoTrack</h2>

        <nav className="space-y-2 text-sm">

          <Link
            href="/employee"
            className="block text-slate-300 hover:text-white transition"
          >
            Dashboard
          </Link>

          <Link
            href="/employee/timesheet"
            className="block text-slate-300 hover:text-white transition"
          >
            Timesheet
          </Link>

          <Link
            href="/employee/projects"
            className="block text-slate-300 hover:text-white transition"
          >
            Projects
          </Link>

          <Link
            href="/employee/reports"
            className="block text-slate-300 hover:text-white transition"
          >
            Reports
          </Link>

        </nav>
      </div>

      {/* Main */}
      <div className="flex-1 bg-slate-50 p-6">
        {children}
      </div>
    </div>
  );
}