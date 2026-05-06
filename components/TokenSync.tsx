"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { setAccessToken } from "@/lib/api";

export function TokenSync() {
  const { data: session, status } = useSession();
  useEffect(() => {
    if (status === "loading") return;          // wait – don't mark ready yet
    setAccessToken((session as any)?.accessToken ?? null);
  }, [session, status]);
  return null;
}
