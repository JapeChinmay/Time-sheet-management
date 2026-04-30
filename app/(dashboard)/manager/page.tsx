"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ManagerPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/manager/timesheets");
  }, [router]);
  return null;
}
