import { auth } from "@/auth";
import DashboardClient from "@/components/DashboardClient";

export default async function EmployeeDashboard() {
  const session = await auth();

  return <DashboardClient name={session?.user?.name || "User"} />;
}