"use client";

import { useSession } from "next-auth/react";
import DashboardClient from "@/components/DashboardClient";

export default function EmployeeDashboard() {
  const { data: session } = useSession();
  return <DashboardClient name={session?.user?.name ?? "User"} />;
}
