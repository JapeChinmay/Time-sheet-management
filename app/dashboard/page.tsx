"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DashboardRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) { router.replace("/login"); return; }

    const role = session.user?.role?.toUpperCase() ?? "";
    if (role === "SUPERADMIN" || role === "ADMIN")  router.replace("/admin");
    else if (role === "MANAGER")                    router.replace("/manager/timesheets");
    else if (role === "HR")                         router.replace("/hr/leaves");
    else                                            router.replace("/employee");
  }, [session, status, router]);

  return null;
}
